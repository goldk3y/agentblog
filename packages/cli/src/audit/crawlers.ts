/**
 * `audit --crawlers <logfile>`: is anything even reaching me?
 *
 * This is the diagnostic that pairs with the live crawler check. The live check
 * asks whether a bot *can* read the site; this one answers whether any bot
 * actually *did*, and when it stopped.
 *
 * Parsing is deliberately format tolerant. Combined log format, Vercel's JSON
 * lines, and Cloudflare's log push all differ, and the only field this needs is
 * a user agent plus a timestamp. Rather than a parser per vendor, it looks for a
 * known crawler token anywhere in the line and an ISO date or a common log date
 * anywhere in the same line. Lines it cannot date are counted but not bucketed,
 * and the report says how many those were rather than hiding them.
 *
 * There is no IP verification here. Doing it properly means fetching each
 * operator's published ranges and matching CIDRs per line, which is a real
 * feature rather than a flag on this one, so the report says plainly that these
 * counts include anything spoofing the user agent.
 *
 * @see https://docs.agentblog.dev/guides/measure-ai-traffic
 */
import { AI_CRAWLERS } from '@agentblog/checks'

import { readFile } from '../util/fs.ts'

export interface CrawlerWeek {
  /** ISO week start, as YYYY-MM-DD of the Monday. */
  readonly week: string
  readonly hits: number
}

export interface CrawlerSummary {
  readonly bot: string
  readonly operator: string
  readonly total: number
  readonly weeks: readonly CrawlerWeek[]
  readonly lastSeen: string | null
}

export interface CrawlerReport {
  readonly linesRead: number
  readonly undated: number
  readonly bots: readonly CrawlerSummary[]
}

const ISO_DATE = /(\d{4})-(\d{2})-(\d{2})/
const CLF_DATE = /\[(\d{2})\/([A-Za-z]{3})\/(\d{4})/

const MONTHS: Readonly<Record<string, number>> = {
  Jan: 0,
  Feb: 1,
  Mar: 2,
  Apr: 3,
  May: 4,
  Jun: 5,
  Jul: 6,
  Aug: 7,
  Sep: 8,
  Oct: 9,
  Nov: 10,
  Dec: 11,
}

/** Also count Googlebot, since a log with no Googlebot hits is its own alarm. */
const EXTRA_BOTS = [
  { ua: 'Googlebot', operator: 'Google' },
  { ua: 'Bingbot', operator: 'Microsoft' },
]

export function parseCrawlerLog(path: string): CrawlerReport | null {
  const source = readFile(path)
  if (source === null) return null

  const targets = [
    ...AI_CRAWLERS.map((crawler) => ({ ua: crawler.ua, operator: crawler.operator })),
    ...EXTRA_BOTS,
  ]

  const totals = new Map<string, Map<string, number>>()
  const lastSeen = new Map<string, string>()
  let linesRead = 0
  let undated = 0

  for (const line of source.split(/\r?\n/)) {
    if (line.trim() === '') continue
    linesRead += 1
    const lower = line.toLowerCase()

    for (const target of targets) {
      if (!lower.includes(target.ua.toLowerCase())) continue
      const date = extractDate(line)
      if (!date) {
        undated += 1
        continue
      }
      const week = weekStart(date)
      const buckets = totals.get(target.ua) ?? new Map<string, number>()
      buckets.set(week, (buckets.get(week) ?? 0) + 1)
      totals.set(target.ua, buckets)

      const iso = date.toISOString().slice(0, 10)
      if (!lastSeen.has(target.ua) || iso > lastSeen.get(target.ua)!) lastSeen.set(target.ua, iso)
    }
  }

  const bots: CrawlerSummary[] = targets
    .map((target) => {
      const buckets = totals.get(target.ua) ?? new Map<string, number>()
      const weeks = [...buckets.entries()]
        .map(([week, hits]) => ({ week, hits }))
        .sort((a, b) => a.week.localeCompare(b.week))
      return {
        bot: target.ua,
        operator: target.operator,
        total: weeks.reduce((sum, entry) => sum + entry.hits, 0),
        weeks,
        lastSeen: lastSeen.get(target.ua) ?? null,
      }
    })
    .filter((summary) => summary.total > 0)
    .sort((a, b) => b.total - a.total)

  return { linesRead, undated, bots }
}

function extractDate(line: string): Date | null {
  const iso = ISO_DATE.exec(line)
  if (iso) {
    const date = new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])))
    return Number.isNaN(date.getTime()) ? null : date
  }
  const clf = CLF_DATE.exec(line)
  if (clf) {
    const month = MONTHS[clf[2]!]
    if (month === undefined) return null
    return new Date(Date.UTC(Number(clf[3]), month, Number(clf[1])))
  }
  return null
}

/** The Monday of the week containing `date`, as YYYY-MM-DD. */
function weekStart(date: Date): string {
  const copy = new Date(date.getTime())
  const day = copy.getUTCDay()
  const offset = day === 0 ? 6 : day - 1
  copy.setUTCDate(copy.getUTCDate() - offset)
  return copy.toISOString().slice(0, 10)
}
