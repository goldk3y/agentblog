/**
 * `remarkExtractToc` - build the table of contents on the server, once.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS IS
 * ---------------------------------------------------------------------------
 * A remark (mdast) plugin that walks the parsed document, collects every H2 and
 * H3, and writes the result to `file.data.toc`. `lib/render-mdx.tsx` lifts that
 * value out of the vfile and returns it alongside the rendered content, so a
 * post route gets its TOC from the same compile that produced the article.
 *
 * ---------------------------------------------------------------------------
 * WHY IT IS A COMPILE-TIME PLUGIN AND NOT CLIENT CODE
 * ---------------------------------------------------------------------------
 * The obvious alternative is a `useEffect` that queries `document` for headings
 * after mount. That fails the one requirement this project exists to meet: AI
 * crawlers do not execute JavaScript, so a client-built TOC is invisible to
 * them, and the in-page anchor links that give retrieval systems clean section
 * boundaries never appear in the HTML at all. Building it here means the list
 * ships in the first response byte.
 *
 * ---------------------------------------------------------------------------
 * THE ID PARITY REQUIREMENT (the thing that breaks if you edit carelessly)
 * ---------------------------------------------------------------------------
 * The `id` computed here must be byte-identical to the `id` that `rehype-slug`
 * writes onto the rendered heading, or every TOC link is a dead anchor. Two
 * rules keep that true:
 *
 *   1. We use `github-slugger`, which is the exact module `rehype-slug` itself
 *      uses. It is already in the tree as a transitive dependency of
 *      `rehype-slug`, but we declare it explicitly because relying on another
 *      package's private tree is unsound under strict package managers and
 *      would break the day `rehype-slug` swaps implementations.
 *   2. We call `slugger.slug()` for headings of *every* depth, not only the
 *      H2s and H3s we keep. The slugger's duplicate counter is stateful: two
 *      headings named "Setup" produce `setup` and `setup-1`. Skipping an H4
 *      named "Setup" here while `rehype-slug` counts it would silently shift
 *      every later duplicate suffix by one.
 *
 * A third, subtler point: `rehype-slug` reads heading text from hast, after MDX
 * compilation. `headingText` below mirrors hast's behaviour rather than
 * mdast's default, which is why images contribute nothing (an `<img>` element
 * has no text) and raw HTML is skipped.
 *
 * @see https://agentblog.dev/docs/blog-block
 * @see https://agentblog.dev/docs/geo-playbook*/
import GithubSlugger from 'github-slugger'
import type { Heading, Nodes, Root } from 'mdast'
import type { VFile } from 'vfile'

import type { TocEntry } from '@/lib/toc'

declare module 'vfile' {
  interface DataMap {
    /** Written by `remarkExtractToc`. Read by `renderMdx` in `lib/render-mdx.tsx`. */
    toc: TocEntry[]
    /**
     * One entry per `trailingHeadings` option, in the order given. Written by
     * `remarkExtractToc`, read by `renderMdx` in `lib/render-mdx.tsx`.
     */
    trailingToc: TocEntry[]
  }
}

/** Depths that reach the reader. H1 comes from frontmatter; H4 and below are too fine to list. */
const TOC_DEPTHS = new Set<number>([2, 3])

export interface ExtractTocOptions {
  /**
   * Headings a route renders AFTER the compiled body, named by their visible
   * text. The FAQ section is the one this exists for: `<Faq>` is rendered by
   * `app/blog/[slug]/page.tsx` from frontmatter, outside the MDX, so no walk of
   * this tree can ever discover it.
   *
   * ---------------------------------------------------------------------------
   * WHY THE ROUTE CANNOT JUST PICK AN ID
   * ---------------------------------------------------------------------------
   * It did, and it shipped a bug. The FAQ heading id was the hardcoded string
   * `faq`, which the slugger below had never issued and therefore never
   * reserved. A post with a body H2 titled "FAQ" slugged to `faq` through
   * `rehype-slug` and the page went out with two `<h2 id="faq">`, two
   * `href="#faq"` entries in the table of contents, and a "Frequently asked
   * questions" link that scrolled to the body heading, because a duplicate id
   * resolves to the first match in the document.
   *
   * Passing the text here instead puts the id through the SAME slugger
   * instance, after the whole body has been walked, so it participates in the
   * duplicate counter exactly as a body heading would. A post that already used
   * the name gets the usual `-1` suffix and the two elements stay distinct.
   *
   * The reservation is unconditional and costs nothing when the route decides
   * not to render the section: it happens after the last body heading, so no
   * body id can shift because of it, and `rehype-slug` runs its own slugger
   * over the compiled body alone and never sees this call at all.
   */
  readonly trailingHeadings?: readonly string[] | undefined
}

export function remarkExtractToc(options: ExtractTocOptions = {}) {
  return (tree: Root, file: VFile): undefined => {
    const slugger = new GithubSlugger()
    const toc: TocEntry[] = []

    forEachHeading(tree, (heading) => {
      const text = headingText(heading)
      // Called for every depth on purpose. See "THE ID PARITY REQUIREMENT".
      const id = slugger.slug(text)
      if (TOC_DEPTHS.has(heading.depth) && text.length > 0) {
        toc.push({ id, text, depth: heading.depth as 2 | 3 })
      }
    })

    file.data.toc = toc

    // After the body walk, never before it. See `trailingHeadings`.
    file.data.trailingToc = (options.trailingHeadings ?? []).map((text) => ({
      id: slugger.slug(text),
      text,
      depth: 2 as const,
    }))
  }
}

/**
 * Visit every heading in document order.
 *
 * Written inline rather than pulled from `unist-util-visit` to keep this
 * plugin's npm surface at exactly one package. Headings nested inside a
 * blockquote or a list item are reached too, because `rehype-slug` reaches them
 * and the duplicate counter has to stay in step.
 */
function forEachHeading(node: Nodes, visit: (heading: Heading) => void): undefined {
  if (node.type === 'heading') visit(node)
  if ('children' in node) {
    for (const child of node.children) forEachHeading(child, visit)
  }
}

/**
 * The text a reader sees in a heading.
 *
 * Mirrors `hast-util-to-string`, which is what `rehype-slug` uses: text and
 * inline code contribute their value, everything else contributes only through
 * its children. Notably an image contributes nothing, because after compilation
 * it is an `<img>` element with no text content.
 */
function headingText(node: Nodes): string {
  if (node.type === 'text' || node.type === 'inlineCode') return node.value
  if ('children' in node) {
    let out = ''
    for (const child of node.children) out += headingText(child)
    return out
  }
  return ''
}
