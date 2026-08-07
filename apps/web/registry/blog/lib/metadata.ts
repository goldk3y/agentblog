/**
 * Shared metadata defaults. This file exists because of one Next.js rule.
 *
 * ===========================================================================
 * NEXT.JS MERGES METADATA SHALLOWLY
 * ===========================================================================
 * From the `generateMetadata` reference: metadata objects from multiple segments
 * are **shallowly** merged, and *"metadata with nested fields such as
 * `openGraph` and `robots` that are defined in an earlier segment are
 * overwritten by the last segment to define them."*
 *
 * Read that again with a real example. The root layout sets:
 *
 *     openGraph: { siteName: 'Your Brand', locale: 'en_US', type: 'website' }
 *
 * The post page sets:
 *
 *     openGraph: { type: 'article', title, description, url, images }
 *
 * Because the page defined `openGraph` **at all**, the root layout's entire
 * `openGraph` object is discarded. Every post ships an Open Graph card with no
 * `og:site_name` and no `og:locale`. Nothing errors. No validator complains. The
 * types are correct. The only way to notice is to view source on a built page or
 * paste a URL into a social preview debugger.
 *
 * The identical trap applies to `robots`. A page that sets `robots` at all
 * replaces the layout's `googleBot` block, and `max-snippet: -1` is what permits
 * full length snippets in AI Overviews and AI Mode. Losing it is a retrieval
 * regression dressed up as a formatting detail.
 *
 * ===========================================================================
 * THE RULE THIS FILE ENFORCES
 * ===========================================================================
 * Every route segment that sets `openGraph` or `robots` spreads the defaults
 * below, or calls one of the two builders. Nothing hand rolls a metadata object.
 * If you are adding a route, copy an existing one rather than writing
 * `openGraph` from scratch.
 *
 * ===========================================================================
 * AN ABSENT KEY AND A KEY SET TO `undefined` ARE DIFFERENT THINGS HERE
 * ===========================================================================
 * READ THIS BEFORE TIDYING ANY OBJECT BELOW INTO SHORTHAND.
 *
 * Next.js merges a file-based `opengraph-image` route into a segment's metadata
 * only when that segment does not already own the key. The check in
 * `next/dist/lib/metadata/resolve-metadata.js` is literally:
 *
 *     if (openGraph && !source?.openGraph?.hasOwnProperty('images')) { ... }
 *
 * `hasOwnProperty`, not a truthiness test. So writing `images` with shorthand,
 * `{ ...defaults, images }`, puts the key on the object even when the value is
 * `undefined`, the merge is skipped, and the page ships with no `og:image` and
 * no `twitter:image` while `opengraph-image.tsx` is still built and referenced
 * by nothing. Nothing errors, no type is wrong, and the only symptom is a blank
 * card in a social preview debugger.
 *
 * Both builders therefore use a conditional spread,
 * `...(images?.length ? { images } : {})`, so an unset image leaves the key
 * absent and the generated card wins. The length test rather than a plain
 * truthiness test is there because `images: []` is truthy and would block the
 * merge exactly like `images: undefined` does.
 *
 * The same reasoning applies to any optional key here: omit it, never assign
 * `undefined` to it, because a `for (const key in metadata)` loop in the same
 * merge visits keys whose value is `undefined` and overwrites the parent's.
 *
 * Key casing is exactly as Next.js 16 declares it and is not stylistic:
 * `googleBot` is camelCase, while the granular directives are kebab-case string
 * literals (`'max-snippet'`, `'max-image-preview'`, `'max-video-preview'`).
 * Use `index: false` and `follow: false`; `noindex` and `nofollow` are typed
 * `never` and deprecated.
 *
 * @see https://docs.agentblog.dev/reference/files
 */
import type { Metadata } from 'next'

import { absoluteUrl, authorUrl, config, postUrl } from '@/lib/config'
import type { Post } from '@/lib/types'

/**
 * The nested Open Graph fields a page would otherwise destroy. Spread these
 * first, then add the page specific keys.
 */
export const openGraphDefaults: { siteName: string; locale: string } = {
  siteName: config.brand.name,
  locale: config.locale,
}

/**
 * Googlebot directives that unlock full snippets, large image previews, and
 * unlimited video previews in classic results and in AI surfaces alike.
 *
 * `-1` means "no limit". `'large'` is the difference between a thumbnail and a
 * full width image in a rich result.
 */
export const googleBotDefaults = {
  index: true,
  follow: true,
  'max-image-preview': 'large',
  'max-snippet': -1,
  'max-video-preview': -1,
} as const

/**
 * The default `robots` object, with `googleBotDefaults` nested under `googleBot`
 * where Next.js expects it.
 *
 * Prefer `buildPostMetadata` or `buildListMetadata` over reaching for this
 * directly. It is exported for the root layout and for any route this block does
 * not ship.
 */
export const robotsDefaults: Metadata['robots'] = {
  index: true,
  follow: true,
  googleBot: googleBotDefaults,
}

/** The RSS link that rides along in `alternates.types` on every blog surface. */
function rssAlternate(): Record<string, { url: string; title: string }[]> {
  return {
    'application/rss+xml': [{ url: absoluteUrl('/feed.xml'), title: `${config.brand.name} blog` }],
  }
}

/**
 * Turn a hero image into the Open Graph and Twitter image shape.
 *
 * `absoluteUrl` passes an already absolute URL through untouched, so a CDN
 * hosted hero and a `/public` relative one both work without a branch here.
 */
function heroImages(post: Post): { url: string; alt: string }[] | undefined {
  if (!post.heroImage) return undefined
  return [{ url: absoluteUrl(post.heroImage), alt: post.heroAlt ?? post.title }]
}

/**
 * The complete `Metadata` object for a post route.
 *
 * Four things it gets right that a hand written object usually does not:
 * the canonical goes in `alternates.canonical` (not a raw `<link>`), the feed
 * goes in `alternates.types`, `openGraph` carries the full article shape with
 * the site defaults intact, and `robots` carries the `googleBot` block.
 */
export function buildPostMetadata(post: Post): Metadata {
  const url = postUrl(post.slug)
  const images = heroImages(post)

  return {
    title: post.title,
    description: post.description,

    authors: [{ name: post.author.name, url: authorUrl(post.author.slug) }],
    // Omitted rather than set to `undefined` when the post has no tags. See the
    // header: a key present with an `undefined` value still overwrites whatever
    // the parent segment resolved.
    ...(post.tags.length > 0 ? { keywords: post.tags } : {}),

    alternates: {
      // The canonical is absolute on purpose. A relative one is resolved against
      // `metadataBase`, which is one more thing that can be wrong in a way that
      // only shows up in production.
      canonical: url,
      types: rssAlternate(),
    },

    robots: robotsDefaults,

    openGraph: {
      ...openGraphDefaults,
      type: 'article',
      title: post.title,
      description: post.description,
      url,
      publishedTime: post.datePublished,
      modifiedTime: post.dateModified,
      authors: [post.author.name],
      section: post.category.name,
      tags: post.tags,
      // Conditional spread, never `images`. With no hero image the key must be
      // absent so `app/blog/[slug]/opengraph-image.tsx` is merged in.
      ...(images?.length ? { images } : {}),
    },

    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.description,
      ...(images?.length ? { images } : {}),
    },
  }
}

/**
 * The site-level Open Graph card, generated by `app/opengraph-image.tsx`.
 *
 * A list surface cannot get this card the way a post does. The file-based merge
 * described in the header only fires for a static image file **in the same route
 * segment**, and only `app/blog/[slug]/` has one. Every other segment defines
 * `openGraph` for its own `og:url` and `og:title`, which replaces the root
 * layout's resolved object outright and takes the root's card with it. Measured
 * on a real build: before this constant existed, `/blog`, every category hub,
 * every tag page, and every author page shipped six `og:*` tags and no
 * `og:image`, while `/` (which defines no `openGraph` of its own) had one.
 *
 * Naming the route here is what closes that hole, and it is why
 * `@agentblog/blog-routes` lists `@agentblog/seo-routes` as a registry
 * dependency: the item that ships list routes must also ship the image they
 * point at. If you remove `app/opengraph-image.tsx`, pass `images` explicitly at
 * every call site instead of leaving this to resolve to a 404.
 */
const SITE_OG_IMAGE = '/opengraph-image'

/**
 * The dimensions and MIME type of the card `app/opengraph-image.tsx` produces,
 * declared here because this file cannot ask the route for them.
 *
 * WHY THESE ARE WRITTEN OUT RATHER THAN DERIVED
 * When Next.js merges a file-based `opengraph-image` itself, it emits
 * `og:image:type`, `og:image:width`, and `og:image:height` alongside the URL,
 * and it appends its own content hash to the URL:
 * `…/opengraph-image?9e1e2d0f397a82a1`. Naming the route by hand, which is the
 * only way a list surface gets the card at all (see `SITE_OG_IMAGE`), gets none
 * of that. Measured on a real build, every list surface shipped the bare URL
 * with only `og:image:alt`, so a scraper had no dimensions to lay out with and
 * frequently declined to show a large card.
 *
 * Three of the four are recoverable here and are set below. The hash is not:
 * it is Next's cache key, computed from the route's compiled output at build
 * time, and there is no exported API for reading it from application code.
 * Importing `app/opengraph-image.tsx` would not help either, since the hash
 * comes from the build and not from the module, and a lib importing a route is
 * the wrong direction regardless.
 *
 * THE TRADEOFF, STATED PLAINLY
 * The URL is stable across rebuilds, which is what a cache key exists to avoid.
 * Rebrand (change `config.brand`) and the bytes at `/opengraph-image` change
 * while its URL does not, so a social scraper or CDN that already cached the old
 * card keeps serving it until its own TTL expires. There is no cache bust
 * available from this file. What to do about it: re-scrape the affected URLs
 * through the platform's own tool after a rebrand (Facebook's Sharing Debugger,
 * LinkedIn's Post Inspector, X's Card Validator each refetch on demand), and
 * accept that everything else refreshes on its own schedule. If that is not good
 * enough for your rebrand, pass `images` explicitly at the call site with a
 * versioned filename you control.
 *
 * Keep these numbers equal to the `size` export in `app/opengraph-image.tsx`.
 * Dimensions that disagree with the file are worse than none: they are what a
 * scraper lays out against before it ever fetches the image.
 */
const SITE_OG_IMAGE_META = { width: 1200, height: 630, type: 'image/png' } as const

/**
 * Metadata for a list surface: the blog index, a category hub, a tag page, an
 * author page.
 *
 * `index` defaults to `true`. Pass `false` for a thin tag page, and note that
 * `follow` stays `true` in that case so the posts linked from it are still
 * discovered. A blanket `noindex, nofollow` on a tag page hides the posts too.
 *
 * `images` is optional and falls back to the site card. Pass one only when the
 * surface has an image of its own worth showing, such as a category with real
 * artwork.
 */
export function buildListMetadata(input: {
  title: string
  description: string
  path: string
  index?: boolean
  images?: string[]
}): Metadata {
  const url = absoluteUrl(input.path)
  const indexable = input.index ?? true
  // A caller-supplied image gets no dimensions, because we do not know them and
  // a wrong `og:image:width` is worse than a missing one. The site card does,
  // because `app/opengraph-image.tsx` declares them. See `SITE_OG_IMAGE_META`.
  const images = input.images?.length
    ? input.images.map((image) => ({ url: absoluteUrl(image) }))
    : [{ url: absoluteUrl(SITE_OG_IMAGE), alt: config.brand.name, ...SITE_OG_IMAGE_META }]

  return {
    title: input.title,
    description: input.description,

    alternates: { canonical: url, types: rssAlternate() },

    robots: indexable
      ? robotsDefaults
      : { index: false, follow: true, googleBot: { ...googleBotDefaults, index: false } },

    openGraph: {
      ...openGraphDefaults,
      type: 'website',
      title: input.title,
      description: input.description,
      url,
      // Always set, and always non-empty. Unlike a post, a list surface has no
      // segment-local `opengraph-image.tsx` to be merged in, so leaving the key
      // absent here produces a card with no image at all. See `SITE_OG_IMAGE`.
      images,
    },

    twitter: {
      card: 'summary_large_image',
      title: input.title,
      description: input.description,
      images,
    },
  }
}
