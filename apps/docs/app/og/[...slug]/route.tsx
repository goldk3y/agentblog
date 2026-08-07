/**
 * The social card for each page, generated at build time.
 *
 * The last path segment is a filename (`image.png`) rather than part of the
 * slug, because some social scrapers still refuse a URL that does not look like
 * a file.
 */
import { ImageResponse } from 'next/og'
import { notFound } from 'next/navigation'

import { generate as OGImage } from 'fumadocs-ui/og'

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

  return new ImageResponse(
    <OGImage
      title={page.data.title}
      description={page.data.description}
      site={SITE_NAME}
      primaryColor="#0064e2"
      primaryTextColor="#ffffff"
    />,
    { width: 1200, height: 630 },
  )
}

export function generateStaticParams(): { slug: string[] }[] {
  return source.getPages().map((page) => ({ slug: ogImageSegments(page) }))
}
