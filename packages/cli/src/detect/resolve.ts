/**
 * Alias resolution and re-export following.
 *
 * A route file is not always the file that holds the logic. Two common shapes
 * make it a re-export instead:
 *
 *   - the dogfood pattern in this repository, where `app/blog/[slug]/page.tsx`
 *     re-exports the registry source so the demo and the shipped block are the
 *     same modules
 *   - a consumer who wraps our route to add their own layout or analytics
 *
 * In both cases a check that reads only the file at the route path concludes
 * that `generateStaticParams` is missing when it is exported, correctly, from
 * one line away. A false error in a verification tool is more expensive than a
 * missed one, because it teaches people to ignore the output.
 *
 * `tsconfig.json` is read as JSONC. Next.js writes comments into it, and every
 * config file a developer edits by hand ends up with comments in it eventually.
 */
import { stripComments } from '@agentblog/checks'

import { exists, readFile, join, resolve } from '../util/fs.ts'
import type { ProjectContext } from './project.ts'

const EXTENSIONS = ['.tsx', '.ts', '.jsx', '.js', '/index.tsx', '/index.ts']

/**
 * Route segment config, which Next.js parses statically and refuses to accept
 * as a re-export ("It mustn't be reexported"). A shim therefore has to copy
 * these values even when it re-exports everything else, so their presence does
 * not make a file an implementation.
 */
const SEGMENT_CONFIG = new Set([
  'runtime',
  'dynamic',
  'dynamicParams',
  'revalidate',
  'fetchCache',
  'preferredRegion',
  'maxDuration',
  'experimental_ppr',
  'alt',
  'size',
  'contentType',
])

interface Tsconfig {
  readonly compilerOptions?: { readonly paths?: Record<string, string[]> }
}

/** JSON with comments and trailing commas removed, then parsed. */
export function readJsonc<T>(path: string): T | null {
  const raw = readFile(path)
  if (raw === null) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    try {
      return JSON.parse(stripComments(raw).replace(/,(\s*[}\]])/g, '$1')) as T
    } catch {
      return null
    }
  }
}

export function readPathMappings(project: ProjectContext): Record<string, string[]> {
  const tsconfig = readJsonc<Tsconfig>(join(project.root, 'tsconfig.json'))
  return tsconfig?.compilerOptions?.paths ?? {}
}

/**
 * Resolve a specifier the way TypeScript and Turbopack do, through
 * `compilerOptions.paths` and nothing else.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS ALONGSIDE `resolveSpecifier`
 * ---------------------------------------------------------------------------
 * `resolveSpecifier` is deliberately forgiving. When no mapping produces a file
 * it falls back to guessing that `@/` means the project root or `src/`, which is
 * the right behaviour for finding a module in a project we are only reading.
 *
 * It is the wrong behaviour for deciding whether a build will succeed. A `src/`
 * layout maps `@/*` to `./src/*`, `src/agentblog.config.ts` does not exist, and
 * the fallback then finds the file at the project root and reports success for
 * an import that Turbopack fails on. Anything asking "will this resolve at build
 * time" has to model the compiler rather than approximate it.
 *
 * TypeScript picks the single pattern with the longest prefix before its `*`,
 * substitutes, and stops. It does not try the next best pattern when that one
 * misses, so neither does this.
 *
 * @see https://www.typescriptlang.org/docs/handbook/modules/reference.html
 */
export function resolveThroughPathMappings(
  project: ProjectContext,
  specifier: string,
): string | null {
  const mappings = readPathMappings(project)

  let best: { prefix: string; suffix: string; targets: string[] } | null = null

  for (const [pattern, targets] of Object.entries(mappings)) {
    const star = pattern.indexOf('*')
    const prefix = star === -1 ? pattern : pattern.slice(0, star)
    const suffix = star === -1 ? '' : pattern.slice(star + 1)

    if (star === -1) {
      if (pattern !== specifier) continue
    } else if (
      !specifier.startsWith(prefix) ||
      !specifier.endsWith(suffix) ||
      specifier.length < prefix.length + suffix.length
    ) {
      continue
    }

    if (!best || prefix.length > best.prefix.length) best = { prefix, suffix, targets }
  }

  if (!best) return null

  // What the `*` captured. An exact pattern captures nothing and its targets
  // hold no `*`, so the substitution below is a no-op for those.
  const rest = specifier.slice(best.prefix.length, specifier.length - best.suffix.length)
  for (const target of best.targets) {
    const found = firstResolved(join(project.root, target.replace('*', rest)))
    if (found) return found
  }

  return null
}

/**
 * Turn an import specifier into an absolute file path, or `null`.
 *
 * Exact mappings are tried before wildcard ones, which is how TypeScript itself
 * orders them, and the difference is load bearing for a project that maps both
 * `@/agentblog.config` and `@/*`.
 */
export function resolveSpecifier(
  project: ProjectContext,
  fromFile: string,
  specifier: string,
): string | null {
  if (specifier.startsWith('.')) {
    return firstResolved(resolve(fromFile, '..', specifier))
  }

  const mappings = readPathMappings(project)

  for (const [pattern, targets] of Object.entries(mappings)) {
    if (pattern.includes('*')) continue
    if (pattern !== specifier) continue
    for (const target of targets) {
      const found = firstResolved(join(project.root, target))
      if (found) return found
    }
  }

  for (const [pattern, targets] of Object.entries(mappings)) {
    if (!pattern.includes('*')) continue
    const prefix = pattern.slice(0, pattern.indexOf('*'))
    if (!specifier.startsWith(prefix)) continue
    const rest = specifier.slice(prefix.length)
    for (const target of targets) {
      const found = firstResolved(join(project.root, target.replace('*', rest)))
      if (found) return found
    }
  }

  // A bare `@/` with no tsconfig paths still means the project root or `src/`.
  if (specifier.startsWith('@/')) {
    const rest = specifier.slice(2)
    return (
      firstResolved(join(project.root, project.usesSrcDir ? 'src' : '', rest)) ??
      firstResolved(join(project.root, rest))
    )
  }

  return null
}

function firstResolved(base: string): string | null {
  if (exists(base) && /\.[a-z]+$/.test(base)) return base
  for (const extension of EXTENSIONS) {
    const candidate = `${base}${extension}`
    if (exists(candidate)) return candidate
  }
  return null
}

export interface ResolvedModule {
  readonly path: string
  readonly source: string
  /** `true` when we followed a re-export to get here. */
  readonly viaReExport: boolean
}

/**
 * The module that actually defines `name`, following `export { name } from '...'`
 * and `export * from '...'` up to a small depth.
 */
export function followExport(
  project: ProjectContext,
  path: string,
  source: string,
  name: string,
  depth = 0,
): ResolvedModule | null {
  if (depth > 4) return null

  const declaresLocally = new RegExp(
    `(?:export\\s+(?:async\\s+)?function\\s+${name}\\b|export\\s+(?:const|let|var)\\s+${name}\\b)`,
  ).test(source)
  if (declaresLocally) return { path, source, viaReExport: depth > 0 }

  for (const match of source.matchAll(/export\s*(\*|\{[^}]*\})\s*from\s*['"]([^'"]+)['"]/g)) {
    const clause = match[1] ?? ''
    const specifier = match[2] ?? ''
    const exportsName =
      clause === '*' ||
      new RegExp(`(?:^|[{,\\s])${name}(?:\\s+as\\s+\\w+)?\\s*(?:,|})`).test(clause)
    if (!exportsName) continue

    const target = resolveSpecifier(project, path, specifier)
    if (!target) continue
    const targetSource = readFile(target)
    if (targetSource === null) continue

    const found = followExport(project, target, targetSource, name, depth + 1)
    if (found) return found
  }

  return null
}

/**
 * Follow a route file to the module that holds its implementation.
 *
 * A **pure** re-export module resolves to the file it points at, so the checks
 * read real code rather than one export line. "Pure" is the important word: a
 * file that declares anything of its own is treated as the implementation, since
 * following it would then skip code the user actually wrote.
 *
 * This covers both shapes that occur in practice: a page shim re-exporting
 * `default` and friends, and a route handler shim re-exporting `POST`. Route
 * handlers have no default export at all, so keying on `default` alone would
 * miss every `app/api/**` file.
 */
export function followDefault(
  project: ProjectContext,
  path: string,
  source: string,
  depth = 0,
): ResolvedModule {
  if (depth > 3) return { path, source, viaReExport: depth > 0 }

  if (/export\s+default\s+/.test(source)) return { path, source, viaReExport: depth > 0 }

  const declared = [
    ...source.matchAll(
      /export\s+(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/g,
    ),
  ].map((match) => match[1] ?? '')
  if (declared.some((name) => !SEGMENT_CONFIG.has(name))) {
    return { path, source, viaReExport: depth > 0 }
  }

  const match = /export\s*(?:\*|\{[^}]*\})\s*from\s*['"]([^'"]+)['"]/.exec(source)
  if (!match?.[1]) return { path, source, viaReExport: depth > 0 }

  const target = resolveSpecifier(project, path, match[1])
  if (!target) return { path, source, viaReExport: depth > 0 }
  const targetSource = readFile(target)
  if (targetSource === null) return { path, source, viaReExport: depth > 0 }
  return followDefault(project, target, targetSource, depth + 1)
}
