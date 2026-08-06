#!/usr/bin/env node
/**
 * AgentBlog codegen.
 *
 * ===========================================================================
 * THE PROBLEM THIS SOLVES
 * ===========================================================================
 * Three pairs of files in this repository must stay byte-identical, and none of
 * the three pairs can be unified by an import:
 *
 *   1. `packages/schema/src/*` and `apps/web/registry/blog/lib/*`
 *      The registry ships files into a consumer's repository. Those files have
 *      no `node_modules/@agentblog/schema` to import from, and adding one would
 *      contradict the whole shadcn model of shipping code rather than packages.
 *
 *   2. `packages/checks/src/core.ts` and `apps/web/registry/blog/lib/preflight-checks.ts`
 *      `agentblog doctor` runs from the CLI package with a full dependency tree.
 *      `lib/preflight.ts` runs inside the consumer's app with only what the
 *      registry wrote. They must answer the same questions identically, and the
 *      only way they cannot drift is a copy plus a drift check.
 *
 *   3. `apps/web/registry/agent/skills/**` and `plugins/agentblog/skills/**`
 *      A symlink is specifically wrong here. Claude Code copies a plugin
 *      directory to a cache location on install, so a symlink pointing outside
 *      the plugin directory ships empty skills. That failure is invisible to us
 *      and visible only to users, which is the worst possible split.
 *
 * ===========================================================================
 * THE MECHANISM
 * ===========================================================================
 * One mechanism for all three: **verbatim file copy, plus a generated-file
 * banner, plus import-specifier rewriting.** No AST surgery, no partial
 * extraction, no template interpolation. If you can read the source file you can
 * predict the output exactly.
 *
 * Usage:
 *   node scripts/codegen.mjs           write the generated files
 *   node scripts/codegen.mjs --check   exit 1 if any generated file is stale
 *
 * CI runs both: `pnpm codegen && git diff --exit-code`. Drift becomes a red
 * build rather than two tools disagreeing in front of a user.
 */
import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import prettier from 'prettier'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CHECK_ONLY = process.argv.includes('--check')

const REGISTRY_LIB = 'apps/web/registry/blog/lib'
const SKILLS_SOURCE = 'apps/web/registry/agent/skills'
const SKILLS_DEST = 'plugins/agentblog/skills'

/**
 * One generated TypeScript file.
 *
 * `serverOnly` prepends `import 'server-only'`, which turns a client import of
 * the file into a build error rather than silent bundle growth. Zod runs only on
 * the server in AgentBlog, and this is what enforces that rather than assuming it.
 */
const TS_TARGETS = [
  {
    from: 'packages/schema/src/schemas.ts',
    to: `${REGISTRY_LIB}/schemas.ts`,
    serverOnly: true,
  },
  {
    from: 'packages/schema/src/types.ts',
    to: `${REGISTRY_LIB}/types.ts`,
    serverOnly: false,
  },
  {
    from: 'packages/schema/src/define-config.ts',
    to: `${REGISTRY_LIB}/define-config.ts`,
    serverOnly: true,
  },
  {
    from: 'packages/checks/src/core.ts',
    to: `${REGISTRY_LIB}/preflight-checks.ts`,
    serverOnly: false,
  },
]

/**
 * Relative specifiers inside the workspace packages carry a `.ts` extension, so
 * the source runs unchanged under `node --test`. The shipped copies use the
 * `@/` alias instead, which is what every other file in the block uses and what
 * the shadcn CLI rewrites on install.
 */
const IMPORT_REWRITES = [
  [/(['"])\.\/schemas\.ts\1/g, "'@/lib/schemas'"],
  [/(['"])\.\/types\.ts\1/g, "'@/lib/types'"],
  [/(['"])\.\/define-config\.ts\1/g, "'@/lib/define-config'"],
  [/(['"])\.\/core\.ts\1/g, "'@/lib/preflight-checks'"],
]

function banner(sourcePath) {
  return `/**
 * ! GENERATED FILE. DO NOT EDIT.
 *
 * Source of truth: \`${sourcePath}\` in the AgentBlog repository.
 * Regenerate with \`pnpm codegen\`.
 *
 * This file is copied verbatim so that the code running in your project is the
 * same code the AgentBlog test suite runs against. Edits here are safe to make
 * in your own repository once installed, but they will be overwritten if you
 * reinstall the block.
 */
`
}

function rewriteImports(source) {
  let out = source
  for (const [pattern, replacement] of IMPORT_REWRITES) {
    out = out.replace(pattern, replacement)
  }
  return out
}

function renderTsTarget(source, target) {
  const body = rewriteImports(source)
  const serverOnlyLine = target.serverOnly
    ? "import 'server-only'\n\n" +
      '// `server-only` makes a client import of this module a build error rather\n' +
      '// than silent bundle growth. Everything below runs at build time or in a\n' +
      '// route handler, never in the browser.\n\n'
    : ''
  return `${banner(target.from)}${serverOnlyLine}${body}`
}

/**
 * Format generated output with the repository's own Prettier config.
 *
 * Without this the generated files fail `prettier --check` in CI, and the only
 * available fixes would be to exempt them (which hides real formatting drift in
 * the sources) or to hand-format the banner to match (which breaks the next time
 * the Prettier config changes). Formatting here keeps one source of truth for
 * style as well as for content.
 */
async function format(contents, filepath) {
  const options = await prettier.resolveConfig(filepath, { editorconfig: true })
  return prettier.format(contents, { ...options, filepath })
}

/* -------------------------------------------------------------------------- */

async function exists(path) {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

async function listFiles(dir) {
  const out = []
  const walk = async (current) => {
    let entries
    try {
      entries = await readdir(current, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const full = join(current, entry.name)
      if (entry.isDirectory()) await walk(full)
      else if (entry.isFile()) out.push(full)
    }
  }
  await walk(dir)
  return out.sort()
}

const hash = (text) => createHash('sha256').update(text).digest('hex')

/** Returns true when the file changed (or would change under --check). */
async function emit(absPath, contents, stale) {
  const rel = relative(ROOT, absPath)
  const current = (await exists(absPath)) ? await readFile(absPath, 'utf8') : null

  if (current !== null && hash(current) === hash(contents)) return false

  if (CHECK_ONLY) {
    stale.push(rel)
    return true
  }

  await mkdir(dirname(absPath), { recursive: true })
  await writeFile(absPath, contents, 'utf8')
  console.log(`  wrote ${rel}`)
  return true
}

async function generateTypeScript(stale) {
  for (const target of TS_TARGETS) {
    const from = join(ROOT, target.from)
    if (!(await exists(from))) {
      throw new Error(`codegen source is missing: ${target.from}`)
    }
    const source = await readFile(from, 'utf8')
    const to = join(ROOT, target.to)
    await emit(to, await format(renderTsTarget(source, target), to), stale)
  }
}

async function generateSkills(stale) {
  const sourceDir = join(ROOT, SKILLS_SOURCE)
  const destDir = join(ROOT, SKILLS_DEST)

  if (!(await exists(sourceDir))) {
    console.log(`  skipped skills: ${SKILLS_SOURCE} does not exist yet`)
    return
  }

  const sourceFiles = await listFiles(sourceDir)
  const expected = new Set()

  for (const file of sourceFiles) {
    const rel = relative(sourceDir, file)
    expected.add(rel)
    await emit(join(destDir, rel), await readFile(file, 'utf8'), stale)
  }

  // Remove plugin skill files whose source was deleted, so the plugin never
  // ships a skill the registry no longer has.
  for (const file of await listFiles(destDir)) {
    const rel = relative(destDir, file)
    if (expected.has(rel)) continue
    if (CHECK_ONLY) {
      stale.push(relative(ROOT, file))
    } else {
      await rm(file)
      console.log(`  removed ${relative(ROOT, file)}`)
    }
  }
}

async function main() {
  const stale = []

  console.log(CHECK_ONLY ? 'agentblog codegen (check)' : 'agentblog codegen')
  await generateTypeScript(stale)
  await generateSkills(stale)

  if (CHECK_ONLY && stale.length > 0) {
    console.error('\nGenerated files are out of date:')
    for (const path of stale) console.error(`  ${path}`)
    console.error('\nRun `pnpm codegen` and commit the result.')
    process.exit(1)
  }

  console.log(CHECK_ONLY ? 'up to date' : 'done')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
