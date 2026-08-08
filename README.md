<div align="center">

# AgentBlog

**A production blog for Next.js that AI search engines can actually read, installed with one command, with an agent layer that knows how to write for it.**

[Documentation](https://docs.agentblog.dev) · [Live demo](https://agentblog.dev/blog) · [Registry](https://agentblog.dev/registry) · [The GEO playbook](https://docs.agentblog.dev/concepts/geo-playbook)

</div>

---

## The problem

Search and AI answer engines are the two organic channels almost every team
knows it should have and almost nobody sets up properly. Not because the
individual pieces are hard, but because there are about forty of them and every
one fails quietly.

A blog can look completely correct and still be invisible. Client-rendered
content returns an empty shell to a crawler that does not execute JavaScript.
Metadata streams into `<body>` instead of `<head>` for exactly the bots you care
about. `og:site_name` disappears from every post because Next.js merges metadata
shallowly. A new post never reaches `sitemap.xml` because that route is cached.
`author` is a bare string, so the entity link that E-E-A-T depends on does not
exist. None of that shows up in a browser. All of it shows up in `curl`, which is
why every claim on this page has an assertion script behind it in `scripts/`.

## Install

**Two commands, then four edits.** The commands are ours. Every edit is a
decision only you can make, which is why none of them is automated.

```bash
npx shadcn@latest add @agentblog/blog     # writes the files
npx agentblog@latest doctor --fix         # wires up what a file copier cannot reach
```

| #   | File                   | What you write                                                                                                                           |
| --- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `components.json`      | The `@agentblog` namespace under `registries`. Both commands resolve through it, so this one comes first                                 |
| 2   | `app/globals.css`      | `@import '../styles/agentblog.css';` after the Tailwind import. Miss it and article prose renders with no typography and no error at all |
| 3   | `agentblog.config.ts`  | `siteUrl`, brand name and logo, `brand.sameAs`, and a default author slug                                                                |
| 4   | `content/authors.json` | Yourself. Keep the `editorial` slug or change it in the seed posts too                                                                   |

Or one command that does both of the above and edit 3, with prompts:

```bash
npx agentblog@latest init
```

Requires Next.js 16.3 or newer with the App Router, React 19, Tailwind v4, and a
shadcn-initialised project. `init` checks all four and refuses with instructions
rather than guessing. If you do not have `components.json` yet, run
`npx shadcn@latest init` first: that command picks a component base and a base
colour, and those are your choices to make, not ours.

Worth knowing before you run either command: adding `@agentblog` to your
`components.json` authorises `shadcn add` to fetch source files, npm
dependencies, and CSS from `agentblog.dev` and write them into your app, every
time it runs. That is the same trust you extend to an npm publisher, without a
lockfile. `--dry-run` prints everything it would write first, and
[the installation guide](https://docs.agentblog.dev/installation) explains the
tradeoff between the two paths honestly.

Starting from nothing:

```bash
npx agentblog@latest create my-blog
```

`create` scaffolds a new Next.js project and installs the blog into it. Two
things it does not do yet: it does not apply `@agentblog/theme`, and it does not
add the standalone site items. You get a working blog inside a default shadcn
project, and the reading theme is a `shadcn add` away.

## What you get

```
app/blog/page.tsx                     paginated index, Blog schema, real <a href> pagination
app/blog/opengraph-image.tsx          social card for every list surface
app/blog/[slug]/page.tsx              the post route, every slug prerendered
app/blog/[slug]/opengraph-image.tsx   per-post social card
app/blog/category/[slug]/page.tsx     indexable hub pages
app/blog/tag/[slug]/page.tsx          noindexed below a configurable post count
app/authors/[slug]/page.tsx           Person schema with sameAs and knowsAbout
app/sitemap.ts                        lastModified from real content dates
app/robots.ts                         environment guarded, AI access declarations
app/feed.xml/route.ts                 RSS 2.0
app/api/publish/route.ts              revalidate plus IndexNow, in the right order
app/editorial-policy/page.tsx         the Trust surface almost no blog has
lib/schema.ts                         typed JSON-LD @graph builders
lib/posts.ts                          the storage adapter facade
lib/preflight.ts                      build-time config lint
lib/og-card.tsx                       the social card layout, in one place
components/blog/*                     the reading experience
components/mdx/*                      callouts, stats, tables, FAQ, code blocks
.claude/skills/*                      the agent layer
agentblog.config.ts                   one file to configure all of it
```

Resolving `@agentblog/blog` through its dependency graph writes 76 files. All of
them yours after install, none of them a dependency you have to keep upgrading.

## What makes it correct

**The crawler gets the whole article in the first response byte.**
`generateStaticParams` returns every slug, with no slicing and no pagination. No
client component withholds content from the HTML. The two that exist,
`TableOfContents` and `ShareButtons`, render their full markup server-side;
hydration only adds scroll state. The FAQ and the table of contents use
`<details>` and CSS rather than a conditional mount. Verify it the way we do:

```bash
curl -s -A "GPTBot" https://your-site.dev/blog/your-post | grep "a sentence from your post"
```

**`htmlLimitedBots` is a union, not a replacement.** This config key _overrides_
the Next.js default bot list rather than extending it, so writing only the AI
crawlers silently drops Googlebot, Bingbot, Applebot, Twitterbot, LinkedInBot,
Slackbot, Discordbot, and WhatsApp from HTML-limited treatment. AgentBlog vendors
a pinned copy of the Next.js default list, unions it with the AI crawler list,
and CI diffs the vendored copy against upstream so the day Next.js adds a bot we
find out from a red build.

**Structured data is a real `@graph`, and it is typed.** `BlogPosting`,
`WebPage`, `BreadcrumbList`, `Person`, `Organization`, `WebSite`, `ImageObject`,
and `FAQPage`, cross-referenced by `@id` from a single helper so the nodes cannot
drift apart and stop linking. Built with `schema-dts`, so a property name cannot
be a typo. The bare-string author is closed off by us rather than by the library:
schema-dts 2.0.0 models `Person` as `Person | string`, because schema.org lets a
text node stand in for an entity, so `lib/schema.ts` declares
`type Person = Exclude<PersonOrText, string>` and the builders take an `@id`
reference. `FAQPage` is emitted only when the FAQs render visibly, because
marking up invisible content is the fastest way to earn a manual action.

**Metadata defaults survive.** Next.js merges metadata shallowly, so a page that
sets `openGraph` at all replaces its parent's entire object. Every route spreads
shared defaults from `lib/metadata.ts`, and CI asserts `og:site_name` and
`max-snippet` are still in the built HTML. That last one matters: `max-snippet:
-1` is what permits full snippets in AI answers, so losing it is a visibility
regression, not a formatting one.

**Publishing invalidates the metadata routes.** `sitemap.xml` and `feed.xml` are
cached route handlers, and `generateStaticParams` does not re-run during ISR. A
publish webhook that revalidates only the page routes leaves the new post out of
both files until the next deploy, then pings IndexNow about a URL the sitemap
does not list. AgentBlog revalidates both explicitly, uses
`revalidateTag(tag, { expire: 0 })` rather than a stale-while-revalidate profile
on the publish path, and for database-backed sources fires a deploy hook and
waits for it before pinging.

**Dates carry an offset, and slugs carry none.** `IsoDateTime` is a branded type,
so a timestamp without a UTC offset is unconstructible. Google falls back to
Googlebot's timezone when the offset is missing, which shifts every published
date. `Slug` rejects a leading date, because a slug that advertises the post's
age makes an evergreen refresh look stale.

**Content is written for retrieval.** Answer capsules of 40 to 60 words under the
H1 and under each H2, question-format headings, sections of 150 to 300 words that
stand alone, entity names repeated instead of pronouns, real tables instead of
prose comparisons, and citations as first-class frontmatter. The two seed posts
demonstrate all of it, because they are the format specification.

**The failure modes are loud.** `lib/preflight.ts` reads your `next.config` at
build time and warns on every `next dev` and `next build` when the wiring is
missing. `agentblog doctor` reports the same findings and can fix most of them.
`agentblog doctor --url` fetches your live site as GPTBot, ClaudeBot,
PerplexityBot, OAI-SearchBot, and Googlebot, because a CDN in front of your
origin can block all of them before your `robots.txt` is ever read, and nothing
else in the toolchain catches that. Run it from CI or from your own machine
rather than from inside the deployment: it is an ordinary `fetch` from wherever
the CLI runs, and a request originating inside the network can bypass the very
CDN rule you are testing for.

One exception, worth stating because the paragraph above claims the opposite.
Nothing checks that you imported `styles/agentblog.css`. `htmlLimitedBots` has
four redundant channels warning you about it and this has none, so the quietest
remaining failure in the product is the one where the prose renders unstyled and
every check still passes. It is edit 2 in the install table above for that reason.

## It inherits your design system

`/blog` should look like the rest of your product. AgentBlog composes on top of
your existing shadcn primitives using bare-name registry dependencies, which
resolve against your `components.json`, your component base, and your own
customised `Card`. Every colour in the block is a semantic token, so it tracks
your theme automatically. In Mode A it installs no base, no theme, and no font.

CI proves it with a static source lint. `scripts/assert-theme-conformance.mjs`
reads every file under `apps/web/registry/blog/**` and rejects any palette
utility, any colour literal, and any `dark:` colour variant, plus an
`hsl(var(--token))` wrapper in the CSS, which is the Tailwind v3 idiom that
produces an invalid colour under v4 and inherits silently. Planned, not yet
wired: a second fixture with a custom base colour, radius, and font, built
alongside the default one so the two snapshots can be asserted to differ.

## The agent layer

Posts are MDX files in your repository, which makes them something a coding agent
can genuinely maintain.

```bash
# via the shadcn registry, into .claude/skills/
npx shadcn@latest add @agentblog/agent-kit

# or as a Claude Code plugin
/plugin marketplace add goldk3y/agentblog
/plugin install agentblog@agentblog
```

Six skills, and the plugin id is qualified by its marketplace, which is the
form Claude Code resolves.

| Skill               | What it does                                                                                                                       |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `agentblog-setup`   | Finishes the install wiring, then replaces the seed identity, authors, categories, and posts with yours                            |
| `plan-blog-content` | Builds the entity, the taxonomy, the query clusters, and the link graph, and writes them to an editorial plan                      |
| `write-blog-post`   | Writes to the GEO playbook: answer capsules, question headings, real tables, cited statistics, internal links that prevent orphans |
| `refresh-blog-post` | Re-researches an existing post and updates `dateModified` only when the content actually changed                                   |
| `agentblog-audit`   | Runs the pre-publish gate, including a raw `curl -A GPTBot` assertion                                                              |
| `publish-blog-post` | Revalidates the post, index, sitemap, and feed, submits to IndexNow, and reads the response code                                   |

`agentblog-audit` and `publish-blog-post` set `disable-model-invocation: true`,
so an agent cannot decide on its own to run a gate or submit a URL to an external
service. You invoke those two.

The skills carry two prohibitions in always-loaded context rather than in a
reference file: never fabricate a statistic, a quotation, or a source, and never
use an em dash. Both are checked by `agentblog audit` and by CI. The full copy
style rules and the script that enforces them are in
[CONTRIBUTING.md](./CONTRIBUTING.md#never-use-an-em-dash).

`AGENTS.md` gets a short block telling every agent tool the invariants that must
not be broken, written strictly outside the region Next.js manages itself.

## Configuration

One file.

```ts
import { defineConfig } from '@/lib/define-config'
import { mdxSource } from '@/lib/sources/mdx'

export default defineConfig({
  siteUrl: 'https://yourdomain.com',
  brand: {
    name: 'Your Brand',
    logo: { url: '/logo.png', width: 512, height: 512 },
    sameAs: ['https://www.linkedin.com/company/yourbrand', 'https://github.com/yourbrand'],
  },
  source: mdxSource({ dir: 'content/blog' }),
  revalidate: 3600,
  postsPerPage: 12,
  noindexTagsBelow: 5,
  indexnow: { enabled: true },
})
```

`brand.sameAs` earns its own mention. It maps to `Organization.sameAs`, which is
how an answer engine resolves "the company that published this" to a real entity
rather than a string.

## Content sources

Storage is an interface, and MDX on disk is one implementation of it.

```ts
interface ContentSource<Strategy extends PrerenderStrategy> {
  readonly prerenderStrategy: Strategy
  readonly name: string
  getAllPosts(opts?: PostQuery): Promise<PublishedPost[]>
  getPost(slug: Slug, opts?: PostQuery): Promise<Post | null>
  // ...
}
```

Swapping storage is one line in `agentblog.config.ts`. Every adapter must pass
`runSourceContractTests` from `@agentblog/schema/contract`, which asserts the
eight properties the rest of the blog assumes: schema conformance, draft
handling, single-round-trip hydration, callability with no request context, null
for an absent post, editorial-first related posts, a declared prerender strategy,
and stable ordering.

`prerenderStrategy` is enforced by the compiler. Point your config at a
database-backed source without supplying a `deployHook` and the file stops type
checking, which turns a silent staleness bug into a build error.

| Adapter          | Status                                                                                                                        |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `mdxSource`      | Shipping. Filesystem plus frontmatter. Zero infrastructure, git versioned, and an agent writing a post is just writing a file |
| `supabaseSource` | Planned                                                                                                                       |
| `convexSource`   | Planned                                                                                                                       |

## CLI

```
agentblog init              detect, prompt, install, patch, verify
agentblog create <name>     scaffold a standalone blog site (see the note above)
agentblog doctor [--fix]    verify the install; non-zero exit, so it works in CI
agentblog doctor --url <u>  fetch your live site as five different crawlers
agentblog audit [slug]      the pre-publish checklist
agentblog audit --stale     posts ranked by how overdue a refresh is
agentblog new "<title>"     scaffold a post with correct frontmatter
agentblog ping <slug>       revalidate plus IndexNow, manually
agentblog revert            restore the last patch set
agentblog uninstall         revert patches and list what to delete
```

`init`, `create`, `doctor --fix`, `revert`, and `uninstall` all take `--dry-run`,
print a unified diff before touching anything, back up every file they modify to
`.agentblog/backup/`, and are idempotent. Running `init` twice is a no-op, and CI
asserts it. `--dry-run`, `--yes`, `--force`, and `--json` belong to specific
commands rather than to the CLI as a whole; the
[CLI reference](https://docs.agentblog.dev/reference/cli#flags) has the table.

Taking a later fix into an install you have already edited is
`npx shadcn@latest add @agentblog/blog --diff` to see what moved, then
`--overwrite` on the items you want, then `npx agentblog@latest doctor --fix` for
the config half. See
[Taking an update](https://docs.agentblog.dev/guides/take-an-update).

## Requirements

- Next.js 16.3 or newer, App Router
- React 19
- Tailwind CSS v4 (v3 is not supported; see the docs for why)
- A shadcn-initialised project (`components.json` present)
- Node 20.9 or newer

## Your first post

```bash
npx agentblog@latest new "Do AI crawlers run JavaScript?"
```

That writes `content/blog/do-ai-crawlers-run-javascript.mdx` with complete
frontmatter, today's date with a UTC offset, and your default author. It does not
write the post. Ask a coding agent to, and the `write-blog-post` skill you already
installed takes over.

Two things to know before the first one, because both are build failures rather
than warnings. The file name is the slug, and a `slug` in frontmatter silently
overrides it. And `author` and `category` are references: each must name a record
that exists in `content/authors.json` and `content/categories.json`, which is why
edit 4 above is worth doing before you write anything.

Then:

```bash
npx agentblog@latest audit do-ai-crawlers-run-javascript
```

The pre-publish gate. It reports every item pass or fail with the observed value,
and never claims done on a fail.

## Documentation

| Page                                                                 | For                                                         |
| -------------------------------------------------------------------- | ----------------------------------------------------------- |
| [Installation](https://docs.agentblog.dev/installation)              | Both install paths, and the four edits neither one makes    |
| [Configuration](https://docs.agentblog.dev/reference/configuration)  | Every field in `agentblog.config.ts`                        |
| [CLI reference](https://docs.agentblog.dev/reference/cli)            | Every command, every flag, and what `doctor --fix` declines |
| [Troubleshooting](https://docs.agentblog.dev/troubleshooting)        | The failures that actually happen, and what each looks like |
| [The GEO playbook](https://docs.agentblog.dev/concepts/geo-playbook) | Why the content format is the content format                |

## Non-goals for v1

Stated as decisions rather than gaps: multi-locale routing, Tailwind v3, an
`llms.txt` inside the blog block, and certified monorepo support. Each one has a
reason and a reserved seam where there is one. See
[Roadmap and non-goals](https://docs.agentblog.dev/project/roadmap).

## Contributing

### How this repository is built

```
apps/web              agentblog.dev: landing page, registry host, and the demo blog
  registry/           the source of truth for every file AgentBlog ships
apps/docs             docs.agentblog.dev: the documentation, built with Fumadocs
apps/fixture-next16   clean Next.js 16 app; CI installs into it and builds
packages/schema       Zod schemas, inferred types, ContentSource, contract suite
packages/checks       dependency-free config predicates, vendored bot list
packages/cli          the `agentblog` npm package
plugins/agentblog     the Claude Code plugin
scripts               codegen and the CI assertion gates
```

The demo blog at `agentblog.dev/blog` imports the same modules the registry
ships, so shipped code cannot drift from tested code. The highest-value job in CI
installs the registry into a clean Next.js app and builds it, because a registry
can pass every schema check and still produce a project that does not compile.

Setup, the copy style rules, and the review gates are in
[CONTRIBUTING.md](./CONTRIBUTING.md).

### Licensing

Three licenses, scoped by directory, and the scoping is the point: the seed posts
become your published content, so they carry no attribution requirement.

| Scope                                            | License                        | Why                                                                                                                        |
| ------------------------------------------------ | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| Code                                             | [MIT](./LICENSE)               | A restrictive license on a template whose distribution mechanism is copying files into your repository would be incoherent |
| Seed posts (`apps/web/registry/blog/content/**`) | [CC0](./LICENSE-SEED)          | These become your published content. An attribution requirement would mean every user owes credit on their own blog        |
| Docs and playbook prose                          | [CC BY 4.0](./LICENSE-CONTENT) | Reproducing the playbook requires a credit link, which is exactly the citation this product exists to generate             |

Full text in [Licensing](https://docs.agentblog.dev/project/licensing).

## Acknowledgements

Built on [shadcn/ui](https://ui.shadcn.com)'s registry system, which solved
distribution so we did not have to, and on [Next.js](https://nextjs.org), whose
App Router makes full prerendering the default rather than an achievement.
