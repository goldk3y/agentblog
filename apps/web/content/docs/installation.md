---
title: Installation
description: Both ways to install AgentBlog, the four files you edit afterwards, and what the registry path leaves for you to finish.
group: Getting started
order: 2
---

**Before you start: `https://agentblog.dev/r/{name}.json` is not serving yet.** Every registry URL and every `@agentblog/*` namespace command on this page describes the shape of the install, not a host you can fetch from today. Until the host is live, the only way to install is [from a local checkout](#installing-from-a-local-checkout), and that path is for evaluating AgentBlog, not for using it in a project you ship. The GitHub shorthand below (`npx shadcn@latest add agentblog/agentblog/blog`) becomes the recommended path the moment the repository is public, because it needs no `components.json` change at all. This banner comes down when the host is live.

## Quickstart

Two commands, then four files you edit. The commands are ours and the edits are yours, and that split is the whole design: everything that is a decision about your site is a decision you make.

```bash
npx shadcn@latest add @agentblog/blog     # writes the files
npx agentblog@latest doctor --fix         # wires up what a registry cannot reach
```

The four edits, in the order they are needed:

| #   | File                   | Edit                                                                                                                                                                                                    |
| --- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `components.json`      | Add the `@agentblog` namespace under `registries`. Both `shadcn add` and `agentblog init` fetch through it, so this comes before either command                                                         |
| 2   | `app/globals.css`      | `@import '../styles/agentblog.css';`, **after** the Tailwind import. Nothing else loads that file and nothing errors if you skip it. See [The one line](#the-one-line-nothing-will-tell-you-about)      |
| 3   | `agentblog.config.ts`  | `siteUrl`, `brand.name`, `brand.logo`, `brand.sameAs`, and `defaultAuthor`. Read the comments in the file: each field says what breaks when it is wrong                                                 |
| 4   | `content/authors.json` | Put yourself in it. Keep the `editorial` slug or change it in the seed posts too, or the next build fails. See [Editing the seed content](/docs/troubleshooting#the-build-fails-after-i-edited-content) |

Edit 1 comes before either command, because both resolve the namespace out of `components.json`. Edits 2, 3, and 4 come after.

`npx agentblog@latest init` replaces both commands with one prompt-driven run and does edit 3 for you from the answers you give it. It cannot do 1, 2, or 4: the namespace has to exist before it can call `shadcn add`, the stylesheet import is a line in a file you own, and nobody can write your author record but you.

Then verify:

```bash
npx agentblog@latest doctor
```

## The two entry points

They are not a fork and they converge on the same end state.

```bash
npx agentblog@latest init                 # one command, complete
npx shadcn@latest add @agentblog/blog     # files only, config left to you
```

`agentblog init` calls `shadcn add` internally. The registry is not an alternative to the CLI, it is the CLI's file delivery mechanism. So the question is not which one is real, it is whether you want the config patching done for you.

## The CLI path

```bash
npx agentblog@latest init
```

In order, it:

1. **Verifies the stack.** Next.js 16.3 or newer on the App Router, React 19, Tailwind v4, and a `components.json`. If any is missing it refuses and tells you the command to run. It will not run `shadcn init` on your behalf, because that picks a component base and a base colour and writes CSS variables into your stylesheet, which is choosing a design system for you.
2. **Detects your layout.** `src/` versus root, package manager, monorepo, and any pre-existing `app/blog/**`. A blog you already wrote is a refusal, not an overwrite. `--force` proceeds.
3. **Prompts** for content source, site URL, brand name, and default author.
4. **Runs `shadcn add`** for `@agentblog/blog` and your chosen source item. This resolves through the `@agentblog` namespace in your `components.json`, so that entry has to be there already.
5. **Patches `next.config.ts`**: `htmlLimitedBots`, `images.qualities`, `images.remotePatterns`.
6. **Patches `app/layout.tsx`**: `metadataBase`, `title.template` with `title.default`, the RSS entry under `alternates.types`, and the sitewide Organization and WebSite JSON-LD.
7. **Writes** `agentblog.config.ts`, additions to `.env.local`, and the IndexNow key file in `public/`.
8. **Writes** the `AGENTS.md` block and `.claude/skills/*`.
9. **Runs `agentblog doctor`** and prints the result.

Patching uses [ts-morph](https://ts-morph.com/) for AST-safe edits, never regex. Every file it is about to modify is copied to `.agentblog/backup/<timestamp>/` first, and `--dry-run` prints the unified diff without touching anything. `agentblog revert` restores the last backup. `agentblog uninstall` reverses the config patches, removes the `AGENTS.md` block, and lists the registry-written files for you to delete.

Running `init` twice is a no-op. The merge semantics per patch site are in the [CLI reference](/docs/cli-reference).

`init` still leaves you the stylesheet import and the author record. It does not write CSS into a file you own, and it will not invent a bio.

## The registry path

Add the namespace to `components.json`:

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "registries": {
    "@agentblog": "https://agentblog.dev/r/{name}.json"
  }
}
```

Then:

```bash
npx shadcn@latest add @agentblog/blog
```

What this buys you over the CLI:

- **You can read it first.** `https://agentblog.dev/r/blog.json` is inspectable JSON fetched by a binary you already trust, and `--dry-run` works. `npx agentblog init` is an unknown binary that rewrites `next.config.ts`. Read the trust note below before deciding that settles it.
- **Partial installs.** `@agentblog/blog-schema` gives you the JSON-LD builders alone. `@agentblog/blog-ui` gives you the components. `init` is all or nothing.
- **Updates.** `shadcn add <item> --diff` shows what changed upstream without writing anything. See [Taking an update](/docs/upgrading).

### What adding a registry actually authorises

Being straight about this, because the bullet above is easy to over-read.

A registry URL is a code delivery channel. Adding `@agentblog` to
`components.json` authorises `shadcn add` to fetch source files, npm
dependencies, and CSS variables from `agentblog.dev` and write them into your
application, every time you run it. There is no lockfile for a registry, no
integrity hash, and no review step unless you ask for one.

That is the same amount of trust you extend to an npm publisher, delivered over
the wire at install time rather than pinned in a lockfile. So the honest version
of the comparison is: the registry path lets you read the payload before you
accept it and lets you take updates one diff at a time, and the CLI path gives
you backups and a `revert`. Neither removes the need to trust us.

Two things that genuinely reduce your exposure:

- `npx shadcn@latest add @agentblog/blog --dry-run` prints every file it would
  write before it writes anything.
- `npx shadcn@latest add <item> --diff` shows what changed upstream before you
  accept an update, which is the mechanism described in
  [Taking an update](/docs/upgrading).

Pinning a GitHub ref (`agentblog/agentblog/blog#v1.2.0`) pins the GitHub path.
It does not pin the `agentblog.dev` URL, which always serves current.

You can also install straight from GitHub with no namespace configuration, including a pinned ref:

```bash
npx shadcn@latest add agentblog/agentblog/blog
npx shadcn@latest add agentblog/agentblog/blog#v1.2.0
```

## Installing from a local checkout

This is how to evaluate AgentBlog while the host is not serving. It is not a normal install: you are pointing your project at a registry running on your own machine, so it works for a scratch app you are trying this in and not for anything you deploy.

The `registries` map in `components.json` takes a URL and only a URL. A relative path is joined onto the default registry origin and 404s, and a `file://` URL is rejected with "not implemented yet". So the checkout has to serve HTTP, which is what `scripts/serve-registry.mjs` in this repository is for.

From a clone of `agentblog/agentblog`:

```bash
cd apps/web && npx shadcn build --output public/r
```

Then, from the repository root, in a second terminal:

```bash
node scripts/serve-registry.mjs
```

It serves `apps/web/public` on `http://127.0.0.1:4477` and prints the directory it is serving. Pass `--port` to move it.

In the project you are installing into, point the namespace at it:

```json
{
  "registries": {
    "@agentblog": "http://127.0.0.1:4477/r/{name}.json"
  }
}
```

`npx shadcn@latest add @agentblog/blog` now resolves against your own machine. Everything else on this page is unchanged, including `doctor --fix` and the four edits.

Two things to know. `shadcn build` reads the registry source, so re-run it after any change to `apps/web/registry/**` or the served JSON is stale. And this exercises the real code path rather than a shortcut: URL resolution, the `{name}` substitution, and cross-item `registryDependencies` fetching all run exactly as they will against the live host.

## What the registry path leaves undone

A shadcn registry can write files, install npm dependencies, merge CSS variables, and add environment variable entries. It has no `patch` step, no `postinstall`, and no `scripts` field. So it cannot edit your existing `next.config.ts`, and it cannot add an import line to your existing stylesheet.

Two things are left, and they fail in opposite ways.

### `htmlLimitedBots` in `next.config.ts`

Without it, Next.js streams metadata into `<body>` on any page that renders dynamically, for every user agent not on its built-in bot list. GPTBot, ClaudeBot, OAI-SearchBot, and PerplexityBot are not on that list. You get a blog that looks completely correct and serves its `<title>` in the wrong element to the crawlers you installed this for.

Finish it with:

```bash
npx agentblog@latest doctor --fix
```

Four independent things will tell you if you forget:

1. `lib/preflight.ts`, imported by `app/blog/layout.tsx`, reads `next.config.*` off disk on every `next dev` and every build and warns by name.
2. The registry item's `docs` string prints during install.
3. The `agentblog-setup` skill lets a coding agent finish the wiring without being asked.
4. The `AGENTS.md` block says the same thing to every agent tool that reads it.

Given how quiet the underlying failure is, four redundant paths is proportionate.

### The one line nothing will tell you about

The block installs `styles/agentblog.css`, and **nothing imports it for you**. Add this to your global stylesheet, after the Tailwind import:

```css
@import 'tailwindcss';
@import '../styles/agentblog.css';
```

The registry writes the file to `styles/agentblog.css` at your project root, so the import path depends on where your stylesheet is. From `app/globals.css` it is `../styles/agentblog.css`. From `src/app/globals.css` it is `../../styles/agentblog.css`.

That file binds article typography to your theme tokens and loads `@tailwindcss/typography`, which was installed for you as a dependency. Skip it and the blog builds, renders, passes `doctor`, and serves article prose with no typography at all: correct HTML, correct structured data, unstyled body text. No error, no warning, no finding.

This is the one wiring step with zero redundant channels, against four for `htmlLimitedBots`, and the difference is not proportionate to the failure. The only place it appears during an install is the `docs` string that `shadcn add` prints, in the middle of ninety lines of file paths. So check it yourself: if `/blog/<a-post>` renders in one undifferentiated font size with no visible heading hierarchy, this is why.

## Verify the install

```bash
npx agentblog@latest doctor
```

Then, once deployed, the check that matters most:

```bash
npx agentblog@latest doctor --url https://yoursite.com/blog/your-post
```

That one fetches your live URL as GPTBot, ClaudeBot, PerplexityBot, OAI-SearchBot, and Googlebot, and asserts a 200 with body text present. It is the only check that catches a correct install sitting behind a CDN that blocks the crawlers. See [When your CDN blocks crawlers](/docs/troubleshooting-cdn).

Run it from CI or from your own machine, not from inside the deployment. The fetch originates wherever the CLI runs, and a request from inside the network can bypass the exact CDN rule you are testing for, which turns the most valuable check in the product into a check that always passes.

And the check that needs no tooling at all:

```bash
curl -s -A "GPTBot" https://yoursite.com/blog/your-post | grep "a distinctive sentence"
```

If that sentence is not in the raw response, no AI crawler can see it. Use view source, not the DevTools element inspector, which shows you the DOM after JavaScript has run.
