import type { ElementType, ReactNode } from 'react'

import { cn } from '@/lib/utils'

/**
 * Long-form typography wrapper.
 *
 * WHERE IT RENDERS
 * Around the compiled MDX body on `app/blog/[slug]/page.tsx`, and around any
 * other block of authored prose (the editorial policy page, an author's long
 * bio). It is the only place the `prose` utility is applied.
 *
 * WHY IT IS SHAPED THIS WAY
 * Two jobs, and deliberately no third:
 *
 *   1. Apply `prose` from `@tailwindcss/typography`.
 *   2. Constrain the measure to `--agentblog-measure` (68ch by default), because
 *      line length is the one typographic decision the plugin does not make for
 *      you and the one that most affects long-form reading.
 *
 * It does NOT define colours. The `--tw-prose-*` bridge that binds the plugin's
 * palette to the consumer's shadcn tokens lives in `styles/agentblog.css`. That
 * separation is the point: the CSS file is theme wiring, this file is layout.
 *
 * DO NOT ADD THE TYPOGRAPHY PLUGIN'S `prose-invert` MODIFIER, AND DO NOT PUT IT
 * BEHIND A DARK VARIANT.
 * The bridge maps `--tw-prose-body` and friends to `var(--foreground)` and the
 * other shadcn tokens, and those tokens already flip under `.dark`. Adding the
 * inverted palette layers a second, hardcoded set of greys on top of tokens that
 * have already switched, so dark mode ends up fighting itself. It also breaks
 * outright for any consumer whose dark theme is not near-black.
 * @See https://docs.agentblog.dev/guides/match-your-design#only-semantic-tokens-never-a-palette-utility
 *
 * WHAT BREAKS IF YOU CHANGE IT
 * - Adding `'use client'` here pulls the entire article body out of the static
 *   HTML shell. AI crawlers do not execute JavaScript, so the post becomes an
 *   empty div to exactly the readers this block exists to reach.
 * - Removing the heading `scroll-mt-*` utilities makes every table-of-contents
 *   jump land with the target heading tucked under a sticky header.
 */
export interface ProseProps {
  readonly children: ReactNode
  // Every optional prop in this block is declared `?: T | undefined` rather than
  // `?: T`. Under `exactOptionalPropertyTypes` those are not the same type, and
  // the plain form rejects the most ordinary call a consumer makes:
  // `<Prose className={maybeUndefined}>`.
  readonly className?: string | undefined
  /**
   * The rendered element. Defaults to `div`. Pass `'article'` only when this
   * wrapper is the article itself; the post route already supplies its own
   * `<article>` with the H1, the answer capsule, and the byline in a
   * `<header>`, so nesting a second one would give the page two article
   * landmarks.
   */
  readonly as?: ElementType | undefined
}

export function Prose({ children, className, as }: ProseProps) {
  const Component: ElementType = as ?? 'div'

  return (
    <Component
      className={cn(
        // Parentheses, not square brackets. Tailwind v4 removed the v3
        // shorthand that let a bare custom property sit inside square brackets,
        // and it removed it silently: the bracket spelling still produces a
        // rule, and that rule is `max-width:--agentblog-measure`, which is not
        // valid CSS and which every browser drops. Nothing errors, and the
        // measure quietly comes from somewhere else.
        //
        // That somewhere else is `@utility prose` in `styles/agentblog.css`,
        // which sets `max-width: var(--agentblog-measure)` too. The two agree
        // on purpose and neither is redundant: the CSS file is what overrides
        // the typography plugin's own `max-width: 65ch` on `.prose`, and this
        // class is what states the constraint at the element a reader is
        // looking at. Deleting either one leaves the measure working today and
        // one refactor away from silently becoming 65ch.
        'prose max-w-(--agentblog-measure)',
        // Anchor targets clear a sticky header when a TOC link is followed.
        '[&_h2]:scroll-mt-24 [&_h3]:scroll-mt-24 [&_h4]:scroll-mt-24',
        className,
      )}
    >
      {children}
    </Component>
  )
}
