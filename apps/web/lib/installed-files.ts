/**
 * The files `@agentblog/blog` writes into a project, read off the registry at
 * build time so the landing page can show them.
 *
 * The landing page used to carry a hand-written list of paths. A hand-written
 * list is exactly the kind of prose that is correct on the day it is typed and
 * quietly wrong a month later, which is the failure this repository is built to
 * refuse. Resolving the same `registryDependencies` graph that
 * `scripts/assert-file-count.mjs` walks means the tree cannot drift from what an
 * install actually produces: adding a file to a registry item adds a row here.
 *
 * It reads deliberately forgivingly, for the reason `lib/registry-catalog.ts`
 * gives: a half-written catalog should render a short tree rather than fail the
 * site build, and anything genuinely wrong with it is caught by
 * `shadcn registry validate` and `assert-file-count` in CI. The one exception is
 * resolving nothing at all, which `getInstalledFiles` raises rather than
 * returns. See the note there for why that case is not the same kind of
 * incomplete.
 */
import 'server-only'

import fs from 'node:fs'
import path from 'node:path'

import type { BundledLanguage } from 'shiki'

/** One file an install writes into a consumer's project. */
export interface InstalledFile {
  /** Project-relative destination, e.g. `app/blog/[slug]/page.tsx`. */
  readonly path: string
  readonly language: BundledLanguage
  /** The opening lines of the real source, past the file header comment. */
  readonly excerpt: string
}

const ROOT = process.cwd()

/** The item a consumer installs, and the entry point for the dependency walk. */
const ENTRY = 'blog'

/**
 * How much of each file the preview shows.
 *
 * Sixteen lines is roughly the height of the panel, so every file fills it and
 * none of them scrolls on open. The whole file arrives with the install.
 */
const EXCERPT_LINES = 16

/**
 * Extensions the preview can highlight, mapped to their Shiki grammar.
 *
 * A file whose extension is missing here is dropped rather than rendered as
 * plain text, because `text` is not a `BundledLanguage` and passing it would
 * only be a cast that moves the problem to runtime. Every extension the block
 * ships is covered; a new one shows up as a missing row rather than a crash.
 */
const LANGUAGES: Readonly<Record<string, BundledLanguage>> = {
  '.css': 'css',
  '.json': 'json',
  '.md': 'markdown',
  '.mdx': 'mdx',
  '.ts': 'typescript',
  '.tsx': 'tsx',
}

/**
 * A leading block comment.
 *
 * Every source file in the block opens with one explaining why the file exists,
 * which is right for the file and wrong for a preview: sixteen lines of it would
 * fill the panel with prose and show no code. The consumer still receives it.
 * Skipping it here is the whole reason the excerpt is worth looking at.
 */
const FILE_HEADER = /^\uFEFF?\s*\/\*[\s\S]*?\*\/\s*\n/

/** A target written to the project root, e.g. `~/agentblog.config.ts`. */
const HOME_PREFIX = /^~\//

interface Chunk {
  readonly dir: string
  readonly items: readonly unknown[]
}

interface CatalogItem {
  readonly dir: string
  readonly record: Readonly<Record<string, unknown>>
}

function readJson(absolutePath: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(absolutePath, 'utf8')) as unknown
  } catch {
    return null
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : []
}

/**
 * Every chunk reachable from a catalog, with the directory its paths resolve
 * against. `include` entries are relative to the including file, and a chunk
 * owns the files it references, so the directory travels with the items.
 */
function chunksFrom(catalogPath: string): Chunk[] {
  const catalog = asRecord(readJson(catalogPath))
  if (catalog === null) return []

  const dir = path.dirname(catalogPath)
  const own = Array.isArray(catalog['items']) ? [{ dir, items: catalog['items'] }] : []
  const included = asStringArray(catalog['include']).flatMap((relative) =>
    chunksFrom(path.resolve(dir, relative)),
  )

  return [...own, ...included]
}

function indexItems(): Map<string, CatalogItem> {
  const byName = new Map<string, CatalogItem>()

  for (const chunk of chunksFrom(path.join(ROOT, 'registry.json'))) {
    for (const raw of chunk.items) {
      const record = asRecord(raw)
      if (record === null) continue

      const name = record['name']
      if (typeof name !== 'string' || byName.has(name)) continue

      byName.set(name, { dir: chunk.dir, record })
    }
  }

  return byName
}

/**
 * Resolve `blog` through `registryDependencies`, collecting each file's source
 * on disk and its destination in the consumer's project.
 *
 * A bare dependency name is a shadcn built-in, which resolves against the
 * consumer's own configuration and is not ours to show.
 */
function filesFrom(entry: string): { source: string; target: string }[] {
  const items = indexItems()
  const seen = new Set<string>()
  const collected: { source: string; target: string }[] = []

  const walk = (name: string): void => {
    if (seen.has(name)) return
    seen.add(name)

    const item = items.get(name)
    if (item === undefined) return

    const files = item.record['files']
    if (Array.isArray(files)) {
      for (const raw of files) {
        const file = asRecord(raw)
        const source = file?.['path']
        if (typeof source !== 'string') continue

        const target = file?.['target']
        collected.push({
          source: path.resolve(item.dir, source),
          target: typeof target === 'string' ? target : source,
        })
      }
    }

    for (const dependency of asStringArray(item.record['registryDependencies'])) {
      walk(dependency.replace(/^@agentblog\//, ''))
    }
  }

  walk(entry)
  return collected
}

function excerptOf(absolutePath: string): string | null {
  let source: string
  try {
    source = fs.readFileSync(absolutePath, 'utf8')
  } catch {
    return null
  }

  const lines = source.replace(FILE_HEADER, '').split('\n').slice(0, EXCERPT_LINES)
  while (lines.at(-1)?.trim() === '') lines.pop()

  return lines.length > 0 ? lines.join('\n') : null
}

/**
 * Every file an install writes, sorted by path and deduplicated by destination.
 *
 * Two items may name the same target when one is a subset of the other, and a
 * consumer receives that file once, so the list counts it once.
 *
 * Forgiving about a short list, unforgiving about an empty one. Every skip above
 * is a file this build cannot describe, and rendering the rest is the right
 * answer for each of them. Zero files is a different claim: it says the walk
 * never reached a catalog at all, which no state of this repository produces.
 * The one thing that does produce it is a deployment where `registry.json` is
 * traced and the chunks it includes are not, and the symptom there is a section
 * that renders its heading over an empty space. That is invisible in a build
 * log, so it is raised here instead. Throwing during a revalidation is safe:
 * Next.js keeps serving the last good page and retries on the next request,
 * which turns a silently empty panel into a stale-but-correct one and a logged
 * error.
 */
export function getInstalledFiles(): InstalledFile[] {
  const byPath = new Map<string, InstalledFile>()

  for (const { source, target } of filesFrom(ENTRY)) {
    const filePath = target.replace(HOME_PREFIX, '')
    if (byPath.has(filePath)) continue

    const language = LANGUAGES[path.extname(filePath)]
    if (language === undefined) continue

    const excerpt = excerptOf(source)
    if (excerpt === null) continue

    byPath.set(filePath, { path: filePath, language, excerpt })
  }

  if (byPath.size === 0) {
    throw new Error(
      `getInstalledFiles: resolved no files from ${path.join(ROOT, 'registry.json')}. ` +
        'The landing page reads the registry at render, so a rerender in a function needs ' +
        'the chunk registries and their sources declared under the `/` key of ' +
        '`outputFileTracingIncludes` in next.config.ts. Run `node scripts/assert-registry-traced.mjs` ' +
        'after a build to see which of them the trace is missing.',
    )
  }

  return [...byPath.values()].sort((a, b) => a.path.localeCompare(b.path))
}
