# Schema reference

The JSON-LD `@graph` shapes AgentBlog emits, the mapping from AgentBlog frontmatter
to schema.org properties, and the markup errors that actually happen.

> **License.** This file is prose documentation, licensed CC BY 4.0. See
> `LICENSE-CONTENT` in the AgentBlog repository.

> **Scope: no Next.js APIs in this file, deliberately.** Next.js 16.3 ships
> version-matched documentation at `node_modules/next/dist/docs/`, generated for the
> exact version installed in the project. Anything we wrote here about `Metadata`,
> `generateMetadata`, `sitemap.ts`, or `revalidateTag` would drift with every
> release and would lose to the bundled copy the moment it did. For framework
> questions, read the bundled docs. This file covers the vocabulary layer, which is
> ours.

---

## 1. Where the JSON-LD comes from

`lib/schema.ts` in the installed block builds every node. It is typed with
`schema-dts`, and it has exactly one serialization point, `renderJsonLd`, which
escapes `<` as `<` so an injected `</script>` cannot break out of the tag.

Do not hand-write a `<script type="application/ld+json">` anywhere. If a node is
missing, add a builder to `lib/schema.ts`. Two serialization points is how a graph
starts contradicting itself.

The builders are `buildOrgGraph`, `buildPersonGraph`, `buildArticleGraph`,
`buildBlogGraph`, `buildBreadcrumb`, and `buildFaq`. Node `@id` values come from the
`ids` object, never from string concatenation at the call site, because the `@id`
values are what link the graph together and a typo in one silently disconnects a
node instead of erroring.

## 2. The connected `@graph` for a post

Every node in one `@graph`, cross-referenced by `@id`. Separate disconnected script
tags describe several unrelated things instead of one thing.

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://example.com/#organization",
      "name": "Your Brand",
      "url": "https://example.com",
      "logo": {
        "@type": "ImageObject",
        "@id": "https://example.com/#logo",
        "url": "https://example.com/logo.png",
        "width": 512,
        "height": 512
      },
      "sameAs": [
        "https://www.linkedin.com/company/yourbrand",
        "https://www.crunchbase.com/organization/yourbrand",
        "https://www.youtube.com/@yourbrand",
        "https://www.wikidata.org/wiki/Q000000"
      ]
    },
    {
      "@type": "WebSite",
      "@id": "https://example.com/#website",
      "url": "https://example.com",
      "name": "Your Brand",
      "publisher": { "@id": "https://example.com/#organization" },
      "inLanguage": "en-US"
    },
    {
      "@type": "Person",
      "@id": "https://example.com/authors/jane-doe#person",
      "name": "Jane Doe",
      "url": "https://example.com/authors/jane-doe",
      "image": "https://example.com/authors/jane-doe.jpg",
      "jobTitle": "Senior Analyst",
      "description": "Jane has spent 11 years building retrieval systems.",
      "worksFor": { "@id": "https://example.com/#organization" },
      "knowsAbout": ["Information retrieval", "Search ranking"],
      "alumniOf": "Stanford University",
      "sameAs": ["https://www.linkedin.com/in/janedoe", "https://github.com/janedoe"]
    },
    {
      "@type": "BlogPosting",
      "@id": "https://example.com/blog/my-post#article",
      "isPartOf": { "@id": "https://example.com/blog/my-post#webpage" },
      "mainEntityOfPage": { "@id": "https://example.com/blog/my-post#webpage" },
      "headline": "Exact Title, Kept Concise",
      "description": "One sentence summary, identical to the meta description.",
      "image": {
        "@type": "ImageObject",
        "@id": "https://example.com/blog/my-post#primaryimage",
        "url": "https://example.com/blog/my-post/hero.jpg",
        "width": 1200,
        "height": 630
      },
      "datePublished": "2026-01-15T09:00:00-08:00",
      "dateModified": "2026-08-01T11:30:00-07:00",
      "author": { "@id": "https://example.com/authors/jane-doe#person" },
      "publisher": { "@id": "https://example.com/#organization" },
      "inLanguage": "en-US",
      "articleSection": "Technical SEO",
      "keywords": ["generative engine optimization", "AI crawlers"],
      "about": [{ "@type": "Thing", "name": "Generative Engine Optimization" }],
      "mentions": [{ "@type": "SoftwareApplication", "name": "Next.js" }],
      "citation": [
        {
          "@type": "CreativeWork",
          "name": "GEO: Generative Engine Optimization",
          "url": "https://arxiv.org/abs/2311.09735"
        }
      ]
    },
    {
      "@type": "WebPage",
      "@id": "https://example.com/blog/my-post#webpage",
      "url": "https://example.com/blog/my-post",
      "name": "Exact Title",
      "isPartOf": { "@id": "https://example.com/#website" },
      "primaryImageOfPage": { "@id": "https://example.com/blog/my-post#primaryimage" },
      "breadcrumb": { "@id": "https://example.com/blog/my-post#breadcrumb" },
      "datePublished": "2026-01-15T09:00:00-08:00",
      "dateModified": "2026-08-01T11:30:00-07:00"
    },
    {
      "@type": "BreadcrumbList",
      "@id": "https://example.com/blog/my-post#breadcrumb",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Blog", "item": "https://example.com/blog" },
        {
          "@type": "ListItem",
          "position": 2,
          "name": "Content Strategy",
          "item": "https://example.com/blog/category/content-strategy"
        }
      ]
    }
  ]
}
```

The trail starts at `/blog` and ends at the category hub, matching the visible
breadcrumb on the page exactly, because the route builds one array and passes it
to both. Google requires neither end: "It is not required to include a
breadcrumb ListItem for the top level path", and a trail may stop above the
current page. On a list page, where the last crumb is the page the reader is on,
that crumb has no `item` property, which is the documented shape rather than an
omission.

## 3. The other graph shapes

### Blog index

```json
{
  "@type": "Blog",
  "@id": "https://example.com/blog#blog",
  "url": "https://example.com/blog",
  "name": "Your Brand Blog",
  "description": "…",
  "publisher": { "@id": "https://example.com/#organization" },
  "isPartOf": { "@id": "https://example.com/#website" },
  "blogPost": [
    { "@id": "https://example.com/blog/post-a#article" },
    { "@id": "https://example.com/blog/post-b#article" }
  ]
}
```

`blogPost` holds `@id` references, not inlined article nodes. Inlining duplicates
every article body into the index page's markup.

### FAQPage

Emitted only when the post has a non-empty `faq` array **and** those questions
render visibly in the article.

```json
{
  "@type": "FAQPage",
  "@id": "https://example.com/blog/my-post#faq",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Do AI crawlers execute JavaScript?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "No. GPTBot, ClaudeBot, and PerplexityBot read only the raw HTML the server returns."
      }
    }
  ]
}
```

### Author page

`buildPersonGraph` emits the same `Person` node as the article graph, at the same
`@id`. One identity, referenced from two pages, is the point of `@id`.

## 4. Frontmatter to schema.org mapping

AgentBlog frontmatter is validated by `PostFrontmatterSchema`. This table is the
contract between that schema and the graph above. If you add a frontmatter field
that maps to schema.org, add a row here and a branch in `lib/schema.ts`.

### Post fields

| Frontmatter             | Schema.org target                                    | Notes                                                                                                                                     |
| ----------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `slug`                  | none directly                                        | Composes every `@id` and the canonical URL. Defaults to the file name with `.mdx` removed; frontmatter overrides it. Keep them identical. |
| `title`                 | `BlogPosting.headline`, `WebPage.name`               | At most 70 characters, aim for 60. Google removed the old 110-character headline limit in January 2025, but SERP truncation did not move. |
| `description`           | `BlogPosting.description`                            | 50 to 160 characters. Must be byte-identical to the meta description.                                                                     |
| `answerCapsule`         | none                                                 | Renders visibly under the H1. Not marked up, by design: there is no schema.org property for it and inventing one adds noise.              |
| `datePublished`         | `BlogPosting.datePublished`, `WebPage.datePublished` | ISO 8601 **with a UTC offset**. Without one, Google reads it in Googlebot's timezone.                                                     |
| `dateModified`          | `BlogPosting.dateModified`, `WebPage.dateModified`   | Same rule. Must match the visible "Updated" date exactly.                                                                                 |
| `author`                | `BlogPosting.author` as `{ "@id": … }`               | Never a bare string. See section 5.                                                                                                       |
| `category`              | `BlogPosting.articleSection`                         | Also drives the breadcrumb trail and the category hub page.                                                                               |
| `tags`                  | `BlogPosting.keywords`                               | Largely ignored for ranking, harmless to include.                                                                                         |
| `heroImage` + `heroAlt` | `BlogPosting.image` as a linked `ImageObject`        | `heroAlt` is required whenever `heroImage` is set. The image needs `width` and `height`.                                                  |
| `relatedPosts`          | none                                                 | Internal link graph only. Used for orphan prevention and the related-posts block.                                                         |
| `citations[]`           | `BlogPosting.citation[]` as `CreativeWork`           | `name` and `url` are emitted.                                                                                                             |
| `citations[].kind`      | none                                                 | Ours, for auditing. `peer-reviewed`, `official-docs`, `industry`, `news`, `other`. Never emitted as JSON-LD.                              |
| `faq[]`                 | `FAQPage.mainEntity[]`                               | Only when the questions render on the page.                                                                                               |
| `locale`                | `BlogPosting.inLanguage`                             | Falls back to `config.locale`.                                                                                                            |
| `draft`                 | none                                                 | Excluded from every query, the sitemap, and the feed.                                                                                     |

### Author fields

| Frontmatter  | Schema.org target    | Notes                                                                                                                                |
| ------------ | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `name`       | `Person.name`        | The person's name and nothing else. No job title, no honorific, no publisher name. Google's Article guidance is explicit about this. |
| `jobTitle`   | `Person.jobTitle`    | Exists so the correct shape of `name` is the only constructible one.                                                                 |
| `bio`        | `Person.description` | Required. This is the E-E-A-T lookup surface, and the Search Quality Rater Guidelines direct raters to look authors up.              |
| `avatar`     | `Person.image`       | Absolute URL.                                                                                                                        |
| `worksFor`   | `Person.worksFor`    | Emitted as `{ "@id": "…/#organization" }` when it matches the configured brand.                                                      |
| `knowsAbout` | `Person.knowsAbout`  | Topics this author is credible on.                                                                                                   |
| `alumniOf`   | `Person.alumniOf`    |                                                                                                                                      |
| `sameAs`     | `Person.sameAs`      | Absolute profile URLs. The strongest entity signal in the whole graph.                                                               |

### Config to `Organization` and `WebSite`

| Config path                     | Schema.org target                                                 |
| ------------------------------- | ----------------------------------------------------------------- |
| `brand.name`                    | `Organization.name`, `WebSite.name`                               |
| `siteUrl`                       | `Organization.url`, `WebSite.url`, and the base of every `@id`    |
| `brand.logo.{url,width,height}` | `Organization.logo` as a linked `ImageObject`                     |
| `brand.sameAs[]`                | `Organization.sameAs`                                             |
| `locale`                        | `WebSite.inLanguage`, and the `inLanguage` fallback on every post |

## 5. Property weight

Google's Article documentation states there are **no required properties**. That is
not permission to omit them.

| Category                                                                        | Properties                                                                                                                                                               |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Highest weight for rich results                                                 | `headline`, `image`, `author` as a linked `Person` with a `url`, `datePublished`, `dateModified`                                                                         |
| High value for entity resolution, even where Google ignores it for rich results | `sameAs` (the single strongest property here), `knowsAbout`, `about`, `mentions`, `citation`, `worksFor`, `isPartOf`, `mainEntityOfPage`, and the `@id` links themselves |
| Largely ignored for ranking, harmless                                           | `wordCount`, `keywords`, `articleSection`                                                                                                                                |

`sameAs` is the property that lets an engine decide that the "Jane Doe" on this page
is the same Jane Doe it saw on LinkedIn and in a conference programme. Handles do
not do that. Absolute URLs do.

## 6. Markup errors that actually happen

| Error                                                                  | Why it breaks                                                                                        | Fix                                                                                                 |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| JSON-LD injected by client-side JavaScript                             | Never reaches a crawler that does not execute JS, which is all of them except Googlebot and Applebot | Render from a Server Component, which is what `lib/schema.ts` and the `JsonLd` component already do |
| `author` as a bare string                                              | Loses the entity link that E-E-A-T depends on                                                        | Linked `Person` node with `@id` and `url`                                                           |
| `author.name` containing a job title, honorific, or the publisher name | Explicit violation of Google's Article guidance                                                      | Put the title in `jobTitle`                                                                         |
| `dateModified` not matching the visible date                           | Trust-destroying inconsistency, and one of the most commonly flagged errors                          | Single source of truth in frontmatter. The block renders both from it.                              |
| Dates without a UTC offset                                             | Google falls back to Googlebot's timezone, silently shifting the date                                | `IsoDateTime` in the schema rejects these at parse time                                             |
| `sameAs` containing a handle instead of a URL                          | Disambiguates nothing                                                                                | Always absolute URLs                                                                                |
| `Organization.logo` missing `width` and `height`                       | Incomplete required shape                                                                            | Config carries both                                                                                 |
| `FAQPage` markup with no visible FAQs                                  | Structured data policy violation, and the most common way blogs earn one                             | Remove the markup or render the FAQs                                                                |
| Marking up any fact not visible on the page                            | The single most enforced structured data policy                                                      | Mark up what renders, nothing else                                                                  |
| Validating the rendered DOM instead of the raw HTML                    | A DOM-based validator passes markup a crawler never receives                                         | Validate `curl` output, not DevTools                                                                |
| Two `<script type="application/ld+json">` tags with overlapping claims | The graph contradicts itself and neither node is trustworthy                                         | One `@graph`, one serialization point                                                               |

## 7. Validating

Two tools, two different questions. Run both and report both.

- [Rich Results Test](https://search.google.com/test/rich-results) answers "is this
  eligible for a rich result".
- [Schema Markup Validator](https://validator.schema.org/) answers "is this valid
  schema.org vocabulary".

Feed both the **raw HTML** from a `curl`, not a URL the tool will render with
JavaScript, and not a copy-paste from the browser inspector.
