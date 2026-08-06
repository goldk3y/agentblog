import Link from 'next/link'

import { postPath } from '@/lib/config'
import type { PublishedPost } from '@/lib/types'
import { cn } from '@/lib/utils'

import { formatPostDate } from './byline'

/**
 * The internal-link block at the foot of a post.
 *
 * WHERE IT RENDERS
 * `app/blog/[slug]/page.tsx`, after the author bio and before the single CTA.
 * The posts come from `getRelatedPosts(post, limit)`, which returns the author's
 * explicit `relatedPosts` frontmatter first and fills the remainder with shared
 * category, then shared tags, then recency.
 *
 * WHY IT IS SHAPED THIS WAY
 * This is the block that keeps the hub-and-spoke link graph connected, so it is
 * deliberately the least clever component in the set: a heading, a list, and
 * plain server-rendered anchors. No cards, no images, no carousel.
 *
 *   - Descriptive anchor text. Each link's text is the target post's title,
 *     which names the entity being linked to. "Read more" and "click here" are
 *     the anti-pattern: they give the crawler nothing about the destination.
 *   - Every post needs at least one inbound internal link from its cluster, and
 *     this block is how the previous posts in the cluster provide it. A post
 *     with zero inbound links is an orphan, and the pre-publish check fails on
 *     that rather than shipping it.
 *   - A carousel would hide half the links behind a JavaScript interaction,
 *     which removes them from the link graph for any crawler that does not run
 *     JavaScript. That is why the list is flat and complete.
 *
 * @see https://agentblog.dev/docs/geo-playbook*
 * WHAT BREAKS IF YOU CHANGE IT
 * - Adding `'use client'` or lazy-mounting the list drops these internal links
 *   out of the crawlable graph, and the whole cluster loses its interlinking.
 * - Replacing the titles with generic anchor text throws away the topical signal
 *   that makes internal links worth having.
 */
export interface RelatedPostsProps {
  readonly posts: readonly PublishedPost[]
  /** Section heading. Keep it descriptive; it is a real H2 in the outline. */
  readonly title?: string | undefined
  readonly className?: string | undefined
}

export function RelatedPosts({ posts, title, className }: RelatedPostsProps) {
  // Rendering an empty "Related posts" heading tells a reader the section is
  // broken and gives an extractor a heading with no content underneath it.
  if (posts.length === 0) return null

  const headingId = 'related-posts'

  return (
    <section aria-labelledby={headingId} className={cn('not-prose', className)}>
      <h2 id={headingId} className="text-foreground text-xl font-semibold">
        {title ?? 'Related posts'}
      </h2>

      <ul className="mt-4 list-none space-y-4 p-0">
        {posts.map((post) => (
          <li key={post.slug} className="border-border border-b pb-4 last:border-b-0 last:pb-0">
            <h3 className="text-base font-medium">
              <Link
                href={postPath(post.slug)}
                className="text-foreground focus-visible:ring-ring rounded-sm underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
              >
                {post.title}
              </Link>
            </h3>
            <p className="text-muted-foreground mt-1 text-sm">{post.description}</p>
            <p className="text-muted-foreground mt-1 text-xs">
              <time dateTime={post.datePublished}>{formatPostDate(post.datePublished)}</time>
            </p>
          </li>
        ))}
      </ul>
    </section>
  )
}
