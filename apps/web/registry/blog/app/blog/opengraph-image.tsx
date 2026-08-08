/**
 * The blog's Open Graph card, at `/blog/opengraph-image`.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS LIVES UNDER `app/blog/` AND NOT AT THE APP ROOT
 * ---------------------------------------------------------------------------
 * It used to be `app/opengraph-image.tsx`, which meant installing a blog took
 * over the social card for the host site's entire domain, landing page included.
 * A blog block has no business deciding what `/` looks like when somebody shares
 * it, and the takeover was silent: the card rendered, the build passed, and the
 * only symptom was the marketing page unfurling as a blog card.
 *
 * Everything this block writes now lives under the paths it owns. If you want a
 * card for your site as a whole, add your own `app/opengraph-image.png` (or
 * `.tsx`); nothing here will overwrite it.
 *
 * ---------------------------------------------------------------------------
 * WHAT USES THIS CARD
 * ---------------------------------------------------------------------------
 * Every blog surface that is not a single post: `/blog` and its pagination,
 * category hubs, tag pages, and author pages. They reach it by name through
 * `BLOG_OG_IMAGE` in `lib/metadata.ts` rather than by the file-based merge,
 * because that merge only fires for a segment that has an image file of its own
 * and only `app/blog/[slug]/` does. See the comment on `BLOG_OG_IMAGE`.
 *
 * The card says "Blog" and nothing more, and it carries no eyebrow. It stands
 * for a dozen different URLs, so a headline would have to be either wrong on
 * most of them or generic enough to say nothing.
 *
 * The brand is deliberately not in that word. `ogCard` already renders the mark
 * from `config.brand.logo` in the top left, falling back to the brand name as a
 * wordmark when there is no readable logo, so `${config.brand.name} Blog` set it
 * a second time in the headline and produced "Your Brand" above "Your Brand
 * Blog" on one 1200x630 image. `alt` below still names the brand, because alt
 * text is read without the picture and has nothing else to identify it by.
 *
 * @see https://docs.agentblog.dev/reference/files
 */
import { ImageResponse } from 'next/og'

import { config } from '@/lib/config'
import { OG_CONTENT_TYPE, OG_SIZE, ogCard } from '@/lib/og-card'

export const alt = `${config.brand.name} blog`
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

export default function Image() {
  return new ImageResponse(ogCard({ title: 'Blog' }), { ...size })
}
