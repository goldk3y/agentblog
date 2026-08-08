# agentblog

## 0.4.1

### Patch Changes

- [`cf6398e`](https://github.com/goldk3y/agentblog/commit/cf6398ebc70f836ff8d4f720bc8e1dadec815a60) Thanks [@goldk3y](https://github.com/goldk3y)! - Read dependency versions as semver ranges, which unblocks `init` on a stock `create-next-app` project.

  `create-next-app` writes `"tailwindcss": "^4"`. The version parser matched a full `x.y.z` only, so `^4` read as absent and `init` refused with "Tailwind CSS is not installed. AgentBlog requires Tailwind v4", pointing at a v3 migration guide the project had no use for. The same gap hid `^16`, `^19`, `~5.1`, and `4.x`, so a Next.js 16 project could be refused for not having Next.js.

  Ranges now go through `semver`. An installed version is compared with `satisfies`, and a declared range with `intersects`, so a range is refused only when no version it permits could meet the floor. `"typescript": "^5"` therefore passes the TypeScript 5.1 floor rather than failing on its 5.0.0 minimum.

  Three other reporting fixes come with it:

  - A package that is absent, and one whose spec names no version (`catalog:`, `workspace:*`, an uninstalled `node_modules`), now get different messages. The second says which install command to run instead of recommending a Tailwind migration.
  - When a spec names no version, `init` and `doctor` fall back to shadcn's own marker for a v4 project, the empty `tailwind.config` in `components.json`.
  - No message describes a declared range as an installed version, and doctor check 9 skips rather than guessing when it cannot read the installed Next.js from `node_modules`.

## 0.4.0

### Minor Changes

- [`a48e95c`](https://github.com/goldk3y/agentblog/commit/a48e95c8eeabf2b04804a425a7cf260a689a3311) Thanks [@goldk3y](https://github.com/goldk3y)! - Add a seventh agent skill, `dataforseo-research`, and wire it into the agent kit.

  The other six skills apply a format. None of them can tell you whether it is
  working, so every decision about what to write next was inference: `plan-blog-content`
  mined queries out of web search results, and nothing measured what the site
  already ranked for or whether an answer engine had ever cited it. This skill is
  the evidence layer under the other six, and it is the only one that leaves state
  behind.

  **It reads before it spends.** DataForSEO is prepaid, and a keyword expansion at
  depth 4 followed by a SERP read per row spends real money while looking exactly
  like a run that spent forty cents. So the first move is never a query: the skill
  globs `content/research/`, reads the ledger of what this project already knows,
  probes the free `/appendix/user_data` endpoint for the account's live balance and
  its actual per-endpoint prices, then prints a costed plan and waits for a yes.
  Nothing billable happens before that.

  **Runs compound instead of repeating.** Each run writes back to
  `content/research/`: an append-only `ledger.md` with the cost actually spent, a
  `baseline.md` of the current standing answers that git diffs between runs, and
  dated immutable snapshots under `snapshots/` carrying the exact request body
  beside the response. That last part is what makes a comparison valid. A snapshot
  without the body that produced it cannot be re-asked identically, and two runs
  that asked different questions produce a diff that reads as a result. With a
  catalog on disk the second run re-measures only what moves, reads the rest, and
  reports a delta.

  **It is strategy rather than a query wrapper.** The skill carries four reference
  files: how to get access and read a failure code, which endpoint answers which
  question and what it costs, the on-disk catalog format and the comparison
  protocol, and a playbook for turning rows into editorial decisions. The playbook
  is the point. It grades its own evidence into what was measured this run, what
  comes from published research, and what is only practitioner convention, and the
  decisions it teaches are the ones professionals actually make: harvest the
  positions 4 to 20 the site already holds before hunting new queries, cluster on
  SERP overlap rather than on wording so the site stops competing with itself, let
  intent decide the format before volume decides anything, read the SERP rather
  than the difficulty score, and treat a single AI citation reading as a sample
  from a non-deterministic process rather than as a value.

  **Findings hand off by name.** Decayed and striking-distance posts go to
  `refresh-blog-post`, clusters and priorities to `plan-blog-content`, new posts to
  `write-blog-post` carrying the People Also Ask phrasing as headings.
  `plan-blog-content` and `refresh-blog-post` now check `content/research/` before
  falling back to inference.

  Two traps in the DataForSEO API are called out because each produces a plausible
  wrong answer rather than an error: `load_async_ai_overview` defaults to `false`,
  so a run that leaves it alone reports on DataForSEO's cache and not on Google,
  and each LLM Mentions result carries both `sources` and `search_results`, where
  counting the latter inflates citation dramatically and in the flattering
  direction.

  The skill needs a DataForSEO account, which no other skill does. Without one it
  explains how to get credentials rather than guessing at numbers. It works over
  the DataForSEO MCP server or plain REST, and it never installs an MCP server
  without asking, because that writes to configuration the user owns.

  `@agentblog/blog` now writes 81 files rather than 76.

- [`b905c04`](https://github.com/goldk3y/agentblog/commit/b905c049cf5e8fddd3ead906a0e2a8cd26f1e3ea) Thanks [@goldk3y](https://github.com/goldk3y)! - Rework the post header and move the dates to the foot of the article.

  **The header.** The trail is `Blog > Category` now. The Home crumb is gone from
  every breadcrumb in the block, because Google's breadcrumb documentation states
  that a `ListItem` for the top level path is not required and the SERP prefixes
  the domain regardless, so it spent the first crumb restating the address bar.
  The post crumb is gone too: it repeated the H1 four lines below it, and the
  trail is more useful ending at a category hub a reader can actually go to. The
  blog index renders no breadcrumb on page one, where the trail would be the
  single word "Blog" above an H1 that says "Blog".

  `<Breadcrumbs>` decides the current page from the crumb with no destination
  rather than from the last crumb, so a trail can end at a real destination and
  keep it clickable. Every existing trail ends in a crumb with no destination, so
  nothing else changes.

  **Breadcrumb links are paths again.** A crumb carried an absolute URL built from
  `siteUrl`, which is correct for the `BreadcrumbList` and wrong for an `href`:
  `next/link` falls back to a plain document navigation when the origin is not the
  one serving the page, so on a preview deployment or a local dev server every
  crumb left the deployment for the production domain. `BreadcrumbTrailItem.href`
  is now `BreadcrumbTrailItem.path` and takes a root-relative path, and
  `buildBreadcrumb` absolutizes it for the JSON-LD. The emitted structured data is
  byte for byte what it was.

  The H1 drops to weight 500. At 48px a 600 reads as a headline shouting over the
  sentence under it; the section headings stay at 600 because at 24px they have no
  size advantage to trade. The byline moved up to sit directly under the H1 as one
  line, `By {author} · {n} min read`, with no clock icon beside a phrase that
  already says "read" and no rule under it. The post cards on every list surface
  lost their clock for the same reason, and their reading time reads `{n} min read`
  rather than `{n} min` now that no glyph is supplying the missing word. `Clock` is
  no longer re-exported from `components/blog/icons.tsx`, since nothing in the
  block renders it. The answer capsule is now typeset as
  what it is, the first paragraph of the article, at the same size and leading as
  the body text.

  **The dates.** `datePublished` and `dateModified` render at the foot of the
  article as a new `<PostDates>`, exported from `components/blog/byline.tsx`,
  under the hairline that used to sit in the header. They are labelled in words
  now ("Published July 28, 2026 · Updated August 5, 2026"), which is the shape
  Google's byline date documentation asks for and which the old bare date under
  the title was not. Both keep their `<time dateTime>` elements carrying the raw
  ISO values, so the JSON-LD, the feed, and the visible page still agree
  byte for byte. Publishing to Google News is the one case that wants them back
  between the headline and the body; `<PostDates>` takes a `className` and sets no
  position of its own so you can move it.

  **A breadcrumb bug went with it.** `buildArticleGraph` used to assemble its own
  trail, and it had drifted: the page rendered `Home > Blog > Category > Post`
  while the `BreadcrumbList` claimed `Home > Blog > Post`, which is marked-up
  navigation no reader could see. It now takes the trail as an argument, so the
  route builds one array and hands it to both.

  **Upgrading:** `buildArticleGraph(post)` becomes
  `buildArticleGraph(post, trail)`. If you have customised `app/blog/[slug]/page.tsx`,
  pass it the same array you give `<Breadcrumbs>`, and rename each crumb's `url` or
  `href` key to `path` with a root-relative value: `categoryPath(slug)` rather than
  `categoryUrl(slug)`. The reading size also moved out
  of `@utility prose` and into `--agentblog-reading-size` and
  `--agentblog-reading-leading` in `styles/agentblog.css`, so the body text and
  the answer capsule cannot drift apart; change the size there rather than on
  `prose`.

- [`01065b9`](https://github.com/goldk3y/agentblog/commit/01065b95d53689fef8b9f2c789564af3a096bb3f) Thanks [@goldk3y](https://github.com/goldk3y)! - Make a `src/` layout install build. It did not, on every version until now.

  **`create-next-app` asks whether you want your code in a `src/` directory, and
  nothing in this repository had ever built a project that said yes.** In that
  layout `@/*` maps to `./src/*`, while `agentblog.config.ts` belongs at the
  project root and shadcn puts it there, because its `~/` target means the root
  literally. The single import in `lib/config.ts` therefore resolved to nothing and
  the build stopped before any of our code ran:

  ```text
  Module not found: Can't resolve '@/agentblog.config'
  ```

  Every documented remedy was wrong. `lib/preflight.ts` described this exact
  situation and named `doctor --fix` as the cure, which did not implement it and
  did not report it either; the guard itself can never print, because module
  resolution fails before a module is evaluated. The configuration reference said
  fixing a `src/` project was "a one-line change" without ever saying which line.

  `agentblog init` and `agentblog doctor --fix` now write that line:

  ```json title="tsconfig.json"
  "paths": {
    "@/agentblog.config": ["./agentblog.config.ts"],
    "@/*": ["./src/*"]
  }
  ```

  TypeScript resolves `paths` by the longest prefix before any `*`, so the entry
  without a wildcard wins over `@/*` in either order. The repair is gated on
  whether the specifier actually resolves rather than on whether `src/` exists, so
  a flat layout gets no diff at all and nobody acquires a redundant entry. It edits
  the file as text rather than reserialising it, because `tsconfig.json` is JSONC
  and a round trip would delete every comment in it.

  New check 35 reports the same thing when you run `doctor` without `--fix`, so the
  build error now has somewhere to send you. `agentblog revert` undoes the edit
  like any other.

  **Upgrading:** nothing to do on a flat layout. On a `src/` layout that you had
  already fixed by hand, the entry you wrote is left exactly as it is.

- [`b905c04`](https://github.com/goldk3y/agentblog/commit/b905c049cf5e8fddd3ead906a0e2a8cd26f1e3ea) Thanks [@goldk3y](https://github.com/goldk3y)! - Move the Open Graph card from the app root to `app/blog/`, so installing a blog
  no longer claims the social card for the whole domain.

  **Until now `@agentblog/seo-routes` wrote `app/opengraph-image.tsx`.** In
  Next.js that file is the card for every route that does not define its own,
  which on a site with a landing page, a pricing page, and a blog means all three
  unfurl as the blog. Nothing reported it. The build passed, the card rendered,
  and the only symptom was a marketing page that shared as a blog post.

  The card is now `app/blog/opengraph-image.tsx` and ships with
  `@agentblog/blog-routes`, which is the item that owns the surfaces pointing at
  it. Everything the block writes stays under paths it owns, and an
  `app/opengraph-image.*` of your own now wins everywhere outside `/blog`.

  The layout both cards render moved to `lib/og-card.tsx`. It used to be two
  copies of the same JSX with a comment asking you to keep seven constants in
  sync, which holds until the first time somebody changes one card and ships.
  Recolouring the card is now a four line edit in one file.

  The card also stopped warning in your project. Satori has no `next/image`, so
  the mark is a plain `img`, and the disable for that rule used to sit in a banner
  at the top of the file. `shadcn add` strips the leading comment block from every
  file it installs, so the banner was present in our repo and absent in yours: the
  warning could only ever appear on your side. The directive is now attached to
  the line it governs, inside the JSX, where it is copied along with it.

  **Upgrading:** `app/opengraph-image.tsx` is not removed for you, because by now
  it may be a card you edited. Delete it to fall back to your own site card, or
  keep it and it simply stops being what `/blog` points at.

- [`1b0a83b`](https://github.com/goldk3y/agentblog/commit/1b0a83ba1397f94cf8e43b6a043d41de51683e07) Thanks [@goldk3y](https://github.com/goldk3y)! - Rework the agent skills: two new ones, a contract gate, and the end of the
  duplication between the skills and the CLI.

  **A skill told agents to run a command that does not exist.**
  `agentblog-audit` ended on `agentblog audit --schema --links --dates --capsules`.
  The audit command has none of those flags and deliberately refuses to grow them,
  so the last step of the pre-publish gate exited with a parse error every time
  anybody reached it. `scripts/assert-skill-contract.mjs` now extracts every
  `agentblog` invocation from every skill and reference file and checks the command
  and each flag against the commander definitions in the CLI entry point, so this
  cannot recur.

  **Two new skills.** `plan-blog-content` builds the layer above a post: the entity
  the site should be known for, five to ten category hubs, query clusters mined
  from real search phrasing, and a pillar and supporting post per cluster with the
  internal link direction settled in advance, written to
  `content/editorial-plan.md`. `publish-blog-post` owns the publish gate, where
  every step has a silent failure mode: it gates on `audit` and `doctor`, runs
  `agentblog ping`, and reports the IndexNow response code rather than the absence
  of an error, because `403` for an invalid key and `422` for a host mismatch are
  indistinguishable from `200` unless somebody reads the number.

  **`agentblog-setup` now finishes the blog rather than the wiring.** The seed
  install ships AgentBlog's own author, AgentBlog's own four categories, and two
  posts about AI search, so a user who stopped after the config patches had a blog
  that passed `doctor` and published somebody else's topics under a placeholder
  byline linking to `example.com`. Phase 1 delegates the mechanical repairs to
  `doctor --fix`. Phase 2 interviews the user and writes the real author record,
  the real taxonomy, and a decision about the seed posts.

  **The skills stopped restating the CLI.** `agentblog audit` runs twenty-eight
  deterministic checks and `doctor` runs about fifty, and the audit skill and the
  pre-publish checklist were narrating most of them as prose for an agent to do by
  reading. Both now run the command first and cover only what a script cannot: what
  a crawler literally receives, whether the JSON-LD validates against the raw HTML,
  whether each cited source actually contains the claim, and whether the prose reads
  as written by a person. `references/checklist.md` lost every item the CLI already
  answers.

  **A voice pass, in `write-blog-post`.** New `references/voice.md` carries the
  pattern catalogue, and step 9 is a separate revision pass on purpose: writing
  while scanning a list of forbidden patterns produces prose that avoids them and
  says nothing. The body gains one hard rule, that inventing experience is banned.
  An anecdote or a first-person story added to make prose sound human is
  fabrication that also reads as fabrication, and it was the one failure mode the
  existing bans did not cover.

  **Frontmatter follows the Agent Skills specification.** `when_to_use`, `paths`,
  and `model` are gone. Claude Code concatenates `when_to_use` onto `description`
  and every other agent ignores it, and the skills CLI lists a skill by
  `description` alone, so trigger phrases put there were invisible in the directory
  listing. They moved into `description`. Every skill now carries `license`,
  `compatibility`, and `metadata`, and the only vendor extensions left are
  `argument-hint` and `disable-model-invocation`. The gate enforces the closed list,
  along with the 500-line body budget, `name` matching the directory, reference
  links resolving one level deep, and a contents block on any reference over a
  hundred lines.

  `agentblog-audit` and `publish-blog-post` set `disable-model-invocation: true`.
  An audit that runs opportunistically is an audit nobody reads, and publishing
  submits a URL to an external service.

  The registry item writes 76 files now rather than 73.

### Patch Changes

- [#13](https://github.com/goldk3y/agentblog/pull/13) [`b74185c`](https://github.com/goldk3y/agentblog/commit/b74185cee2503c21c9be599af0fceb522588b8f4) Thanks [@goldk3y](https://github.com/goldk3y)! - Title the blog index "Blog", not "Your Brand blog".

  The index was the only list surface that put the brand in its own title. Every
  other one (a category hub, a tag page, an author page, the editorial policy)
  passes a bare title and lets the root layout's `title.template` add the site
  name, which `agentblog init` writes as `%s | Your Brand`. So the index shipped
  "Your Brand blog | Your Brand" as its document title, in the tab, in a search
  result, and in an AI citation, and an H1 reading "Your Brand blog" on a page
  already sitting on that brand's domain under that brand's header.

  The `/blog/opengraph-image` card had the same doubling for the same reason.
  `ogCard` renders the mark from `config.brand.logo` in the top left, falling back
  to the brand name as a wordmark when there is no readable logo, so a headline of
  `${config.brand.name} Blog` set the brand twice on one 1200x630 image. The card
  now says "Blog" under the mark. Its `alt` still names the brand, because alt text
  is read without the picture.

  The `Blog` JSON-LD node keeps `name: "${brand} Blog"`. That is an entity name in
  a graph rather than a page title, and "Blog" alone identifies nothing.

  **Upgrading:** re-install `@agentblog/blog-routes` (or run `agentblog init`
  again) to pick up both files. If you had edited either title yourself, keep your
  version. Social scrapers that already cached the old card keep serving it until
  their own TTL expires; the card's URL does not change, so force a refetch through
  the platform's own tool if you need it sooner.

## 0.3.0

### Minor Changes

- [`e943fb9`](https://github.com/goldk3y/agentblog/commit/e943fb9ec6f88cc50b31330a249a2638484cacd9) Thanks [@goldk3y](https://github.com/goldk3y)! - Fill in `defaultAuthor` instead of silently declining it, report every declined
  answer, merge the shipped rules fragment, and check `robots.txt` before
  measuring a page nobody is allowed to fetch.

  **`defaultAuthor` was never written, on every install that ever ran.** The
  config template holds the slug in a constant, because one value has to reach
  both `mdxSource(...)` and the `defaultAuthor` field and the adapter cannot read
  the field back without closing an import cycle. The patcher only understood
  string literals, so it read `DEFAULT_AUTHOR` as "not a plain string", declined,
  and left `'your-name'` in place. Nothing failed at install time and `doctor`
  reported zero errors, because both seed posts name `editorial` explicitly. The
  first post written without an `author` line then failed the build with
  `unknown author slug "your-name"`.

  The patcher now resolves the constant and rewrites it there. Rewriting the
  property instead would have been worse than doing nothing: `defaultAuthor` would
  read the chosen slug while `mdxSource` kept handing the placeholder to every
  post that omits an author, and the build would still fail while the config on
  screen looked correct. `doctor` gained a check for the placeholder, so an
  unfired build failure sitting in a config file is now reported as one.

  **Declined answers are printed even when nothing else is.** They used to print
  only alongside a write, so the one run where every answer was rejected was the
  one run that explained nothing: a second `init` collected a site URL, a brand,
  and an author, declined all three because the placeholders were long gone, and
  said "Every patch site is already correct. Nothing to write." An existing
  install is now announced before the prompts rather than after them, so the
  command stops asking four questions it has already decided to ignore.

  **`AGENTS.agentblog.md` is merged rather than orphaned.** Its own install note
  told users to run `doctor --fix` to merge it into their `AGENTS.md`, and no code
  ever did. `init` wrote a shorter built-in block instead, so a project ended up
  with two competing blocks carrying the same markers, and the one an agent
  actually loads was the one missing the rules that matter most: never fabricate a
  statistic, `dateModified` only when the content changed, spread the shared
  metadata defaults, build JSON-LD in one place. The shipped fragment is now the
  source when present, with the built-in block as the fallback.

  **`doctor --url` probes a post, and reads `robots.txt` first.** Passing a site
  root is the natural reading of the flag, and on AgentBlog's primary install path
  that root is the host app's landing page. Check 16 measured its word count and
  reported five errors saying the article was client rendered, on installs where
  every article was prerendered correctly, and exited non-zero. A URL that does
  not already name a post is now treated as an origin and a real slug is probed,
  with the derivation printed.

  The same command now fetches `robots.txt` and reports, per crawler, whether the
  probed path is allowed. The shipped `app/robots.ts` fails closed unless
  `VERCEL_ENV` says production, so a correct install on any other host serves
  `Disallow: /`. A well behaved crawler reads that and never sends the request the
  old check measured, so a completely deindexed site scored a clean pass on the
  one check that exists to catch a site crawlers cannot read.

  **`/llms.txt`** is generated from the same content source as the sitemap and the
  feed, and revalidated by the publish webhook. It is not an SEO lever and the
  docs say so: Google has said no Search system reads it. It ships because
  Perplexity has confirmed it fetches the file to choose what to retrieve, and
  Anthropic recommends publishing one and honours it in Claude's retrieval.

  **`audit` reports a post with no `heroImage`**, which is why `BlogPosting.image`
  was missing from every seed post and from everything generated in their shape.
  The generated `opengraph-image` is deliberately not substituted: Google asks for
  an image representing the article rather than a logo or a caption, and a card
  with the title set in type is the CLI answering a question only the writer can.

## 0.2.0

### Minor Changes

- [`86a3f11`](https://github.com/goldk3y/agentblog/commit/86a3f11e2280d05788a8b1b573f963d657c8fae8) Thanks [@goldk3y](https://github.com/goldk3y)! - Rebuild the design system of the installed blog: one spacing rule, three layout
  rails, and a reading measure that is actually 66 characters.

  The block looked fine in a browser and measured badly. Four composition points
  had no spacing at all, so the category pills sat flush against the post grid and
  the byline sat flush against the table of contents, both at zero pixels, on
  every install. Every route also shared one 768px column, which gave the index a
  three-column grid of 224px cards.

  **Spacing is now compositional.** No component in the block sets its own outer
  margin. Pages stack their children in a flex column with a gap, so a component
  that is missing from a layout is visibly missing rather than silently flush
  against its neighbour. The roles and the two gap constants live in the new
  `components/blog/type-scale.ts`, which is the file to open to restyle the whole
  blog at once.

  **Three rails replace the single column.** `--agentblog-measure` for reading,
  `--agentblog-rail` for card grids, and `--agentblog-article` for an article page
  at `xl`, where the contents list moves out of the flow into a sticky margin rail
  and stops eating the first screen. Every container is written
  `mx-auto w-full max-w-(--rail) px-6`, the ordinary Tailwind container, so the
  blog lines up with a host header and footer written the same way.

  **The measure was wrong and is now measured.** `68ch` produced 84 characters per
  line, because `ch` is the width of the digit zero rather than of an average
  character. The reading column is 39rem at a 17px reading size, which measures 66.

  Three latent bugs went with it:

  - `--agentblog-*` were declared in `@theme inline`, which never emits the
    variable, so every `max-w-(--agentblog-measure)` in the block resolved to
    nothing and fell back to full width. It was invisible because `prose` sets its
    own max-width from the same value, inlined at build time.
  - The typography plugin's table margin rendered as a 28px strip inside the
    border of every table, because the scroll wrapper traps it.
  - The typography plugin's `::before` and `::after` put literal backticks around
    every inline code span, inside a chip that already said "code".

  Also: post cards are a whole-card click target with a hover state and a
  single-line meta row, category pills read as filter controls rather than as
  labels, the answer capsule is a standfirst rather than the fifth identical grey
  panel on the page, and exactly one in-article surface is filled so the rest can
  form a hierarchy.

  Nothing about the schema, the JSON-LD, the metadata, or the route config
  changed. `agentblog init` writes 71 files rather than 70.

### Patch Changes

- [#9](https://github.com/goldk3y/agentblog/pull/9) [`7a55d62`](https://github.com/goldk3y/agentblog/commit/7a55d621570147460c07da0f0b0517b2969b3eaf) Thanks [@goldk3y](https://github.com/goldk3y)! - Point every documentation link at docs.agentblog.dev.

  The documentation moved to its own site, so the URLs the CLI prints and the
  `@see` references in the files it installs now name the page they mean rather
  than a path that redirects. `agentblog.dev/docs/*` still resolves: every old
  page has a permanent redirect to its new URL.

- [`e82b2e3`](https://github.com/goldk3y/agentblog/commit/e82b2e3982f872932b40c2dc140ccc8b2f8708e2) Thanks [@goldk3y](https://github.com/goldk3y)! - Declare every file the content source reads in `outputFileTracingIncludes`, not
  just the posts directory.

  `mdxSource` reads `dir`, `authorsFile`, and `categoriesFile`, and the two roster
  files sit beside the posts directory rather than inside it. The patcher declared
  only the posts directory, so a deployment shipped the posts and left the authors
  behind. Post pages kept serving because they are prerendered, while `/blog`
  returned a 500 with `ENOENT ... content/authors.json`, because it reads
  `searchParams` and therefore renders on demand.

  The route key widened from `/blog/**` to `/**` at the same time. `sitemap.xml`,
  `feed.xml`, `/authors/[slug]`, and `/api/publish` all read content too, and
  naming routes one at a time makes the next one that does a 500 nobody wrote
  down.

  `agentblog doctor --fix` repairs an existing install. It adds the new entry and
  reports the older `/blog/**` one as redundant rather than deleting it.
