<!-- agentblog:start -->

## Blog (AgentBlog)

Posts live in `content/blog/*.mdx`. Config: `agentblog.config.ts`. Authors:
`content/authors.json`. Categories: `content/categories.json`.

Seven AgentBlog skills cover the lifecycle. Use them by name rather than working
from memory: they carry the schema contract, the citation rules, and the checks,
and hand-doing any of these steps silently skips all three.

| Task                                     | Skill                 |
| ---------------------------------------- | --------------------- |
| Finish the install, make the blog ours   | `agentblog-setup`     |
| Find out what to write, with real data   | `dataforseo-research` |
| Decide what to write and how it links up | `plan-blog-content`   |
| Write a post                             | `write-blog-post`     |
| Update an existing post                  | `refresh-blog-post`   |
| Gate a post before it ships              | `agentblog-audit`     |
| Ship it and confirm it landed            | `publish-blog-post`   |

- Never fabricate a statistic, a quotation, or a source. If a number cannot be
  verified at a real source that was actually fetched, state the claim
  qualitatively instead. Never invent an anecdote, a first-person story, or an
  opinion to make prose read as human.
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
  after changing config. Both exit non-zero on an error finding, so read the exit
  code rather than the absence of a stack trace.

<!-- agentblog:end -->
