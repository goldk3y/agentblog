---
title: The blog block
description: A file-by-file tour of what AgentBlog writes into your repository, and the rules baked into each piece.
group: Reference
order: 2
---

Everything below lands in your repository as source you own and can edit. The paths assume a flat layout; in a `src/` layout shadcn resolves them against your `components.json` aliases.

## Routes

| File                                  | What it does                                                              |
| ------------------------------------- | ------------------------------------------------------------------------- |
| `app/blog/layout.tsx`                 | Imports the preflight check. Adds the editorial policy link to the footer |
| `app/blog/page.tsx`                   | Paginated index, `Blog` schema                                            |
| `app/blog/[slug]/page.tsx`            | The post route                                                            |
| `app/blog/[slug]/opengraph-image.tsx` | Per-post OG image                                                         |
| `app/blog/category/[slug]/page.tsx`   | Category hub, always indexable                                            |
| `app/blog/tag/[slug]/page.tsx`        | Tag listing, noindexed below `noindexTagsBelow`                           |
| `app/authors/[slug]/page.tsx`         | Author page emitting `Person`                                             |
| `app/editorial-policy/page.tsx`       | Optional. Ships as `@agentblog/eeat-pages`                                |

### Rules the route files obey

**`generateStaticParams` returns every slug.** Never sliced, never paginated. Under the classic prerender model every post becomes complete static HTML at build time, which is the safest possible shape for a crawler that fetches once and does not run JavaScript.

**No `'use client'` in the article render path.** Two components are allowed to be client components, `TableOfContents` for its scroll spy and `ShareButtons`, and both render meaningful content server-side first. The FAQ and the table of contents use `<details>` and CSS rather than conditional mounting, so their content is in the HTML whether or not anything hydrates.

**One `<h1>` per page.** `<time dateTime>` on every date. A stable `id` on every H2 and H3. `rel="author"` on the byline link.

**Every segment that sets `openGraph` or `robots` spreads the shared defaults** from `lib/metadata.ts`. This one is worth stating twice, because it is invisible to the type checker. See below.

**`params` is always awaited,** and the types come from `next typegen` rather than being hand-written, so they cannot drift from the route tree.

## SEO routes

| File                       | Notes                                                                                      |
| -------------------------- | ------------------------------------------------------------------------------------------ |
| `app/sitemap.ts`           | `lastModified` from each post's `dateModified`, never `new Date()`                         |
| `app/robots.ts`            | Guarded on `VERCEL_ENV` so preview deployments are not indexed. Emits the `aiAccess` rules |
| `app/feed.xml/route.ts`    | RSS 2.0                                                                                    |
| `app/opengraph-image.tsx`  | Site-level OG image                                                                        |
| `app/not-found.tsx`        | A 404 that links back into the content, not a dead end                                     |
| `app/api/publish/route.ts` | Revalidate plus IndexNow                                                                   |

`sitemap.js`, `robots.js`, and the OG image files are all cached route handlers unless they use a request-time API. That is why the publish webhook revalidates `/sitemap.xml` and `/feed.xml` explicitly and not only the post paths. A new post that never reaches either is a failure with no symptom.

The publish path uses `revalidateTag('posts', { expire: 0 })`, never `'max'`. The second argument is required by the type in Next.js 16, and passing a stale profile means you ping a crawler and then serve it the old HTML.

## Components

`components/blog/`:

`answer-capsule`, `author-bio`, `breadcrumbs`, `byline`, `category-pills`, `icons`, `json-ld`, `pagination`, `post-card`, `post-list`, `prose`, `related-posts`, `share-buttons`, `table-of-contents`.

`components/mdx/`:

`index` (the component map), `callout`, `code-block`, `faq`, `figure`, `key-takeaways`, `quote`, `stat`, `table`.

The MDX map covers `h2`, `h3`, `h4` with anchor links, `a`, the full table family, `pre`, `code`, `blockquote`, `img`, `ul`, `ol`, `li`, `hr`, plus the custom components. Extending it is editing one file.

`components/blog/icons.tsx` re-exports every icon used anywhere in the block. Swapping icon libraries then costs one file rather than a grep across twelve components, which matters because `registry:base` sets `iconLibrary` and a project on Tabler or Phosphor will not have our `lucide-react` imports.

`Pagination` renders real `<a href>` elements. A paginator that only works after hydration hides everything past page one from a crawler.

## Library

| File                                                     | Responsibility                                                                                                 |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `lib/config.ts`                                          | The resolved config singleton and the URL helpers. The only importer of `@/agentblog.config`                   |
| `lib/posts.ts`                                           | The adapter facade. Every route reads posts through this file                                                  |
| `lib/schema.ts`                                          | The JSON-LD `@graph` builders, typed with `schema-dts`                                                         |
| `lib/metadata.ts`                                        | Shared `openGraph` and `robots` defaults                                                                       |
| `lib/render-mdx.tsx`                                     | The only place MDX is compiled                                                                                 |
| `lib/mdx-plugins/`                                       | `remark-extract-toc` and `remark-answer-capsule`                                                               |
| `lib/toc.ts`                                             | Heading extraction                                                                                             |
| `lib/reading-time.ts`                                    | Word count and minutes                                                                                         |
| `lib/indexnow.ts`                                        | Submission, with the response codes surfaced                                                                   |
| `lib/preflight.ts`                                       | Build-time config linting. Generated, do not edit                                                              |
| `lib/preflight-checks.ts`                                | Generated from `packages/checks`. Do not edit                                                                  |
| `lib/schemas.ts`, `lib/types.ts`, `lib/define-config.ts` | Generated from `packages/schema`. Do not edit                                                                  |
| `lib/ai-referrers.ts`                                    | Referrer classifier for AI assistants. No analytics dependency. See [AI referrer tracking](/docs/ai-referrers) |
| `lib/sources/mdx.ts`                                     | The MDX adapter                                                                                                |

The four generated files carry a banner saying so. They are generated rather than imported because they ship into your repository, where there is no `@agentblog/*` package to import from. CI asserts they are current, so a drift between the CLI's checks and the build-time checks is a red build rather than two tools disagreeing in front of you.

## The shallow merge trap

Next.js merges metadata from multiple segments shallowly. Metadata with nested fields such as `openGraph` and `robots` defined in an earlier segment is overwritten by the last segment to define them.

With a real example. The root layout sets:

```ts
openGraph: { siteName: 'Your Brand', locale: 'en_US', type: 'website' }
```

The post page sets:

```ts
openGraph: {
  type: 'article',
  title: post.title,
  description: post.description,
  url: canonical,
  images: [ogImage],
}
```

Because the page defined `openGraph` at all, the root layout's entire object is discarded. Every post ships an Open Graph card with no `og:site_name` and no `og:locale`. Nothing errors, no validator complains, and the types are correct. The only way to notice is to view source on a built page.

`lib/metadata.ts` exists so that no route file can make this mistake by accident, and `agentblog doctor` asserts it against built HTML rather than against the source, because the loss is invisible to the type checker.

## Styles

`styles/agentblog.css` carries two things: the bridge from `@tailwindcss/typography` to your shadcn tokens, and the `--agentblog-` prefixed variables for the reading measure and prose scale.

The bridge matters because the typography plugin ships its own greys, which is the one thing the theming rules forbid. In Tailwind v4 the plugin is loaded with `@plugin` and customized through `--tw-prose-*` variables, so binding them to your tokens is about fifteen lines in one file. `dark:prose-invert` becomes unnecessary: the tokens already flip, and the inverted palette would fight them.

Note the version trap. Tailwind v3 era shadcn stored colours as bare HSL channel triplets, so the idiom was `hsl(var(--foreground))`. Tailwind v4 shadcn stores complete `oklch()` values, so the correct form is `var(--foreground)` with no wrapper. Most blog posts and answers online still show the v3 form, and it fails silently by producing an invalid colour that inherits.

## Content

`content/blog/*.mdx` and `content/authors.json`. Two seed posts ship with the block, licensed CC0, because they become your published content and an attribution requirement would mean every AgentBlog user technically owes credit on their own blog.

The seed posts are also the format specification. They are what the `write-blog-post` skill patterns from, so they follow every rule in [the GEO playbook](/docs/geo-playbook), including the copy style rules.
