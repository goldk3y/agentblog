/**
 * AgentBlog domain schemas.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS FILE LOOKS THE WAY IT DOES
 * ---------------------------------------------------------------------------
 * Every domain type in AgentBlog is *inferred* from the Zod schemas below with
 * `z.infer`. There is no hand-written `interface Post` anywhere in the codebase,
 * because a validator and a parallel interface always drift, and here they would
 * drift between what we validate and what we type.
 *
 * The five branded primitives at the top exist because five invariants this
 * product depends on are unrepresentable as `string`:
 *
 *   - a slug that is lowercase-hyphenated and carries no date
 *   - a URL that is absolute rather than a bare social handle
 *   - a URL that is specifically https and is a bare origin, for `siteUrl`
 *   - an image reference that is a URL or a root-relative path, and nothing else
 *   - a timestamp that carries a UTC offset
 *
 * Each of those, when violated, produces output that validates cleanly and is
 * silently wrong: Google reinterprets an offset-less date in Googlebot's own
 * timezone, and a `sameAs` entry of "@janedoe" disambiguates nothing. Branding
 * makes the invalid value unconstructible instead of merely discouraged.
 *
 * `ImageRef` is the one that is also a security boundary rather than a quality
 * one. `heroImage` was `z.string()`, and it lands unescaped inside `<image:loc>`
 * in the sitemap that Next.js serializes. See the comment on `ImageRef`.
 *
 * ---------------------------------------------------------------------------
 * EDITING THIS FILE
 * ---------------------------------------------------------------------------
 * Adding a frontmatter field is a two-line change: add it to `PostSchema` here,
 * then read it wherever you need it. The type flows everywhere automatically.
 * If you add a field that maps to schema.org, also add a row to the mapping
 * table in `lib/schema.ts` so the JSON-LD builders stay reviewable.
 *
 * @see https://docs.agentblog.dev/reference/content-sources
 */
import { z } from 'zod'

/* -------------------------------------------------------------------------- */
/*  Branded primitives                                                        */
/* -------------------------------------------------------------------------- */

/**
 * A URL path segment: lowercase, hyphen separated, no slashes, no leading date.
 *
 * Dates in slugs are banned deliberately. A slug like `2024-03-post-title`
 * advertises the post's age in every search result and makes an evergreen
 * refresh look stale, which is the opposite of what the freshness signal in the
 * GEO playbook rewards.
 */
export const Slug = z
  .string()
  // A slug reaches `revalidatePath()`, a cache key, and a probe URL. None of
  // those has a length limit of its own, and no real post needs more than this.
  .max(120, 'must be at most 120 characters')
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'must be lowercase and hyphen separated, with no slashes')
  .refine((s) => !/^\d{4}-\d{2}(?:-\d{2})?-/.test(s), {
    error: 'must not begin with a date. Dates in slugs make evergreen posts look stale.',
  })
  .brand<'Slug'>()

/**
 * The printable characters RFC 3986 excludes from a URI. `hasUriExcludedChar`
 * below adds space, the C0 controls, and DEL.
 *
 * `z.url()` does not reject these. It parses with the WHATWG URL parser, which
 * is a browser-compatibility parser rather than a validator: it happily accepts
 * `https://a.dev/<x>` and hands the string back with the `<` intact. Everything
 * downstream then embeds that string in markup. Next.js 16.3.0's own sitemap
 * serializer does no escaping at all (`resolve-route-data.js` interpolates
 * `<loc>${item.url}</loc>` directly), so a `<` here is a new XML element in
 * someone else's sitemap.
 *
 * Note what is deliberately NOT on this list: `&`. It is legal in a URI and a
 * perfectly ordinary CDN URL carries several of them, so it has to be escaped at
 * serialization rather than banned at the boundary. `escapeXml` in
 * `lib/config.ts` is that escape.
 */
const URI_EXCLUDED_PRINTABLE = /["<>\\^`{|}]/

/**
 * True when `value` contains a character RFC 3986 excludes from a URI.
 *
 * Space, the C0 controls, and DEL are tested by code point rather than as a
 * regex range. A control character inside a character class is a
 * `no-control-regex` lint error, and the rule is right in general: a literal
 * NUL in a regex is nearly always a typo rather than an intention.
 */
function hasUriExcludedChar(value: string): boolean {
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0
    if (code <= 0x20 || code === 0x7f) return true
  }
  return URI_EXCLUDED_PRINTABLE.test(value)
}

const URI_EXCLUDED_ERROR =
  'must not contain a space, a control character, or any of " < > \\ ^ ` { | }. RFC 3986 ' +
  'excludes them from a URI and they break XML and HTML attribute contexts. Percent-encode them.'

/** An absolute http(s) URL. A bare handle such as `@janedoe` is rejected. */
export const AbsoluteUrl = z
  .url({ protocol: /^https?$/, error: 'must be an absolute http or https URL' })
  .refine((url) => !hasUriExcludedChar(url), { error: URI_EXCLUDED_ERROR })
  .brand<'AbsoluteUrl'>()

/**
 * An absolute https URL with no query and no fragment. Used for `siteUrl`, which
 * anchors every canonical.
 *
 * Query and fragment are refused because `absoluteUrl` composes URLs as
 * `${siteUrl}${path}`. A `siteUrl` of `https://a.dev/?a=1` produces
 * `https://a.dev/?a=1/blog/post` for every post on the site, which is a
 * correctness failure before it is anything else. It is also the second half of
 * the sitemap injection above, since every entry in the sitemap is built from
 * this value.
 */
export const HttpsUrl = z
  .url({ protocol: /^https$/, error: 'must be an absolute https URL' })
  .refine((url) => !hasUriExcludedChar(url), { error: URI_EXCLUDED_ERROR })
  .refine((url) => !/[?#]/.test(url), {
    error:
      'must be a bare origin with no query string and no fragment. Every canonical on the ' +
      'site is composed as siteUrl + path, so a query here lands in the middle of every URL.',
  })
  .brand<'HttpsUrl'>()

/**
 * A reference to an image: an absolute http(s) URL, or a root-relative path
 * beginning with a single `/`.
 *
 * `z.string()` was the previous type and it was the vector for a real attack.
 * `Post.heroImage` reaches `<image:loc>` in the sitemap, which Next.js does not
 * escape, so a frontmatter value of
 * `x.png</image:loc></image:image></url><url><loc>https://spam.tld/</loc>`
 * added an attacker-controlled `<url>` element to the victim's own sitemap. It
 * also reaches `og:image` and `BlogPosting.image`.
 *
 * `//evil.tld/x.png` is rejected along with everything else that is not
 * http(s): a protocol-relative URL reads as a path and loads from another
 * origin. `absoluteUrl` returns an already-absolute input untouched, so
 * whatever is accepted here is what ships.
 */
export const ImageRef = z
  .string()
  .min(1)
  .refine((value) => /^(?:https?:\/\/|\/(?!\/))/.test(value), {
    error:
      'must be an absolute http(s) URL or a root-relative path beginning with a single "/". ' +
      'A protocol-relative "//host/path" and a bare "img/hero.png" are both rejected.',
  })
  .refine((value) => !hasUriExcludedChar(value), { error: URI_EXCLUDED_ERROR })
  .brand<'ImageRef'>()

/**
 * ISO 8601 with an explicit UTC offset, for example `2026-08-06T09:30:00-04:00`.
 *
 * The offset is not optional. Google falls back to Googlebot's own timezone when
 * a date carries no offset, which silently shifts every published date by hours
 * and can move a post across a day boundary.
 */
export const IsoDateTime = z.iso
  .datetime({
    offset: true,
    error: 'must be ISO 8601 with a UTC offset, e.g. 2026-08-06T09:30:00Z',
  })
  .brand<'IsoDateTime'>()

export type Slug = z.infer<typeof Slug>
export type AbsoluteUrl = z.infer<typeof AbsoluteUrl>
export type HttpsUrl = z.infer<typeof HttpsUrl>
export type ImageRef = z.infer<typeof ImageRef>
export type IsoDateTime = z.infer<typeof IsoDateTime>

/* -------------------------------------------------------------------------- */
/*  Domain schemas                                                            */
/* -------------------------------------------------------------------------- */

/**
 * A post author.
 *
 * `name` is the person's name and nothing else. Google's Article guidance is
 * explicit that `author.name` must exclude job titles, honorifics, and the
 * publisher name, and a CMS field labelled "author" actively invites all three.
 * `jobTitle` is a separate property precisely so the correct output is the only
 * constructible one.
 */
export const AuthorSchema = z.object({
  slug: Slug,
  name: z.string().min(1, 'author name is required'),
  bio: z.string().min(1, 'author bio is required; it is the E-E-A-T surface'),
  avatar: AbsoluteUrl.optional(),
  jobTitle: z.string().optional(),
  worksFor: AbsoluteUrl.optional(),
  /** Topics this author is credible on. Maps to `Person.knowsAbout`. */
  knowsAbout: z.array(z.string()).default([]),
  alumniOf: z.string().optional(),
  /** Absolute profile URLs. Maps to `Person.sameAs`, the entity link. */
  sameAs: z.array(AbsoluteUrl).default([]),
  email: z.email().optional(),
})

/**
 * A category. Categories are indexable hub pages, so the description is
 * required: a thin hub with nothing but a post list is a crawl liability rather
 * than an asset.
 */
export const CategorySchema = z.object({
  slug: Slug,
  name: z.string().min(1),
  description: z.string().min(1, 'category description is required; the hub page is indexable'),
  latestPostDate: IsoDateTime.optional(),
})

/** A cited source. `kind` is ours for auditing and is never emitted as JSON-LD. */
export const CitationSchema = z.object({
  name: z.string().min(1),
  url: AbsoluteUrl,
  author: z.string().optional(),
  datePublished: IsoDateTime.optional(),
  kind: z.enum(['peer-reviewed', 'official-docs', 'industry', 'news', 'other']).default('other'),
})

/**
 * One question and answer pair.
 *
 * These render visibly on the page before they are ever emitted as `FAQPage`
 * JSON-LD. Google's structured data policy forbids marking up content that is
 * not visible to readers, and FAQ markup is the most common way blogs trip it.
 */
export const FaqEntrySchema = z.object({
  question: z.string().min(1),
  answer: z.string().min(1),
})

/** Everything about a post except its body. Split out so frontmatter can reuse it. */
const PostFieldsSchema = z.object({
  slug: Slug,

  /**
   * Title. 60 characters is the target, because that is roughly where Google
   * truncates a title in the SERP. 70 is the hard stop.
   */
  title: z.string().min(1).max(70, 'title must be at most 70 characters; aim for 60'),

  /** Meta description. Must match `BlogPosting.description` exactly. */
  description: z
    .string()
    .min(50, 'description must be at least 50 characters')
    .max(160, 'description must be at most 160 characters'),

  /**
   * The 40 to 60 word direct answer that sits under the H1.
   *
   * Word count is checked by `agentblog audit` rather than here, because a post
   * that is 8 words over should be reported, not refused at build time.
   */
  answerCapsule: z.string().optional(),

  datePublished: IsoDateTime,
  dateModified: IsoDateTime,

  /** Fully hydrated, never a reference. See the hydration rule in `types.ts`. */
  author: AuthorSchema,
  category: CategorySchema,

  tags: z.array(z.string()).default([]),

  /**
   * `ImageRef`, not `z.string()`. This value is written into `<image:loc>` in a
   * sitemap that Next.js does not escape, into `og:image`, and into
   * `BlogPosting.image`. See `ImageRef` above for the injection it closes.
   */
  heroImage: ImageRef.optional(),
  heroAlt: z.string().optional(),

  /** Editorial related posts, in the order they should appear. */
  relatedPosts: z.array(Slug).default([]),
  citations: z.array(CitationSchema).default([]),
  faq: z.array(FaqEntrySchema).default([]),

  draft: z.boolean().default(false),

  /**
   * Multi-locale is an explicit v1 non-goal. These two fields exist so that
   * adding it later is additive rather than a breaking change to
   * `ContentSource`, which is the one interface that has to stay stable.
   *
   * v1 emits `inLanguage` from `locale ?? config.locale` and ignores the rest.
   */
  locale: z.string().optional(),
  translations: z.record(z.string(), Slug).optional(),
})

/* Two invariants that need more than one field, so they cannot live on a field. */

/** Dates are compared as instants, not as strings: offsets are not lexicographic. */
const dateOrderIsSane = (p: { datePublished: string; dateModified: string }) =>
  Date.parse(p.dateModified) >= Date.parse(p.datePublished)

const heroImageHasAlt = (p: { heroImage?: string | undefined; heroAlt?: string | undefined }) =>
  !p.heroImage || Boolean(p.heroAlt)

const DATE_ORDER_ERROR = {
  error: 'dateModified precedes datePublished',
  path: ['dateModified'],
}
const HERO_ALT_ERROR = {
  error: 'heroImage requires heroAlt. An unlabelled hero image is an accessibility failure.',
  path: ['heroAlt'],
}

/** A complete post, body included. This is what `ContentSource` returns. */
export const PostSchema = PostFieldsSchema.extend({ body: z.string() })
  .refine(dateOrderIsSane, DATE_ORDER_ERROR)
  .refine(heroImageHasAlt, HERO_ALT_ERROR)

/**
 * Frontmatter as authored, without the body.
 *
 * Note that `z.input` and `z.output` genuinely differ here: `.default([])` means
 * the parsed post has `tags: string[]` while the authored frontmatter may omit
 * the key entirely. That difference is the whole reason these types are inferred
 * rather than hand-written, since a hand-written interface can only describe one
 * of the two shapes.
 */
export const PostFrontmatterSchema = PostFieldsSchema.refine(
  dateOrderIsSane,
  DATE_ORDER_ERROR,
).refine(heroImageHasAlt, HERO_ALT_ERROR)
