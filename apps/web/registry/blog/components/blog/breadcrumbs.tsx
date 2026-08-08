import Link from 'next/link'

import { cn } from '@/lib/utils'

import { ChevronRightIcon } from './icons'

/**
 * The visible breadcrumb trail: Blog, then where in the blog you are.
 *
 * There is no "Home" crumb, and that is a decision rather than an oversight.
 * Google's breadcrumb documentation states it outright: "It is not required to
 * include a breadcrumb ListItem for the top level path (your site's domain or
 * host name)." Every SERP breadcrumb is already prefixed with the domain, so a
 * "Home" crumb spends the first item of the trail restating the thing the reader
 * can see in the address bar. The trail starts at the first level that tells
 * somebody something.
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
 *   - The current page is the crumb with no `path`, not the last one. That crumb
 *     is text rather than a link and carries `aria-current="page"`, because a
 *     link to the page you are already on is noise for a reader and a
 *     self-referential edge in the link graph. The two are not the same test: a
 *     post's trail ends at its category hub, which is a real destination and has
 *     to stay clickable, and marking it `aria-current="page"` would tell a screen
 *     reader user they were on the hub. Give the current page a crumb with no
 *     `path` when you want one, and leave it off when the page above is the
 *     honest end of the trail.
 *   - The chevrons are `aria-hidden` and live in their own element, so the
 *     accessible name of each crumb stays clean.
 *
 * WHAT BREAKS IF YOU CHANGE IT
 * - Dropping the trail from the page while leaving the `BreadcrumbList` in the
 *   JSON-LD is the exact "markup for invisible content" case that gets
 *   structured data ignored or penalized.
 * - Giving the current page a `path` renders it as a link and removes
 *   `aria-current="page"`, which is the only signal telling assistive tech where
 *   in the trail the reader is.
 * - Passing an absolute URL rather than a path. See `BreadcrumbTrailItem.path`.
 *
 * @see https://docs.agentblog.dev/concepts/geo-playbook
 */
export interface BreadcrumbTrailItem {
  readonly name: string
  /**
   * Destination, as a root-relative path. Omit it to mark this crumb as the
   * current page, which is what renders it as plain text with
   * `aria-current="page"`.
   *
   * A path, never an absolute URL. Use the path helpers from `@/lib/config`
   * (`blogPath`, `categoryPath`, `postPath`, and so on) rather than their `*Url`
   * counterparts. `buildBreadcrumb` absolutizes the same value for the JSON-LD,
   * which is where an absolute URL is required; here it would be a bug. An
   * `href` whose origin is not the origin the page is being served from makes
   * `next/link` fall back to a plain document navigation, so on a preview
   * deployment or a local dev server every crumb leaves the deployment for the
   * production domain.
   */
  readonly path?: string | undefined
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
          // No destination means this crumb is the page the reader is on.
          const isCurrent = item.path === undefined

          return (
            <li key={`${item.name}-${index}`} className="inline-flex items-center gap-1.5">
              {isCurrent ? (
                <span aria-current="page" className="text-foreground font-medium">
                  {item.name}
                </span>
              ) : (
                <Link
                  href={item.path}
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
