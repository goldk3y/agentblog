/**
 * Markdown to HTML for the docs pages.
 *
 * A plain unified pipeline rather than the block's MDX renderer. The two have
 * different jobs: `registry/blog/lib/mdx.tsx` compiles MDX with a component map
 * a consumer can extend, and is the only place in the block MDX is compiled.
 * Docs are text with code blocks and tables, and a pipeline that produces an
 * HTML string is both simpler and easier to keep identical to the `.md` variant
 * we serve alongside it.
 *
 * `rehype-pretty-code` runs Shiki at build time and emits `--shiki-light` and
 * `--shiki-dark` custom properties per token. `keepBackground: false` leaves the
 * block background to `globals.css`, so a highlighted block sits on the same
 * surface as an unhighlighted one in both themes.
 */
import 'server-only'

import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import type { Options as AutolinkOptions } from 'rehype-autolink-headings'
import rehypePrettyCode from 'rehype-pretty-code'
import rehypeSlug from 'rehype-slug'
import rehypeStringify from 'rehype-stringify'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'

import GithubSlugger from 'github-slugger'

export interface DocHeading {
  readonly id: string
  readonly text: string
  readonly depth: 2 | 3
}

/*
 * Annotated rather than inlined at the call site. `.use()` is overloaded, so an
 * inline object literal is checked against a union of tuple types with no
 * contextual type available, and `behavior: 'wrap'` widens to `string`.
 */
const autolinkOptions: AutolinkOptions = {
  behavior: 'wrap',
  properties: { className: ['heading-anchor'] },
}

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype)
  .use(rehypeSlug)
  .use(rehypeAutolinkHeadings, autolinkOptions)
  .use(rehypePrettyCode, {
    theme: { light: 'github-light', dark: 'github-dark' },
    keepBackground: false,
  })
  .use(rehypeStringify, { allowDangerousHtml: true })

export async function renderMarkdown(source: string): Promise<string> {
  const file = await processor.process(source)
  return String(file)
}

/**
 * Headings for the "on this page" rail.
 *
 * Extracted from the Markdown source rather than from the rendered HTML so the
 * slugs are computed the same way `rehype-slug` computes them: both use
 * `github-slugger`, including its duplicate-suffix behaviour. Deriving them any
 * other way produces anchors that are right until two sections share a title.
 *
 * Fenced code blocks are skipped, because a `#` inside a shell snippet is a
 * comment, not a heading.
 */
export function extractHeadings(source: string): DocHeading[] {
  const slugger = new GithubSlugger()
  const headings: DocHeading[] = []
  let insideFence = false

  for (const line of source.split('\n')) {
    if (line.startsWith('```')) {
      insideFence = !insideFence
      continue
    }
    if (insideFence) continue

    const match = /^(#{2,3})\s+(.+?)\s*$/.exec(line)
    if (match === null) continue

    const hashes = match[1]
    const rawText = match[2]
    if (hashes === undefined || rawText === undefined) continue

    // Strip inline code ticks and link syntax so the rail reads as prose.
    const text = rawText.replace(/`/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')

    headings.push({
      id: slugger.slug(text),
      text,
      depth: hashes.length === 2 ? 2 : 3,
    })
  }

  return headings
}
