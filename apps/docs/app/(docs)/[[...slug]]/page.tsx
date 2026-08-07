/**
 * Every documentation page.
 *
 * An optional catch-all, so `/` and `/reference/cli` are one route. Static
 * segments beside it (`llms.txt`, `og`, `api`) take precedence, because Next.js
 * matches static segments before dynamic ones.
 *
 * `dynamicParams = false` makes an unknown path a 404 rather than a render
 * attempt, which is what you want for a set of pages that is completely known
 * at build time.
 *
 * The props are typed by hand rather than through the `PageProps` global that
 * `next typegen` writes, so this file compiles in a clean checkout before
 * typegen has ever run.
 */
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
  ViewOptionsPopover,
} from 'fumadocs-ui/layouts/docs/page'
import { createRelativeLink } from 'fumadocs-ui/mdx'

import { getMDXComponents } from '@/components/mdx'
import { githubSourceUrl, markdownUrl, ogImageUrl } from '@/lib/page-urls'
import { absoluteUrl, GITHUB_URL, SITE_NAME } from '@/lib/site'
import { source } from '@/lib/source'

interface DocPageProps {
  readonly params: Promise<{ slug?: string[] }>
}

export const dynamicParams = false

export function generateStaticParams(): { slug?: string[] }[] {
  return source.generateParams()
}

export async function generateMetadata({ params }: DocPageProps): Promise<Metadata> {
  const { slug } = await params
  const page = source.getPage(slug)
  if (page === undefined) notFound()

  return {
    title: page.data.title,
    description: page.data.description,
    alternates: {
      canonical: page.url,
      types: {
        'text/markdown': [{ url: absoluteUrl(markdownUrl(page)), title: page.data.title }],
      },
    },
    /*
     * Restating `siteName` and `type` is not redundant. Next.js merges metadata
     * shallowly, so setting `openGraph` here at all would otherwise drop both
     * from the root layout's object and take `og:site_name` off every page.
     */
    openGraph: {
      type: 'article',
      siteName: SITE_NAME,
      title: page.data.title,
      description: page.data.description,
      url: absoluteUrl(page.url),
      images: ogImageUrl(page),
    },
  }
}

export default async function Page({ params }: DocPageProps) {
  const { slug } = await params
  const page = source.getPage(slug)
  if (page === undefined) notFound()

  const MDX = page.data.body
  const githubUrl = githubSourceUrl(page, GITHUB_URL)

  return (
    <DocsPage
      toc={page.data.toc}
      full={page.data.full === true}
      tableOfContent={{ style: 'clerk' }}
    >
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>

      {/*
        The Markdown and GitHub links for this page. Both exist because the
        readers this site is written for include agents: one of them wants the
        page as text, and the other wants the file it came from.
      */}
      <div className="flex flex-row items-center gap-2 border-b pb-4">
        <ViewOptionsPopover markdownUrl={markdownUrl(page)} githubUrl={githubUrl} />
      </div>

      <DocsBody>
        <MDX components={getMDXComponents({ a: createRelativeLink(source, page) })} />
      </DocsBody>
    </DocsPage>
  )
}
