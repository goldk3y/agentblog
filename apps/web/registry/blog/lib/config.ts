/**
 * The resolved config singleton, plus the only sanctioned way to build a URL.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS FILE EXISTS
 * ---------------------------------------------------------------------------
 * This is the **only** module in the entire block that imports
 * `@/agentblog.config`. That is a deliberate, enforced constraint rather than a
 * convention:
 *
 * 1. `agentblog.config.ts` lives at the project root, but `@/` maps to the root
 *    in a flat layout and to `src/` in a `src/` layout. One import specifier
 *    cannot be correct in both. With exactly one importer, fixing a `src/`
 *    project is a one line change (or one `tsconfig` path) instead of a grep
 *    across forty files. `agentblog init` performs that fix; `lib/preflight.ts`
 *    reports a named error when nobody did.
 *
 * 2. `resolveConfig` runs once, here, at module scope. A bad value fails the
 *    build with a message naming the key. Everywhere downstream a
 *    `ResolvedAgentBlogConfig` is validated, branded, and fully defaulted, so no
 *    other file needs a `?? 'en_US'` or a null check.
 *
 * ---------------------------------------------------------------------------
 * URL COMPOSITION: USE THESE HELPERS, NEVER STRING CONCATENATION
 * ---------------------------------------------------------------------------
 * `${config.siteUrl}/blog/${slug}` looks harmless and is how a blog ends up
 * serving two canonical URLs for one post. The helpers below are the single
 * place that knows the three rules that matter:
 *
 *   - `siteUrl` is already normalised to carry no trailing slash, so the path
 *     always supplies exactly one leading slash and never two.
 *   - `config.trailingSlash` has to be honoured, or every canonical points at a
 *     URL that immediately 308s to its other form. Search engines treat that as
 *     a self referential redirect chain and AI crawlers frequently do not follow
 *     it at all.
 *   - Paths that end in a file extension (`/feed.xml`, `/<key>.txt`) never take
 *     a trailing slash, matching what Next.js itself does. Getting this wrong
 *     breaks the IndexNow key file and the RSS `alternates` link.
 *
 * If you find yourself writing a template literal that starts with
 * `config.siteUrl`, add a helper here instead.
 *
 * @see https://docs.agentblog.dev/reference/configuration
 */
import 'server-only'

import userConfig from '@/agentblog.config'
import { resolveConfig } from '@/lib/define-config'
import type { ResolvedAgentBlogConfig } from '@/lib/define-config'

/**
 * Parsed, defaulted, and branded once per process. Import this everywhere;
 * import `@/agentblog.config` nowhere.
 */
export const config: ResolvedAgentBlogConfig = resolveConfig(userConfig)

/** A last path segment that looks like a file, e.g. `feed.xml` or `abc123.txt`. */
const LOOKS_LIKE_A_FILE = /\.[a-z0-9]+$/i

/** An already absolute URL, which the helpers pass through untouched. */
const ALREADY_ABSOLUTE = /^[a-z][a-z0-9+.-]*:\/\//i

/**
 * Apply every path rule in one place: one leading slash, no doubled slashes, and
 * the configured trailing slash policy, with the query string and fragment left
 * alone.
 */
function normalizePath(input: string): string {
  const separator = input.search(/[?#]/)
  const pathname = separator === -1 ? input : input.slice(0, separator)
  const suffix = separator === -1 ? '' : input.slice(separator)

  const withLeadingSlash = pathname.startsWith('/') ? pathname : `/${pathname}`
  const collapsed = withLeadingSlash.replace(/\/{2,}/g, '/')
  const bare = collapsed.length > 1 ? collapsed.replace(/\/+$/, '') : '/'

  if (bare === '/') return `/${suffix}`

  const lastSegment = bare.slice(bare.lastIndexOf('/') + 1)
  const wantsTrailingSlash = config.trailingSlash && !LOOKS_LIKE_A_FILE.test(lastSegment)

  return `${wantsTrailingSlash ? `${bare}/` : bare}${suffix}`
}

/* -------------------------------------------------------------------------- */
/*  URL and path helpers                                                      */
/* -------------------------------------------------------------------------- */

/**
 * There are two families of helper here and using the wrong one is a real bug,
 * so the naming is deliberate:
 *
 *   `xPath()`  root-relative, e.g. `/blog/hello-world`. Use for every `href`,
 *              every `<Link>`, and every internal anchor.
 *   `xUrl()`   absolute, e.g. `https://yoursite.dev/blog/hello-world`. Use for
 *              canonicals, the sitemap, the RSS feed, Open Graph URLs, and every
 *              JSON-LD `@id`.
 *
 * Why this split exists. `config.siteUrl` is your production origin. If a `href`
 * used the absolute form, every internal link on `http://localhost:3000` would
 * navigate to production, which is confusing in development and actively
 * dangerous in a preview deployment where a reviewer clicking through the blog
 * silently leaves the branch they were reviewing.
 *
 * Canonicals and structured data must be absolute, so both families are needed
 * and neither is a superset of the other.
 */

/**
 * Absolute URL for a path on this site.
 *
 * An input that is already absolute (a CDN hosted hero image, for example) is
 * returned unchanged, so callers do not have to branch before every call.
 */
export function absoluteUrl(path: string): string {
  if (ALREADY_ABSOLUTE.test(path)) return path
  return `${config.siteUrl}${normalizePath(path)}`
}

/**
 * Canonical absolute URL of the site root, in one form, for every surface.
 *
 * There are two spellings of the same place, `https://example.com` and
 * `https://example.com/`, and they are equivalent per RFC 3986 because an empty
 * path means `/`. Equivalent is not the same as interchangeable: the sitemap,
 * `Organization.url`, `WebSite.url`, and the "Home" breadcrumb are compared as
 * strings by the systems that read them, so two spellings across four surfaces
 * reads as two entities that happen to look alike.
 *
 * The trailing slash form wins because it is what `absoluteUrl('/')` already
 * produces and what the site-level `@id` values in `lib/schema.ts` are built
 * from. The root is exempt from `config.trailingSlash`: that setting picks
 * between `/blog/` and `/blog`, and there is no slashless spelling of the root
 * that a server can serve.
 *
 * Use this everywhere the site root appears as a URL. Never `config.siteUrl`.
 */
export function homeUrl(): string {
  return absoluteUrl('/')
}

/**
 * `config.locale` as a BCP 47 language tag.
 *
 * The config value is the Open Graph spelling, `en_US`, because that is what
 * `og:locale` requires. BCP 47, which schema.org `inLanguage`, the RSS
 * `<language>` element, and `Intl` all require, writes the same value `en-US`.
 * One config field serves both, which beats asking the user to keep two fields
 * in sync and to notice when they drift.
 *
 * The global flag is load bearing. `replace('_', '-')` rewrites only the first
 * underscore, so an extended tag such as `zh_Hans_CN` comes back as
 * `zh-Hans_CN`, which is not a valid tag and which `Intl.DateTimeFormat` throws
 * on. Every conversion in the block goes through this function for that reason.
 */
export function bcp47Locale(locale: string = config.locale): string {
  return locale.replaceAll('_', '-')
}

/**
 * Root-relative path for any internal route that has no dedicated helper.
 *
 * Use this rather than a bare string literal for anything you link to inside the
 * site, for example `sitePath('/editorial-policy')`. It applies the same rules
 * as every other helper here: one leading slash, no doubled slashes, and the
 * configured trailing-slash policy, with a last segment that looks like a file
 * (`/feed.xml`, `/robots.txt`) exempted from the trailing slash.
 *
 * The named helpers above exist because those four routes are ours and their
 * shape is fixed. This one exists so that a project running `trailingSlash: true`
 * does not have to hand-audit every remaining literal in the block.
 */
export function sitePath(path: string): string {
  return normalizePath(path)
}

/** Root-relative path of the blog index. */
export function blogPath(): string {
  return normalizePath('/blog')
}

/** Root-relative path of a post. Use this for `href`. */
export function postPath(slug: string): string {
  return normalizePath(`/blog/${encodeURIComponent(slug)}`)
}

/** Root-relative path of a category hub. Use this for `href`. */
export function categoryPath(slug: string): string {
  return normalizePath(`/blog/category/${encodeURIComponent(slug)}`)
}

/**
 * Root-relative path of a tag listing. Use this for `href`.
 *
 * The slug is percent encoded, exactly as `categoryPath` and `authorPath` encode
 * theirs. That became load bearing when `tagSlug` stopped discarding non-Latin
 * characters: a tag of `日本語` now produces a real slug, and an unencoded one
 * would put raw UTF-8 bytes into the sitemap and into every canonical, where the
 * sitemap protocol requires them escaped.
 *
 * A tag that slugs to nothing has no page. Returning `/blog/tag/` would collapse
 * to `/blog/tag`, which is a route that does not exist, so this returns the blog
 * index instead: a link that goes somewhere real beats a link to a 404.
 */
export function tagPath(tag: string): string {
  const slug = tagSlug(tag)
  if (slug === '') return blogPath()
  return normalizePath(`/blog/tag/${encodeURIComponent(slug)}`)
}

/**
 * URL form of a free-text tag.
 *
 * Tags are authored as human text ("AI crawlers"), which cannot go into a URL
 * as written. Percent encoding it would work and would produce
 * `/blog/tag/AI%20crawlers`, a URL that is technically valid, reads badly
 * everywhere it is displayed, and is trivially duplicated by a different
 * encoding of the same tag. Slugifying gives one canonical form per tag.
 *
 * `lib/posts.ts` matches on this same function, so a tag page and the posts it
 * lists cannot disagree about what counts as the same tag.
 *
 * ---------------------------------------------------------------------------
 * THE CHARACTER CLASS IS UNICODE AWARE, AND THAT IS NOT COSMETIC
 * ---------------------------------------------------------------------------
 * `[^a-z0-9]+` looks like the obviously correct filter and quietly deletes every
 * non-Latin script. `日本語`, `Ελλάδα`, and `Москва` all slugged to the empty
 * string, which meant `getAllTags` dropped them, they got no route and no
 * sitemap entry, and they were still emitted in `keywords` and
 * `BlogPosting.keywords`. A blog written in any of those languages had zero
 * working tag pages and no error anywhere to say so.
 *
 * `\p{L}\p{N}` is the same class `slugifyOnce` in `lib/toc.ts` uses, for the
 * same reason. The one deliberate difference: `slugifyOnce` also keeps `_`
 * because it has to reproduce `github-slugger` byte for byte, while a tag slug
 * is a URL segment and `-` is the separator readers and search engines expect
 * there.
 *
 * Returns `''` for a tag with no letters or digits at all ("!!!", an emoji).
 * That tag has no addressable URL and the callers treat `''` as "not
 * addressable": `getAllTags` skips it, `getPostsByTag` returns `[]`, and
 * `tagPath` refuses to compose a link (see below). It is dropped deliberately
 * rather than crashing or producing `/blog/tag/`.
 */
export function tagSlug(tag: string): string {
  return (
    tag
      .normalize('NFKD')
      // Strip combining marks so "Café" and "Cafe" produce the same slug. This
      // is the Combining Diacritical Marks block and not `\p{Mn}`: `\p{Mn}`
      // would also delete the marks that carry meaning in Devanagari, Hebrew,
      // and Arabic, which is the same script-erasing bug in a new place.
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '')
  )
}

/** Root-relative path of an author page. Use this for `href`. */
export function authorPath(slug: string): string {
  return normalizePath(`/authors/${encodeURIComponent(slug)}`)
}

/** Canonical URL of the blog index. */
export function blogUrl(): string {
  return absoluteUrl(blogPath())
}

/** Canonical URL of a post. Use this for canonicals, JSON-LD, and the sitemap. */
export function postUrl(slug: string): string {
  return absoluteUrl(postPath(slug))
}

/** Canonical URL of a category hub. Categories are indexable. */
export function categoryUrl(slug: string): string {
  return absoluteUrl(categoryPath(slug))
}

/**
 * Absolute URL of a tag listing. Tags are noindexed below
 * `config.noindexTagsBelow`, so this URL is not always a canonical one.
 */
export function tagUrl(tag: string): string {
  return absoluteUrl(tagPath(tag))
}

/** Canonical URL of an author page. Doubles as the `Person` node `@id` base. */
export function authorUrl(slug: string): string {
  return absoluteUrl(authorPath(slug))
}

/* -------------------------------------------------------------------------- */
/*  XML escaping                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Escape a value for XML character data or an XML attribute.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS LIVES NEXT TO THE URL HELPERS
 * ---------------------------------------------------------------------------
 * Because every value it protects is a URL those helpers produced. `app/sitemap.ts`
 * hands Next.js a list of `absoluteUrl`, `postUrl`, `categoryUrl`, `tagUrl`, and
 * `authorUrl` results plus each post's `heroImage`, and Next.js writes them into
 * XML with no escaping of its own. Verified in
 * `next/dist/build/webpack/loaders/metadata/resolve-route-data.js@16.3.0`:
 *
 *     content += `<loc>${item.url}</loc>\n`
 *     content += `<image:image>\n<image:loc>${image}</image:loc>\n</image:image>\n`
 *
 * Straight interpolation. So the escape has to happen before the value reaches
 * the framework, and this module is the one every sitemap value already passes
 * through.
 *
 * ---------------------------------------------------------------------------
 * THE ACCIDENT MATTERS MORE THAN THE ATTACK
 * ---------------------------------------------------------------------------
 * `&` is legal in a URI and ordinary in a CDN URL:
 * `https://cdn.example/a.png?w=1200&h=630&fit=crop`. Unescaped, that single hero
 * image makes the whole document not well-formed, every XML parser rejects it,
 * and the site silently has no sitemap at all. `ImageRef` in `lib/schemas.ts`
 * refuses the characters that have no business in a URI (`<`, `>`, `"`, spaces,
 * controls), which closes the deliberate injection; `&` cannot be refused there
 * without breaking real URLs, so it is escaped here.
 *
 * All five predefined entities are escaped rather than the three that are
 * strictly required in character data, because the same function is used for
 * attribute values, and a function whose safety depends on where you call it is
 * a function that will eventually be called in the other place. `&` goes first,
 * or the ampersands introduced by the later replacements get escaped again.
 *
 * `app/feed.xml/route.ts` carries its own copy of this, written before this one
 * existed. Point it here when that file is next touched.
 */
export function escapeXml(value: string): string {
  return stripInvalidXmlChars(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

/**
 * Remove code points that XML 1.0 forbids anywhere, CDATA included.
 *
 * Escaping is not enough on its own. A control character such as `\v` or a stray
 * `\x00` in a title, an author name, or a description makes the whole document
 * unparseable, and there is no escape sequence that rescues it: XML 1.0 simply
 * has no representation for those code points. A lone surrogate is the same
 * problem arriving from a truncated string.
 *
 * The failure is total and it is silent from our side. One bad character in one
 * post and every feed reader gets a hard parse error on the whole feed, or the
 * sitemap stops parsing entirely. Verified against a real parser: element
 * breakout and CDATA terminator payloads are handled by escaping, and these are
 * the ones that get through it.
 *
 * Permitted, per the XML 1.0 Char production: tab, newline, carriage return,
 * and everything from U+0020 up, minus the surrogate range and the two
 * noncharacters at the end of the BMP.
 */
export function stripInvalidXmlChars(value: string): string {
  return (
    value
      // eslint-disable-next-line no-control-regex -- the point is to match control characters
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '')
      // A surrogate that is not part of a pair. A valid pair is left alone.
      .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, '')
      .replace(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '')
  )
}
