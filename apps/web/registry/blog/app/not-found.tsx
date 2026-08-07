/**
 * The 404 page.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS PAGE EXPORTS `metadata` AT ALL
 * ---------------------------------------------------------------------------
 * Because a page that exports nothing inherits everything.
 *
 * With no `metadata` here, Next.js resolved this route against the root layout
 * and shipped the homepage's entire head on every unmatched URL on the site:
 * `<link rel="canonical" href="https://yoursite.dev">`, `og:url` pointing at
 * the homepage, and `og:title` claiming to be it. A 404 that declares itself
 * canonical to the homepage is a consolidation signal, and it is one the HTTP
 * status does not cancel, because a canonical is a statement about identity
 * rather than about availability.
 *
 * The status code is still the primary signal, and it is still the reason this
 * page must never become a "soft 404": a page that returns 200 and says "not
 * found" in the body. Google treats those as thin content and they are one of
 * the more common causes of a crawl budget quietly draining away.
 *
 * The `metadata` export below is written the way it is for one reason each:
 *
 *   - `robots` carries a `googleBot` block that also says `index: false`.
 *     Metadata merges SHALLOWLY, so writing `robots: { index: false }` on its
 *     own would replace the root layout's whole object, and writing it while
 *     spreading `robotsDefaults` unchanged would leave `googleBot` saying
 *     `index: true`. Googlebot obeys the more specific directive, so that
 *     version reads as noindex to everyone except the crawler it matters most
 *     to. `googleBotDefaults` is spread so `max-snippet: -1` and the preview
 *     limits survive. See https://docs.agentblog.dev/reference/files. This is the same shape
 *     `buildListMetadata` uses for a thin tag page; keep them in step.
 *   - `follow: true` stays on. The recovery links below are the point of the
 *     page, and telling a crawler that reached a dead link to ignore the way
 *     out wastes the one useful thing a 404 can do.
 *   - `alternates: null` and `openGraph: null` are explicit. `undefined` is not
 *     the same thing: an absent key inherits, and only `null` clears. Without
 *     them the canonical and the homepage `og:url` come straight back.
 *   - `title` and `description` are set, and they are load bearing for the Open
 *     Graph tags rather than only for the tab. Next.js re-derives `og:title` and
 *     `og:description` from `title` and `description` in `postProcessMetadata`,
 *     after a file-based `app/opengraph-image.tsx` has put an `openGraph` object
 *     back on a page that cleared it. So `openGraph: null` alone still shipped a
 *     404 announcing the homepage's headline to every social scraper. Naming the
 *     page here is what stops that.
 *
 * One thing the export does not control: Next.js emits its own
 * `<meta name="robots" content="noindex">` for the not-found route, so the built
 * page carries two robots tags. Crawlers take the union of them and the two
 * agree, so this is untidy rather than wrong. Do not try to remove the first
 * one; it is generated below application code.
 *
 * ---------------------------------------------------------------------------
 * WHY THE PAGE BODY IS A `<div>` AND NOT A `<main>`
 * ---------------------------------------------------------------------------
 * This route renders inside the host application's shell like every other route
 * in the block, so a `<main>` here nests inside the host's `<main>`: invalid
 * HTML, and two `main` landmarks on the page. The block never renders `<main>`
 * anywhere. The contract, and what your root layout owes in return, is written
 * at the top of `app/blog/layout.tsx`.
 *
 * ---------------------------------------------------------------------------
 * WHY IT LISTS RECENT POSTS AND WHY THAT IS WRAPPED IN A TRY
 * ---------------------------------------------------------------------------
 * A 404 that offers nothing is a dead end for a reader who followed a stale
 * link. A handful of real, current posts is the cheapest useful recovery path,
 * and it needs no search box to build.
 *
 * The read is wrapped because this file also renders for every unmatched URL on
 * the site. If the content source is unreachable, an unhandled throw here turns
 * a 404 into a 500, which is a strictly worse answer to the same request.
 *
 * @see https://docs.agentblog.dev/reference/files
 */
import type { Metadata } from 'next'
import Link from 'next/link'

import { formatPostDate } from '@/components/blog/byline'
import { blogPath, postPath, sitePath } from '@/lib/config'
import { googleBotDefaults } from '@/lib/metadata'
import { getAllPosts } from '@/lib/posts'
import type { PublishedPost } from '@/lib/types'

export const metadata: Metadata = {
  title: 'Page not found',
  description: 'The page you asked for does not exist. Here is the way back.',
  robots: { index: false, follow: true, googleBot: { ...googleBotDefaults, index: false } },
  // `null`, not omitted. See the header: an absent key inherits the root
  // layout's canonical and the homepage `og:url` onto every 404.
  alternates: null,
  openGraph: null,
}

/** Enough to be a real recovery path, few enough to stay scannable. */
const SUGGESTION_COUNT = 5

async function recentPosts(): Promise<PublishedPost[]> {
  try {
    const posts = await getAllPosts()
    return [...posts]
      .sort((a, b) => Date.parse(b.datePublished) - Date.parse(a.datePublished))
      .slice(0, SUGGESTION_COUNT)
  } catch {
    // A broken content source must not upgrade a 404 into a 500.
    return []
  }
}

export default async function NotFound() {
  const posts = await recentPosts()

  return (
    // A `<div>`, and it must stay one. See "WHY THE PAGE BODY IS A `<div>`" above.
    <div className="mx-auto w-full max-w-2xl px-6 py-24">
      <p className="text-muted-foreground text-sm font-medium tracking-wide uppercase">Error 404</p>

      <h1 className="text-foreground mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
        We could not find that page
      </h1>

      <p className="text-muted-foreground mt-4 text-base leading-relaxed">
        The link may be out of date, or the page may have moved. Everything below still works.
      </p>

      {/*
       * Internal hrefs come from the `@/lib/config` path helpers, which are what
       * apply `config.trailingSlash`. A hardcoded `/blog` on a site configured
       * with `trailingSlash: true` links to a URL that 308s to `/blog/`, and a
       * 404 page whose recovery links all redirect is a poor recovery path.
       *
       * `/`, `/feed.xml`, and `/sitemap.xml` are literals on purpose: the root is
       * exempt from the trailing-slash policy, and the helpers never append a
       * slash to a last segment that looks like a file, so all three are already
       * in final form. `/editorial-policy` has no helper of its own, so it is the
       * one href here that a `trailingSlash: true` site has to fix by hand.
       */}
      <nav aria-label="Primary recovery links" className="mt-8 flex flex-wrap gap-3">
        <Link
          href={blogPath()}
          className="bg-primary text-primary-foreground focus-visible:ring-ring inline-flex items-center rounded-md px-4 py-2 text-sm font-medium focus-visible:ring-2 focus-visible:outline-none"
        >
          Read the blog
        </Link>
        <Link
          href="/"
          className="border-border bg-background text-foreground hover:bg-accent focus-visible:ring-ring inline-flex items-center rounded-md border px-4 py-2 text-sm font-medium focus-visible:ring-2 focus-visible:outline-none"
        >
          Go to the homepage
        </Link>
      </nav>

      {posts.length > 0 ? (
        <section className="border-border mt-12 border-t pt-8">
          <h2 className="text-foreground text-lg font-semibold">Recent posts</h2>
          <ul className="mt-4 flex flex-col gap-4">
            {posts.map((post) => (
              <li key={post.slug}>
                <Link
                  href={postPath(post.slug)}
                  className="text-foreground hover:text-primary text-base font-medium underline-offset-4 hover:underline"
                >
                  {post.title}
                </Link>
                <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                  {post.description}
                </p>
                {/* The shared formatter, not a local `toISOString().slice()`.
                    `toISOString` converts to UTC first, so a post dated
                    `2026-08-06T22:00:00-05:00` printed that way reads
                    `2026-08-07` while the `dateTime` attribute beside it still
                    says the 6th, and the visible text disagrees with the machine
                    readable one by a day. `formatPostDate` is the one place a
                    post date becomes a string anywhere in the block. */}
                <time
                  dateTime={post.datePublished}
                  className="text-muted-foreground mt-1 block text-xs"
                >
                  {formatPostDate(post.datePublished)}
                </time>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="border-border mt-12 border-t pt-8">
        <h2 className="text-foreground text-lg font-semibold">Other places to look</h2>
        <ul className="text-muted-foreground mt-4 flex flex-col gap-2 text-sm">
          <li>
            <Link href="/feed.xml" className="hover:text-foreground underline underline-offset-4">
              Subscribe to the RSS feed
            </Link>
          </li>
          <li>
            <Link
              href={sitePath('/editorial-policy')}
              className="hover:text-foreground underline underline-offset-4"
            >
              Read our editorial policy
            </Link>
          </li>
          <li>
            <Link
              href="/sitemap.xml"
              className="hover:text-foreground underline underline-offset-4"
            >
              Browse the full sitemap
            </Link>
          </li>
        </ul>
      </section>
    </div>
  )
}
