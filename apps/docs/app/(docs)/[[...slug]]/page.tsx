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

/**
 * The static brand card at `app/opengraph-image.png`, with the dimensions and alt
 * text Next.js would have emitted had the file convention been left to merge
 * itself.
 *
 * A scraper lays out against `og:image:width` and `og:image:height` before it
 * fetches the image, and several decline a large card without them. Keep the
 * numbers equal to the real pixel size of the file.
 *
 * `alt` is the same sentence as `app/opengraph-image.alt.txt`, which is what the
 * file convention reads for every route that does not set `images`. Naming the
 * image by hand skips the sidecar, so the two have to be written out separately.
 * They describe one image and must not disagree.
 */
const SITE_CARD = [
  {
    url: '/opengraph-image.png',
    width: 1200,
    height: 630,
    alt: 'The AgentBlog globe mark above the AgentBlog Docs wordmark, on a dark card.',
  },
]

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
      /*
       * The index gets the designed brand card, everything below it gets a
       * generated one carrying its own title.
       *
       * `app/opengraph-image.png` is named here rather than left to the file
       * convention, and it has to be. Next.js only merges a file-based image
       * into a segment that does not already own `openGraph.images`, and it
       * merges the image belonging to that same segment. This is a nested segment
       * that sets `images` for every other page, so the root's card would be
       * dropped rather than inherited. The static file still covers any route
       * that sets no `openGraph` at all, such as the 404.
       */
      images: page.url === '/' ? SITE_CARD : ogImageUrl(page),
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
