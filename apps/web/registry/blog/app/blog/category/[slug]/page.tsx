/**
 * A category hub. Indexable on purpose, unlike the tag pages next door.
 *
 * ---------------------------------------------------------------------------
 * FOR THE HUMAN MAINTAINER AND FOR THE CODING AGENT EDITING THIS FILE
 * ---------------------------------------------------------------------------
 * Categories are a small fixed set (5 to 10 is the working range) with one
 * primary category per post. That makes each of these pages a legitimate topical
 * hub that can rank and can be cited on its own, which is why they are indexed
 * while tag pages usually are not.
 *
 * The category description is rendered prominently, directly under the H1 and
 * above the post list. This is not decoration. A hub page whose entire body is a
 * list of post titles has no content of its own, competes with the posts it
 * links to, and reads to a crawler as a thin doorway page. That is why
 * `CategorySchema` makes `description` required rather than optional: the schema
 * refuses to construct a category that would produce a thin hub. If you remove
 * the paragraph below, you have reintroduced the problem the schema exists to
 * prevent.
 *
 * @see https://docs.agentblog.dev/reference/files
 * @see https://docs.agentblog.dev/concepts/geo-playbook
 */
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { Breadcrumbs } from '@/components/blog/breadcrumbs'
import { CategoryPills } from '@/components/blog/category-pills'
import { JsonLd } from '@/components/blog/json-ld'
import { PostList } from '@/components/blog/post-list'
import { absoluteUrl, categoryUrl } from '@/lib/config'
import { buildListMetadata } from '@/lib/metadata'
import { getAllCategories, getCategory, getPostsByCategory } from '@/lib/posts'
import { buildBreadcrumb } from '@/lib/schema'

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
 * Default, written out so nobody sets it to `false`. With `false`, a category
 * added after the last build becomes a hard 404 instead of a slow first render,
 * and Next.js does not re-run `generateStaticParams` during ISR to fix it.
 */
export const dynamicParams = true

/**
 * Every category. Not a subset.
 *
 * The set is small, so slicing here saves nothing measurable and costs the
 * prerender for whichever hubs fall off the end. Those hubs still resolve
 * because `dynamicParams` is `true`, but they render on demand, which means
 * their metadata can be streamed rather than sitting in `<head>`.
 */
export async function generateStaticParams() {
  const categories = await getAllCategories()
  return categories.map((category) => ({ slug: category.slug }))
}

export async function generateMetadata(
  props: PageProps<'/blog/category/[slug]'>,
): Promise<Metadata> {
  const { slug } = await props.params
  const category = await getCategory(slug)
  if (!category) return {}

  /*
   * `buildListMetadata` is the only place `openGraphDefaults` and
   * `robotsDefaults` get spread. Metadata merging in Next.js is shallow, so
   * inlining an `openGraph` object here would replace the root layout's entire
   * object and drop `og:site_name`, and inlining a `robots` object would drop
   * `max-snippet: -1`, the directive that permits full snippets in AI answers.
   * Both failures pass type checking and every structured data validator, which
   * is exactly why the construction is centralised.
   */
  const base = buildListMetadata({
    title: category.name,
    description: category.description,
    path: `/blog/category/${category.slug}`,
    // Category hubs are indexable. This is the deliberate difference from
    // `/blog/tag/[slug]`, which noindexes below a post-count threshold.
    index: true,
  })

  return {
    ...base,
    // Canonical composed by `categoryUrl`, never by concatenating `siteUrl`.
    // `alternates` is a nested object and gets the same shallow-merge treatment
    // as `openGraph`: spread what the builder produced, override one key.
    alternates: { ...base.alternates, canonical: categoryUrl(category.slug) },
  }
}

export default async function CategoryPage(props: PageProps<'/blog/category/[slug]'>) {
  // `params` is a Promise in Next.js 16 and synchronous access was removed.
  // `PageProps<'/blog/category/[slug]'>` comes from `next typegen`, which
  // derives it from the real route tree, so renaming the segment breaks the
  // build instead of silently breaking the page.
  const { slug } = await props.params

  const [category, categories] = await Promise.all([getCategory(slug), getAllCategories()])

  // An absent category is a real 404, never an empty hub returned with a 200.
  // A soft 404 here would put an indexable, contentless URL in the crawl graph
  // for every mistyped category anyone ever links to.
  if (!category) notFound()

  const posts = await getPostsByCategory(category.slug)

  const trail: { name: string; url?: string }[] = [
    { name: 'Home', url: absoluteUrl('/') },
    { name: 'Blog', url: absoluteUrl('/blog') },
    { name: category.name },
  ]

  return (
    <div>
      {/* Breadcrumb hrefs come from the config URL helpers, so the visible trail
          and the BreadcrumbList built from the same array below cannot drift. */}
      <Breadcrumbs
        trail={trail.map((crumb) =>
          crumb.url ? { name: crumb.name, href: crumb.url } : { name: crumb.name },
        )}
      />

      {/* Exactly one <h1> on this page. */}
      <h1 className="text-foreground mt-6 text-4xl font-semibold tracking-tight text-balance">
        {category.name}
      </h1>

      {/* THE HUB'S OWN CONTENT. Keep it. See the header block for why a category
          page that is only a list of links is a crawl liability. */}
      <p className="text-muted-foreground mt-4 text-lg">{category.description}</p>

      <p className="text-muted-foreground mt-2 text-sm">
        {posts.length === 1 ? '1 post' : `${posts.length} posts`}
      </p>

      {/* Sibling hubs, so a crawler that lands here has a path to the rest of
          the taxonomy without going back through the site navigation. */}
      <CategoryPills activeSlug={category.slug} categories={categories} />

      <PostList posts={posts} />

      {/* One serialization point. The breadcrumb is the only graph this page
          owns: the posts it links to emit their own Article nodes, and claiming
          a `Blog` node at this URL would duplicate the `@id` that `/blog` uses. */}
      <JsonLd nodes={[buildBreadcrumb(trail, `/blog/category/${category.slug}`)]} />
    </div>
  )
}
