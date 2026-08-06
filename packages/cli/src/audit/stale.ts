/**
 * `audit --stale`: which posts are old, ranked by how much it matters.
 *
 * Freshness is a measurable signal rather than a hunch. The ranking is by
 * inbound internal links, not by age alone, because a stale post that six other
 * posts point at is carrying internal authority to a page that says something
 * outdated. Age tells you what changed; inbound links tell you what it costs.
 *
 * The paid counterpart ranks by search impression decay. The free version has to
 * exist first, or there is nothing to charge for the scheduled version of.
 *
 * @see https://agentblog.dev/docs/agent-layer
 */
import { internalLinksIn, type PostFile } from './post.ts'

export interface StaleEntry {
  readonly slug: string
  readonly days: number
  readonly inbound: number
  readonly dateModified: string
}

export function findStale(
  posts: readonly PostFile[],
  days: number,
  now = Date.now(),
): StaleEntry[] {
  const inboundCounts = new Map<string, number>()
  for (const post of posts) {
    for (const target of internalLinksIn(post)) {
      if (target === post.slug) continue
      inboundCounts.set(target, (inboundCounts.get(target) ?? 0) + 1)
    }
  }

  return posts
    .flatMap((post) => {
      const raw = post.data['dateModified']
      if (typeof raw !== 'string') return []
      const parsed = Date.parse(raw)
      if (Number.isNaN(parsed)) return []
      const age = Math.floor((now - parsed) / 86_400_000)
      if (age < days) return []
      return [
        {
          slug: post.slug,
          days: age,
          inbound: inboundCounts.get(post.slug) ?? 0,
          dateModified: raw,
        },
      ]
    })
    .sort((a, b) => b.inbound - a.inbound || b.days - a.days)
}
