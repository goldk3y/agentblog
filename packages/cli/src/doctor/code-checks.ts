/**
 * Checks over the route files the registry installed.
 *
 * Covers doctor checks 4, 5, 6, 8, 17, 22, and 23. These read the syntax tree
 * rather than the text wherever the answer depends on structure: check 4 has to
 * know that `.slice(` sits *inside* `generateStaticParams` and not in some
 * unrelated helper, and a grep cannot tell the difference.
 *
 * @see https://agentblog.dev/docs/cli-reference
 */
import { Node } from '../patchers/ts-project.ts'
import { appPath, appPathLabel } from '../detect/project.ts'
import { followExport } from '../detect/resolve.ts'
import { readFile, toPosixRelative } from '../util/fs.ts'
import { parse, readRoute } from './source-access.ts'
import { runRouteHygieneChecks } from './route-hygiene-checks.ts'
import type { DoctorContext } from './context.ts'

export function runCodeChecks(ctx: DoctorContext): void {
  ctx.reporter.group('Route files')
  checkGenerateStaticParams(ctx)
  checkRobots(ctx)
  checkSitemap(ctx)
  checkPublishRoute(ctx)
  runRouteHygieneChecks(ctx)
}

/**
 * Check 4. `generateStaticParams` must return every slug.
 *
 * A slice here is not a performance optimization, it is a decision to stop
 * prerendering some posts. Next.js does not re-run this function during ISR, so
 * a slug that was sliced out was never in the prerendered set, and the first
 * crawler to reach it gets whatever a cold render produces.
 */
function checkGenerateStaticParams(ctx: DoctorContext): void {
  const relativePath = 'app/blog/[slug]/page.tsx'
  const path = appPath(ctx.project, relativePath)
  const routeSource = readFile(path)
  if (routeSource === null) {
    ctx.reporter.skip(
      '4 generateStaticParams',
      `${appPathLabel(ctx.project, relativePath)} is not installed`,
    )
    return
  }

  // Follow `export { generateStaticParams } from '...'` to the module that
  // actually declares it, so a re-export does not read as an absence.
  const holder = followExport(ctx.project, path, routeSource, 'generateStaticParams')
  const file = holder
    ? {
        source: holder.source,
        label: toPosixRelative(ctx.project.root, holder.path),
        path: holder.path,
      }
    : { source: routeSource, label: appPathLabel(ctx.project, relativePath), path }

  const sourceFile = parse(file.path, file.source)
  const declaration =
    sourceFile.getFunction('generateStaticParams') ??
    sourceFile.getVariableDeclaration('generateStaticParams')

  if (!declaration) {
    ctx.reporter.fail('4 generateStaticParams', {
      id: 'generate-static-params-missing',
      severity: 'error',
      message: `${file.label} does not export generateStaticParams, so no post is prerendered and every AI crawler gets a cold render.`,
      remedy: 'Re-install the route: npx shadcn@latest add @agentblog/blog-routes --overwrite',
    })
    return
  }

  if (/\.slice\s*\(/.test(declaration.getText())) {
    ctx.reporter.fail('4 generateStaticParams', {
      id: 'generate-static-params-sliced',
      severity: 'error',
      message: `${file.label} slices the result of generateStaticParams. Next.js does not re-run it during ISR, so every sliced post is permanently outside the prerendered set.`,
      remedy: 'Return every slug. Pagination belongs on the index route, not here.',
    })
    return
  }

  ctx.reporter.pass('4 generateStaticParams returns every slug')
}

/**
 * Check 5. The `VERCEL_ENV` guard is what keeps a preview deployment unindexed.
 *
 * `AGENTBLOG_PUBLIC_SITE` counts too: the shipped file fails closed and uses it
 * as the opt-in for deployments that are not on Vercel, so a file that only
 * mentions that variable is guarded, not unguarded.
 */
function checkRobots(ctx: DoctorContext): void {
  const file = readRoute(ctx, 'app/robots.ts', '5 robots.ts environment guard')
  if (!file) return

  if (!/VERCEL_ENV|NODE_ENV|AGENTBLOG_PUBLIC_SITE/.test(file.source)) {
    ctx.reporter.fail('5 robots.ts environment guard', {
      id: 'robots-env-guard-missing',
      severity: 'error',
      message: `${file.label} has no environment guard, so preview deployments serve an indexable robots.txt and compete with production for the same content.`,
      remedy:
        "npx agentblog doctor --fix inserts an early return of { rules: [{ userAgent: '*', disallow: '/' }] } when VERCEL_ENV is not 'production' and AGENTBLOG_PUBLIC_SITE is not 'true'.",
      fixable: true,
    })
    return
  }
  ctx.reporter.pass('5 robots.ts guards non-production environments')
}

/**
 * Check 6. `new Date()` as `lastModified` publishes a fresh timestamp for every
 * URL on every build, which trains crawlers to ignore your `lastmod` entirely.
 */
function checkSitemap(ctx: DoctorContext): void {
  const file = readRoute(ctx, 'app/sitemap.ts', '6 sitemap lastModified')
  if (!file) return

  const sourceFile = parse(file.parsePath, file.source)
  const fabricated = sourceFile
    .getDescendants()
    .some(
      (node) =>
        Node.isNewExpression(node) &&
        node.getExpression().getText() === 'Date' &&
        node.getArguments().length === 0,
    )

  if (fabricated) {
    ctx.reporter.fail('6 sitemap lastModified', {
      id: 'sitemap-fabricated-lastmod',
      severity: 'error',
      message: `${file.label} calls new Date() with no argument. Every URL then claims to have changed at build time, which is false freshness and teaches crawlers to ignore lastmod.`,
      remedy: 'Use the real dateModified from each post.',
    })
    return
  }
  ctx.reporter.pass('6 sitemap lastModified comes from real content dates')
}

/**
 * Checks 8 and 17, both about the publish webhook.
 *
 * `revalidateTag(tag)` with no profile still works and is deprecated, so it is
 * reported as a warning. `'max'` on the publish path is an error: it is the
 * opposite of what publishing means.
 *
 * The sitemap and feed are cached route handlers, so a webhook that revalidates
 * only the page routes leaves both stale, and a crawler that reads the sitemap
 * to find new posts never sees the one you just published.
 */
function checkPublishRoute(ctx: DoctorContext): void {
  const file = readRoute(ctx, 'app/api/publish/route.ts', '8 revalidateTag profile')
  if (!file) return

  const sourceFile = parse(file.parsePath, file.source)
  let missingProfile = 0
  let usesMax = false

  for (const node of sourceFile.getDescendants()) {
    if (!Node.isCallExpression(node)) continue
    if (!node.getExpression().getText().endsWith('revalidateTag')) continue
    const args = node.getArguments()
    if (args.length < 2) missingProfile += 1
    else if (/['"]max['"]/.test(args[1]!.getText())) usesMax = true
  }

  if (missingProfile > 0) {
    ctx.reporter.fail('8 revalidateTag profile', {
      id: 'revalidate-tag-no-profile',
      severity: 'warning',
      message: `${file.label} calls revalidateTag without a profile ${missingProfile} time(s). Single argument still works in Next.js 16 and is deprecated.`,
      remedy: "Pass a profile: revalidateTag('posts', { expire: 0 }).",
    })
  } else if (usesMax) {
    ctx.reporter.fail('8 revalidateTag profile', {
      id: 'revalidate-tag-max',
      severity: 'error',
      message: `${file.label} uses the 'max' profile on the publish path, which keeps serving the cached copy of a post you just published.`,
      remedy: 'Use { expire: 0 } on publish.',
    })
  } else {
    ctx.reporter.pass('8 revalidateTag passes a profile')
  }

  const revalidatesFeeds =
    /['"]\/sitemap\.xml['"]/.test(file.source) && /['"]\/feed\.xml['"]/.test(file.source)
  if (!revalidatesFeeds) {
    ctx.reporter.fail('17 webhook revalidates metadata routes', {
      id: 'publish-misses-metadata-routes',
      severity: 'warning',
      message: `${file.label} does not revalidate /sitemap.xml and /feed.xml. Both are cached route handlers, so a new post stays missing from the two files crawlers use to find it.`,
      remedy: "Add revalidatePath('/sitemap.xml') and revalidatePath('/feed.xml').",
    })
  } else {
    ctx.reporter.pass('17 the publish webhook revalidates the sitemap and the feed')
  }
}
