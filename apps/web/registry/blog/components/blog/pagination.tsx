import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { ChevronLeftIcon, ChevronRightIcon } from './icons'

/**
 * Archive pagination.
 *
 * WHERE IT RENDERS
 * The foot of the blog index, category hubs, tag pages, and author pages.
 *
 * ⚠️ EVERY CONTROL IN HERE IS A REAL `<a href>`. NEVER A BUTTON THAT PUSHES TO
 * THE ROUTER.
 * Paginated archives are frequently the only discovery path to deep posts. A
 * crawler that does not run JavaScript follows anchors and nothing else, so a
 * `<button onClick={() => router.push(...)}>` makes page 2 and everything below
 * it unreachable. This is the single most consequential line in the file.
 * @see https://docs.agentblog.dev/concepts/geo-playbook*
 * WHY IT IS SHAPED THIS WAY
 *   - `rel="prev"` and `rel="next"` on the adjacent-page links. Google stopped
 *     using them for indexing years ago, so they are here for accessibility, for
 *     other engines, and for browsers that prefetch on them. Cheap, and the
 *     absence is silently costly.
 *   - `aria-current="page"` on the current page number. Colour alone does not
 *     communicate position.
 *   - The window logic (first, last, current and its neighbours, ellipses) is
 *     pure and computed at render time, so a 40 page archive does not emit 40
 *     links, and the output is identical on every render.
 *   - Prev and Next are omitted rather than disabled at the ends. A disabled
 *     `<span>` that reads "Previous" is a control a screen reader announces and
 *     a reader cannot use.
 *
 * ⚠️ URL SHAPE MUST MATCH THE ROUTE THAT ACTUALLY EXISTS.
 * The default is the query form the shipped archive routes use: page 1 is
 * `basePath` itself and page N is `${basePath}?page=${N}`. Page 1 must NOT get a
 * `?page=1` suffix, or the archive ends up with two URLs for one set of posts
 * and splits its own signals. This also has to agree with the self-canonical the
 * route emits, which is why `app/blog/page.tsx` documents the same decision.
 *
 * The query string is appended to `basePath` verbatim, which is why `basePath`
 * has to arrive already normalised by a `@/lib/config` path helper. See the prop
 * doc below.
 *
 * If you switch to the path-segment form, add `app/blog/page/[page]/page.tsx`,
 * pass `hrefForPage={(n) => (n <= 1 ? '/blog' : `/blog/page/${n}`)}` here, and
 * update the canonical in the route. Those edits go together. Doing one without
 * the others produces 404s on page 2.
 *
 * WHAT BREAKS IF YOU CHANGE IT
 * - Replacing the anchors with router pushes: see the warning above.
 * - Adding `noindex` to paginated pages while they are the only path to deep
 *   posts removes those posts from the index along with the archive.
 * - Making page 1 canonical to page 2 (or every page canonical to page 1) tells
 *   Google to drop the deep pages. Each paginated page self-canonicalizes.
 */
export interface PaginationProps {
  /** Current page, 1 based. */
  readonly page: number
  readonly totalPages: number
  /**
   * Archive root, root-relative. For example `/blog`.
   *
   * ⚠️ PASS A VALUE FROM A `@/lib/config` PATH HELPER, NEVER A STRING LITERAL.
   * `blogPath()`, `categoryPath(slug)`, `tagPath(tag)`, `authorPath(slug)`. Those
   * helpers are the only thing that applies `config.trailingSlash`, and this
   * component appends the query string to whatever it is given. A literal
   * `/blog` on a `trailingSlash: true` site therefore produces `/blog?page=2`,
   * which 308s to `/blog/?page=2` before it serves, on every paginated link. The
   * helper form produces the final URL directly.
   */
  readonly basePath: string
  /** Override the page URL scheme. @see the URL SHAPE note above. */
  readonly hrefForPage?: ((page: number) => string) | undefined
  /** Accessible name for the nav landmark. Distinguish multiple paginations. */
  readonly label?: string | undefined
  readonly className?: string | undefined
}

/**
 * Which page numbers to show. Always the first page, the last page, the current
 * page and its immediate neighbours; `null` marks a gap.
 *
 * Kept as a standalone pure function so it stays readable and so the gap rule
 * (only collapse when at least two pages are being hidden) is stated once.
 */
function pageWindow(page: number, totalPages: number): readonly (number | null)[] {
  const shown = new Set<number>([1, totalPages, page - 1, page, page + 1])
  const items: (number | null)[] = []
  let previous = 0

  for (let n = 1; n <= totalPages; n += 1) {
    if (!shown.has(n)) continue
    // A single hidden page is not worth an ellipsis: render the number instead.
    if (previous > 0 && n - previous === 2) items.push(previous + 1)
    else if (previous > 0 && n - previous > 2) items.push(null)
    items.push(n)
    previous = n
  }

  return items
}

export function Pagination({
  page,
  totalPages,
  basePath,
  hrefForPage,
  label,
  className,
}: PaginationProps) {
  // One page is not a paginated archive, and an empty nav landmark is noise.
  if (totalPages <= 1) return null

  const href =
    hrefForPage ??
    ((n: number) =>
      n <= 1 ? basePath : `${basePath}${basePath.includes('?') ? '&' : '?'}page=${n}`)
  const hasPrevious = page > 1
  const hasNext = page < totalPages

  return (
    <nav aria-label={label ?? 'Pagination'} className={cn('not-prose', className)}>
      <ul className="flex list-none flex-wrap items-center justify-center gap-1 p-0">
        {hasPrevious ? (
          <li>
            <Button asChild variant="ghost" size="sm">
              <Link href={href(page - 1)} rel="prev">
                <ChevronLeftIcon className="size-4" aria-hidden="true" />
                Previous
              </Link>
            </Button>
          </li>
        ) : null}

        {pageWindow(page, totalPages).map((n, index) =>
          n === null ? (
            <li key={`gap-${index}`} aria-hidden="true" className="text-muted-foreground px-2">
              …
            </li>
          ) : (
            <li key={n}>
              <Button asChild variant={n === page ? 'default' : 'ghost'} size="icon">
                <Link
                  href={href(n)}
                  aria-label={`Page ${n}`}
                  {...(n === page ? { 'aria-current': 'page' as const } : {})}
                >
                  {n}
                </Link>
              </Button>
            </li>
          ),
        )}

        {hasNext ? (
          <li>
            <Button asChild variant="ghost" size="sm">
              <Link href={href(page + 1)} rel="next">
                Next
                <ChevronRightIcon className="size-4" aria-hidden="true" />
              </Link>
            </Button>
          </li>
        ) : null}
      </ul>
    </nav>
  )
}
