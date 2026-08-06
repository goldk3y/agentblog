/**
 * The Markdown variant of every docs page, served at `/docs/<slug>.md`.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS ROUTE IS NOT AT `/docs/[slug].md`
 * ---------------------------------------------------------------------------
 * App Router segments are path segments, not filename patterns, so there is no
 * way to express "the same path with a `.md` suffix" in the route tree. A page
 * and a route handler also cannot occupy the same segment folder, which rules
 * out handling the extension inside the docs page itself.
 *
 * So `next.config.ts` rewrites `/docs/:slug.md` to `/docs-md/:slug` and this
 * handler answers it. The rewrite runs before routing, so the public URL is the
 * one documented: `/docs/installation.md`. This path is reachable directly too,
 * which is harmless and occasionally useful when debugging the rewrite.
 *
 * The `:slug` parameter in `path-to-regexp` is lazy by default, so `.md` matches
 * as a literal suffix rather than being swallowed by the parameter.
 *
 * Content is the raw Markdown source with the YAML frontmatter replaced by an H1
 * and a source link. A reader fetching `.md` wants the prose, not our sidebar
 * ordering metadata.
 */
import { absoluteUrl } from '@/lib/config'
import { getAllDocs, getDoc } from '@/lib/docs'

export const dynamic = 'force-static'
export const dynamicParams = false

export function generateStaticParams(): { slug: string }[] {
  return getAllDocs().map((doc) => ({ slug: doc.slug }))
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await context.params
  const doc = getDoc(slug)

  if (doc === null) {
    return new Response('Not found\n', {
      status: 404,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    })
  }

  const markdown = [
    `# ${doc.title}`,
    '',
    `> ${doc.description}`,
    '',
    `Source: ${absoluteUrl(`/docs/${doc.slug}`)}`,
    'License: CC BY 4.0. Attribution: agentblog.dev',
    '',
    '---',
    '',
    doc.body,
    '',
  ].join('\n')

  return new Response(markdown, {
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      'cache-control': 'public, max-age=0, must-revalidate',
    },
  })
}
