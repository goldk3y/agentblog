/* eslint-disable @next/next/no-img-element -- `ImageResponse` renders through
   Satori, which understands a small subset of HTML and CSS and has no concept of
   `next/image`. A plain `img` element is the only one available in this file, and
   the output is a static PNG rather than a page, so the LCP advice the rule gives
   does not apply here. */
/**
 * Per-post Open Graph card, at `/blog/<slug>/opengraph-image`.
 *
 * ---------------------------------------------------------------------------
 * THE COLOUR LITERALS IN THIS FILE ARE INTENTIONAL AND SANCTIONED
 * ---------------------------------------------------------------------------
 * Same exception as `app/opengraph-image.tsx`, for the same reason.
 * `ImageResponse` renders through Satori, which has no DOM and no stylesheet, so
 * it cannot read a CSS custom property. `bg-background` means nothing here. A
 * literal is the only way to colour a generated PNG, so the theme-conformance
 * rule that governs every other file in this block does not apply to this one.
 *
 * The palette is duplicated from the site-level card rather than shared, because
 * each metadata route is its own module and the `seo-routes` registry item ships
 * these two files without a shared helper between them. Keep them in sync by
 * hand; there are seven constants.
 *
 * ---------------------------------------------------------------------------
 * TYPING `params`, AND WHY IT IS HAND-WRITTEN HERE
 * ---------------------------------------------------------------------------
 * `params` is a Promise in Next.js 16 and must be awaited. Everywhere else in
 * this block the typegen helpers (`PageProps<'/blog/[slug]'>`) are mandatory
 * because a hand-written type drifts from the route tree. There is no typegen
 * helper for the `opengraph-image` convention, so this one signature is written
 * out by hand. That is expected, not an oversight.
 *
 * ---------------------------------------------------------------------------
 * HARD LIMITS
 * ---------------------------------------------------------------------------
 * `opengraph-image` output must be at most 8MB or THE BUILD FAILS, and the
 * `ImageResponse` bundle ceiling is 500KB across JSX, CSS, fonts, and images.
 * Any asset is read ONCE at module scope. A `readFile` inside the default export
 * would run on every generation, which is once per post.
 *
 * @see https://docs.agentblog.dev/reference/files
 */
import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { extname, join } from 'node:path'

import { bcp47Locale, config } from '@/lib/config'
import { getAllPosts, getPost } from '@/lib/posts'

/**
 * `alt` is a static module export, so it cannot vary per post. It describes the
 * card's function rather than its contents, which is the honest thing a static
 * string can say here.
 */
export const alt = `${config.brand.name} blog post`
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

/* -------------------------------------------------------------------------- */
/*  Palette. Literals are permitted in this file only. See the header.         */
/* -------------------------------------------------------------------------- */

const INK = '#0b0b0f'
const PAPER = '#fafafa'
const MUTED = '#a1a1aa'
const RULE = '#27272a'
const ACCENT = '#6366f1'

/** Refuse anything that would eat the 500KB bundle budget on its own. */
const MAX_LOGO_BYTES = 150_000

/** Read the brand logo once, at module scope. Degrades to a wordmark on any failure. */
async function readBrandLogo(): Promise<string | null> {
  const url = config.brand.logo.url
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) return null

  const extension = extname(url).toLowerCase()
  const mime =
    extension === '.png'
      ? 'image/png'
      : extension === '.jpg' || extension === '.jpeg'
        ? 'image/jpeg'
        : null
  if (!mime) return null

  try {
    const bytes = await readFile(join(process.cwd(), 'public', url.replace(/^\/+/, '')))
    if (bytes.byteLength > MAX_LOGO_BYTES) return null
    return `data:${mime};base64,${bytes.toString('base64')}`
  } catch {
    return null
  }
}

const brandLogo = await readBrandLogo()

/**
 * `config.locale` is stored in the underscore form Open Graph wants (`en_US`).
 * `Intl` needs the BCP-47 hyphen form, and `bcp47Locale` in `@/lib/config` is
 * the one place that conversion happens. A local `.replace('_', '-')` rewrites
 * only the FIRST underscore, so `zh_Hans_CN` becomes `zh-Hans_CN`, which
 * `Intl.DateTimeFormat` throws on, at module scope, failing the whole route.
 */
const dateFormatter = new Intl.DateTimeFormat(bcp47Locale(), {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  timeZone: 'UTC',
})

interface CardContent {
  readonly eyebrow: string
  readonly headline: string
  readonly footnote: string
}

/**
 * What the card says when there is no such post.
 *
 * A missing post falls back to the site-level card rather than throwing.
 * Throwing here would fail the build for the whole route, and at request time it
 * would serve a broken image to the social preview of a URL that is already
 * about to 404. Neither is an improvement on a generic but valid card.
 */
const SITE_CARD: CardContent = {
  eyebrow: 'Blog',
  headline: 'Writing worth citing',
  footnote: config.siteUrl.replace(/^https?:\/\//, ''),
}

/**
 * Every slug, so every card is generated at build time.
 *
 * Without this the route is dynamic, and each card is rendered through Satori on
 * the first request for it. That request is almost always a social or AI crawler
 * unfurling a link, which is precisely the moment a slow response costs
 * something: the crawler is on a timeout, the render is the most expensive thing
 * this route does, and there is no reader waiting who benefits from the work
 * being deferred. Prerendering matches what `app/blog/[slug]/page.tsx` does, and
 * the two lists come from the same `getAllPosts()` call, so they cannot drift.
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

  const card: CardContent = post
    ? {
        eyebrow: post.category.name,
        headline: post.title,
        footnote: `${post.author.name} · ${dateFormatter.format(new Date(post.datePublished))}`,
      }
    : SITE_CARD

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        backgroundColor: INK,
        color: PAPER,
        padding: 72,
        fontFamily: 'sans-serif',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        {brandLogo ? (
          <img src={brandLogo} width={48} height={48} alt="" style={{ borderRadius: 10 }} />
        ) : null}
        <div style={{ display: 'flex', fontSize: 28, fontWeight: 600, letterSpacing: -0.5 }}>
          {config.brand.name}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: 2,
            textTransform: 'uppercase',
            color: MUTED,
          }}
        >
          <div style={{ display: 'flex', width: 48, height: 4, backgroundColor: ACCENT }} />
          <div style={{ display: 'flex' }}>{card.eyebrow}</div>
        </div>

        {/*
            Titles are capped at 70 characters by `PostSchema`, so this fits in
            three lines at this size without a clamp. If you raise that cap,
            reduce `fontSize` here or the text will overflow the card.
          */}
        <div
          style={{
            display: 'flex',
            fontSize: 62,
            fontWeight: 700,
            lineHeight: 1.12,
            letterSpacing: -1.8,
          }}
        >
          {card.headline}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderTop: `1px solid ${RULE}`,
          paddingTop: 28,
          fontSize: 24,
          color: MUTED,
        }}
      >
        <div style={{ display: 'flex' }}>{card.footnote}</div>
        <div style={{ display: 'flex' }}>{config.siteUrl.replace(/^https?:\/\//, '')}</div>
      </div>
    </div>,
    { ...size },
  )
}
