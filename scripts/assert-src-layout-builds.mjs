#!/usr/bin/env node
/**
 * Install the block into a `src/` layout project and build it.
 *
 * ===========================================================================
 * THE FAILURE MODE THIS CATCHES
 * ===========================================================================
 * `create-next-app` asks whether you want your code in a `src/` directory, and
 * roughly half of every Next.js project says yes. Until this script existed,
 * nothing in this repository had ever built one, and it did not work:
 *
 *     Error: Module not found: Can't resolve '@/agentblog.config'
 *     Error: Turbopack build failed with 1 error
 *
 * `agentblog.config.ts` belongs at the project root, `@/*` maps to `./src/*`,
 * and the single import in `lib/config.ts` therefore resolved to nothing. The
 * whole install compiled in the flat fixture, passed every schema check, passed
 * `doctor`, and produced a project the other half of our users could not build.
 *
 * The repair is one `paths` entry, written by `patchTsconfigPaths`. What makes
 * this script worth its runtime is not the repair, which has unit tests, but the
 * question those tests cannot ask: does a real `shadcn add` into a real `src/`
 * project, followed by a real `doctor --fix`, produce something `next build`
 * accepts. The bug shipped because that question had never been asked.
 *
 * ---------------------------------------------------------------------------
 * WHY THE PROJECT IS BUILT HERE INSTEAD OF COMMITTED AS A FIXTURE
 * ---------------------------------------------------------------------------
 * `apps/fixture-next16` is the flat layout, and the difference between the two
 * is entirely mechanical: move `app/` and `lib/` under `src/`, and repoint two
 * strings. A second committed fixture would be that diff plus a second copy of
 * every config to keep in step with the first, and the day they drift is the day
 * this stops testing what it claims to.
 *
 * `node_modules` is symlinked rather than installed, so this costs a file copy
 * rather than a second dependency resolution.
 *
 * Usage:
 *   node scripts/assert-src-layout-builds.mjs --registry 'http://127.0.0.1:4477/r/{name}.json'
 *
 * Requires: the registry served at that URL, and the CLI built at
 * `packages/cli/dist/index.js`. Both are already true inside the `e2e-install`
 * job by the time this runs.
 *
 * @see packages/cli/src/patchers/tsconfig-paths.ts
 * @see CONTRIBUTING.md
 */
import { execFileSync } from 'node:child_process'
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const FIXTURE = join(ROOT, 'apps/fixture-next16')
const CLI = join(ROOT, 'packages/cli/dist/index.js')

const args = new Map()
for (let i = 2; i < process.argv.length; i += 1) {
  const arg = process.argv[i]
  if (!arg.startsWith('--')) continue
  const [key, inline] = arg.slice(2).split('=')
  args.set(key, inline ?? process.argv[++i])
}

const registry = args.get('registry') ?? 'http://127.0.0.1:4477/r/{name}.json'

console.log('assert-src-layout-builds')
console.log(`  registry: ${registry}`)

const work = mkdtempSync(join(tmpdir(), 'agentblog-src-'))
const project = join(work, 'app-src')

function run(command, commandArgs, options = {}) {
  return execFileSync(command, commandArgs, {
    cwd: project,
    encoding: 'utf8',
    stdio: 'pipe',
    ...options,
  })
}

/**
 * Run a command whose exit code is not the thing under test.
 *
 * `doctor` exits non-zero whenever any error remains, which is correct and says
 * nothing about the repair this script cares about. Letting `execFileSync`
 * throw here would replace the assertion below with a stack trace, which is
 * exactly what happened the first time this script caught the bug it exists for.
 */
function runAllowingFailure(command, commandArgs) {
  try {
    return run(command, commandArgs)
  } catch (error) {
    return `${error.stdout ?? ''}${error.stderr ?? ''}`
  }
}

function fail(headline, detail) {
  console.log('')
  console.log(`assert-src-layout-builds: FAIL`)
  console.log('')
  console.log(`  ${headline}`)
  if (detail)
    console.log(
      detail
        .split('\n')
        .map((line) => `    ${line}`)
        .join('\n'),
    )
  console.log('')
  console.log('  A src/ layout is half of what create-next-app offers. An install that')
  console.log('  does not build there is broken for half of every new project.')
  process.exit(1)
}

try {
  /* ---------------------------------------------------------------------- */
  /*  A src/ layout copy of the flat fixture                                 */
  /* ---------------------------------------------------------------------- */

  cpSync(FIXTURE, project, {
    recursive: true,
    filter: (source) => !/(node_modules|\.next|\.turbo|\.agentblog)$/.test(source),
  })

  // Symlinked, so this costs a copy rather than an install. The fixture's
  // dependencies are exactly the ones a consumer has.
  symlinkSync(join(FIXTURE, 'node_modules'), join(project, 'node_modules'), 'dir')

  mkdirSync(join(project, 'src'), { recursive: true })
  renameSync(join(project, 'app'), join(project, 'src/app'))
  renameSync(join(project, 'lib'), join(project, 'src/lib'))

  // The workspace-only pieces. A consumer has neither, and `shadcn` shells out
  // to a package manager that cannot resolve a `workspace:` range from here.
  const pkg = JSON.parse(readFileSync(join(project, 'package.json'), 'utf8'))
  for (const section of ['dependencies', 'devDependencies']) {
    for (const [name, range] of Object.entries(pkg[section] ?? {})) {
      if (String(range).startsWith('workspace:')) delete pkg[section][name]
    }
  }
  writeFileSync(join(project, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`)
  rmSync(join(project, 'eslint.config.js'), { force: true })

  const components = JSON.parse(readFileSync(join(project, 'components.json'), 'utf8'))
  components.tailwind.css = 'src/app/globals.css'
  components.registries = { '@agentblog': registry }
  writeFileSync(join(project, 'components.json'), `${JSON.stringify(components, null, 2)}\n`)

  /*
   * Written out rather than edited, because the fixture's tsconfig extends a
   * workspace package. The comment is load bearing: `tsconfig.json` is JSONC,
   * and a patcher that round-tripped it through `JSON.stringify` would delete
   * this line while every other assertion here still passed.
   */
  writeFileSync(
    join(project, 'tsconfig.json'),
    `{
  "compilerOptions": {
    // Canary. If the tsconfig patcher ever parses and reserialises this file
    // instead of inserting one member, this comment disappears.
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
`,
  )

  console.log(`  project:  ${project}`)

  /* ---------------------------------------------------------------------- */
  /*  The documented path: shadcn add, then doctor --fix                     */
  /* ---------------------------------------------------------------------- */

  run('npx', ['--yes', 'shadcn@4.16.1', 'add', '@agentblog/blog', '--yes', '--overwrite'])

  const configPath = join(project, 'agentblog.config.ts')
  writeFileSync(
    configPath,
    readFileSync(configPath, 'utf8')
      .replace('https://yourdomain.com', 'https://fixture.agentblog.dev')
      .replace("name: 'Your Brand'", "name: 'Fixture Blog'")
      .replace("DEFAULT_AUTHOR = 'your-name'", "DEFAULT_AUTHOR = 'editorial'"),
  )

  runAllowingFailure('node', [CLI, 'doctor', '--fix'])

  const tsconfig = readFileSync(join(project, 'tsconfig.json'), 'utf8')

  if (!tsconfig.includes('"@/agentblog.config"')) {
    fail(
      'doctor --fix did not map @/agentblog.config in tsconfig.json.',
      'Without it the config file at the project root is unreachable from src/.',
    )
  }

  if (!tsconfig.includes('Canary.')) {
    fail(
      'the tsconfig patcher destroyed the comments in tsconfig.json.',
      'tsconfig.json is JSONC. Insert one member, do not reserialise the file.',
    )
  }

  /* ---------------------------------------------------------------------- */
  /*  The verdict that matters                                              */
  /* ---------------------------------------------------------------------- */

  let build
  try {
    build = run('npx', ['--yes', 'next@16.3.0', 'build'], { stdio: 'pipe' })
  } catch (error) {
    const output = `${error.stdout ?? ''}${error.stderr ?? ''}`
    fail('next build failed in a src/ layout.', output.split('\n').slice(-40).join('\n'))
  }

  if (!/Compiled successfully/.test(build)) {
    fail('next build produced no success line.', build.split('\n').slice(-30).join('\n'))
  }

  console.log('  tsconfig: @/agentblog.config mapped, comments intact')
  console.log('  build:    compiled successfully')
  console.log('  a src/ layout installs, repairs, and builds. OK')
} finally {
  rmSync(work, { recursive: true, force: true })
}
