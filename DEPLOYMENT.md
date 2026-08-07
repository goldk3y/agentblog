# Deployment

This is the maintainer runbook for the two things this repository publishes. It
is not consumer documentation. If you are installing AgentBlog into your own
project, you want [the installation guide](https://docs.agentblog.dev/installation).

Three artifacts ship, from three places, on three schedules:

| Artifact            | Where it comes from                            | When                        |
| ------------------- | ---------------------------------------------- | --------------------------- |
| The registry JSON   | `apps/web` on Vercel, at `/r/{name}.json`      | Every push to `main`        |
| The documentation   | `apps/docs` on Vercel, at `docs.agentblog.dev` | Every push to `main`        |
| The `agentblog` CLI | npm, published by changesets in `release.yml`  | When a version PR is merged |

None of them is live until the steps below are done. Until the registry is served,
nothing installs: every command in the docs resolves `@agentblog/*` against a
host that has to answer.

## Vercel

Two projects, both importing this repository, distinguished only by their Root
Directory. Vercel reads the `vercel.json` inside that directory, so each project
gets its own build command without either one knowing about the other.

### The agentblog.dev project

Import the repository and set these. The first one is the only one that is not a
default, and getting it wrong is the difference between a working install and a
site that 404s every registry URL.

| Setting          | Value             | Notes                                                       |
| ---------------- | ----------------- | ----------------------------------------------------------- |
| Root Directory   | `apps/web`        | Vercel reads `apps/web/vercel.json` from here               |
| Framework Preset | Next.js           | Detected                                                    |
| Build Command    | `turbo run build` | Pinned in `apps/web/vercel.json`, do not override in the UI |
| Install Command  | Detected          | Vercel handles pnpm workspaces on its own                   |
| Output Directory | Framework default | `.next`                                                     |
| Node.js Version  | 22.x              | Matches `.nvmrc`                                            |

Leave Ignored Build Step on Automatic. `turbo query affected` would work here,
but nearly every commit affects this app, so the only thing skipping can buy is
a site that silently did not update.

### Why the build command is pinned

`apps/web`'s own build script is a bare `next build`. The registry JSON is
produced by `shadcn build` into `apps/web/public/r`, which is gitignored, so a
deploy that runs only `next build` ships a site with no registry in it. Every
documented install command would return 404 against a site that otherwise looked
finished, and nothing in the build would have failed.

`turbo run build` fixes that, because `build` declares `registry:build` as a
dependency in `turbo.json`. Turborepo's automatic workspace scoping infers the
filter from the Root Directory, so no `--filter` is needed. Verified from a
clean tree: 14 registry item files plus a Next.js build.

If you ever change the Build Command in the dashboard, change it to something
that still runs `registry:build` first.

### Environment variables

Set these in Project Settings, Environment Variables. Every one of them is also
declared in `turbo.json`'s `build.env`, because a variable Turborepo does not
know about is not part of the cache key, and two builds that differ only by an
undeclared variable hash identically. That is how a preview build's output gets
served as production.

| Variable                      | Environments        | Required                                      |
| ----------------------------- | ------------------- | --------------------------------------------- |
| `AGENTBLOG_REVALIDATE_SECRET` | Production, Preview | Yes, `/api/publish` refuses to run without it |
| `INDEXNOW_KEY`                | Production          | Only if you want IndexNow submissions         |
| `AGENTBLOG_DEPLOY_WAIT_MS`    | Production          | No, defaults to 45000                         |

Generate the secret with `openssl rand -hex 32`. If you set `INDEXNOW_KEY`, the
matching `public/<key>.txt` file has to exist and contain exactly the key, or
IndexNow rejects every submission. `npx agentblog doctor --fix` writes it.

You do **not** need `AGENTBLOG_PUBLIC_SITE` on Vercel. `robots.ts` allows
crawling when `VERCEL_ENV === 'production'`, which means preview deploys stay
`noindex` by default and no configuration is required to keep them that way.
That variable exists for hosts that are not Vercel.

### Domain

`agentblog.dev` is currently parked and resolves to 216.150.1.1, so it is not
pointing at Vercel yet. Add it under Project Settings, Domains, and follow the
DNS records Vercel gives you at your registrar.

Nothing installs from the documented URLs until this is done, because
`https://agentblog.dev/r/{name}.json` is the host every `@agentblog/*` namespace
resolves against.

### After the first successful deploy

1. Confirm the registry is actually being served, not just built:

   ```bash
   curl -sf https://agentblog.dev/r/blog.json | head -5
   curl -sf https://agentblog.dev/r/registry.json | head -5
   ```

2. Run the real install against the real host, in a scratch Next.js app:

   ```bash
   npx shadcn@4.16.1 add @agentblog/blog
   ```

3. Delete the "not serving yet" banner at the top of
   `apps/docs/content/docs/installation.mdx`, and the same notice in
   `apps/docs/content/docs/quickstart.mdx`, and the paragraph in the same page
   that explains the GitHub shorthand cannot resolve namespaced dependencies.
   All of them are true today and all of them become wrong the moment the host
   answers.

### The docs.agentblog.dev project

A second Vercel project, from the same repository.

| Setting          | Value                | Notes                                                        |
| ---------------- | -------------------- | ------------------------------------------------------------ |
| Root Directory   | `apps/docs`          | Vercel reads `apps/docs/vercel.json` from here               |
| Framework Preset | Next.js              | Detected                                                     |
| Build Command    | `turbo run build`    | Pinned in `apps/docs/vercel.json`, do not override in the UI |
| Output Directory | Framework default    | `.next`                                                      |
| Node.js Version  | 22.x                 | Matches `.nvmrc`                                             |
| Domain           | `docs.agentblog.dev` | Add it under Project Settings, Domains                       |

It needs no environment variables. `AGENTBLOG_DOCS_URL` exists as an override
for a host that is not Vercel and is not needed here.

Two things to check after the first deploy:

```bash
curl -sf https://docs.agentblog.dev/llms.txt | head -3
curl -sfI https://agentblog.dev/docs/installation | grep -i location
```

The first proves the docs are serving. The second proves the redirects in
`apps/web/next.config.ts` are pointing every old documentation URL at its new
home. Every page that ever existed under `agentblog.dev/docs` is mapped
individually, so a blanket redirect appearing in that header is a regression.

## npm

`agentblog` and the `@agentblog` scope were both unclaimed as of 2026-08-06.
Claim them before anyone else does, whether or not you publish soon.

### First publish

Trusted publishing cannot be configured for a package that does not exist yet,
so the first publish uses a token:

1. Claim `agentblog` and the `@agentblog` scope on npmjs.com.
2. Create a granular access token with write access to both.
3. Add it as the `NPM_TOKEN` repository secret in GitHub.

`release.yml` skips publishing entirely when that secret is missing, and writes
these steps into the run summary instead of failing. That gate exists because
without it every push to `main` ran `changeset publish` against an
unauthenticated registry, failed with `E404`, and left `main` permanently red
for a condition that is not a defect.

### After the first publish

Replace the token with trusted publishing, which uses a short-lived OIDC token
and needs no long-lived secret:

```bash
npm trust github agentblog --file release.yml --repo goldk3y/agentblog --allow-publish
npm trust github @agentblog/schema --file release.yml --repo goldk3y/agentblog --allow-publish
```

This needs npm 11.15.0 or later. The workflow already requests `id-token: write`,
which is the permission OIDC needs. Delete the `NPM_TOKEN` secret afterwards,
but note that the preflight gate keys off that secret, so removing it without
replacing the gate condition will skip publishing. Change the gate to a
repository variable at the same time.

### How a release happens

Releases are not automatic. Merging to `main` publishes nothing on its own.

1. `pnpm changeset` in your branch, describing the change and the bump.
2. Merge the PR. `release.yml` opens a "Version Packages" PR.
3. Merge that PR. That run publishes to npm, tags the release, and attaches the
   built registry to the run as an artifact so a tag-pinned install resolves to
   the JSON that shipped with the tag.

## GitHub

- `NPM_TOKEN` is the only secret this repository needs. `GITHUB_TOKEN` is
  provided by Actions.
- Dependabot is configured for the pnpm workspace and GitHub Actions. Its PRs
  update a package manifest, so they need the lockfile regenerated before CI
  passes. `pnpm install` and commit onto the PR branch.
- The `agentblog` GitHub organisation was available as of 2026-08-06. Moving the
  repository there would shorten the GitHub install path from
  `goldk3y/agentblog/blog` back to `agentblog/agentblog/blog`. If you do it,
  update `repository` in every package manifest, the `repo` field in
  `.changeset/config.json`, and the paths in `apps/docs/content/docs/installation.mdx`.
