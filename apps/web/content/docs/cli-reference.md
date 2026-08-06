---
title: CLI reference
description: Every agentblog command, its flags, its merge semantics on re-run, and what doctor checks.
group: Reference
order: 4
---

```bash
npx agentblog@latest <command>
```

Published to npm as `agentblog`. It bundles its own copy of TypeScript rather than resolving one from your `node_modules`, because it patches config files in projects whose TypeScript version it does not control.

## Commands

| Command          | Does                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------- |
| `init`           | Detect the stack, prompt, run `shadcn add`, patch configs, generate an IndexNow key, run `doctor` |
| `create <name>`  | Scaffold a standalone blog site                                                                   |
| `doctor [--fix]` | Verify the install. Non-zero exit on failure, so it is usable in CI                               |
| `audit [slug]`   | The pre-publish checklist for one post or all of them                                             |
| `new <title>`    | Scaffold a post file with correct frontmatter                                                     |
| `ping <slug>`    | Fire revalidate and IndexNow manually                                                             |
| `revert`         | Restore the last patch set from `.agentblog/backup/`                                              |
| `uninstall`      | Reverse the config patches, remove the `AGENTS.md` block, list the files to delete                |
| `telemetry`      | Anonymous usage data: `on`, `off`, or `status`                                                    |

## Flags

Four flags are global, meaning they are accepted before the command name and by every command. Everything else belongs to one command or a few, and `agentblog <command> --help` is the authority.

### Global

| Flag              | Effect                                                                     |
| ----------------- | -------------------------------------------------------------------------- |
| `--cwd <path>`    | Run as if `agentblog` had started in this directory                        |
| `--no-telemetry`  | Disable anonymous usage data for this run. `DO_NOT_TRACK` is also honoured |
| `-v`, `--version` | Print the version                                                          |
| `-h`, `--help`    | Print help for the command                                                 |

There is no global `--dry-run`, no global `--yes`, no global `--force`, and no global `--json`. Passing one to a command that does not declare it is an `unknown option` error, not a no-op, which is the right behaviour and is worth knowing before you script against this.

### Per command

These are the ones most often assumed to be global. Each command has its own besides, listed in its section below and in its `--help`.

| Flag           | Accepted by                                             | Effect                                                       |
| -------------- | ------------------------------------------------------- | ------------------------------------------------------------ |
| `--dry-run`    | `init`, `create`, `doctor --fix`, `revert`, `uninstall` | Print the unified diff and write nothing                     |
| `-y`, `--yes`  | `init`, `create`                                        | Skip the prompts. Read the contract below before using it    |
| `--force`      | `init`                                                  | Proceed even when files already exist under `app/blog`       |
| `--json`       | `doctor`, `audit`                                       | Print the whole report as one JSON document and nothing else |
| `--verbose`    | `doctor`, `audit`                                       | List passing checks as well as failures                      |
| `--offline`    | `doctor`                                                | Skip every check that needs the network                      |
| `--dir <path>` | `audit`, `new`                                          | Content directory. Defaults to `content/blog`                |

`audit`, `new`, and `ping` have no `--dry-run`, because none of them patches a file you already own. `new` writes one new file and `ping` makes network calls. `uninstall` has no `--yes`: it is already non-interactive, and `--dry-run` is how you preview it.

### The real `--yes` contract

`--yes` does not accept prompt defaults, because three of the prompts have no defensible default. `init --yes` on its own refuses:

```
--yes skips the prompts, so siteUrl, brand, author must come from a flag.
Without them the layout patcher would write metadataBase: new URL(''), which
throws TypeError: Invalid URL and fails every build.
Pass --site-url <url> --brand <name> --author <slug>
```

So the non-interactive form is all four flags together:

```bash
npx agentblog@latest init --yes \
  --site-url https://yoursite.com \
  --brand "Your Brand" \
  --author your-slug
```

Each value is validated against the same rule the matching prompt uses: `--site-url` must be an absolute https URL, `--brand` must be non-empty, and `--author` must be lowercase and hyphen separated. A flag that accepted what the prompt rejects would be the same bug arriving through a different door.

`--yes` is also passed through to `shadcn add` internally, along with `--overwrite`.

## init

```bash
npx agentblog@latest init [--source mdx] [--site-url https://…] [--brand "Name"] [--author slug]
                          [--yes] [--dry-run] [--force] [--skip-install]
```

Refuses, before writing anything, when Next.js is older than 16.3 or not on the App Router, React is not 19, Tailwind is not v4, or `components.json` is absent. The last one prints the `shadcn init` command rather than running it, because `shadcn init` picks a component base and a base colour and writes CSS variables into your stylesheet.

It also refuses when `app/blog/**` already exists and AgentBlog did not write it, and prints the conflicting paths. `--force` proceeds.

One prerequisite it does not check: `init` runs `npx shadcn@latest add @agentblog/blog @agentblog/source-mdx --yes --overwrite`, which resolves the `@agentblog` namespace out of your `components.json`. Add that entry before running `init` or `shadcn add` fails on a namespace it cannot resolve. `--skip-install` skips the `shadcn add` step entirely and runs only the config patches, which is what you want when the files are already on disk.

### Merge semantics on re-run

A second `init` is a no-op. Each patch site has stated semantics rather than "write the value":

| Patch site                       | Behaviour when a value already exists                                                 |
| -------------------------------- | ------------------------------------------------------------------------------------- |
| `htmlLimitedBots`                | Union, never replace. Replacing is a live SEO regression                              |
| `images.qualities`               | Union with the existing array, dedupe, sort                                           |
| `images.remotePatterns`          | Append when no structurally equal entry exists                                        |
| `metadataBase`, `title.template` | Write only when absent. Report, never overwrite                                       |
| `AGENTS.md` block                | Replace between the `agentblog:start` and `agentblog:end` markers. Append when absent |
| IndexNow key                     | Generate only when both `public/*.txt` and `INDEXNOW_KEY` are absent                  |

Anything the CLI declines to overwrite becomes a `doctor` warning, so you are told rather than silently left half-configured.

### AGENTS.md, and the file Next.js also owns

On Next.js 16.3 and later, `next dev` generates both `AGENTS.md` and `CLAUDE.md` at your project root and rewrites a managed block between `<!-- BEGIN:nextjs-agent-rules -->` and `<!-- END:nextjs-agent-rules -->` on every run. Content outside those markers is preserved.

So `init` writes strictly after `END`, never inside or across the markers, and never writes `CLAUDE.md` at all. Next.js generates that file containing `@AGENTS.md`, which already imports everything we wrote; adding our own content there would duplicate the block into context twice and `next dev` may overwrite it anyway. If you have a hand-authored `CLAUDE.md`, it is left alone.

`agentRules: false` in `next.config.ts` opts out of the whole mechanism. `doctor` reports it, because in that case our block is the only agent instruction in the project.

## doctor

```bash
npx agentblog@latest doctor [--fix] [--dry-run] [--url https://yoursite.com/blog/post] [--offline] [--verbose] [--json]
```

Exits non-zero on any error-severity finding.

Every finding carries a stable `id`, printed alongside the message and emitted under `--json`. The ids are what to search for: they do not change when the wording does. Each check below lists the ids it can produce.

### Config checks

1. `htmlLimitedBots` exists **and is a superset of the Next.js default bot list** plus the AI crawlers. Failing the superset half is a higher-severity finding than failing the AI half: a narrowed regex is an active SEO and social preview regression, whereas a missing one is a missed opportunity. They are reported separately.
   `html-limited-bots-missing`, `html-limited-bots-narrowed`, `html-limited-bots-incomplete`, `next-config-missing`
2. `cacheComponents` is off, or the Cache Components route variant is installed.
   `cache-components-enabled`
3. `app/layout.tsx` has `metadataBase`, `title.template`, and the RSS entry under `alternates.types`.
   `metadata-base-missing`, `title-template-missing`, `rss-alternates-missing`, `root-layout-missing`
4. `generateStaticParams` exists in the post route and is not truncated. This is an AST check for `.slice(`, not a grep.
   `generate-static-params-missing`, `generate-static-params-sliced`
5. `app/robots.ts` has the deployment guard.
   `robots-env-guard-missing`
6. `app/sitemap.ts` does not call `new Date()` for `lastModified`.
   `sitemap-fabricated-lastmod`
7. No `'use client'` in the article render path.
   `use-client-in-render-path`
8. Every `revalidateTag` call passes a profile, and the one on the publish path uses `{ expire: 0 }` rather than `'max'`.
   `revalidate-tag-no-profile`, `revalidate-tag-max`
9. Next.js is on a patched release. The floor is resolved at runtime from npm dist-tags and the security advisory feed rather than hardcoded, because any literal is stale by the CLI's next minor.
   `next-missing`, `next-too-old`, `next-unpatched`, `react-too-old`
10. Tailwind v4 is present. This is an error, not a warning.
    `tailwind-missing`, `tailwind-v3`, `typography-missing`
11. `images.qualities` includes every quality the block's `<Image>` calls actually use.
    `image-qualities-missing`, `image-quality-unlisted`
12. The IndexNow key file exists in `public/` and matches `INDEXNOW_KEY`.
    `indexnow-key-file-missing`, `indexnow-key-file-mismatch`, `indexnow-key-mismatch`, `revalidate-secret-missing`
13. No AgentBlog secret landed in a git-tracked file. It runs `git check-ignore` on whichever file holds the keys and offers to move them.
    `secret-in-tracked-file`
14. No route collision with a pre-existing `app/blog/**`, and every route file the block ships actually landed.
    `route-collision`, `route-files-missing`, `route-files-partial`

### Live checks

15. `--url` fetches the URL as GPTBot and asserts body text is present and `<title>` is inside `<head>`.
    `live-no-title-<Bot>`, `live-title-in-body-<Bot>`
16. `--url` repeats the fetch as GPTBot, ClaudeBot, PerplexityBot, OAI-SearchBot, **and Googlebot**, asserting 200 plus body text. A 403, a challenge, or an interstitial is a blocking failure that names the CDN. This is the most valuable check in the list; see [When your CDN blocks crawlers](/docs/troubleshooting-cdn).
    `live-fetch-failed-<Bot>`, `live-blocked-<Bot>`, `live-status-<Bot>`, `live-challenge-<Bot>`, `live-empty-<Bot>`, `cdn-detected`

    **Run this from CI or from your own machine, not from inside the deployment.** It is an ordinary `fetch` from wherever the CLI happens to be running. A request that originates inside your own network can bypass the exact CDN or WAF rule you are testing for, and then the check passes on a site no crawler can reach.

### Correctness checks

17. The publish webhook revalidates `/sitemap.xml` and `/feed.xml`, not only the post paths.
    `publish-misses-metadata-routes`
18. The adapter declares `prerenderStrategy`, and `deployHook` is set when it is `'deploy-hook'`.
    `deploy-hook-unverified`, `content-source-unreadable`
19. `openGraph` and `robots` on post pages spread the shared defaults, asserted against built HTML rather than source, because shallow merge loss is invisible to the type checker.
    `metadata-defaults-dropped`
20. The `AGENTS.md` block sits outside the Next.js markers and no `CLAUDE.md` was written by us.
    `agents-md-missing`, `agents-block-missing`, `agents-block-inside-next-markers`, `claude-md-has-our-block`, `agent-rules-disabled`
21. Node 20.9 or newer and TypeScript 5.1 or newer.
    `node-too-old`, `typescript-too-old`
22. No synchronous `params`, `searchParams`, `cookies()`, or `headers()` access. Sync access was fully removed in Next.js 16.
    `sync-request-apis`
23. `next/image` uses `preload` rather than the deprecated `priority`, and `preload` appears on at most one image per route.
    `image-priority-deprecated`, `image-preload-overused`
24. Every parallel route slot has a `default.js`.
    `parallel-slot-no-default`
25. `tsconfig.json` sets `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess`, and uses `bundler` or `nodenext` module resolution with no `baseUrl`. Warn, do not fail: this is your config, not ours.
    `tsconfig-strictness`, `tsconfig-module-resolution`, `tsconfig-base-url`
26. `agentblog.config.ts` uses `defineConfig(...)`, not a bare object or `satisfies`, with a real `siteUrl`, a non-empty `brand.sameAs`, and an author roster you have edited.
    `agentblog-config-missing`, `define-config-missing`, `site-url-placeholder`, `same-as-empty`, `seed-authors-unedited`
27. Exactly one module imports `@/agentblog.config`.
    `multiple-config-importers`
28. Theme conformance: no palette utilities, colour literals, or `dark:` colour variants in the installed components, no `registry:base` applied to an existing app, and `--tw-prose-*` bound to tokens with no `hsl()` wrapper. Reported as a warning, since you may have edited the components deliberately.
    `theme-non-conformant`
29. Copy style: no em dashes in the seed posts, the registry `docs` strings, or the `AGENTS.md` block.
    `copy-style`
30. `zod` is absent from every client chunk.
    `server-only-missing`, `client-imports-config`
31. `components.json` is present.
    `components-json-missing`
32. Monorepo disclosure: detect a workspace layout, report where each file landed, link the docs page. Never blocks.
    `monorepo-detected`

`<Bot>` in a live finding id is the crawler name, so a blocked Claude crawler reports as `live-blocked-ClaudeBot`.

### What `--fix` actually repairs

`--fix` touches checks 1, 3, 5, 11, 12, 13, and 20, and nothing else. It never edits a route beyond the `robots.ts` guard, and it never edits your content.

Read this table before re-running `doctor --fix` on a finding that survived the last run. Several checks are partly fixable, which is the case that produces the confusing loop: the fix ran, it repaired one part, and it printed a `Fix:` line that names `doctor --fix` again for the part it declined. The reason it declined is printed once, in the `Declined` list mid-run, and then scrolls past.

| Check                       | `--fix` writes                                                                                                 | It declines when                                                                                                                                                                                                                                                |
| --------------------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 `htmlLimitedBots`         | The union of your current value, the Next.js default list, and the AI crawlers                                 | The key appears twice; an object spread above it could set it; the current value is an identifier, a call, or an interpolated template it cannot read; the union does not compile as a regex                                                                    |
| 3 `metadataBase`            | `new URL(siteUrl)` when absent                                                                                 | `siteUrl` in `agentblog.config.ts` is missing or still `https://yourdomain.com`; the layout has no `export const metadata` object                                                                                                                               |
| 3 `title.template`          | `{ default, template }` when there is no `title` at all, or `template` into an existing `title` object         | **`title` is a plain string.** Converting `title: 'My Site'` into an object is a change to how every page title on your site is composed, and that is an editorial decision. Also declines when `brand.name` is empty, because the template would be `'%s \| '` |
| 3 RSS `alternates.types`    | The `/feed.xml` entry                                                                                          | `alternates` is not an object literal; `alternates.types` is already set                                                                                                                                                                                        |
| 5 robots environment guard  | The guard, as the first statement of the default export                                                        | The default export is not a function body it can edit                                                                                                                                                                                                           |
| 11 `images.qualities`       | The union of your array and the qualities the block uses, deduped and sorted                                   | `images` appears twice; a spread could set it; `images` or `images.qualities` is not a literal                                                                                                                                                                  |
| 12 IndexNow key and file    | `INDEXNOW_KEY` and `AGENTBLOG_REVALIDATE_SECRET` in `.env.local` when missing or empty, and `public/<key>.txt` | A `public/*.txt` counts as a key file only when it contains exactly its own name or `INDEXNOW_KEY` names it, so `llms-full.txt` and `security.txt` are never touched                                                                                            |
| 13 secret in a tracked file | Moves both secrets out of any git-tracked env file into `.env.local`                                           | git cannot answer (not a repository, or git is absent)                                                                                                                                                                                                          |
| 20 `AGENTS.md` block        | The AgentBlog block, placed after the Next.js managed region                                                   | The markers are malformed                                                                                                                                                                                                                                       |

Everything else prints a remedy and stops. Checks 2, 4, 6, 7, 8, 9, 10, 14, and 15 through 32 are reported and never written, and the reasons fall into three groups:

- **It is your code.** Checks 4, 6, 7, 8, 14, 22, 23, and 24 are about route files and render paths. A tool that rewrites a route to satisfy a lint is a tool that breaks a page to pass a check.
- **It is your decision.** Checks 25, 26, and 28 are `tsconfig` strictness, your config values, and components you may have deliberately restyled.
- **It cannot be written.** Checks 9, 10, 15, 16, and 31 are version floors, missing packages, live HTTP responses, and a `components.json` that only `shadcn init` should create.

One known rough edge. The summary line `N of these can be repaired: npx agentblog doctor --fix` counts findings that carry `fixable: true`, which is a property of the finding rather than a prediction about your file. `title-template-missing` is one of them, so a project whose root layout has `title: 'My Site'` as a plain string is told forever that one thing can be repaired, while `--fix` correctly declines to convert it every time. Read the decline reason and make that edit by hand: `title: { default: 'My Site', template: '%s | My Site' }`.

If N never goes down across runs, the answer is in the `Declined` list of the run you already did. Scroll up, or run `doctor --fix --json` and read `fix.declined`.

## audit

```bash
npx agentblog@latest audit [slug] [--dir <path>] [--stale] [--days <n>] [--crawlers <logfile>] [--verbose] [--json]
```

Runs the [pre-publish checklist](/docs/seo-geo-checklist) against one post or all of them. Reports each item pass or fail, and never claims done on a fail.

Every check runs on every post. There is no flag to run a subset, because the checks a writer would switch off are the ones that catch the expensive mistakes. Narrow the input instead: pass a slug, or pass `--dir`.

`--stale` lists posts by `dateModified` age, ranked by inbound internal links, with `--days` setting the threshold (90 by default).

`--crawlers` parses a server or CDN log, verifies each hit against the operators' published IP ranges, and reports hits per bot per week. Vendor user agent strings are trivially spoofed (our own audit skill spoofs GPTBot deliberately), so any count that trusts the UA string is reporting noise.

## new

```bash
npx agentblog@latest new "Do AI crawlers run JavaScript?" [--slug <slug>] [--dir <path>]
                         [--author <slug>] [--category <slug>]
```

Writes `content/blog/do-ai-crawlers-run-javascript.mdx` with complete frontmatter, today's date with an offset, and `draft: true`. It does not write the post. The `write-blog-post` skill does that.

**Pass `--author` and `--category`.** `new` does not read `agentblog.config.ts`, so without them it writes the literal placeholders `author: your-name` and `category: general`, and neither names a record in a fresh install. `draft: true` does not save you: drafts are parsed and validated like any other post and only filtered out afterwards, so the next `next build` fails with `unknown author slug "your-name"`. Name real slugs at the prompt or fix the two lines before you build.

## ping

```bash
npx agentblog@latest ping do-ai-crawlers-run-javascript
```

Fires the revalidate webhook and the IndexNow submission by hand, and prints the IndexNow response code with its meaning attached: 200 submitted, 202 accepted with key validation pending, 400 bad format, 403 key invalid or missing, 422 URL and host mismatch, 429 rate limited. The 403 and 422 cases look identical to success from the caller's side, which is exactly why they are printed.

## Telemetry

Anonymous and opt-out: install count, framework version, chosen adapter, and doctor pass rate. `--no-telemetry` disables it, and `DO_NOT_TRACK` is honoured. Nothing about your content, your URLs, or your configuration values is collected.
