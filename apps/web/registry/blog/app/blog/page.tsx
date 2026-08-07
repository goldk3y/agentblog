/**
 * The blog index. Paginated, indexable, and crawlable without JavaScript.
 *
 * ---------------------------------------------------------------------------
 * FOR THE HUMAN MAINTAINER AND FOR THE CODING AGENT EDITING THIS FILE
 * ---------------------------------------------------------------------------
 * This page is the discovery path to every post. If pagination here stops
 * working for a client that does not run JavaScript, deep posts stop being
 * reachable by crawl even though they are all in the sitemap. So the pagination
 * is real `<a href>` links, produced by `<Pagination>`, and never a click
 * handler, a router push, or an infinite scroll.
 *
 * ---------------------------------------------------------------------------
 * PAGINATION DECISION: `?page=N`, NOT `/blog/page/N`
 * ---------------------------------------------------------------------------
 * This block paginates with a `?page=N` search parameter on this single route.
 * The alternative, a `/blog/page/[page]` path segment, is better in one respect
 * and worse in another, so here is the whole trade written down rather than
 * left implicit:
 *
 *   `?page=N` (chosen)   One route file. Nothing to keep in sync. But reading
 *                        `searchParams` is a request-time API, so this route
 *                        renders on demand instead of being prerendered. The
 *                        response is still complete HTML in the first byte,
 *                        because nothing here is wrapped in Suspense, so a
 *                        crawler loses nothing. What it costs is TTFB and CDN
 *                        cacheability on the index page only. Post pages, which
 *                        are the pages that actually get cited, are unaffected:
 *                        they are fully prerendered.
 *
 *   `/blog/page/N`       Fully prerenderable, better TTFB. Costs a second route
 *                        file whose `generateStaticParams` must stay in step
 *                        with `postsPerPage`, and a redirect rule so that
 *                        `/blog/page/1` does not become a duplicate of `/blog`.
 *
 * If you want the path-segment form, add `app/blog/page/[page]/page.tsx` and
 * change the `basePath` passed to `<Pagination>` below at the same time. Those
 * two edits go together; doing one without the other produces 404s on page 2.
 *
 * CANONICAL STRATEGY FOR `?page=`. Each paginated page self-canonicalizes.
 * Page 1 canonicalizes to `/blog` with no query string, and pages 2 and up
 * canonicalize to their own `?page=N` URL. Canonicalizing every page to `/blog`
 * would be the intuitive move and it is wrong: it tells Google the deep pages
 * are duplicates, which removes the only crawl path to older posts. Google
 * stopped using `rel="prev"`/`rel="next"` for indexing years ago, so those are
 * emitted below for other engines and for assistive technology, not relied on.
 *
 * A page number past the end returns a real 404 rather than an empty list, so
 * `?page=9999` cannot mint an unlimited supply of thin indexable URLs.
 *
 * @see https://docs.agentblog.dev/reference/files
 * @see https://docs.agentblog.dev/concepts/geo-playbook
 */
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { Breadcrumbs } from '@/components/blog/breadcrumbs'
import { CategoryPills } from '@/components/blog/category-pills'
import { JsonLd } from '@/components/blog/json-ld'
import { Pagination } from '@/components/blog/pagination'
import { PostList } from '@/components/blog/post-list'
import {
  CLUSTER_GAP,
  DISPLAY,
  LEDE,
  META,
  PAGE_HEADER,
  SECTION_GAP,
  TITLE_CLUSTER,
} from '@/components/blog/type-scale'
import { absoluteUrl, blogPath, config } from '@/lib/config'
import { buildListMetadata } from '@/lib/metadata'
import { getAllCategories, getPage } from '@/lib/posts'
import { buildBlogGraph, buildBreadcrumb } from '@/lib/schema'
import { cn } from '@/lib/utils'

/*
 * ISR window in seconds. THIS MUST STAY A NUMERIC LITERAL.
 *
 * `export const revalidate = config.revalidate` does not compile cleanly.
 * Next.js reads route segment config both by evaluating the module and by
 * statically reading the AST (`next/dist/build/analysis/extract-const-value.js`),
 * and the AST reader accepts only literals. A member expression is reported as
 * `Unsupported node type "MemberExpression"`, which throws in `next dev` (error
 * E1013) and logs a build error in production.
 *
 * Keep this equal to `revalidate` in `agentblog.config.ts`. `agentblog doctor`
 * compares the two, because nothing in the type system can.
 */
export const revalidate = 3600

const INDEX_TITLE = `${config.brand.name} blog`
const INDEX_DESCRIPTION = `Articles, guides, and reference material from ${config.brand.name}.`

/**
 * Path for a given page number. Page 1 has no query string, so it is the only
 * URL for the first page and cannot compete with `/blog` for the same content.
 */
function pagePath(page: number): string {
  return page <= 1 ? '/blog' : `/blog?page=${page}`
}

/**
 * `searchParams` values are `string | string[] | undefined`. Anything that is
 * not a positive integer falls back to page 1 rather than erroring, because a
 * malformed query string is a crawler artefact, not a user mistake.
 */
function parsePageParam(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? raw[0] : raw
  if (!value) return 1
  const parsed = Number.parseInt(value, 10)
  return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : 1
}

export async function generateMetadata(props: PageProps<'/blog'>): Promise<Metadata> {
  const requested = parsePageParam((await props.searchParams)['page'])
  // `getPage` clamps the requested page, so `page` here is the real page number
  // and the canonical below can never point at a page that does not exist.
  const { page } = await getPage(requested)

  /*
   * `buildListMetadata` is where `openGraphDefaults` and `robotsDefaults` get
   * spread. Metadata merging is shallow: writing an `openGraph` object inline
   * here would replace the root layout's entire object and drop `og:site_name`,
   * and writing a `robots` object inline would drop `max-snippet: -1`, which is
   * the directive that permits full snippets in AI answers. Neither failure is
   * visible to TypeScript or to any structured data validator, so construction
   * lives in one file and pages call into it.
   */
  const base = buildListMetadata({
    title: page > 1 ? `${INDEX_TITLE}, page ${page}` : INDEX_TITLE,
    description: INDEX_DESCRIPTION,
    path: pagePath(page),
    index: true,
  })

  return {
    ...base,
    // Self-canonical per page. See the canonical strategy note in the header.
    // Built through `absoluteUrl` so the origin is decided in exactly one place,
    // never by concatenating `siteUrl` with a path at the call site.
    alternates: { ...base.alternates, canonical: absoluteUrl(pagePath(page)) },
  }
}

export default async function BlogIndexPage(props: PageProps<'/blog'>) {
  // `searchParams` is a Promise in Next.js 16 and must be awaited. Reading it is
  // what opts this route into request-time rendering. See the pagination note in
  // the header for why that trade is acceptable on this page and only this page.
  const requested = parsePageParam((await props.searchParams)['page'])

  const [{ posts, totalPages, page }, categories] = await Promise.all([
    getPage(requested),
    getAllCategories(),
  ])

  // A page number past the last real page is a 404, not an empty list. An empty
  // list returned with a 200 is a soft 404 and lets a crawler manufacture
  // unlimited thin URLs from the query string.
  if (requested > 1 && requested > totalPages) notFound()

  // Typed explicitly rather than inferred, so that `crumb.url` below is a legal
  // property access on every element and so the shape matches `buildBreadcrumb`
  // exactly. Note the `?:` rather than `| undefined`: this repo compiles with
  // `exactOptionalPropertyTypes`, so an absent crumb URL is an absent key.
  const trail: { name: string; url?: string }[] =
    page > 1
      ? [
          { name: 'Home', url: absoluteUrl('/') },
          { name: 'Blog', url: absoluteUrl('/blog') },
          { name: `Page ${page}` },
        ]
      : [{ name: 'Home', url: absoluteUrl('/') }, { name: 'Blog' }]

  return (
    <>
      {/*
       * `rel="prev"` and `rel="next"` as real `<link>` elements. React hoists
       * `<link>` rendered anywhere in the tree into `<head>`, which is the only
       * way to emit these: the Next.js `Metadata` type has no field for them.
       * Google ignores them for indexing. Other engines and some readers do not,
       * and they cost nothing. The `<a rel>` attributes on the pagination
       * controls below carry the same relationship for assistive technology.
       *
       * These sit OUTSIDE the flex column below, and so does the `<JsonLd>` at
       * the foot of this file. A `<link>` and a `<script>` render nothing, but
       * they are still flex items, and a flex item with no height still takes a
       * full `gap` on each side. Inside the column they would open 128px of
       * blank page that no element accounts for and no inspector attributes to
       * anything. Metadata goes outside the layout, always.
       */}
      {page > 1 ? <link href={absoluteUrl(pagePath(page - 1))} rel="prev" /> : null}
      {page < totalPages ? <link href={absoluteUrl(pagePath(page + 1))} rel="next" /> : null}

      {/*
       * The wide rail, because this page is a card grid rather than a reading
       * column. `SECTION_GAP` is the only vertical spacing here: no child below
       * sets a margin of its own, which is what makes it impossible for one of
       * them to sit flush against its neighbour, as the category pills and the
       * post grid did at a measured zero pixels before this rule existed.
       * See `components/blog/type-scale.ts`.
       */}
      <div className={cn('mx-auto w-full max-w-(--agentblog-rail) px-6', SECTION_GAP)}>
        <header className={PAGE_HEADER}>
          {/* Breadcrumb hrefs come from the config URL helpers, same as every
              canonical, so the visible trail and the BreadcrumbList JSON-LD built
              from the same array below can never disagree about a URL. */}
          <Breadcrumbs
            trail={trail.map((crumb) =>
              crumb.url ? { name: crumb.name, href: crumb.url } : { name: crumb.name },
            )}
          />

          <div className={TITLE_CLUSTER}>
            {/* Exactly one <h1>, and it does not change on page 2. Paginated pages
                are the same collection viewed further down, not a different topic. */}
            <h1 className={DISPLAY}>{INDEX_TITLE}</h1>
            <p className={LEDE}>{INDEX_DESCRIPTION}</p>

            {page > 1 ? <p className={META}>{`Page ${page} of ${totalPages}`}</p> : null}
          </div>
        </header>

        {/* Pills and grid are one cluster, at the tighter rhythm: the filters
            belong to the results, not to the page header above them. */}
        <div className={CLUSTER_GAP}>
          {/* Category hubs are linked from the index so the hub and spoke graph
              has a real entry point that does not depend on the host site
              navigation. */}
          <CategoryPills categories={categories} />

          <PostList posts={posts} />
        </div>

        {/*
         * Real `<a href>` pagination. `basePath` is the route that `<Pagination>`
         * appends `?page=N` to.
         *
         * It comes from `blogPath()` rather than the literal `/blog`, because
         * that helper is the only thing that applies `config.trailingSlash`.
         * Pass a literal and every page-2-and-beyond link on a
         * `trailingSlash: true` site points at a URL that 308s before it serves,
         * on the one surface that is often the only crawl path to deep posts.
         *
         * If you switch this block to a `/blog/page/[page]` path segment, this
         * value and the URL form inside `<Pagination>` must change together.
         * They are the same decision expressed in two files.
         *
         * `<Pagination>` returns null on a single-page blog, and null is not a
         * flex item, so the gap above it disappears with it.
         */}
        <Pagination basePath={blogPath()} page={page} totalPages={totalPages} />
      </div>

      {/*
       * `Blog` JSON-LD listing the posts on THIS page, linked by `@id` to the
       * Article nodes those posts emit on their own routes. Listing every post
       * in the archive here instead would claim that all of them appear on this
       * URL, which is not what a reader or a crawler sees.
       *
       * The BreadcrumbList is built from the same `trail` array that renders
       * above it, so the markup and the schema cannot drift apart.
       */}
      {/* `pagePath(page)` goes to both nodes, and to the canonical above. The
          `Blog` node is keyed by path because `/blog` and `/blog?page=2` list
          different posts: one `@id` across both would describe one entity two
          incompatible ways, and whichever page a crawler fetched last would
          win. */}
      <JsonLd
        nodes={[buildBlogGraph(posts, pagePath(page)), buildBreadcrumb(trail, pagePath(page))]}
      />
    </>
  )
}
