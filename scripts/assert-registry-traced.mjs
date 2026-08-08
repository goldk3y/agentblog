#!/usr/bin/env node
/**
 * Assert the landing page's serverless trace carries the registry it reads.
 *
 * ===========================================================================
 * THE FAILURE MODE THIS CATCHES
 * ===========================================================================
 * The landing page does not hand-write the list of files an install produces.
 * It walks `registry.json` on disk, through the `include` chunks to the items
 * and their sources, and renders the result. That is the whole reason the panel
 * is worth believing: it cannot drift from what `shadcn add` actually writes.
 *
 * It is also a file read at render, and the page carries `revalidate = 3600` so
 * a real reader can see the star count move. Those two facts do not fit
 * together on their own. A prerender runs in the repository, where every file is
 * present. An hourly rerender runs in a function, which carries only the files
 * Next.js traced, and Next.js traces what it can see written down. `ROOT` and
 * `'registry.json'` are visible in the source, so the root catalog gets traced.
 * Everything past it is computed: the chunk paths come out of the JSON, and the
 * source paths come out of the chunks. None of that survives static analysis.
 *
 * So the deployment shipped one catalog whose entire content was a list of three
 * files it did not have. The read returned nothing, the component rendered
 * nothing, and the section kept its heading and its caption about opening any
 * file to read the source, with empty space where the files had been. It was a
 * HIT in the CDN and a 200 on the wire. Nothing failed, which is why it survived
 * a deploy.
 *
 * `outputFileTracingIncludes` in `apps/web/next.config.ts` is the fix, and this
 * script is what makes the fix checkable. Reading the built trace is the only
 * honest way to check it: `next start` serves out of the repository, so the page
 * renders correctly there whether or not a single file was traced, and so does
 * every local build. The trace is the artifact that differs.
 *
 * Two failures are reported separately, because they have different causes:
 *
 *   MISSING    A file the page opens is absent from the trace. Usually a new
 *              registry chunk, or a route key that stopped matching.
 *   UNREADABLE The walk itself found nothing, so there was nothing to compare.
 *              A broken `registry.json` rather than a tracing problem.
 *
 * Degrades when `apps/web/.next` has no build in it: prints what is missing,
 * exits 0 locally and non-zero under CI. A gate that could not run must never
 * look like a gate that passed.
 *
 * Usage:
 *   pnpm --filter @agentblog/web build
 *   node scripts/assert-registry-traced.mjs [--ci]
 *
 * @see apps/web/lib/installed-files.ts, the read this mirrors
 * @see https://nextjs.org/docs/app/api-reference/config/next-config-js/output
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const WEB = join(ROOT, 'apps/web')
const CI = process.argv.includes('--ci') || process.env['CI'] === 'true'

/**
 * The trace for the landing page. `(marketing)` is a route group, so it is a
 * directory on disk and absent from the URL, which is also why the tracing key
 * that fills this file is `/` and not `/(marketing)`.
 */
const TRACE = join(WEB, '.next/server/app/(marketing)/page.js.nft.json')

/** The item a consumer installs, and the entry point for the dependency walk. */
const ENTRY = 'blog'

const rel = (file) => relative(ROOT, file) || '.'

/* -------------------------------------------------------------------------- */
/*  The read, mirrored                                                        */
/* -------------------------------------------------------------------------- */

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

function asRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value : null
}

function asStringArray(value) {
  return Array.isArray(value) ? value.filter((entry) => typeof entry === 'string') : []
}

/**
 * Every catalog file the walk opens, root first, then each `include` in turn.
 *
 * The chunks are collected as paths rather than as parsed content, because they
 * are half of what has to be traced. A chunk that parses here and is absent from
 * the function is exactly the shape of the original failure.
 */
function catalogFiles(file, seen = new Set()) {
  if (seen.has(file)) return []
  seen.add(file)

  const catalog = asRecord(readJson(file))
  if (catalog === null) return [file]

  const dir = dirname(file)
  const included = asStringArray(catalog['include']).flatMap((entry) =>
    catalogFiles(resolve(dir, entry), seen),
  )

  return [file, ...included]
}

function indexItems(catalogs) {
  const byName = new Map()

  for (const file of catalogs) {
    const catalog = asRecord(readJson(file))
    if (catalog === null || !Array.isArray(catalog['items'])) continue

    for (const raw of catalog['items']) {
      const record = asRecord(raw)
      const name = record?.['name']
      if (typeof name !== 'string' || byName.has(name)) continue

      byName.set(name, { dir: dirname(file), record })
    }
  }

  return byName
}

/**
 * Every source the walk names, resolved against its own chunk.
 *
 * Deliberately unfiltered. `getInstalledFiles` drops a file whose extension it
 * cannot highlight, so requiring only the ones it renders would be closer to
 * what the page needs, and would also be a second copy of that extension list
 * living three directories away from the first. Requiring all of them asks for
 * a few more files than the page opens and cannot fall out of step.
 */
function sourceFiles(items) {
  const seen = new Set()
  const collected = []

  const walk = (name) => {
    if (seen.has(name)) return
    seen.add(name)

    const item = items.get(name)
    if (item === undefined) return

    for (const raw of item.record['files'] ?? []) {
      const record = asRecord(raw)
      const source = record?.['path']
      if (typeof source !== 'string') continue

      collected.push(resolve(item.dir, source))
    }

    for (const dependency of asStringArray(item.record['registryDependencies'])) {
      walk(dependency.replace(/^@agentblog\//, ''))
    }
  }

  walk(ENTRY)
  return collected
}

/* -------------------------------------------------------------------------- */
/*  The trace                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Trace entries are relative to the directory holding the trace file, which is
 * why they read as a run of `../`. Resolving them is the whole parse.
 */
function tracedPaths(file) {
  const trace = asRecord(readJson(file))
  const files = asStringArray(trace?.['files'])
  const dir = dirname(file)
  return new Set(files.map((entry) => resolve(dir, entry)))
}

/* -------------------------------------------------------------------------- */
/*  Report                                                                    */
/* -------------------------------------------------------------------------- */

function degrade(lines) {
  console.log('assert-registry-traced: SKIPPED\n')
  for (const line of lines) console.log(line)
  if (!CI) {
    console.log('\n  Not a failure locally. Under CI this exits non-zero.')
    return
  }
  console.error('\n  Under CI a gate that cannot run is a failure.')
  process.exit(1)
}

function main() {
  console.log('assert-registry-traced\n')

  if (!existsSync(TRACE)) {
    degrade([
      `  No trace at ${rel(TRACE)}.`,
      '  Build the site first: pnpm --filter @agentblog/web build',
    ])
    return
  }

  const catalogs = catalogFiles(join(WEB, 'registry.json'))
  const sources = sourceFiles(indexItems(catalogs))

  if (sources.length === 0) {
    console.error('assert-registry-traced: FAIL (unreadable)\n')
    console.error(`  Walking ${rel(join(WEB, 'registry.json'))} resolved no source files, so`)
    console.error('  there was nothing to check the trace against. The landing page renders')
    console.error('  this same walk, so it is already showing an empty panel.')
    console.error('')
    console.error(`  Catalogs opened: ${catalogs.map(rel).join(', ')}`)
    console.error('  Check that each one parses and that `blog` is reachable from the root.')
    process.exit(1)
  }

  const traced = tracedPaths(TRACE)
  const required = [...new Set([...catalogs, ...sources])].sort()
  const missing = required.filter((file) => !traced.has(file))

  console.log(`  trace:    ${rel(TRACE)} (${traced.size} file(s))`)
  console.log(`  required: ${catalogs.length} catalog(s), ${sources.length} source(s)`)

  if (missing.length === 0) {
    console.log('  every file the landing page reads is in the trace. OK')
    return
  }

  console.error(`\nassert-registry-traced: FAIL (${missing.length} missing)\n`)
  console.error('  The landing page opens these at render, and the deployment will not have')
  console.error('  them. Every one is a row absent from the install tree:')
  console.error('')
  for (const file of missing.slice(0, 20)) console.error(`    missing: ${rel(file)}`)
  if (missing.length > 20) console.error(`    ... and ${missing.length - 20} more`)
  console.error('')
  console.error('  Fix it in `outputFileTracingIncludes` in apps/web/next.config.ts, under the')
  console.error('  `/` key. Globs there resolve from apps/web, and the key is matched against')
  console.error('  the route path, so a new chunk directory needs its own line.')
  console.error('')
  console.error('  Left alone this is not an error anywhere. The page returns 200, the section')
  console.error('  keeps its heading and its file count, and the panel under them is empty.')
  process.exit(1)
}

main()
