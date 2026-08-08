# AgentBlog

A shadcn registry, a CLI, and a Claude Code plugin that install a production
Next.js blog which AI answer engines can actually read.

The characteristic failure mode of everything in this repository is **silence**.
A broken install compiles, lints, renders perfectly in a browser, and is invisible
to the crawlers the whole product exists for. That is why `scripts/` holds
eighteen assertion gates and why most rules below are absolute rather than
stylistic. When you are unsure whether something works, reach for `curl` and a
script, not a screenshot.

`CONTRIBUTING.md` has the long form of every rule here. `DEPLOYMENT.md` covers
publishing and the Vercel deploy.

## Environment

- pnpm 11, Node 20.9+ (CI runs 22). Never `npm` or `yarn`.
- Install with `pnpm install --frozen-lockfile`. A plain `pnpm install` rewrites
  the lockfile silently, which looks fine locally and stops every CI job at the
  install step.

## Commands

```bash
pnpm codegen                              # after touching any source of truth (rule 2)
pnpm --filter @agentblog/web dev          # the dogfood site; bare `pnpm dev` runs every app
pnpm --filter @agentblog/docs dev         # docs.agentblog.dev, on port 3001
pnpm typecheck && pnpm lint && pnpm test
pnpm format                               # CI runs format:check

pnpm check:static                         # every check that needs no build. Run before pushing.
pnpm --filter @agentblog/web registry:build && pnpm check:registry

pnpm turbo run build --filter=agentblog   # build the CLI
```

Build the CLI through turbo, not `pnpm --filter agentblog build`. tsup bundles
`@agentblog/checks` and `@agentblog/schema` and resolves both through their
`dist`, so a direct filter runs tsup with nothing built and esbuild fails to
resolve them.

Single test file: `node --test packages/cli/src/patchers/patch-set.test.ts`.
`@agentblog/schema` additionally needs `--experimental-strip-types`, and
`@agentblog/web` needs `--import ./tests/alias-hook.mjs`.

## Layout, only the parts you cannot infer

- **`apps/web/registry/**` is the source of truth for every file AgentBlog ships
  into a user's project.** It is authored as if it were already there: same
  `@/components/...` and `@/lib/...` aliases, same directory shape. That is why
  shipped code lives inside the web app instead of in `packages/`.
- **The routes under `apps/web/app/blog/**`, `app/authors/**`, `app/sitemap.ts`
  and friends are thin re-export shims** over that registry source, so the demo
  site is the same modules the registry ships. Edit the registry file, not the
  shim. Route segment config (`export const revalidate`) is the one thing Next.js
  refuses to let you re-export, so it is duplicated in both and has to be kept in
  sync by hand.
- **`apps/docs` is docs.agentblog.dev**, a Fumadocs site whose pages are MDX
  files under `apps/docs/content/docs`. A page's URL is its path, sidebar order
  comes from the `meta.json` beside it, and `title` and `description` are both
  required. `agentblog.dev/docs/*` 301s here, page by page, from
  `apps/web/next.config.ts`.
- `packages/` holds what does not ship as source: `schema` (Zod schemas, inferred
  types, the `ContentSource` contract suite), `checks` (config predicates),
  `cli` (the `agentblog` npm package), plus the shared eslint and tsconfig bases.
- `IMPLEMENTATION.md` and `blog-architecture-guide.md` are gitignored local
  planning documents. Do not commit them, and do not quote them in shipped prose.

## Rules

### 1. Never use an em dash

Not in code comments, docs, registry `docs` strings, seed MDX, CLI output, or
commit messages. Use a comma, a colon, parentheses, or a full stop and a new
sentence. The same pass bans "delve", "leverage", "robust", "seamless",
"landscape", "tapestry", "in today's fast-paced world", the "it's not just X,
it's Y" construction, rhetorical-question-then-answer openers, and three-item
lists where two would do.

The reason is commercial, not aesthetic. The seed posts are the format
specification, so one tell in a seed post is one tell in every post that install
ever produces. `node scripts/assert-copy-style.mjs` enforces it in CI.

### 2. Generated files are generated. YOU MUST NOT edit them in place.

| Generated                                        | Source of truth                        |
| ------------------------------------------------ | -------------------------------------- |
| `apps/web/registry/blog/lib/schemas.ts`          | `packages/schema/src/schemas.ts`       |
| `apps/web/registry/blog/lib/types.ts`            | `packages/schema/src/types.ts`         |
| `apps/web/registry/blog/lib/define-config.ts`    | `packages/schema/src/define-config.ts` |
| `apps/web/registry/blog/lib/preflight-checks.ts` | `packages/checks/src/core.ts`          |
| `plugins/agentblog/skills/**`                    | `apps/web/registry/agent/skills/**`    |

Edit the source, run `pnpm codegen`. CI runs `pnpm codegen:check` and fails on
drift. The skills are a copy rather than a symlink on purpose: Claude Code copies
a plugin directory to a cache location on install, so a symlink pointing outside
that directory ships empty skills, which looks fine locally and breaks only for
users.

### 3. Nothing under `apps/web/registry/blog/**` may import a workspace package

A consumer has no `node_modules/@agentblog/*`, and adding one would contradict
the shadcn model of shipping code rather than packages. ESLint blocks
`@agentblog/*` imports there. Shared code goes through codegen instead.

### 4. `packages/checks/src/core.ts` imports nothing at all

Not zod, not `node:fs`, not a sibling file in its own package. It is copied
verbatim into consumer projects where none of that exists, and it has two callers
that must never disagree: `agentblog doctor` and the consumer's build-time
`lib/preflight.ts`. Everything in it is pure string and RegExp work over content
the caller supplies. Return a finding with a stable `id`: the docs map ids to
remedies, so an id is public API.

### 5. The shipped block styles with semantic tokens only

Allowed inside `apps/web/registry/blog/**`: `bg-background`, `text-foreground`,
`text-muted-foreground`, `bg-card`, `bg-muted`, `bg-primary`, `bg-secondary`,
`bg-accent`, `text-destructive`, `border-border`, `ring-ring`, and the
`--radius`-derived `rounded-*` scale.

Banned: any palette utility (`text-zinc-500`), any colour literal (`#hex`,
`oklch()`), and **any `dark:` colour variant**. The tokens already flip under
`.dark`, so `dark:text-white` re-hardcodes what the token was abstracting. A
component that seems to need a `dark:` colour picked the wrong token. The one
documented exception is anything `ImageResponse` renders, because Satori cannot
read CSS variables: the `opengraph-image.tsx` routes and `lib/og-card.tsx`. The
exempt basenames are listed twice, in `scripts/assert-theme-conformance.mjs` and
in `packages/cli/src/doctor/boundary-checks.ts`, and the two must agree.

### 6. Domain types are inferred, never authored

Every domain type comes from `z.infer`. ESLint rejects `Post`, `Author`,
`Category`, `Citation`, and `FaqEntry` declared as interfaces.

### 7. Zod stays on the server

`lib/schemas.ts`, `lib/define-config.ts`, and `lib/config.ts` begin with
`import 'server-only'`, which turns a client import into a build error rather
than silent bundle growth. Client components receive config values as props from
a server parent.

### 8. Prose that quotes a number is under test

The file count in `README.md`, the landing page, and the docs is asserted against
the registry. Adding one file to a registry item moves that number in three
Markdown files.

### 9. Skill frontmatter stays inside the Agent Skills spec

`apps/web/registry/agent/skills/**` ships to Claude Code, to the plugin, and to
seventy-odd other agents through `npx skills add`. Claude Code accepts a wide
superset of frontmatter keys; the spec at https://agentskills.io accepts six, and
Anthropic's packaging path hard errors on the rest rather than ignoring them. So
a key outside the six is a key that works here and nowhere else.

The only vendor extensions allowed are `argument-hint` and
`disable-model-invocation`. `when_to_use` is banned: Claude Code concatenates it
onto `description` under a shared 1,536-character cap, and the skills CLI lists a
skill by `description` alone, so a trigger phrase written there is invisible in
the directory listing that sells the skill. Put triggers in `description`.

`pnpm check:skills` enforces that, plus `name` matching the directory, the
500-line body budget, reference links resolving one level deep, and the rule that
every `agentblog <command> --flag` a skill tells an agent to run exists in
`packages/cli/src/index.ts`. That last one exists because a skill shipped a
command with four invented flags and nothing noticed.

## Verify the change

Match the check to what you touched. Every script's header comment has its exact
invocation.

| Changed                                            | Run                                                                                |
| -------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `packages/schema` or `packages/checks`             | `pnpm codegen && pnpm typecheck && pnpm test`                                      |
| `apps/web/registry/**`                             | `pnpm check:static`, then `registry:build && pnpm check:registry`                  |
| `apps/docs/content/**`                             | `pnpm check:copy-style && pnpm check:docs-links`                                   |
| `apps/web/registry/agent/skills/**`                | `pnpm check:skills`, then `pnpm codegen`                                           |
| `packages/cli/src/index.ts` command surface        | `pnpm check:skills`, which reads it to validate what the skills tell agents to run |
| `packages/cli/src/patchers/**`                     | `pnpm check:patcher` and `pnpm check:init-refuses`                                 |
| the `next.config` patcher or the bot list          | `node scripts/assert-htmlbots-superset.mjs <path/to/next.config.ts>`               |
| `shadcn-directory-entry.json` or the deploy domain | `node scripts/assert-directory-entry.mjs --live`                                   |
| anything affecting rendered HTML                   | `assert-crawler-visible.mjs`, `assert-og-defaults.mjs`, `assert-cold-slug.mjs`     |

IMPORTANT: `htmlLimitedBots` in `next.config.ts` **overrides** the Next.js
default bot list rather than extending it. A patch that writes only the AI
crawlers silently drops Googlebot, Bingbot, Applebot, and every social preview
bot from HTML-limited treatment. That fixes AI search by breaking classic SEO,
and a snapshot test on the AI bots alone passes while it happens.

`agentblog init` must be idempotent. A second run against the same project
produces no diff.

## Behaviours that look like bugs and are not

- `apps/web/CLAUDE.md` contains only an import of its `AGENTS.md`, and that file's
  marked block is rewritten by `next dev`. Commit it with your work rather than
  reverting it; reverting only recreates the uncommitted change.
- Next.js merges metadata shallowly. A page that sets `openGraph` at all replaces
  its parent's entire object, silently dropping `og:site_name` and `max-snippet`.
  Invisible to the type checker, which is why it is asserted against built HTML.
- `sitemap.xml` and `feed.xml` are cached route handlers, and
  `generateStaticParams` does not re-run during ISR. A publish path has to
  revalidate them explicitly or a new post reaches IndexNow before it reaches our
  own sitemap.
- `apps/web/tsconfig.json` maps `@/*` to `./registry/blog/*` first, and lists
  `@/agentblog.config` as an exact match before the wildcard so the demo site
  renders its real config rather than the registry's placeholder template.
- `next build` no longer runs ESLint in Next.js 16, and `next lint` is gone. Lint
  is always an explicit step, including for the installed files in the fixture.

## Commits and releases

- Conventional commits are appreciated, not enforced.
- Add a changeset (`pnpm changeset`) in the same PR as any user-visible change.
- Merging to `main` publishes nothing. Merging the "Version Packages" PR does.
- Commit or push only when asked.
