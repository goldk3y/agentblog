/**
 * The content facade. Every route reads posts through this file.
 *
 * ---------------------------------------------------------------------------
 * WHY A FACADE INSTEAD OF CALLING `config.source` DIRECTLY
 * ---------------------------------------------------------------------------
 * `config.source` is a `ContentSource`: MDX files today, a database or a hosted
 * service later. Swapping it should be one line in `agentblog.config.ts`. That
 * promise only holds if nothing outside this file knows the adapter exists, so
 * routes import `@/lib/posts` and never `config.source`. When the adapter grows
 * a new capability, or an old one needs a shim, this file absorbs it.
 *
 * The facade also owns three things the adapter contract deliberately leaves
 * out, because they are presentation concerns rather than storage concerns:
 * pagination, tag aggregation, and slug validation.
 *
 * ---------------------------------------------------------------------------
 * SLUGS ARRIVE AS UNVALIDATED STRINGS
 * ---------------------------------------------------------------------------
 * `ContentSource` takes a branded `Slug`, which can only be produced by parsing.
 * Route params are plain strings straight off the URL bar, so every entry point
 * here parses first. A slug that cannot be valid returns `null` or `[]` rather
 * than throwing: `/blog/../../etc/passwd` is a 404, not a 500. Genuine failures
 * (the source is unreachable, a post is malformed) still throw, because at build
 * time a thrown error is the correct outcome and a swallowed one ships a sitemap
 * that quietly lost half its URLs.
 *
 * ---------------------------------------------------------------------------
 * CACHING
 * ---------------------------------------------------------------------------
 * React's `cache()` deduplicates within a single render pass and, at build time,
 * within a single page's `generateStaticParams` plus `generateMetadata` plus
 * component tree. That matters because a post page asks for the same data three
 * times through three different framework entry points. The cache keys are
 * primitives, not option objects, because `cache()` compares arguments by
 * identity and a fresh `{ includeDrafts: false }` literal would miss on every
 * call.
 *
 * @see https://agentblog.dev/docs/content-sources
 */
import 'server-only'

import { cache } from 'react'

import { config, tagSlug } from '@/lib/config'
import { Slug } from '@/lib/schemas'
import type { Author, Category, Post, PostQuery, PublishedPost } from '@/lib/types'

/* -------------------------------------------------------------------------- */
/*  Cached adapter calls. Primitive arguments only, so `cache()` actually hits. */
/* -------------------------------------------------------------------------- */

const allPosts = cache(
  (includeDrafts: boolean, locale: string | undefined): Promise<PublishedPost[]> =>
    config.source.getAllPosts(buildQuery(includeDrafts, locale)),
)

const postBySlug = cache(
  (slug: Slug, includeDrafts: boolean, locale: string | undefined): Promise<Post | null> =>
    config.source.getPost(slug, buildQuery(includeDrafts, locale)),
)

const allCategories = cache((): Promise<Category[]> => config.source.getAllCategories())

const allAuthors = cache((): Promise<Author[]> => config.source.getAllAuthors())

const postsByCategory = cache((slug: Slug): Promise<PublishedPost[]> =>
  config.source.getPostsByCategory(slug),
)

const postsByAuthor = cache((slug: Slug): Promise<PublishedPost[]> =>
  config.source.getPostsByAuthor(slug),
)

/**
 * Build a `PostQuery` without ever writing an explicit `undefined`.
 * `exactOptionalPropertyTypes` treats `{ locale: undefined }` and `{}` as
 * different types, and adapters are entitled to tell them apart.
 */
function buildQuery(includeDrafts: boolean, locale: string | undefined): PostQuery {
  return locale === undefined ? { includeDrafts } : { includeDrafts, locale }
}

/** `null` for anything that could not be a slug, so a bad URL is a 404. */
function parseSlug(slug: string): Slug | null {
  const parsed = Slug.safeParse(slug)
  return parsed.success ? parsed.data : null
}

/* -------------------------------------------------------------------------- */
/*  Reads                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Every published post. Ordering is the adapter's responsibility; `mdxSource`
 * returns newest first.
 *
 * `generateStaticParams` feeds on this and must return **every** slug, never a
 * page of them. Slicing here is what turns a prerendered blog into a partly
 * prerendered one, and the missing posts are invisible until a crawler asks.
 */
export function getAllPosts(opts?: PostQuery): Promise<PublishedPost[]> {
  return allPosts(opts?.includeDrafts ?? false, opts?.locale)
}

/** One post, or `null` when the slug is absent or malformed. */
export function getPost(slug: string, opts?: PostQuery): Promise<Post | null> {
  const parsed = parseSlug(slug)
  if (parsed === null) return Promise.resolve(null)
  return postBySlug(parsed, opts?.includeDrafts ?? false, opts?.locale)
}

/** Every category, including ones with no published posts. */
export function getAllCategories(): Promise<Category[]> {
  return allCategories()
}

/** Every author record, whether or not they have published. */
export function getAllAuthors(): Promise<Author[]> {
  return allAuthors()
}

/** One category by slug, or `null`. Resolved from the full list, which is cached. */
export async function getCategory(slug: string): Promise<Category | null> {
  const parsed = parseSlug(slug)
  if (parsed === null) return null
  const categories = await allCategories()
  return categories.find((category) => category.slug === parsed) ?? null
}

/** One author by slug, or `null`. */
export async function getAuthor(slug: string): Promise<Author | null> {
  const parsed = parseSlug(slug)
  if (parsed === null) return null
  const authors = await allAuthors()
  return authors.find((author) => author.slug === parsed) ?? null
}

/** Published posts in a category. `[]` for an unknown or malformed slug. */
export function getPostsByCategory(slug: string): Promise<PublishedPost[]> {
  const parsed = parseSlug(slug)
  if (parsed === null) return Promise.resolve([])
  return postsByCategory(parsed)
}

/** Published posts by an author. `[]` for an unknown or malformed slug. */
export function getPostsByAuthor(slug: string): Promise<PublishedPost[]> {
  const parsed = parseSlug(slug)
  if (parsed === null) return Promise.resolve([])
  return postsByAuthor(parsed)
}

/**
 * Published posts carrying a tag, matched case insensitively.
 *
 * Tags are free text rather than slugs, so this is a filter over the full post
 * list rather than an adapter call. That is deliberate: adding a tag index to
 * `ContentSource` would make every future adapter implement it, for a feature
 * whose whole point is that it needs no schema.
 */
export async function getPostsByTag(tag: string): Promise<PublishedPost[]> {
  // The argument arrives from a route param, so it is already the slug form.
  // Comparing slug to slug is what keeps `/blog/tag/ai-crawlers` and a post
  // tagged "AI crawlers" describing the same set.
  const needle = tagSlug(tag)
  if (needle === '') return []
  const posts = await getAllPosts()
  return posts.filter((post) => post.tags.some((t) => tagSlug(t) === needle))
}

/**
 * Every tag with its published post count, most used first, then alphabetical.
 *
 * `tag` is the display text as first authored, `slug` is its URL form, and the
 * count is what `config.noindexTagsBelow` compares against, so the tag route can
 * decide whether a given tag page is worth indexing before it renders. Returning
 * both spellings is what keeps `generateStaticParams` from emitting a route
 * segment containing a space.
 */
export async function getAllTags(): Promise<{ tag: string; slug: string; count: number }[]> {
  const posts = await getAllPosts()
  const counts = new Map<string, { tag: string; slug: string; count: number }>()

  for (const post of posts) {
    for (const raw of post.tags) {
      const tag = raw.trim()
      if (tag === '') continue
      // Keyed by slug rather than by lowercase text, so "AI crawlers" and
      // "ai-crawlers" collapse into the one tag page they both link to.
      const key = tagSlug(tag)
      if (key === '') continue
      const existing = counts.get(key)
      // First spelling seen wins, so display casing stays stable across builds.
      if (existing) existing.count += 1
      else counts.set(key, { tag, slug: key, count: 1 })
    }
  }

  return [...counts.values()].sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
}

/**
 * Related posts: the author's editorial list first, in their order, then
 * computed matches to fill the gap. The precedence lives in the adapter, which
 * is the only place that can resolve editorial slugs in one round trip.
 */
export function getRelatedPosts(post: Post, limit = 3): Promise<PublishedPost[]> {
  return config.source.getRelatedPosts(post, limit)
}

/**
 * One page of the index, clamped to a page that exists.
 *
 * `page` comes from a URL segment, so it can be `0`, `-3`, `NaN`, or larger than
 * the last page. Clamping rather than 404ing keeps `/blog/page/999` a real page
 * with real links instead of a soft 404 that a crawler has to interpret. The
 * returned `page` is the clamped value, so pagination links stay consistent.
 */
export async function getPage(
  page: number,
): Promise<{ posts: PublishedPost[]; totalPages: number; page: number }> {
  const posts = await getAllPosts()
  const perPage = config.postsPerPage
  const totalPages = Math.max(1, Math.ceil(posts.length / perPage))

  const requested = Number.isFinite(page) ? Math.trunc(page) : 1
  const current = Math.min(Math.max(requested, 1), totalPages)
  const start = (current - 1) * perPage

  return { posts: posts.slice(start, start + perPage), totalPages, page: current }
}
