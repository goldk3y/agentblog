/**
 * `agentblog ping <slug>`: revalidate the route and submit it to IndexNow.
 *
 * This command exists mostly to make two silent failures loud. IndexNow returns
 * `403` when the key file is missing from the domain root and `422` when the URL
 * does not match the host the key authorizes, and both look exactly like success
 * to a caller that only checks for a thrown error. So every response code is
 * printed with what it means.
 *
 * The revalidate call covers `/sitemap.xml` and `/feed.xml` as well as the post
 * and index routes. Both are cached route handlers, so a publish that skips them
 * leaves the new post missing from the two files crawlers use to find it.
 *
 * ===========================================================================
 * EXIT CODES, AND WHY "NOTHING WAS CONFIGURED" IS AN ERROR
 * ===========================================================================
 * This command runs as a publish step, so its exit code is the only thing CI
 * reads. It used to print `ERROR  The publish webhook returned 405.` and exit
 * 0, which leaves a pipeline green while revalidation failed. With no
 * credentials at all it emitted two warnings, submitted nothing, and still
 * exited 0: a publish step that silently does nothing, forever, and reports
 * success every time.
 *
 * So the rule is: a step the caller asked for and that did not happen is an
 * error, not a warning. A missing `AGENTBLOG_REVALIDATE_SECRET` is an error
 * unless `--skip-revalidate` was passed; a missing `INDEXNOW_KEY` is an error
 * unless `--skip-indexnow` was passed. An explicitly skipped step is not
 * reported at all, because that one was a decision rather than an accident.
 * `doctor` and `audit` already exit non-zero on an error finding, and this is
 * the same contract.
 *
 * @see https://agentblog.dev/docs/agent-layer
 */
import { join } from 'node:path'

import { detectProject } from '../detect/project.ts'
import { parseEnv } from '../patchers/env.ts'
import { readFile } from '../util/fs.ts'
import { explain, submit } from '../util/indexnow.ts'
import { bullet, note, report, say, step, success } from '../util/log.ts'

export interface PingOptions {
  readonly siteUrl?: string
  readonly key?: string
  readonly secret?: string
  readonly skipRevalidate?: boolean
  readonly skipIndexnow?: boolean
  readonly cwd?: string
}

export async function pingCommand(slug: string, options: PingOptions): Promise<void> {
  const project = detectProject(options.cwd ?? process.cwd())
  const env = readEnv(project.root)
  // Every error finding raises this. It is the whole reason the command exists
  // in a pipeline, so it is tracked in one place rather than at each report.
  let failed = false

  const siteUrl = (options.siteUrl ?? readSiteUrl(project.root) ?? '').replace(/\/+$/, '')
  if (!siteUrl) {
    report('error', 'No site URL found.', 'Pass --site-url, or set siteUrl in agentblog.config.ts.')
    process.exitCode = 1
    return
  }

  const paths = [`/blog/${slug}`, '/blog', '/sitemap.xml', '/feed.xml']
  const urls = paths.map((path) => `${siteUrl}${path}`)

  if (!options.skipRevalidate) {
    const secret = options.secret ?? env.get('AGENTBLOG_REVALIDATE_SECRET')
    if (!secret) {
      report(
        'error',
        'No AGENTBLOG_REVALIDATE_SECRET, so the routes were NOT revalidated and the new post is not live.',
        'Set it in .env.local, pass --secret, or pass --skip-revalidate if you meant to skip this.',
      )
      failed = true
    } else if (!(await revalidate(siteUrl, secret, paths))) {
      failed = true
    }
  }

  if (options.skipIndexnow) {
    process.exitCode = failed ? 1 : 0
    return
  }

  const key = options.key ?? env.get('INDEXNOW_KEY')
  if (!key) {
    report(
      'error',
      'No INDEXNOW_KEY, so NOTHING was submitted to IndexNow.',
      'Run npx agentblog init, set INDEXNOW_KEY in .env.local, or pass --skip-indexnow if you meant to skip this.',
    )
    process.exitCode = 1
    return
  }

  step(`Submitting ${urls.length} URLs to IndexNow`)
  const host = new URL(siteUrl).host
  const result = await submit({ host, key, keyLocation: `${siteUrl}/${key}.txt`, urls })

  if (result.ok) {
    success(`IndexNow ${result.status}: ${result.meaning}`)
    if (result.status === 202) {
      note('202 means the key has not been verified yet. Confirm the key file is deployed.')
    }
    process.exitCode = failed ? 1 : 0
    return
  }

  report(
    'error',
    `IndexNow ${result.status}: ${result.meaning}`,
    remedyFor(result.status, key, siteUrl),
  )
  process.exitCode = 1
}

/** `true` when the routes were actually revalidated. */
async function revalidate(
  siteUrl: string,
  secret: string,
  paths: readonly string[],
): Promise<boolean> {
  step('Revalidating routes')
  try {
    const response = await fetch(`${siteUrl}/api/publish`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${secret}` },
      body: JSON.stringify({ paths }),
    })
    if (response.ok) {
      success(`Revalidated ${paths.length} routes`)
      for (const path of paths) bullet(path)
      return true
    }
    report(
      'error',
      `The publish webhook returned ${response.status}.`,
      response.status === 401
        ? 'The secret does not match AGENTBLOG_REVALIDATE_SECRET on the deployment.'
        : 'Check the route handler logs.',
    )
  } catch (error) {
    report('error', `Could not reach the publish webhook: ${String(error)}`, 'Check the site URL.')
  }
  say()
  return false
}

function remedyFor(status: number, key: string, siteUrl: string): string {
  if (status === 403)
    return `Confirm ${siteUrl}/${key}.txt is deployed and contains exactly ${key}.`
  if (status === 422)
    return `The key at ${siteUrl}/${key}.txt only authorizes URLs on that host and path.`
  if (status === 429) return 'You are rate limited. Wait, then submit fewer URLs.'
  if (status === 400) return 'The payload was rejected. This is a bug, please report it.'
  return explain(status)
}

function readEnv(root: string): Map<string, string> {
  const merged = new Map<string, string>()
  for (const name of ['.env', '.env.local']) {
    const source = readFile(join(root, name))
    if (source === null) continue
    for (const [key, value] of parseEnv(source)) merged.set(key, value)
  }
  for (const key of ['INDEXNOW_KEY', 'AGENTBLOG_REVALIDATE_SECRET']) {
    const fromProcess = process.env[key]
    if (fromProcess) merged.set(key, fromProcess)
  }
  return merged
}

function readSiteUrl(root: string): string | null {
  const source = readFile(join(root, 'agentblog.config.ts'))
  if (source === null) return null
  const match = /siteUrl\s*:\s*['"`]([^'"`]+)['"`]/.exec(source)?.[1]
  return match && match !== 'https://yourdomain.com' ? match : null
}
