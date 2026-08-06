/**
 * `/docs/llms.txt`.
 *
 * An index of this documentation in the llmstxt.org shape, for agents that have
 * already been pointed here and need to read it cheaply. This exists for `/docs`
 * and nowhere else: the blog block ships no `llms.txt`, and the reasoning for
 * the split is at `/docs/no-llms-txt`.
 *
 * A folder named `llms.txt` is a static segment, so it takes precedence over the
 * sibling `[[...slug]]` catch-all that renders the docs pages.
 *
 * Each entry links to the `.md` variant rather than the HTML page, because the
 * point of the file is token efficiency and linking to HTML would waste it.
 */
import { absoluteUrl } from '@/lib/config'
import { DOC_GROUPS, getAllDocs } from '@/lib/docs'

export const dynamic = 'force-static'

export function GET(): Response {
  const docs = getAllDocs()

  const lines: string[] = [
    '# AgentBlog',
    '',
    '> An SEO and GEO complete blog for Next.js 16, installed into an existing app as files the',
    '> consumer owns. Prerendered HTML for AI crawlers, a connected JSON-LD graph, sitemap, RSS,',
    '> IndexNow, Open Graph images, and agent skills that write and audit posts.',
    '',
    'Install: `npx agentblog@latest init`, or `npx shadcn@latest add @agentblog/blog` followed by',
    '`npx agentblog@latest doctor --fix`. Requires Next.js 16 App Router, React 19, Tailwind v4,',
    'and a `components.json`.',
    '',
    'Every page below is also available as HTML at the same URL without the `.md` suffix.',
    `The full text of all pages is at ${absoluteUrl('/docs/llms-full.txt')}.`,
    '',
    'Documentation prose is licensed CC BY 4.0. Attribution: agentblog.dev',
    '',
  ]

  for (const group of DOC_GROUPS) {
    const inGroup = docs.filter((doc) => doc.group === group)
    if (inGroup.length === 0) continue

    lines.push(`## ${group}`, '')
    for (const doc of inGroup) {
      lines.push(`- [${doc.title}](${absoluteUrl(`/docs/${doc.slug}.md`)}): ${doc.description}`)
    }
    lines.push('')
  }

  return new Response(lines.join('\n'), {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=0, must-revalidate',
    },
  })
}
