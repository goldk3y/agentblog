import Link from 'next/link'

import { postPath } from '@/lib/config'
import type { PublishedPost } from '@/lib/types'
import { cn } from '@/lib/utils'

import { formatPostDateShort } from './byline'
import { CLUSTER_GAP, SECTION_HEADING } from './type-scale'

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
 * @see https://docs.agentblog.dev/concepts/geo-playbook*
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
    /*
     * A list, not a second card grid. The cards on the index are the primary
     * presentation of a post and this is a footnote to the article you just
     * finished, so it gets the tertiary treatment: rules instead of borders,
     * a body-size title instead of a heading-size one, and no surface at all.
     * Repeating `PostCard` here would give the foot of every article three more
     * objects with exactly the weight of the thing a reader came for.
     */
    <section aria-labelledby={headingId} className={cn('not-prose', CLUSTER_GAP, className)}>
      <h2 id={headingId} className={SECTION_HEADING}>
        {title ?? 'Related posts'}
      </h2>

      <ul className="border-border list-none border-t p-0">
        {posts.map((post) => (
          <li key={post.slug} className="border-border border-b">
            <Link
              href={postPath(post.slug)}
              className="hover:bg-accent/50 focus-visible:ring-ring group -mx-3 block rounded-lg px-3 py-4 transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              <h3 className="text-foreground text-base font-medium text-pretty">{post.title}</h3>
              <p className="text-muted-foreground mt-1.5 line-clamp-2 text-sm leading-relaxed text-pretty">
                {post.description}
              </p>
              <p className="text-muted-foreground mt-2 text-xs">
                <time dateTime={post.datePublished}>{formatPostDateShort(post.datePublished)}</time>
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
