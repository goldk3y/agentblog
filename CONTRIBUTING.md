# Contributing to AgentBlog

Thanks for helping. This document covers how the repository is laid out, how to
run it, and the handful of rules that are stricter than you might expect. The
strict ones exist because this project's characteristic failure mode is silence:
almost everything that can go wrong here produces a blog that looks perfect and
is invisible to the crawlers it was built for.

## Requirements

- Node 20.9 or newer (CI runs 22)
- pnpm 11
- Git

## Getting started

```bash
pnpm install
pnpm codegen        # write the generated files
pnpm typecheck
pnpm test
pnpm --filter @agentblog/web dev     # agentblog.dev, on :3000
pnpm --filter @agentblog/docs dev    # docs.agentblog.dev, on :3001
```

`pnpm dev` at the root runs every app. Most of the time you want one of the
filtered commands above.

## How the repository is organised

```
apps/
  web/                 agentblog.dev: landing page, registry host, demo blog
    registry/          THE SOURCE OF TRUTH for every file AgentBlog ships
  docs/                docs.agentblog.dev: the documentation, built with Fumadocs
    content/docs/      every page, as MDX. URLs come from the file paths
  fixture-next16/      clean Next.js 16 app, the end to end install target
  fixture-no-shadcn/   Tailwind without components.json, where init must refuse
packages/
  schema/              Zod schemas, inferred types, ContentSource, contract suite
  checks/              dependency free config predicates and the vendored bot list
  cli/                 the `agentblog` npm package
  eslint-config/       shared flat config
  typescript-config/   shared tsconfig bases
plugins/agentblog/     Claude Code plugin (skills copied in by codegen)
scripts/               codegen and the CI assertion gates
```

### Two structural rules that matter more than they look

**1. `apps/web/registry/**` is authored as if it were already in a user's
project.** Same `@/components/...` and `@/lib/...` aliases, same directory
shape. The shadcn CLI rewrites aliases on install; if the source is authored any
other way, every install produces subtly broken imports. This is why the shipped
code lives inside the web app rather than in `packages/`.

**2. The demo blog at `/blog` imports the same modules the registry ships.** Not
a copy. `apps/web/tsconfig.json` maps `@/*` into `registry/blog/*` first, and the
route files under `apps/web/app/blog/**` are thin re-export shims. If the demo
could drift from the shipped code, we would be shipping untested code and would
not know.

## The rules

### Never use an em dash

Not in code comments, not in docs, not in copy, not in registry `docs` strings,
not in seed content, not in CLI output. Use a comma, a colon, parentheses, or a
full stop and a new sentence.

The reason is commercial rather than aesthetic. The em dash has become the most
recognisable tell of machine-written prose. AgentBlog sells AI-assisted writing
that gets cited, so shipping copy that reads as machine-written undermines the
thing we are selling. The seed posts are the format specification, and every post
written from that template inherits whatever tells it contains.

The same pass bans: "delve", "leverage", "robust", "seamless", "landscape",
"tapestry", "in today's fast-paced world", the "it's not just X, it's Y"
construction, rhetorical-question-then-answer paragraph openers, and three-item
lists where two items would do.

`node scripts/assert-copy-style.mjs` enforces this, and it runs in CI. A style
guide nobody can run is a style guide nobody follows.

### The shipped block styles with semantic tokens only

Inside `apps/web/registry/blog/**`:

- Allowed: `bg-background`, `text-foreground`, `text-muted-foreground`,
  `bg-card`, `text-card-foreground`, `bg-muted`, `bg-primary`,
  `text-primary-foreground`, `bg-secondary`, `bg-accent`, `text-destructive`,
  `border-border`, `ring-ring`, and the `--radius`-derived `rounded-*` scale.
- Banned: any palette utility (`text-zinc-500`, `bg-gray-100`), any colour
  literal (`#hex`, `rgb()`, `hsl()`, `oklch()`), and **any `dark:` colour
  variant**.

The `dark:` ban catches people. The tokens already flip under `.dark`, so
`dark:text-white` re-hardcodes exactly what the token was there to abstract, and
it breaks the moment a user's dark theme is not near-black. If a component seems
to need a `dark:` colour, it picked the wrong token.

The one documented exception is anything rendered by `ImageResponse`, which
cannot read CSS variables: the `opengraph-image.tsx` routes and `lib/og-card.tsx`,
where they keep the card layout they share.
`scripts/assert-theme-conformance.mjs` encodes the exception explicitly, as a
list of basenames, and `packages/cli/src/doctor/boundary-checks.ts` carries the
same list because `doctor` runs the same rule against an installed project.

The product reason these rules are absolute is on the
[Theming](https://docs.agentblog.dev/guides/match-your-design) page.

### Breadcrumb trails carry paths, never absolute URLs

A route builds one trail array and passes it to both `<Breadcrumbs>` and
`buildBreadcrumb`. The crumbs hold root-relative paths, and `buildBreadcrumb` is
the one place they are absolutized, because `BreadcrumbList.item` needs an
absolute URL and an `href` needs a relative one. Put the absolute form in the
trail and `next/link` stops recognising the destination as local on every origin
that is not the configured `siteUrl`, which means every preview deployment and
every dev server sends readers to production.

### The shipped block imports no workspace package

Files under `apps/web/registry/blog/**` may depend on packages declared on their
registry item and on nothing from this workspace. A consumer has no
`node_modules/@agentblog/schema` to import from, and adding one would contradict
the shadcn model of shipping code rather than packages.

Shared code is handled by codegen instead. See below.

### Generated files are generated

Four files are copied verbatim by `scripts/codegen.mjs` and must never be edited
in place:

| Generated                                        | Source of truth                        |
| ------------------------------------------------ | -------------------------------------- |
| `apps/web/registry/blog/lib/schemas.ts`          | `packages/schema/src/schemas.ts`       |
| `apps/web/registry/blog/lib/types.ts`            | `packages/schema/src/types.ts`         |
| `apps/web/registry/blog/lib/define-config.ts`    | `packages/schema/src/define-config.ts` |
| `apps/web/registry/blog/lib/preflight-checks.ts` | `packages/checks/src/core.ts`          |

Plus `plugins/agentblog/skills/**`, copied from
`apps/web/registry/agent/skills/**`.

That last one is a copy rather than a symlink for a specific reason: Claude Code
copies a plugin directory to a cache location on install, so a symlink pointing
outside the plugin directory ships empty skills. It would look fine locally and
break only for users.

Run `pnpm codegen` after touching any source of truth. CI runs
`pnpm codegen:check` and fails on drift.

### packages/checks, and why it has no dependencies

`packages/checks/src/core.ts` holds every configuration predicate: the
`htmlLimitedBots` analyzer, the `images.qualities` check, the `metadataBase` and
`title.template` checks, the `cacheComponents` check. Two very different callers
read it, and they must never disagree.

- `agentblog doctor` runs from `packages/cli`, in a Node process with a full
  `node_modules`.
- `lib/preflight.ts` runs inside the **consumer's** app at build time, with only
  the files the registry wrote and no `@agentblog/*` package anywhere.

The second caller is why the file cannot import anything. Not `zod`, not
`node:fs`, not a sibling file in its own package. Everything in it is pure string
and RegExp work over file contents the caller supplies, and the caller decides
whether to warn, throw, or fix. `codegen.mjs` copies it verbatim to
`apps/web/registry/blog/lib/preflight-checks.ts`, and `pnpm codegen:check` fails
on drift.

The alternative was two implementations of the same predicates, one in the CLI
and one shipped into user projects. They would diverge, and the symptom would be
`doctor` and `next build` telling a user two different things about the same
`next.config.ts`. A verbatim copy plus a drift check buys the single source of
truth that an import cannot.

If you add a predicate: put it in `core.ts`, keep it pure, return a finding with
a stable `id`, and run `pnpm codegen`. The `id` is what the docs map to a remedy,
so treat it as public API and do not rename one casually.

### Domain types are inferred, never authored

Every domain type comes from `z.infer` on a Zod schema. There is no
`interface Post` anywhere, and ESLint rejects one. A validator and a parallel
interface always drift, and here they would drift between what we validate and
what we type.

### Zod stays on the server

`lib/schemas.ts`, `lib/define-config.ts`, and `lib/config.ts` all begin with
`import 'server-only'`, which turns a client import into a build error rather
than silent bundle growth. Client components receive config values as props from
server parents. `scripts/assert-no-server-only-in-client.mjs` catches
regressions before the bundler does, so the message is comprehensible.

## Writing documentation

The docs are their own Next.js app, `apps/docs`, deployed to
`docs.agentblog.dev` and built with [Fumadocs](https://fumadocs.dev).

- **A page is one MDX file under `apps/docs/content/docs`.** Its URL is its
  path: `reference/cli.mdx` is served at `/reference/cli`. There is no route to
  add and no index to update.
- **`title` and `description` are both required.** The description is the meta
  description, the sidebar subtitle, and the one line the page contributes to
  `llms.txt`, so a missing one fails the build rather than rendering empty.
- **Sidebar order comes from `meta.json`.** The root file lists the sections and
  pulls each folder's pages in with `...folder`, so a new page needs its name
  added to the `meta.json` beside it.
- **MDX content carries no `className`.** Tailwind does not scan the content
  directory, because a page that quotes a class name in backticks would
  otherwise generate that class for real. Everything a page needs is a component
  from `components/mdx.tsx`.
- **The copy style rules apply.** The docs are scanned by
  `assert-copy-style.mjs` exactly like the seed posts.
- **Internal links are checked.** `node scripts/assert-docs-links.mjs` resolves
  every internal link and every `#anchor` against the real page tree.

The documentation prose is CC BY 4.0 rather than MIT. See
[Licensing](https://docs.agentblog.dev/project/licensing).

## The checks that exist because the failure is silent

There are fifteen of them. You will meet the ones you break in CI, so it is
cheaper to meet them here.

### The ones you can run on a clean checkout

These need no build and no fixture. Run them before you push.

```bash
pnpm check:static          # runs all of the below
pnpm check:lockfile        # pnpm install --frozen-lockfile
pnpm check:copy-style      # node scripts/assert-copy-style.mjs
pnpm check:theme           # node scripts/assert-theme-conformance.mjs
pnpm check:client-imports  # node scripts/assert-no-server-only-in-client.mjs
pnpm check:html-bots       # assert-html-bots-current.mjs + the docs app's own config
pnpm check:docs-links      # node scripts/assert-docs-links.mjs
pnpm check:directory-entry # node scripts/assert-directory-entry.mjs
node scripts/assert-file-count.mjs
```

`check:lockfile` is the one that is easy to skip and the one CI fails on first.
A plain `pnpm install` updates the lockfile silently, so a dependency added or
removed during local testing looks fine on your machine and stops every CI job
at the install step. `--frozen-lockfile` is what CI runs, so run it too.

### The ones that need the registry built

```bash
pnpm --filter @agentblog/web registry:build
pnpm check:registry        # assert-catalog-shape.mjs + assert-schema-valid.mjs
```

### The ones that need a fixture

```bash
pnpm check:patcher         # ts-morph output identical under TypeScript 6 and 7
pnpm check:init-refuses    # init refuses apps/fixture-no-shadcn and says why
```

### The ones that need a running or built fixture app

These take arguments and CI supplies them. The header comment in each script has
the exact invocation.

| Script                         | Asserts                                                             |
| ------------------------------ | ------------------------------------------------------------------- |
| `assert-crawler-visible.mjs`   | A non-JavaScript crawler receives a complete page                   |
| `assert-og-defaults.mjs`       | The shared metadata defaults survive into a built post's HTML       |
| `assert-cold-slug.mjs`         | A post published without a rebuild reaches the sitemap and the feed |
| `assert-htmlbots-superset.mjs` | A patched `next.config.*` keeps every bot it is supposed to keep    |
| `assert-agents-md.mjs`         | Our `AGENTS.md` block sits outside the region Next.js manages       |
| `assert-src-layout-builds.mjs` | A `src/` layout project installs, repairs, and builds               |

### Three that deserve particular attention

- **`assert-htmlbots-superset.mjs`.** Setting `htmlLimitedBots` in
  `next.config.ts` _overrides_ the Next.js default bot list rather than
  extending it. A patch that writes only the AI crawlers silently drops
  Googlebot, Bingbot, Applebot, Twitterbot, LinkedInBot, Slackbot, Discordbot,
  facebookexternalhit, and WhatsApp from HTML-limited treatment. That fixes AI
  search by breaking classic SEO and every social preview card. A snapshot test
  on the AI bots alone would pass while it happened.
- **`assert-cold-slug.mjs`.** `sitemap.xml` and `feed.xml` are cached route
  handlers, and `generateStaticParams` does not re-run during ISR. A publish
  webhook that revalidates only the page routes leaves a new post out of both
  files until the next deploy, and then pings IndexNow about a URL our own
  sitemap does not list.
- **`assert-og-defaults.mjs`.** Next.js merges metadata shallowly, so a page that
  sets `openGraph` at all replaces its parent's entire object. That silently
  drops `og:site_name` and `max-snippet`. It is invisible to the type checker
  and to every schema validator, which is why it is asserted against built HTML.

## Adding a content source adapter

1. Implement `ContentSource` from `packages/schema/src/types.ts`. Read the
   purity rule at the top of that file first.
2. Point `runSourceContractTests` from `@agentblog/schema/contract` at your
   factory. All eight assertions must pass.
3. Declare a `prerenderStrategy`. If it is `'deploy-hook'`, the config type will
   require the user to supply a rebuild trigger, which is the compile-time
   version of a failure that is otherwise a silent staleness bug.
4. Add a registry item and a docs page.

## The shadcn registry directory

`@agentblog` resolves for a stranger only because the namespace is listed in the
[open source registry index](https://ui.shadcn.com/docs/registry/registry-index).
Without the listing, `shadcn add @agentblog/blog` fails with "Unknown registry"
unless the user has already written the URL into their own `components.json`, so
the listing is what every discovery claim in the README rests on.

`shadcn-directory-entry.json` is the exact object submitted, kept in this
repository so it can be diffed and tested rather than remembered. To submit or
update it:

1. `node scripts/assert-directory-entry.mjs --live`, which checks the entry
   against the directory's own schema, against `registry.json`, and against the
   deployment it advertises.
2. Paste the object into
   [`apps/v4/registry/directory.json`](https://github.com/shadcn-ui/ui/blob/main/apps/v4/registry/directory.json)
   in a fork of `shadcn-ui/ui`, in alphabetical order by `name`.
3. `pnpm validate:registries` there, then open the pull request.

Their validator reads five fields and nothing else, so an extra key is a field
that never arrives. The requirements it does not check are the ones worth
re-reading before submitting: the registry has to be open source and publicly
reachable, conform to the registry schema, and be flat, meaning `/registry.json`
and every `/item-name.json` sit at the same root. `assert-catalog-shape.mjs` and
`assert-schema-valid.mjs` cover those against the built output.

Anything that changes where the registry is served, the deploy domain or the
`shadcn build` output path, means editing the entry and opening a second pull
request. Nothing upstream notices on its own, and the failure is a 404 on
somebody else's machine.

## Wanted

Three CI jobs are specified and not built. Each is self-contained, each closes a
claim the docs currently have to hedge, and each is a good first contribution.

**A theme inheritance snapshot job.** `scripts/assert-theme-conformance.mjs`
catches the cause of a broken inheritance (a palette utility, a colour literal, a
`dark:` variant). Nothing catches the effect. The job wants a second fixture with
a custom `baseColor`, a large `--radius`, and a serif font, built alongside
`apps/fixture-next16`, with both blog index pages snapshotted and an assertion
that the two snapshots differ. If they do not differ, inheritance is broken
somewhere the lint cannot see. Land it as `scripts/assert-theme-inheritance.mjs`.

**Lighthouse CI against the built fixture.** LCP under 2.5s, INP under 200ms, CLS
under 0.1. The block is server-rendered with almost no client JavaScript, so the
budget should be easy to hold and the value is in noticing the day it stops being
easy.

**`claude plugin validate` on the plugin.** It checks the manifest and the
marketplace entry and rejects a `renames` chain that cycles or fails to
terminate. It needs `.claude-plugin/marketplace.json` and the copied skills both
in place, which they now are.

## Commits and releases

Conventional commits are appreciated but not enforced. Releases use
[changesets](https://github.com/changesets/changesets):

```bash
pnpm changeset
```

Add a changeset in the same PR as a user-visible change.

Merging to `main` publishes nothing on its own. The release workflow opens a
"Version Packages" PR, and merging that PR is what publishes. Maintainers
setting up or debugging the publish and the Vercel deploy should read
[DEPLOYMENT.md](./DEPLOYMENT.md).

## Filing issues

The most useful bug report for this project includes the output of:

```bash
npx agentblog doctor --url https://your-live-site.example/blog/some-post
curl -s -A "GPTBot" https://your-live-site.example/blog/some-post | head -c 2000
```

Those two commands answer most of what we would otherwise ask you.

## Licensing of contributions

Code contributions are MIT. Documentation and playbook prose are CC BY 4.0. Seed
content is CC0. See `LICENSE`, `LICENSE-CONTENT`, and `LICENSE-SEED`.
