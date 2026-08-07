/**
 * The sitemap.
 *
 * Every page, at its canonical origin. No `lastModified`: the only date this
 * app could supply is the checkout time of the build, which changes on every
 * deploy and would tell a crawler that all forty pages changed when one did.
 * An absent signal beats a false one.
 */
import type { MetadataRoute } from 'next'

import { absoluteUrl } from '@/lib/site'
import { source } from '@/lib/source'

export const revalidate = false

export default function sitemap(): MetadataRoute.Sitemap {
  return source.getPages().map((page) => ({
    url: absoluteUrl(page.url),
    changeFrequency: 'weekly',
    priority: page.url === '/' ? 1 : 0.7,
  }))
}
