---
title: Roadmap and non-goals
description: What is shipping, in what order, and the four things v1 deliberately does not do.
group: Project
order: 3
---

## Non-goals

Each of these is a decision with a reason.

### Multi-locale routing is out of v1

Full internationalization means `/[locale]/blog/[slug]` routing, `alternates.languages` in the metadata **and** in the sitemap, per-locale feeds, translation linking, and locale-filtered `generateStaticParams`. That is a large surface, and it multiplies prerender cardinality across the whole blog.

What we did take is the cheap half. Retrofitting locale into `ContentSource` later would be a breaking change to the one interface that exists to stay stable, and it would falsify the promise that migrating between content sources is a one-line config change. So four optional locale fields are reserved on the schema and the source contract now, unused. Adding locale later becomes additive rather than breaking.

### Tailwind v3 is unsupported, and doctor errors rather than warns

Supporting it would mean a second `cssVars` format (v3 stored bare HSL channel triplets, v4 stores complete `oklch()` values, and using the wrong form fails silently by producing an invalid colour that inherits), a second prose bridge, and `tailwind.config.js` content paths.

Decisively: v3 users must pin `shadcn@2.3.0`, a CLI that predates `registry:base`, `include`, namespaced registries, and the registry directory. Half the install story does not function for them, so supporting v3 means shipping a second product against a CLI that cannot install it.

shadcn's own position agrees. v3 is not deprecated, but new projects are v4 and the v3 documentation sits under Legacy Docs.

### The blog ships no llms.txt

See [Why the blog block does not ship llms.txt](/docs/no-llms-txt). Short version: Google is on record that Search does not use it, no major provider consumes it in production, and the best-instrumented measurement we could retrieve logged 84 requests to `/llms.txt` out of 62,100 AI bot visits over 90 days. This docs site serves one, because developer documentation with programmatic readers is the one place the token-efficiency argument is real.

### Monorepos are detected and disclosed, not certified

See [Monorepo support](/docs/monorepo), which states precisely what works, what is untested, and where each file lands. The mechanism works because shadcn already handles it. A fixture is not in CI yet.

## Also not in v1

- **A hosted CMS.** The `ContentSource` interface is the seam. There is nothing behind it yet.
- **An analytics integration.** `lib/ai-referrers.ts` ships as a pure classifier with no dependency, and [AI referrer tracking](/docs/ai-referrers) shows the wiring for GA4, Vercel Analytics, and PostHog. Shipping an integration would mean picking a vendor for you.
- **Comments.** Not a blog problem worth solving twice.
- **A theme gallery.** The block has no theme. That is the point.
- **Search.** Your site probably already has one, and if it does not, that is a site decision rather than a blog decision.

## Order of work

**Now.** The registry, the block, the CLI, and the agent layer. `mdxSource` is the only content source.

**Next.** Supabase and Convex adapters, in that order, each passing the same eight contract assertions. A monorepo fixture joins CI alongside the first of them, because that is when our users are likely to be in one.

**After that.** Measurement. `agentblog audit --crawlers` reads a log you already have and reports IP-verified hits per bot per week. A hosted version reads Search Console over OAuth. Both sit on one interface, so the free tier and the paid one are the same shape.

**Later.** A hosted content source, and the dashboard on top of the measurement layer.

## Maintenance, as a standing job

This product depends on third-party surfaces that move. Naming the cadence is more useful than promising to keep up.

| Cadence             | What gets checked                                                                                                                               |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Every CI run        | The vendored `htmlLimitedBots` default list still matches Next.js canary. The registry schema still validates. Generated files have not drifted |
| Monthly             | Re-fetch the crawler IP range files and diff them. Look for new user agents                                                                     |
| Quarterly           | Re-verify the Next.js API table against the installed minor. Re-read the shadcn changelog. Re-check the CDN and AIPREF situation                |
| Every Next.js major | Full re-verification against the upgrade guide. The CI fixture moves to the new major first                                                     |

The fixture in CI tracks latest stable, which means upstream breakage surfaces in this repository before it surfaces in yours. That is the single most valuable maintenance decision here, and it only works if someone looks at the red build.

## Version compatibility

| AgentBlog | Next.js | React | Tailwind | shadcn CLI |
| --------- | ------- | ----- | -------- | ---------- |
| 0.x       | 16.x    | 19.x  | 4.x      | 4.x        |

Next.js 17 will invalidate parts of this, the same way 16 invalidated the 15-era guidance. When it lands, the fixture moves first and the block follows.
