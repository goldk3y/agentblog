/**
 * Secrets, the IndexNow key file, route collisions, and runtime floors.
 *
 * Covers doctor checks 12, 13, 13b, 14, 21, and 34.
 *
 * Check 13 exists because of a detail in the registry format. shadcn's `envVars`
 * field writes to `.env`, not `.env.local`, and `.env` is commonly committed. So
 * a registry-only install can put `INDEXNOW_KEY` and
 * `AGENTBLOG_REVALIDATE_SECRET` straight into git without anybody deciding to.
 * We shell out to `git check-ignore` rather than reading `.gitignore` ourselves,
 * because git's own answer accounts for nested ignore files, negations, and the
 * global excludes file, and ours would not.
 *
 * @see https://agentblog.dev/docs/installation
 */
import { basename, join } from 'node:path'

import { AGENTBLOG_ENV_KEYS, BACKUP_DIR } from '../constants.ts'
import { collidingBlogFiles, hasPublishRoute } from '../detect/routes.ts'
import { envValue } from '../patchers/env.ts'
import { AGENTBLOG_IGNORE_ENTRY, isAgentBlogIgnored } from '../patchers/gitignore.ts'
import { isGitIgnored, isGitTracked } from '../util/exec.ts'
import { exists, readFile, walk, toPosixRelative } from '../util/fs.ts'
import { isIndexNowKeyFile } from '../util/indexnow.ts'
import { parseSemVer, resolvedVersion } from '../detect/versions.ts'
import type { DoctorContext } from './context.ts'

const ENV_FILES = ['.env', '.env.local', '.env.production', '.env.development']

export function runEnvChecks(ctx: DoctorContext): void {
  checkIndexNowKey(ctx)
  checkRevalidateSecret(ctx)
  checkSecretsAreIgnored(ctx)
  checkBackupsAreIgnored(ctx)
  checkRouteCollision(ctx)
  checkRuntimeFloors(ctx)
}

/**
 * Every env file that holds at least one AgentBlog key **with a value**.
 *
 * "With a value" is the whole distinction. `shadcn add` writes the `envVars`
 * declared on a registry item as bare `KEY=` lines, so a registry-only install
 * produces `INDEXNOW_KEY=` in `.env` with nothing after the equals sign. Read as
 * a secret, that made check 13 report a committed secret that does not exist,
 * and `--fix` then "moved" an empty value between files and advised rotating it.
 * An empty declaration is a placeholder, not a leak.
 */
export function envFilesHoldingSecrets(
  projectRoot: string,
): { readonly file: string; readonly keys: string[] }[] {
  const out: { file: string; keys: string[] }[] = []
  for (const name of ENV_FILES) {
    const source = readFile(join(projectRoot, name))
    if (source === null) continue
    const keys = AGENTBLOG_ENV_KEYS.filter((key) => envValue(source, key) !== null)
    if (keys.length > 0) out.push({ file: name, keys: [...keys] })
  }
  return out
}

/**
 * Check 12. The key file has to exist at the domain root, has to contain the key
 * and nothing else, and has to match `INDEXNOW_KEY`. A mismatch returns 403 on
 * every submission, and 403 looks exactly like success to a caller that only
 * checks for a thrown error.
 */
function checkIndexNowKey(ctx: DoctorContext): void {
  ctx.reporter.group('IndexNow')

  const envKey = envFilesHoldingSecrets(ctx.project.root)
    .map((entry) => envValue(readFile(join(ctx.project.root, entry.file)), 'INDEXNOW_KEY'))
    .find((value): value is string => value !== null)

  // A `public/*.txt` is a key file on evidence only, never on its name. Both
  // `llms-full.txt` and `security.txt` fit the key name shape, and this check
  // used to raise a hard error telling the user to overwrite either one with its
  // own file name. See `isIndexNowKeyFile`.
  const publicDir = join(ctx.project.root, 'public')
  const keyFiles = walk(publicDir, { extensions: ['.txt'], maxDepth: 1 }).filter((path) =>
    isIndexNowKeyFile({ fileName: basename(path), contents: readFile(path), envKey }),
  )

  if (keyFiles.length === 0 && !envKey) {
    ctx.reporter.skip('12 IndexNow key', 'IndexNow is not configured, which is a valid choice')
    return
  }

  if (!envKey) {
    // Every file here proved itself by containing exactly its own base name,
    // which is the byte comparison IndexNow performs.
    ctx.reporter.pass(`12 ${basename(keyFiles[0]!)} contains exactly its own file name`)
    return
  }

  const named = keyFiles.find((path) => basename(path) === `${envKey}.txt`)
  if (!named) {
    if (keyFiles.length > 0) {
      ctx.reporter.fail('12 IndexNow key', {
        id: 'indexnow-key-mismatch',
        severity: 'error',
        message: `INDEXNOW_KEY does not match ${keyFiles.map((path) => `public/${basename(path)}`).join(', ')}. IndexNow returns 403 for a key it cannot verify at your domain root.`,
        remedy: `npx agentblog doctor --fix writes public/${envKey}.txt to match INDEXNOW_KEY, and leaves the other file in place.`,
        fixable: true,
      })
      return
    }
    ctx.reporter.fail('12 IndexNow key', {
      id: 'indexnow-key-file-missing',
      severity: 'error',
      message:
        'INDEXNOW_KEY is set but public/<key>.txt does not exist. Every submission returns 403.',
      remedy: `npx agentblog doctor --fix writes public/${envKey}.txt containing exactly ${envKey}.`,
      fixable: true,
    })
    return
  }

  if ((readFile(named) ?? '').trim() !== envKey) {
    ctx.reporter.fail('12 IndexNow key', {
      id: 'indexnow-key-file-mismatch',
      severity: 'error',
      message: `public/${envKey}.txt must contain exactly its own file name, and nothing else.`,
      remedy: `npx agentblog doctor --fix rewrites public/${envKey}.txt to contain exactly ${envKey}.`,
      fixable: true,
    })
    return
  }
  ctx.reporter.pass('12 the IndexNow key file matches INDEXNOW_KEY')
}

/**
 * Check 34. The publish webhook's shared secret.
 *
 * It has its own number because `--fix` generates the value, and a repair that
 * no numbered check announces is a repair the user cannot look up before it
 * happens.
 *
 * `shadcn add` writes the `envVars` declared on a registry item as bare `KEY=`
 * lines, so a registry-only install ends up with the key declared and empty. The
 * publish route then rejects every request, and the whole publish path
 * (revalidate the routes, then submit to IndexNow) is dead on arrival. `--fix`
 * generates a value, and this is the finding that says so before it happens
 * rather than after.
 */
function checkRevalidateSecret(ctx: DoctorContext): void {
  ctx.reporter.group('Secrets')

  if (!hasPublishRoute(ctx.project)) {
    ctx.reporter.skip('34 publish secret', 'the publish webhook is not installed')
    return
  }

  const value = ENV_FILES.map((name) =>
    envValue(readFile(join(ctx.project.root, name)), 'AGENTBLOG_REVALIDATE_SECRET'),
  ).find((entry): entry is string => entry !== null)

  if (value) {
    ctx.reporter.pass('34 AGENTBLOG_REVALIDATE_SECRET has a value')
    return
  }
  ctx.reporter.fail('34 publish secret', {
    id: 'revalidate-secret-missing',
    severity: 'error',
    message:
      'AGENTBLOG_REVALIDATE_SECRET is missing or empty, so POST /api/publish rejects every request and nothing on the publish path runs.',
    remedy:
      'npx agentblog doctor --fix generates one into .env.local. Set the same value on your deployment.',
    fixable: true,
  })
}

function checkSecretsAreIgnored(ctx: DoctorContext): void {
  ctx.reporter.group('Secrets')

  // Only keys that carry a value count. `envFilesHoldingSecrets` enforces that,
  // and it is the difference between reporting a real leak and reporting the
  // empty `INDEXNOW_KEY=` line that `shadcn add` writes on every install.
  const holders = envFilesHoldingSecrets(ctx.project.root)
  if (holders.length === 0) {
    ctx.reporter.skip(
      '13 secrets stay out of git',
      'no AgentBlog secret has a value in any env file',
    )
    return
  }

  let reported = false
  for (const holder of holders) {
    const ignored = isGitIgnored(ctx.project.root, holder.file)
    const tracked = isGitTracked(ctx.project.root, holder.file)
    if (ignored === null && tracked === null) {
      ctx.reporter.skip(
        '13 secrets stay out of git',
        'git is unavailable or this is not a repository',
      )
      return
    }
    if (tracked === true || ignored === false) {
      reported = true
      ctx.reporter.fail('13 secrets stay out of git', {
        id: 'secret-in-tracked-file',
        severity: 'error',
        message: `${holder.file} holds ${holder.keys.join(' and ')} and is ${tracked ? 'tracked by git' : 'not ignored by git'}. The shadcn registry writes env vars to .env, which is commonly committed.`,
        remedy: `npx agentblog doctor --fix moves them to .env.local. Rotate any key that has already been pushed.`,
        fixable: true,
      })
    }
  }
  if (!reported) ctx.reporter.pass('13 AgentBlog secrets live in git-ignored files')
}

/**
 * Check 13b. `.agentblog/` holds copies of `.env.local`, so git must not.
 *
 * The backup directory contains a byte for byte copy of every file the CLI
 * modified, and `.env.local` is one of them. So a project with pre-existing
 * secrets ends up with `.agentblog/backup/<stamp>/.env.local` on disk, and
 * `git add -A` stages it. The standard Next.js `.gitignore` covers this by
 * accident, because its `.env*.local` pattern matches at any depth; a path
 * anchored `/.env.local` does not, and neither does no `.gitignore` at all.
 *
 * `init` writes the entry. This check exists because a registry-only install,
 * or a `.gitignore` edited afterwards, never went through `init`.
 */
function checkBackupsAreIgnored(ctx: DoctorContext): void {
  const backupRoot = join(ctx.project.root, BACKUP_DIR)
  if (!exists(backupRoot) && !exists(join(ctx.project.root, '.agentblog'))) {
    ctx.reporter.skip('13b .agentblog stays out of git', 'there is no .agentblog directory yet')
    return
  }

  const source = readFile(join(ctx.project.root, '.gitignore'))
  if (isAgentBlogIgnored(ctx.project.root, source)) {
    ctx.reporter.pass('13b .agentblog/ is ignored by git')
    return
  }

  ctx.reporter.fail('13b .agentblog stays out of git', {
    id: 'agentblog-dir-not-ignored',
    severity: 'error',
    message:
      '.agentblog/ is not ignored by git, and its backups hold a copy of .env.local. A `git add -A` stages your secrets.',
    remedy: `Add ${AGENTBLOG_IGNORE_ENTRY} to .gitignore. npx agentblog doctor --fix does it for you.`,
    fixable: true,
  })
}

/**
 * Check 14. A pre-existing `app/blog/**` that AgentBlog did not write is
 * somebody's blog, and overwriting it is the most expensive mistake this tool
 * could make. `init` refuses; `doctor` reports.
 */
function checkRouteCollision(ctx: DoctorContext): void {
  ctx.reporter.group('Route collision')

  const colliding = collidingBlogFiles(ctx.project)
  if (colliding.length === 0) {
    ctx.reporter.pass('14 no unclaimed files under app/blog')
    return
  }
  ctx.reporter.fail('14 route collision', {
    id: 'route-collision',
    severity: 'warning',
    message: `${colliding.length} file(s) under app/blog are not in the AgentBlog manifest: ${colliding.slice(0, 6).join(', ')}${colliding.length > 6 ? ', and more' : ''}.`,
    remedy:
      'If these are yours, move them before re-running init. If they are ours from an install that predates the manifest, run init --force.',
  })
}

/** Check 21. Node 20.9 and TypeScript 5.1 are hard requirements in Next.js 16. */
function checkRuntimeFloors(ctx: DoctorContext): void {
  ctx.reporter.group('Runtime')

  const node = parseSemVer(process.versions.node)
  if (node && (node.major < 20 || (node.major === 20 && node.minor < 9))) {
    ctx.reporter.fail('21 Node floor', {
      id: 'node-too-old',
      severity: 'error',
      message: `Node ${process.versions.node} is below the 20.9 floor that Next.js 16 requires.`,
      remedy: 'Upgrade to Node 20.9 or newer.',
    })
  } else {
    ctx.reporter.pass(`21 Node ${process.versions.node} meets the 20.9 floor`)
  }

  const typescript = resolvedVersion(ctx.project, 'typescript')
  if (!typescript) {
    ctx.reporter.skip('21 TypeScript floor', 'typescript is not installed in this project')
    return
  }
  if (typescript.major < 5 || (typescript.major === 5 && typescript.minor < 1)) {
    ctx.reporter.fail('21 TypeScript floor', {
      id: 'typescript-too-old',
      severity: 'error',
      message: `TypeScript ${typescript.raw} is below the 5.1 floor that Next.js 16 requires.`,
      remedy: 'Upgrade TypeScript.',
    })
    return
  }
  ctx.reporter.pass(`21 TypeScript ${typescript.raw} meets the 5.1 floor`)
}

/** Used by `--fix` to know where the secrets currently are. */
export function firstTrackedEnvFile(projectRoot: string): string | null {
  for (const holder of envFilesHoldingSecrets(projectRoot)) {
    const ignored = isGitIgnored(projectRoot, holder.file)
    if (ignored === false && exists(join(projectRoot, holder.file))) return holder.file
  }
  return null
}

/** Project relative label for a path, used in fix output. */
export function label(projectRoot: string, path: string): string {
  return toPosixRelative(projectRoot, path)
}
