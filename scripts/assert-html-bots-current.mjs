#!/usr/bin/env node
/**
 * Assert the vendored Next.js default bot list still matches the installed Next.js.
 *
 * ===========================================================================
 * THE FAILURE MODE THIS CATCHES
 * ===========================================================================
 * `packages/checks/src/core.ts` vendors Next.js's built-in `htmlLimitedBots`
 * pattern as `NEXT_DEFAULT_HTML_LIMITED_BOTS`. Everything downstream trusts that
 * copy: the CLI patcher unions against it, `agentblog doctor` reports a
 * "narrowed" pattern by diffing against it, and `lib/preflight.ts` warns from it
 * inside a consumer's repository.
 *
 * Next.js maintains the real list in
 * `packages/next/src/shared/lib/router/utils/html-bots.ts` and changes it
 * without notice, in a patch release, with no entry in the upgrade guide. The
 * day Next adds a bot, our vendored copy silently becomes a subset. Then
 * `doctor --fix` writes a config that drops the new bot from HTML-limited
 * treatment, `doctor` reports the result as correct, and nobody finds out until
 * a customer notices their previews broke.
 *
 * Nothing else in the pipeline can see this. It is not a type error, not a lint
 * error, not a test failure. It is two string literals in two repositories that
 * used to be equal.
 *
 * So: read the regex out of the installed `next` package and diff it, branch by
 * branch, against ours. A red build is how we find out.
 *
 * Usage:
 *   node scripts/assert-html-bots-current.mjs
 *
 * @see https://docs.agentblog.dev/reference/files
 * @see packages/checks/src/core.ts
 */
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** Where `next` might be installed, most specific first. */
const RESOLUTION_BASES = [
  join(ROOT, 'apps/web/package.json'),
  join(ROOT, 'apps/fixture-next16/package.json'),
  join(ROOT, 'package.json'),
]

const HTML_BOTS_SUBPATH = 'dist/shared/lib/router/utils/html-bots.js'
const VENDORED_SOURCE = join(ROOT, 'packages/checks/src/core.ts')

function fail(lines) {
  console.error('\nassert-html-bots-current: FAIL\n')
  for (const line of lines) console.error(line)
  console.error('')
  process.exit(1)
}

/** Resolve the installed `next` package directory, or null. */
function findNextPackageDir() {
  for (const base of RESOLUTION_BASES) {
    if (!existsSync(base)) continue
    try {
      const require = createRequire(base)
      return dirname(require.resolve('next/package.json'))
    } catch {
      // Try the next base.
    }
  }
  return null
}

/** The pattern source of `HTML_LIMITED_BOT_UA_RE`, as Next.js ships it. */
function readUpstreamPattern(nextDir) {
  const file = join(nextDir, HTML_BOTS_SUBPATH)
  if (!existsSync(file)) {
    fail([
      `Could not read the Next.js bot list at:`,
      `  ${file}`,
      '',
      'Next.js moved or renamed the file. That is itself the signal this script',
      'exists to surface: find the new location, update HTML_BOTS_SUBPATH here,',
      'and re-vendor the pattern into packages/checks/src/core.ts.',
    ])
  }

  const source = readFileSync(file, 'utf8')
  const match = /HTML_LIMITED_BOT_UA_RE\s*=\s*\/((?:[^/\\\n]|\\.)+)\/([gimsuy]*)/.exec(source)
  if (!match?.[1]) {
    fail([
      `Found ${file} but could not extract HTML_LIMITED_BOT_UA_RE from it.`,
      'The declaration shape changed. Read the file and update this script.',
    ])
  }
  return { pattern: match[1], flags: match[2] ?? '' }
}

/** The pattern we vendored, read as text so this script needs no TypeScript. */
function readVendoredPattern() {
  const source = readFileSync(VENDORED_SOURCE, 'utf8')

  const patternMatch = /NEXT_DEFAULT_HTML_LIMITED_BOTS\s*=\s*\n?\s*'([^']*)'/.exec(source)
  if (!patternMatch?.[1]) {
    fail([
      `Could not find NEXT_DEFAULT_HTML_LIMITED_BOTS in ${VENDORED_SOURCE}.`,
      'It must stay a single-quoted string literal so this script can read it',
      'without compiling TypeScript.',
    ])
  }

  // The literal escapes backslashes for TypeScript. Unescape it the same way the
  // TypeScript parser would. The pattern contains no double quote, which is what
  // makes JSON.parse a safe stand-in here.
  const raw = patternMatch[1]
  if (raw.includes('"')) {
    fail([
      'NEXT_DEFAULT_HTML_LIMITED_BOTS now contains a double quote, so this',
      "script's JSON.parse unescaping is no longer safe. Replace it with a",
      'real string-literal decoder.',
    ])
  }
  const pattern = JSON.parse(`"${raw}"`)

  const versionMatch = /NEXT_DEFAULT_HTML_LIMITED_BOTS_VERSION\s*=\s*'([^']*)'/.exec(source)
  return { pattern, version: versionMatch?.[1] ?? null }
}

const branches = (pattern) =>
  pattern
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean)

function main() {
  const nextDir = findNextPackageDir()
  if (!nextDir) {
    fail([
      'Could not resolve the `next` package from any of:',
      ...RESOLUTION_BASES.map((b) => `  ${b}`),
      '',
      'Run `pnpm install` first. This check is meaningless without a real',
      'Next.js installation to read.',
    ])
  }

  const installedVersion = JSON.parse(readFileSync(join(nextDir, 'package.json'), 'utf8')).version

  const upstream = readUpstreamPattern(nextDir)
  const vendored = readVendoredPattern()

  console.log('assert-html-bots-current')
  console.log(`  installed next:  ${installedVersion}`)
  console.log(`  vendored from:   ${vendored.version ?? 'unrecorded'}`)

  if (upstream.pattern === vendored.pattern) {
    if (vendored.version !== installedVersion) {
      console.log(
        `  note: the list is identical, but NEXT_DEFAULT_HTML_LIMITED_BOTS_VERSION says ` +
          `${vendored.version} while ${installedVersion} is installed. Update the constant.`,
      )
    }
    console.log(`  ${branches(upstream.pattern).length} branches, identical. OK`)
    return
  }

  const upstreamSet = new Set(branches(upstream.pattern).map((b) => b.toLowerCase()))
  const vendoredSet = new Set(branches(vendored.pattern).map((b) => b.toLowerCase()))

  const added = branches(upstream.pattern).filter((b) => !vendoredSet.has(b.toLowerCase()))
  const removed = branches(vendored.pattern).filter((b) => !upstreamSet.has(b.toLowerCase()))

  const lines = [
    `The vendored Next.js default bot list no longer matches next@${installedVersion}.`,
    '',
  ]

  if (added.length > 0) {
    lines.push(`  Next.js added ${added.length} branch(es) we do not have:`)
    for (const b of added) lines.push(`    + ${b}`)
    lines.push('')
    lines.push(
      '  Until this is fixed, every config AgentBlog writes drops these bots from',
      '  HTML-limited treatment, and `agentblog doctor` reports that result as correct.',
      '',
    )
  }

  if (removed.length > 0) {
    lines.push(`  We have ${removed.length} branch(es) Next.js no longer lists:`)
    for (const b of removed) lines.push(`    - ${b}`)
    lines.push('')
    lines.push(
      '  Harmless to a consumer (an extra alternation branch costs nothing), but it',
      '  means the vendored copy is stale and the next real change will be missed.',
      '',
    )
  }

  if (added.length === 0 && removed.length === 0) {
    lines.push(
      '  The branch sets are equal but the strings differ, so the ordering or the',
      '  whitespace changed. Re-vendor verbatim rather than reordering by hand: the',
      '  diff has to stay readable for the next person.',
      '',
    )
  }

  lines.push(
    'Fix:',
    `  1. Copy the pattern verbatim out of`,
    `     ${join(nextDir, HTML_BOTS_SUBPATH)}`,
    `  2. Paste it into NEXT_DEFAULT_HTML_LIMITED_BOTS in`,
    `     ${VENDORED_SOURCE}`,
    `     (escape each backslash: \\w becomes \\\\w inside the string literal)`,
    `  3. Set NEXT_DEFAULT_HTML_LIMITED_BOTS_VERSION to '${installedVersion}'`,
    `  4. Run \`pnpm codegen\` so the consumer copy of the file follows`,
    '',
    'Upstream:',
    `  ${upstream.pattern}`,
    'Vendored:',
    `  ${vendored.pattern}`,
  )

  fail(lines)
}

main()
