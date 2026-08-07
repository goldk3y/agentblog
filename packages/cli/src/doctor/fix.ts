/**
 * `doctor --fix`: the repairs, as one patch set.
 *
 * Fixes are recomputed from scratch rather than routed from finding ids. Every
 * patcher already unions or declines rather than overwriting, so running them
 * against an already correct file produces identical text and the patch set
 * drops the edit. That is a stronger idempotency guarantee than a dispatch table
 * keyed on finding ids, which has to stay in sync with the checks by hand.
 *
 * @see https://docs.agentblog.dev/installation
 */
import { basename, join } from 'node:path'

import { stripComments } from '@agentblog/checks'

import {
  AGENTBLOG_ENV_KEYS,
  buildAgentsBlock,
  INDEXNOW_KEY_COMMENT,
  movedOutOfComment,
  REVALIDATE_SECRET_COMMENT,
} from '../constants.ts'
import { appPath, appPathLabel, type ProjectContext } from '../detect/project.ts'
import { placeBlock } from '../patchers/agents-md.ts'
import { patchNextConfig } from '../patchers/next-config.ts'
import { patchRobots } from '../patchers/robots.ts'
import { patchRootLayout } from '../patchers/root-layout.ts'
import { envValue, removeEnvKeys, upsertEnv } from '../patchers/env.ts'
import { addAgentBlogIgnore, isAgentBlogIgnored } from '../patchers/gitignore.ts'
import { PatchSet } from '../patchers/patch-set.ts'
import { blockFiles, contentPathsOf, hasPublishRoute } from '../detect/routes.ts'
import { readFile, toPosixRelative, walk } from '../util/fs.ts'
import { isGitIgnored } from '../util/exec.ts'
import { isIndexNowKeyFile, isValidIndexNowKey } from '../util/indexnow.ts'
import { envFilesHoldingSecrets } from './env-checks.ts'
import {
  generateIndexNowKeyIfAbsent,
  generateRevalidateSecretIfAbsent,
} from '../commands/init-patches.ts'

export interface FixResult {
  readonly patches: PatchSet
  readonly changes: string[]
  readonly declined: string[]
}

export function buildFixes(project: ProjectContext): FixResult {
  const patches = new PatchSet()
  const changes: string[] = []
  const declined: string[] = []

  fixNextConfig(project, patches, changes, declined)
  fixRootLayout(project, patches, changes, declined)
  fixRobots(project, patches, changes, declined)
  fixAgentsMd(project, patches, changes, declined)
  fixMissingSecrets(project, patches, changes)
  fixIndexNowKeyFile(project, patches, changes, declined)
  fixSecretLocation(project, patches, changes, declined)
  fixGitignore(project, patches, changes)

  return { patches, changes, declined }
}

/** Check 5. Add the non-production guard to `app/robots.ts` when it has none. */
/**
 * Check 13b. `.agentblog/` holds copies of `.env.local`, so git must not.
 *
 * Append only, and only when git does not already ignore it some other way, so
 * a project with a `.gitignore` that already covers the path gets no diff at
 * all and a second run is a no-op.
 */
function fixGitignore(project: ProjectContext, patches: PatchSet, changes: string[]): void {
  const path = join(project.root, '.gitignore')
  const source = readFile(path)
  if (isAgentBlogIgnored(project.root, source)) return

  const result = addAgentBlogIgnore(source)
  if (result.changes.length === 0) return
  changes.push(...result.changes)
  patches.add({
    path,
    label: '.gitignore',
    before: source,
    after: result.source,
    reason: 'keep .agentblog/ out of git, because its backups contain .env.local',
  })
}

function fixRobots(
  project: ProjectContext,
  patches: PatchSet,
  changes: string[],
  declined: string[],
): void {
  const path = appPath(project, 'app/robots.ts')
  const source = readFile(path)
  if (source === null) return

  const label = appPathLabel(project, 'app/robots.ts')
  const result = patchRobots(source, label)
  changes.push(...result.changes)
  declined.push(...result.declined)
  patches.add({
    path,
    label,
    before: source,
    after: result.source,
    reason: 'the non-production environment guard, so preview deployments are not indexable',
  })
}

/**
 * Check 12. The three states the IndexNow check reports, all repairable.
 *
 * `generateIndexNowKeyIfAbsent` deliberately declines whenever a key file or a
 * non-empty `INDEXNOW_KEY` exists, because generating a second key invalidates
 * the first. Every finding check 12 emits requires exactly that state, so the
 * generator could never repair any of them. These are the repairs that fit:
 * write the key file `INDEXNOW_KEY` says should exist, and correct a file whose
 * contents do not match its own name.
 *
 * The env value wins over the file name. `INDEXNOW_KEY` is what the running
 * application submits, so a file that disagrees with it is the thing that is
 * wrong, and rewriting the env value instead would change what the deployment
 * sends without touching the deployment's own environment.
 */
function fixIndexNowKeyFile(
  project: ProjectContext,
  patches: PatchSet,
  changes: string[],
  declined: string[],
): void {
  const envKey = readEnvIndexNowKey(project.root)
  const usable = envKey && isValidIndexNowKey(envKey) ? envKey : null

  // Only files that prove they are keys. A name-only test claimed `llms-full.txt`
  // and `security.txt`, and this repair then overwrote both with their own base
  // names. See `isIndexNowKeyFile`.
  const publicDir = join(project.root, 'public')
  const keyFiles = walk(publicDir, { extensions: ['.txt'], maxDepth: 1 }).filter((path) =>
    isIndexNowKeyFile({ fileName: basename(path), contents: readFile(path), envKey: usable }),
  )

  // With no `INDEXNOW_KEY` there is nothing authoritative to reconcile against.
  // Every file that reached this point without one already contains exactly its
  // own base name (that is the only evidence that made it a key file), so it is
  // already what IndexNow fetches and compares, and there is nothing to repair.
  if (!usable) return

  const target = join(publicDir, `${usable}.txt`)
  const before = readFile(target)
  if (before !== null && before.trim() === usable) return

  patches.add({
    path: target,
    label: `public/${usable}.txt`,
    before,
    after: `${usable}\n`,
    reason: 'INDEXNOW_KEY needs a key file at the domain root containing exactly that key',
  })
  changes.push(`indexnow: wrote public/${usable}.txt to match INDEXNOW_KEY`)

  const stale = keyFiles.filter((path) => basename(path) !== `${usable}.txt`)
  if (stale.length > 0) {
    declined.push(
      `Another IndexNow key file is still in public/ (${stale
        .map((path) => basename(path))
        .join(
          ', ',
        )}). It was left alone: serving a key you no longer submit is harmless, and deleting a file you may have registered with a search engine is not ours to do.`,
    )
  }
}

/** The first non-empty `INDEXNOW_KEY` across the env files we look at. */
function readEnvIndexNowKey(projectRoot: string): string | null {
  for (const holder of envFilesHoldingSecrets(projectRoot)) {
    const value = envValue(readFile(join(projectRoot, holder.file)), 'INDEXNOW_KEY')
    if (value !== null) return value
  }
  return null
}

function fixNextConfig(
  project: ProjectContext,
  patches: PatchSet,
  changes: string[],
  declined: string[],
): void {
  if (!project.nextConfigPath) {
    declined.push('next.config: no config file found, so nothing was patched.')
    return
  }
  const source = readFile(project.nextConfigPath)
  if (source === null) return

  const result = patchNextConfig(source, toPosixRelative(project.root, project.nextConfigPath), {
    qualities: qualitiesUsedBy(project),
    contentPaths: contentPathsOf(project),
  })
  changes.push(...result.changes)
  declined.push(...result.declined)
  patches.add({
    path: project.nextConfigPath,
    label: toPosixRelative(project.root, project.nextConfigPath),
    before: source,
    after: result.source,
    reason: 'htmlLimitedBots union, image qualities',
  })
}

/** Every explicit `quality={n}` in the installed block, plus the defaults. */
function qualitiesUsedBy(project: ProjectContext): number[] {
  const used = new Set<number>([75, 90])
  for (const path of blockFiles(project)) {
    const source = readFile(path)
    if (source === null) continue
    for (const match of source.matchAll(/quality\s*=\s*\{?\s*(\d+)/g)) used.add(Number(match[1]))
  }
  return [...used]
}

function fixRootLayout(
  project: ProjectContext,
  patches: PatchSet,
  changes: string[],
  declined: string[],
): void {
  if (!project.rootLayoutPath) return

  const values = readConfigValues(project)
  if (!values) {
    declined.push(
      'app/layout: metadataBase needs siteUrl from agentblog.config.ts, which is missing or still a placeholder.',
    )
    return
  }

  const source = readFile(project.rootLayoutPath)
  if (source === null) return

  const result = patchRootLayout(source, toPosixRelative(project.root, project.rootLayoutPath), {
    siteUrl: values.siteUrl,
    brandName: values.brandName,
    feedPath: '/feed.xml',
  })
  changes.push(...result.changes)
  declined.push(...result.declined)
  patches.add({
    path: project.rootLayoutPath,
    label: toPosixRelative(project.root, project.rootLayoutPath),
    before: source,
    after: result.source,
    reason: 'metadataBase, title.template, RSS alternates',
  })
}

/**
 * Read siteUrl and brand name out of the config without executing it.
 *
 * The brand name is read from inside the `brand` block specifically. Taking the
 * first `name:` anywhere in the file meant an adapter option declared earlier
 * won: `source: mdxSource({ name: 'posts', ... })` above `brand: { name: 'Acme' }`
 * put `posts` into the user's `title.template`, on every page of their site.
 *
 * Comments are stripped, string contents are not, because the values being read
 * are string literals.
 */
export function readConfigValues(
  project: ProjectContext,
): { siteUrl: string; brandName: string } | null {
  if (!project.agentblogConfigPath) return null
  const raw = readFile(project.agentblogConfigPath)
  if (raw === null) return null
  const source = stripComments(raw)

  const siteUrl = /siteUrl\s*:\s*['"`]([^'"`]+)['"`]/.exec(source)?.[1]
  const brandName = /name\s*:\s*['"`]([^'"`]+)['"`]/.exec(brandBlock(source) ?? '')?.[1]
  if (!siteUrl || siteUrl === 'https://yourdomain.com') return null
  return { siteUrl, brandName: brandName ?? 'Blog' }
}

/** The text between `brand: {` and its matching brace, or `null`. */
function brandBlock(source: string): string | null {
  const opener = /\bbrand\s*:\s*\{/.exec(source)
  if (!opener) return null

  let depth = 0
  for (let i = opener.index + opener[0].length - 1; i < source.length; i += 1) {
    const ch = source[i]
    if (ch === '{') depth += 1
    else if (ch === '}') {
      depth -= 1
      if (depth === 0) return source.slice(opener.index + opener[0].length, i)
    }
  }
  return null
}

function fixAgentsMd(
  project: ProjectContext,
  patches: PatchSet,
  changes: string[],
  declined: string[],
): void {
  const path = join(project.root, 'AGENTS.md')
  const existing = readFile(path)
  const contentDir = appPathLabel(project, 'content/blog')
  const skillCommand = '/write-blog-post'

  const result = placeBlock(existing, buildAgentsBlock({ contentDir, skillCommand }))
  changes.push(...result.changes)
  declined.push(...result.declined)
  patches.add({
    path,
    label: 'AGENTS.md',
    before: existing,
    after: result.source,
    reason: 'the AgentBlog rules block, placed after the Next.js managed region',
  })
}

/**
 * Move AgentBlog secrets out of any env file git is not ignoring.
 *
 * The keys are copied to `.env.local` and removed from the tracked file. This
 * cannot un-push a secret, so the message says to rotate anything already
 * committed rather than implying the move is a remedy on its own.
 */
function fixSecretLocation(
  project: ProjectContext,
  patches: PatchSet,
  changes: string[],
  declined: string[],
): void {
  for (const holder of envFilesHoldingSecrets(project.root)) {
    if (holder.file === '.env.local') continue
    if (isGitIgnored(project.root, holder.file) !== false) continue

    const sourcePath = join(project.root, holder.file)
    const source = readFile(sourcePath)
    if (source === null) continue

    // Only keys that carry a value move. A bare `INDEXNOW_KEY=` is the
    // placeholder `shadcn add` writes, and relocating one used to produce a
    // change with no content plus advice to rotate a secret that never existed.
    const entries = AGENTBLOG_ENV_KEYS.map((key) => ({ key, value: envValue(source, key) }))
      .filter((entry): entry is { key: (typeof AGENTBLOG_ENV_KEYS)[number]; value: string } =>
        Boolean(entry.value),
      )
      .map((entry) => ({ ...entry, comment: movedOutOfComment(holder.file) }))
    if (entries.length === 0) continue

    // The callback form matters here. `fixMissingSecrets` may already have
    // queued an edit to this same file, and an upsert has to see that edit's
    // result rather than the disk, or one of the two keys is silently dropped.
    const localPath = join(project.root, '.env.local')
    patches.add({
      path: localPath,
      label: '.env.local',
      before: readFile(localPath),
      after: (current) => upsertEnv(current, entries).source,
      reason: 'AgentBlog secrets moved out of a git tracked file',
    })

    const stripped = removeEnvKeys(source, AGENTBLOG_ENV_KEYS)
    patches.add({
      path: sourcePath,
      label: holder.file,
      before: source,
      after: stripped.source,
      reason: 'remove secrets from a file git is not ignoring',
    })
    // Says so when a comment above a removed key was left in place because it
    // is the user's, not ours.
    declined.push(...stripped.declined)

    changes.push(
      `secrets: moved ${entries.map((entry) => entry.key).join(' and ')} from ${holder.file} to .env.local`,
    )
    declined.push(
      `A secret that has already been committed stays in git history. Rotate ${entries
        .map((entry) => entry.key)
        .join(' and ')}.`,
    )
  }
}

/**
 * Generate the two secrets when they are missing or empty.
 *
 * This is what makes the registry-only install path converge. `shadcn add`
 * writes the `envVars` declared on a registry item as bare `KEY=` lines, so a
 * user who never runs `init` has `INDEXNOW_KEY=` and
 * `AGENTBLOG_REVALIDATE_SECRET=` sitting there with no values. The publish route
 * then rejects every request and IndexNow submission is silently disabled, which
 * is a working-looking install with a dead publish path.
 *
 * Values go to `.env.local`. Anything already set is left alone, including a
 * value the user chose, because regenerating an IndexNow key invalidates the
 * `public/<key>.txt` that verifies it.
 */
function fixMissingSecrets(project: ProjectContext, patches: PatchSet, changes: string[]): void {
  const indexNowKey = generateIndexNowKeyIfAbsent(project)
  // Gated on the route, matching check 12's own gate. A secret generated for a
  // webhook that is not installed is a value in someone's env file that no check
  // ever mentioned, which is the class of silent edit this command is meant to
  // be the opposite of.
  const revalidateSecret = hasPublishRoute(project)
    ? generateRevalidateSecretIfAbsent(project)
    : null
  if (!indexNowKey && !revalidateSecret) return

  const entries: { key: string; value: string; comment: string }[] = []

  if (indexNowKey) {
    patches.add({
      path: join(project.root, 'public', `${indexNowKey}.txt`),
      label: `public/${indexNowKey}.txt`,
      before: null,
      after: `${indexNowKey}\n`,
      reason: 'IndexNow key file, served from the domain root',
    })
    entries.push({
      key: 'INDEXNOW_KEY',
      value: indexNowKey,
      comment: INDEXNOW_KEY_COMMENT,
    })
    changes.push(`indexnow: generated a key and wrote public/${indexNowKey}.txt`)
  }

  if (revalidateSecret) {
    entries.push({
      key: 'AGENTBLOG_REVALIDATE_SECRET',
      value: revalidateSecret,
      comment: REVALIDATE_SECRET_COMMENT,
    })
    changes.push('publish webhook: generated AGENTBLOG_REVALIDATE_SECRET')
  }

  const envPath = join(project.root, '.env.local')
  patches.add({
    path: envPath,
    label: '.env.local',
    before: readFile(envPath),
    after: (current) => upsertEnv(current, entries).source,
    reason: 'secrets, in .env.local rather than .env because .env is commonly committed',
  })
}
