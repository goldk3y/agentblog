import Link from 'next/link'

import { cn } from '@/lib/utils'

import { ChevronRightIcon } from './icons'

/**
 * The visible breadcrumb trail: Home, Blog, Post.
 *
 * WHERE IT RENDERS
 * Above the H1 on the post route, on category hubs, on tag pages, and on author
 * pages. It is the first thing a block route renders, which means it is the
 * first thing inside the `<main>` your root layout supplies. The block does not
 * render `<main>` itself; see the landmark contract at the top of
 * `app/blog/layout.tsx`, and note that this nav is one of the two the skip link
 * described there exists to bypass.
 *
 * ⚠️ THIS COMPONENT HAS A TWIN, AND THEY MUST AGREE.
 * `lib/schema.ts` emits a `BreadcrumbList` into the JSON-LD graph from the same
 * trail. Google's structured data policy requires that marked-up content be
 * visible on the page, so a `BreadcrumbList` whose items do not match this nav
 * is a policy violation, not a cosmetic mismatch. Build the trail array once in
 * the route and pass the same array to both. Never assemble it twice.
 *
 * WHY IT IS SHAPED THIS WAY
 *   - A real `<nav aria-label="Breadcrumb">`. The label is what distinguishes
 *     this landmark from the site nav for a screen reader user cycling
 *     landmarks. There is no `role="navigation"` because the element already is
 *     one.
 *   - An ordered list, because the order is the meaning. An unordered list says
 *     these items are interchangeable, and they are not.
 *   - The last crumb is the current page, so it is text rather than a link and
 *     carries `aria-current="page"`. A link to the page you are already on is
 *     noise for a reader and a self-referential edge in the link graph.
 *   - The chevrons are `aria-hidden` and live in their own element, so the
 *     accessible name of each crumb stays clean.
 *
 * WHAT BREAKS IF YOU CHANGE IT
 * - Dropping the trail from the page while leaving the `BreadcrumbList` in the
 *   JSON-LD is the exact "markup for invisible content" case that gets
 *   structured data ignored or penalized.
 * - Making the last crumb a link removes `aria-current="page"`, which is the
 *   only signal telling assistive tech where in the trail the reader is.
 *
 * @see https://docs.agentblog.dev/concepts/geo-playbook
 */
export interface BreadcrumbTrailItem {
  readonly name: string
  /**
   * Destination. Omit on the final crumb, which is the current page.
   *
   * Use the URL helpers from `@/lib/config` (`postUrl`, `categoryUrl`, and so
   * on) to build this. They are the only place the block decides URL shape, so
   * the visible trail, the JSON-LD, the sitemap, and the canonical all stay in
   * step by construction.
   */
  readonly href?: string | undefined
}

export interface BreadcrumbsProps {
  readonly trail: readonly BreadcrumbTrailItem[]
  readonly className?: string | undefined
}

export function Breadcrumbs({ trail, className }: BreadcrumbsProps) {
  if (trail.length === 0) return null

  const lastIndex = trail.length - 1

  return (
    <nav aria-label="Breadcrumb" className={cn('not-prose', className)}>
      <ol className="text-muted-foreground flex list-none flex-wrap items-center gap-1.5 p-0 text-sm">
        {trail.map((item, index) => {
          const isLast = index === lastIndex

          return (
            <li key={`${item.name}-${index}`} className="inline-flex items-center gap-1.5">
              {isLast || item.href === undefined ? (
                <span
                  {...(isLast ? { 'aria-current': 'page' as const } : {})}
                  className={cn(isLast && 'text-foreground font-medium')}
                >
                  {item.name}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className="hover:text-foreground focus-visible:ring-ring rounded-sm underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
                >
                  {item.name}
                </Link>
              )}

              {isLast ? null : (
                <ChevronRightIcon className="size-3.5 shrink-0" aria-hidden="true" />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
