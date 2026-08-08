---
name: agentblog-setup
description: >
  Finishes an AgentBlog install end to end: repairs the config wiring the registry
  alone cannot do, then replaces the seed identity, authors, categories, and posts
  with the user's own so the blog is theirs rather than AgentBlog's. Verifies with
  agentblog doctor rather than asserting success. Use after installing AgentBlog
  with shadcn add or agentblog init, when asked to finish setting up the blog or
  configure it for a site, when agentblog doctor reports findings, or when the blog
  still shows placeholder branding, example.com links, or the AgentBlog seed posts.
allowed-tools: Read Write Edit Glob Grep Bash(npx agentblog *) Bash(git check-ignore *)
license: MIT
compatibility: A Next.js project with AgentBlog installed. Needs network access for the live crawler check.
metadata:
  package: agentblog
  homepage: https://agentblog.dev
---

# Finish the install, then make the blog theirs

AgentBlog installs in two layers and finishes in three. `shadcn add` copies the
files. The `agentblog` CLI patches the two files that live outside the block.
Neither can do the third thing, which is turn a correct install into this user's
blog: the seed content ships AgentBlog's own author, AgentBlog's own four
categories, and two posts about AI search.

A user who stops after layer two has a blog that renders, passes `doctor`, and
publishes somebody else's topics under a placeholder byline.

Work in that order. Phase 1 is mechanical and mostly automated. Phase 2 needs the
user, and it is the phase that decides whether the blog is worth crawling.

Assume the shadcn CLI skill covers `shadcn add`, registries, and `components.json`.
Assume `node_modules/next/dist/docs/` covers Next.js API shapes for the exact
version installed. This skill covers the wiring between them.

**Never use an em dash** in anything you write into this repository, including
config comments, author bios, and category descriptions.

```
- [ ] 1. Read the state before changing anything
- [ ] 2. Let doctor --fix do the mechanical repairs
- [ ] 3. Fill agentblog.config.ts with real values
- [ ] 4. Write the real author record
- [ ] 5. Replace the taxonomy with the user's topics
- [ ] 6. Decide what happens to the seed posts
- [ ] 7. Verify, do not assert
```

## Phase 1: converge the install

### 1. Read the state before changing anything

```bash
npx agentblog doctor --verbose
```

It enumerates every check and names the ones that fail, which is a better starting
point than inspecting files by hand. Read its output before opening anything.

Then read `components.json`. **If it is absent, stop.** AgentBlog requires an
initialised shadcn project, and creating `components.json` on the user's behalf
makes decisions about style, base colour, and aliases that are theirs. Tell the user
to run `npx shadcn@latest init` and stop.

Note whether the project uses a `src/` directory, because every path below shifts.

### 2. Let `doctor --fix` do the mechanical repairs

```bash
npx agentblog doctor --fix --dry-run   # show the user the diff first
npx agentblog doctor --fix
```

It repairs exactly this, and backs every file up to `.agentblog/backup/` first:
the `htmlLimitedBots` union and `images.qualities` in `next.config.ts`;
`metadataBase`, `title.template`, and the RSS alternates link in the root layout;
an environment guard in `app/robots.ts`; the AgentBlog block in `AGENTS.md`, placed
after the region Next.js manages; `INDEXNOW_KEY` and `AGENTBLOG_REVALIDATE_SECRET`
in `.env.local`, moved out of any git-tracked env file; and the IndexNow key file
in `public/`. Anything it declines to change is printed with the reason.
`npx agentblog revert` puts it all back.

Prefer it over hand-editing every time. Three things are worth knowing anyway,
because they decide whether you accept its output or investigate.

**`htmlLimitedBots` replaces the Next.js default bot list rather than extending
it.** The value must be a union: every AI crawler _plus_ the entire Next.js default
list. A patch that writes only the AI crawlers drops Googlebot, Bingbot, Applebot,
Twitterbot, LinkedInBot, Slackbot, Discordbot, and facebookexternalhit from
HTML-limited treatment, which trades a live SEO and social-preview regression for a
GEO gain. `doctor --fix` performs the union correctly and widens rather than
replaces, preserving entries the user added. If you ever edit it by hand: the type
is `RegExp` and a string fails config validation at startup, it is a top-level key
rather than an `experimental` one, and `/.*/` is never the answer because it
disables streaming metadata for every human visitor.

**`doctor --fix` leaves `htmlLimitedBots` byte for byte alone when it cannot read
the current value as a literal.** That is deliberate, and it means a computed value
needs your eyes. Widen it by hand, never replace it.

**Never write `CLAUDE.md`.** Next.js generates it containing `@AGENTS.md`, which
already imports everything in `AGENTS.md`. Writing there duplicates the block into
context twice, and `next dev` may rewrite the file underneath you. If
`agentRules: false` is set in `next.config.ts`, Next.js writes neither file, so our
block is the only agent instruction in the project. Say so to the user rather than
assuming Next.js has their back.

### 3. Fill `agentblog.config.ts` with real values

The template ships with placeholders, and `doctor` reports them rather than
inventing replacements. The config must call `defineConfig(...)`, not export a bare
object and not use `satisfies`, because `defineConfig` enforces the cross-field
requirements the type alone cannot express.

Ask the user for anything you cannot determine from the repository. Do not guess a
site URL from `package.json` and do not invent a brand name.

| Field           | Notes                                                                                                                                                          |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `siteUrl`       | Absolute https URL, bare origin, no trailing slash, no query, no fragment. Anchors every canonical, every `@id`, and the sitemap.                              |
| `brand.name`    | The publisher name. Appears in `Organization`, `WebSite`, and the title template.                                                                              |
| `brand.logo`    | `url`, `width`, and `height`. All three. A logo without dimensions is an incomplete `ImageObject`.                                                             |
| `brand.sameAs`  | Absolute profile URLs, never handles. LinkedIn, Crunchbase, YouTube, Wikidata where they genuinely exist. Leave the array empty rather than inventing entries. |
| `source`        | The content adapter. `mdxSource({ dir: 'content/blog' })` for the default filesystem install.                                                                  |
| `deployHook`    | Required when the adapter's `prerenderStrategy` is `'deploy-hook'`. Without it, publishing without a rebuild silently serves stale content.                    |
| `defaultAuthor` | A slug that exists in `content/authors.json`. Set it in the same change as step 4.                                                                             |

Everything else is defaulted. Do not restate a default in the config file just to
make it visible. That is how a default silently becomes a pin.

## Phase 2: make the blog theirs

Phase 1 produced a correct install. Everything in it would pass `doctor` while the
site published a placeholder byline linking to `example.com`. This phase is the one
nothing can automate, and it is where the entity signals come from.

Interview the user. Ask for what you cannot read out of the repository, in one
round rather than one question at a time: who writes here, what they are credible
on, which profile URLs are real, and what the blog is about.

### 4. Write the real author record

`content/authors.json` ships one record with slug `editorial` and placeholder
values. `agentblog.config.ts` points `defaultAuthor` at it and both seed posts name
it, so **keep the slug or change it in all three places in one commit**. `doctor`
reports `seed-authors-unedited` until the values change.

This record is a ranking surface rather than metadata. The Search Quality Rater
Guidelines direct raters to look authors up, and an engine resolving "who wrote
this" reads these fields together.

- `name`: the person's name and nothing else. No job title, no honorific, no
  publisher name. Google's Article guidance is explicit, and `jobTitle` exists so
  the correct shape is the only constructible one.
- `bio`: two or three sentences on why this person is credible on these topics.
  Specific experience, not adjectives.
- `jobTitle`, `worksFor`, `alumniOf`: fill what is true, omit what is not.
- `knowsAbout`: the topics this author is genuinely credible on. These become
  `Person.knowsAbout` and should overlap the taxonomy in step 5.
- `sameAs`: absolute profile URLs. This is the single strongest entity signal in
  the whole graph, and a handle disambiguates nothing. **Ask the user for these.
  Never invent one, and never leave an `example.com` placeholder in place.** An
  empty array is better than a wrong URL.

Delete the `guest-author` record unless the user wants it. It exists only to show
the shape of a roster with more than one person in it, and no seed post names it.

### 5. Replace the taxonomy with the user's topics

`content/categories.json` ships four categories that are AgentBlog's own subject
matter. Two of them are load-bearing while the seed posts are present: `ai-search`
and `content-strategy` are named in seed post frontmatter, and removing either
before the post that references it fails the next build with `unknown category
slug`. Do step 6 first, or do both in one commit.

Aim for five to ten fixed categories. Each one is an indexable hub page, and a hub
with two posts on it is a crawl liability rather than an asset. Fewer real
categories beats more aspirational ones.

Every category needs a real `description`, because the hub page is indexable and
the schema rejects an empty one. Two sentences saying what belongs in the category
and what does not.

### 6. Decide what happens to the seed posts

`content/blog/` holds two posts about how AI search engines read a blog. They are
good posts and they are not this user's posts. Put the decision to the user with a
recommendation rather than deleting content on your own initiative:

- **Delete them** if the blog is about something else, which is the usual case.
  Then remove the categories they pinned, in the same commit.
- **Keep them** if the blog is about search, AI, or web performance, and rewrite
  the byline and internal links to match the new identity.
- **Keep them unpublished** by setting `draft: true`, if the user wants the format
  reference without the URLs. They stay out of every query, the sitemap, and the
  feed.

Whichever way it goes, the seed posts are the format specification for everything
`write-blog-post` produces afterwards. If they are deleted, say so, because the
next post has no house example to read.

## 7. Verify, do not assert

```bash
npx agentblog doctor --verbose
```

Report its output. If findings remain, fix them or explain why each one is
intentional.

Then, if the site is deployed, run the live check. It is the only one that tests
what a crawler actually receives:

```bash
npx agentblog doctor --url https://example.com
```

That probes the site as GPTBot, ClaudeBot, PerplexityBot, OAI-SearchBot, and
Googlebot, and detects a CDN sitting in front. **Run it from your own machine or
from CI, never from inside the deployment**, because a request originating inside
the network can bypass the CDN rule the check exists to find.

A 403, a 429, or a challenge page there means a CDN is blocking AI crawlers
regardless of what `robots.txt` says. That is the single most common cause of a
correctly installed blog getting no citations, and it is a blocking failure. Name
the CDN in the report.

`Googlebot` is in that list for a reason worth passing on: Cloudflare classifies
multi-purpose crawlers by their broadest use, and Googlebot crawls for both Search
and AI training with one bot. Ticking a setting that reads as "do not train on my
content" can therefore remove the site from Google entirely.

**Do not report setup as complete while `doctor` reports an error, or while any
author, category, or config field still holds a placeholder.** List what failed and
what it would take to fix.

When it is genuinely done, tell the user the next step is `plan-blog-content` if
they have no editorial plan, and `write-blog-post` if they do.
