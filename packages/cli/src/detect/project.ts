/**
 * Everything the CLI needs to know about the project it was pointed at.
 *
 * Detection happens once and is passed down. Two commands that each work out
 * where `app/` lives will eventually disagree, and the case where they disagree
 * is a `src/` layout, which is exactly the layout where a wrong answer writes a
 * file into a directory Next.js never reads.
 *
 * @see https://docs.agentblog.dev/installation
 */
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

import { firstExisting, readJson } from '../util/fs.ts'
import type { PackageManager } from '../util/exec.ts'

export interface PackageJson {
  readonly name?: string
  readonly dependencies?: Record<string, string>
  readonly devDependencies?: Record<string, string>
  readonly workspaces?: string[] | { packages?: string[] }
}

export interface ComponentsJson {
  readonly aliases?: Record<string, string>
  readonly tailwind?: { css?: string; baseColor?: string }
  readonly registries?: Record<string, unknown>
}

export interface ProjectContext {
  /** Absolute path to the project we are patching. */
  readonly root: string
  /** `true` when routes live under `src/app` rather than `app`. */
  readonly usesSrcDir: boolean
  /** `src` or `.`, the prefix for app-relative paths. */
  readonly appPrefix: string
  readonly packageManager: PackageManager
  readonly packageJson: PackageJson | null
  readonly componentsJson: ComponentsJson | null
  /** Absolute path to `next.config.*`, or `null`. */
  readonly nextConfigPath: string | null
  /** Absolute path to the root layout, or `null`. */
  readonly rootLayoutPath: string | null
  /** Absolute path to `agentblog.config.ts`, or `null`. */
  readonly agentblogConfigPath: string | null
  /** The workspace root when this project sits inside a monorepo, else `null`. */
  readonly workspaceRoot: string | null
}

const NEXT_CONFIG_NAMES = [
  'next.config.ts',
  'next.config.mjs',
  'next.config.js',
  'next.config.mts',
  'next.config.cjs',
]

export function detectProject(cwd: string): ProjectContext {
  const root = resolve(cwd)
  const usesSrcDir = existsSync(join(root, 'src', 'app'))
  const appPrefix = usesSrcDir ? 'src' : '.'

  const rootLayoutPath = firstExisting(root, [
    join(usesSrcDir ? 'src' : '', 'app', 'layout.tsx'),
    join(usesSrcDir ? 'src' : '', 'app', 'layout.jsx'),
    join(usesSrcDir ? 'src' : '', 'app', 'layout.js'),
  ])

  return {
    root,
    usesSrcDir,
    appPrefix,
    packageManager: detectPackageManager(root),
    packageJson: readJson<PackageJson>(join(root, 'package.json')),
    componentsJson: readJson<ComponentsJson>(join(root, 'components.json')),
    nextConfigPath: firstExisting(root, NEXT_CONFIG_NAMES),
    rootLayoutPath,
    agentblogConfigPath: firstExisting(root, ['agentblog.config.ts', 'agentblog.config.js']),
    workspaceRoot: findWorkspaceRoot(root),
  }
}

/** Resolve a project relative path, honouring a `src/` layout for app paths. */
export function appPath(project: ProjectContext, relativePath: string): string {
  const prefixed = project.usesSrcDir ? join('src', relativePath) : relativePath
  return join(project.root, prefixed)
}

/** The same path as a string suitable for output, always forward slashes. */
export function appPathLabel(project: ProjectContext, relativePath: string): string {
  return project.usesSrcDir ? `src/${relativePath}` : relativePath
}

function detectPackageManager(root: string): PackageManager {
  if (existsSync(join(root, 'pnpm-lock.yaml'))) return 'pnpm'
  if (existsSync(join(root, 'bun.lock')) || existsSync(join(root, 'bun.lockb'))) return 'bun'
  if (existsSync(join(root, 'yarn.lock'))) return 'yarn'
  if (existsSync(join(root, 'package-lock.json'))) return 'npm'

  const fromUserAgent = process.env['npm_config_user_agent'] ?? ''
  if (fromUserAgent.startsWith('pnpm')) return 'pnpm'
  if (fromUserAgent.startsWith('yarn')) return 'yarn'
  if (fromUserAgent.startsWith('bun')) return 'bun'
  return 'npm'
}

/**
 * Walk up looking for a workspace marker.
 *
 * We report the monorepo rather than trying to be clever about it. shadcn
 * resolves aliases and targets for a workspace already, so the useful thing the
 * CLI can add is telling the user which root received `agentblog.config.ts`,
 * `AGENTS.md`, and the skills.
 *
 * @see https://docs.agentblog.dev/guides/monorepo
 */
function findWorkspaceRoot(start: string): string | null {
  let current = start
  for (let depth = 0; depth < 8; depth += 1) {
    const parent = dirname(current)
    if (parent === current) return null
    if (existsSync(join(parent, 'pnpm-workspace.yaml'))) return parent
    if (existsSync(join(parent, 'turbo.json'))) return parent
    const pkg = readJson<PackageJson>(join(parent, 'package.json'))
    if (pkg?.workspaces) return parent
    current = parent
  }
  return null
}
