---
title: Monorepo support
description: What works in a workspace today, what we have actually tested, and where the files land.
group: Operations
order: 3
---

Monorepos are supported to the extent shadcn gives it for free. That is a real level of support and it is worth stating precisely rather than generously.

## What works

shadcn already handles workspace layouts: it routes base components to your UI package and blocks to the consuming app, and it rewrites imports accordingly. The requirements are that each workspace has its own `components.json` and that the workspaces agree on `style`, `iconLibrary`, and `baseColor`.

AgentBlog's dependencies on `card`, `badge`, `separator`, `avatar`, and `button` are declared as bare names, so they resolve through your configuration and inherit all of that at no cost to us and no configuration by you.

## Where the files land

| File                                | Destination                                                                    |
| ----------------------------------- | ------------------------------------------------------------------------------ |
| `app/**`, `components/**`, `lib/**` | The app you ran the command in                                                 |
| `components/ui/*`                   | Wherever your `components.json` aliases point, which is often a shared package |
| `agentblog.config.ts`               | A `~/` target, which shadcn resolves to the project root                       |
| `AGENTS.md`                         | Same `~/` target                                                               |
| `.claude/skills/**`                 | Same `~/` target                                                               |

The `~/` prefix means the consumer project root, not `$HOME`. In a workspace, which root it lands in is the genuine unknown, and it is a question we answer by measuring rather than by reading the docs, because getting it wrong scatters the agent layer somewhere nobody looks and it fails silently: the files do get written.

`agentblog doctor` detects a workspace layout, reports where each of those three landed, and links to this page. It never blocks.

```
AgentBlog: pnpm workspace detected.
  agentblog.config.ts   apps/web/agentblog.config.ts
  AGENTS.md             AGENTS.md          (repo root)
  .claude/skills/       .claude/skills/    (repo root)
Verify these are where your tooling expects them.
```

If the split is wrong for your setup, move the files and update the one import in `lib/config.ts`. That is the only place `@/agentblog.config` is read, which is why there is exactly one importer.

## What we have not tested

A monorepo fixture is not in CI yet. It joins when the first database-backed adapter ships, because that is the point at which our users are likely to be in one.

Until then: the mechanism is sound, the disclosure is accurate, and claiming certified monorepo support would be the only real mistake available here. If something lands in the wrong place, please open an issue with your workspace layout. That is more useful to us than a passing test we wrote ourselves.

## Turborepo

Nothing special is required. Add the blog's routes to whatever app owns them and the usual `build`, `lint`, and `typecheck` tasks pick it up.

One thing worth doing: give the content directory an input to the build task so a post edit invalidates the cache.

```json
{
  "tasks": {
    "build": {
      "inputs": ["$TURBO_DEFAULT$", "content/**", "agentblog.config.ts"]
    }
  }
}
```

Without it, Turborepo can serve a cached build that predates your new post, and the symptom is a post that exists in the repository and not on the site.

## This repository is one

`agentblog.dev` runs the block from the registry source with a path alias, so the demo blog and the shipped files are the same modules. That is a stricter arrangement than anything a consumer needs, and it is why drift between the docs and the code is a build error here rather than a discovery later.
