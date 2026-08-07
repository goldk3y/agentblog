'use client'

/**
 * `useTocActiveHeading` - which section is the reader looking at?
 *
 * ---------------------------------------------------------------------------
 * THIS IS THE ONLY CLIENT CODE IN THE ARTICLE RENDER PATH
 * ---------------------------------------------------------------------------
 * The table of contents is already complete in the server-rendered HTML: every
 * entry, every `href`, in document order. This hook adds one thing on top of
 * that, a highlight on whichever entry matches the current scroll position.
 *
 * Delete this hook and the TOC still renders, still links, and is still fully
 * crawlable. Nothing that matters for search or for AI retrieval depends on it.
 * That is the test any client code in this blog has to pass before it ships.
 *
 * ---------------------------------------------------------------------------
 * WHY `IntersectionObserver` AND NOT A SCROLL LISTENER
 * ---------------------------------------------------------------------------
 * A scroll handler runs on every frame and forces layout every time it reads
 * `getBoundingClientRect`. `IntersectionObserver` is computed off the main
 * thread and fires only when a heading actually crosses a boundary, so a long
 * post with sixty headings costs nothing while the reader is not moving.
 *
 * @see https://docs.agentblog.dev/reference/files
 */
import { useEffect, useState } from 'react'

/**
 * How far up the viewport the "active" band sits. A heading is considered
 * current once it has scrolled into the top 30% of the screen, which is where
 * a reader's eye actually is, rather than at the exact top edge.
 */
const ACTIVE_BAND = '0px 0px -70% 0px'

/**
 * The reduced-motion band. Narrower, so the highlight moves once per section
 * boundary instead of tracking continuously through momentum scrolling. Less
 * on-screen movement is the whole request behind `prefers-reduced-motion`, and
 * a marker that skitters between three entries during one flick is exactly the
 * movement it asks us to drop.
 */
const ACTIVE_BAND_REDUCED = '0px 0px -90% 0px'

export function useTocActiveHeading(ids: readonly string[]): string | null {
  const [activeId, setActiveId] = useState<string | null>(null)

  // Depend on the joined string, not the array. A parent that rebuilds the
  // entry list on every render would otherwise tear down and rebuild the
  // observer on every render too, for an identical list of ids.
  const key = ids.join('\n')

  useEffect(() => {
    const headingIds = key.length === 0 ? [] : key.split('\n')
    if (headingIds.length === 0) return

    const elements = headingIds
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null)
    if (elements.length === 0) return

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    let observer: IntersectionObserver | null = null

    const subscribe = (): undefined => {
      observer?.disconnect()
      const visible = new Set<string>()

      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) visible.add(entry.target.id)
            else visible.delete(entry.target.id)
          }
          // Highest heading still in the band wins, so the marker matches the
          // section the reader is reading rather than the one about to arrive.
          const current = headingIds.find((id) => visible.has(id))
          if (current !== undefined) setActiveId(current)
        },
        {
          rootMargin: motionQuery.matches ? ACTIVE_BAND_REDUCED : ACTIVE_BAND,
          threshold: 0,
        },
      )

      for (const el of elements) observer.observe(el)
    }

    subscribe()
    // Re-subscribe if the reader changes the system setting mid-session.
    motionQuery.addEventListener('change', subscribe)

    return () => {
      motionQuery.removeEventListener('change', subscribe)
      observer?.disconnect()
      observer = null
    }
  }, [key])

  return activeId
}
