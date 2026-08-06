# fixture-next16

A clean Next.js 16 app with Tailwind v4 and shadcn configured, and nothing else.
It is the end to end install target: CI builds the registry, installs it here,
runs the CLI against it, builds the result, starts it, and asserts what a crawler
receives.

Every other check in this repository tests a part. This one tests whether the
parts add up to a project that compiles. A registry can validate against every
schema, pass `shadcn registry validate`, and still produce files that do not
build together, and there is no way to find that out except by installing them
into a real app.

## Do not "fix" the two deliberate omissions

`next.config.ts` has no `htmlLimitedBots` and no `images.qualities`.
`app/layout.tsx` has no `metadataBase` and no `title.template`.

Those four are missing on purpose, and each file says so at the top. They are
what `agentblog doctor --fix` writes. Adding them by hand does not fail anything:

- The preflight gate builds the fixture after a registry-only install and greps
  the log for `htmlLimitedBots`. With the key already set, `lib/preflight.ts` has
  nothing to warn about, the grep finds nothing, and the job reports a missing
  warning as though preflight had regressed.
- `scripts/assert-htmlbots-superset.mjs` then reads the patched config and checks
  the regex covers the Next.js default bot list as well as the AI crawlers. With
  the key already set, the patcher writes nothing and the assertion passes
  against a hand-typed value rather than against the patcher's output. That is
  the check standing between us and a `doctor --fix` that quietly drops Googlebot
  from HTML-limited treatment.

So both gates go green while testing nothing. If you are looking at this fixture
because a config lint flagged it, the lint is working.

`agentRules: false` in `next.config.ts` is the third deliberate setting. Next.js
16.3 writes `AGENTS.md` and `CLAUDE.md` on `next dev`, and
`scripts/assert-agents-md.mjs` reads those two files to prove the CLI puts its
block after Next's END marker and never writes `CLAUDE.md` at all. With Next
generating them too, the result depends on whether a dev server ran first.

## What CI does with it

1. `shadcn add ../web/public/r/blog.json --overwrite`, from the local build
   output rather than agentblog.dev, so the job tests the commit under review.
   `components.json` points `@agentblog` at that same relative path.
2. `next build`, then assert the preflight warning fired. This is the
   registry-only path, where no CLI has run and preflight is the only thing that
   can report the missing config.
3. `agentblog doctor --fix`, then assert the patched regex is a superset of the
   Next.js defaults union the AI crawlers.
4. `agentblog init` a second time, then `git diff --exit-code`. A user who reruns
   the command has to get no diff.
5. Rebuild, assert the warning is gone, lint, start, and check what a crawler
   actually receives over HTTP with no browser and no DOM library.
6. `agentblog revert`, then build again, because reversibility is a promise the
   CLI makes when it asks to edit a file it did not create.

## Working on it locally

Everything an install writes is in `.gitignore`, so the committed state is always
the clean app. To get back to it after a local install:

```
pnpm --filter fixture-next16 clean-install
```

That runs `git clean -xdf --exclude=node_modules .` followed by
`git checkout -- .` inside this directory: it deletes the generated files and
restores the four the CLI patches. `node_modules` is excluded because
reinstalling it costs minutes and it is not part of what the install changes.

## Why `lib/utils.ts` is committed here

`components.json` aliases `utils` to `@/lib/utils`, and every project that has
run `shadcn init` already owns that file. The registry deliberately ships no copy
of it, because overwriting a consumer's `cn` is the inheritance failure the whole
product is built to avoid. Committing ours reproduces the real condition: if the
registry ever started shipping one, it would land on top of this file and show up
as a diff.

## Related

`apps/fixture-no-shadcn` is the opposite case: Tailwind with no
`components.json`, where `agentblog init` has to refuse and write nothing.
