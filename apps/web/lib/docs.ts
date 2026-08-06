/**
 * The docs index.
 *
 * Docs are plain Markdown files with frontmatter under `content/docs/`. Plain
 * Markdown rather than MDX for one reason: every page has to be servable as raw
 * text at `/docs/<slug>.md` and concatenated into `/docs/llms-full.txt`. MDX
 * with custom components would mean the Markdown variant carries JSX a reader
 * cannot use, which defeats the point of shipping it.
 *
 * Reads are synchronous and happen at module scope during the build. Every docs
 * route is statically generated, so this never runs at request time.
 *
 * Docs prose is licensed CC BY 4.0. See `content/docs/licensing.md`.
 */
import 'server-only'

import fs from 'node:fs'
import path from 'node:path'

import matter from 'gray-matter'

export interface DocMeta {
  readonly slug: string
  readonly title: string
  readonly description: string
  readonly group: string
  readonly order: number
}

export interface Doc extends DocMeta {
  /** Markdown body with frontmatter removed. */
  readonly body: string
}

/**
 * Sidebar order. A page whose `group` is not in this list still renders, but it
 * sorts last, which is the visible symptom of a typo in frontmatter.
 */
export const DOC_GROUPS = [
  'Getting started',
  'Reference',
  'Writing',
  'Operations',
  'Project',
] as const

const DOCS_DIR = path.join(process.cwd(), 'content', 'docs')

function readAll(): Doc[] {
  const entries = fs.readdirSync(DOCS_DIR).filter((name) => name.endsWith('.md'))

  const docs = entries.map((name): Doc => {
    const raw = fs.readFileSync(path.join(DOCS_DIR, name), 'utf8')
    const parsed = matter(raw)
    const data = parsed.data as Partial<Record<keyof DocMeta, unknown>>

    const slug = name.replace(/\.md$/, '')
    if (typeof data.title !== 'string') {
      throw new Error(`content/docs/${name} is missing a string \`title\` in its frontmatter.`)
    }
    if (typeof data.description !== 'string') {
      throw new Error(
        `content/docs/${name} is missing a string \`description\`. It is used as the meta description and in llms.txt.`,
      )
    }

    return {
      slug,
      title: data.title,
      description: data.description,
      group: typeof data.group === 'string' ? data.group : 'Reference',
      order: typeof data.order === 'number' ? data.order : 999,
      body: parsed.content.trim(),
    }
  })

  return docs.sort((a, b) => {
    const groupDelta = groupRank(a.group) - groupRank(b.group)
    if (groupDelta !== 0) return groupDelta
    if (a.order !== b.order) return a.order - b.order
    return a.title.localeCompare(b.title)
  })
}

function groupRank(group: string): number {
  const index = (DOC_GROUPS as readonly string[]).indexOf(group)
  return index === -1 ? DOC_GROUPS.length : index
}

/** Every doc, sorted by group then by `order`. */
export function getAllDocs(): Doc[] {
  return readAll()
}

export function getDoc(slug: string): Doc | null {
  return readAll().find((doc) => doc.slug === slug) ?? null
}

/**
 * The page `/docs` renders. Kept as a named constant because three routes need
 * to agree on which page is the index: the optional catch-all, `llms.txt`, and
 * the Markdown variant handler.
 */
export const DOCS_INDEX_SLUG = 'introduction'

/** Sidebar shape: groups in `DOC_GROUPS` order, each carrying its own pages. */
export function getDocNav(): { group: string; docs: DocMeta[] }[] {
  const grouped = new Map<string, DocMeta[]>()
  for (const doc of readAll()) {
    const bucket = grouped.get(doc.group)
    if (bucket === undefined) grouped.set(doc.group, [doc])
    else bucket.push(doc)
  }
  return [...grouped.entries()].map(([group, docs]) => ({ group, docs }))
}
