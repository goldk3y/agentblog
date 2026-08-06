---
name: agentblog-setup
description: >
  Finish an AgentBlog install that the registry alone cannot complete: fill
  agentblog.config.ts, patch next.config.ts and app/layout.tsx if the CLI did not,
  and verify with agentblog doctor. Use after installing AgentBlog with shadcn add,
  or when agentblog doctor reports configuration findings.
when_to_use: >
  Trigger phrases include "finish the AgentBlog setup", "agentblog doctor is
  failing", "I installed the blog but it isn't configured", "the blog says
  htmlLimitedBots is missing", "set up agentblog.config".
allowed-tools: Read Edit Glob Grep Bash(npx agentblog *)
---

# Make a registry-only install converge to a correct install

AgentBlog installs in two layers. `shadcn add` copies the files. The `agentblog` CLI
patches the two files that live outside the block and cannot be copied over safely:
`next.config.ts` and `app/layout.tsx`. A user who ran only the first layer has a
blog that renders and is invisible to the crawlers it was built for.

This skill closes that gap. It reads the actual install state first, changes only
what is wrong, and verifies with `agentblog doctor` rather than declaring success.

Assume the shadcn CLI skill covers `shadcn add`, registries, and `components.json`.
Assume `node_modules/next/dist/docs/` covers Next.js API shapes for the exact
version installed. This skill covers the wiring between them.

**Never use an em dash** in anything you write into this repository, including
config comments and the `AGENTS.md` block.

## Procedure

### 1. Read the state before changing anything

Run `npx agentblog doctor` first. It enumerates every check and tells you which ones
fail, which is a better starting point than inspecting files by hand.

Then read, in this order:

- `components.json`. If it is absent, **stop**. AgentBlog requires an initialised
  shadcn project, and creating `components.json` on the user's behalf makes
  decisions about style, base colour, and aliases that are theirs to make. Tell the
  user to run `npx shadcn@latest init` and stop.
- `agentblog.config.ts` at the project root.
- `next.config.ts`.
- `app/layout.tsx` (or `src/app/layout.tsx`).
- `AGENTS.md`, if present.

Note whether the project uses a `src/` directory, because every path below shifts.

### 2. Fill `agentblog.config.ts`

The template ships with placeholders. The config must call `defineConfig(...)`, not
export a bare object and not use `satisfies`, because `defineConfig` is what
enforces the cross-field requirements the type alone cannot express.

Ask the user for anything you cannot determine from the repository. Do not guess a
site URL from `package.json` and do not invent a brand name.

Fields that need real values:

| Field           | Notes                                                                                                                                                          |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `siteUrl`       | Absolute https URL, no trailing slash. Anchors every canonical, every `@id`, and the sitemap.                                                                  |
| `brand.name`    | The publisher name. Appears in `Organization`, `WebSite`, and the title template.                                                                              |
| `brand.logo`    | `url`, `width`, and `height`. All three. A logo without dimensions is an incomplete `ImageObject`.                                                             |
| `brand.sameAs`  | Absolute profile URLs, never handles. LinkedIn, Crunchbase, YouTube, Wikidata where they genuinely exist. Leave the array empty rather than inventing entries. |
| `source`        | The content adapter. `mdxSource({ dir: 'content/blog' })` for the default filesystem install.                                                                  |
| `deployHook`    | Required when the adapter's `prerenderStrategy` is `'deploy-hook'`. Without it, publishing without a rebuild silently serves stale content.                    |
| `defaultAuthor` | A slug that exists in `content/authors.json`.                                                                                                                  |

Everything else is defaulted. Do not restate a default in the config file just to
make it visible. That is how a default silently becomes a pin.

### 3. Patch `next.config.ts`

The check that matters here is `htmlLimitedBots`.

Read the current value first. **The config replaces the Next.js default bot list, it
does not extend it.** So the value must be a union: every AI crawler _plus_ the
entire Next.js default list. Dropping the tail removes Googlebot, Bingbot, Applebot,
Twitterbot, LinkedInBot, Slackbot, Discordbot, and facebookexternalhit from
HTML-limited treatment, which is a live SEO and social-preview regression traded for
a GEO gain.

Rules for this patch:

- If `htmlLimitedBots` is absent, add it as the full union.
- If it is present but narrower than the union, **widen it, never replace it**.
  Preserve any entries the user added that are not in either list.
- The type is `RegExp`, not a string. A string fails config validation at startup.
- It is a top-level key, not under `experimental`.
- Never write `/.*/`. That disables streaming metadata for every visitor and costs
  human readers TTFB and LCP.

`npx agentblog doctor --fix` performs this union correctly and backs up the original
to `.agentblog/backup/`. Prefer it over hand-editing. Use `--dry-run` first to show
the user the diff.

Also verify while you are in this file:

- `cacheComponents` is off, or the Cache Components route variant is the one
  installed.
- `images.qualities` includes every quality value actually used by `<Image>` in the
  block. The default is `[75]` only, and an unlisted value is silently coerced.

### 4. Patch `app/layout.tsx`

Two things must be present in the root metadata export:

- `metadataBase`, set to a `new URL(...)` of the site URL. Relative URLs anywhere in
  metadata cause a build error without it.
- `title.template` with a `title.default`. The default is required whenever a
  template is set, and the template applies to child segments only.

Also confirm the root `openGraph` sets `siteName` and `locale`. Metadata merge is
shallow: any page that defines `openGraph` at all replaces the parent's entire
object. The block handles this by spreading shared defaults from `lib/metadata.ts`,
but only if the root sets them in the first place.

Do not add a `<script type="application/ld+json">` to the layout by hand. The block
renders the sitewide `Organization` and `WebSite` graph through `lib/schema.ts`, and
a second serialization point is how a graph starts contradicting itself.

### 5. Write the `AGENTS.md` block

The block goes in the consumer's root `AGENTS.md`, between `<!-- agentblog:start -->`
and `<!-- agentblog:end -->`. The content is in `AGENTS.agentblog.md` in the
AgentBlog registry.

Two placement rules, both load-bearing on Next.js 16.3 and later:

- `next dev` rewrites its own managed block between `<!-- BEGIN:nextjs-agent-rules -->`
  and `<!-- END:nextjs-agent-rules -->` on every run, preserving everything outside
  it. **Append our block strictly after `<!-- END:nextjs-agent-rules -->`.** Never
  write inside, across, or between those markers.
- **Never write `CLAUDE.md`.** Next.js generates it containing `@AGENTS.md`, which
  already imports everything in `AGENTS.md`. Writing there duplicates the block into
  context twice, and `next dev` may rewrite the file underneath you. If the user has
  a hand-authored `CLAUDE.md`, leave it alone.

If `agentRules: false` is set in `next.config.ts`, Next.js writes neither file, so
our block is the only agent instruction in the project. Say so to the user rather
than assuming Next.js has their back.

### 6. Environment and secrets

- The IndexNow key file must exist in `public/` as `{key}.txt`, containing the key
  and nothing else, and must match `INDEXNOW_KEY`. The key is 8 to 128 characters of
  `a-z`, `A-Z`, `0-9`, and dashes.
- Check that `INDEXNOW_KEY` and `AGENTBLOG_REVALIDATE_SECRET` are in a git-ignored
  file. `envVars` from the registry writes to `.env`, which is often tracked. Run
  `git check-ignore` on whichever file holds them and offer to move them if it is
  tracked.

### 7. Verify, do not assert

Run `npx agentblog doctor` again and report its output. If findings remain, fix them
or explain why each one is intentional.

Then, if the site is deployed, run the live check. It is the only one that tests
what a crawler actually receives:

```bash
curl -s -A "GPTBot" "$URL" | head -c 4000
```

A 403 or a challenge page here means a CDN is blocking AI crawlers regardless of
what `robots.txt` says. That is the single most common cause of a correctly
installed blog getting no citations, and it is a blocking failure. Name the CDN in
the report.

**Do not report setup as complete while `doctor` reports an error.** List what
failed and what it would take to fix.
