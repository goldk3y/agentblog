/**
 * Checks over the installed block as a whole.
 *
 * Covers doctor checks 7, 11, 19, 24, 28, 30, and 33.
 *
 * Check 33, the presence check, earns its place first. A `registry:page` item is framework
 * gated: when shadcn does not detect the framework it installs **zero files,
 * silently, with exit code 0**. The install prints success, nothing lands, and
 * the next thing the user sees is a 404 they will blame on Next.js. Looking for
 * the files on disk is the only thing that catches it.
 *
 * @see https://docs.agentblog.dev/troubleshooting
 */
import { blankCommentsAndStrings } from '@agentblog/checks'

import { appPath, appPathLabel } from '../detect/project.ts'
import { blockFiles, routeFileStatus } from '../detect/routes.ts'
import { followDefault } from '../detect/resolve.ts'
import { readFile, toPosixRelative, walk } from '../util/fs.ts'
import { runBoundaryChecks } from './boundary-checks.ts'
import type { DoctorContext } from './context.ts'

/** Components allowed to be client components. Both render server side first. */
const CLIENT_ALLOWLIST = ['table-of-contents.tsx', 'share-buttons.tsx', 'use-toc-active-heading.ts']

export function runBlockChecks(ctx: DoctorContext): void {
  checkRouteFilesLanded(ctx)
  checkNoClientComponents(ctx)
  checkImageQualitiesUsed(ctx)
  checkMetadataDefaults(ctx)
  runBoundaryChecks(ctx)
}

/**
 * Check 33. The registry wrote the files, or it did not.
 *
 * It carries a number because it is a check like any other and a user has to be
 * able to name it. It ran unnumbered for a while, which meant the single most
 * valuable finding in the tool, the one that catches shadcn's framework-gated
 * `registry:page` installing zero files with exit code 0, was the one finding
 * nobody could look up. Nothing else in the report means anything until it
 * passes, so it prints first.
 */
function checkRouteFilesLanded(ctx: DoctorContext): void {
  ctx.reporter.group('Installed files')

  const status = routeFileStatus(ctx.project)
  const missing = status.filter((entry) => !entry.present)

  if (missing.length === status.length) {
    ctx.reporter.fail('33 route files landed', {
      id: 'route-files-missing',
      severity: 'error',
      message: `None of the blog route files exist (${missing.map((entry) => entry.label).join(', ')}). A registry:page item installs zero files silently, with exit code 0, when shadcn cannot detect the framework.`,
      remedy:
        'Run npx shadcn@latest add @agentblog/blog --overwrite from the directory holding next.config, and check the output names the files.',
    })
    return
  }
  if (missing.length > 0) {
    ctx.reporter.fail('33 route files landed', {
      id: 'route-files-partial',
      severity: 'error',
      message: `Some blog route files are missing: ${missing.map((entry) => entry.label).join(', ')}.`,
      remedy: 'npx shadcn@latest add @agentblog/blog --overwrite',
    })
    return
  }
  ctx.reporter.pass(`33 route files landed (${status.length} of ${status.length})`)
}

/**
 * Check 7. AI crawlers do not execute JavaScript, so a client component in the
 * article render path is an empty shell for exactly the readers this product
 * exists to reach.
 */
function checkNoClientComponents(ctx: DoctorContext): void {
  ctx.reporter.group('Render path')

  const paths = [
    ...walk(appPath(ctx.project, 'app/blog'), { extensions: ['.tsx'] }),
    ...walk(appPath(ctx.project, 'components/blog'), { extensions: ['.tsx'] }),
    ...walk(appPath(ctx.project, 'components/mdx'), { extensions: ['.tsx'] }),
  ]

  if (paths.length === 0) {
    ctx.reporter.skip(
      '7 no client components in the article path',
      'the block is not installed yet',
    )
    return
  }

  const offenders = paths.filter((path) => {
    if (CLIENT_ALLOWLIST.some((allowed) => path.endsWith(allowed))) return false
    const source = readFile(path)
    return source !== null && /^\s*['"]use client['"]/m.test(source)
  })

  if (offenders.length > 0) {
    ctx.reporter.fail('7 no client components in the article path', {
      id: 'use-client-in-render-path',
      severity: 'error',
      message: `'use client' in the article render path: ${offenders
        .map((path) => toPosixRelative(ctx.project.root, path))
        .join(', ')}. Non-JavaScript crawlers receive an empty shell for that content.`,
      remedy:
        'Move the interactive part into its own component and keep the text in a server component.',
    })
    return
  }
  ctx.reporter.pass('7 the article render path is fully server rendered')
}

/**
 * Check 11, the half that the config alone cannot answer: every quality the
 * block actually passes to `<Image>` has to appear in `images.qualities`.
 * Next.js 16 returns 400 from the optimizer for anything unlisted, so a hero at
 * quality 90 works in development and fails in production.
 */
function checkImageQualitiesUsed(ctx: DoctorContext): void {
  ctx.reporter.group('Images')

  const configSource = ctx.project.nextConfigPath ? readFile(ctx.project.nextConfigPath) : null
  if (configSource === null) {
    ctx.reporter.skip('11 image qualities in use', 'next.config could not be read')
    return
  }

  // Comments are blanked first. A commented-out `// qualities: [75]` used to
  // read as the configured set, so a config with no qualities at all reported
  // "next.config lists 75" and the block's quality 90 looked like the only
  // problem. `blankCommentsAndStrings` preserves offsets, so the match is over
  // the same text at the same positions, minus anything that is not code.
  const configured = new Set(
    (/qualities\s*:\s*\[([^\]]*)\]/.exec(blankCommentsAndStrings(configSource))?.[1] ?? '')
      .split(',')
      // `''.split(',')` is `['']`, and `Number('')` is 0, so without this the
      // empty case reported "next.config lists 0" rather than "nothing".
      .filter((part) => part.trim().length > 0)
      .map((part) => Number(part.trim()))
      .filter((value) => Number.isFinite(value)),
  )

  const used = new Set<number>()
  for (const path of blockFiles(ctx.project)) {
    const source = readFile(path)
    if (source === null) continue
    for (const match of source.matchAll(/quality\s*=\s*\{?\s*(\d+)/g)) {
      used.add(Number(match[1]))
    }
  }

  if (used.size === 0) {
    ctx.reporter.skip('11 image qualities in use', 'no explicit quality props found in the block')
    return
  }

  const unlisted = [...used].filter((quality) => !configured.has(quality))
  if (unlisted.length > 0) {
    ctx.reporter.fail('11 image qualities in use', {
      id: 'image-quality-unlisted',
      severity: 'error',
      message: `The block requests image quality ${unlisted.join(', ')} but next.config lists ${[...configured].join(', ') || 'nothing'}. The optimizer returns 400 for anything unlisted.`,
      remedy: 'npx agentblog doctor --fix',
      fixable: true,
    })
    return
  }
  ctx.reporter.pass('11 every image quality used by the block is configured')
}

/**
 * Check 19, read from the route source. Nothing here is asserted against built
 * HTML, and the check's own name says so.
 *
 * Metadata merging in Next.js is shallow, so a route that defines `openGraph` at
 * all replaces the parent's entire object and silently drops `og:site_name`. The
 * stronger assertion would be against rendered output, which needs a production
 * build `doctor` does not run, so that half is reported as a skip and this half
 * claims only what it read: that the routes go through the shared builders.
 */
function checkMetadataDefaults(ctx: DoctorContext): void {
  ctx.reporter.group('Metadata')

  const routes = [
    'app/blog/page.tsx',
    'app/blog/[slug]/page.tsx',
    'app/blog/category/[slug]/page.tsx',
  ]
  const offenders: string[] = []
  let checked = 0

  for (const relativePath of routes) {
    const path = appPath(ctx.project, relativePath)
    const raw = readFile(path)
    if (raw === null) continue
    const source = followDefault(ctx.project, path, raw).source
    checked += 1
    const code = blankCommentsAndStrings(source)
    const definesMetadata = /openGraph\s*:/.test(code) || /robots\s*:/.test(code)
    if (definesMetadata && !usesSharedMetadata(code)) {
      offenders.push(appPathLabel(ctx.project, relativePath))
    }
  }

  if (checked === 0) {
    ctx.reporter.skip(
      '19 metadata defaults in the route source',
      'no blog routes are installed yet',
    )
    return
  }
  if (offenders.length > 0) {
    ctx.reporter.fail('19 metadata defaults in the route source', {
      id: 'metadata-defaults-dropped',
      severity: 'warning',
      message: `${offenders.join(', ')} defines openGraph or robots without spreading the shared defaults. Metadata merge is shallow, so og:site_name and max-snippet: -1 are dropped for that route.`,
      remedy: 'Build the object with buildPostMetadata or buildListMetadata from @/lib/metadata.',
    })
  } else {
    ctx.reporter.pass(
      '19 the route source builds metadata from the shared defaults. Read from the source, not asserted against built HTML',
    )
  }
  ctx.reporter.skip(
    '19 metadata defaults in built HTML',
    'asserting this against rendered output needs a production build, which doctor does not run',
  )
}

/** The names that count as "this route goes through the shared builders". */
const SHARED_METADATA_NAMES = [
  'openGraphDefaults',
  'robotsDefaults',
  'buildPostMetadata',
  'buildListMetadata',
] as const

/**
 * `true` when the route both **imports** one of the shared metadata names and
 * **uses** it somewhere that is not the import statement.
 *
 * A plain substring search over the whole file passed a route that hand-rolled
 * `openGraph:` and mentioned `buildPostMetadata` only in a comment explaining
 * why it no longer used it. That is the exact shape check 19 exists to catch, so
 * a check that a comment can satisfy is worse than no check: it reports OK on
 * the failing case and nobody looks again.
 *
 * Comments and string contents are already blanked by the caller, so the only
 * remaining way to fake this is to import the symbol and never call it, which
 * costs a lint error in the user's own project.
 */
function usesSharedMetadata(code: string): boolean {
  const imported = new Set<string>()
  const body = code.replace(
    /import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*['"][^'"]*['"]/g,
    (whole, names: string) => {
      for (const specifier of names.split(',')) {
        const local = specifier
          .trim()
          .split(/\s+as\s+/)
          .pop()
          ?.trim()
        if (local) imported.add(local)
      }
      return ' '.repeat(whole.length)
    },
  )

  return SHARED_METADATA_NAMES.some(
    (name) => imported.has(name) && new RegExp(`(?<![\\w$])${name}(?![\\w$])`).test(body),
  )
}
