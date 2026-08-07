import Link from 'next/link'

import { authorPath } from '@/lib/config'
import { readingTime } from '@/lib/reading-time'
import type { Post } from '@/lib/types'
import { cn } from '@/lib/utils'

/**
 * A post's attribution, split across two components in one file.
 *
 * `<Byline>` is who wrote it and how long it takes to read, directly under the
 * H1. `<PostDates>` is when it was published and last updated, at the foot of
 * the article. They live together because they share the date formatters and
 * because they are two halves of one contract with the JSON-LD graph, and
 * splitting them across files is how one of them would come to format a date
 * differently from the other.
 *
 * WHY THE DATES ARE NOT IN THE BYLINE
 * A byline answers who wrote this and how much of my time it wants. The dates
 * answer whether it is still current, which is a question about the article
 * rather than about starting it, and the foot of the page is where the article
 * is over. Author, date, updated date, and reading time was four facts and three
 * bullets on one 14px line, which is a line a reader skips whole.
 *
 * Nothing machine-readable moved with them. `datePublished` and `dateModified`
 * are still in the graph, still in the HTML, and still in the first response
 * byte, and both still carry `<time dateTime>`.
 *
 * Google asks for a visible date that is labelled ("Published February 4, 2019",
 * "Last updated: Feb 14, 2019") and does not require a position on the page.
 * `<PostDates>` renders exactly that shape. Google News is the one surface that
 * does ask for the date between the headline and the article text, so a site
 * that publishes to News should render `<PostDates>` in the header instead. It
 * takes a `className` and no position of its own for that reason.
 * @see https://developers.google.com/search/docs/appearance/publication-dates
 *
 * WHAT IS LOAD BEARING
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
 * - Dropping `<PostDates>` from the route leaves the graph claiming a
 *   publication date the page never shows.
 * - Adding `'use client'` removes either component from the static HTML shell.
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

/**
 * Who wrote it, and how long it takes to read. Directly under the H1.
 *
 * The reading time carries no icon. A clock beside the words "min read" draws
 * the noun the sentence already contains, and at 14px it draws it badly: it
 * costs an element, an import, and a moment of a reader deciding whether it
 * means anything other than what the words beside it mean.
 *
 * The separating bullet is `aria-hidden`, so the line announces as "By Jane Doe,
 * 7 min read" rather than reading punctuation aloud.
 */
export function Byline({ post, className }: BylineProps) {
  const { minutes } = readingTime(post.body)

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

      <span>{`${minutes} min read`}</span>
    </p>
  )
}

export interface PostDatesProps {
  readonly post: Post
  readonly className?: string | undefined
}

/**
 * When it was published, and when it was last touched.
 *
 * WHERE IT RENDERS
 * `app/blog/[slug]/page.tsx`, under a hairline at the foot of the article body,
 * below the sources list and above the share controls. That position is the
 * colophon slot: the article has ended, and this is the provenance of what was
 * just read rather than one more thing to do next.
 *
 * Both dates are labelled in words. "July 28, 2026 · Updated August 5, 2026"
 * makes a reader infer that the first date is the publication date;
 * "Published July 28, 2026" tells them, and it is the shape Google's byline date
 * documentation asks for. The label costs nine characters on a line that has
 * room for them, which the byline under the H1 did not.
 */
export function PostDates({ post, className }: PostDatesProps) {
  const isUpdated = post.dateModified !== post.datePublished

  return (
    <p
      className={cn(
        'text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-sm',
        className,
      )}
    >
      {/* Raw ISO value with its offset in `dateTime`. Never a formatted string. */}
      <span>
        {'Published '}
        <time dateTime={post.datePublished}>{formatPostDate(post.datePublished)}</time>
      </span>

      {isUpdated ? (
        <>
          <span aria-hidden="true">·</span>
          <span>
            {'Updated '}
            <time dateTime={post.dateModified}>{formatPostDate(post.dateModified)}</time>
          </span>
        </>
      ) : null}
    </p>
  )
}
