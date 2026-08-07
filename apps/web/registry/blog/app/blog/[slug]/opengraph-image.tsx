/**
 * The per-post Open Graph card, at `/blog/<slug>/opengraph-image`.
 *
 * The layout lives in `lib/og-card.tsx` and is shared with the blog-level card,
 * so the two cannot drift. This file decides what the card says; that file
 * decides what it looks like.
 *
 * ---------------------------------------------------------------------------
 * TYPING `params`, AND WHY IT IS HAND-WRITTEN HERE
 * ---------------------------------------------------------------------------
 * `params` is a Promise in Next.js 16 and must be awaited. Everywhere else in
 * this block the typegen helpers (`PageProps<'/blog/[slug]'>`) are mandatory,
 * because a hand-written type drifts from the route tree. There is no typegen
 * helper for the `opengraph-image` convention, so this one signature is written
 * out by hand. That is expected, not an oversight.
 *
 * @see https://docs.agentblog.dev/reference/files
 */
import { ImageResponse } from 'next/og'

import { config } from '@/lib/config'
import { OG_CONTENT_TYPE, OG_SIZE, ogCard } from '@/lib/og-card'
import { getAllPosts, getPost } from '@/lib/posts'

/**
 * `alt` is a static module export, so it cannot vary per post. It describes the
 * card's function rather than its contents, which is the honest thing a static
 * string can say here.
 */
export const alt = `${config.brand.name} blog post`
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

/** The line above every post title. Reads as `Acme Blog`. */
const EYEBROW = `${config.brand.name} Blog`

/**
 * Every slug, so every card is generated at build time.
 *
 * Without this the route is dynamic and each card is rendered through Satori on
 * the first request for it. That request is almost always a social or AI crawler
 * unfurling a link, which is precisely the moment a slow response costs
 * something: the crawler is on a timeout, the render is the most expensive thing
 * this route does, and no reader is waiting who benefits from the work being
 * deferred. Prerendering matches what `app/blog/[slug]/page.tsx` does, and the
 * two lists come from the same `getAllPosts()` call, so they cannot drift.
 *
 * Same rule as the post route: EVERY slug. Slicing this list moves cards back
 * onto the request path one post at a time.
 */
export async function generateStaticParams() {
  const posts = await getAllPosts()
  return posts.map((post) => ({ slug: post.slug }))
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = await getPost(slug)

  /*
   * A missing post falls back to the blog-level card rather than throwing.
   * Throwing here fails the build for the whole route, and at request time it
   * serves a broken image to the social preview of a URL that is already about
   * to 404. Neither is an improvement on a generic but valid card.
   */
  if (!post) {
    return new ImageResponse(ogCard({ title: EYEBROW }), { ...size })
  }

  return new ImageResponse(ogCard({ eyebrow: EYEBROW, title: post.title }), { ...size })
}
