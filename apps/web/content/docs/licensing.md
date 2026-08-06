---
title: Licensing
description: Three licenses scoped by directory, and the reasoning behind each one.
group: Project
order: 2
---

| Scope                                           | License   | File              |
| ----------------------------------------------- | --------- | ----------------- |
| Code                                            | MIT       | `LICENSE`         |
| Seed MDX posts                                  | CC0 1.0   | `LICENSE-SEED`    |
| Documentation prose, including the GEO playbook | CC BY 4.0 | `LICENSE-CONTENT` |

## Code: MIT

A restrictive license on a template whose entire distribution mechanism is copying files into your repository would be incoherent. MIT matches shadcn, matches Next.js, and matches every expectation the audience has.

The moat is the hosted service, not the template.

## Seed posts: CC0

The two seed posts in `content/blog/` are copied into your repository and become your published content. Any attribution requirement would mean every AgentBlog user technically owes credit on their own blog, which is unenforceable and hostile. CC0 says so explicitly.

Delete them, rewrite them, publish them as they are. They are yours the moment they land.

## Documentation: CC BY 4.0

This is a reversal of the obvious instinct, which was copyleft or all-rights-reserved to stop a competitor reprinting the playbook. That instinct was wrong.

The realistic threat is scraping, and no license prevents scraping. The realistic upside is being quoted. **CC BY's attribution requirement is exactly the citation this product exists to generate.** Licensing our best top-of-funnel asset so that reproducing it _requires_ a credit link is the most on-thesis choice available.

Copyleft would discourage the commercial blogs most likely to link. All rights reserved discourages everyone.

So: reproduce these pages, translate them, quote them at length, put them in your internal wiki, feed them to a model. Credit `agentblog.dev` with a link.

## What each covers, precisely

- **MIT:** everything under `packages/`, `apps/web/registry/blog/{app,components,lib,hooks,styles}/`, `apps/web/app/`, `apps/web/components/`, `apps/web/lib/`, `scripts/`, and `plugins/`.
- **CC0:** `apps/web/registry/blog/content/**`.
- **CC BY 4.0:** `apps/web/content/docs/**` and `docs/**`.

SPDX headers mark the boundary in ambiguous files.

## Third-party licenses

AgentBlog composes shadcn/ui components (MIT), depends on Next.js (MIT), React (MIT), Zod (MIT), Tailwind CSS (MIT), and the unified ecosystem (MIT). Nothing in the dependency tree carries a copyleft obligation.

The `@tailwindcss/typography` plugin is MIT. `schema-dts` is Apache 2.0, and it is a devDependency in the block: it types the JSON-LD builders and does not ship to the browser.

## Contributions

By opening a pull request you agree that your contribution is licensed under the license covering the directory you changed. There is no CLA.
