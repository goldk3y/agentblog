import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { categoryPath } from '@/lib/config'
import type { Category } from '@/lib/types'
import { cn } from '@/lib/utils'

/**
 * The category filter row.
 *
 * WHERE IT RENDERS
 * Under the H1 on the blog index and on every category hub, so a reader landing
 * on one hub can reach the others without going back to the index.
 *
 * WHY IT IS SHAPED THIS WAY
 * Categories are indexable hub pages, which makes this row part of the site's
 * internal link graph rather than a UI filter. Three consequences:
 *
 *   - Real `<a href>` per category, always. Not a client-side filter, not a
 *     select that pushes to the router. Every hub has to be reachable by
 *     following a link, or it never enters the crawl.
 *   - A `<nav aria-label="Categories">` wrapping an unordered list. Categories
 *     have no meaningful order, so `<ul>` is correct here where breadcrumbs need
 *     `<ol>`.
 *   - The active pill still renders as a link to itself but carries
 *     `aria-current="page"`. Keeping the anchor keeps the row's shape stable
 *     across pages; `aria-current` is what tells a screen reader which hub the
 *     reader is on.
 *
 * @see https://docs.agentblog.dev/concepts/geo-playbook*
 * WHERE A SHADCN PRIMITIVE DID NOT FIT CLEANLY
 * `Badge` supports `asChild` in current shadcn, which would let the anchor *be*
 * the badge. This component wraps instead: `<Link><Badge/></Link>`. A consumer
 * who customized `badge.tsx` before `asChild` existed would otherwise get an
 * unknown `asChild` attribute spread onto a DOM node, and inheriting the user's
 * existing component is the whole point of the block. The focus ring therefore
 * lives on the anchor, which is the focusable element anyway.
 *
 * WHAT BREAKS IF YOU CHANGE IT
 * - Turning these into buttons that filter a client-side list removes every
 *   category hub from the crawlable graph and makes the hubs unreachable.
 * - Dropping `aria-current` leaves the active state as colour alone, which is
 *   invisible to assistive tech and to anyone who cannot distinguish the tokens.
 */
export interface CategoryPillsProps {
  readonly categories: readonly Category[]
  /** Slug of the hub currently being viewed, if any. */
  readonly activeSlug?: string | undefined
  /** Accessible name for the nav landmark. */
  readonly label?: string | undefined
  readonly className?: string | undefined
}

export function CategoryPills({ categories, activeSlug, label, className }: CategoryPillsProps) {
  if (categories.length === 0) return null

  return (
    <nav aria-label={label ?? 'Categories'} className={cn('not-prose', className)}>
      <ul className="flex list-none flex-wrap gap-2 p-0">
        {categories.map((category) => {
          const isActive = category.slug === activeSlug

          return (
            <li key={category.slug}>
              <Link
                href={categoryPath(category.slug)}
                {...(isActive ? { 'aria-current': 'page' as const } : {})}
                className="focus-visible:ring-ring inline-block rounded-md focus-visible:ring-2 focus-visible:outline-none"
              >
                <Badge variant={isActive ? 'default' : 'secondary'}>{category.name}</Badge>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
