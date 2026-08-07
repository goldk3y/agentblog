/**
 * The block's type scale and spacing rhythm, as class strings.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS FILE EXISTS
 * ---------------------------------------------------------------------------
 * Six routes render a page heading and a lede, and before this file they each
 * spelled out their own. They drifted, which is the only thing repeated class
 * strings reliably do: the index heading and the author heading were the same
 * size, the FAQ heading and the sources heading were not, and nothing anywhere
 * said which of them was right.
 *
 * These are plain strings rather than components on purpose. A component would
 * hide the styling behind a prop and break the shadcn premise that you can read
 * a page and see exactly what it renders. A string can be spread into a
 * `className`, overridden by a later utility through `cn`, or deleted outright
 * by a consumer who wants their own scale, and none of those need this file to
 * cooperate.
 *
 * ---------------------------------------------------------------------------
 * THE SCALE
 * ---------------------------------------------------------------------------
 * Four text roles, three weights, three tones. Anything on a blog page is one
 * of these, and a page that needs a fifth role is usually a page that is doing
 * too much.
 *
 *   display   The page H1. One per route.
 *   lede      The sentence under the H1. Muted, and held to the reading
 *             measure even on the wide rail, because a 1,152px line of prose is
 *             not a lede, it is a mistake.
 *   section   An H2 outside the article body: Sources, Related posts, the FAQ.
 *   eyebrow   The small capitalised label above or beside something else.
 *   meta      Bylines, dates, reading times, counts.
 *
 * Weights are 400 for body, 500 for meta emphasis and the display headline, and
 * 600 for the smaller headings. There is no 700 in the block. Tones are
 * `text-foreground`, `text-muted-foreground`, and `text-primary` for links
 * inside prose, and there is no fourth.
 *
 * The display weight is the one that looks inconsistent written down and is not.
 * Weight and size both carry emphasis, so they trade against each other: at 48px
 * a 500 already reads as the heaviest thing on the page, while a 600 at that
 * size reads as a headline shouting over the sentence it introduces. At 24px the
 * section headings have no such size advantage and need the 600 to hold their
 * place above body text. Same optical weight, two different numbers.
 *
 * ---------------------------------------------------------------------------
 * WHY THE TRACKING IS `tracking-tight` AND NEVER TIGHTER
 * ---------------------------------------------------------------------------
 * A display size wants negative tracking, and how much depends entirely on the
 * typeface. This block does not know the typeface: it inherits whatever the
 * consumer set on `--font-sans`, which might be a geometric sans that needs
 * -0.04em or a humanist serif that falls apart below -0.01em. `tracking-tight`
 * is -0.025em, which improves a large heading in almost every face and breaks
 * none of them. Tune it in your own app once you know your font; do not tune it
 * here, where it has to be right for everybody's.
 *
 * ---------------------------------------------------------------------------
 * THE SPACING RULE, WHICH IS NOT NEGOTIABLE
 * ---------------------------------------------------------------------------
 * **No component in this block sets its own outer margin.** Pages compose with
 * a flex column and a `gap`, and that is the only mechanism.
 *
 * The rule exists because the alternative failed in a specific and invisible
 * way. Every component used to carry its own `mt-*`, several carried none, and
 * the ones that carried none were exactly the ones that collided: the category
 * pills sat flush against the post grid, and the byline sat flush against the
 * table of contents, both at a measured zero pixels, on the production site,
 * for as long as the block existed. A missing margin is silent. A missing item
 * in a flex column is impossible.
 *
 * `SECTION_GAP` is the rhythm between top-level regions of a page.
 * `CLUSTER_GAP` is the rhythm between things that belong together.
 *
 * @see styles/agentblog.css for the three layout rails these compose against.
 */

/** Page H1. One per route, and it never changes on page 2 of a paginated list. */
export const DISPLAY =
  'text-foreground text-4xl font-medium tracking-tight text-balance sm:text-5xl'

/**
 * The sentence under the H1. Capped at the reading measure so it stays readable
 * on the wide rail, where the grid beside it is three times as wide.
 */
export const LEDE =
  'text-muted-foreground max-w-(--agentblog-measure) text-lg leading-relaxed text-pretty sm:text-xl'

/** An H2 outside the article body: Sources, Related posts, Areas of expertise. */
export const SECTION_HEADING = 'text-foreground text-2xl font-semibold tracking-tight text-balance'

/** The small capitalised label above a section or beside a control. */
export const EYEBROW = 'text-muted-foreground text-xs font-medium tracking-wider uppercase'

/** Bylines, dates, reading times, post counts. */
export const META = 'text-muted-foreground text-sm'

/** Between top-level regions of a page. */
export const SECTION_GAP = 'flex flex-col gap-12 sm:gap-14'

/** Between things that belong to each other: a heading and its list, pills and their grid. */
export const CLUSTER_GAP = 'flex flex-col gap-6'

/** The header block on every route: breadcrumb, then the title cluster. */
export const PAGE_HEADER = 'flex flex-col items-start gap-6'

/**
 * Inside the title cluster: H1, then whatever belongs to it. A lede and a count
 * line on a list page, the byline and the answer capsule on a post.
 */
export const TITLE_CLUSTER = 'flex flex-col gap-4'
