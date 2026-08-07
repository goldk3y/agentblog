/**
 * Route hygiene: async request APIs and next/image props.
 *
 * Doctor checks 22 and 23. Both read a route's implementation rather than its
 * text where it matters: the block's own source explains the preload rule in a
 * comment, and counting the word rather than the JSX prop would report that
 * comment as three preloaded images.
 *
 * @see https://docs.agentblog.dev/reference/cli
 */
import { stripComments } from '@agentblog/checks'

import { Node } from '../patchers/ts-project.ts'
import { appPathLabel } from '../detect/project.ts'
import { jsxAttributeNames, parse, resolvedSource } from './source-access.ts'
import type { DoctorContext } from './context.ts'

export function runRouteHygieneChecks(ctx: DoctorContext): void {
  checkAsyncApis(ctx)
  checkImagePreload(ctx)
}

/**
 * Check 22. Synchronous `params`, `searchParams`, `cookies()`, and `headers()`
 * were fully removed in Next.js 16, not merely deprecated.
 *
 * The `cookies()` and `headers()` half is exact: a call expression that is not
 * awaited is wrong. The `params` half is a heuristic, because proving that an
 * identifier holds a promise needs the type checker and this project is parsed
 * without one. It is reported as a warning for that reason.
 *
 * `params` and `searchParams` are probed separately and deliberately. A single
 * `\bparams\s*\.` can never match `searchParams.`, because the character before
 * `params` there is a word character and the boundary does not exist, so one
 * pattern covering "both" silently covered one. `searchParams` is also the more
 * common mistake of the two, since it is the one people destructure late.
 */
const REQUEST_OBJECTS = ['params', 'searchParams'] as const
function checkAsyncApis(ctx: DoctorContext): void {
  const files = [
    'app/blog/page.tsx',
    'app/blog/[slug]/page.tsx',
    'app/blog/category/[slug]/page.tsx',
    'app/blog/tag/[slug]/page.tsx',
    'app/authors/[slug]/page.tsx',
  ]

  let checked = 0
  const offenders: string[] = []

  for (const relativePath of files) {
    const source = resolvedSource(ctx, relativePath)
    if (source === null) continue
    checked += 1
    const label = appPathLabel(ctx.project, relativePath)
    const sourceFile = parse(label, source)

    for (const node of sourceFile.getDescendants()) {
      if (!Node.isCallExpression(node)) continue
      const callee = node.getExpression().getText()
      if (callee !== 'cookies' && callee !== 'headers' && callee !== 'draftMode') continue
      if (!Node.isAwaitExpression(node.getParent())) offenders.push(`${label}: ${callee}()`)
    }

    const stripped = stripComments(source)
    for (const object of REQUEST_OBJECTS) {
      // The boundary before `searchParams` is the whole point: without the
      // explicit alternation, `\bparams` cannot match inside `searchParams`.
      const read = new RegExp(`(?<![\\w$])${object}\\s*\\.`)
      // Either `await props.searchParams`, or the destructured form where the
      // await is on the props object and the name comes out of the pattern.
      const awaited = new RegExp(
        `await\\s+(?:[\\w$]+\\.)*${object}\\b|\\{[^}]*\\b${object}\\b[^}]*\\}\\s*=\\s*await\\b`,
      )
      if (read.test(stripped) && !awaited.test(stripped)) {
        offenders.push(`${label}: ${object} read without await`)
      }
    }
  }

  if (checked === 0) {
    ctx.reporter.skip('22 async request APIs', 'no blog routes are installed yet')
    return
  }
  if (offenders.length > 0) {
    ctx.reporter.fail('22 async request APIs', {
      id: 'sync-request-apis',
      severity: 'warning',
      message: `Synchronous access to request APIs, removed in Next.js 16: ${offenders.join('; ')}.`,
      remedy:
        "Await them. For route params, run npx next typegen and type the props as PageProps<'/blog/[slug]'>.",
    })
    return
  }
  ctx.reporter.pass('22 request APIs are awaited')
}

/**
 * Check 23. `priority` is deprecated in Next.js 16 in favour of `preload`, and
 * `preload` on more than one image per route defeats itself: preloading
 * everything prioritizes nothing.
 */
function checkImagePreload(ctx: DoctorContext): void {
  const routes = ['app/blog/page.tsx', 'app/blog/[slug]/page.tsx', 'components/blog/post-card.tsx']

  let checked = 0
  const deprecated: string[] = []
  const overPreloaded: string[] = []

  for (const relativePath of routes) {
    const source = resolvedSource(ctx, relativePath)
    if (source === null) continue
    checked += 1
    const label = appPathLabel(ctx.project, relativePath)

    // JSX attributes, from the syntax tree. The block's own source explains the
    // preload rule in a comment, and counting the word rather than the prop
    // would report that comment as three preloaded images.
    const attributes = jsxAttributeNames(parse(label, source))
    if (attributes.filter((name) => name === 'priority').length > 0) deprecated.push(label)
    const preloads = attributes.filter((name) => name === 'preload').length
    if (preloads > 1) overPreloaded.push(`${label} (${preloads})`)
  }

  if (checked === 0) {
    ctx.reporter.skip('23 next/image preload', 'no image rendering routes are installed yet')
    return
  }
  if (deprecated.length > 0) {
    ctx.reporter.fail('23 next/image preload', {
      id: 'image-priority-deprecated',
      severity: 'warning',
      message: `next/image uses the deprecated \`priority\` prop in ${deprecated.join(', ')}.`,
      remedy: 'Replace priority with preload.',
    })
  }
  if (overPreloaded.length > 0) {
    ctx.reporter.fail('23 next/image preload', {
      id: 'image-preload-overused',
      severity: 'warning',
      message: `More than one preloaded image per route in ${overPreloaded.join(', ')}. Preloading everything prioritizes nothing.`,
      remedy: 'Keep preload on the one image that is definitively the LCP element.',
    })
  }
  if (deprecated.length === 0 && overPreloaded.length === 0) {
    ctx.reporter.pass('23 next/image uses preload, at most once per route')
  }
}
