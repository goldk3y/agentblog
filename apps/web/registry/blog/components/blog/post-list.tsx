import type { PublishedPost } from '@/lib/types'
import { cn } from '@/lib/utils'

import { PostCard } from './post-card'

/**
 * A grid of `PostCard`s.
 *
 * WHERE IT RENDERS
 * The blog index (`app/blog/page.tsx`), category hubs, tag pages, and author
 * pages. Every list surface in the block goes through this component so they all
 * paginate, wrap, and empty out the same way.
 *
 * WHY IT IS SHAPED THIS WAY
 * A real `<ul>` of real `<li>`s, not a bag of divs. Screen readers announce the
 * item count, and a parser gets an unambiguous collection boundary instead of
 * having to infer one from class names. The grid lives on the `<ul>`, which is
 * why each `<li>` needs no wrapper of its own.
 *
 * The empty state is text, not an illustration: "No posts published yet." by
 * default, which is what every route currently gets because none of them
 * override it. A hub with no posts is a page a crawler may still fetch, and a
 * plain sentence is a truthful thin-content signal, which is better than an
 * empty grid that reads as broken. Pass `emptyMessage` when a route can say
 * something more specific ("No posts in this category yet.").
 *
 * WHAT BREAKS IF YOU CHANGE IT
 * - Adding `'use client'` (or infinite scroll, or a "load more" button) takes
 *   every post link out of the crawlable HTML. Infinite scroll in particular is
 *   a listed extraction killer: the links below the fold never exist in the
 *   markup at all. Pagination stays server rendered, with real hrefs.
 *   @see https://docs.agentblog.dev/concepts/geo-playbook* - Turning the `<ul>` into a `<div>` loses the list semantics that make the
 *   count announceable.
 */
export interface PostListProps {
  readonly posts: readonly PublishedPost[]
  /**
   * Preload the first card's hero image.
   *
   * Off by default, and it should stay off unless you have confirmed that the
   * first card really is the LCP element on that route. A route that also has
   * its own hero above the list already spent its one preload.
   * @see https://docs.agentblog.dev/reference/files
   */
  readonly priorityFirst?: boolean | undefined
  /** Heading level used by each card title. @see `PostCard` for why it matters. */
  readonly headingLevel?: 2 | 3 | undefined
  /** Text shown when `posts` is empty. */
  readonly emptyMessage?: string | undefined
  readonly className?: string | undefined
}

export function PostList({
  posts,
  priorityFirst,
  headingLevel,
  emptyMessage,
  className,
}: PostListProps) {
  if (posts.length === 0) {
    // A bare sentence on an empty page reads as a rendering failure. A dashed
    // panel reads as a state the design anticipated, which is the difference
    // between "this is broken" and "there is nothing here yet".
    return (
      <div
        className={cn(
          'border-border text-muted-foreground rounded-xl border border-dashed px-6 py-16 text-center text-sm',
          className,
        )}
      >
        {emptyMessage ?? 'No posts published yet.'}
      </div>
    )
  }

  return (
    /*
     * `auto-rows-fr` is what makes every card in a row the same height. Without
     * it each grid row sizes to its tallest card and the shorter ones sit at the
     * top of their track, so the meta line at the foot of each card lands at a
     * different height and the grid stops reading as a grid. `h-full` on the
     * card is the other half of the same fix.
     *
     * Three columns need the wide rail to be worth having. On
     * `--agentblog-measure` this same grid produced 224px columns, which is
     * narrower than the title inside them.
     */
    <ul
      className={cn(
        'grid list-none auto-rows-fr grid-cols-1 gap-6 p-0 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8',
        className,
      )}
    >
      {posts.map((post, index) => (
        <li key={post.slug} className="flex">
          <PostCard
            post={post}
            priority={priorityFirst === true && index === 0}
            headingLevel={headingLevel}
            className="w-full"
          />
        </li>
      ))}
    </ul>
  )
}
