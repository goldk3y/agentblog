/**
 * Route detection: what AgentBlog wrote, what was already there, and what the
 * registry silently failed to write.
 *
 * That last one is the reason this file exists. A `registry:page` item is
 * framework gated: in a project where shadcn does not detect Next.js it installs
 * **zero files, silently, with exit code 0**. Nothing in the install output
 * hints at it. Checking that the route files actually landed on disk is the only
 * thing that catches it, which makes a four line existence check one of the
 * highest value checks in the product.
 *
 * @see BUILD-SPEC section 12, the AgentBlog docs
 */
import { join } from 'node:path'

import { AGENTBLOG_BLOG_FILES, MANIFEST_PATH, REQUIRED_ROUTE_FILES } from '../constants.ts'
import {
  exists,
  readFile,
  readJson,
  toPosixRelative,
  walk,
  writeFileEnsuringDir,
} from '../util/fs.ts'
import { appPath, appPathLabel, type ProjectContext } from './project.ts'

export interface InstallManifest {
  /** ISO timestamp of the install that wrote this manifest. */
  readonly installedAt: string
  readonly cliVersion: string
  /** Project relative paths AgentBlog is responsible for. */
  readonly files: readonly string[]
  /** Registry items requested at install time. */
  readonly items: readonly string[]
  readonly contentDir: string
}

export function readManifest(project: ProjectContext): InstallManifest | null {
  return readJson<InstallManifest>(join(project.root, MANIFEST_PATH))
}

export function writeManifest(project: ProjectContext, manifest: InstallManifest): void {
  writeFileEnsuringDir(join(project.root, MANIFEST_PATH), `${JSON.stringify(manifest, null, 2)}\n`)
}

/** Route files the install should have produced, with their presence. */
export function routeFileStatus(
  project: ProjectContext,
): { readonly label: string; readonly present: boolean }[] {
  return REQUIRED_ROUTE_FILES.map((relativePath) => ({
    label: appPathLabel(project, relativePath),
    present: exists(appPath(project, relativePath)),
  }))
}

/**
 * Files under `app/blog/**` that AgentBlog did not write.
 *
 * `init` refuses when this is non-empty, because overwriting somebody's existing
 * blog is the single most expensive mistake this tool could make. `--force`
 * proceeds, and the message names every conflicting path rather than a count, so
 * the user can judge for themselves.
 */
export function collidingBlogFiles(project: ProjectContext): string[] {
  const blogDir = appPath(project, join('app', 'blog'))
  if (!exists(blogDir)) return []

  /*
   * A registry-only install (`shadcn add @agentblog/blog`) writes the route
   * files and no manifest, because the shadcn CLI has no concept of one. Falling
   * back to the shipped file list is what stops `doctor` from reporting a
   * collision between AgentBlog and AgentBlog on the documented install path.
   */
  const manifest = readManifest(project)
  const ours = new Set<string>([
    ...(manifest?.files ?? []),
    // The shipped list is relative to the app directory, so a `src/` layout
    // needs the prefix applied or every file we wrote reads as a collision.
    ...AGENTBLOG_BLOG_FILES.map((path) => appPathLabel(project, path)),
  ])

  return walk(blogDir)
    .map((absolute) => toPosixRelative(project.root, absolute))
    .filter((relativePath) => !ours.has(relativePath))
    .sort()
}

/**
 * Is the publish webhook installed?
 *
 * One predicate, two callers, on purpose. Check 12's secret finding and the
 * `--fix` that generates the secret must agree about when the secret matters,
 * or `--fix` writes a value nothing announced or the check demands a value
 * `--fix` never writes. Either way the user is told one thing and shown another.
 */
export function hasPublishRoute(project: ProjectContext): boolean {
  return exists(appPath(project, join('app', 'api', 'publish', 'route.ts')))
}

/** Every file in the installed block, used by the code level doctor checks. */
export function blockFiles(project: ProjectContext): string[] {
  const roots = [
    appPath(project, join('app', 'blog')),
    appPath(project, join('app', 'authors')),
    appPath(project, join('components', 'blog')),
    appPath(project, join('components', 'mdx')),
    appPath(project, 'lib'),
  ]
  return roots.flatMap((dir) => walk(dir, { extensions: ['.ts', '.tsx'] }))
}

/**
 * The content directory this project reads posts from, relative to the root.
 *
 * Read from `agentblog.config.ts` textually rather than by executing it, for the
 * same reason every other reader in this package does: running a user's config
 * means running their code, and the CLI has no business doing that.
 *
 * Returns `null` when there is no directory to declare, which is the correct
 * answer for a content source that reads nothing off disk. A database-backed
 * source has no files for Turbopack to trace.
 */
export function contentDirOf(project: ProjectContext): string | null {
  const source = readFile(join(project.root, 'agentblog.config.ts'))
  if (source === null) return null

  const match = /\bdir\s*:\s*['"`]([^'"`]+)['"`]/.exec(source)
  const dir = match?.[1]?.trim()
  if (!dir) return null

  // A path that climbs out of the project cannot be declared safely, and one
  // that is absolute is not portable to the machine that runs the build.
  if (dir.startsWith('..') || dir.startsWith('/')) return null

  return dir.replace(/^\.\//, '').replace(/\/+$/, '')
}
