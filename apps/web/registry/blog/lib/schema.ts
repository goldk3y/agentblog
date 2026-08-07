/**
 * JSON-LD `@graph` builders. This is the file AgentBlog exists to ship.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS FILE IS
 * ---------------------------------------------------------------------------
 * Every page in the block emits one `<script type="application/ld+json">`
 * containing a single `@graph`. The builders below produce the nodes; the
 * `<JsonLd>` server component in `components/blog/json-ld.tsx` renders them.
 *
 * Three rules hold the whole thing together, and each one exists because
 * breaking it produces output that passes every validator and still means
 * nothing to a search engine:
 *
 * 1. **Every `@id` comes from the `ids` object below.** Never compose one at a
 *    call site. Cross-references between nodes are `{ '@id': string }` stubs, so
 *    an `@id` that drifts by one character turns a connected graph into a pile
 *    of orphan nodes. That output validates clean. It also tells Google nothing
 *    about who wrote the article or who published it, which is the entire point
 *    of emitting it.
 *
 * 2. **Cross-references are stubs, never inlined duplicates.** Inlining the
 *    author `Person` inside `BlogPosting.author` and also emitting it as a node
 *    creates two entities where there is one person.
 *
 * 3. **`renderJsonLd` is the only serialization point.** The `<` escape that
 *    stops a post title from closing the `<script>` element lives there and
 *    nowhere else, so it can be reviewed and tested once.
 *
 * ---------------------------------------------------------------------------
 * THE FIELD MAPPING TABLE
 * ---------------------------------------------------------------------------
 * This table is the product. Review the builders against it. The relevant row
 * is repeated as a comment on each builder.
 *
 * | Domain field                          | schema.org                               | Notes                                                              |
 * | ------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------ |
 * | `Post.title`                          | `BlogPosting.headline`                   | 110-char limit removed Jan 2025; stay concise anyway                |
 * | `Post.description`                    | `BlogPosting.description`                | Must match the meta description                                     |
 * | `Post.datePublished` / `dateModified` | same names                               | ISO 8601 with offset, enforced by the `IsoDateTime` branded type    |
 * | `Post.author`                         | `BlogPosting.author` -> `{ '@id': ... }` | Never inline, never a bare string                                   |
 * | `Post.category.name`                  | `BlogPosting.articleSection`             | Ignored for ranking, harmless                                       |
 * | `Post.tags`                           | `BlogPosting.keywords`                   | Same                                                                |
 * | `Post.heroImage` + `heroAlt`          | `BlogPosting.image` -> `ImageObject`     | Emitted as its own node and referenced by `@id`                     |
 * | `Post.citations[]`                    | `BlogPosting.citation` -> `CreativeWork[]` | `Citation.kind` is ours for auditing and is never emitted          |
 * | `Post.faq[]`                          | separate `FAQPage` node                  | Emitted only when the FAQs render visibly. See `buildFaq`           |
 * | `Post.relatedPosts`                   | not emitted                              | Internal linking is HTML, not schema                                |
 * | `Post.locale`                         | `BlogPosting.inLanguage`, `WebPage.inLanguage` | Falls back to `config.locale`                                 |
 * | `Post.translations`                   | not emitted in v1                        | Reserved for `alternates.languages` and `WebPage.workTranslation`   |
 * | `Post.body`                           | `BlogPosting.wordCount`                  | Counted by `readingTime`, so the schema and the visible count agree. Omitted when zero |
 * | `Author.name`                         | `Person.name`                            | Name only. No job title, no honorific, no publisher name            |
 * | `Author.jobTitle`                     | `Person.jobTitle`                        | Kept separate precisely so it never reaches `name`                  |
 * | `Author.bio`                          | `Person.description`                     |                                                                     |
 * | `Author.knowsAbout`                   | `Person.knowsAbout`                      | Topical authority                                                   |
 * | `Author.sameAs`                       | `Person.sameAs`                          | Absolute URLs, enforced by `AbsoluteUrl`                            |
 * | `Author.worksFor`                     | `Person.worksFor` -> `{ '@id': ... }`    | Defaults to the site `Organization`                                 |
 * | `Author.avatar`                       | `Person.image`                           |                                                                     |
 * | `Author.alumniOf`                     | `Person.alumniOf`                        |                                                                     |
 * | `config.brand.name` / `.logo`         | `Organization.name` / `.logo`            | Logo needs `width` and `height`                                     |
 * | `config.brand.sameAs`                 | `Organization.sameAs`                    | The entity-disambiguation property                                  |
 * | `homeUrl()`                           | `WebSite.url`, every site-level `@id`    | One spelling of the root across schema, sitemap, and breadcrumb      |
 *
 * @see https://docs.agentblog.dev/reference/files
 */
import type {
  Blog,
  BlogPosting,
  BreadcrumbList,
  CreativeWork,
  Distance,
  FAQPage,
  Graph,
  ImageObject,
  ListItem,
  Organization as OrganizationOrText,
  Person as PersonOrText,
  Question,
  WebPage,
  WebSite,
} from 'schema-dts'

import { absoluteUrl, authorUrl, bcp47Locale, config, homeUrl, postUrl } from '@/lib/config'
import { readingTime } from '@/lib/reading-time'
import type { Author, Citation, FaqEntry, Post } from '@/lib/types'

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * One node in the page's `@graph`.
 *
 * `Graph['@graph']` is `readonly Thing[]`, and schema-dts folds a bare text
 * value into several `Thing` members, so the `string` arm has to come off before
 * anything is assignable here.
 */
export type GraphNode = Exclude<Graph['@graph'][number], string>

/**
 * schema.org allows `Person` and `Organization` to be a bare text value, so
 * schema-dts models both as `Leaf | ... | string`. A node that sits in `@graph`
 * is never a string, and leaving the string arm in place makes these types
 * unassignable to `GraphNode`. Narrowing once here beats casting at every call
 * site, and it is the only concession this file makes to schema-dts.
 */
type Organization = Exclude<OrganizationOrText, string>
type Person = Exclude<PersonOrText, string>

/* -------------------------------------------------------------------------- */
/*  Routes and identifiers                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Root-relative route paths.
 *
 * `@/lib/config` composes absolute URLs but does not expose the paths behind
 * them, and `ids.webpage` and `ids.breadcrumb` are keyed by path because a
 * `WebPage` node exists for routes that have no dedicated `*Url` helper. Private
 * on purpose: route shape belongs to the app, not to the schema layer.
 */
const routes = {
  post: (slug: string): string => `/blog/${slug}`,
} as const

/**
 * Every `@id` in the graph, in one object.
 *
 * Read rule 1 in the file header before adding to this. The convention is
 * `${url}#${fragment}`, where the fragment names the node's role on that URL, so
 * two nodes describing the same page (a `WebPage` and an `FAQPage`, say) get
 * distinct identifiers instead of merging into one confused node.
 *
 * The site-level ids are built from `homeUrl()` rather than from
 * `config.siteUrl`, so the `@id` prefix is the same string the sitemap and
 * `Organization.url` use. See `homeUrl` in `@/lib/config` for why one spelling
 * of the root matters.
 *
 * Note: `blog()` was added after the rest. `buildBlogGraph` needs an identifier
 * for the `Blog` node, and rule 1 says a call site cannot invent one, so it is
 * declared here rather than composed inline.
 *
 * `blog()` takes a path for the same reason `breadcrumb()` and `webpage()` do,
 * and the reason is not symmetry. The index is paginated, so `/blog` and
 * `/blog?page=2` are two URLs carrying two different `blogPost` lists. A path-less
 * id gave both the same `@id` and the same `url`, which is one entity described
 * two incompatible ways in the same crawl: whichever page is fetched last wins,
 * and the losing page's posts drop out of the graph. Pass the route's own path,
 * exactly as it appears in the canonical.
 */
export const ids = {
  org: (): string => `${homeUrl()}#organization`,
  website: (): string => `${homeUrl()}#website`,
  blog: (path: string): string => `${absoluteUrl(path)}#blog`,
  person: (slug: string): string => `${authorUrl(slug)}#person`,
  article: (slug: string): string => `${postUrl(slug)}#article`,
  webpage: (path: string): string => `${absoluteUrl(path)}#webpage`,
  breadcrumb: (path: string): string => `${absoluteUrl(path)}#breadcrumb`,
  faq: (slug: string): string => `${postUrl(slug)}#faq`,
  image: (url: string): string => `${url}#primaryimage`,
}

/* -------------------------------------------------------------------------- */
/*  Private helpers                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Pixel counts for `width` and `height`.
 *
 * THE ONE CAST IN THIS FILE, and it is a schema-dts artifact rather than a
 * modelling choice. schema.org types `MediaObject.width` and `.height` as
 * `Distance`, a quantity whose range is Text, so schema-dts resolves `Distance`
 * to `string`. Google's Article and Organization documentation both show integer
 * pixel counts and the Rich Results Test reads them as integers, so emitting
 * `"512"` would be legal JSON-LD and the wrong output. The cast is confined to
 * this function so the rest of the file stays honestly typed.
 */
function px(pixels: number): Distance {
  return pixels as unknown as Distance
}

/**
 * JSON-LD has no notion of a document base, so every URL in the graph has to be
 * absolute. Config and frontmatter both accept a root-relative path for
 * convenience (`/logo.png`), so normalise once here instead of in five places.
 */
function toAbsolute(url: string): string {
  return /^https?:\/\//i.test(url) ? url : absoluteUrl(url)
}

/**
 * `Post.locale` wins over the site default. The whole of the v1 locale seam.
 *
 * The Open Graph to BCP 47 conversion lives in `bcp47Locale` in `@/lib/config`
 * and is imported rather than reimplemented. A second local copy is how the
 * feed and this file came to disagree about whether `zh_Hans_CN` converts fully.
 */
function languageOf(post: Post): string {
  return bcp47Locale(post.locale ?? config.locale)
}

/**
 * `Post.citations[]` -> `BlogPosting.citation` -> `CreativeWork[]`.
 *
 * `Citation.kind` is deliberately absent from the output. It is our own
 * auditing field (peer-reviewed, official-docs, industry, news) with no
 * schema.org equivalent, and inventing a property name for it would produce
 * markup no consumer understands.
 */
function citationNode(source: Citation): CreativeWork {
  return {
    '@type': 'CreativeWork',
    name: source.name,
    url: source.url,
    ...(source.author === undefined ? {} : { author: source.author }),
    ...(source.datePublished === undefined ? {} : { datePublished: source.datePublished }),
  }
}

/** One visible question and answer pair as a `Question` node. */
function questionNode(entry: FaqEntry): Question {
  return {
    '@type': 'Question',
    name: entry.question,
    acceptedAnswer: { '@type': 'Answer', text: entry.answer },
  }
}

/**
 * `Post.heroImage` + `Post.heroAlt` -> `ImageObject`.
 *
 * The node carries no `width` or `height`. The domain model does not record the
 * intrinsic size of a hero image, and declared dimensions that disagree with the
 * file are a structured data error rather than a missing recommendation, so
 * guessing 1200x630 would be worse than omitting them. Adding `heroWidth` and
 * `heroHeight` to `PostFieldsSchema` and reading them here is a two-line change
 * on both sides when the content pipeline can supply real numbers.
 *
 * `representativeOfPage` is what tells a consumer this is the article's primary
 * image rather than one of the inline figures.
 */
function heroNode(post: Post, canonical: string): ImageObject | null {
  if (post.heroImage === undefined) return null
  const url = toAbsolute(post.heroImage)
  return {
    '@type': 'ImageObject',
    '@id': ids.image(canonical),
    url,
    contentUrl: url,
    representativeOfPage: true,
    // `PostSchema` refuses a hero image without alt text, so this is present in
    // practice; the guard is here because the refinement is not in the type.
    ...(post.heroAlt === undefined ? {} : { caption: post.heroAlt }),
  }
}

/* -------------------------------------------------------------------------- */
/*  Builders                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * The site-level nodes. Emitted once, from the blog layout, so every page on the
 * site resolves the same publisher entity.
 *
 * | `config.brand.name` / `.logo` | `Organization.name` / `.logo` | Logo needs `width` and `height` |
 * | `config.brand.sameAs`         | `Organization.sameAs`         | Entity disambiguation           |
 * | `homeUrl()`                   | `WebSite.url`                 | One spelling of the site root   |
 *
 * `sameAs` is the single highest value property in the whole config. It is the
 * entity-disambiguation property: it is how an AI search engine resolves "the
 * company that published this" from a string into a real entity it already
 * knows about, which is a different and more durable thing than ranking for a
 * query. LinkedIn, Crunchbase, GitHub, YouTube, and Wikidata are the entries
 * worth having.
 *
 * The logo is a full `ImageObject` rather than a URL string because Google's
 * Organization markup requires `width` and `height`, and a logo without
 * dimensions is one of the most common structured data errors on the web.
 */
export function buildOrgGraph(): [Organization, WebSite] {
  const organization: Organization = {
    '@type': 'Organization',
    '@id': ids.org(),
    name: config.brand.name,
    // `homeUrl()`, not `config.siteUrl`. The sitemap emits the same string for
    // the home page, and an entity whose `url` differs from the crawled URL by a
    // trailing slash is an entity that has to be reconciled rather than matched.
    url: homeUrl(),
    logo: {
      '@type': 'ImageObject',
      url: toAbsolute(config.brand.logo.url),
      width: px(config.brand.logo.width),
      height: px(config.brand.logo.height),
    },
    ...(config.brand.sameAs.length === 0 ? {} : { sameAs: config.brand.sameAs }),
  }

  const website: WebSite = {
    '@type': 'WebSite',
    '@id': ids.website(),
    url: homeUrl(),
    name: config.brand.name,
    publisher: { '@id': ids.org() },
    inLanguage: bcp47Locale(),
  }

  return [organization, website]
}

/**
 * `Author` -> `Person`. Emitted on the author page and inside every article
 * graph, always with the same `@id`, so the two references describe one entity.
 *
 * | `Author.name`       | `Person.name`        | Name only                        |
 * | `Author.bio`        | `Person.description` |                                  |
 * | `Author.jobTitle`   | `Person.jobTitle`    | Separate so it never reaches name |
 * | `Author.knowsAbout` | `Person.knowsAbout`  | Topical authority                |
 * | `Author.sameAs`     | `Person.sameAs`      | Absolute URLs                    |
 * | `Author.worksFor`   | `Person.worksFor`    | `@id` ref, site org by default   |
 * | `Author.avatar`     | `Person.image`       |                                  |
 * | `Author.alumniOf`   | `Person.alumniOf`    |                                  |
 *
 * `name` is the person's name and nothing else. Google's Article guidance is
 * explicit that it must exclude job titles, honorifics, and the publisher name,
 * and "Dr. Jane Doe, Head of Research at Acme" in an author field is one of the
 * most common ways a byline stops resolving to a person. `AuthorSchema` gives
 * `jobTitle` its own field precisely so the correct output is the only one that
 * can be built here.
 */
export function buildPersonGraph(author: Author): Person {
  return {
    '@type': 'Person',
    '@id': ids.person(author.slug),
    name: author.name,
    url: authorUrl(author.slug),
    description: author.bio,
    // An author who works somewhere else supplies that organization's URL, which
    // is a perfectly good external entity identifier. Everyone else works for
    // the site's own Organization node.
    worksFor: { '@id': author.worksFor ?? ids.org() },
    ...(author.jobTitle === undefined ? {} : { jobTitle: author.jobTitle }),
    ...(author.avatar === undefined ? {} : { image: toAbsolute(author.avatar) }),
    ...(author.alumniOf === undefined ? {} : { alumniOf: author.alumniOf }),
    ...(author.knowsAbout.length === 0 ? {} : { knowsAbout: author.knowsAbout }),
    ...(author.sameAs.length === 0 ? {} : { sameAs: author.sameAs }),
  }
}

/**
 * The breadcrumb trail as a `BreadcrumbList`.
 *
 * An entry with no `url` emits no `item`, which is Google's documented shape for
 * the current page rather than an omission: "If `item` isn't included for the
 * last item, Google uses the URL of the containing page." It is also legitimate
 * for every entry to have a `url`, which is what a post's trail looks like now
 * that it ends at the category hub rather than at the post itself. Google does
 * not require the trail to reach the current page, and it does not require it to
 * start at the site root either: "It is not required to include a breadcrumb
 * ListItem for the top level path (your site's domain or host name)."
 * @see https://developers.google.com/search/docs/appearance/structured-data/breadcrumb
 *
 * The trail here must match the trail the page renders through `<Breadcrumbs>`,
 * which is why every caller builds one array and passes it to both. Marked-up
 * navigation that a reader cannot see is the same policy violation as an
 * invisible FAQ.
 */
export function buildBreadcrumb(
  trail: readonly { name: string; url?: string }[],
  path: string,
): BreadcrumbList {
  return {
    '@type': 'BreadcrumbList',
    '@id': ids.breadcrumb(path),
    itemListElement: trail.map((crumb, index): ListItem => {
      return {
        '@type': 'ListItem',
        position: index + 1,
        name: crumb.name,
        ...(crumb.url === undefined ? {} : { item: crumb.url }),
      }
    }),
  }
}

/**
 * `Post.faq[]` -> a standalone `FAQPage` node, or `null` when there are none.
 *
 * ---------------------------------------------------------------------------
 * READ THIS BEFORE CALLING IT FROM A NEW ROUTE
 * ---------------------------------------------------------------------------
 * `FAQPage` markup may only be emitted when the FAQs actually render, visibly,
 * in the HTML of the same page. Google's structured data policy forbids marking
 * up content that is not visible to readers, and FAQ markup is the single most
 * common way a blog earns a manual action, which removes rich result eligibility
 * for the whole site rather than for the one page.
 *
 * The post route satisfies this by rendering `<Faq>` from the MDX component map
 * inside the article body before this node is ever emitted. `<Faq>` uses
 * `<details>` and CSS, never a conditional mount, so the answers are in the raw
 * HTML even when the disclosure is closed and even for a crawler that runs no
 * JavaScript.
 *
 * If you call `buildFaq` from a route that does not render the questions, delete
 * the call. Do not add the markup and plan to add the UI later.
 *
 * Note also that Google restricted FAQ rich results to authoritative government
 * and health sites in 2023, so this node is not going to produce a rich result
 * on a company blog. It is here because it is a clean, machine-readable
 * question-to-answer mapping that AI search engines do read, which is worth
 * having on its own terms.
 */
export function buildFaq(post: Post): FAQPage | null {
  if (post.faq.length === 0) return null
  return {
    '@type': 'FAQPage',
    '@id': ids.faq(post.slug),
    mainEntity: post.faq.map(questionNode),
  }
}

/**
 * The complete node set for one post page.
 *
 * Returns, in order: the `BlogPosting`, the `WebPage` it is the main entity of,
 * the `BreadcrumbList`, the author `Person`, the hero `ImageObject` when the
 * post has one, and the `FAQPage` when and only when the post has FAQ entries.
 *
 * `trail` is the same array the route hands to `<Breadcrumbs>`, and it is a
 * required argument rather than something this function assembles. It used to
 * assemble one, and the two drifted exactly as you would expect: the page
 * rendered Home, Blog, Category, Post while the markup claimed Home, Blog, Post,
 * so the site shipped a `BreadcrumbList` describing a trail no reader could see.
 * Nothing catches that. Both are valid, both validate, and they disagree.
 *
 * | `Post.title`                | `BlogPosting.headline`        |                                    |
 * | `Post.description`          | `BlogPosting.description`     | Matches the meta description       |
 * | `Post.datePublished`        | `BlogPosting.datePublished`   | Verbatim, ISO 8601 with offset     |
 * | `Post.dateModified`         | `BlogPosting.dateModified`    | Verbatim, ISO 8601 with offset     |
 * | `Post.author`               | `BlogPosting.author`          | `@id` ref, never a string          |
 * | `Post.category.name`        | `BlogPosting.articleSection`  |                                    |
 * | `Post.tags`                 | `BlogPosting.keywords`        |                                    |
 * | `Post.heroImage`/`heroAlt`  | `BlogPosting.image`           | `@id` ref to the `ImageObject`     |
 * | `Post.citations[]`          | `BlogPosting.citation`        | `Citation.kind` never emitted      |
 * | `Post.faq[]`                | `FAQPage`                     | Only when the FAQs render          |
 * | `Post.locale`               | `inLanguage` on both nodes    | Falls back to `config.locale`      |
 * | `Post.body`                 | `BlogPosting.wordCount`       | `readingTime`; omitted when zero   |
 * | `Post.relatedPosts`         | not emitted                   | Internal linking is HTML           |
 *
 * The dates go out exactly as they arrive. `IsoDateTime` has already refused
 * anything without a UTC offset, which matters because Google reinterprets an
 * offset-less timestamp in Googlebot's own timezone and can move a post across a
 * day boundary in the process.
 *
 * `wordCount` comes from `readingTime` rather than a second word counter, so the
 * number in the markup is the same number the byline shows a reader. Two
 * counters would eventually disagree, and disagreeing with your own visible page
 * is the failure mode this whole file is built to avoid. It is omitted entirely
 * when the count is zero, which happens for a post whose body is nothing but a
 * fenced code block: `readingTime` strips fences before counting.
 *
 * The `Organization` and `WebSite` nodes this graph references by `@id` are
 * emitted once from the blog layout via `buildOrgGraph`. Google merges every
 * JSON-LD block on a page into one graph, so the references resolve even though
 * the nodes arrive in a different `<script>`.
 */
export function buildArticleGraph(
  post: Post,
  trail: readonly { name: string; url?: string }[],
): GraphNode[] {
  const path = routes.post(post.slug)
  const canonical = postUrl(post.slug)
  const webpageId = ids.webpage(path)
  const language = languageOf(post)
  const hero = heroNode(post, canonical)
  const citations = post.citations.map(citationNode)
  // `readingTime` strips fenced code before counting, so a post whose body is
  // only a code block counts zero words. `"wordCount": 0` is a claim that the
  // article has no text, which is both false and worse than saying nothing,
  // and it contradicts the byline, which floors the estimate at "1 min read".
  const { words } = readingTime(post.body)

  const article: BlogPosting = {
    '@type': 'BlogPosting',
    '@id': ids.article(post.slug),
    isPartOf: { '@id': ids.website() },
    mainEntityOfPage: { '@id': webpageId },
    headline: post.title,
    description: post.description,
    datePublished: post.datePublished,
    dateModified: post.dateModified,
    author: { '@id': ids.person(post.author.slug) },
    publisher: { '@id': ids.org() },
    inLanguage: language,
    articleSection: post.category.name,
    ...(words === 0 ? {} : { wordCount: words }),
    ...(post.tags.length === 0 ? {} : { keywords: post.tags }),
    ...(citations.length === 0 ? {} : { citation: citations }),
    ...(hero === null ? {} : { image: { '@id': ids.image(canonical) } }),
  }

  const webpage: WebPage = {
    '@type': 'WebPage',
    '@id': webpageId,
    url: canonical,
    name: post.title,
    description: post.description,
    isPartOf: { '@id': ids.website() },
    breadcrumb: { '@id': ids.breadcrumb(path) },
    datePublished: post.datePublished,
    dateModified: post.dateModified,
    inLanguage: language,
    ...(hero === null ? {} : { primaryImageOfPage: { '@id': ids.image(canonical) } }),
  }

  const nodes: GraphNode[] = [
    article,
    webpage,
    buildBreadcrumb(trail, path),
    buildPersonGraph(post.author),
  ]
  if (hero !== null) nodes.push(hero)

  const faq = buildFaq(post)
  if (faq !== null) nodes.push(faq)

  return nodes
}

/**
 * The blog index as a `Blog` node whose `blogPost` entries are `@id` references
 * to the article nodes on the post pages.
 *
 * References rather than inlined `BlogPosting` nodes, for the same reason as
 * everywhere else: the article node lives on the article's own URL, and copying
 * an abridged version of it onto the index would describe a second, thinner
 * article with the same identity.
 *
 * `path` is the route's own path, including any pagination query string, and it
 * is required rather than defaulted for the reason spelled out on `ids.blog`.
 * The route already computes this string for its canonical, so pass that same
 * value here: `buildBlogGraph(posts, pagePath(page))`. A default of `/blog`
 * would make page 2 compile and still emit page 1's identity.
 */
export function buildBlogGraph(posts: readonly Post[], path: string): Blog {
  return {
    '@type': 'Blog',
    '@id': ids.blog(path),
    url: absoluteUrl(path),
    name: `${config.brand.name} Blog`,
    publisher: { '@id': ids.org() },
    isPartOf: { '@id': ids.website() },
    inLanguage: bcp47Locale(),
    blogPost: posts.map((post) => ({ '@id': ids.article(post.slug) })),
  }
}

/* -------------------------------------------------------------------------- */
/*  Serialization: the single point                                           */
/* -------------------------------------------------------------------------- */

/**
 * Drop `undefined` recursively.
 *
 * `JSON.stringify` already omits object properties whose value is `undefined`,
 * so this is not entirely redundant work but it is not entirely redundant
 * either: an `undefined` sitting in an array is serialized as `null`, and a
 * `null` inside `itemListElement` or `sameAs` is a validation error rather than
 * an ignored value. Building the nodes conditionally (which
 * `exactOptionalPropertyTypes` forces anyway) should mean nothing here has
 * anything to do. This runs so that a future builder written less carefully
 * cannot emit `"author": undefined` and fail a validator on a Friday.
 */
function prune(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.filter((entry) => entry !== undefined).map(prune)
  }
  if (typeof value === 'object' && value !== null) {
    const out: Record<string, unknown> = {}
    for (const [key, entry] of Object.entries(value)) {
      if (entry === undefined) continue
      out[key] = prune(entry)
    }
    return out
  }
  return value
}

/**
 * Wrap the nodes in one `@graph` and serialize. The only place in the block that
 * turns schema objects into a string.
 *
 * Replacing every `<` with its JSON unicode escape is the security-relevant
 * part. `JSON.stringify` escapes quotes and backslashes but leaves `<` alone, so
 * a post title containing a closing script tag would otherwise end the element
 * early and the rest of the JSON would be parsed as HTML. The escape decodes
 * back to `<`, so a consumer reads the original text and a browser never sees a
 * tag. Every `<` in the output is inside a JSON string, because JSON's own
 * structural characters do not include it, which is why a blanket replacement is
 * safe.
 *
 * Keep this the only serialization point. A second `JSON.stringify` of a schema
 * object somewhere else in the codebase is a hole in exactly this defence.
 */
export function renderJsonLd(nodes: readonly GraphNode[]): string {
  const graph: Graph = { '@context': 'https://schema.org', '@graph': nodes }
  return JSON.stringify(prune(graph)).replaceAll('<', '\\u003c')
}
