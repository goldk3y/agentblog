#!/usr/bin/env node
/**
 * Assert the `next.config` patcher produces identical output under TypeScript 6
 * and TypeScript 7.
 *
 * ===========================================================================
 * THE FAILURE MODE THIS CATCHES
 * ===========================================================================
 * The CLI patches a user's `next.config.ts` through ts-morph, which means the
 * bytes it writes into someone else's repository are produced by the TypeScript
 * printer. TypeScript 7 is a rewrite. Printer output is not part of anyone's
 * stability contract, so quote style, trailing commas, line breaks inside object
 * literals, and parenthesization can all move between majors without a release
 * note mentioning it.
 *
 * When that happens the patch still works. Nothing errors, nothing fails to
 * compile, and `agentblog doctor` reports success. What breaks is idempotency:
 * `agentblog init` run twice on the same project produces a diff, because the
 * second run reprints what the first run wrote in a slightly different style.
 * The user sees an unexplained diff in a file they did not touch, in a config
 * they may not fully trust us with, from a tool whose whole pitch is that its
 * edits are safe and reversible. That is a trust failure, and trust failures do
 * not get filed as bugs. People just stop running the command.
 *
 * It is also not hypothetical for this repository specifically: `packages/cli`
 * depends on TypeScript 6 while the workspace root is on TypeScript 7, so both
 * majors are already resolvable and which one the CLI gets is a question about
 * someone else's lockfile.
 *
 * ---------------------------------------------------------------------------
 * HOW THE VERSION IS FORCED
 * ---------------------------------------------------------------------------
 * The CLI resolves `typescript` and `ts-morph` from its own location, not from
 * the project it is patching. So each run gets a throwaway copy of `dist` with
 * its own `node_modules` beside it, where `typescript` points at the major under
 * test. Node resolves bare specifiers by walking up from the importing file,
 * which makes that the whole mechanism. No cooperation from the CLI is needed.
 *
 * Two modes, in order of preference:
 *
 *   PURE   `dist/patchers/next-config.js` exporting
 *          `patchNextConfig(source, fileName, options)`, returning either a
 *          string or a `{ source }` result. Preferred, because it isolates the
 *          printer from everything else the command does. Add it to the tsup
 *          entry list to enable this mode.
 *   COMMAND Copy the fixture into a scratch project and run
 *          `agentblog doctor --fix` in it, then read back `next.config.ts`. Uses
 *          the real command, so it also catches a divergence introduced
 *          somewhere other than the patcher.
 *
 * Degrades when the CLI is not built or when only one TypeScript major is
 * installed: prints what is missing, exits 0 locally and non-zero under CI. A
 * gate that could not run must never look like a gate that passed.
 *
 * Usage:
 *   node scripts/assert-patcher-parity.mjs [--ci] [--project apps/fixture-next16]
 *
 * @see https://docs.agentblog.dev/reference/cli
 */
import { spawnSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CI = process.argv.includes('--ci') || process.env.CI === 'true' || process.env.CI === '1'

const projectIndex = process.argv.indexOf('--project')
const projectDir = resolve(
  ROOT,
  projectIndex === -1 ? 'apps/fixture-next16' : process.argv[projectIndex + 1],
)

const CLI_DIST = join(ROOT, 'packages/cli/dist')
/** Pure-function entry points, in preference order. `index.js` is excluded on
 *  purpose: importing it runs the command parser, which exits the process. */
const PURE_ENTRIES = ['patchers/next-config.js', 'patch-next-config.js']

const rel = (p) => relative(ROOT, p)

function degrade(lines) {
  if (CI) {
    console.error('\nassert-patcher-parity: FAIL\n')
    for (const line of lines) console.error(line)
    console.error('')
    console.error('  In CI this is a failure rather than a skip, because a gate that could')
    console.error('  not run is not a gate that passed.')
    process.exit(1)
  }
  console.log('assert-patcher-parity: SKIPPED')
  for (const line of lines) console.log(line)
  console.log('  Pass --ci to make this a failure.')
  process.exit(0)
}

/* -------------------------------------------------------------------------- */
/*  Find two TypeScript majors                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Every TypeScript install in the pnpm store, keyed by major.
 *
 * pnpm keeps each resolved version under `node_modules/.pnpm/typescript@<v>`, so
 * having both majors on disk is just a matter of something in the workspace
 * depending on each. The CLI depends on 6 and the root on 7, which is exactly
 * the split this check needs.
 */
function findTypeScriptInstalls() {
  const storeDir = join(ROOT, 'node_modules/.pnpm')
  const byMajor = new Map()
  if (!existsSync(storeDir)) return byMajor

  for (const entry of readdirSync(storeDir)) {
    const match = /^typescript@(\d+)\.[\d.]+/.exec(entry)
    if (!match) continue
    const dir = join(storeDir, entry, 'node_modules/typescript')
    if (!existsSync(dir)) continue
    const version = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).version
    const major = match[1]
    const existing = byMajor.get(major)
    if (!existing || existing.version < version) byMajor.set(major, { dir, version })
  }
  return byMajor
}

/* -------------------------------------------------------------------------- */
/*  Scratch directory with a pinned TypeScript                                 */
/* -------------------------------------------------------------------------- */

/** Symlink every package visible to the CLI into a scratch node_modules. */
function linkDependencies(target, sourceDirs) {
  mkdirSync(target, { recursive: true })
  const linked = new Set()

  const link = (name, from) => {
    if (linked.has(name)) return
    linked.add(name)
    try {
      symlinkSync(realpathSync(from), join(target, name))
    } catch {
      // Already linked from an earlier source directory, or not resolvable.
    }
  }

  for (const sourceDir of sourceDirs) {
    if (!existsSync(sourceDir)) continue
    for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
      if (entry.name === '.pnpm' || entry.name === '.bin') continue

      if (entry.name.startsWith('@')) {
        mkdirSync(join(target, entry.name), { recursive: true })
        for (const scoped of readdirSync(join(sourceDir, entry.name))) {
          link(`${entry.name}/${scoped}`, join(sourceDir, entry.name, scoped))
        }
        continue
      }

      link(entry.name, join(sourceDir, entry.name))
    }
  }
}

/** A copy of the built CLI whose `typescript` is the major under test. */
function stageCli(work, install) {
  const cliDir = join(work, 'cli')
  cpSync(CLI_DIST, join(cliDir, 'dist'), { recursive: true })
  writeFileSync(
    join(cliDir, 'package.json'),
    `${JSON.stringify({ name: 'agentblog-parity', type: 'module' }, null, 2)}\n`,
  )

  const modules = join(cliDir, 'node_modules')
  linkDependencies(modules, [join(ROOT, 'packages/cli/node_modules'), join(ROOT, 'node_modules')])

  rmSync(join(modules, 'typescript'), { recursive: true, force: true })
  symlinkSync(realpathSync(install.dir), join(modules, 'typescript'))

  return cliDir
}

/* -------------------------------------------------------------------------- */
/*  The input                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * A deliberately unpatched `next.config.ts`, embedded rather than read from a
 * fixture.
 *
 * Reading the fixture would make this gate depend on when it runs: once
 * `doctor --fix` has patched that project, the patcher has nothing left to add
 * and the comparison becomes two identical copies of a finished file. A gate
 * whose result depends on the order of the other steps is not a gate.
 *
 * The sample carries the two shapes the patcher has to handle without help: a
 * typed default export, and an `images` object that already exists and must be
 * merged into rather than replaced.
 */
const SAMPLE_CONFIG = `import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'cdn.example.com' }],
  },
}

export default nextConfig
`

const PURE_RUNNER = `
import { readFileSync } from 'node:fs'

const [entry, configPath] = process.argv.slice(2)
const mod = await import(entry)
const fn = mod.patchNextConfig ?? mod.patchNextConfigSource ?? mod.default?.patchNextConfig

if (typeof fn !== 'function') {
  process.stderr.write('NO_PATCH_EXPORT')
  process.exit(3)
}

const result = await fn(readFileSync(configPath, 'utf8'), 'next.config.ts', {})
process.stdout.write(typeof result === 'string' ? result : (result?.source ?? JSON.stringify(result)))
`

/* -------------------------------------------------------------------------- */

function runPure(major, install, entryRelative) {
  const work = join(tmpdir(), `agentblog-parity-pure-ts${major}`)
  rmSync(work, { recursive: true, force: true })
  mkdirSync(work, { recursive: true })

  const cliDir = stageCli(work, install)
  writeFileSync(join(work, 'runner.mjs'), PURE_RUNNER)

  const samplePath = join(work, 'next.config.ts')
  writeFileSync(samplePath, SAMPLE_CONFIG)

  const result = spawnSync(
    process.execPath,
    [join(work, 'runner.mjs'), join(cliDir, 'dist', entryRelative), samplePath],
    { encoding: 'utf8', timeout: 180_000 },
  )

  rmSync(work, { recursive: true, force: true })
  return { status: result.status, output: result.stdout, stderr: result.stderr ?? '' }
}

function runCommand(major, install) {
  const work = join(tmpdir(), `agentblog-parity-cmd-ts${major}`)
  rmSync(work, { recursive: true, force: true })
  mkdirSync(work, { recursive: true })

  const cliDir = stageCli(work, install)

  // A real copy of the fixture, minus node_modules. The patcher reads the whole
  // project, not just the one file, so handing it a lone config would exercise a
  // path no user ever takes.
  const scratchProject = join(work, 'project')
  cpSync(projectDir, scratchProject, {
    recursive: true,
    filter: (src) => !src.includes(`${'node_modules'}`) && !src.includes('.next'),
  })

  const result = spawnSync(
    process.execPath,
    [join(cliDir, 'dist', 'index.js'), 'doctor', '--fix'],
    {
      cwd: scratchProject,
      encoding: 'utf8',
      env: { ...process.env, CI: 'true', NO_COLOR: '1' },
      timeout: 180_000,
    },
  )

  const configFile = join(scratchProject, 'next.config.ts')
  const output = existsSync(configFile) ? readFileSync(configFile, 'utf8') : ''

  rmSync(work, { recursive: true, force: true })
  return {
    status: output.length > 0 ? 0 : (result.status ?? 1),
    output,
    stderr: `${result.stderr ?? ''}${result.stdout ?? ''}`,
  }
}

/* -------------------------------------------------------------------------- */

function main() {
  console.log('assert-patcher-parity')

  if (!existsSync(CLI_DIST)) {
    degrade([
      `  CLI not built: ${rel(CLI_DIST)} does not exist.`,
      '  Run `pnpm --filter agentblog build` first.',
    ])
  }

  if (!existsSync(join(projectDir, 'next.config.ts'))) {
    degrade([`  No next.config.ts in ${rel(projectDir)}.`])
  }

  const installs = findTypeScriptInstalls()
  const majors = [...installs.keys()].sort()

  if (majors.length < 2) {
    degrade([
      `  Only found TypeScript major(s): ${majors.join(', ') || 'none'}.`,
      '  Parity needs two. The CLI depends on TypeScript 6 and the root on',
      '  TypeScript 7, so a workspace install should produce both under',
      '  node_modules/.pnpm. If one was dropped, this check silently stops testing',
      '  anything, which is why it reports rather than passes.',
    ])
  }

  const pureEntry = PURE_ENTRIES.find((c) => existsSync(join(CLI_DIST, c)))
  const mode = pureEntry ? 'pure' : 'command'
  const [a, b] = majors.slice(0, 2)

  console.log(`  project: ${rel(projectDir)}`)
  console.log(
    `  mode:    ${mode}${pureEntry ? ` (${pureEntry})` : ' (doctor --fix in a scratch copy)'}`,
  )
  console.log(`  ts ${a}:    ${installs.get(a).version}`)
  console.log(`  ts ${b}:    ${installs.get(b).version}`)

  const run = (major) =>
    pureEntry
      ? runPure(major, installs.get(major), pureEntry)
      : runCommand(major, installs.get(major))

  const runA = run(a)
  const runB = run(b)

  for (const [major, result] of [
    [a, runA],
    [b, runB],
  ]) {
    if (result.stderr.includes('NO_PATCH_EXPORT')) {
      degrade([
        `  ${pureEntry} exports no patchNextConfig.`,
        '  Export the patch as a pure source to source function so the printer can',
        '  be tested without running the whole command.',
      ])
    }
    if (result.status !== 0 || result.output.length === 0) {
      console.error('\nassert-patcher-parity: FAIL\n')
      console.error(`  The patcher produced nothing under TypeScript ${major}.`)
      console.error(`  ${result.stderr.slice(0, 900)}`)
      console.error('')
      console.error('  A failure under one major is worse than a diff: the CLI is unusable')
      console.error('  for anyone whose project resolves that version.')
      process.exit(1)
    }
  }

  // Two identical copies of an unpatched file are also identical. Without this
  // guard, a patcher that silently did nothing would pass the parity check
  // perfectly, which is the vacuous pass this whole directory exists to avoid.
  const original =
    mode === 'pure' ? SAMPLE_CONFIG : readFileSync(join(projectDir, 'next.config.ts'), 'utf8')
  if (runA.output === original) {
    console.error('\nassert-patcher-parity: FAIL\n')
    console.error('  The patcher returned the input unchanged, so there is nothing to compare.')
    console.error('')
    console.error('  The input omits htmlLimitedBots and images.qualities, so a working patcher')
    console.error('  has two things to add. Either it declined (read its output above), or it')
    console.error('  never ran.')
    console.error('')
    console.error(`  ${runA.stderr.slice(0, 600)}`)
    process.exit(1)
  }

  if (runA.output === runB.output) {
    console.log(`  patched, and identical under TypeScript ${a} and ${b}. OK`)
    return
  }

  const linesA = runA.output.split('\n')
  const linesB = runB.output.split('\n')
  const max = Math.max(linesA.length, linesB.length)

  console.error('\nassert-patcher-parity: FAIL\n')
  console.error(`  The patcher writes different bytes under TypeScript ${a} and ${b}.\n`)

  let shown = 0
  for (let i = 0; i < max && shown < 20; i += 1) {
    if (linesA[i] === linesB[i]) continue
    shown += 1
    console.error(`  line ${i + 1}`)
    console.error(`    ts${a}: ${linesA[i] ?? '(no line)'}`)
    console.error(`    ts${b}: ${linesB[i] ?? '(no line)'}`)
  }

  console.error('')
  console.error('  The patch works either way. What breaks is idempotency: a user whose')
  console.error('  project resolves the other major gets an unexplained diff in their')
  console.error('  next.config on the second `agentblog init`, in a file they trusted us')
  console.error('  with. Pin the printer settings, or normalize the output before writing.')
  process.exit(1)
}

main()
