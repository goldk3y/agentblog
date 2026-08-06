/**
 * Reads the registry catalog off disk at build time so `/registry` can list it.
 *
 * The root `registry.json` uses `include` rather than inlining items, and each
 * included chunk owns the files it references. `include` entries must literally
 * be named `registry.json`, and paths inside a chunk resolve relative to that
 * chunk's own directory, so this reader follows the same two rules.
 *
 * It is deliberately forgiving. The registry source is written by a different
 * part of the build than this page, and a missing or half-written catalog should
 * render an empty list rather than fail the site build. Anything genuinely wrong
 * with the catalog is caught by `shadcn registry validate` in CI, which is a
 * better place for it.
 */
import 'server-only'

import fs from 'node:fs'
import path from 'node:path'

export interface RegistryItem {
  readonly name: string
  readonly type: string
  readonly title: string
  readonly description: string
  readonly categories: readonly string[]
  readonly registryDependencies: readonly string[]
  readonly dependencies: readonly string[]
  readonly fileCount: number
  /** The chunk directory this item came from, relative to `apps/web`. */
  readonly chunk: string
}

const ROOT = process.cwd()

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

function toItem(raw: unknown, chunk: string): RegistryItem | null {
  const record = asRecord(raw)
  if (record === null) return null

  const name = record['name']
  const type = record['type']
  if (typeof name !== 'string' || typeof type !== 'string') return null

  const title = record['title']
  const description = record['description']
  const files = record['files']

  return {
    name,
    type,
    title: typeof title === 'string' ? title : name,
    description: typeof description === 'string' ? description : '',
    categories: asStringArray(record['categories']),
    registryDependencies: asStringArray(record['registryDependencies']),
    dependencies: asStringArray(record['dependencies']),
    fileCount: Array.isArray(files) ? files.length : 0,
    chunk,
  }
}

function itemsFrom(catalogPath: string): RegistryItem[] {
  const catalog = asRecord(readJson(catalogPath))
  if (catalog === null) return []

  const chunk = path.relative(ROOT, path.dirname(catalogPath)) || '.'
  const own = Array.isArray(catalog['items'])
    ? catalog['items']
        .map((raw) => toItem(raw, chunk))
        .filter((item): item is RegistryItem => item !== null)
    : []

  const included = asStringArray(catalog['include']).flatMap((relative) =>
    itemsFrom(path.resolve(path.dirname(catalogPath), relative)),
  )

  return [...own, ...included]
}

/** Every item in the catalog, deduplicated by name, sorted by name. */
export function getRegistryItems(): RegistryItem[] {
  const byName = new Map<string, RegistryItem>()
  for (const item of itemsFrom(path.join(ROOT, 'registry.json'))) {
    if (!byName.has(item.name)) byName.set(item.name, item)
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name))
}
