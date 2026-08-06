/**
 * Table of contents extraction from markdown source, with no dependencies.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS IS FOR, AND WHAT CALLS IT TODAY
 * ---------------------------------------------------------------------------
 * Two exports, with different standing.
 *
 * `TocEntry` is the shared TOC type. `remarkExtractToc`, `renderMdx`, and
 * `<TableOfContents>` all speak it, which is why the interface lives in a
 * dependency-free module rather than next to the remark plugin.
 *
 * `extractToc` is a supported public helper that **nothing in the block calls**.
 * That is deliberate and is not an oversight to be fixed by wiring it in: the
 * rendered TOC comes from `remarkExtractToc` during the same compile that
 * produces the article (see `lib/render-mdx.tsx`), and computing it twice would
 * give two answers that can disagree. This function exists for callers that
 * must not compile MDX, which is every caller running outside a render: a
 * content linter, an editor preview, a migration script, a custom
 * `ContentSource` that wants an outline without a React tree.
 *
 * If you add a caller, say so here. If you find yourself calling it from a route
 * that has already rendered the post, use the compiler's TOC instead.
 *
 * ---------------------------------------------------------------------------
 * THE IDS MUST MATCH `rehype-slug`, EXACTLY
 * ---------------------------------------------------------------------------
 * The rendered headings get their `id` from `rehype-slug`, which uses the
 * `github-slugger` algorithm. If this file produced different ids the TOC would
 * render links to anchors that do not exist, and the failure would be a link
 * that silently does nothing rather than an error anyone sees.
 *
 * The algorithm, in full:
 *
 *   1. lowercase
 *   2. remove every character that is not a letter, a digit, an underscore,
 *      whitespace, or a hyphen
 *   3. replace runs of whitespace with a single hyphen
 *   4. if that id has already been used in this document, append `-1`, then
 *      `-2`, and so on until it is unique
 *
 * Step 4 is why this function walks the document rather than mapping over
 * headings independently: two sections both titled "Overview" must produce
 * `overview` and `overview-1`, in document order.
 *
 * ---------------------------------------------------------------------------
 * FENCED CODE IS SKIPPED
 * ---------------------------------------------------------------------------
 * A shell sample containing `# install dependencies` is a comment, not a
 * heading, and a TOC that lists it looks broken to a reader and to a crawler
 * parsing the outline. The line walk tracks fence state for backtick and tilde
 * fences, including the rule that a closing fence must be at least as long as
 * the opening one and use the same character.
 */

/** H2 and H3 only. H4 and deeper make a TOC longer than the section it indexes. */
const HEADING = /^[ \t]{0,3}(#{2,3})[ \t]+(.+?)[ \t]*#*[ \t]*$/
const FENCE = /^[ \t]{0,3}(`{3,}|~{3,})/
const FRONTMATTER_FENCE = /^-{3,}[ \t]*$/

export interface TocEntry {
  readonly id: string
  readonly text: string
  readonly depth: 2 | 3
}

/**
 * The `github-slugger` character filter. Unicode aware, so a heading written in
 * a non Latin script keeps its characters instead of collapsing to an empty id.
 */
function slugifyOnce(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_\s-]/gu, '')
    .replace(/\s+/g, '-')
}

/**
 * Reduce heading markdown to the text a reader sees.
 *
 * Kept deliberately small: it handles the inline syntax that actually shows up
 * in headings (code spans, emphasis, links, escapes) and nothing else.
 */
function headingText(raw: string): string {
  return raw
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\[[^\]]*\]/g, '$1')
    .replace(/`+([^`]*)`+/g, '$1')
    .replace(/<\/?[A-Za-z][^>]*>/g, '')
    .replace(/[*_~]+/g, '')
    .replace(/\\([\\`*_{}[\]()#+\-.!])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

/** `overview`, then `overview-1`, then `overview-2`, as github-slugger does. */
function uniqueId(base: string, used: Map<string, number>): string {
  const seen = used.get(base)
  if (seen === undefined) {
    used.set(base, 0)
    return base
  }

  let next = seen + 1
  let candidate = `${base}-${next}`
  // A heading literally named "Overview 1" can already have taken `overview-1`.
  while (used.has(candidate)) {
    next += 1
    candidate = `${base}-${next}`
  }

  used.set(base, next)
  used.set(candidate, 0)
  return candidate
}

/**
 * Every H2 and H3 in a markdown or MDX document, in order, with the ids
 * `rehype-slug` will put on the rendered headings.
 *
 * Returns `[]` rather than throwing for any input, including an empty string.
 * A post with no headings is a valid post; it just has no TOC.
 */
export function extractToc(markdown: string): TocEntry[] {
  const lines = markdown.split(/\r?\n/)
  const entries: TocEntry[] = []
  // Counts per base slug, so the dedupe suffix matches github-slugger's.
  const used = new Map<string, number>()

  let fence: string | null = null
  let index = 0

  // Skip a frontmatter block, so a `#` line inside YAML is never a heading.
  const first = lines[0]
  if (first !== undefined && FRONTMATTER_FENCE.test(first)) {
    index = 1
    while (index < lines.length && !FRONTMATTER_FENCE.test(lines[index] ?? '')) index += 1
    index += 1
  }

  for (; index < lines.length; index += 1) {
    const line = lines[index]
    if (line === undefined) continue

    const fenceMatch = FENCE.exec(line)
    const marker = fenceMatch?.[1]
    if (marker !== undefined) {
      if (fence === null) fence = marker
      else if (marker[0] === fence[0] && marker.length >= fence.length) fence = null
      continue
    }
    if (fence !== null) continue

    const match = HEADING.exec(line)
    const hashes = match?.[1]
    const body = match?.[2]
    if (hashes === undefined || body === undefined) continue

    const text = headingText(body)
    if (text === '') continue

    entries.push({
      id: uniqueId(slugifyOnce(text), used),
      text,
      depth: hashes.length === 2 ? 2 : 3,
    })
  }

  return entries
}
