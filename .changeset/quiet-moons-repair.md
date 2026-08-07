---
'agentblog': minor
---

Fill in `defaultAuthor` instead of silently declining it, report every declined
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
