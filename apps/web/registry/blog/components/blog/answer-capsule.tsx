import type { ReactNode } from 'react'

/**
 * The 40 to 60 word direct answer that opens a post.
 *
 * WHERE IT RENDERS
 * `app/blog/[slug]/page.tsx`, inside the article `<header>`, under the H1 and
 * the one-line byline and above everything else. `components/mdx/*` may also
 * render one under an H2 for a section-level answer.
 *
 * The byline above it is a single line of names and numbers, which is what makes
 * it a tolerable neighbour: the capsule is still the first prose in the document
 * and still lands inside the opening chunk of any retrieval system that splits
 * the page. Anything longer than a line belongs below the capsule, not above it.
 *
 * WHY IT IS SHAPED THIS WAY
 * This is the passage an answer engine lifts. Everything about the markup is in
 * service of making that passage cleanly extractable:
 *
 *   - It is a single `<p>`, not a list, a grid, or a set of nested spans. A
 *     retrieval system that chunks the page gets one coherent unit.
 *   - It sits high in the document order, so it survives chunk truncation.
 *   - It carries no preamble. The answer starts at the first word.
 *
 * ⚠️ NO LINKS INSIDE THE CAPSULE. THIS IS THE RULE, NOT A PREFERENCE.
 * A link inside the capsule fragments the extractable answer: it splits one
 * passage into text-anchor-text and signals that the real answer lives at the
 * other end of the href. In the cited corpus, 91% of capsules that engines
 * actually quoted contained no links at all. Put the supporting links in the
 * paragraph after the capsule, where they help a human and cost nothing.
 *
 * The component cannot enforce this on arbitrary `children`, so `agentblog
 * audit` checks it instead. If you are an agent writing capsule copy: plain
 * sentences only, no markdown links, no `<a>`.
 *
 * WHAT BREAKS IF YOU CHANGE IT
 * - Wrapping the text in anything that is not a paragraph (a `<details>`, a
 *   two-column layout, a `<blockquote>` with a citation line) splits the passage
 *   and the extraction stops being clean.
 * - Adding `'use client'` removes the single most valuable passage on the page
 *   from the HTML a non-JavaScript crawler receives.
 * - Moving it below the table of contents pushes it out of the opening chunk.
 *
 * @see https://docs.agentblog.dev/concepts/geo-playbook
 */
export interface AnswerCapsuleProps {
  /**
   * The answer as plain text, for a caller that has a `string` and nothing else.
   * Wins over `children` when both are supplied.
   */
  readonly text?: string | undefined
  /**
   * The normal path, and what the post route uses: it passes
   * `post.answerCapsule` as `children`, so the string in frontmatter is the
   * string on the page and `agentblog audit` can count its words. MDX authors
   * who need inline emphasis or a number inside `<strong>` reach the component
   * the same way. Do not put links in here.
   */
  readonly children?: ReactNode | undefined
  readonly className?: string | undefined
}

export function AnswerCapsule({ text, children, className }: AnswerCapsuleProps) {
  const content = text ?? children

  // Rendering an empty bordered box is worse than rendering nothing: it tells a
  // reader the answer is missing and gives an extractor an empty chunk.
  if (content === undefined || content === null || content === '') return null

  return (
    /*
     * The first paragraph of the article, typeset as the first paragraph of the
     * article.
     *
     * This used to be a filled, bordered, rounded panel, then a 20px standfirst.
     * Both were attempts to make the most important sentence on the page look
     * like the most important sentence on the page, and both bought that at the
     * cost of a seam: the panel put the capsule in the same visual class as the
     * table of contents, the FAQ, and every callout below it, and the standfirst
     * opened a size step down into the body text one paragraph later, which is
     * where the reader has only just settled in.
     *
     * Position is the emphasis now, and position is what an answer engine reads
     * anyway. The capsule is the first prose on the page and the first thing in
     * the opening chunk; a reader who starts at the top starts here, and nothing
     * about the type asks them to stop and change gear one paragraph later.
     *
     * The size comes from `--agentblog-reading-size` in `styles/agentblog.css`,
     * which is the same variable `@utility prose` sets `font-size` from. That is
     * the point of the variable: this paragraph sits in the article `<header>`,
     * outside `.prose`, so it cannot inherit the reading size and would
     * otherwise be a hardcoded 16px that drifts the first time somebody tunes
     * the body text.
     *
     * There is deliberately no left rule and no indent, although both were
     * tried. Any indent puts the most important sentence on the page 24px to the
     * right of the headline and byline above it and every paragraph after it.
     * One left edge down the whole article is worth more than a decorative rule.
     *
     * The markup is unchanged and must stay unchanged: one `<div>` carrying the
     * `data-agentblog` hook, wrapping exactly one `<p>`. Everything in the
     * comment above about extractability is about that shape, not about the
     * classes on it.
     */
    <div data-agentblog="answer-capsule" className={className}>
      <p className="text-foreground text-(length:--agentblog-reading-size) leading-(--agentblog-reading-leading) text-pretty">
        {content}
      </p>
    </div>
  )
}
