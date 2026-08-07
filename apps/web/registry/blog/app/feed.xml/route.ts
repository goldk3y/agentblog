/**
 * `/feed.xml`: RSS 2.0.
 *
 * ---------------------------------------------------------------------------
 * THIS IS A CACHED ROUTE HANDLER
 * ---------------------------------------------------------------------------
 * Same mechanism as `app/sitemap.ts`: a route handler with no request-time API
 * is cached, so a post published without a rebuild does not appear in the feed
 * until something invalidates it. `app/api/publish/route.ts` calls
 * `revalidatePath('/feed.xml')` for exactly this reason. The `revalidate` export
 * below is the backstop for installs whose webhook is never wired up.
 *
 * ---------------------------------------------------------------------------
 * ESCAPING IS A CORRECTNESS REQUIREMENT HERE, NOT A STYLE ONE
 * ---------------------------------------------------------------------------
 * Every interpolated value goes through `escapeXml` or `cdata`. A single `&` in
 * a post title produces a feed that every strict parser rejects outright, and
 * the failure is invisible from the site itself: the page renders, the sitemap
 * is fine, and the feed is simply broken for everyone subscribed to it. If you
 * add a field below, escape it. There are no exceptions in this file.
 *
 * ---------------------------------------------------------------------------
 * WHY THERE IS NO `content:encoded`
 * ---------------------------------------------------------------------------
 * `post.body` is MDX source, not HTML. Emitting it raw would ship JSX component
 * tags to feed readers, and compiling it here would mean a second MDX pipeline
 * outside `lib/render-mdx.tsx`, which is the one place in the block that is
 * allowed to compile MDX. A duplicate pipeline drifts, and a drifting HTML
 * serializer that feeds untrusted-ish markup into other people's readers is not
 * a small risk to take for a summary field.
 *
 * So the feed carries `description` only, and it is a real description rather
 * than a truncated first paragraph. If you want full content, render it through
 * `renderMdx` to a string and add `content:encoded` here, escaped as CDATA.
 *
 * @see https://docs.agentblog.dev/reference/files
 */
import {
  absoluteUrl,
  bcp47Locale,
  config,
  escapeXml,
  postUrl,
  stripInvalidXmlChars,
} from '@/lib/config'
import { getAllPosts } from '@/lib/posts'
import type { PublishedPost } from '@/lib/types'

/**
 * ISR backstop. Hardcoded rather than read from `config.revalidate` because
 * route segment config must be statically analysable.
 */
export const revalidate = 3600

/**
 * Feed readers poll; they do not paginate. Fifty recent posts is the usual
 * ceiling and keeps the document small enough to fetch cheaply.
 */
const MAX_ITEMS = 50

const FEED_PATH = '/feed.xml'

/**
 * Wrap a value in CDATA.
 *
 * The `]]>` split is the whole point: a description that happens to contain the
 * CDATA terminator would otherwise close the section early and produce a
 * document that is malformed in a way that looks like a content bug.
 */
function cdata(value: string): string {
  // `stripInvalidXmlChars` runs here too. CDATA suspends markup parsing, not the
  // rule about which code points may appear in a document at all, so a control
  // character inside a CDATA section is just as fatal as one outside it.
  const safe = stripInvalidXmlChars(value)
  return `<![CDATA[${safe.replace(/]]>/g, ']]]]><![CDATA[>')}]]>`
}

/**
 * RFC 822 date, which RSS 2.0 requires for `pubDate` and `lastBuildDate`.
 *
 * `toUTCString()` produces exactly the shape the spec wants
 * (`Wed, 06 Aug 2026 09:30:00 GMT`), which is why there is no hand-rolled month
 * table here. Input dates always carry an offset (the `IsoDateTime` brand
 * guarantees it), so the conversion to UTC is unambiguous.
 */
function toRfc822(isoDate: string): string {
  return new Date(isoDate).toUTCString()
}

/** Newest `dateModified` in the set, compared as instants rather than strings. */
function newestModified(posts: readonly PublishedPost[]): string | undefined {
  let newest: string | undefined
  for (const post of posts) {
    if (newest === undefined || Date.parse(post.dateModified) > Date.parse(newest)) {
      newest = post.dateModified
    }
  }
  return newest
}

function renderItem(post: PublishedPost): string {
  const url = postUrl(post.slug)
  return [
    '    <item>',
    `      <title>${escapeXml(post.title)}</title>`,
    `      <link>${escapeXml(url)}</link>`,
    // `isPermaLink="true"` says the guid is the canonical URL, which it is.
    // Readers use it for deduplication, so it must never change for a post.
    `      <guid isPermaLink="true">${escapeXml(url)}</guid>`,
    `      <pubDate>${escapeXml(toRfc822(post.datePublished))}</pubDate>`,
    // `dc:creator` rather than `<author>`: RSS 2.0's `author` element is defined
    // as an email address, and most authors have a name but no public address.
    `      <dc:creator>${cdata(post.author.name)}</dc:creator>`,
    `      <category>${escapeXml(post.category.name)}</category>`,
    `      <description>${cdata(post.description)}</description>`,
    '    </item>',
  ].join('\n')
}

export async function GET(): Promise<Response> {
  const all = await getAllPosts()

  // Newest first. The source is not contractually required to sort, and a feed
  // in arbitrary order is a feed that shows subscribers the wrong post first.
  const posts = [...all]
    .sort((a, b) => Date.parse(b.datePublished) - Date.parse(a.datePublished))
    .slice(0, MAX_ITEMS)

  const selfUrl = absoluteUrl(FEED_PATH)
  const lastBuildDate = newestModified(posts)

  const xml = [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">',
    '  <channel>',
    `    <title>${escapeXml(config.brand.name)}</title>`,
    `    <link>${escapeXml(absoluteUrl('/blog'))}</link>`,
    `    <description>${cdata(`Latest posts from ${config.brand.name}.`)}</description>`,
    // BCP-47 for XML, while `config.locale` is stored in the underscore form
    // Open Graph wants. `bcp47Locale` is the one place that conversion happens:
    // a local `.replace('_', '-')` rewrites only the FIRST underscore, so an
    // extended tag such as `zh_Hans_CN` comes out as `zh-Hans_CN`, which is not
    // a valid language tag.
    `    <language>${escapeXml(bcp47Locale())}</language>`,
    // `atom:link rel="self"` is what tells a reader (and a validator) the
    // canonical address of this document. Feeds without it get mirrored under
    // whatever URL happened to serve them.
    `    <atom:link href="${escapeXml(selfUrl)}" rel="self" type="application/rss+xml" />`,
    ...(lastBuildDate
      ? [`    <lastBuildDate>${escapeXml(toRfc822(lastBuildDate))}</lastBuildDate>`]
      : []),
    ...posts.map(renderItem),
    '  </channel>',
    '</rss>',
    '',
  ].join('\n')

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      // Advisory only. The authoritative cache lifetime is the `revalidate`
      // export plus whatever the publish webhook invalidates.
      'Cache-Control': 'public, max-age=0, must-revalidate',
    },
  })
}
