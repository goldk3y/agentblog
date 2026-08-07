/**
 * Fixed sample titles for the Open Graph preview, one per step of
 * `titleFontSize`.
 *
 * ---------------------------------------------------------------------------
 * WHY THESE ARE A CONSTANT AND NOT A QUERY PARAMETER
 * ---------------------------------------------------------------------------
 * The obvious build is `/og-preview/samples?title=...`, which is also a public
 * endpoint that renders arbitrary text onto a card carrying our mark and our
 * colours, at our domain. That is a defacement primitive with a share button
 * attached, and Vercel's own Open Graph guidance covers encrypting parameters
 * for exactly this reason. A closed list costs nothing and has no such surface.
 *
 * The lengths are load bearing. Each one sits just inside a boundary in
 * `titleFontSize`, and the last is the 70 character maximum `PostSchema`
 * enforces, which is the longest title this card will ever have to lay out.
 *
 * There is no unit test holding them there, because `titleFontSize` lives in a
 * `.tsx` module and `node --test` cannot load JSX. The preview page prints the
 * character count and the resulting size under every card instead, computed by
 * calling the real function, so a sample that drifts across a boundary shows up
 * as two cards claiming the same size on the page it exists to illustrate.
 */

export interface OgSample {
  /** What the step is for, shown as the caption in the preview. */
  readonly label: string
  readonly title: string
}

export const OG_SAMPLES: readonly OgSample[] = [
  { label: 'Short title, 76px', title: 'Ship a blog in one command' },
  { label: 'Medium title, 68px', title: 'What an AI crawler actually reads on your page' },
  {
    label: 'Longest allowed title, 70 characters, 60px',
    title: 'Why your posts are invisible to AI answers and what to change first',
  },
]
