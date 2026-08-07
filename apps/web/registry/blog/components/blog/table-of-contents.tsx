'use client'

import { useMemo } from 'react'

import { useTocActiveHeading } from '@/hooks/use-toc-active-heading'
import type { TocEntry } from '@/lib/toc'
import { cn } from '@/lib/utils'

import { ChevronDownIcon } from './icons'

/**
 * In-page table of contents with a scroll-spy highlight.
 *
 * WHERE IT RENDERS
 * `app/blog/[slug]/page.tsx`, after the article `<header>` and the hero image
 * and before the body, on posts long enough to need one (roughly 1,200 words
 * and up). Entries come from the TOC that `renderMdx` extracts while compiling
 * the body, which reads the same headings that get stable ids, so every `href`
 * resolves. The post route appends one synthetic entry for the FAQ heading,
 * which lives outside the MDX body and therefore cannot be extracted.
 *
 * ⚠️ THIS IS ONE OF EXACTLY TWO CLIENT COMPONENTS IN THE BLOCK, AND IT EARNS THE
 * BOUNDARY BY RENDERING EVERYTHING BEFORE ANY JAVASCRIPT RUNS.
 * The complete list of anchors is in the server HTML. `useTocActiveHeading`
 * returns `null` during server rendering and during the first client render, so
 * the only thing hydration adds is a highlight on whichever heading is currently
 * in view. Remove the JavaScript entirely and the component still renders a
 * working table of contents. That is the bar any change here has to clear.
 * @see https://docs.agentblog.dev/reference/files
 *
 * WHY `<details>` AND NOT CONDITIONAL MOUNTING
 * The block ships open (`defaultOpen={false}` starts it collapsed) and the
 * reader can fold it away on a small screen. Nothing collapses it
 * automatically, at any viewport width: that is a decision, not an omission,
 * because a table of contents the reader cannot see is a table of contents that
 * does not do its job.
 *
 * The collapsing is `<details>`, which hides content with CSS and keeps every
 * anchor in the DOM. A React `{isOpen && <ol/>}` would remove the links from the
 * markup entirely, which is the listed extraction killer: accordions that mount
 * content on click. CSS-hidden is fine, JavaScript-mounted is not.
 * @see https://docs.agentblog.dev/concepts/geo-playbook*
 * WHY THE LIST IS NESTED
 * H3 entries render inside their parent H2's `<li>`, not as a flat list with
 * extra padding. Indentation is invisible to a screen reader; list nesting is
 * the thing that actually communicates the outline.
 *
 * WHAT BREAKS IF YOU CHANGE IT
 * - Building the list from a `useEffect` (reading headings out of the DOM
 *   instead of taking `entries` as a prop) empties the TOC in the server HTML
 *   and costs the page its "jump to" links.
 * - Dropping `aria-current` leaves the active state as colour alone.
 * - Removing the heading `scroll-mt-*` utilities in `prose.tsx` makes every jump
 *   land with the target heading behind a sticky header.
 */
export interface TableOfContentsProps {
  readonly entries: readonly TocEntry[]
  /** Visible heading for the block. */
  readonly title?: string | undefined
  /** Start collapsed. Defaults to open, because a visible TOC is the point. */
  readonly defaultOpen?: boolean | undefined
  readonly className?: string | undefined
}

interface TocGroup {
  readonly entry: TocEntry
  readonly children: TocEntry[]
}

/** Fold H3 entries under the H2 before them. A leading H3 becomes a top level item. */
function groupEntries(entries: readonly TocEntry[]): TocGroup[] {
  const groups: TocGroup[] = []

  for (const entry of entries) {
    const current = groups[groups.length - 1]
    if (entry.depth === 3 && current !== undefined) current.children.push(entry)
    else groups.push({ entry, children: [] })
  }

  return groups
}

function TocLink({ entry, isActive }: { entry: TocEntry; isActive: boolean }) {
  return (
    <a
      href={`#${entry.id}`}
      // `aria-current="location"` is the correct value here, not "page": the
      // target is a section of the current document, not a different page.
      {...(isActive ? { 'aria-current': 'location' as const } : {})}
      className={cn(
        'focus-visible:ring-ring block rounded-sm py-1 transition-colors focus-visible:ring-2 focus-visible:outline-none',
        /*
         * At `xl` the list gains a rail and each link becomes a segment of it.
         * `-ml-px` pulls the link's 2px border over the list's 1px one, so the
         * active marker replaces the rule instead of sitting beside it. Without
         * that the text shifts sideways by a pixel every time the active
         * section changes on scroll, which is the kind of movement you notice
         * without being able to say what moved.
         */
        'xl:-ml-px xl:rounded-none xl:border-l-2 xl:border-transparent',
        entry.depth === 3 ? 'xl:pl-7' : 'xl:pl-4',
        isActive
          ? 'text-foreground xl:border-foreground font-medium'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {entry.text}
    </a>
  )
}

export function TableOfContents({ entries, title, defaultOpen, className }: TableOfContentsProps) {
  // The hook takes ids, not entries, so it does not re-subscribe when the
  // parent hands down a fresh array with the same contents.
  const ids = useMemo(() => entries.map((entry) => entry.id), [entries])
  const activeId = useTocActiveHeading(ids)
  const groups = useMemo(() => groupEntries(entries), [entries])

  if (entries.length === 0) return null

  return (
    /*
     * ONE COMPONENT, TWO PRESENTATIONS, AND DELIBERATELY ONE DOM NODE
     *
     * Below `xl` this is a collapsible card sitting in the flow under the
     * byline. At `xl` and above the page moves it into a margin rail, where it
     * drops the card entirely and becomes a bare list against a hairline, with
     * the summary demoted to an eyebrow and the chevron hidden. `app/blog/[slug]`
     * owns the `sticky` and the column placement; this file owns what it looks
     * like once it gets there.
     *
     * The obvious alternative is two instances behind `hidden xl:block` and
     * `xl:hidden`, and it is wrong on this page specifically. It would put two
     * navigation landmarks named "Table of contents" in the accessibility tree,
     * duplicate every heading link in the HTML that answer engines read, and
     * double the anchor count on a page whose entire purpose is being cleanly
     * chunked. One node, styled twice, costs a handful of `xl:` prefixes and
     * none of that.
     *
     * The `<details>` element stays at every width. At `xl` it is always open,
     * because it renders open by default and the summary is made
     * non-interactive there rather than removed: a `<summary>` is what gives
     * the list its accessible heading, and taking it away to hide a chevron
     * would cost more than it saves.
     */
    <nav aria-label="Table of contents" className={cn('not-prose', className)}>
      <details
        className="group border-border bg-card rounded-lg border p-4 xl:rounded-none xl:border-0 xl:bg-transparent xl:p-0"
        open={defaultOpen !== false}
      >
        <summary className="text-card-foreground focus-visible:ring-ring xl:text-muted-foreground flex cursor-pointer items-center justify-between gap-2 rounded-sm text-sm font-semibold focus-visible:ring-2 focus-visible:outline-none xl:pointer-events-none xl:cursor-default xl:text-xs xl:font-medium xl:tracking-wider xl:uppercase">
          {title ?? 'On this page'}
          <ChevronDownIcon
            className="size-4 shrink-0 transition-transform group-open:rotate-180 xl:hidden"
            aria-hidden="true"
          />
        </summary>

        {/*
         * The rail. It only exists at `xl`, where the links carry the active
         * marker that replaces a segment of it. Below `xl` the card border is
         * already doing the job of containing the list, and a second vertical
         * rule inside it would be one line too many.
         */}
        <ol className="border-border mt-3 list-none space-y-0.5 p-0 text-sm xl:mt-4 xl:border-l">
          {groups.map((group) => (
            <li key={group.entry.id}>
              <TocLink entry={group.entry} isActive={group.entry.id === activeId} />

              {group.children.length > 0 ? (
                <ol className="border-border mt-0.5 ml-4 list-none space-y-0.5 border-l pl-3 xl:mt-0 xl:ml-0 xl:border-l-0 xl:pl-0">
                  {group.children.map((child) => (
                    <li key={child.id}>
                      <TocLink entry={child} isActive={child.id === activeId} />
                    </li>
                  ))}
                </ol>
              ) : null}
            </li>
          ))}
        </ol>
      </details>
    </nav>
  )
}
