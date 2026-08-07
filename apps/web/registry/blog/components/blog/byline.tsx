import Link from 'next/link'

import { authorPath } from '@/lib/config'
import { readingTime } from '@/lib/reading-time'
import type { Post } from '@/lib/types'
import { cn } from '@/lib/utils'

import { ClockIcon } from './icons'

/**
 * The attribution line that sits directly under the H1 on a post.
 *
 * WHERE IT RENDERS
 * Inside the `<header>` of `<article>` on `app/blog/[slug]/page.tsx`, as the
 * last element of that header: H1, then the answer capsule, then this. The
 * capsule goes above the byline deliberately, because it is the passage an
 * answer engine lifts and it has to survive chunk truncation.
 *
 * WHY IT IS SHAPED THIS WAY
 * This block is an E-E-A-T surface and a structured-data mirror at the same
 * time, so three details are load bearing rather than cosmetic:
 *
 *   - `rel="author"` on the author link. It is the machine-readable statement
 *     that this URL identifies the person who wrote the post, and it is what
 *     ties the visible byline to the `Person` node in the JSON-LD graph.
 *   - `<time dateTime>` on both dates, carrying the raw ISO value with its UTC
 *     offset. The visible string is localized for humans; the `dateTime`
 *     attribute is what parsers read, and it must be byte-identical to
 *     `datePublished` / `dateModified` in the JSON-LD.
 *   - The "Updated" date renders only when it differs from the published date.
 *     A post that shows "Updated" on the day it shipped teaches readers and
 *     freshness heuristics alike to ignore the signal.
 *
 * NO AVATAR HERE, ON PURPOSE.
 * The author photo lives in `author-bio.tsx`. Keeping it out of the byline means
 * this component pulls in no image pipeline, needs no `images.remotePatterns`
 * entry for a remote avatar host, and stays pure text in the first response
 * byte, which is the part of the page an extraction engine reads first.
 *
 * WHAT BREAKS IF YOU CHANGE IT
 * - Dropping `rel="author"` breaks the visible-to-structured-data link that
 *   `lib/schema.ts` assumes when it emits `Person`.
 * - Formatting the date into `dateTime` (rather than passing the raw ISO value)
 *   strips the UTC offset, and Google then reinterprets the timestamp in
 *   Googlebot's own timezone, which can move a post across a day boundary.
 * - Adding `'use client'` removes the byline from the static HTML shell.
 *
 * @see https://docs.agentblog.dev/concepts/geo-playbook
 */

/**
 * The one place a post date becomes a human-readable string.
 *
 * `post-card.tsx`, `related-posts.tsx`, and `app/not-found.tsx` import this so
 * every surface prints the same date the same way. The formatter is pinned to
 * `en-US` and UTC rather than left to the runtime default, because the build
 * machine's locale is not something a consumer controls and a date that renders
 * differently on CI than on a laptop is a diff that never settles.
 *
 * Change the locale here and it changes everywhere, which is the point.
 */
const dateFormatter = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  timeZone: 'UTC',
})

export function formatPostDate(iso: string): string {
  return dateFormatter.format(new Date(iso))
}

/**
 * The same date, abbreviated, for places where it shares a line with other
 * metadata: post cards and the related-posts list.
 *
 * Both formatters exist because the choice is about space, not about locale.
 * `timeZone: 'UTC'` is repeated here for the same reason it appears above: an
 * ISO date with no time component is parsed as midnight UTC, and formatting
 * that in a negative-offset local zone renders the previous day. A card and its
 * article would then print different dates for the same post.
 *
 * The `dateTime` attribute on the `<time>` element is never abbreviated. That is
 * the value a crawler reads, and it stays the full ISO string in both places.
 */
const shortDateFormatter = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
})

export function formatPostDateShort(iso: string): string {
  return shortDateFormatter.format(new Date(iso))
}

export interface BylineProps {
  readonly post: Post
  readonly className?: string | undefined
}

export function Byline({ post, className }: BylineProps) {
  const { minutes } = readingTime(post.body)
  const isUpdated = post.dateModified !== post.datePublished

  return (
    <p
      className={cn(
        'text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-sm',
        className,
      )}
    >
      <span>
        {'By '}
        <Link
          href={authorPath(post.author.slug)}
          rel="author"
          className="text-foreground focus-visible:ring-ring rounded-sm font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
        >
          {post.author.name}
        </Link>
      </span>

      <span aria-hidden="true">·</span>

      {/* Raw ISO value with its offset. Never a formatted string. */}
      <time dateTime={post.datePublished}>{formatPostDate(post.datePublished)}</time>

      {isUpdated ? (
        <>
          <span aria-hidden="true">·</span>
          <span>
            {'Updated '}
            <time dateTime={post.dateModified}>{formatPostDate(post.dateModified)}</time>
          </span>
        </>
      ) : null}

      <span aria-hidden="true">·</span>

      <span className="inline-flex items-center gap-1">
        <ClockIcon className="size-3.5" aria-hidden="true" />
        {`${minutes} min read`}
      </span>
    </p>
  )
}
