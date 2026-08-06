## What this changes

<!-- One or two sentences. What a release note would say. -->

## Why

<!-- The problem, not the patch. If it fixes an issue, link it. -->

## Checklist

- [ ] `pnpm codegen` run, if I touched `packages/schema` or `packages/checks`
- [ ] `pnpm lint && pnpm typecheck && pnpm test` pass
- [ ] `pnpm check:static` passes (copy style, theming, client boundary, bot list, file count)
- [ ] A changeset is included, if this is user visible (`pnpm changeset`)
- [ ] No em dashes anywhere, including in comments

## If this touches the shipped block

<!-- Delete this section if it does not. -->

- [ ] I installed it into `apps/fixture-next16` and built, rather than only building `apps/web`
- [ ] I checked what a crawler receives: `curl -s -A "GPTBot" <url>`
- [ ] Any new file is registered in `apps/web/registry/blog/registry.json`
- [ ] Comments state what breaks if the code changes, because a coding agent will read them
