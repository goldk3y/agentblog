#!/usr/bin/env node
/**
 * Assert our AGENTS.md block sits outside the Next.js managed region, and that
 * we never created CLAUDE.md.
 *
 * ===========================================================================
 * THE FAILURE MODE THIS CATCHES
 * ===========================================================================
 * Next.js 16 owns this surface. With `agentRules` on (the default), `next dev`
 * writes `AGENTS.md` and `CLAUDE.md` and manages the region between
 * `<!-- BEGIN:nextjs-agent-rules -->` and `<!-- END:nextjs-agent-rules -->`. It
 * rewrites that region whenever it decides the rules changed.
 *
 * So text we write inside those markers is deleted on the next `next dev`,
 * silently, in the user's repository, with no error and no diff we ever see. The
 * agent instructions that make AgentBlog usable conversationally would work on
 * Monday and be gone on Tuesday, and the only symptom is an agent that stops
 * knowing how to write a post.
 *
 * Writing across the markers is worse: our block would then contain half of
 * Next.js's content, and Next.js's rewrite would corrupt ours.
 *
 * `CLAUDE.md` is a separate rule with the same root. Next.js creates it. We must
 * not, and we must not write into it, because two tools managing one file is how
 * a user ends up with a merge conflict in a generated file they did not ask for.
 * Our content goes in AGENTS.md, after Next's region, once.
 *
 * Usage:
 *   node scripts/assert-agents-md.mjs [project dir]
 *
 * @see https://docs.agentblog.dev/guides/write-with-your-agent
 * @see BUILD-SPEC section 1, agentRules
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const projectDir = resolve(ROOT, process.argv[2] ?? 'apps/fixture-next16')

const AGENTS_MD = join(projectDir, 'AGENTS.md')
const CLAUDE_MD = join(projectDir, 'CLAUDE.md')

const OURS_START = '<!-- agentblog:start -->'
const OURS_END = '<!-- agentblog:end -->'
const NEXT_BEGIN = '<!-- BEGIN:nextjs-agent-rules -->'
const NEXT_END = '<!-- END:nextjs-agent-rules -->'

const problems = []
const rel = (p) => relative(ROOT, p)

function main() {
  console.log('assert-agents-md')
  console.log(`  project: ${rel(projectDir)}`)

  /* ---- CLAUDE.md -------------------------------------------------------- */

  if (existsSync(CLAUDE_MD)) {
    const claude = readFileSync(CLAUDE_MD, 'utf8')
    if (claude.includes(OURS_START) || claude.includes(OURS_END)) {
      problems.push([
        `${rel(CLAUDE_MD)} contains an agentblog block.`,
        'Next.js owns CLAUDE.md. Two tools managing one generated file gives the user a',
        'conflict in a file they never edited. Write to AGENTS.md instead, which is where',
        'every agent reads from anyway.',
      ])
    } else {
      console.log('  CLAUDE.md exists (Next.js writes it) and has no agentblog block. OK')
    }
  } else {
    console.log('  CLAUDE.md absent. OK')
  }

  /* ---- AGENTS.md -------------------------------------------------------- */

  if (!existsSync(AGENTS_MD)) {
    problems.push([
      `No ${rel(AGENTS_MD)}.`,
      '`agentblog init` writes the block there. If this ran after init, init did not do',
      'its job. If it ran before, run it after.',
    ])
    report()
    return
  }

  const agents = readFileSync(AGENTS_MD, 'utf8')

  const ourStarts = [...agents.matchAll(new RegExp(escape(OURS_START), 'g'))].map((m) => m.index)
  const ourEnds = [...agents.matchAll(new RegExp(escape(OURS_END), 'g'))].map((m) => m.index)
  const nextBegin = agents.indexOf(NEXT_BEGIN)
  const nextEnd = agents.indexOf(NEXT_END)

  if (ourStarts.length === 0) {
    problems.push([
      `${rel(AGENTS_MD)} has no ${OURS_START} block.`,
      'Without it, an agent working in this repository has no idea AgentBlog is',
      'installed, which is most of what the CLI is for.',
    ])
  }

  if (ourStarts.length > 1 || ourEnds.length > 1) {
    problems.push([
      `${rel(AGENTS_MD)} has ${ourStarts.length} start and ${ourEnds.length} end markers.`,
      'Exactly one of each. More than one means a second `agentblog init` appended',
      'instead of replacing, so the file grows on every run and the idempotency check',
      'in CI is about to fail for a reason nobody will enjoy tracing.',
    ])
  }

  if (ourStarts.length === 1 && ourEnds.length === 1 && ourEnds[0] < ourStarts[0]) {
    problems.push([
      `${rel(AGENTS_MD)} has ${OURS_END} before ${OURS_START}.`,
      'The block is inverted, so anything that replaces it by marker will eat the file.',
    ])
  }

  if (nextBegin === -1 || nextEnd === -1) {
    console.log('  no nextjs-agent-rules markers in AGENTS.md (agentRules off, or no dev run yet)')
  } else if (ourStarts.length === 1 && ourEnds.length === 1) {
    const start = ourStarts[0]
    const end = ourEnds[0]

    if (start > nextBegin && start < nextEnd) {
      problems.push([
        'The agentblog block starts INSIDE the Next.js managed region.',
        `  ${NEXT_BEGIN} at ${nextBegin}, ${NEXT_END} at ${nextEnd}, ours at ${start}.`,
        '`next dev` rewrites everything between those markers whenever it decides the',
        'rules changed, so our instructions get deleted with no error and no diff. The',
        'symptom is an agent that used to know how to write a post and now does not.',
      ])
    } else if (start < nextBegin && end > nextBegin) {
      problems.push([
        'The agentblog block spans the Next.js markers.',
        'Our block would contain part of Next.js content, and Next.js rewriting its own',
        'region would corrupt ours. Both files lose.',
      ])
    } else if (start < nextEnd) {
      problems.push([
        'The agentblog block sits before the Next.js region ends.',
        `Ours starts at ${start}, ${NEXT_END} is at ${nextEnd}. The block must sit`,
        'strictly after the END marker so Next.js can rewrite its region freely.',
      ])
    } else {
      console.log(`  agentblog block at ${start}, strictly after ${NEXT_END} at ${nextEnd}. OK`)
    }
  }

  report()
}

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function report() {
  if (problems.length === 0) {
    console.log('  agent instructions live where Next.js will not overwrite them. OK')
    return
  }

  console.error(`\nassert-agents-md: FAIL (${problems.length} problem(s))\n`)
  for (const lines of problems) {
    console.error(`  ${lines[0]}`)
    for (const line of lines.slice(1)) console.error(`    ${line}`)
    console.error('')
  }
  console.error('  Rule: our block goes in AGENTS.md, exactly once, strictly after')
  console.error(`  ${NEXT_END}. Never in CLAUDE.md, which Next.js owns.`)
  process.exit(1)
}

main()
