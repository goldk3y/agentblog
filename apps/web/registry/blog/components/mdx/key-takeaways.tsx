/**
 * `<KeyTakeaways>` - the summary block near the top of a long post.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS A REAL `<ul>` INSIDE AN `<aside>`
 * ---------------------------------------------------------------------------
 * A retrieval system splits a page into chunks and embeds each one. A short
 * list of self-contained statements is close to the ideal chunk: one idea per
 * item, no pronouns pointing at context that was cut away, and the highest
 * value sentence first. That is why the markup is a list rather than a styled
 * paragraph, and why each item should be a full sentence that survives on its
 * own.
 *
 * The writing rule that goes with it: repeat the entity name instead of using
 * "it". A takeaway that reads "It caches by default" is worthless once the
 * chunk that named the subject is gone.
 *
 * This block is not a replacement for the answer capsule. The capsule answers
 * the post's question in 40 to 60 words of prose. This lists what the reader
 * will know by the end.
 *
 * @see https://agentblog.dev/docs/geo-playbook*/
import type { ReactNode } from 'react'

export interface KeyTakeawaysProps {
  /** One complete sentence per item. Three to six items reads best. */
  readonly items: readonly ReactNode[]
  // `?: T | undefined`, not `?: T`. Under `exactOptionalPropertyTypes` the plain
  // form rejects `<KeyTakeaways heading={maybeUndefined} />`.
  // @see components/blog/prose.tsx
  readonly heading?: string | undefined
}

export function KeyTakeaways({ items, heading = 'Key takeaways' }: KeyTakeawaysProps) {
  if (items.length === 0) return null

  return (
    <aside className="border-border bg-muted my-8 rounded-lg border px-6 py-5">
      <p className="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase">
        {heading}
      </p>
      <ul className="text-foreground marker:text-muted-foreground list-disc space-y-2 pl-5 text-sm leading-relaxed">
        {items.map((item, index) => (
          // Takeaways are a fixed, ordered, author-written list that never
          // reorders between renders, so the index is a stable key.
          <li key={index}>{item}</li>
        ))}
      </ul>
    </aside>
  )
}

export default KeyTakeaways
