/**
 * Dependency version detection, plus the runtime lookup of the Next.js patch
 * floor.
 *
 * Check 9 in the doctor list refuses to hardcode a minimum Next.js version, and
 * that refusal is the interesting part of this file. The May 2026 security
 * release (16.2.6 and 15.5.18, thirteen advisories, none of them fixable at the
 * WAF layer) was superseded within eight weeks. Any literal we ship is stale
 * before our next minor, so the floor is resolved at the moment the check runs
 * from the npm registry's published version list, and the check degrades to a
 * skip when the network is unavailable rather than inventing an answer.
 *
 * What it reads is the version list and nothing else. It does not consult any
 * security advisory feed, so it proves "there is a newer patch on your line",
 * not "your version has a known vulnerability". Those are different claims and
 * only the first one is ours to make.
 *
 * @see https://agentblog.dev/docs/cli-reference check 9
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import type { ProjectContext } from './project.ts'

export interface SemVer {
  readonly major: number
  readonly minor: number
  readonly patch: number
  readonly raw: string
}

export function parseSemVer(input: string | undefined | null): SemVer | null {
  if (!input) return null
  const match = /(\d+)\.(\d+)\.(\d+)/.exec(input)
  if (!match) return null
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    raw: match[0],
  }
}

export function compareSemVer(a: SemVer, b: SemVer): number {
  if (a.major !== b.major) return a.major - b.major
  if (a.minor !== b.minor) return a.minor - b.minor
  return a.patch - b.patch
}

/** The declared range for a dependency, from either dependency block. */
export function declaredVersion(project: ProjectContext, name: string): string | null {
  const pkg = project.packageJson
  if (!pkg) return null
  return pkg.dependencies?.[name] ?? pkg.devDependencies?.[name] ?? null
}

/**
 * The version actually installed in `node_modules`, which is the only version
 * that tells you anything. A declared `^16.0.0` says nothing about whether the
 * project is running a patched release.
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

/** Installed version if we can find it, otherwise whatever package.json declares. */
export function resolvedVersion(project: ProjectContext, name: string): SemVer | null {
  return installedVersion(project, name) ?? parseSemVer(declaredVersion(project, name))
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
