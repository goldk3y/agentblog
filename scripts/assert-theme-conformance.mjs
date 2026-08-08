#!/usr/bin/env node
/**
 * Assert the shipped block inherits the host app's design system.
 *
 * ===========================================================================
 * THE FAILURE MODE THIS CATCHES
 * ===========================================================================
 * A blog bolted onto someone's product has to look like their product. If
 * `/blog` arrives with its own greys, its own radii, and its own idea of what
 * "muted" means, the user's first task after installing is undoing our design,
 * and most people uninstall instead of restyling.
 *
 * The mechanism that makes inheritance work is boring and total: the block uses
 * shadcn's semantic tokens and never a literal colour. `bg-card` resolves to
 * whatever the consumer's `--card` is. `bg-zinc-900` resolves to zinc, in an app
 * whose brand is not zinc.
 *
 * Three things break it, and all three look harmless in review:
 *
 *   1. A palette utility (`text-zinc-500`). Renders fine in our fixture, which
 *      uses the default neutral base, and fine in the screenshot, and wrong in
 *      the one app that matters.
 *   2. A colour literal (`#0a0a0a`, `oklch(...)`, `rgb(...)`). Same, minus the
 *      excuse.
 *   3. A `dark:` colour variant. This is the one that catches careful people.
 *      Tokens already flip under `.dark`, so `dark:text-white` re-hardcodes the
 *      exact thing the token abstracts, and it breaks the moment a consumer's
 *      dark theme is not near black. A component that needs a `dark:` colour is
 *      a component that picked the wrong token.
 *
 * Plus one version trap, which is why the CSS half of this check exists:
 * shadcn's Tailwind v3 era stored colours as bare HSL channel triplets, so the
 * idiom was `hsl(var(--foreground))`. Tailwind v4 shadcn stores complete
 * `oklch()` values, so the correct form is `var(--foreground)` with no wrapper.
 * Most blog posts and answers online still show the v3 form. It fails silently:
 * `hsl(oklch(0.145 0 0))` is not a colour, so the property is dropped and the
 * element inherits whatever its parent had. It renders. It looks almost right.
 * Nothing errors.
 *
 * Usage:
 *   node scripts/assert-theme-conformance.mjs [registry/blog dir]
 *
 * @see https://docs.agentblog.dev/guides/match-your-design, rules 2 and 5
 * @see CONTRIBUTING.md, "The shipped block styles with semantic tokens only"
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { basename, dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const blockDir = resolve(ROOT, process.argv[2] ?? 'apps/web/registry/blog')
const PROSE_CSS = join(blockDir, 'styles/agentblog.css')

const EXTENSIONS = ['.tsx', '.ts', '.jsx', '.js', '.mdx', '.css']
const SKIP_DIRS = new Set(['node_modules', '.next', 'dist', '.turbo'])

/**
 * Files exempt from the colour rules, by basename.
 *
 * `ImageResponse` renders in a Satori runtime that has no CSS cascade and
 * therefore cannot read a CSS custom property. `var(--card)` there resolves to
 * nothing and the image comes out transparent or black. Generated imagery also
 * genuinely needs literal colours: gradients, overlays, and text contrast are
 * design decisions inside a PNG, not tokens a consumer will ever restyle.
 *
 * This is the only category of exemption. Keep it that way. If a second reason
 * appears, argue about it in review rather than adding a basename here.
 *
 * `og-card.tsx` is not a route file and is on the list anyway, because it is
 * where the two `opengraph-image.tsx` routes now keep the card body they used to
 * hold a copy of each. The exemption follows the Satori runtime, not the file
 * naming convention, so extracting the shared layout must not silently withdraw
 * it. Anything else that renders through `ImageResponse` needs the same entry.
 */
const COLOUR_EXEMPT_BASENAMES = new Set(['opengraph-image.tsx', 'twitter-image.tsx', 'og-card.tsx'])

/* ========================================================================== */
/*  Rules                                                                     */
/* ========================================================================== */

const PALETTE = [
  'slate',
  'gray',
  'zinc',
  'neutral',
  'stone',
  'red',
  'orange',
  'amber',
  'yellow',
  'lime',
  'green',
  'emerald',
  'teal',
  'cyan',
  'sky',
  'blue',
  'indigo',
  'violet',
  'purple',
  'fuchsia',
  'pink',
  'rose',
].join('|')

const COLOUR_UTILITIES = [
  'text',
  'bg',
  'border',
  'ring',
  'from',
  'to',
  'via',
  'fill',
  'stroke',
  'decoration',
  'outline',
  'shadow',
  'accent',
  'caret',
  'divide',
  'placeholder',
].join('|')

const RULES = [
  {
    id: 'palette-utility',
    pattern: new RegExp(`\\b(${COLOUR_UTILITIES})-(${PALETTE})-\\d{2,3}\\b`, 'g'),
    message:
      'Tailwind palette utility. Use a semantic token: bg-background, text-foreground, ' +
      'text-muted-foreground, bg-card, bg-muted, bg-primary, bg-secondary, bg-accent, ' +
      'text-destructive, border-border, ring-ring.',
  },
  {
    // `bg-white` and `text-black` carry no numeric scale, so the palette rule
    // above cannot see them, and they are exactly as hardcoded as `bg-zinc-50`.
    // A white card on a user's dark theme is the same bug by a different route.
    id: 'keyword-colour-utility',
    pattern: new RegExp(`\\b(${COLOUR_UTILITIES})-(white|black)\\b`, 'g'),
    message:
      'Hardcoded colour keyword. `bg-white` does not flip under `.dark`, so it breaks the ' +
      'moment a user has a dark theme. Use bg-background, bg-card, or text-foreground.',
  },
  {
    id: 'dark-colour-variant',
    pattern: new RegExp(`\\bdark:(?:[a-z-]+:)*(${COLOUR_UTILITIES})-`, 'g'),
    message:
      'a `dark:` colour variant. Tokens already flip under `.dark`, so this re-hardcodes ' +
      'what the token exists to abstract. Needing one means the wrong token was chosen.',
  },
  {
    id: 'colour-function',
    pattern: /\b(rgba?|hsla?|oklch|oklab|lab|lch|color-mix)\s*\(/g,
    message:
      'a colour function literal. Reference the consumer token instead: var(--foreground), ' +
      'var(--muted), var(--border).',
    colour: true,
  },
]

const HEX = /#[0-9a-fA-F]{3,8}\b/g
/** A hex only counts when it is being used as a colour, not as a fragment or an id. */
const HEX_CONTEXT = /className|class=|style|colou?r|fill|stroke|background/i

const findings = []

/* ========================================================================== */

function walk(dir, out) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue
      walk(full, out)
      continue
    }
    if (entry.isFile() && EXTENSIONS.some((ext) => entry.name.endsWith(ext))) out.push(full)
  }
  return out
}

function record(file, lineNumber, column, id, message, line) {
  findings.push({
    file: relative(ROOT, file).split(sep).join('/'),
    line: lineNumber,
    column,
    id,
    message,
    excerpt: line.trim().slice(0, 110),
  })
}

/**
 * Blank out comments while preserving every offset, so file:line:column stays
 * exact.
 *
 * Needed because the files most likely to describe a banned pattern are the
 * files that implement the correct one. `styles/agentblog.css` documents the
 * `hsl(var(--x))` version trap in a comment, and a checker that cannot tell an
 * explanation from a declaration punishes the person who wrote the explanation.
 */
function blankComments(source) {
  const withoutBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, ' '))
  // Whole-line `//` comments only. Anything mid-line risks eating a URL.
  return withoutBlocks
    .split('\n')
    .map((line) => (/^\s*\/\//.test(line) ? ' '.repeat(line.length) : line))
    .join('\n')
}

function scan(file) {
  const exempt = COLOUR_EXEMPT_BASENAMES.has(basename(file))
  const lines = blankComments(readFileSync(file, 'utf8')).split('\n')

  for (const [index, line] of lines.entries()) {
    for (const rule of RULES) {
      if (rule.colour && exempt) continue
      rule.pattern.lastIndex = 0
      let match
      while ((match = rule.pattern.exec(line)) !== null) {
        record(file, index + 1, match.index + 1, rule.id, rule.message, line)
      }
    }

    if (exempt) continue

    const isCss = file.endsWith('.css')
    // No context gate. A hex literal has no legitimate use anywhere in the
    // shipped block, including in a `const BRAND = '#ff0044'` that a component
    // later reads through a style prop, which is how the gate used to be walked
    // straight past. The OG image files are exempt as a whole file, above.
    //
    // One exclusion: a fragment link. `href="#faq"` is an anchor, and
    // `href="#abcdef"` is an anchor that happens to spell a hex colour. The CLI's
    // check 28 blanks these before matching, and two implementations of one rule
    // disagreeing in front of a user is worse than either being slightly loose.
    {
      // Blank fragment hrefs so an anchor cannot read as a colour, preserving
      // offsets so the reported column still points at the real text.
      const scannable = line.replace(
        /(href=\s*["'`])#[0-9a-zA-Z_-]*/g,
        (whole, prefix) => prefix + ' '.repeat(whole.length - prefix.length),
      )

      HEX.lastIndex = 0
      let match
      while ((match = HEX.exec(scannable)) !== null) {
        record(
          file,
          index + 1,
          match.index + 1,
          'hex-literal',
          `hex colour literal ${match[0]}. Reference a token instead.`,
          line,
        )
      }
    }
  }
}

/**
 * The `--tw-prose-*` bridge is the single place long-form styling binds to the
 * consumer's theme, so it gets its own check rather than relying on the generic
 * colour-function rule to catch `hsl(var(--x))`.
 */
function scanProseBridge() {
  if (!existsSync(PROSE_CSS)) {
    console.log(`  note: ${relative(ROOT, PROSE_CSS)} does not exist yet, prose bridge unchecked`)
    return
  }

  const lines = blankComments(readFileSync(PROSE_CSS, 'utf8')).split('\n')
  let bindings = 0

  for (const [index, line] of lines.entries()) {
    const match = /(--tw-prose-[\w-]+)\s*:\s*([^;]+);/.exec(line)
    if (!match) continue
    bindings += 1

    const [, name, valueRaw] = match
    const value = valueRaw.trim()

    if (/\b(hsla?|rgba?|oklch|oklab)\s*\(\s*var\(/.test(value)) {
      record(
        PROSE_CSS,
        index + 1,
        line.indexOf(value) + 1,
        'prose-v3-wrapper',
        `${name} wraps a token in a colour function. That is the Tailwind v3 idiom, where ` +
          'tokens held bare channel triplets. v4 shadcn tokens hold complete oklch() values, ' +
          `so the correct form is bare \`var(--token)\`. As written this produces an invalid ` +
          'colour, the declaration is dropped, and the text silently inherits.',
        line,
      )
      continue
    }

    if (!value.includes('var(')) {
      record(
        PROSE_CSS,
        index + 1,
        line.indexOf(value) + 1,
        'prose-hardcoded',
        `${name} is set to a literal rather than a token, so prose stops tracking the ` +
          "consumer's theme. Bind it to var(--foreground), var(--muted-foreground), " +
          'var(--border), or var(--primary).',
        line,
      )
    }
  }

  console.log(`  prose:   ${bindings} --tw-prose-* binding(s) checked`)
}

function main() {
  console.log('assert-theme-conformance')

  if (!existsSync(blockDir)) {
    console.log(`  ${relative(ROOT, blockDir)} does not exist yet. Nothing to check.`)
    return
  }

  const files = walk(blockDir, []).sort()
  console.log(`  scanned: ${files.length} file(s) under ${relative(ROOT, blockDir)}`)
  for (const file of files) scan(file)
  scanProseBridge()

  if (findings.length === 0) {
    console.log('  semantic tokens only, no colour literals, no dark: colour variants. OK')
    return
  }

  console.error(`\nassert-theme-conformance: FAIL (${findings.length} problem(s))\n`)
  for (const f of findings) {
    console.error(`  ${f.file}:${f.line}:${f.column}  [${f.id}]`)
    console.error(`      ${f.message}`)
    console.error(`      ${f.excerpt}`)
    console.error('')
  }
  console.error('  The block inherits the consumer design system and never imposes one.')
  console.error('  Permitted: bg-background, text-foreground, text-muted-foreground, bg-card,')
  console.error('  text-card-foreground, bg-muted, bg-primary, text-primary-foreground,')
  console.error('  bg-secondary, bg-accent, text-destructive, border-border, ring-ring, and')
  console.error('  the --radius derived rounded-* scale.')
  console.error('')
  console.error('  OG image files are exempt because ImageResponse cannot read CSS variables.')
  console.error(
    `  That list is COLOUR_EXEMPT_BASENAMES in ${relative(ROOT, fileURLToPath(import.meta.url))}.`,
  )
  process.exit(1)
}

main()
