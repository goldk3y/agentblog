/**
 * The three URLs every page has, in one place.
 *
 * A page is served as HTML at `page.url`, as Markdown at the same path with
 * `.md` appended, and as an Open Graph image under `/og`. The index page is the
 * awkward one: its URL is `/`, so its Markdown variant has to be `/index.md`
 * rather than `/.md`, and the route handler has to map that back. Three callers
 * need to agree on that rule, so it is written once.
 */
import type { DocsPageEntry } from '@/lib/source'

/** The Markdown variant of a page, the URL served to an agent that asks for text. */
export function markdownUrl(page: DocsPageEntry): string {
  return page.url === '/' ? '/index.md' : `${page.url}.md`
}

/**
 * The Open Graph image for a page.
 *
 * `image.png` is appended to the slugs so the route can be a catch-all whose
 * last segment is a filename, which is what makes the URL look like a file to
 * the social scrapers that insist on one.
 */
export function ogImageSegments(page: DocsPageEntry): string[] {
  return [...page.slugs, 'image.png']
}

export function ogImageUrl(page: DocsPageEntry): string {
  return `/og/${ogImageSegments(page).join('/')}`
}

/** Where a page's source file lives on GitHub. */
export function githubSourceUrl(page: DocsPageEntry, repoUrl: string): string {
  return `${repoUrl}/blob/main/apps/docs/content/docs/${page.path}`
}
