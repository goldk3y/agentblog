/**
 * `/docs.md`, rewritten here from `next.config.ts`.
 *
 * The Markdown variant of the docs index. It returns the introduction page plus
 * a table of contents, which is what someone appending `.md` to `/docs` is
 * asking for. See the sibling `[slug]/route.ts` for why the rewrite exists.
 */
import { absoluteUrl } from '@/lib/config'
import { DOCS_INDEX_SLUG, getAllDocs, getDoc } from '@/lib/docs'

export const dynamic = 'force-static'

export function GET(): Response {
  const doc = getDoc(DOCS_INDEX_SLUG)
  const contents = getAllDocs()
    .map((entry) => `- [${entry.title}](${absoluteUrl(`/docs/${entry.slug}.md`)})`)
    .join('\n')

  const markdown = [
    '# AgentBlog documentation',
    '',
    `Source: ${absoluteUrl('/docs')}`,
    'License: CC BY 4.0. Attribution: agentblog.dev',
    '',
    '## Contents',
    '',
    contents,
    '',
    '---',
    '',
    doc?.body ?? '',
    '',
  ].join('\n')

  return new Response(markdown, {
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      'cache-control': 'public, max-age=0, must-revalidate',
    },
  })
}
