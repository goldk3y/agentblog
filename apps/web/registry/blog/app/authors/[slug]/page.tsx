/**
 * An author page. This is an E-E-A-T lookup surface, not an archive with a
 * headshot on it.
 *
 * ---------------------------------------------------------------------------
 * FOR THE HUMAN MAINTAINER AND FOR THE CODING AGENT EDITING THIS FILE
 * ---------------------------------------------------------------------------
 * Google's Search Quality Rater Guidelines direct raters to look up the author
 * of a page and find out who they are. An AI answer engine does something
 * structurally similar and cheaper: it follows `author` from the Article node to
 * this URL and reads the `Person` graph it finds. So the three properties that
 * matter most here are the ones a human would go looking for:
 *
 *   `sameAs`      Absolute profile URLs. The single highest value property in
 *                 the whole block, because it is what turns the string "Jane Doe"
 *                 into a resolvable entity. A bare handle such as `@janedoe`
 *                 disambiguates nothing, which is why `AbsoluteUrl` rejects it
 *                 at the schema layer rather than here.
 *   `knowsAbout`  The topics this person is credible on.
 *   `worksFor`    The organization, as a URL rather than a name string.
 *
 * All three come from `content/authors.json` through `buildPersonGraph`. If an
 * author record has none of them, this page still renders, and it is worth
 * roughly nothing. Filling them in is the cheapest credibility work available.
 *
 * This route lives at `/authors/[slug]`, outside `/blog`, so it does not inherit
 * `app/blog/layout.tsx`. That is deliberate: the author page is a site-level
 * entity page, not a blog archive page.
 *
 * @see https://agentblog.dev/docs/blog-block
 * @see https://agentblog.dev/docs/geo-playbook
 */
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { AuthorBio } from '@/components/blog/author-bio'
import { Breadcrumbs } from '@/components/blog/breadcrumbs'
import { JsonLd } from '@/components/blog/json-ld'
import { PostList } from '@/components/blog/post-list'
import { absoluteUrl, authorUrl } from '@/lib/config'
import { buildListMetadata, googleBotDefaults } from '@/lib/metadata'
import { getAllAuthors, getAuthor, getPostsByAuthor } from '@/lib/posts'
import { buildBreadcrumb, buildPersonGraph } from '@/lib/schema'

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
 * Default, written out so nobody sets it to `false`. An author added after the
 * last build would otherwise 404, and a 404 on the page that an Article node's
 * `author` property points at breaks the entity link the whole graph depends on.
 */
export const dynamicParams = true

/**
 * Every author. Not a subset.
 *
 * Each of these URLs is referenced by `@id` from every Article that person
 * wrote, so a missing prerender is a dangling entity reference in the graph
 * rather than merely a slow page.
 */
export async function generateStaticParams() {
  const authors = await getAllAuthors()
  return authors.map((author) => ({ slug: author.slug }))
}

export async function generateMetadata(props: PageProps<'/authors/[slug]'>): Promise<Metadata> {
  const { slug } = await props.params
  const author = await getAuthor(slug)
  if (!author) return {}

  /*
   * An author with no published posts is a real page with nothing on it: a name,
   * a bio, and an empty list. It stays a 200, because a writer whose first post
   * is still in draft should have a page the moment their record exists, and
   * because this URL is the target of every `author` link in every Article
   * graph. But it must not be indexed while it is empty, for the same reason the
   * tag route noindexes a thin archive.
   *
   * `follow` stays true in both branches. `noindex` says "do not list this URL";
   * `nofollow` would say "do not use the links on it", which would cut the crawl
   * path from this page to the posts it will list as soon as there are any.
   * `app/sitemap.ts` applies the same rule and skips zero-post authors, because a
   * noindexed URL in a sitemap is the site contradicting itself in two
   * machine-readable surfaces.
   */
  const posts = await getPostsByAuthor(author.slug)
  const indexable = posts.length > 0

  /*
   * `buildListMetadata` is where `openGraphDefaults` and `robotsDefaults` get
   * spread. Metadata merging in Next.js is shallow, so writing an `openGraph`
   * object inline here would replace the root layout's entire object and drop
   * `og:site_name`, and writing a `robots` object inline would drop
   * `max-snippet: -1`, the directive that permits full snippets in AI answers.
   * Neither failure is visible to TypeScript or to any schema validator.
   */
  const base = buildListMetadata({
    title: author.name,
    // The bio doubles as the meta description because it is the one piece of
    // author copy written for a stranger. `AuthorSchema` requires it for this
    // reason.
    description: author.bio,
    path: `/authors/${author.slug}`,
    index: indexable,
    ...(author.avatar ? { images: [author.avatar] } : {}),
  })

  const metadata: Metadata = {
    ...base,
    // Canonical composed by `authorUrl`, never by concatenating `siteUrl`.
    alternates: { ...base.alternates, canonical: authorUrl(author.slug) },
  }

  if (indexable) return metadata

  /*
   * The empty-author branch, written out rather than left to the builder so the
   * reasoning is visible at the point of decision.
   *
   * `robots` is a nested object, so setting it here replaces whatever the root
   * layout declared, wholesale. That is why `googleBotDefaults` is spread into
   * `googleBot` before the two overrides: without the spread this page would
   * ship `noindex` and would also silently lose `max-image-preview: large` and
   * `max-snippet: -1`, the directives that govern how much of a page an AI
   * answer may quote.
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

export default async function AuthorPage(props: PageProps<'/authors/[slug]'>) {
  // `params` is a Promise in Next.js 16 and synchronous access was removed.
  // The type comes from `next typegen`, so it tracks the real route tree.
  const { slug } = await props.params
  const author = await getAuthor(slug)

  // An absent author is a real 404. A soft 404 here is worse than usual: this
  // URL is the target of every `author` link in every Article graph, so an
  // empty 200 would present a credible-looking entity page with nothing behind
  // it.
  if (!author) notFound()

  const posts = await getPostsByAuthor(author.slug)

  const trail: { name: string; url?: string }[] = [
    { name: 'Home', url: absoluteUrl('/') },
    { name: 'Blog', url: absoluteUrl('/blog') },
    { name: author.name },
  ]

  return (
    <div className="bg-background text-foreground mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:py-16">
      {/* Breadcrumb hrefs come from the config URL helpers, so the visible trail
          and the BreadcrumbList built from the same array below cannot drift. */}
      <Breadcrumbs
        trail={trail.map((crumb) =>
          crumb.url ? { name: crumb.name, href: crumb.url } : { name: crumb.name },
        )}
      />

      {/* Exactly one <h1>, and it is the person's name and nothing else. Job
          titles, honorifics, and the publisher name belong in `jobTitle` and
          `worksFor`, which is why `AuthorSchema` splits them out. */}
      <h1 className="text-foreground mt-6 text-4xl font-semibold tracking-tight text-balance">
        {author.name}
      </h1>

      {/* `postCount` is filled here and omitted on the post page. The query is
          already being made on this route, so it is free; on the post page it
          would mean one extra source call per post at build time.

          `linkName={false}` because this IS the author page. Left on, the box
          renders `<h2><a rel="author" href="/authors/...">Name</a></h2>`
          directly below the `<h1>Name</h1>` above: a link to the page you are
          already on, and the person's name as two consecutive headings. */}
      <AuthorBio author={author} className="mt-6" linkName={false} postCount={posts.length} />

      {author.knowsAbout.length > 0 ? (
        <section aria-labelledby="expertise" className="mt-10">
          <h2 className="text-foreground text-2xl font-semibold tracking-tight" id="expertise">
            Areas of expertise
          </h2>
          {/* Rendered visibly as well as in the graph. `knowsAbout` in JSON-LD
              that corresponds to nothing on the page is markup for invisible
              content, which is the same policy problem as an invisible FAQ. */}
          <ul className="text-muted-foreground mt-4 flex flex-wrap gap-2 text-sm">
            {author.knowsAbout.map((topic) => (
              <li className="bg-muted rounded-full px-3 py-1" key={topic}>
                {topic}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {author.sameAs.length > 0 ? (
        <section aria-labelledby="elsewhere" className="mt-10">
          <h2 className="text-foreground text-2xl font-semibold tracking-tight" id="elsewhere">
            Elsewhere
          </h2>
          {/* Same rule as above: these are the `sameAs` entries, rendered as
              real links so the entity claim is verifiable by a reader too. */}
          <ul className="text-muted-foreground mt-4 space-y-1 text-sm">
            {author.sameAs.map((profile) => (
              <li key={profile}>
                <a
                  className="hover:text-foreground underline underline-offset-4"
                  href={profile}
                  rel="me noopener"
                >
                  {profile}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="posts" className="mt-10">
        <h2 className="text-foreground text-2xl font-semibold tracking-tight" id="posts">
          {`Posts by ${author.name}`}
        </h2>
        {/* `headingLevel={3}` because this list sits under the `<h2 id="posts">`
            above. Card titles at H2 would make each post a sibling of the
            section that contains them and flatten the outline. */}
        <PostList className="mt-6" headingLevel={3} posts={posts} />
      </section>

      {/* One serialization point. The `Person` node is the whole reason this
          route exists; the breadcrumb comes from the same array the visible
          trail above is rendered from. */}
      <JsonLd
        nodes={[buildPersonGraph(author), buildBreadcrumb(trail, `/authors/${author.slug}`)]}
      />
    </div>
  )
}
