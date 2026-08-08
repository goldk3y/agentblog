/**
 * The social card for each page, generated at build time.
 *
 * The last path segment is a filename (`image.png`) rather than part of the
 * slug, because some social scrapers still refuse a URL that does not look like
 * a file.
 *
 * The index page is deliberately not served from here. It uses the static
 * `app/opengraph-image.png`, which is the designed brand card for the site as a
 * whole; see the `images` branch in `app/(docs)/[[...slug]]/page.tsx`. This route
 * still generates a card for `/` so that the URL resolves if anything references
 * it, but nothing on the site does.
 *
 * The layout lives in `lib/og-card.tsx`, which explains why it is not
 * `fumadocs-ui/og`.
 */
import { ImageResponse } from 'next/og'
import { notFound } from 'next/navigation'

import { OG_SIZE, docsOgCard } from '@/lib/og-card'
import { ogImageSegments } from '@/lib/page-urls'
import { SITE_NAME } from '@/lib/site'
import { source } from '@/lib/source'

export const revalidate = false
export const dynamicParams = false

interface RouteParams {
  readonly params: Promise<{ slug: string[] }>
}

export async function GET(_request: Request, { params }: RouteParams): Promise<Response> {
  const { slug } = await params
  const page = source.getPage(slug.slice(0, -1))
  if (page === undefined) notFound()

  return new ImageResponse(docsOgCard({ eyebrow: SITE_NAME, title: page.data.title }), {
    ...OG_SIZE,
  })
}

export function generateStaticParams(): { slug: string[] }[] {
  return source.getPages().map((page) => ({ slug: ogImageSegments(page) }))
}
