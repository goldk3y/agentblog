/**
 * `<Quote>` - a quotation, ideally from a named source.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS COMPONENT IS WORTH CARING ABOUT
 * ---------------------------------------------------------------------------
 * Adding quotations from named sources is the highest-yield single change
 * measured in the GEO paper (Aggarwal et al., ACM KDD 2024): roughly +41% on
 * citation visibility, and around +22% on Perplexity specifically. That figure
 * was measured on 2023 models and is directional rather than a guarantee, but
 * the mechanism is durable. A quotation with an attributed speaker is a piece
 * of evidence an engine can pass through; an unattributed one is just your
 * prose in italics.
 *
 * So `cite` and `source` are the reason this component exists. A `<blockquote>`
 * with no attribution renders fine, but it is leaving the effect on the table.
 *
 * ---------------------------------------------------------------------------
 * MARKUP
 * ---------------------------------------------------------------------------
 * `<figure><blockquote>` plus `<figcaption>` is the correct pairing. Attribution
 * inside the `<blockquote>` would claim the speaker's name is part of what they
 * said. `cite` on the blockquote points at the source document, and the visible
 * link is what a reader and a text extractor actually follow.
 *
 * The markdown `>` blockquote maps here too, without attribution, which is why
 * every prop is optional.
 *
 * @see https://docs.agentblog.dev/concepts/geo-playbook*/
import type { ReactNode } from 'react'

export interface QuoteProps {
  readonly children: ReactNode
  // `?: T | undefined`, not `?: T`. Under `exactOptionalPropertyTypes` the plain
  // form rejects `<Quote source={maybeUndefined}>`, which is exactly how an MDX
  // wrapper passes an attribution it may not have.
  // @see components/blog/prose.tsx
  /** Who said it. This is the part that carries the measured effect. */
  readonly source?: string | undefined
  /** Their role or publication, shown after the name. */
  readonly context?: string | undefined
  /** URL of the document being quoted. Sets `cite` and links the attribution. */
  readonly cite?: string | undefined
}

export function Quote({ children, source, context, cite }: QuoteProps) {
  const attribution = source ?? context

  return (
    <figure className="my-8">
      <blockquote
        {...(cite !== undefined ? { cite } : {})}
        className="border-border text-foreground border-l-2 pl-6 text-xl leading-relaxed text-pretty italic [&>*:last-child]:mb-0"
      >
        {children}
      </blockquote>
      {attribution !== undefined && (
        <figcaption className="text-muted-foreground mt-3 pl-6 text-sm not-italic">
          {source !== undefined &&
            (cite !== undefined ? (
              <a
                href={cite}
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground font-medium underline underline-offset-4"
              >
                {source}
              </a>
            ) : (
              <span className="text-foreground font-medium">{source}</span>
            ))}
          {context !== undefined && (
            <span>
              {source !== undefined ? ', ' : ''}
              {context}
            </span>
          )}
        </figcaption>
      )}
    </figure>
  )
}

export default Quote
