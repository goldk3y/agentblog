#!/usr/bin/env node
/**
 * Assert AgentBlog's house copy style across everything we write or ship.
 *
 * ===========================================================================
 * THE FAILURE MODE THIS CATCHES
 * ===========================================================================
 * The em dash has become the single most recognizable tell of machine-written
 * prose. AgentBlog sells AI-assisted writing that gets read and cited, so
 * shipping copy that reads as machine-written undermines the product itself. The
 * seed posts are the format specification: an agent writing post number fifty
 * imitates them, so one em dash in a seed post is one em dash in every post that
 * install ever produces.
 *
 * Nothing else notices. It compiles, it lints, it renders, it validates against
 * every schema. A human reviewer catches it in the file they are reading and
 * misses it in the eleven they are not.
 *
 * The banned vocabulary is the same problem one notch quieter, so it reports as
 * a warning rather than an error: one "seamless" is a word choice, six of them
 * is a voice. The two phrase patterns are errors, because neither has an
 * innocent use.
 *
 * Exemptions are a constant at the top of this file, never an inline pragma. A
 * pragma is invisible from outside the file, so the exemption list stops being
 * reviewable the moment it becomes convenient.
 *
 * Usage:
 *   node scripts/assert-copy-style.mjs           errors fail, warnings print
 *   node scripts/assert-copy-style.mjs --strict  warnings fail too
 *
 * @see https://docs.agentblog.dev/guides/write-with-your-agent
 * @see CONTRIBUTING.md, "Never use an em dash"
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const STRICT = process.argv.includes('--strict')

/* ========================================================================== */
/*  What gets scanned                                                         */
/* ========================================================================== */

const TEXT_EXTENSIONS = ['.ts', '.tsx', '.js', '.mjs', '.md', '.mdx', '.json', '.css', '.txt']

/** Directory or file targets, with the extensions that matter for each. */
const TARGETS = [
  { path: 'apps/web/registry', extensions: ['.ts', '.tsx', '.md', '.mdx', '.json', '.css'] },
  { path: 'apps/web/content', extensions: TEXT_EXTENSIONS },
  // agentblog.dev itself. The landing page is the first prose anybody reads, so
  // exempting it while holding the docs site to the rule had it backwards.
  { path: 'apps/web/app', extensions: ['.ts', '.tsx', '.css'] },
  { path: 'apps/web/components', extensions: ['.ts', '.tsx'] },
  { path: 'apps/web/lib', extensions: ['.ts', '.tsx'] },
  // docs.agentblog.dev. Its prose is the product's voice, so it is held to the
  // same rules as the seed posts.
  { path: 'apps/docs/content', extensions: TEXT_EXTENSIONS },
  { path: 'apps/docs/app', extensions: ['.ts', '.tsx', '.css'] },
  { path: 'apps/docs/lib', extensions: ['.ts', '.tsx'] },
  { path: 'apps/docs/components', extensions: ['.ts', '.tsx'] },
  { path: 'README.md', extensions: TEXT_EXTENSIONS },
  { path: 'CONTRIBUTING.md', extensions: TEXT_EXTENSIONS },
  // One sentence, in a directory of several hundred registries, next to every
  // competitor a reader is comparing us against. Same rules as the seed posts.
  { path: 'shadcn-directory-entry.json', extensions: ['.json'] },
  { path: 'packages', extensions: TEXT_EXTENSIONS, only: `${sep}src${sep}` },
  { path: 'scripts', extensions: TEXT_EXTENSIONS },
  { path: '.claude-plugin', extensions: TEXT_EXTENSIONS },
]

const SKIP_DIRS = new Set(['node_modules', '.next', 'dist', '.turbo', 'coverage', '.git'])

/* ========================================================================== */
/*  The narrow, explicit exemption list                                       */
/* ========================================================================== */

/**
 * Files allowed to contain something this script bans, with the rule ids they
 * are allowed to contain.
 *
 * `path` is a repository-relative file or a prefix ending in `/`. `rules` is
 * either `'*'` or a list of rule ids, and per-rule is strongly preferred: a file
 * that has to quote a banned phrase almost never has to contain an em dash, and
 * a whole-file exemption stops checking both.
 *
 * Every entry needs a reason. Keep the list short. A growing exemption list is
 * the check being switched off one file at a time, which is harder to see than
 * deleting it.
 */
const EXEMPT = [
  {
    // Contains every banned character, word, and phrase as data. Exempting the
    // checker from its own check is the one case with no alternative.
    path: 'scripts/assert-copy-style.mjs',
    rules: '*',
  },
  {
    // Vendored third-party JSON Schemas, copied verbatim from ui.shadcn.com so
    // CI does not depend on the network. Editing them to satisfy our house style
    // would defeat the point of vendoring them.
    path: 'scripts/schemas/',
    rules: '*',
  },
  {
    // The agent skills are where the house style is written down, so they have
    // to quote the phrases and the vocabulary they forbid. The dash rules still
    // apply to them, which is the point of exempting by rule rather than by file:
    // these are shipped copy, and an em dash in a SKILL.md becomes an em dash in
    // every post written from it.
    path: 'apps/web/registry/agent/skills/',
    rules: ['fast-paced-world', 'not-just-x-its-y', 'word'],
  },
  {
    // Same reason: CONTRIBUTING.md states the rule for humans.
    path: 'CONTRIBUTING.md',
    rules: ['fast-paced-world', 'not-just-x-its-y', 'word'],
  },
  {
    // Third-party crawler JSON, refetched monthly by
    // .github/workflows/crawler-lists.yml. It is upstream data, not our copy.
    path: 'scripts/data/',
    rules: '*',
  },
  {
    // Vendored from the AI Elements registry by `shadcn add @ai-elements/*`.
    // Editing the prose in it would be overwritten by the next install, and
    // none of it is copy a reader of this site ever sees.
    path: 'apps/web/components/ai-elements/',
    rules: '*',
  },
  {
    // The CLI-side twin of this script: `agentblog audit` applies the same rules
    // to a user's posts, so its rule table holds the characters as data.
    path: 'packages/cli/src/audit/copy-style.ts',
    rules: '*',
  },
  {
    // Documentation pages that state the rule have to quote it.
    path: 'apps/docs/content/docs/guides/write-with-your-agent.mdx',
    rules: ['fast-paced-world', 'not-just-x-its-y', 'word'],
  },
]

/* ========================================================================== */
/*  The rules                                                                 */
/* ========================================================================== */

// Built from code points rather than written literally, so this file does not
// contain the characters it is looking for even once.
const EM_DASH = String.fromCodePoint(0x2014)
const EN_DASH = String.fromCodePoint(0x2013)

// Built from parts rather than written literally, so this file does not contain
// the sequence it is looking for. Belt and braces: the file is exempt anyway,
// and an exemption that is never exercised is one less thing to reason about.
const DOUBLE_HYPHEN = new RegExp(`(^|\\s)${'-'.repeat(2)}(\\s|$)`, 'g')

/** Tool directives whose own syntax needs a double hyphen. Not prose. */
const LINTER_DIRECTIVE =
  /\b(eslint-disable|eslint-enable|ts-expect-error|prettier-ignore|biome-ignore|c8 ignore|v8 ignore)\b/

const RULES = [
  {
    id: 'em-dash',
    severity: 'error',
    pattern: new RegExp(EM_DASH, 'g'),
    message: `em dash (U+2014). Use a comma, a colon, parentheses, or a full stop.`,
  },
  {
    id: 'en-dash-as-dash',
    severity: 'error',
    pattern: new RegExp(`\\s${EN_DASH}\\s`, 'g'),
    message:
      `en dash (U+2013) used as a dash. It is the em dash with extra steps. ` +
      `An en dash between numbers (2020${EN_DASH}2026) is fine and is not flagged.`,
  },
  {
    id: 'double-hyphen',
    severity: 'error',
    pattern: DOUBLE_HYPHEN,
    message: 'a double hyphen used as a dash. Same rule, same fix.',
  },
  {
    id: 'fast-paced-world',
    severity: 'error',
    pattern: /in today['’]s fast[- ]paced world/gi,
    message: 'a stock opener that says nothing. Open with the specific claim instead.',
  },
  {
    id: 'not-just-x-its-y',
    severity: 'error',
    // "it's not just a blog, it's a growth engine" and its variants.
    pattern: /\bit['’]?s not just\b[^.!?\n]{0,80}?,\s*it['’]?s\b/gi,
    message:
      'the "it is not just X, it is Y" construction. State what the thing is once, ' +
      'without the false contrast.',
  },
]

/**
 * Vocabulary that reads as machine-written. Warnings, not errors: any one of
 * these can be the right word, and all of them together never are.
 */
const BANNED_WORDS = ['delve', 'leverage', 'robust', 'seamless', 'landscape', 'tapestry']

const WORD_RULES = BANNED_WORDS.map((word) => ({
  id: `word-${word}`,
  severity: 'warning',
  pattern: new RegExp(`\\b${word}\\w*\\b`, 'gi'),
  message: `"${word}". Say the specific thing instead.`,
}))

/* ========================================================================== */

const findings = []

/**
 * Rule ids exempted for a path. A rules entry of `word` covers every banned
 * vocabulary rule, since they share a cause and are always quoted together.
 */
function exemptedRules(rel) {
  const normalized = rel.split(sep).join('/')
  const ids = new Set()
  let all = false

  for (const entry of EXEMPT) {
    const matches = entry.path.endsWith('/')
      ? normalized.startsWith(entry.path)
      : normalized === entry.path
    if (!matches) continue
    if (entry.rules === '*') {
      all = true
      continue
    }
    for (const id of entry.rules) ids.add(id)
  }

  return { all, ids }
}

function ruleIsExempt(exempt, ruleId) {
  if (exempt.all) return true
  if (exempt.ids.has(ruleId)) return true
  return ruleId.startsWith('word-') && exempt.ids.has('word')
}

function collect(target, out) {
  const abs = resolve(ROOT, target.path)
  if (!existsSync(abs)) return

  const stats = statSync(abs)
  if (stats.isFile()) {
    out.push(abs)
    return
  }

  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue
        walk(full)
        continue
      }
      if (!entry.isFile()) continue
      if (!target.extensions.some((ext) => entry.name.endsWith(ext))) continue
      if (target.only && !full.includes(target.only)) continue
      out.push(full)
    }
  }

  walk(abs)
}

function scan(file) {
  const rel = relative(ROOT, file).split(sep).join('/')
  const exempt = exemptedRules(rel)
  if (exempt.all) return

  let source
  try {
    source = readFileSync(file, 'utf8')
  } catch {
    return
  }

  const lines = source.split('\n')

  for (const rule of [...RULES, ...WORD_RULES]) {
    if (ruleIsExempt(exempt, rule.id)) continue
    for (const [index, line] of lines.entries()) {
      // A linter directive needs a double hyphen to separate the rule name from
      // the justification, so that ONE rule is skipped on that line. Every other
      // rule still applies: the justification after the hyphens is prose, and an
      // em dash there is exactly as much of a tell as an em dash anywhere else.
      // Skipping the whole line, which this used to do, meant any Markdown line
      // containing the literal text `prettier-ignore` was exempt from all of it.
      if (rule.id === 'double-hyphen' && LINTER_DIRECTIVE.test(line)) continue
      rule.pattern.lastIndex = 0
      let match
      while ((match = rule.pattern.exec(line)) !== null) {
        findings.push({
          file: rel,
          line: index + 1,
          column: match.index + 1,
          severity: rule.severity,
          id: rule.id,
          message: rule.message,
          excerpt: line.trim().slice(0, 110),
        })
        if (match[0].length === 0) rule.pattern.lastIndex += 1
      }
    }
  }
}

function main() {
  const files = []
  for (const target of TARGETS) collect(target, files)

  const unique = [...new Set(files)].sort()
  for (const file of unique) scan(file)

  const errors = findings.filter((f) => f.severity === 'error')
  const warnings = findings.filter((f) => f.severity === 'warning')

  console.log('assert-copy-style')
  console.log(`  scanned: ${unique.length} file(s) across ${TARGETS.length} target(s)`)

  if (unique.length === 0) {
    console.log('  nothing to scan yet. Every target directory is empty or absent.')
  }

  for (const f of warnings) {
    console.log(`  warning ${f.file}:${f.line}:${f.column}  ${f.message}`)
    console.log(`          ${f.excerpt}`)
  }

  if (errors.length > 0) {
    console.error(`\nassert-copy-style: FAIL (${errors.length} error(s))\n`)
    for (const f of errors) {
      console.error(`  ${f.file}:${f.line}:${f.column}  ${f.message}`)
      console.error(`      ${f.excerpt}`)
    }
    console.error('')
    console.error('  House rule, stated in CONTRIBUTING.md: no em dashes, anywhere.')
    console.error('  Do not fix these with a find and replace. Substituting commas blindly')
    console.error('  produces comma splices, which read worse than the dash did. Reread the')
    console.error('  sentence and repunctuate it.')
    console.error('')
    console.error('  A file that legitimately must contain these characters goes in the EXEMPT')
    console.error(`  constant at the top of ${relative(ROOT, fileURLToPath(import.meta.url))},`)
    console.error('  with a reason. There are no inline pragmas on purpose.')
    process.exit(1)
  }

  if (STRICT && warnings.length > 0) {
    console.error(`\nassert-copy-style: FAIL (${warnings.length} warning(s), --strict)\n`)
    process.exit(1)
  }

  console.log(
    warnings.length > 0 ? `  no errors, ${warnings.length} warning(s). OK` : '  clean. OK',
  )
}

main()
