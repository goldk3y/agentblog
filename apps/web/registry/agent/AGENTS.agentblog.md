<!-- agentblog:start -->

## Blog (AgentBlog)

Posts live in `content/blog/*.mdx`. Config: `agentblog.config.ts`. Authors:
`content/authors.json`.

- To write a post, use the AgentBlog `write-blog-post` skill. To update one, use
  `refresh-blog-post`. Do not hand-write posts: the skills carry the schema contract
  and the citation rules, and a hand-written post silently skips both.
- Never fabricate a statistic, a quotation, or a source. If a number cannot be
  verified at a real source, state the claim qualitatively instead.
- Never use an em dash, in a post or anywhere else in this repository. Use a comma,
  a colon, parentheses, or a full stop. `agentblog audit` fails on the em dash
  character `U+2014` and on a double hyphen used as a dash.
- Never remove or narrow `htmlLimitedBots` in `next.config.ts`. The value replaces
  Next.js's default bot list rather than extending it, so it must stay a superset of
  that list plus the AI crawlers. Narrowing it breaks Google, Bing, and social
  previews as well as AI citation.
- Never add `'use client'` to anything in the article render path. Only
  `TableOfContents` and `ShareButtons` may be client components, and both render
  meaningful content server-side first.
- `generateStaticParams` in `app/blog/[slug]/page.tsx` must return every slug, never
  a slice and never a page.
- `dateModified` changes only when the content actually changed. An unearned date
  bump is a trust-destroying signal, not a freshness signal.
- Every route that sets `openGraph` or `robots` must spread the shared defaults from
  `lib/metadata.ts`. Metadata merge is shallow, so defining the object at all
  replaces the parent's entire object.
- JSON-LD is built only in `lib/schema.ts` and serialized only by `renderJsonLd`.
  Do not add a second `<script type="application/ld+json">`.
- Run `npx agentblog audit` before committing a post, and `npx agentblog doctor`
  after changing config.

<!-- agentblog:end -->
