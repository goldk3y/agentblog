/**
 * `<Faq>` - question and answer pairs, rendered with `<details>` and CSS.
 *
 * ---------------------------------------------------------------------------
 * THE RULE THIS COMPONENT EXISTS TO ENFORCE
 * ---------------------------------------------------------------------------
 * `lib/schema.ts` emits `FAQPage` JSON-LD from `post.faq`. Google's structured
 * data policy permits that markup only when the questions and answers are
 * genuinely visible to a reader on the page. Marking up FAQs that are not
 * rendered is a guidelines violation, and it is the most common way a blog
 * trips one.
 *
 * So the coupling is deliberate and it runs in one direction: the post route
 * renders this component from the same `post.faq` array that `buildFaq()` in
 * `lib/schema.ts` serialises. If you stop rendering the FAQ section, stop
 * emitting the schema in the same commit.
 *
 * ---------------------------------------------------------------------------
 * WHY `<details>` AND NEVER A CONDITIONAL MOUNT
 * ---------------------------------------------------------------------------
 * A React accordion that mounts its panel on click puts the answers nowhere in
 * the HTML. Every AI crawler reads the raw HTML your server returned and does
 * not click anything, so a JavaScript-mounted FAQ is invisible to exactly the
 * readers the schema was for, while the schema still claims the content is
 * visible. That combination is the worst of both.
 *
 * `<details>` collapses with CSS. The answer text is in the document either
 * way, closed or open, which is what makes the markup honest. This is the same
 * reason `TableOfContents` avoids conditional mounting.
 *
 * @see https://docs.agentblog.dev/concepts/geo-playbook
 * @see lib/schema.ts, `buildFaq`
 */
import { CLUSTER_GAP, SECTION_HEADING } from '@/components/blog/type-scale'
import type { FaqEntry } from '@/lib/types'
import { cn } from '@/lib/utils'

/**
 * The section heading text.
 *
 * `lib/render-mdx.tsx` passes this string to `remarkExtractToc` as a
 * `trailingHeadings` entry, which is what gets an id issued for it by the same
 * slugger that issued every body heading id. So this constant is not only the
 * visible text: it is the input the id is derived from, and changing it changes
 * the anchor.
 *
 * @see lib/mdx-plugins/remark-extract-toc.ts, `trailingHeadings`
 */
export const FAQ_HEADING = 'Frequently asked questions'

/**
 * The id this heading gets when nobody allocated one for it.
 *
 * It is `github-slugger`'s slug of `FAQ_HEADING`, so it is the id the
 * allocation produces in the ordinary case where no body heading claimed the
 * name first. Keep the two in step.
 *
 * The post route does NOT use this. It passes `faqHeadingId` from `renderMdx`,
 * which is collision-checked against the body. The previous value here was the
 * hardcoded `'faq'`, which the slugger had never issued: a post with a body H2
 * titled "FAQ" then shipped two `<h2 id="faq">` and a contents link that landed
 * on the wrong one. Do not reintroduce a short, guessable id here.
 */
export const FAQ_HEADING_ID = 'frequently-asked-questions'

export interface FaqProps {
  readonly items: readonly FaqEntry[]
  /** Section heading, rendered as an H2. */
  readonly heading?: string | undefined
  /**
   * `id` on the H2. Every H2 and H3 in this block carries a stable id, because
   * an anchor a reader can link to is worth more than the markup costs.
   *
   * The post route passes `faqHeadingId` from `renderMdx`, which is the only id
   * that has been checked against the post's own body headings. Pass something
   * else only when you know it is unused on the page: two elements sharing an
   * id makes both anchors ambiguous, and the browser resolves `#id` to the
   * first one in document order.
   */
  readonly headingId?: string | undefined
  /**
   * Render every entry expanded. Closed is the default and costs nothing for
   * extraction, since the text is in the HTML regardless.
   */
  readonly defaultOpen?: boolean | undefined
}

export function Faq({
  items,
  heading = FAQ_HEADING,
  headingId = FAQ_HEADING_ID,
  defaultOpen = false,
}: FaqProps) {
  if (items.length === 0) return null

  return (
    // No outer margin. The post route composes this into a flex column with the
    // rest of the article, and a margin here would add to that gap rather than
    // replace it. See `components/blog/type-scale.ts`.
    <section className={CLUSTER_GAP}>
      <h2 className={cn(SECTION_HEADING, 'scroll-mt-24')} id={headingId}>
        {heading}
      </h2>
      <div className="divide-border border-border divide-y overflow-hidden rounded-xl border">
        {items.map((item) => (
          <details key={item.question} open={defaultOpen} className="agentblog-faq group">
            <summary className="text-foreground hover:bg-muted flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-base font-medium transition-colors">
              {item.question}
              <span
                aria-hidden="true"
                className="text-muted-foreground shrink-0 transition-transform group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <div className="text-muted-foreground px-5 pb-5 text-sm leading-relaxed text-pretty">
              {item.answer}
            </div>
          </details>
        ))}
      </div>
    </section>
  )
}

export default Faq
