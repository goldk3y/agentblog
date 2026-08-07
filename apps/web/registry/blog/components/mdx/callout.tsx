/**
 * `<Callout>` - a labelled aside inside an article.
 *
 * ---------------------------------------------------------------------------
 * WHY THE LABEL IS TEXT AND NOT AN ICON
 * ---------------------------------------------------------------------------
 * A callout carries meaning ("this one will bite you") and that meaning has to
 * survive being read as plain text, because that is how every AI crawler reads
 * it. An icon carries nothing to a text extractor, and an icon plus
 * `aria-label` still leaves the visible text unlabelled in the extracted chunk.
 * So the variant renders a real word, in the markup, above the content.
 *
 * It also keeps this component free of an icon-library import, which matters
 * because the consumer may be on Tabler or Phosphor rather than Lucide.
 *
 * ---------------------------------------------------------------------------
 * THEMING
 * ---------------------------------------------------------------------------
 * Every variant is built from the consumer's own tokens. `warning` is the only
 * one that reaches for a second colour, and it uses `destructive`, which every
 * shadcn theme defines. There is no amber here, because there is no amber in
 * the token set and inventing one would make the blog stop looking like the
 * product it is bolted onto.
 *
 * @See https://docs.agentblog.dev/guides/match-your-design#only-semantic-tokens-never-a-palette-utility
 */
import type { ReactNode } from 'react'

export type CalloutVariant = 'note' | 'tip' | 'important' | 'warning'

export interface CalloutProps {
  // Every optional prop in this block is declared `?: T | undefined` rather than
  // `?: T`. Under `exactOptionalPropertyTypes` those are not the same type, and
  // the plain form rejects the most ordinary call a consumer makes:
  // `<Callout title={maybeUndefined}>`. @see components/blog/prose.tsx
  /** Defaults to `note`. */
  readonly variant?: CalloutVariant | undefined
  /** Overrides the default label text. Keep it to one or two words. */
  readonly title?: string | undefined
  readonly children: ReactNode
}

const LABELS: Record<CalloutVariant, string> = {
  note: 'Note',
  tip: 'Tip',
  important: 'Important',
  warning: 'Warning',
}

const ACCENTS: Record<CalloutVariant, string> = {
  note: 'border-l-border',
  tip: 'border-l-primary',
  important: 'border-l-primary',
  warning: 'border-l-destructive',
}

const LABEL_TONE: Record<CalloutVariant, string> = {
  note: 'text-muted-foreground',
  tip: 'text-foreground',
  important: 'text-foreground',
  warning: 'text-destructive',
}

export function Callout({ variant = 'note', title, children }: CalloutProps) {
  return (
    <aside
      className={`border-border bg-muted my-8 rounded-xl border border-l-4 px-5 py-4 ${ACCENTS[variant]}`}
    >
      <p
        className={`mt-0 mb-2 text-xs font-medium tracking-wider uppercase ${LABEL_TONE[variant]}`}
      >
        {title ?? LABELS[variant]}
      </p>
      {/*
       * `[&>*]:my-0` then `[&>*+*]:mt-3`, rather than a bottom margin on
       * paragraphs. Everything in here is inside `.prose`, so the typography
       * plugin has already given every `<p>` and `<ul>` a 1.25em margin on
       * BOTH sides; overriding only the bottom leaves the first child pushed
       * 21px down from the label above it. Zero them and re-space between
       * siblings instead. Lists and links keep their prose styling, which is
       * why this is not `not-prose`.
       */}
      <div className="text-foreground text-sm leading-relaxed [&>*]:my-0 [&>*+*]:mt-3">
        {children}
      </div>
    </aside>
  )
}

export default Callout
