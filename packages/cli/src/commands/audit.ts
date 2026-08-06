/**
 * `agentblog audit`: the pre-publish gate, the staleness report, and the crawler
 * log reader.
 *
 * Three modes in one command because they answer three stages of the same
 * question. `audit [slug]` asks whether a post is ready to publish. `--stale`
 * asks which published posts have stopped being true. `--crawlers` asks whether
 * anything is reading them.
 *
 * Exit code is non-zero on an error finding so this can gate a merge.
 *
 * @see https://agentblog.dev/docs/geo-playbookthe AgentBlog docs and 7.3
 */
import { join } from 'node:path'

import { auditPost, loadPosts } from '../audit/post.ts'
import { parseCrawlerLog } from '../audit/crawlers.ts'
import { findStale } from '../audit/stale.ts'
import { detectProject } from '../detect/project.ts'
import { readRosters } from '../detect/roster.ts'
import { Reporter } from '../report/reporter.ts'
import { exists } from '../util/fs.ts'
import { bullet, heading, note, report, say, setSilent, step, writeRaw } from '../util/log.ts'
import { track } from '../util/telemetry.ts'

const EMPTY_SUMMARY = {
  passed: 0,
  errors: 0,
  warnings: 0,
  infos: 0,
  skipped: 0,
  fixable: 0,
} as const

/** The one document a `--json` run writes. */
function emit(payload: unknown): void {
  writeRaw(`${JSON.stringify(payload, null, 2)}\n`)
}

export interface AuditOptions {
  readonly dir?: string
  readonly stale?: boolean
  readonly days?: string
  readonly crawlers?: string
  readonly verbose?: boolean
  readonly json?: boolean
  readonly telemetry?: boolean
  readonly cwd?: string
}

export function auditCommand(slug: string | undefined, options: AuditOptions): void {
  // `--json` silences every human facing line before anything can print, so the
  // document on stdout is the only thing a CI step has to parse.
  const json = options.json ?? false
  setSilent(json)

  const project = detectProject(options.cwd ?? process.cwd())
  const dir = resolveContentDir(project.root, options.dir, project.usesSrcDir)

  if (options.crawlers) {
    auditCrawlers(options.crawlers, json)
    return
  }

  if (!exists(dir)) {
    report(
      'error',
      `No content directory at ${dir}.`,
      'Pass --dir if your posts live somewhere else.',
    )
    if (json) emit({ error: `No content directory at ${dir}.`, dir })
    process.exitCode = 1
    return
  }

  const posts = loadPosts(dir)
  if (posts.length === 0) {
    note(`No posts found in ${dir}.`)
    if (json) emit({ dir, posts: 0, groups: [], summary: EMPTY_SUMMARY })
    return
  }

  if (options.stale) {
    auditStale(posts, Number(options.days ?? '90'), json)
    return
  }

  const targets = slug ? posts.filter((post) => post.slug === slug) : posts
  if (targets.length === 0) {
    report('error', `No post with slug "${slug}" in ${dir}.`, 'Check the file name.')
    if (json) emit({ error: `No post with slug "${slug}" in ${dir}.`, dir })
    process.exitCode = 1
    return
  }

  step(`Auditing ${targets.length} post(s) in ${dir}`)
  // The rosters are read once for the whole run. Every post is validated
  // against the same author and category records the build will use, so a post
  // that passes here cannot fail the build on an unknown slug.
  const rosters = readRosters(project, dir)
  const reporter = new Reporter()
  for (const post of targets) auditPost(post, posts, rosters, reporter)

  reporter.print({ verbose: options.verbose ?? false })
  reporter.summary()
  if (json) emit({ dir, posts: targets.length, ...reporter.toJson() })

  track(
    'audit',
    { posts: targets.length, errors: reporter.count('error') },
    options.telemetry === false,
  )
  process.exitCode = reporter.count('error') > 0 ? 1 : 0
}

function resolveContentDir(root: string, dir: string | undefined, usesSrcDir: boolean): string {
  if (dir) return join(root, dir)
  const candidate = join(root, usesSrcDir ? 'src/content/blog' : 'content/blog')
  return exists(candidate) ? candidate : join(root, 'content/blog')
}

/**
 * Ranked by inbound internal links rather than by age alone. A stale post that
 * six other posts point at is sending internal authority to something that is no
 * longer true, and that costs more than an older post nothing links to.
 */
function auditStale(posts: ReturnType<typeof loadPosts>, days: number, json: boolean): void {
  const stale = findStale(posts, days)
  heading(`Posts not updated in ${days} days`)

  if (stale.length === 0) {
    say(`Nothing older than ${days} days. ${posts.length} post(s) checked.`)
    if (json) emit({ days, checked: posts.length, stale: [] })
    return
  }

  for (const entry of stale) {
    bullet(
      `${entry.slug}: ${entry.days} days old, ${entry.inbound} inbound internal link(s), last modified ${entry.dateModified.slice(0, 10)}`,
    )
  }
  say()
  note(`${stale.length} of ${posts.length} posts are past the ${days} day threshold.`)
  note('Refresh the ones with inbound links first. Only bump dateModified if the content changed.')
  if (json) emit({ days, checked: posts.length, stale })
  process.exitCode = 1
}

/**
 * Counts include anything sending a crawler user agent, verified or not. IP
 * verification against each operator's published ranges is a separate feature,
 * and claiming it here without doing it would be the same class of quiet
 * inaccuracy this tool exists to catch.
 */
function auditCrawlers(logPath: string, json: boolean): void {
  const result = parseCrawlerLog(logPath)
  if (!result) {
    report('error', `Could not read ${logPath}.`, 'Pass the path to a server or CDN access log.')
    if (json) emit({ error: `Could not read ${logPath}.`, log: logPath })
    process.exitCode = 1
    return
  }
  if (json) emit({ log: logPath, ...result })

  heading(`Crawler hits in ${logPath}`)
  say(
    `${result.linesRead} lines read${result.undated > 0 ? `, ${result.undated} with no readable date` : ''}`,
  )

  if (result.bots.length === 0) {
    say()
    report(
      'error',
      'No crawler hits at all in this log. If the site is live and indexed, something above the origin is blocking them.',
      'Run npx agentblog doctor --url <your-url> to test what each crawler receives.',
    )
    process.exitCode = 1
    return
  }

  for (const bot of result.bots) {
    say()
    say(`${bot.bot} (${bot.operator}): ${bot.total} hits, last seen ${bot.lastSeen ?? 'unknown'}`)
    for (const week of bot.weeks.slice(-8)) {
      bullet(`week of ${week.week}: ${week.hits}`)
    }
  }

  const googlebot = result.bots.find((bot) => bot.bot === 'Googlebot')
  if (!googlebot) {
    say()
    report(
      'warning',
      'Googlebot does not appear in this log at all.',
      'Check the CDN bot rules. Multi-purpose crawlers get blocked by AI training blocks.',
    )
  }
  say()
  note(
    'These counts include anything sending a crawler user agent. There is no IP verification here.',
  )
}
