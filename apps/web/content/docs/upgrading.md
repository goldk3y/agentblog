---
title: Taking an update
description: How to pull a registry fix into an install you have already edited, using shadcn add --diff and --overwrite, without losing your changes.
group: Getting started
order: 3
---

The files are yours. That is the whole pitch, and it has a cost: there is no `npm update` that carries a fix from us into your repository, because there is no package of ours in your dependency tree. Updating is a deliberate act, and it is a three-command act.

```bash
npx shadcn@latest add @agentblog/blog --diff             # what changed upstream
npx shadcn@latest add @agentblog/blog-schema --overwrite # take one part of it
npx agentblog@latest doctor                              # confirm nothing broke
```

## Read the diff before you take anything

```bash
npx shadcn@latest add @agentblog/blog --diff
```

`--diff` fetches the current registry item and prints the difference against what is on your disk, without writing anything. Pass a path to narrow it to one file, and use `--view <path>` to print the upstream file on its own.

Read it as three categories:

| What the diff shows                                     | What to do                                                                      |
| ------------------------------------------------------- | ------------------------------------------------------------------------------- |
| A file you never touched, changed upstream              | Take it with `--overwrite`                                                      |
| A file you edited, changed upstream in a different part | Copy the upstream change in by hand. This is the only case that needs judgement |
| A file you edited, changed upstream in the same part    | Read both, decide, and keep a note of why in a comment                          |

The second and third cases are why `--overwrite` is not the first command on this page. `shadcn add` will not overwrite an existing file unless you ask, which is the behaviour that lets your customized `PostCard` survive an install in the first place.

## Take a change

```bash
npx shadcn@latest add @agentblog/blog --overwrite       # everything
npx shadcn@latest add @agentblog/blog-schema --overwrite # one item
```

`--overwrite` replaces the files the item declares. There is no per-file flag, so narrow by item rather than by file: the registry is split into `@agentblog/blog-schema`, `@agentblog/blog-ui`, `@agentblog/blog-routes`, `@agentblog/seo-routes`, `@agentblog/mdx-components`, `@agentblog/publish-webhook`, `@agentblog/eeat-pages`, `@agentblog/source-mdx`, and `@agentblog/agent-kit` precisely so you can take one part of an update without taking all of it.

Commit before you do this. `shadcn add --overwrite` does not back anything up; it is your version control that makes this reversible. `--dry-run` prints what it would write if you want one more look first.

## The four generated files are the safe ones

`lib/schemas.ts`, `lib/types.ts`, `lib/define-config.ts`, and `lib/preflight-checks.ts` carry a banner saying they are generated. Nobody should have edited them, so they are always safe to overwrite, and they are the files most likely to carry a real fix: a schema correction, a new configuration predicate, a new bot in the vendored list.

If a diff on one of those shows local changes, that is the finding. Something edited a generated file, and whatever it was will be undone the next time anyone runs codegen upstream.

## What the CLI updates separately

`shadcn add` only writes files. The two config files live outside the block and the CLI owns them:

```bash
npx agentblog@latest doctor --fix
```

This is also how a new `htmlLimitedBots` entry reaches you. When Next.js adds a bot to its default list, the fix is a wider pattern in `next.config.ts`, not a changed component, so no amount of `--overwrite` will deliver it. `doctor` reports `html-limited-bots-incomplete` and `--fix` unions the missing bots in.

Every file `doctor --fix` touches is copied to `.agentblog/backup/<timestamp>/` first, `--dry-run` prints the unified diff, and `agentblog revert` restores the last backup.

## Then verify

```bash
npx agentblog@latest doctor
npx agentblog@latest audit
npx agentblog@latest doctor --url https://yoursite.com/blog/your-post
```

The third one runs against your deployment, so run it after you ship rather than before. Run it from CI or from your own machine rather than from inside the deployment; see [Installation](/docs/installation#verify-the-install) for why that matters.

## A note on pinning

You can pin the GitHub install path to a ref:

```bash
npx shadcn@latest add agentblog/agentblog/blog#v1.2.0
```

That gives you a reproducible fetch, which is useful in a script. It does not give you an upgrade path, because nothing tracks which ref you installed. If you want to know what you have, record the ref in a comment in `agentblog.config.ts` when you install. `.agentblog/manifest.json` records which files AgentBlog wrote, so `doctor` can tell our files from yours, but it is written by the CLI and not by `shadcn add`.
