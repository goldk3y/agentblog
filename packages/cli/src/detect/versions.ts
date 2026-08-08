/**
 * Dependency version detection, plus the runtime lookup of the Next.js patch
 * floor.
 *
 * ===========================================================================
 * WHY A DEPENDENCY RANGE IS NOT A VERSION
 * ===========================================================================
 * A `package.json` dependency is a **range**, and the range syntax is npm's,
 * not ours. This file used to read one with `/(\d+)\.(\d+)\.(\d+)/`, which
 * matches `^4.3.3` and does not match `^4`. `create-next-app` writes `^4`.
 *
 * The result was a hard refusal on the single most common project shape there
 * is. A fresh `create-next-app` project with Tailwind v4 in it was told
 * "Tailwind CSS is not installed. AgentBlog requires Tailwind v4", and pointed
 * at a v3 migration guide it had no use for. The same regress hid `^16`,
 * `~5.1`, `4.x`, and every other partial range, so `init` could also refuse a
 * Next.js 16 project for not having Next.js.
 *
 * So ranges go through `semver`, which is the reference implementation of the
 * grammar npm publishes.
 *
 * ===========================================================================
 * A RANGE IS REFUSED ONLY WHEN IT CANNOT POSSIBLY PASS
 * ===========================================================================
 * The obvious comparison, `semver.minVersion(range)` against the floor, is
 * wrong, and wrong in the direction that started all this. `^5` has a minimum
 * of 5.0.0, so a TypeScript 5.1 floor would refuse `"typescript": "^5"`, which
 * is what `create-next-app` writes and which installs 5.9. The floor and the
 * range disagree about the minor, and the range is the one with no opinion.
 *
 * An installed version is compared with `satisfies`, because it is a fact. A
 * declared range is compared with `intersects`, which asks whether the range
 * and the floor overlap at all. `^5` overlaps `>=5.1.0`, so it passes. `^3.4.1`
 * does not overlap `>=4.0.0`, so Tailwind v3 is still refused, and refused for
 * a reason that holds no matter which version the range resolves to.
 *
 * That asymmetry is deliberate. A false refusal blocks an install with a
 * message the user cannot act on, which is the bug above. A false pass hands
 * the same project to `next build`, which has the installed tree and says so
 * precisely. Given only a range, the second failure is the cheaper one.
 *
 * ===========================================================================
 * THREE ANSWERS, NOT TWO
 * ===========================================================================
 * "Absent" and "cannot tell" are different facts and used to share a message.
 * `catalog:`, `workspace:*`, `file:`, a git URL, and a bare `*` are all legal
 * specs that name no version, and `node_modules` may not exist yet. Reporting
 * any of those as "not installed" sends the user to fix something that is not
 * broken.
 *
 * `resolveDependency` returns which of the four it is, and the caller phrases
 * it. The one thing no caller may do is describe a declared range as an
 * installed version.
 *
 * Check 9 keeps its own rule on top of that: it refuses to hardcode a minimum
 * Next.js version. The May 2026 security release (16.2.6 and 15.5.18, thirteen
 * advisories, none of them fixable at the WAF layer) was superseded within
 * eight weeks, so any literal we ship is stale before our next minor. The floor
 * is resolved at the moment the check runs from the npm registry's published
 * version list, and the check degrades to a skip when the network is
 * unavailable rather than inventing an answer.
 *
 * What it reads is the version list and nothing else. It does not consult any
 * security advisory feed, so it proves "there is a newer patch on your line",
 * not "your version has a known vulnerability". Those are different claims and
 * only the first one is ours to make.
 *
 * @see https://docs.agentblog.dev/reference/cli#what-it-checks
 * @see https://github.com/npm/node-semver#ranges
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { intersects, satisfies, validRange } from 'semver'

import type { ProjectContext } from './project.ts'

export interface SemVer {
  readonly major: number
  readonly minor: number
  readonly patch: number
  readonly raw: string
}

/**
 * Parse an **exact** version, the kind a package's own `package.json` and the
 * npm registry publish.
 *
 * Anchored on purpose. Unanchored, this accepted `>=16.0.0` and reported
 * 16.0.0 as though it were exact, which is the confusion between a range and a
 * version that the rest of this file exists to remove. Ranges go through
 * `minVersionOfSpec`.
 */
export function parseSemVer(input: string | undefined | null): SemVer | null {
  if (!input) return null
  const match = /^v?(\d+)\.(\d+)\.(\d+)/.exec(input.trim())
  if (!match) return null
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    raw: `${match[1]}.${match[2]}.${match[3]}`,
  }
}

export function compareSemVer(a: SemVer, b: SemVer): number {
  if (a.major !== b.major) return a.major - b.major
  if (a.minor !== b.minor) return a.minor - b.minor
  return a.patch - b.patch
}

/** `npm:tailwindcss@^4` and friends, whose range is everything after the `@`. */
const NPM_ALIAS = /^npm:(?:@[^/]+\/)?[^@]+@(.+)$/

/**
 * The normalized semver range a `package.json` spec denotes, or `null` when
 * the spec names no version at all.
 *
 * `null` covers `catalog:`, `workspace:*`, `file:`, `link:`, git and tarball
 * URLs, dist tags such as `latest`, and the wildcards `*`, `x`, and `""`. The
 * wildcards are the subtle ones: they are valid ranges that every version
 * satisfies, so treating them as an answer would pass a Tailwind v4 check on a
 * project that pinned nothing. Not knowing is the honest answer, and the
 * callers have a message for it.
 */
export function rangeOfSpec(spec: string | undefined | null): string | null {
  if (!spec) return null
  const trimmed = spec.trim()
  if (trimmed === '') return null

  const alias = NPM_ALIAS.exec(trimmed)
  if (alias?.[1]) return rangeOfSpec(alias[1])

  const range = validRange(trimmed)
  if (range === null || range === '*') return null
  return range
}

/** The declared range for a dependency, from either dependency block. */
export function declaredVersion(project: ProjectContext, name: string): string | null {
  const pkg = project.packageJson
  if (!pkg) return null
  return pkg.dependencies?.[name] ?? pkg.devDependencies?.[name] ?? null
}

/**
 * The version actually installed in `node_modules`, which is the only version
 * that tells you what is running. A declared `^16.0.0` says nothing about
 * whether the project is on a patched release.
 */
export function installedVersion(project: ProjectContext, name: string): SemVer | null {
  const roots = [project.root, project.workspaceRoot].filter((r): r is string => r !== null)
  for (const root of roots) {
    const path = join(root, 'node_modules', name, 'package.json')
    if (!existsSync(path)) continue
    try {
      const parsed = JSON.parse(readFileSync(path, 'utf8')) as { version?: string }
      const version = parseSemVer(parsed.version)
      if (version) return version
    } catch {
      // Fall through to the next root.
    }
  }
  return null
}

/**
 * What is known about one dependency.
 *
 * `installed` is a fact, read from the tree that will actually run. `declared`
 * is a range and nothing more. `unresolved` means the spec names no version,
 * and `absent` means the package is not there at all.
 *
 * The last two used to be one message, which is how a `catalog:` entry and an
 * uninstalled project both got told to migrate off Tailwind v3.
 */
export type DependencyStatus =
  | { readonly state: 'installed'; readonly version: SemVer; readonly spec: string | null }
  | { readonly state: 'declared'; readonly range: string; readonly spec: string }
  | { readonly state: 'unresolved'; readonly spec: string }
  | { readonly state: 'absent' }

export function resolveDependency(project: ProjectContext, name: string): DependencyStatus {
  const spec = declaredVersion(project, name)

  const installed = installedVersion(project, name)
  if (installed) return { state: 'installed', version: installed, spec }

  if (spec === null) return { state: 'absent' }

  const range = rangeOfSpec(spec)
  if (range) return { state: 'declared', range, spec }

  return { state: 'unresolved', spec }
}

/**
 * Whether this dependency can meet `floor`, expressed as a semver range such
 * as `>=4.0.0`.
 *
 * `null` when there is no evidence either way, and `null` is never a failure.
 * An installed version is tested with `satisfies`. A declared range is tested
 * with `intersects`, so it fails only when no version the range permits could
 * ever meet the floor. See the header for why those are different questions.
 */
export function meetsFloor(status: DependencyStatus, floor: string): boolean | null {
  switch (status.state) {
    case 'installed':
      return satisfies(status.version.raw, floor)
    case 'declared':
      try {
        return intersects(status.range, floor)
      } catch {
        return null
      }
    case 'unresolved':
    case 'absent':
      return null
  }
}

/**
 * How to name a version in output, so a range is never called an installed
 * version.
 *
 * The distinction is the whole point of `DependencyStatus`, and it is lost the
 * moment one call site prints a range as though it were a version on disk.
 */
export function describeStatus(name: string, status: DependencyStatus): string {
  switch (status.state) {
    case 'installed':
      return `${name} ${status.version.raw}`
    case 'declared':
      return `${name} ${status.spec} (declared in package.json, not installed)`
    case 'unresolved':
      return `${name} ${status.spec}`
    case 'absent':
      return name
  }
}

/**
 * All published versions for a package, so we can find the newest patch on the
 * installed major and minor line rather than telling a Next 15 user to jump to
 * 16 for a security fix.
 */
export async function fetchVersions(name: string, timeoutMs = 6000): Promise<string[] | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.signal.aborted || controller.abort(), timeoutMs)
  try {
    const response = await fetch(`https://registry.npmjs.org/${name}`, {
      signal: controller.signal,
      // The abbreviated document is a fraction of the size and carries versions.
      headers: { accept: 'application/vnd.npm.install-v1+json' },
    })
    if (!response.ok) return null
    const body = (await response.json()) as { versions?: Record<string, unknown> }
    return Object.keys(body.versions ?? {})
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/** The newest stable patch published on the same major and minor line. */
export function newestPatchOnLine(versions: readonly string[], installed: SemVer): SemVer | null {
  let best: SemVer | null = null
  for (const raw of versions) {
    if (/-/.test(raw)) continue // ignore canary, rc, and beta
    const parsed = parseSemVer(raw)
    if (!parsed) continue
    if (parsed.major !== installed.major || parsed.minor !== installed.minor) continue
    if (!best || compareSemVer(parsed, best) > 0) best = parsed
  }
  return best
}
