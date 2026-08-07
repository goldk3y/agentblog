/**
 * The files `init` writes, and the merge rules for each of them.
 *
 * Split out of `init.ts` so the command reads as a sequence (refuse, prompt,
 * install, patch, verify) and the per-file merge semantics live in one place.
 *
 * Every rule here is from the merge table in the AgentBlog docs:
 * `htmlLimitedBots` unions and never replaces, `metadataBase` and
 * `title.template` are written only when absent, the AGENTS.md block is replaced
 * between its markers, and the IndexNow key is generated only when both
 * `public/*.txt` and `INDEXNOW_KEY` are absent. Together they are what make a
 * second `init` a byte for byte no-op.
 *
 * @see https://docs.agentblog.dev/installation
 */
import { randomBytes } from 'node:crypto'
import { basename } from 'node:path'

import {
  AGENTS_FRAGMENT_PATH,
  buildAgentsBlock,
  INDEXNOW_KEY_COMMENT,
  REVALIDATE_SECRET_COMMENT,
} from '../constants.ts'
import { appPathLabel, type ProjectContext } from '../detect/project.ts'
import { contentPathsOf } from '../detect/routes.ts'
import { patchAgentblogConfig } from '../patchers/agentblog-config.ts'
import { placeBlock, resolveAgentsBlock } from '../patchers/agents-md.ts'
import { patchComponentsJson } from '../patchers/components-json.ts'
import { envValue, hasNonEmptyEnvValue, upsertEnv } from '../patchers/env.ts'
import { addAgentBlogIgnore, isAgentBlogIgnored } from '../patchers/gitignore.ts'
import { patchNextConfig } from '../patchers/next-config.ts'
import { patchRootLayout } from '../patchers/root-layout.ts'
import { type PatchSet } from '../patchers/patch-set.ts'
import { exists, join, readFile, toPosixRelative, walk } from '../util/fs.ts'
import { generateIndexNowKey, isIndexNowKeyFile } from '../util/indexnow.ts'

export interface InitAnswers {
  readonly source: string
  readonly siteUrl: string
  readonly brand: string
  readonly author: string
  /** Where `@agentblog/*` resolves from. `--registry` overrides the default. */
  readonly registryUrl: string
}

/**
 * Register the `@agentblog` namespace, before `shadcn add` needs it.
 *
 * Separate from `patchConfigFiles` because it has to be written and applied
 * BEFORE the install step, not after: `shadcn add @agentblog/blog` reads
 * `components.json` to resolve the prefix, so a patch queued alongside
 * `next.config.ts` would land a minute too late and the install it exists to
 * enable would already have failed.
 */
export function patchComponentsRegistry(
  project: ProjectContext,
  registryUrl: string,
  patches: PatchSet,
  changes: string[],
  declined: string[],
): void {
  const path = join(project.root, 'components.json')
  const source = readFile(path)
  if (source === null) {
    declined.push('components.json was not found, so the @agentblog registry was not registered.')
    return
  }
  const result = patchComponentsJson(source, registryUrl)
  changes.push(...result.changes)
  declined.push(...result.declined)
  patches.add({
    path,
    label: 'components.json',
    before: source,
    after: result.source,
    reason: 'register the @agentblog registry namespace so `shadcn add` can resolve it',
  })
}

/**
 * Only generate a key when both `public/*.txt` and `INDEXNOW_KEY` are absent.
 * A second key means the first one stops verifying and every submission 403s.
 */
export function generateIndexNowKeyIfAbsent(project: ProjectContext): string | null {
  // A key present with an empty value counts as absent. `shadcn add` writes the
  // `envVars` declared on a registry item as bare `KEY=` lines, so a registry-only
  // install always leaves both of our keys declared and empty. Treating that as
  // "already configured" is how the publish webhook ends up permanently unable to
  // authenticate anything.
  const envKey = ['.env', '.env.local']
    .map((name) => envValue(readFile(join(project.root, name)), 'INDEXNOW_KEY'))
    .find((value): value is string => value !== null)
  if (envKey) return null

  // Evidence, never the file name. `llms-full.txt` and `security.txt` both fit
  // the key name shape, and reading either as a key meant IndexNow was silently
  // never configured. See `isIndexNowKeyFile`.
  const publicDir = join(project.root, 'public')
  const existingFile = walk(publicDir, { extensions: ['.txt'], maxDepth: 1 }).find((path) =>
    isIndexNowKeyFile({ fileName: basename(path), contents: readFile(path), envKey }),
  )
  if (existingFile) return null
  return generateIndexNowKey()
}

/**
 * The publish webhook's shared secret, generated when it is missing or empty.
 *
 * Without it `app/api/publish/route.ts` refuses every request, which means the
 * whole publish path (revalidate the routes, then submit to IndexNow) is dead on
 * arrival for anyone who installed from the registry and never set it by hand.
 * A 32 byte hex value is long enough that guessing it is not a concern and short
 * enough to paste into a deployment's environment settings.
 */
export function generateRevalidateSecretIfAbsent(project: ProjectContext): string | null {
  const present = ['.env', '.env.local'].some((name) =>
    hasNonEmptyEnvValue(readFile(join(project.root, name)), 'AGENTBLOG_REVALIDATE_SECRET'),
  )
  return present ? null : randomBytes(32).toString('hex')
}

export function patchConfigFiles(
  project: ProjectContext,
  answers: InitAnswers,
  indexNowKey: string | null,
  revalidateSecret: string | null,
  patches: PatchSet,
  changes: string[],
  declined: string[],
): void {
  if (project.nextConfigPath) {
    const source = readFile(project.nextConfigPath)
    if (source !== null) {
      const label = toPosixRelative(project.root, project.nextConfigPath)
      const result = patchNextConfig(source, label, { contentPaths: contentPathsOf(project) })
      changes.push(...result.changes)
      declined.push(...result.declined)
      patches.add({
        path: project.nextConfigPath,
        label,
        before: source,
        after: result.source,
        reason: 'htmlLimitedBots union, image qualities',
      })
    }
  }

  if (project.rootLayoutPath) {
    const source = readFile(project.rootLayoutPath)
    if (source !== null) {
      const label = toPosixRelative(project.root, project.rootLayoutPath)
      const result = patchRootLayout(source, label, {
        siteUrl: answers.siteUrl,
        brandName: answers.brand,
        feedPath: '/feed.xml',
      })
      changes.push(...result.changes)
      declined.push(...result.declined)
      patches.add({
        path: project.rootLayoutPath,
        label,
        before: source,
        after: result.source,
        reason: 'metadataBase, title.template, RSS alternates',
      })
    }
  }

  const configPath = project.agentblogConfigPath ?? join(project.root, 'agentblog.config.ts')
  const configSource = readFile(configPath)
  if (configSource !== null) {
    const values = indexNowKey
      ? {
          siteUrl: answers.siteUrl,
          brandName: answers.brand,
          defaultAuthor: answers.author,
          indexnowKey: indexNowKey,
        }
      : { siteUrl: answers.siteUrl, brandName: answers.brand, defaultAuthor: answers.author }
    const result = patchAgentblogConfig(configSource, 'agentblog.config.ts', values)
    changes.push(...result.changes)
    declined.push(...result.declined)
    patches.add({
      path: configPath,
      label: 'agentblog.config.ts',
      before: configSource,
      after: result.source,
      reason: 'site URL, brand, default author',
    })
  } else {
    declined.push(
      'agentblog.config.ts was not found, so no values were filled in. It ships with @agentblog/blog-core.',
    )
  }

  if (indexNowKey) {
    patches.add({
      path: join(project.root, 'public', `${indexNowKey}.txt`),
      label: `public/${indexNowKey}.txt`,
      before: null,
      after: `${indexNowKey}\n`,
      reason: 'IndexNow key file, served from the domain root',
    })
    changes.push(`indexnow: generated a key and wrote public/${indexNowKey}.txt`)
  }

  /*
   * Both secrets go to `.env.local`, never to `.env`.
   *
   * The registry item declares them as `envVars`, and the shadcn schema documents
   * that those are written to `.env`, which projects commonly commit. Writing the
   * real values to `.env.local` instead is the difference between a secret that
   * lives on the machine and a secret that lives in the repository history.
   * Doctor check 13 reports it if either one ends up somewhere git tracks.
   */
  const secretEntries: { key: string; value: string; comment: string }[] = []
  if (indexNowKey) {
    secretEntries.push({
      key: 'INDEXNOW_KEY',
      value: indexNowKey,
      comment: INDEXNOW_KEY_COMMENT,
    })
  }
  if (revalidateSecret) {
    secretEntries.push({
      key: 'AGENTBLOG_REVALIDATE_SECRET',
      value: revalidateSecret,
      comment: REVALIDATE_SECRET_COMMENT,
    })
    changes.push('publish webhook: generated AGENTBLOG_REVALIDATE_SECRET')
  }

  if (secretEntries.length > 0) {
    const envPath = join(project.root, '.env.local')
    patches.add({
      path: envPath,
      label: '.env.local',
      before: readFile(envPath),
      after: (current) => upsertEnv(current, secretEntries).source,
      reason: 'secrets, in .env.local rather than .env because .env is commonly committed',
    })
  }

  /*
   * `.agentblog/` holds a byte for byte copy of every file we modify, and
   * `.env.local` is one of them, so an install on a project that already had
   * secrets copies them into a directory `git add -A` will stage. The standard
   * Next.js `.gitignore` covers it by accident (`.env*.local` matches at any
   * depth); a path anchored `/.env.local` does not.
   */
  if (!isAgentBlogIgnored(project.root, readFile(join(project.root, '.gitignore')))) {
    const gitignorePath = join(project.root, '.gitignore')
    const gitignoreSource = readFile(gitignorePath)
    const result = addAgentBlogIgnore(gitignoreSource)
    if (result.changes.length > 0) {
      changes.push(...result.changes)
      patches.add({
        path: gitignorePath,
        label: '.gitignore',
        before: gitignoreSource,
        after: result.source,
        reason: 'keep .agentblog/ out of git, because its backups contain .env.local',
      })
    }
  }

  const agentsPath = join(project.root, 'AGENTS.md')
  const agentsSource = readFile(agentsPath)
  const agents = placeBlock(
    agentsSource,
    resolveAgentsBlock(
      readFile(join(project.root, AGENTS_FRAGMENT_PATH)),
      buildAgentsBlock({
        contentDir: appPathLabel(project, 'content/blog'),
        skillCommand: '/write-blog-post',
      }),
    ),
  )
  changes.push(...agents.changes)
  declined.push(...agents.declined)
  patches.add({
    path: agentsPath,
    label: 'AGENTS.md',
    before: agentsSource,
    after: agents.source,
    reason: 'the AgentBlog rules block, strictly after the Next.js managed region',
  })
}

/** Project relative paths of everything the install produced, for the manifest. */
export function installedFiles(project: ProjectContext): string[] {
  const roots = ['app/blog', 'app/authors', 'components/blog', 'components/mdx', 'lib']
  return roots
    .flatMap((relative) => {
      const dir = project.usesSrcDir
        ? join(project.root, 'src', relative)
        : join(project.root, relative)
      return exists(dir) ? walk(dir) : []
    })
    .map((path) => toPosixRelative(project.root, path))
}
