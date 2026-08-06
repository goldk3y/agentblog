import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

/**
 * The 40 to 60 word direct answer that sits immediately under the H1.
 *
 * WHERE IT RENDERS
 * `app/blog/[slug]/page.tsx`, inside the article `<header>`, directly under the
 * H1 and above the byline. `components/mdx/*` may also render one under an H2
 * for a section-level answer.
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
 * @see https://agentblog.dev/docs/geo-playbook
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
    <div
      data-agentblog="answer-capsule"
      className={cn('border-border bg-muted my-6 rounded-lg border p-5', className)}
    >
      <p className="text-foreground text-base leading-relaxed sm:text-lg">{content}</p>
    </div>
  )
}
