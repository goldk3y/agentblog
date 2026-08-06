/**
 * Filesystem helpers.
 *
 * Every read in this CLI happens against a project we did not write, so the
 * helpers here return `null` rather than throwing on a missing file. A command
 * that has to distinguish "absent" from "unreadable" says so explicitly instead
 * of catching an exception three frames up.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import type { Dirent } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'

export function exists(path: string): boolean {
  return existsSync(path)
}

/** File contents, or `null` when the path is absent or is a directory. */
export function readFile(path: string): string | null {
  try {
    const stat = statSync(path)
    if (!stat.isFile()) return null
    return readFileSync(path, 'utf8')
  } catch {
    return null
  }
}

export function readJson<T>(path: string): T | null {
  const raw = readFile(path)
  if (raw === null) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function writeFileEnsuringDir(path: string, contents: string): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, contents, 'utf8')
}

/** The first of `candidates` that exists, relative to `root`. */
export function firstExisting(root: string, candidates: readonly string[]): string | null {
  for (const candidate of candidates) {
    const full = resolve(root, candidate)
    if (existsSync(full)) return full
  }
  return null
}

export interface WalkOptions {
  /** Directory names skipped entirely. */
  readonly ignore?: readonly string[]
  /** Extensions to return, with the dot. All files when omitted. */
  readonly extensions?: readonly string[]
  readonly maxDepth?: number
}

const DEFAULT_IGNORE = ['node_modules', '.next', '.git', '.turbo', 'dist', 'coverage', '.agentblog']

/** Every file under `dir`, depth first, as absolute paths. */
export function walk(dir: string, options: WalkOptions = {}): string[] {
  const ignore = new Set(options.ignore ?? DEFAULT_IGNORE)
  const maxDepth = options.maxDepth ?? 12
  const out: string[] = []

  const visit = (current: string, depth: number): void => {
    if (depth > maxDepth) return
    let entries: Dirent[]
    try {
      entries = readdirSync(current, { withFileTypes: true, encoding: 'utf8' })
    } catch {
      return
    }
    for (const entry of entries) {
      const full = join(current, entry.name)
      if (entry.isDirectory()) {
        if (ignore.has(entry.name)) continue
        visit(full, depth + 1)
      } else if (entry.isFile()) {
        if (options.extensions && !options.extensions.some((ext) => entry.name.endsWith(ext))) {
          continue
        }
        out.push(full)
      }
    }
  }

  if (existsSync(dir)) visit(dir, 0)
  return out
}

/** A project relative path with forward slashes, for stable output on Windows. */
export function toPosixRelative(root: string, path: string): string {
  return relative(root, path).split(sep).join('/')
}

export { join, resolve, dirname }
