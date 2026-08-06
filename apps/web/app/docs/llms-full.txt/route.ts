/**
 * `/docs/llms-full.txt`.
 *
 * Every documentation page concatenated, in sidebar order, as Markdown. One
 * fetch instead of sixteen, which is the actual token saving the llms.txt
 * convention is good for.
 *
 * Frontmatter is replaced by an H1 and a source URL rather than being emitted
 * raw, because YAML keys in the middle of a concatenated document are noise to
 * the reader this file exists for.
 */
import { absoluteUrl } from '@/lib/config'
import { getAllDocs } from '@/lib/docs'

export const dynamic = 'force-static'

export function GET(): Response {
  const docs = getAllDocs()

  const header = [
    '# AgentBlog documentation',
    '',
    'An SEO and GEO complete blog for Next.js 16, installed into an existing app as files the',
    'consumer owns. This file is every documentation page concatenated in reading order.',
    '',
    `Source: ${absoluteUrl('/docs')}`,
    'License: CC BY 4.0. Attribution: agentblog.dev',
    '',
    '---',
    '',
  ].join('\n')

  const body = docs
    .map((doc) =>
      [
        `# ${doc.title}`,
        '',
        `> ${doc.description}`,
        '',
        `Source: ${absoluteUrl(`/docs/${doc.slug}`)}`,
        '',
        doc.body,
        '',
        '---',
        '',
      ].join('\n'),
    )
    .join('\n')

  return new Response(`${header}${body}`, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=0, must-revalidate',
    },
  })
}
