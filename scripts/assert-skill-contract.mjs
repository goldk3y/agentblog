#!/usr/bin/env node
/**
 * Assert every shipped agent skill satisfies the Agent Skills specification and
 * the extra rules this product needs on top of it.
 *
 * ===========================================================================
 * THE FAILURE MODE THIS CATCHES
 * ===========================================================================
 * A skill is prose. Prose compiles, lints, and renders no matter what it says.
 * Nothing in the toolchain notices when a skill tells an agent to run a command
 * that does not exist, points at a reference file nobody shipped, or uses a
 * frontmatter key that the agent reading it silently drops. The skill keeps
 * looking correct in the diff and fails only in the user's terminal.
 *
 * That already happened once. `agentblog-audit` told agents to run
 * `agentblog audit --schema --links --dates --capsules`. The audit command has
 * none of those flags and deliberately refuses to grow them, so the last step
 * of the pre-publish gate exited with a commander parse error every time
 * anybody reached it. Six months of that would have been invisible to us.
 *
 * The frontmatter rules are the second half. AgentBlog ships its skills three
 * ways: the shadcn registry, the Claude Code plugin, and `npx skills add`, which
 * installs into seventy-odd other agents. Claude Code accepts a wide superset of
 * frontmatter keys. The Agent Skills specification at https://agentskills.io
 * accepts six, and Anthropic's own packaging path hard errors rather than
 * ignoring the rest. A key outside the six is therefore a key that works on the
 * machine it was written on and nowhere else.
 *
 * Usage:
 *   node scripts/assert-skill-contract.mjs
 *
 * @see https://agentskills.io/specification
 * @see https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices
 */
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SKILLS_DIR = join(ROOT, 'apps/web/registry/agent/skills')
const CLI_ENTRY = join(ROOT, 'packages/cli/src/index.ts')

const rel = (p) => relative(ROOT, p)
const problems = []

/* ========================================================================== */
/*  The contract                                                              */
/* ========================================================================== */

/**
 * The six keys the Agent Skills specification defines. Everything else is a
 * vendor extension, and a vendor extension is a key some agent will drop.
 */
const SPEC_KEYS = new Set([
  'name',
  'description',
  'license',
  'compatibility',
  'metadata',
  'allowed-tools',
])

/**
 * Vendor keys we allow anyway, each with the reason it earns the portability
 * cost. Keep this list closed. Every entry is behaviour that exists only in
 * Claude Code, so every entry is behaviour the other agents will not have.
 */
const ALLOWED_EXTENSIONS = new Map([
  [
    'disable-model-invocation',
    'makes a skill user-invoked only, which keeps its description out of every ' +
      'turn and stops the agent firing a side-effecting workflow on its own',
  ],
  ['argument-hint', 'autocomplete hint for a skill that genuinely takes a positional argument'],
])

/**
 * Keys that are legal in Claude Code and banned here, with the reason.
 *
 * `when_to_use` is the interesting one. Claude Code appends it to `description`
 * and truncates the pair at 1,536 characters, so writing it separately buys
 * nothing there, and every other agent ignores it outright. Verified against the
 * skills CLI, which lists a skill by `description` alone: trigger phrases put in
 * `when_to_use` are invisible in the directory listing that is supposed to sell
 * the skill. Put the triggers in `description`.
 */
const BANNED_KEYS = new Map([
  [
    'when_to_use',
    'Claude Code concatenates it onto `description` and no other agent reads it. ' +
      'Fold the trigger phrases into `description`, which every agent reads.',
  ],
  [
    'paths',
    'restricts activation to matching files in Claude Code and is ignored elsewhere, ' +
      'so the skill would fire in different situations depending on the agent. ' +
      'Scope the skill in `description` instead.',
  ],
  ['model', 'pins a model the reader may not have access to. Let the session decide.'],
])

/** Anthropic's stated budget for a SKILL.md body. */
const MAX_BODY_LINES = 500

/** The specification's cap on `description`. */
const MAX_DESCRIPTION = 1024

/** Reference files past this length need a contents block, per Anthropic. */
const TOC_THRESHOLD = 100

/* ========================================================================== */
/*  A frontmatter parser small enough to trust                                */
/* ========================================================================== */

/**
 * Parse the subset of YAML our skills are allowed to use: top-level scalars,
 * folded scalars (`>` and `>-`), and a one-level `metadata:` map.
 *
 * Deliberately not a YAML library. The point is that a skill whose frontmatter
 * needs more than this is a skill whose frontmatter is too clever to survive
 * seventy agent implementations, so failing to parse it here is the correct
 * outcome rather than a limitation to work around.
 */
function parseFrontmatter(source, label) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!match) return { data: null, body: source, error: 'no YAML frontmatter block' }

  const lines = match[1].split(/\r?\n/)
  const data = {}
  let key = null
  let folded = null
  let nested = null

  for (const line of lines) {
    if (line.trim() === '' && folded === null) continue

    const indented = /^\s+\S/.test(line)

    if (folded !== null && (indented || line.trim() === '')) {
      folded.push(line.trim())
      continue
    }
    if (folded !== null) {
      data[key] = folded.join(' ').trim()
      folded = null
    }

    if (nested !== null && indented) {
      const pair = line.trim().match(/^([A-Za-z0-9_-]+):\s*(.*)$/)
      if (!pair) return { data: null, body: match[2], error: `unparsed metadata line: ${line}` }
      nested[pair[1]] = unquote(pair[2])
      continue
    }
    nested = null

    const pair = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/)
    if (!pair) {
      return {
        data: null,
        body: match[2],
        error:
          `unparsed frontmatter line in ${label}: ${JSON.stringify(line)}. ` +
          'Allowed shapes are `key: value`, `key: >` folded blocks, and a one-level `metadata:` map.',
      }
    }

    key = pair[1]
    const value = pair[2]

    if (value === '>' || value === '>-') {
      folded = []
    } else if (value === '') {
      nested = {}
      data[key] = nested
    } else {
      data[key] = unquote(value)
    }
  }

  if (folded !== null) data[key] = folded.join(' ').trim()

  return { data, body: match[2], error: null }
}

const unquote = (s) => s.replace(/^['"]|['"]$/g, '').trim()

/* ========================================================================== */
/*  What the CLI actually accepts                                             */
/* ========================================================================== */

/**
 * Read the commander definitions out of the CLI entry point.
 *
 * Reading the source rather than importing it is deliberate: `index.ts` calls
 * `program.parse()` at module scope, so importing it here would run the CLI.
 */
function readCliSurface() {
  const source = readFileSync(CLI_ENTRY, 'utf8')
  const commands = new Map()
  const globalOptions = new Set()

  // Commander is written as a fluent chain across many lines, and prettier puts
  // the flag string on its own line whenever the call is long. Scanning line by
  // line therefore misses exactly the options with the longest help text, which
  // are the interesting ones. Walk the whole source instead, keyed on the most
  // recent `.command(...)`.
  const tokens = [...source.matchAll(/\.(command|option|addOption|argument)\(\s*'([^']*)'/g)]
  let current = null

  for (const [, kind, value] of tokens) {
    if (kind === 'command') {
      current = value.split(/\s/)[0]
      commands.set(current, new Set())
      continue
    }
    if (kind !== 'option' && kind !== 'addOption') continue
    for (const flag of value.matchAll(/(--[a-z][a-z-]*)/g)) {
      if (current === null) globalOptions.add(flag[1])
      else commands.get(current).add(flag[1])
    }
  }

  // Commander supplies these for free on every command.
  for (const set of commands.values()) set.add('--help')
  globalOptions.add('--help')
  globalOptions.add('--version')

  return { commands, globalOptions }
}

/**
 * Every `agentblog <command> [--flags]` invocation written in a skill.
 *
 * Only code spans and fenced blocks are scanned. Prose that names a command in
 * passing is not an instruction to run it, and treating it as one would make the
 * check unusable on the skill that has to explain what the flags mean.
 */
function findCliInvocations(source) {
  const snippets = []

  let inFence = false
  for (const line of source.split(/\r?\n/)) {
    if (/^\s*(?:```|~~~)/.test(line)) {
      inFence = !inFence
      continue
    }
    if (inFence) snippets.push(line)
    else for (const span of line.matchAll(/`([^`]+)`/g)) snippets.push(span[1])
  }

  const invocations = []
  for (const snippet of snippets) {
    const match = snippet.match(/\bagentblog(?:@[a-z0-9.-]+)?\s+([a-z-]+)([^|&;]*)/)
    if (!match) continue
    invocations.push({
      command: match[1],
      flags: [...match[2].matchAll(/(--[a-z][a-z-]*)/g)].map((m) => m[1]),
      text: snippet.trim(),
    })
  }
  return invocations
}

/* ========================================================================== */
/*  Checks                                                                    */
/* ========================================================================== */

function checkSkill(dir, cli) {
  const name = dir
  const skillDir = join(SKILLS_DIR, dir)
  const skillMd = join(skillDir, 'SKILL.md')
  const label = rel(skillMd)

  if (!existsSync(skillMd)) {
    problems.push([
      `${rel(skillDir)} has no SKILL.md.`,
      'A skill directory without one is not a skill.',
    ])
    return
  }

  const source = readFileSync(skillMd, 'utf8')
  const { data, body, error } = parseFrontmatter(source, label)

  if (error !== null) {
    problems.push([`${label}: ${error}`])
    return
  }

  /* ---- frontmatter keys -------------------------------------------------- */

  for (const key of Object.keys(data)) {
    if (SPEC_KEYS.has(key) || ALLOWED_EXTENSIONS.has(key)) continue
    const banned = BANNED_KEYS.get(key)
    problems.push([
      `${label}: frontmatter key \`${key}\` is not allowed.`,
      banned ??
        'It is outside the six keys the Agent Skills spec defines and outside the short ' +
          'list of vendor extensions this repository accepts. Agents that follow the spec ' +
          'drop it, and Anthropic packaging rejects the file outright.',
    ])
  }

  /* ---- name -------------------------------------------------------------- */

  if (data.name === undefined) {
    problems.push([`${label}: no \`name\`.`, 'Required by the spec.'])
  } else {
    if (data.name !== name) {
      problems.push([
        `${label}: \`name\` is "${data.name}" but the directory is "${name}".`,
        'The spec requires them to match, and the skills CLI keys installs on the pair.',
      ])
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.name)) {
      problems.push([
        `${label}: \`name\` "${data.name}" is not lowercase alphanumeric with single hyphens.`,
      ])
    }
    if (data.name.length > 64) {
      problems.push([`${label}: \`name\` is ${data.name.length} characters. The cap is 64.`])
    }
    if (/anthropic|claude/i.test(data.name)) {
      problems.push([
        `${label}: \`name\` contains a reserved word.`,
        'Anthropic rejects "anthropic" and "claude" in a skill name.',
      ])
    }
  }

  /* ---- description ------------------------------------------------------- */

  const description = data.description ?? ''

  if (description === '') {
    problems.push([
      `${label}: no \`description\`.`,
      'It is the only thing an agent reads before deciding to load the skill.',
    ])
  } else {
    if (description.length > MAX_DESCRIPTION) {
      problems.push([
        `${label}: \`description\` is ${description.length} characters. The spec cap is ${MAX_DESCRIPTION}.`,
      ])
    }
    if (/^(?:I |I'|You can |You should |This skill lets you)/.test(description)) {
      problems.push([
        `${label}: \`description\` is written in first or second person.`,
        'It is injected into the system prompt, where a point-of-view shift costs discovery. ' +
          'Write it in the third person: "Writes...", "Runs...", not "I can help you...".',
      ])
    }
    if (!/\b[Uu]se (?:when|for|after|before)\b/.test(description)) {
      problems.push([
        `${label}: \`description\` never says when to use the skill.`,
        'A description states what the skill does AND when to reach for it. Include a ' +
          '"Use when ..." clause carrying the phrases a user would actually type.',
      ])
    }
  }

  /* ---- body budget ------------------------------------------------------- */

  const bodyLines = body.split(/\r?\n/).length
  if (bodyLines > MAX_BODY_LINES) {
    problems.push([
      `${label}: body is ${bodyLines} lines. The budget is ${MAX_BODY_LINES}.`,
      'Move reference material into a sibling file and point at it. The body is re-read ' +
        'into context on every invocation and stays there for the rest of the session.',
    ])
  }

  /* ---- references resolve, one level deep -------------------------------- */

  checkReferences(skillDir, skillMd, source, true)

  for (const file of listReferenceFiles(skillDir)) {
    const text = readFileSync(file, 'utf8')
    checkReferences(skillDir, file, text, false)

    const lines = text.split(/\r?\n/).length
    if (lines > TOC_THRESHOLD && !/^#{1,3} Contents\b/m.test(text)) {
      problems.push([
        `${rel(file)} is ${lines} lines and has no "## Contents" block.`,
        'An agent previewing a long reference with a partial read cannot see what else is ' +
          'in the file. A contents list at the top is what makes the rest reachable.',
      ])
    }
  }

  /* ---- every command it tells an agent to run exists ---------------------- */

  const texts = [source, ...listReferenceFiles(skillDir).map((f) => readFileSync(f, 'utf8'))]
  for (const text of texts) {
    for (const { command, flags, text: snippet } of findCliInvocations(text)) {
      const options = cli.commands.get(command)
      if (options === undefined) {
        problems.push([
          `${label}: \`${snippet}\` names \`agentblog ${command}\`, which the CLI does not define.`,
          `Commands: ${[...cli.commands.keys()].sort().join(', ')}.`,
        ])
        continue
      }
      for (const flag of flags) {
        if (options.has(flag) || cli.globalOptions.has(flag)) continue
        problems.push([
          `${label}: \`${snippet}\` passes \`${flag}\` to \`agentblog ${command}\`, which has no such flag.`,
          `Accepted: ${[...options].sort().join(' ') || '(none)'}.`,
          'An agent that follows this line gets a commander parse error and stops.',
        ])
      }
    }
  }
}

/** Every markdown file in the skill directory other than SKILL.md. */
function listReferenceFiles(skillDir) {
  const found = []
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      if (statSync(full).isDirectory()) walk(full)
      else if (entry.endsWith('.md') && entry !== 'SKILL.md') found.push(full)
    }
  }
  walk(skillDir)
  return found.sort()
}

/**
 * Every relative markdown link in `text` resolves, and reference files do not
 * link on to further reference files.
 *
 * The depth rule is Anthropic's: an agent following a reference from inside a
 * reference tends to preview rather than read, so it ends up acting on the first
 * hundred lines of a file it never finished.
 */
function checkReferences(skillDir, file, text, isSkillMd) {
  for (const link of text.matchAll(/\]\(([^)\s#]+\.md)\)/g)) {
    const target = link[1]
    if (/^[a-z]+:/.test(target)) continue

    const resolved = resolve(dirname(file), target)
    if (!existsSync(resolved)) {
      problems.push([
        `${rel(file)}: links to ${target}, which does not exist.`,
        'A reference an agent cannot open is worse than no reference: it stops to look.',
      ])
      continue
    }
    if (!isSkillMd) {
      problems.push([
        `${rel(file)}: links on to ${target}.`,
        'Reference files stay one level deep from SKILL.md. Link it from SKILL.md instead.',
      ])
    }
    if (!resolve(resolved).startsWith(resolve(skillDir))) {
      problems.push([
        `${rel(file)}: links to ${target}, outside its own skill directory.`,
        'A skill installed on its own would ship a dangling link. Repeat the material or ' +
          'move it into this skill.',
      ])
    }
  }
}

/* ========================================================================== */

function main() {
  console.log('assert-skill-contract')

  if (!existsSync(SKILLS_DIR)) {
    console.error(`\nassert-skill-contract: FAIL\n\n  ${rel(SKILLS_DIR)} does not exist.\n`)
    process.exit(1)
  }

  const cli = readCliSurface()
  console.log(`  cli surface: ${cli.commands.size} command(s) read from ${rel(CLI_ENTRY)}`)

  const dirs = readdirSync(SKILLS_DIR).filter((d) => statSync(join(SKILLS_DIR, d)).isDirectory())
  for (const dir of dirs.sort()) checkSkill(dir, cli)

  console.log(`  skills: ${dirs.length} checked`)

  if (problems.length === 0) {
    console.log('  frontmatter, budgets, references, and CLI invocations all hold. OK')
    return
  }

  console.error(`\nassert-skill-contract: FAIL (${problems.length} problem(s))\n`)
  for (const lines of problems) {
    console.error(`  ${lines[0]}`)
    for (const line of lines.slice(1)) console.error(`    ${line}`)
    console.error('')
  }
  process.exit(1)
}

main()
