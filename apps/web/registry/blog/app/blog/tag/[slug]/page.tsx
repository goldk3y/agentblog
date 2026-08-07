/**
 * A tag archive. Noindexed while it is thin, indexable once it is not.
 *
 * ---------------------------------------------------------------------------
 * FOR THE HUMAN MAINTAINER AND FOR THE CODING AGENT EDITING THIS FILE
 * ---------------------------------------------------------------------------
 * Tags are freeform, so a blog with 60 posts routinely produces 200 tag pages,
 * most of them listing one or two posts and containing no writing of their own.
 * Indexing all of them is the classic way a blog spends its crawl budget on
 * near-empty URLs that compete with the posts they link to.
 *
 * So this route flips its own robots directive on a count:
 *
 *   fewer than `config.noindexTagsBelow` posts   `index: false, follow: true`
 *   at or above the threshold                    indexable
 *
 * `follow: true` in both cases, always. `noindex` says "do not list this URL in
 * results". `nofollow` would say "do not use the links on it", which would cut
 * the only crawl path from this page to the posts it lists. Noindex plus follow
 * is the combination that removes the thin page from the index while keeping the
 * link equity flowing through it.
 *
 * The threshold is a config value rather than a constant because the right
 * number depends on how a given blog uses tags. Change it in
 * `agentblog.config.ts`, not here.
 *
 * @see https://docs.agentblog.dev/reference/files
 * @see https://docs.agentblog.dev/concepts/geo-playbook*/
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { Breadcrumbs } from '@/components/blog/breadcrumbs'
import { JsonLd } from '@/components/blog/json-ld'
import { PostList } from '@/components/blog/post-list'
import {
  DISPLAY,
  META,
  PAGE_HEADER,
  SECTION_GAP,
  TITLE_CLUSTER,
} from '@/components/blog/type-scale'
import { absoluteUrl, config, tagUrl } from '@/lib/config'
import { buildListMetadata, googleBotDefaults } from '@/lib/metadata'
import { getAllTags, getPostsByTag } from '@/lib/posts'
import { buildBreadcrumb } from '@/lib/schema'
import { cn } from '@/lib/utils'

/*
 * ISR window in seconds. THIS MUST STAY A NUMERIC LITERAL.
 *
 * `export const revalidate = config.revalidate` does not work. Next.js reads
 * route segment config both by evaluating the module and by statically reading
 * the AST (`next/dist/build/analysis/extract-const-value.js`), and the AST
 * reader accepts only literals. A member expression is reported as
 * `Unsupported node type "MemberExpression"`, which throws in `next dev` (error
 * E1013) and logs a build error in production.
 *
 * Keep this equal to `revalidate` in `agentblog.config.ts`. `agentblog doctor`
 * compares the two, because nothing in the type system can.
 */
export const revalidate = 3600

/*
 * Default, written out so nobody sets it to `false`. A tag introduced by a post
 * published after the last build would otherwise 404, and Next.js does not
 * re-run `generateStaticParams` during ISR to add it.
 */
export const dynamicParams = true

/**
 * Every tag, including the thin ones.
 *
 * Prerendering a tag page that is going to be noindexed is not wasted work. The
 * page still has to serve a real 200 with real links on it, because `follow` is
 * on and those links are a crawl path to the posts. Filtering the list here to
 * "only the indexable tags" would leave the rest rendering on demand for no
 * benefit.
 *
 * Next.js encodes these values into the URL and decodes them back into `params`,
 * so a tag containing a space or a slash round trips without any manual
 * `encodeURIComponent` at this layer.
 */
export async function generateStaticParams() {
  const tags = await getAllTags()
  // `slug`, never `tag`. The display text may contain spaces and capitals; the
  // route segment must not.
  return tags.map(({ slug }) => ({ slug }))
}

/**
 * The authored text for a tag slug, for everything a reader or a search result
 * actually sees.
 *
 * The route segment is the slug (`ai-crawlers`), which is the right shape for a
 * URL and the wrong shape for a heading, a `<title>`, a meta description, or a
 * breadcrumb. `getAllTags()` returns `{ tag, slug, count }` precisely so the
 * authored spelling ("AI crawlers") is recoverable from the slug, and it keeps
 * the first spelling it saw so the display text is stable across builds.
 *
 * Falls back to the slug for a tag the source no longer knows about, which is
 * the honest answer: it is better to show `ai-crawlers` than to fail rendering a
 * page that still lists posts.
 */
async function displayTag(slug: string): Promise<string> {
  const tags = await getAllTags()
  return tags.find((entry) => entry.slug === slug)?.tag ?? slug
}

export async function generateMetadata(props: PageProps<'/blog/tag/[slug]'>): Promise<Metadata> {
  const { slug } = await props.params
  const posts = await getPostsByTag(slug)
  if (posts.length === 0) return {}

  const label = await displayTag(slug)
  const indexable = posts.length >= config.noindexTagsBelow

  /*
   * `buildListMetadata` is where `openGraphDefaults` and `robotsDefaults` get
   * spread. Metadata merging in Next.js is shallow: an inline `openGraph` object
   * here would replace the root layout's entire object and drop `og:site_name`,
   * and an inline `robots` object would drop `max-snippet: -1`, the directive
   * that permits full snippets in AI answers.
   */
  const base = buildListMetadata({
    title: `Posts tagged ${label}`,
    description: `Every ${config.brand.name} post tagged ${label}.`,
    path: `/blog/tag/${slug}`,
    index: indexable,
  })

  const metadata: Metadata = {
    ...base,
    // Canonical composed by `tagUrl`, never by concatenating `siteUrl`.
    alternates: { ...base.alternates, canonical: tagUrl(slug) },
  }

  if (indexable) return metadata

  /*
   * The thin-page branch, written out rather than left to the builder so the
   * reasoning is visible at the point of decision.
   *
   * `robots` is a nested object, so setting it here replaces whatever the root
   * layout declared, wholesale. That is why `googleBotDefaults` is spread into
   * `googleBot` before the two overrides: without the spread, this page would
   * ship `noindex` and would also silently lose `max-image-preview: large` and
   * `max-snippet: -1`. Those two directives govern how much of a page an AI
   * answer may quote, and losing them on a followed page is a real regression
   * even though the page itself is not indexed.
   */
  return {
    ...metadata,
    robots: {
      index: false,
      follow: true,
      googleBot: { ...googleBotDefaults, index: false, follow: true },
    },
  }
}

export default async function TagPage(props: PageProps<'/blog/tag/[slug]'>) {
  // `params` is a Promise in Next.js 16 and synchronous access was removed.
  // The type comes from `next typegen` rather than being hand written, so it
  // tracks the real route tree.
  const { slug } = await props.params
  const posts = await getPostsByTag(slug)

  // A tag nobody uses is a real 404. Rendering an empty archive with a 200 is a
  // soft 404 and would let any mistyped tag in any inbound link mint a new
  // contentless URL.
  if (posts.length === 0) notFound()

  // The authored spelling, not the URL slug. See `displayTag` above.
  const label = await displayTag(slug)

  const trail: { name: string; url?: string }[] = [
    { name: 'Home', url: absoluteUrl('/') },
    { name: 'Blog', url: absoluteUrl('/blog') },
    { name: label },
  ]

  return (
    <>
      <div className={cn('mx-auto w-full max-w-(--agentblog-rail) px-6', SECTION_GAP)}>
        <header className={PAGE_HEADER}>
          <Breadcrumbs
            trail={trail.map((crumb) =>
              crumb.url ? { name: crumb.name, href: crumb.url } : { name: crumb.name },
            )}
          />

          <div className={TITLE_CLUSTER}>
            {/* Exactly one <h1> on this page. */}
            <h1 className={DISPLAY}>{`Posts tagged ${label}`}</h1>

            <p className={META}>{posts.length === 1 ? '1 post' : `${posts.length} posts`}</p>
          </div>
        </header>

        <PostList posts={posts} />
      </div>

      {/* One serialization point. Only the breadcrumb: the listed posts emit
          their own Article nodes on their own routes, and a tag archive has no
          content of its own to describe. */}
      <JsonLd nodes={[buildBreadcrumb(trail, `/blog/tag/${slug}`)]} />
    </>
  )
}
