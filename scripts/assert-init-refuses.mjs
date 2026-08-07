#!/usr/bin/env node
/**
 * Assert `agentblog init` refuses a project with no components.json, and writes
 * nothing at all while refusing.
 *
 * ===========================================================================
 * THE FAILURE MODE THIS CATCHES
 * ===========================================================================
 * The tempting behaviour is to be helpful: no `components.json`, so run
 * `shadcn init` for the user and carry on. That is the worst thing this CLI
 * could do. `shadcn init` picks a component base, sets a `baseColor`, and writes
 * CSS variables into their stylesheet. A project that already has Tailwind
 * already has a visual identity, so running it on their behalf silently replaces
 * a design system to install a blog. People uninstall over that rather than
 * restyle, which is the exact outcome the whole inheritance design exists to
 * prevent.
 *
 * Two things are asserted, and the second is the one that gets skipped:
 *
 *   1. Non-zero exit, with the shadcn instruction in the output. A refusal the
 *      user cannot act on is just a failure.
 *   2. NOTHING WAS WRITTEN. A command that fails after writing half its output
 *      leaves the user with a repository in a state neither they nor we chose,
 *      and exit code alone cannot see that. So this takes a hash of every file
 *      before the run and compares it after.
 *
 * If the CLI is not built yet, this degrades: it explains what is missing and
 * exits 0 locally, non-zero under CI. A gate that cannot run must not be
 * mistaken for a gate that passed, and a local checkout without a build must not
 * be blocked from running the rest of the suite.
 *
 * Usage:
 *   node scripts/assert-init-refuses.mjs [fixture dir] [--ci]
 *
 * @see https://docs.agentblog.dev/installation
 * @see https://docs.agentblog.dev/guides/match-your-design rule 3
 */
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const positional = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const CI = process.argv.includes('--ci') || process.env.CI === 'true' || process.env.CI === '1'

const fixtureDir = resolve(ROOT, positional[0] ?? 'apps/fixture-no-shadcn')
const CLI_ENTRY = join(ROOT, 'packages/cli/dist/index.js')

/** Directories whose churn is not the CLI's doing. */
const IGNORE_DIRS = new Set(['node_modules', '.next', '.turbo', 'dist', '.git'])

const rel = (p) => relative(ROOT, p)

/** Path plus content hash for every file under a directory. */
function snapshot(dir) {
  const out = new Map()
  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (IGNORE_DIRS.has(entry.name)) continue
      const full = join(current, entry.name)
      if (entry.isDirectory()) {
        walk(full)
        continue
      }
      if (!entry.isFile()) continue
      out.set(
        relative(dir, full),
        createHash('sha256').update(readFileSync(full)).digest('hex').slice(0, 16),
      )
    }
  }
  walk(dir)
  return out
}

function main() {
  console.log('assert-init-refuses')
  console.log(`  fixture: ${rel(fixtureDir)}`)

  if (!existsSync(fixtureDir)) {
    console.error(`\nassert-init-refuses: FAIL\n\n  No fixture at ${fixtureDir}\n`)
    process.exit(1)
  }

  if (existsSync(join(fixtureDir, 'components.json'))) {
    console.error('\nassert-init-refuses: FAIL\n')
    console.error(`  ${rel(fixtureDir)} has a components.json.`)
    console.error('  Then there is nothing to refuse, and this check passes while testing')
    console.error('  nothing. Delete it. The fixture with shadcn configured is')
    console.error('  apps/fixture-next16.')
    process.exit(1)
  }

  if (!existsSync(CLI_ENTRY)) {
    const message =
      `  CLI not built: ${rel(CLI_ENTRY)} does not exist.\n` +
      '  Run `pnpm --filter agentblog build` first.'
    if (CI) {
      console.error('\nassert-init-refuses: FAIL\n')
      console.error(message)
      console.error('\n  In CI this is a failure rather than a skip. A gate that could not run')
      console.error('  is not a gate that passed.')
      process.exit(1)
    }
    console.log(message)
    console.log('  Skipping locally. Pass --ci to make this a failure.')
    return
  }

  const before = snapshot(fixtureDir)
  console.log(`  ${before.size} file(s) hashed before the run`)

  const result = spawnSync(process.execPath, [CLI_ENTRY, 'init'], {
    cwd: fixtureDir,
    encoding: 'utf8',
    // Closed stdin and CI=true so a prompt cannot make this hang forever, and so
    // a CLI that tries to prompt fails loudly instead of blocking the job.
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, CI: 'true', NO_COLOR: '1' },
    timeout: 120_000,
  })

  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`
  const after = snapshot(fixtureDir)
  const problems = []

  console.log(`  exit code: ${result.status}`)

  /* ---- 1. refused, with an actionable message -------------------------- */

  if (result.status === 0) {
    problems.push([
      'init exited 0 against a project with no components.json.',
      'It must refuse. Continuing here means either running `shadcn init` on the',
      "user's behalf, which replaces their design system, or writing block files into",
      'a project that has no components to compose with.',
    ])
  }

  const mentionsShadcn = /shadcn/i.test(output)
  const mentionsCommand = /shadcn@latest init|shadcn init/i.test(output)

  if (!mentionsShadcn || !mentionsCommand) {
    problems.push([
      'The refusal does not tell the user what to run.',
      'It must name `npx shadcn@latest init` and say why: AgentBlog inherits the',
      "project's theme rather than replacing it, so picking a base colour and a",
      "component library is the user's decision, not ours.",
      `Output was: ${output.trim().slice(0, 400) || '(empty)'}`,
    ])
  }

  /* ---- 2. and wrote nothing -------------------------------------------- */

  const added = [...after.keys()].filter((k) => !before.has(k))
  const removed = [...before.keys()].filter((k) => !after.has(k))
  const changed = [...after.keys()].filter((k) => before.has(k) && before.get(k) !== after.get(k))

  if (added.length + removed.length + changed.length > 0) {
    problems.push([
      'init modified the project while refusing.',
      ...added.map((f) => `  created: ${f}`),
      ...removed.map((f) => `  deleted: ${f}`),
      ...changed.map((f) => `  changed: ${f}`),
      'Refuse first, write second. A half-applied install leaves the user with a',
      'repository in a state neither they nor we chose, and the exit code says',
      'nothing about it.',
    ])
  } else {
    console.log('  no file created, changed, or deleted')
  }

  if (problems.length > 0) {
    console.error(`\nassert-init-refuses: FAIL (${problems.length} problem(s))\n`)
    for (const lines of problems) {
      console.error(`  ${lines[0]}`)
      for (const line of lines.slice(1)) console.error(`    ${line}`)
      console.error('')
    }
    process.exit(1)
  }

  console.log('  refused, explained, and wrote nothing. OK')
}

main()
