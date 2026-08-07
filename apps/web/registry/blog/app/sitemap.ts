/**
 * `/sitemap.xml` for the whole site.
 *
 * ---------------------------------------------------------------------------
 * READ THIS BEFORE YOU CHANGE ANYTHING (human or agent)
 * ---------------------------------------------------------------------------
 * THIS IS A CACHED ROUTE HANDLER. The Next.js docs say it plainly: "sitemap.js
 * is a special Route Handler that is cached by default unless it uses a
 * Request-time API or dynamic config option." So a post published without a
 * rebuild does NOT appear here until something invalidates the cache.
 *
 * That is why `app/api/publish/route.ts` calls `revalidatePath('/sitemap.xml')`
 * explicitly. If you delete that line, the publish webhook will keep pinging
 * IndexNow for URLs that this file does not list, which is a crawl-quality
 * signal you are paying for and getting nothing back from. The `revalidate`
 * export below is the backstop for when nobody calls the webhook at all.
 *
 * ---------------------------------------------------------------------------
 * THE THREE RULES THIS FILE ENFORCES
 * ---------------------------------------------------------------------------
 * 1. `lastModified` comes from real content dates, never `new Date()`. A sitemap
 *    that claims every page changed today is a false freshness signal, and it is
 *    spent for nothing: crawlers learn that this site's `lastmod` carries no
 *    information and stop reading it. Bing has said `lastmod` is one of the few
 *    sitemap fields it actually uses, so it is worth keeping honest.
 * 2. A noindexed URL is never listed. Listing a URL here says "please index
 *    this" while the page says "do not index this". Contradicting yourself in
 *    two machine-readable surfaces is worse than saying nothing in either.
 *    Concretely: tag pages below `config.noindexTagsBelow` are excluded, and so
 *    are drafts (which `getAllPosts()` already filters out).
 * 3. Hero images are emitted through the native `images` field. In Next.js
 *    16.3.0 `MetadataRoute.Sitemap` genuinely declares `images?: string[]`
 *    (verified in `next/dist/lib/metadata/types/metadata-interface.d.ts`), so no
 *    cast is needed. This is free image-sitemap coverage.
 * 4. **Every string this file returns is XML-escaped, with no exceptions.**
 *    Next.js does the serialization and does no escaping of its own. From
 *    `next/dist/build/webpack/loaders/metadata/resolve-route-data.js@16.3.0`:
 *
 *        content += `<loc>${item.url}</loc>\n`
 *        content += `<image:loc>${image}</image:loc>\n`
 *
 *    Straight interpolation, so a raw `&` from a perfectly ordinary CDN URL
 *    (`?w=1200&h=630&fit=crop`) makes the whole document not well-formed and the
 *    site silently has no sitemap at all. Measured before this was added: one
 *    hero image, `ParseError: not well-formed (invalid token): line 24`. The
 *    same hole let a crafted `heroImage` close `<image:loc>` and add an
 *    attacker's `<url>` element; `ImageRef` in `lib/schemas.ts` now refuses the
 *    characters that do that, and this escape is the second layer.
 *    `app/feed.xml/route.ts` has carried the same rule since it was written.
 *
 * @see https://docs.agentblog.dev/reference/files
 */
import type { MetadataRoute } from 'next'

import {
  absoluteUrl,
  authorUrl,
  categoryUrl,
  config,
  escapeXml,
  postUrl,
  tagSlug,
  tagUrl,
} from '@/lib/config'
import { getAllAuthors, getAllCategories, getAllPosts, getAllTags } from '@/lib/posts'
import type { PublishedPost } from '@/lib/types'

/**
 * ISR backstop. The publish webhook is the fast path; this is what keeps the
 * sitemap from going stale on a site whose webhook is never wired up.
 *
 * Hardcoded rather than read from `config.revalidate` because route segment
 * config has to be statically analysable, and an imported binding is not.
 */
export const revalidate = 3600

/**
 * `changeFrequency` and `priority` are set conservatively on purpose.
 *
 * Google has stated repeatedly that it largely ignores both, and `priority` is
 * relative within one sitemap rather than a global ranking dial. Setting
 * everything to `always` / `1.0` buys nothing and costs credibility with the
 * crawlers that do read them. These values describe how the site actually
 * behaves: an evergreen post changes rarely, the index changes when you publish.
 */
const FREQUENCY = {
  home: 'weekly',
  index: 'weekly',
  post: 'monthly',
  category: 'monthly',
  tag: 'yearly',
  author: 'yearly',
  policy: 'yearly',
} as const

const PRIORITY = {
  home: 1.0,
  index: 0.9,
  post: 0.7,
  category: 0.6,
  author: 0.5,
  policy: 0.4,
  tag: 0.3,
} as const

/** Newest `dateModified` in a set, compared as instants because offsets are not lexicographic. */
function newestModified(posts: readonly PublishedPost[]): string | undefined {
  let newest: string | undefined
  for (const post of posts) {
    if (newest === undefined || Date.parse(post.dateModified) > Date.parse(newest)) {
      newest = post.dateModified
    }
  }
  return newest
}

/**
 * Group posts by a key so every hub page gets a real `lastModified`.
 *
 * One pass over `getAllPosts()` rather than a `getPostsByCategory()` call per
 * category, because that would be an N+1 against the content source at exactly
 * the moment the site has the most content in it.
 */
function groupBy(
  posts: readonly PublishedPost[],
  key: (post: PublishedPost) => readonly string[],
): Map<string, PublishedPost[]> {
  const groups = new Map<string, PublishedPost[]>()
  for (const post of posts) {
    for (const value of key(post)) {
      const bucket = groups.get(value)
      if (bucket) bucket.push(post)
      else groups.set(value, [post])
    }
  }
  return groups
}

/**
 * Escape the two string-valued fields of an entry, applied to every entry on the
 * way out.
 *
 * One place rather than seven call sites, and it runs last, so an entry added
 * later cannot forget. See rule 4 in the header for why this is not optional.
 */
function escapeEntry(entry: MetadataRoute.Sitemap[number]): MetadataRoute.Sitemap[number] {
  return {
    ...entry,
    url: escapeXml(entry.url),
    ...(entry.images ? { images: entry.images.map(escapeXml) } : {}),
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [posts, categories, authors, tags] = await Promise.all([
    getAllPosts(),
    getAllCategories(),
    getAllAuthors(),
    getAllTags(),
  ])

  const byCategory = groupBy(posts, (post) => [post.category.slug])
  const byAuthor = groupBy(posts, (post) => [post.author.slug])
  // Keyed by slug, which is the same key `getAllTags()` counts on and the same
  // one the tag route resolves. Grouping on the raw string would miss posts that
  // wrote the same tag with different casing or spacing.
  const byTag = groupBy(posts, (post) => post.tags.map((tag) => tagSlug(tag)))

  const siteLastModified = newestModified(posts)

  const entries: MetadataRoute.Sitemap = [
    {
      url: absoluteUrl('/'),
      lastModified: siteLastModified,
      changeFrequency: FREQUENCY.home,
      priority: PRIORITY.home,
    },
    {
      url: absoluteUrl('/blog'),
      lastModified: siteLastModified,
      changeFrequency: FREQUENCY.index,
      priority: PRIORITY.index,
    },
    /**
     * The editorial policy page ships in `@agentblog/eeat-pages`. If you removed
     * that page, remove this entry too: a 404 in a sitemap is a crawl-quality
     * signal exactly like a noindexed URL in a sitemap is.
     */
    {
      url: absoluteUrl('/editorial-policy'),
      lastModified: siteLastModified,
      changeFrequency: FREQUENCY.policy,
      priority: PRIORITY.policy,
    },
  ]

  for (const post of posts) {
    const hero = post.heroImage
    entries.push({
      url: postUrl(post.slug),
      // From the content, never from the clock. See rule 1 in the header.
      lastModified: post.dateModified,
      changeFrequency: FREQUENCY.post,
      priority: PRIORITY.post,
      // Conditional spread rather than `images: undefined`, so the shape stays
      // valid under `exactOptionalPropertyTypes`.
      ...(hero ? { images: [absoluteUrl(hero)] } : {}),
    })
  }

  for (const category of categories) {
    entries.push({
      url: categoryUrl(category.slug),
      // Computed from the posts in the hub, with the source's own value as a
      // fallback. The computed one cannot disagree with what the page renders.
      lastModified: newestModified(byCategory.get(category.slug) ?? []) ?? category.latestPostDate,
      changeFrequency: FREQUENCY.category,
      priority: PRIORITY.category,
    })
  }

  /**
   * Only authors who have actually published something.
   *
   * `app/authors/[slug]/page.tsx` sets `robots: { index: false }` on an author
   * with no posts, so the same rule has to gate this list. An author record
   * added before their first post ships is a real page (it still 200s, and every
   * Article graph's `author` link needs it to) with nothing on it, and listing a
   * noindexed URL here is the site telling a crawler "please index this" in one
   * machine-readable surface and "do not index this" in another. If you change
   * one, change both.
   */
  for (const author of authors) {
    const authored = byAuthor.get(author.slug) ?? []
    if (authored.length === 0) continue
    entries.push({
      url: authorUrl(author.slug),
      lastModified: newestModified(authored),
      changeFrequency: FREQUENCY.author,
      priority: PRIORITY.author,
    })
  }

  /**
   * Only tags the tag route actually lets search engines index.
   *
   * `app/blog/tag/[slug]/page.tsx` sets `robots: { index: false }` below
   * `config.noindexTagsBelow`, so the same threshold has to gate this list. If
   * you change one, change both, or the sitemap starts advertising URLs that
   * tell the crawler to go away when it arrives.
   */
  for (const { tag, count } of tags) {
    if (count < config.noindexTagsBelow) continue
    entries.push({
      url: tagUrl(tag),
      lastModified: newestModified(byTag.get(tagSlug(tag)) ?? []),
      changeFrequency: FREQUENCY.tag,
      priority: PRIORITY.tag,
    })
  }

  /**
   * Deliberately absent: paginated index pages (`/blog/page/2` and friends).
   * They are reachable through real `<a href>` links from `/blog`, they carry no
   * content of their own, and listing them adds URLs that compete with the hub.
   *
   * Also deliberately absent: any URL count management. Google's limit is 50,000
   * URLs per sitemap. Past that, split with `generateSitemaps()` and point
   * `robots.ts` at the index. Almost no blog reaches it.
   */
  return entries.map(escapeEntry)
}
