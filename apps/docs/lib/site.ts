/**
 * Site constants, and the one place a URL becomes absolute.
 *
 * Canonical URLs, Open Graph images, the sitemap, and `llms.txt` all need an
 * origin. Composing that origin in four files is how a preview deploy ends up
 * publishing production canonicals, so it is composed once here.
 */

/** Where this site lives in production. */
export const SITE_URL = 'https://docs.agentblog.dev'

/** The product site. Every link out of the docs that is not GitHub goes here. */
export const PRODUCT_URL = 'https://agentblog.dev'

export const GITHUB_URL = 'https://github.com/goldk3y/agentblog'

export const SITE_NAME = 'AgentBlog docs'

/**
 * The origin this deployment is actually reachable at.
 *
 * On a Vercel preview that is the generated deployment URL, so a preview's
 * canonical tags point at the preview rather than at production. Production and
 * every other host fall back to `SITE_URL`.
 */
export function siteOrigin(): string {
  const explicit = process.env['AGENTBLOG_DOCS_URL']
  if (explicit !== undefined && explicit !== '') return explicit.replace(/\/$/, '')

  if (process.env['VERCEL_ENV'] === 'preview' && process.env['VERCEL_URL'] !== undefined) {
    return `https://${process.env['VERCEL_URL']}`
  }

  return SITE_URL
}

/** Absolute URL for a site-relative path. */
export function absoluteUrl(path: string): string {
  return new URL(path, `${siteOrigin()}/`).toString()
}
