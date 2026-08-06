---
title: Introduction
description: What AgentBlog is, what it installs into your Next.js app, and which problems it solves that a starter template does not.
group: Getting started
order: 1
---

AgentBlog is a blog you install into an existing Next.js 16.3 app. It writes 70 files into your repository through a shadcn registry, then patches two config files that a registry cannot reach. After that there is no package of ours in your dependency tree and no version of ours for you to upgrade around.

It exists because search and AI answers are the two organic channels nearly everyone knows they should have, and almost nobody sets up properly. The individual pieces are not hard. There are just a lot of them, roughly half fail silently, and you find out months later when nothing ranks and nothing cites you.

## What it installs

- **Routes.** A paginated index, the post route, category hubs, tag pages, author pages, and an editorial policy stub.
- **SEO routes.** `sitemap.ts` built from real content dates, `robots.ts` with a deployment guard, an RSS feed, site and per-post Open Graph images, and a publish webhook that revalidates the feed and the sitemap as well as the post.
- **Structured data.** A connected JSON-LD `@graph` typed with `schema-dts`, serialized in exactly one function.
- **Components.** Blog components built on shadcn primitives, plus an MDX component map with callouts, FAQs, figures, statistics, and tables.
- **The content adapter.** `mdxSource` reads `.mdx` off disk. Swapping it for a database-backed source is one line in `agentblog.config.ts`.
- **The agent layer.** Four skills in `.claude/skills/` and a block in your `AGENTS.md`.

## What it is not

It is not a hosted platform, and it is not a theme. The components carry no colours of their own: they compose your shadcn primitives and use semantic tokens only, so `/blog` looks like the rest of your product on the day you install it. See [Theming](/docs/theming).

It is also not a starter template you clone. Your app already exists. AgentBlog adds a section to it.

## Why posts are files

Posts live at `content/blog/*.mdx` in your repository. That is the decision everything else depends on. A coding agent can read the existing posts to learn your voice and your internal link graph, write a new one, and open a pull request, all with the tools it already has. No API, no CMS credentials, no plugin.

The [agent layer](/docs/agent-layer) is what makes that reliable rather than merely possible: the writing playbook is a skill your agent picks up from its description when you ask for a post, and the audit skill checks the result against the same gates CI does.

## Where to start

- [Installation](/docs/installation) covers both install paths and what each one does.
- [Configuration](/docs/configuration) is the field-by-field reference for `agentblog.config.ts`.
- [The GEO playbook](/docs/geo-playbook) is the writing guide, and it is useful whether or not you install anything.
- [Roadmap and non-goals](/docs/roadmap) states plainly what v1 does not do.

## Requirements

| Requirement              | Why it is a requirement rather than a preference                                                                                                                                          |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Next.js 16.3, App Router | `htmlLimitedBots`, `images.qualities`, and the metadata streaming behaviour this product is built around are all 16-specific, and the `AGENTS.md` managed-block behaviour arrives in 16.3 |
| React 19                 | Next.js 16's baseline                                                                                                                                                                     |
| Tailwind v4              | v3 stores colours as HSL channel triplets and needs a CLI that predates namespaced registries. See [Roadmap and non-goals](/docs/roadmap)                                                 |
| `components.json`        | AgentBlog composes your shadcn primitives. If the file is absent, `init` refuses and prints the `shadcn init` command rather than choosing a design system for you                        |
| Node 20.9 or newer       | Next.js 16's floor                                                                                                                                                                        |

`npx agentblog@latest init` verifies all five before writing anything.

## Licensing

The code is MIT. The seed posts are CC0, because they become your published content. This documentation, including the GEO playbook, is CC BY 4.0. Details in [Licensing](/docs/licensing).
