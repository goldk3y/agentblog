/**
 * Every documentation page.
 *
 * An optional catch-all so `/docs` and `/docs/<slug>` are one route. The static
 * segments beside it, `llms.txt` and `llms-full.txt`, take precedence over the
 * catch-all because Next.js matches static segments first.
 *
 * `dynamicParams = false` means an unknown slug is a 404 rather than a
 * render attempt, which is what you want for a set of pages that is fully known
 * at build time.
 *
 * The page props are typed by hand rather than through `PageProps` from
 * `next typegen`, because the generated global is not available until typegen has
 * run at least once and this file has to compile in a clean checkout. The shape
 * below is what typegen emits for an optional catch-all.
 */
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { ArrowRight, FileText } from '@/components/site/icons'
import { absoluteUrl } from '@/lib/config'
import { DOCS_INDEX_SLUG, getAllDocs, getDoc } from '@/lib/docs'
import { extractHeadings, renderMarkdown } from '@/lib/render-markdown'

interface DocsPageProps {
  readonly params: Promise<{ slug?: string[] }>
}

export const dynamicParams = false

export function generateStaticParams(): { slug: string[] }[] {
  // `{ slug: [] }` is the `/docs` entry itself.
  return [{ slug: [] }, ...getAllDocs().map((doc) => ({ slug: [doc.slug] }))]
}

function resolveSlug(segments: string[] | undefined): string {
  const first = segments?.[0]
  return first === undefined || first === '' ? DOCS_INDEX_SLUG : first
}

export async function generateMetadata({ params }: DocsPageProps): Promise<Metadata> {
  const { slug } = await params
  const doc = getDoc(resolveSlug(slug))
  if (doc === null) return {}

  const path = slug === undefined || slug.length === 0 ? '/docs' : `/docs/${doc.slug}`

  return {
    title: doc.title,
    description: doc.description,
    alternates: {
      canonical: path,
      types: { 'text/markdown': [{ url: absoluteUrl(`/docs/${doc.slug}.md`), title: doc.title }] },
    },
    openGraph: {
      type: 'article',
      title: doc.title,
      description: doc.description,
      url: absoluteUrl(path),
      siteName: 'AgentBlog',
    },
  }
}

export default async function DocsPage({ params }: DocsPageProps) {
  const { slug } = await params
  const current = resolveSlug(slug)
  const doc = getDoc(current)
  if (doc === null) notFound()

  const html = await renderMarkdown(doc.body)
  const headings = extractHeadings(doc.body)

  const all = getAllDocs()
  const index = all.findIndex((entry) => entry.slug === current)
  const previous = index > 0 ? all[index - 1] : undefined
  const next = index >= 0 && index < all.length - 1 ? all[index + 1] : undefined

  return (
    <div className="flex min-w-0 gap-12">
      <article className="min-w-0 flex-1">
        <p className="text-muted-foreground font-mono text-xs tracking-wider uppercase">
          {doc.group}
        </p>
        <h1 className="mt-3 font-serif text-4xl leading-[1.1] font-semibold tracking-tight text-balance">
          {doc.title}
        </h1>
        <p className="text-muted-foreground mt-4 max-w-2xl text-lg leading-relaxed">
          {doc.description}
        </p>

        <a
          href={`/docs/${doc.slug}.md`}
          className="border-border text-muted-foreground hover:text-foreground mt-6 inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 font-mono text-xs transition-colors"
        >
          <FileText className="size-3.5" />
          View as Markdown
        </a>

        <hr className="border-border mt-10" />

        {/*
          The rendered Markdown is generated at build time from a file in this
          repository, never from user input, so there is no injection surface
          here. `allowDangerousHtml` is enabled in the pipeline so that raw HTML
          in a docs page passes through.
        */}
        <div className="docs-prose mt-10" dangerouslySetInnerHTML={{ __html: html }} />

        <nav
          aria-label="Pagination"
          className="border-border mt-20 grid gap-4 border-t pt-8 sm:grid-cols-2"
        >
          {previous !== undefined ? (
            <Link
              href={`/docs/${previous.slug}`}
              className="border-border hover:bg-accent rounded-lg border p-4 transition-colors"
            >
              <span className="text-muted-foreground text-xs">Previous</span>
              <span className="text-foreground mt-1 block text-sm font-medium">
                {previous.title}
              </span>
            </Link>
          ) : (
            <span />
          )}
          {next !== undefined && (
            <Link
              href={`/docs/${next.slug}`}
              className="border-border hover:bg-accent rounded-lg border p-4 text-right transition-colors sm:col-start-2"
            >
              <span className="text-muted-foreground text-xs">Next</span>
              <span className="text-foreground mt-1 block text-sm font-medium">{next.title}</span>
            </Link>
          )}
        </nav>

        <p className="text-muted-foreground mt-10 text-xs leading-relaxed">
          This documentation is licensed{' '}
          <a
            href="https://creativecommons.org/licenses/by/4.0/"
            className="hover:text-foreground underline underline-offset-2"
          >
            CC BY 4.0
          </a>
          . Reproduce it, translate it, quote it at length. Credit agentblog.dev with a link. The
          code it describes is MIT. See <Link href="/docs/licensing">Licensing</Link>.
        </p>
      </article>

      {headings.length > 1 && (
        <aside className="hidden w-52 shrink-0 xl:block">
          <div className="sticky top-24">
            <h2 className="text-foreground font-mono text-xs tracking-wider uppercase">
              On this page
            </h2>
            <ul className="border-border mt-3 space-y-1.5 border-l">
              {headings.map((heading) => (
                <li key={heading.id}>
                  <a
                    href={`#${heading.id}`}
                    className={
                      heading.depth === 3
                        ? 'text-muted-foreground hover:border-foreground hover:text-foreground -ml-px block border-l border-transparent pl-6 text-xs transition-colors'
                        : 'text-muted-foreground hover:border-foreground hover:text-foreground -ml-px block border-l border-transparent pl-3 text-xs transition-colors'
                    }
                  >
                    {heading.text}
                  </a>
                </li>
              ))}
            </ul>
            <a
              href="/docs/llms.txt"
              className="text-muted-foreground hover:text-foreground mt-6 inline-flex items-center gap-1.5 font-mono text-xs"
            >
              llms.txt
              <ArrowRight className="size-3" />
            </a>
          </div>
        </aside>
      )}
    </div>
  )
}
