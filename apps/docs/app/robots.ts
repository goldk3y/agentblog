/**
 * robots.txt.
 *
 * Preview deployments are closed to everything, and production is open to
 * everything, including the AI crawlers. Both halves are deliberate: a preview
 * that is indexable competes with production for the same queries, and a docs
 * site that blocks the assistants is a docs site nobody can ask about.
 *
 * The guard reads `VERCEL_ENV`, which Vercel sets, so no configuration is
 * needed to keep a preview out of the index.
 */
import type { MetadataRoute } from 'next'

import { absoluteUrl } from '@/lib/site'

export const revalidate = false

export default function robots(): MetadataRoute.Robots {
  const isProduction =
    process.env['VERCEL_ENV'] === 'production' || process.env['VERCEL_ENV'] === undefined

  if (!isProduction) {
    return { rules: [{ userAgent: '*', disallow: '/' }] }
  }

  /*
   * No `host` directive. Only Yandex ever read it, it is deprecated there too,
   * and a second statement of the canonical origin is a second thing that can
   * disagree with the first.
   */
  return {
    rules: [{ userAgent: '*', allow: '/' }],
    sitemap: absoluteUrl('/sitemap.xml'),
  }
}
