/**
 * Route structure, theme conformance, and the server boundary.
 *
 * Doctor checks 24, 28, and 30. What they share is that each one is about a
 * boundary the installed block sits inside rather than about the block's own
 * logic: the App Router's rules, the user's design system, and the line between
 * server and client code.
 *
 * Check 28 is a warning rather than an error on purpose. The user may have
 * edited the components deliberately, and telling somebody their own edit is a
 * failure is how a check gets disabled.
 *
 * @see https://docs.agentblog.dev/guides/match-your-design
 */
import { basename } from 'node:path'

import { appPath, appPathLabel } from '../detect/project.ts'
import { exists, readFile, toPosixRelative, walk } from '../util/fs.ts'
import type { DoctorContext } from './context.ts'

export function runBoundaryChecks(ctx: DoctorContext): void {
  checkParallelRouteDefaults(ctx)
  checkThemeConformance(ctx)
  checkServerOnly(ctx)
}

/** Check 24. A parallel route slot without `default.tsx` fails the build. */
function checkParallelRouteDefaults(ctx: DoctorContext): void {
  ctx.reporter.group('Route structure')

  const appDir = appPath(ctx.project, 'app')
  if (!exists(appDir)) {
    ctx.reporter.skip('24 parallel route defaults', 'no app directory found')
    return
  }

  const slots = walk(appDir, { extensions: ['.tsx', '.ts', '.jsx', '.js'] })
    .map((path) => toPosixRelative(ctx.project.root, path))
    .flatMap((path) => {
      const segments = path.split('/')
      const slotIndex = segments.findIndex((segment) => segment.startsWith('@'))
      return slotIndex === -1 ? [] : [segments.slice(0, slotIndex + 1).join('/')]
    })

  const missing = [...new Set(slots)].filter(
    (slot) =>
      !['default.tsx', 'default.jsx', 'default.js'].some((name) =>
        exists(appPath(ctx.project, `${slot.replace(/^src\//, '')}/${name}`)),
      ),
  )

  if (missing.length > 0) {
    ctx.reporter.fail('24 parallel route defaults', {
      id: 'parallel-slot-no-default',
      severity: 'error',
      message: `Parallel route slots without a default file: ${missing.join(', ')}. Next.js 16 fails the build without one.`,
      remedy: 'Add default.tsx to each slot, returning null if there is nothing to render.',
    })
    return
  }
  ctx.reporter.pass('24 every parallel route slot has a default file')
}

/* -------------------------------------------------------------------------- */
/*  Check 28's rule table, kept in the same shape as the CI script             */
/* -------------------------------------------------------------------------- */

/**
 * The colour rules, deliberately identical in shape and coverage to `RULES` in
 * `scripts/assert-theme-conformance.mjs`.
 *
 * ===========================================================================
 * WHY THESE TWO IMPLEMENTATIONS HAVE TO AGREE
 * ===========================================================================
 * The script grades what we ship; this check grades what landed in the user's
 * repository. They are the same rule read at two moments, so when they disagree
 * the user watches a tool contradict its own CI: a component we published
 * clean fails `doctor`, or one `doctor` calls clean was never allowed to ship.
 * Either way the check is the thing that stops being trusted.
 *
 * The CLI side previously covered fewer palettes, missed `bg-white` and
 * `text-black` entirely, scanned only `.tsx`, and gated hex matches on a
 * colour-ish word appearing on the same line. So keep the table below in step
 * with the script when either changes.
 *
 * Two things the CLI does that the script does not, both because it is reading
 * a user's edited files rather than ours: comments are blanked, and `href="#..."`
 * is blanked before the hex scan. A `#abcdef` in `href` is a fragment, not a
 * colour, and warning about a link anchor is how a warning gets ignored.
 */
const PALETTE =
  'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose'

const COLOUR_UTILITIES =
  'text|bg|border|ring|from|to|via|fill|stroke|decoration|outline|shadow|accent|caret|divide|placeholder'

const THEME_RULES: readonly { readonly id: string; readonly pattern: RegExp }[] = [
  {
    id: 'a palette utility',
    pattern: new RegExp(`\\b(?:${COLOUR_UTILITIES})-(?:${PALETTE})-\\d{2,3}\\b`),
  },
  {
    // `bg-white` and `text-black` carry no numeric scale, so the palette rule
    // cannot see them, and they are exactly as hardcoded as `bg-zinc-50`.
    id: 'a hardcoded colour keyword',
    pattern: new RegExp(`\\b(?:${COLOUR_UTILITIES})-(?:white|black)\\b`),
  },
  {
    id: 'a dark: colour variant',
    pattern: new RegExp(`\\bdark:(?:[a-z-]+:)*(?:${COLOUR_UTILITIES})-`),
  },
  {
    id: 'a colour function literal',
    pattern: /\b(?:rgba?|hsla?|oklch|oklab|lab|lch|color-mix)\s*\(/,
  },
  { id: 'a hex colour literal', pattern: /#[0-9a-fA-F]{3,8}\b/ },
]

/**
 * `ImageResponse` renders in a Satori runtime with no CSS cascade, so it cannot
 * read a custom property: `var(--card)` there resolves to nothing and the image
 * comes out transparent. Same exemption list as the CI script.
 *
 * `og-card.tsx` holds the card body both `opengraph-image.tsx` routes render, so
 * it renders through Satori too. The exemption follows the runtime rather than
 * the route naming convention.
 */
const COLOUR_EXEMPT_BASENAMES = new Set(['opengraph-image.tsx', 'twitter-image.tsx', 'og-card.tsx'])

/** Blank comments and link fragments, keeping every offset. */
function blankNonColourText(source: string): string {
  const withoutBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, ' '))
  return withoutBlocks
    .split('\n')
    .map((line) => (/^\s*\/\//.test(line) ? ' '.repeat(line.length) : line))
    .join('\n')
    .replace(/href\s*=\s*["'{]?\s*#[\w-]*/g, (match) => ' '.repeat(match.length))
}

/**
 * Check 28. The block inherits the user's theme, so a palette utility or a
 * colour literal inside it is a bug in what we shipped. Reported as a warning:
 * the user may have edited the components deliberately, and telling them their
 * own edit is an error would be wrong.
 */
function checkThemeConformance(ctx: DoctorContext): void {
  ctx.reporter.group('Theme')

  // `.mdx` as well as `.tsx`, matching the script. A `className` written into
  // MDX renders exactly the same way a component's does.
  const extensions = ['.tsx', '.ts', '.jsx', '.js', '.mdx']
  const files = [
    ...walk(appPath(ctx.project, 'components/blog'), { extensions }),
    ...walk(appPath(ctx.project, 'components/mdx'), { extensions }),
  ]
  if (files.length === 0) {
    ctx.reporter.skip('28 theme conformance', 'no blog components are installed yet')
    checkProseBridge(ctx)
    return
  }

  const offenders: string[] = []
  for (const path of files) {
    if (COLOUR_EXEMPT_BASENAMES.has(basename(path))) continue
    const source = readFile(path)
    if (source === null) continue
    const code = blankNonColourText(source)
    for (const rule of THEME_RULES) {
      if (!rule.pattern.test(code)) continue
      offenders.push(`${toPosixRelative(ctx.project.root, path)} has ${rule.id}`)
    }
  }

  if (offenders.length > 0) {
    ctx.reporter.fail('28 theme conformance', {
      id: 'theme-non-conformant',
      severity: 'warning',
      message: `The blog components should use shadcn tokens only: ${offenders.slice(0, 5).join('; ')}${offenders.length > 5 ? `, and ${offenders.length - 5} more` : ''}.`,
      remedy:
        'Use bg-background, text-foreground, text-muted-foreground, and the rest of the token set. Tokens already flip under .dark.',
    })
  } else {
    ctx.reporter.pass('28 the blog components use theme tokens only')
  }

  checkProseBridge(ctx)
}

/**
 * Check 28, second half: the prose bridge maps to tokens, not to colours.
 *
 * `styles/agentblog.css` exists to point every `--tw-prose-*` variable at a
 * shadcn semantic token, so an article inherits the user's theme and flips under
 * `.dark` for free. A literal colour on any of those variables pins the article
 * body to one palette, and the failure is invisible in light mode: the article
 * looks right until somebody switches themes and the body text stays dark on
 * dark. A plain text scan over one installed file is enough to prove it.
 */
function checkProseBridge(ctx: DoctorContext): void {
  const candidates = ['styles/agentblog.css', 'app/agentblog.css', 'src/styles/agentblog.css']
  const found = candidates
    .map((relativePath) => ({ relativePath, source: readFile(appPath(ctx.project, relativePath)) }))
    .find((entry) => entry.source !== null)

  if (!found?.source) {
    ctx.reporter.skip('28 prose bridge tokens', 'styles/agentblog.css is not installed')
    return
  }

  const literals = [...found.source.matchAll(/--tw-prose-[\w-]+\s*:\s*([^;]+);/g)]
    .filter(([, value]) => /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(|\boklch\(/.test(value ?? ''))
    .map(([whole]) => whole.trim())

  if (literals.length > 0) {
    ctx.reporter.fail('28 prose bridge tokens', {
      id: 'prose-bridge-colour-literal',
      severity: 'warning',
      message: `${found.relativePath} sets ${literals.length} --tw-prose-* variable(s) to a colour literal rather than a token: ${literals.slice(0, 3).join(' ')}. The article body then ignores the theme and does not flip under .dark.`,
      remedy: 'Point each one at a token, for example --tw-prose-body: var(--foreground).',
    })
    return
  }
  ctx.reporter.pass(`28 ${found.relativePath} maps every --tw-prose-* variable to a token`)
}

/**
 * Check 30, the part that can be proven without bundle analysis: the modules
 * that pull in zod carry `import 'server-only'`, and no client component imports
 * `lib/config`. Whether zod ends up in a client chunk needs a real build, so
 * that half is reported as skipped.
 */
function checkServerOnly(ctx: DoctorContext): void {
  ctx.reporter.group('Server boundary')

  const guarded = ['lib/schemas.ts', 'lib/config.ts', 'lib/posts.ts', 'lib/define-config.ts']
  const missing: string[] = []
  let checked = 0

  for (const relativePath of guarded) {
    const source = readFile(appPath(ctx.project, relativePath))
    if (source === null) continue
    checked += 1
    if (!/import\s+['"]server-only['"]/.test(source))
      missing.push(appPathLabel(ctx.project, relativePath))
  }

  if (checked === 0) {
    ctx.reporter.skip(
      '30 zod stays out of client chunks',
      'the block libraries are not installed yet',
    )
    return
  }

  if (missing.length > 0) {
    ctx.reporter.fail('30 zod stays out of client chunks', {
      id: 'server-only-missing',
      severity: 'warning',
      message: `${missing.join(', ')} does not import 'server-only', so a client component can import it and pull zod into the browser bundle.`,
      remedy: "Add import 'server-only' at the top of the file.",
    })
  } else {
    ctx.reporter.pass("30 the config and schema modules import 'server-only'")
  }

  const clientImporters = walk(appPath(ctx.project, 'components'), { extensions: ['.tsx'] }).filter(
    (path) => {
      const source = readFile(path)
      return (
        source !== null &&
        /^\s*['"]use client['"]/m.test(source) &&
        /from\s+['"]@\/lib\/config['"]/.test(source)
      )
    },
  )
  if (clientImporters.length > 0) {
    ctx.reporter.fail('30 zod stays out of client chunks', {
      id: 'client-imports-config',
      severity: 'error',
      message: `Client components import @/lib/config: ${clientImporters
        .map((path) => toPosixRelative(ctx.project.root, path))
        .join(', ')}. That drags zod and the whole config into the browser bundle.`,
      remedy: 'Pass the values you need down as props from a server component.',
    })
  }

  ctx.reporter.skip(
    '30 zod absent from every client chunk',
    'proving this needs bundle analysis over a production build, which doctor does not run',
  )
}
