---
title: The agent layer
description: The four skills AgentBlog installs, what each one does, how they are distributed, and where they deliberately stop.
group: Writing
order: 1
---

Posts are MDX files in your repository. That is the decision the whole agent layer rests on: a coding agent can read your existing posts, learn your voice and your internal link graph, write a new post, and open a pull request, using the tools it already has.

Installing AgentBlog writes four skills into `.claude/skills/` and one block into your `AGENTS.md`.

| Skill               | What it does                                                                          |
| ------------------- | ------------------------------------------------------------------------------------- |
| `write-blog-post`   | Writes a new post to the GEO playbook                                                 |
| `refresh-blog-post` | Re-verifies an existing post's sources and moves `dateModified` only when it earns it |
| `agentblog-setup`   | Finishes the install wiring a registry-only install left undone                       |
| `agentblog-audit`   | The pre-publish gate, invoked deliberately                                            |

## What we deliberately do not teach

Two things already own this surface, and duplicating them makes our skills worse rather than better.

**Next.js ships version-matched documentation** at `node_modules/next/dist/docs/`, so an agent working in your repository already has correct, version-pinned API docs with no network call. Our skills do not restate Next.js API shapes. They would drift, and they would lose to the bundled copy.

**shadcn ships an official skill** that teaches agents the CLI, the registry system, primitive libraries, and registry workflows, plus `shadcn docs <component>`. Our skills assume that context exists.

What is left is genuinely ours: the writing playbook, the schema shapes, and the install-wiring gap.

## write-blog-post

```yaml
name: write-blog-post
description: Write or rewrite a blog post that generative search engines will cite…
paths:
  - content/blog/**
  - agentblog.config.ts
allowed-tools: Read Write Edit Glob Grep WebSearch WebFetch
```

A Claude Code skill is model-invoked. Claude reads the `description` field of every available skill, and loads the body of one when the description matches what you asked for, which is why the description names the techniques rather than the product. You can also invoke it directly as `/write-blog-post`.

`paths` narrows that automatic loading rather than causing it. It is a restriction: with `paths` set, Claude only auto-loads the skill while working with files matching those globs. Touching `content/blog/**` does not by itself pull the skill in, and no glob is a substitute for a description that says what the skill is for.

The procedure:

1. Read `agentblog.config.ts` and the existing posts to learn voice, clusters, and the internal link graph.
2. Identify the target query and its sub-questions. Search for the way people actually phrase them.
3. Outline question-format H2s.
4. Draft answer-first: a 40 to 60 word capsule under the H1 and one under each H2, with no links inside a capsule.
5. Sections of 150 to 300 words, each self-contained, with entity names repeated rather than replaced by pronouns.
6. At least one real statistic and one named-source quotation, each cited.
7. Comparison and specification data in a real Markdown table, never in prose.
8. Five to fifteen contextual internal links, plus at least one inbound link added to an existing post.
9. Complete frontmatter.
10. Run the [pre-publish checklist](/docs/seo-geo-checklist) and report each item pass or fail.

### The anti-instructions

These sit inline in the skill body, not in a reference file the agent might not open. A rule an agent has to go and fetch is a rule it can skip, and these are the rules where skipping is fatal.

- **Never fabricate a statistic or a quotation.** This is the failure mode that turns the skill from an asset into a liability.
- No keyword stuffing. It measures worse than baseline, not merely neutral.
- No padding to reach a word count.
- No em dashes. See the copy style rules below.

Supporting files load only when needed: the full playbook, the `@graph` shapes, and the checklist.

## refresh-blog-post

```yaml
name: refresh-blog-post
paths:
  - content/blog/**
allowed-tools: Read Write Edit Glob Grep WebSearch WebFetch
```

This is the skill that implements the `dateModified` discipline the rest of these docs keep referring to. Refreshing is not rewriting: the job is to find what changed in the world since the post was published, correct the post to match, and leave everything else exactly as it was. A refresh that reflows prose which was already correct produces a large diff with no information in it and buries the real corrections.

The procedure:

1. Read the post, its frontmatter, and its `datePublished` and `dateModified`. List every number, date, version, price, and proper-noun claim in the body. That list is the work queue.
2. `WebFetch` every entry in `citations[]` and answer three questions about each: does it still resolve, does it still say what the post says it says, and has it been superseded. Documentation gets rewritten and vendors quietly restate figures, so the second question is the one that matters and the one that is easiest to skip.
3. Re-run the post's target query and its H2 questions to find facts that are now wrong, sub-questions that did not exist before, and better sources for claims the post already makes.
4. Apply the smallest correct change. If a number moved and the new one cannot be verified at a source that was actually fetched, the precision comes out and the claim goes qualitative. Updating a figure to a plausible newer figure is worse than leaving the old one, because the old one at least has a source.
5. Decide the date deliberately. See below.
6. Report every source re-checked with its outcome, every claim that changed with its old value and new value, and whether `dateModified` moved and why.

### The dateModified rule

**`dateModified` moves only when the content actually changed.**

| Change                                                                         | `dateModified` |
| ------------------------------------------------------------------------------ | -------------- |
| Fixed a number, replaced a dead citation, added a section, corrected a claim   | Moves          |
| Fixed a typo, reflowed a paragraph, reformatted a table with the same contents | Does not move  |
| Re-verified every fact and nothing had changed                                 | Does not move  |

Freshness correlates with citation, which is a reason to genuinely update posts on a schedule and not a reason to restamp them. A date that does not correspond to a real change teaches every consumer of that field to ignore it, which costs you the signal you were trying to send, and the engines that reward freshness are the same ones holding a copy of what your page said last week.

"Nothing needed changing" is a successful outcome of this skill. The skill is instructed to say so and stop.

### When it escalates instead

It refuses to refresh, and says why, when more than roughly half the post's claims are now wrong, when the post's central premise has been invalidated, or when the post targets a query nobody asks any more. Refreshing the numbers around a dead premise produces a well-cited wrong article.

`agentblog audit --stale` ranks posts by how overdue a refresh is, and is the usual way this skill gets pointed at something.

## agentblog-setup

```yaml
allowed-tools: Read Edit Glob Grep Bash(npx agentblog *)
```

Reads the install state, patches `next.config.ts` and `app/layout.tsx` if the CLI did not, fills in `agentblog.config.ts` by asking for the site URL and brand, and verifies with `agentblog doctor`.

Its whole job is to make a registry-only install converge on a correct one. It is one of the four redundant paths that close the gap described in [Installation](/docs/installation).

## agentblog-audit

```yaml
disable-model-invocation: true
```

Run deliberately, not opportunistically. It is the pre-publish gate:

```bash
curl -s -A "GPTBot" "$URL" | grep -q "$DISTINCTIVE_SENTENCE"
curl -s -A "GPTBot" "$URL" | head -c 4000 | grep -q "<title>"
npx agentblog audit --schema --links --dates --capsules
```

It also uses tooling that already exists rather than reinventing it. The Next.js MCP server at `/_next/mcp` exposes the running dev server's routes, logs, and compilation issues, so "does this compile" is answerable without a full build. `agent-browser` exposes the DOM, console, network, and Web Vitals as structured text, including which Suspense boundaries are still pending, which is a better instrument for "is the article in the first response" than anything we would write.

The raw `curl` assertion stays regardless. It is the only check that tests what a non-JavaScript crawler literally receives, and its whole value is that it uses no tooling at all.

### What the schema check actually asserts

"JSON-LD validates" is a wish, not a check. The specific assertions:

| Assertion                                                                    | Why                                                                      |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Every marked-up fact is visible on the page                                  | The single most enforced structured data policy                          |
| `FAQPage` present implies the FAQs render in HTML                            | The most common way blogs trip that rule                                 |
| `author` is a linked `Person` node with `@id` and `url`, never a bare string | A bare string loses the entity link E-E-A-T depends on                   |
| `author.name` contains no job title, honorific, or publisher name            | Explicit in Google's Article guidance. `Author.jobTitle` exists for this |
| Every `sameAs` entry is an absolute URL, not a handle                        | Handles do not disambiguate an entity                                    |
| `Organization.logo` carries `width` and `height`                             | Required shape                                                           |
| Dates are ISO 8601 with an offset                                            | Google defaults to Googlebot's timezone when one is missing              |
| Validated against the raw HTML, not the rendered DOM                         | A DOM-based validator passes markup a crawler never receives             |

## AGENTS.md

`agentblog init` appends an idempotent block to your root `AGENTS.md`, which several coding agents read as a project instruction file. This is the block, in full:

```md
<!-- agentblog:start -->

## Blog (AgentBlog)

Posts live in `content/blog/*.mdx`. Config: `agentblog.config.ts`. Authors:
`content/authors.json`.

- To write a post, use the AgentBlog `write-blog-post` skill. To update one, use
  `refresh-blog-post`. Do not hand-write posts: the skills carry the schema contract
  and the citation rules, and a hand-written post silently skips both.
- Never fabricate a statistic, a quotation, or a source. If a number cannot be
  verified at a real source, state the claim qualitatively instead.
- Never use an em dash, in a post or anywhere else in this repository. Use a comma,
  a colon, parentheses, or a full stop. `agentblog audit` fails on the em dash
  character `U+2014` and on a double hyphen used as a dash.
- Never remove or narrow `htmlLimitedBots` in `next.config.ts`. The value replaces
  Next.js's default bot list rather than extending it, so it must stay a superset of
  that list plus the AI crawlers. Narrowing it breaks Google, Bing, and social
  previews as well as AI citation.
- Never add `'use client'` to anything in the article render path. Only
  `TableOfContents` and `ShareButtons` may be client components, and both render
  meaningful content server-side first.
- `generateStaticParams` in `app/blog/[slug]/page.tsx` must return every slug, never
  a slice and never a page.
- `dateModified` changes only when the content actually changed. An unearned date
  bump is a trust-destroying signal, not a freshness signal.
- Every route that sets `openGraph` or `robots` must spread the shared defaults from
  `lib/metadata.ts`. Metadata merge is shallow, so defining the object at all
  replaces the parent's entire object.
- JSON-LD is built only in `lib/schema.ts` and serialized only by `renderJsonLd`.
  Do not add a second `<script type="application/ld+json">`.
- Run `npx agentblog audit` before committing a post, and `npx agentblog doctor`
  after changing config.

<!-- agentblog:end -->
```

Ten rules, and the first four are the ones that matter most. The fabrication ban and the em dash ban are here as well as in the skills, because an agent that never loads a skill still reads this file.

The block refers to the skill by name rather than by slash command, because the invocation differs by install path: `/write-blog-post` for a registry install, `/agentblog:write-blog-post` for the plugin. Hardcoding either is wrong for the other half of users, and an agent resolves the skill from its name regardless.

See the [CLI reference](/docs/cli-reference) for how this coexists with the block Next.js writes into the same file.

## Also a Claude Code plugin

```
/plugin marketplace add goldk3y/agentblog
/plugin install agentblog@agentblog
```

The install id is `<plugin>@<marketplace>`. Both halves are `agentblog` here, which reads like a typo and is not: the unqualified form does not resolve.

Same skills, installable without touching your Next.js app. The plugin copy is generated from the registry copy by a codegen step, and CI asserts the two are identical.

They are copied rather than symlinked for a specific reason: installing a plugin copies its directory to a cache location, so a symlink pointing outside that directory resolves to nothing. Local development would look fine and every installed plugin would ship empty skills. Another silent failure, and one that only ever shows up for users.

## Copy style

One rule above the others: **no em dashes.** Not in generated posts, not in the docs, not in CLI output, not in the seed content. Use a comma, a colon, parentheses, or a full stop.

The reason is commercial rather than aesthetic. The em dash has become the most recognizable tell of machine-written prose, and readers discount text that leans on it. For a product whose deliverable is AI-assisted writing that gets cited, shipping copy that reads as AI-generated undermines the thing being sold.

Bundled with it, since they share a cause and a lint pass: no "in today's fast-paced world" openers, no "it's not just X, it's Y", no "delve", "leverage", "robust", "seamless", "landscape", or "tapestry", no rhetorical question followed by its own answer, and no three-item list where two items would do.

`agentblog audit` fails a post containing any of them, and CI runs the same check over the marketing site, the docs, and the registry `docs` strings. The script and the exemption list are described in `CONTRIBUTING.md`.
