#!/usr/bin/env node
/**
 * Assert a patched `next.config.*` keeps every bot it is supposed to keep.
 *
 * ===========================================================================
 * THE FAILURE MODE THIS CATCHES, AND WHY IT IS THE WORST ONE WE HAVE
 * ===========================================================================
 * Setting `htmlLimitedBots` in `next.config.ts` REPLACES the Next.js default
 * list. It does not extend it. From the Next.js docs:
 *
 *   "Specifying a `htmlLimitedBots` config will override the Next.js' default
 *    list."
 *
 * So a patcher that writes only the AI crawlers produces a config that looks
 * like a win and is a loss: Googlebot, Bingbot, Applebot, Twitterbot,
 * LinkedInBot, Slackbot, Discordbot, facebookexternalhit, and WhatsApp all lose
 * blocking metadata and start receiving `<title>` and `<meta>` inside `<body>`
 * on any page with streamed metadata. Social previews go blank. Search snippets
 * degrade. `agentblog doctor` then reports the config as fixed, because GPTBot
 * is present and GPTBot is what a naive check looks for.
 *
 * A snapshot test on the AI bots alone passes while exactly that happens. That
 * is why this script asserts a SUPERSET of the union, and why it grades the two
 * halves of the union differently:
 *
 *   MISSING DEFAULT BRANCH  is a REGRESSION. Traffic that worked before the
 *                           patch does not work after it. We caused it.
 *   MISSING AI BRANCH       is a MISSED OPPORTUNITY. Nothing that worked
 *                           stopped working. We just did not add the win.
 *
 * Reporting both as "problem" would bury the one that is actively costing the
 * user traffic, which is the same reasoning behind the error/warning split in
 * `packages/checks/src/core.ts`.
 *
 * Usage:
 *   node scripts/assert-htmlbots-superset.mjs [path/to/next.config.ts]
 *
 * Exit codes:
 *   0  the configured pattern is a superset of Next defaults union AI crawlers
 *   1  AI crawler branches missing only (missed opportunity)
 *   2  default-list branches missing, or the key is absent (active regression)
 *
 * @see https://agentblog.dev/docs/blog-block
 * @see packages/checks/src/core.ts
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CHECKS_SOURCE = join(ROOT, 'packages/checks/src/core.ts')

const DEFAULT_TARGET = 'apps/fixture-next16/next.config.ts'
const target = resolve(ROOT, process.argv[2] ?? DEFAULT_TARGET)

/* -------------------------------------------------------------------------- */
/*  Reading the expectations out of packages/checks                            */
/* -------------------------------------------------------------------------- */

/**
 * Read the required branches from `packages/checks/src/core.ts` as text.
 *
 * Deliberately not an import: this script must run before anything is built, and
 * the whole point is to compare against the same literals the shipped code uses
 * rather than against a second copy that can drift from them.
 */
function readExpectations() {
  const source = readFileSync(CHECKS_SOURCE, 'utf8')

  const defaultsMatch = /NEXT_DEFAULT_HTML_LIMITED_BOTS\s*=\s*\n?\s*'([^']*)'/.exec(source)
  if (!defaultsMatch?.[1]) {
    console.error(`Could not read NEXT_DEFAULT_HTML_LIMITED_BOTS from ${CHECKS_SOURCE}.`)
    process.exit(2)
  }
  const defaults = JSON.parse(`"${defaultsMatch[1]}"`)
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean)

  const aiCrawlers = [...source.matchAll(/\bua:\s*'([^']+)'/g)].map((m) => m[1])
  if (aiCrawlers.length === 0) {
    console.error(`Could not read any AI_CRAWLERS entries from ${CHECKS_SOURCE}.`)
    process.exit(2)
  }

  return { defaults, aiCrawlers }
}

/* -------------------------------------------------------------------------- */
/*  Reading the pattern out of the config                                      */
/* -------------------------------------------------------------------------- */

/**
 * Strip line and block comments so a commented-out example does not read as a
 * live setting. Mirrors `stripComments` in packages/checks/src/core.ts, copied
 * rather than imported because that file is TypeScript and this script has no
 * build step.
 */
function stripComments(source) {
  let out = ''
  let i = 0
  let inString = null

  while (i < source.length) {
    const ch = source[i]
    const next = source[i + 1]

    if (inString) {
      if (ch === '\\') {
        out += ch + (next ?? '')
        i += 2
        continue
      }
      if (ch === inString) inString = null
      out += ch
      i += 1
      continue
    }

    if (ch === '"' || ch === "'" || ch === '`') {
      inString = ch
      out += ch
      i += 1
      continue
    }

    if (ch === '/' && next === '/') {
      while (i < source.length && source[i] !== '\n') i += 1
      continue
    }

    if (ch === '/' && next === '*') {
      i += 2
      while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) i += 1
      i += 2
      continue
    }

    out += ch
    i += 1
  }

  return out
}

function missing(pattern, required) {
  const present = new Set(
    pattern
      .split('|')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  )
  // Exact per-branch matching on purpose. A pattern that happens to match GPTBot
  // through some broader expression still counts as missing the branch, because
  // two regexes cannot be proved equivalent and a false pass here is the entire
  // failure this script exists to prevent.
  return required.filter((r) => !present.has(r.toLowerCase()))
}

/* -------------------------------------------------------------------------- */

function main() {
  if (!existsSync(target)) {
    console.error(`assert-htmlbots-superset: FAIL\n`)
    console.error(`  No config at ${target}`)
    console.error(`  Pass a path, or run this after the install step that creates one.`)
    process.exit(2)
  }

  const { defaults, aiCrawlers } = readExpectations()
  const source = readFileSync(target, 'utf8')
  const stripped = stripComments(source)
  const match = /htmlLimitedBots\s*:\s*\/((?:[^/\\\n]|\\.)+)\/([gimsuy]*)/.exec(stripped)

  console.log('assert-htmlbots-superset')
  console.log(`  config:   ${target}`)
  console.log(
    `  required: ${defaults.length} Next default branches, ${aiCrawlers.length} AI branches`,
  )

  if (!match?.[1]) {
    console.error('\nassert-htmlbots-superset: FAIL (severity: regression)\n')
    console.error('  `htmlLimitedBots` is not set at all, or is not a RegExp literal.')
    console.error('')
    console.error('  Next.js 16 requires a RegExp here. The config schema is')
    console.error('  z.instanceof(RegExp), so a string fails config validation outright.')
    console.error('')
    console.error('  If a patcher just ran, it did not write what it claimed to write.')
    console.error('  Fix: npx agentblog@latest doctor --fix')
    process.exit(2)
  }

  const pattern = match[1]
  const flags = match[2] ?? ''

  /*
   * Parse it before comparing branches.
   *
   * Branch presence is a text comparison, so a pattern can contain every branch
   * this script requires and still be a syntax error that Node refuses to
   * compile: an unbalanced group, a lone bracket, a bad escape under `u`. That
   * config does not fail at build with a message about bots, it fails at module
   * evaluation with a regex error, and the highest-severity gate in the
   * repository would have green-lit it. Compile first, compare second.
   */
  try {
    new RegExp(pattern, flags)
  } catch (error) {
    console.error('\nassert-htmlbots-superset: FAIL (severity: regression)\n')
    console.error('  The configured `htmlLimitedBots` pattern is not a valid regular expression.')
    console.error(`  ${error instanceof Error ? error.message : String(error)}`)
    console.error('')
    console.error(`  /${pattern}/${flags}`)
    console.error('')
    console.error('  Next.js evaluates next.config before anything else, so this does not')
    console.error('  degrade a feature, it stops the application from starting. If a patcher')
    console.error('  produced this, it corrupted a pattern it was supposed to widen, most')
    console.error('  likely by splitting an alternation that contained a group or a')
    console.error('  character class.')
    process.exit(2)
  }

  const missingDefaults = missing(pattern, defaults)
  const missingAi = missing(pattern, aiCrawlers)
  const caseInsensitive = flags.includes('i')

  if (missingDefaults.length === 0 && missingAi.length === 0 && caseInsensitive) {
    console.log(`  found:    ${pattern.split('|').length} branches, flags /${flags}`)
    console.log('  superset of Next defaults union AI crawlers. OK')
    return
  }

  let severity = 1

  if (missingDefaults.length > 0 || !caseInsensitive) {
    severity = 2
    console.error('\nassert-htmlbots-superset: FAIL (severity: REGRESSION)\n')

    if (missingDefaults.length > 0) {
      console.error(`  The configured pattern drops ${missingDefaults.length} branch(es) from the`)
      console.error('  Next.js default list:')
      for (const b of missingDefaults) console.error(`    - ${b}`)
      console.error('')
      console.error('  This config OVERRIDES the default list rather than extending it, so')
      console.error('  those user agents have lost HTML-limited treatment. Googlebot and every')
      console.error('  social preview bot in that list now receive `<title>` and `<meta>`')
      console.error('  inside `<body>` on any page with streamed metadata. This is traffic')
      console.error('  that worked before the patch and does not work after it.')
      console.error('')
    }

    if (!caseInsensitive) {
      console.error(`  The pattern has flags /${flags} and is missing the \`i\` flag.`)
      console.error('  Next.js matches its own list case-insensitively, and branches such as')
      console.error('  `applebot` and `baiduspider` are lowercase in the list but capitalized')
      console.error('  in the real user agent string. Without /i they match nothing.')
      console.error('')
    }
  }

  if (missingAi.length > 0) {
    const heading =
      severity === 2
        ? '  Additionally, missing AI crawler branch(es) (severity: missed opportunity):'
        : '\nassert-htmlbots-superset: FAIL (severity: missed opportunity)\n'
    console.error(heading)
    for (const b of missingAi) console.error(`    - ${b}`)
    console.error('')
    console.error('  Nothing that worked has stopped working. These crawlers simply do not')
    console.error('  get blocking metadata yet, so a streamed page may hand them a `<body>`')
    console.error('  with the title in it. Lower priority than a dropped default branch, and')
    console.error('  still worth fixing.')
    console.error('')
  }

  console.error('  Fix: npx agentblog@latest doctor --fix')
  console.error('  It unions your pattern with the Next.js default list instead of')
  console.error('  replacing it, and running it twice is a no-op.')
  console.error('')
  console.error(`  Current pattern:\n    ${pattern}`)
  process.exit(severity)
}

main()
