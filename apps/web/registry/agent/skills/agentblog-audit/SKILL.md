---
name: agentblog-audit
description: >
  Runs the AgentBlog pre-publish gate on a post or a deployed URL. Delegates the
  deterministic checks to the agentblog CLI, then covers the four things no
  script can: what a crawler literally receives, whether the JSON-LD graph is valid
  against the raw HTML, whether every cited source actually says what the post
  claims, and whether the prose reads as written by a person. Reports pass or fail
  per assertion with the observed value. Use before publishing a post, before a
  release, or when asked to audit, gate, or verify a post.
argument-hint: '[post slug or URL]'
disable-model-invocation: true
allowed-tools: Read Glob Grep WebFetch Bash(curl *) Bash(npx agentblog *)
license: MIT
compatibility: A Next.js project with AgentBlog installed. The live sections need a deployed URL.
metadata:
  package: agentblog
  homepage: https://agentblog.dev
---

# Pre-publish audit

Manual invocation only, because an audit that runs opportunistically is an audit
nobody reads. Run it when you mean to gate a publish.

Every assertion below reports **pass or fail with the observed value**. "JSON-LD
validates" is a wish. "`author` is `{ "@id": "https://…#person" }`, pass" is a
check.

**Do not report the post as ready while any assertion fails.**

## 1. Run the deterministic half first

```bash
npx agentblog audit <slug> --verbose
npx agentblog doctor --verbose
```

Between them these cover the answer capsule and its length, links inside capsules,
question-format headings, heading ids, title and description lengths, date offsets
and ordering, evidence presence, internal link counts, broken internal links,
orphan status, hero alt text, copy style, frontmatter validity, and every install
and route check.

Paste the observed output. **Do not re-check any of it by reading.** A second,
softer answer to a question a script already answered is how a failing check gets
reported as a pass, and reading is the softer answer every time.

Both exit non-zero on an error finding and zero on a warning, so read the findings
rather than the exit code. A clean exit with three warnings is not a pass.

Note what `audit` has no flags for. Every check runs on every post, on purpose:
the checks a writer would switch off are the ones that catch the expensive
mistakes. Narrow the input with a slug or `--dir`, never the checks.

Sections 2 through 6 are what those commands cannot reach.

## 2. The raw crawler fetch, which nothing replaces

```bash
curl -s -A "GPTBot" "$URL" | grep -q "$DISTINCTIVE_SENTENCE"
curl -s -A "GPTBot" "$URL" | head -c 4000 | grep -q "<title>"
```

Keep this check exactly as it is, with no tooling around it. Its entire value is
that it uses none: it tests what a non-JavaScript crawler literally receives, with
no bundler, no browser, and no framework in the path. Every other instrument in
this file tells you what the system believes. This one tells you what went over the
wire.

Pick the distinctive sentence from the middle of the article body, not from the
capsule or the title, so a page that renders only its shell fails.

The second assertion, `<title>` inside the first 4000 bytes, is checking placement
rather than existence. Next.js appends deferred metadata into `<body>` for user
agents it does not classify as HTML-limited, so a `<title>` that appears late in
the document is a `<title>` the crawler read as body text.

For the multi-bot sweep and CDN detection, `npx agentblog doctor --url $URL` already
probes GPTBot, ClaudeBot, PerplexityBot, OAI-SearchBot, and Googlebot and names the
CDN. Run it from outside the deployment's own network: a request originating inside
can bypass the CDN rule the check exists to find. A 403, a 429, or a challenge page
is a **blocking** failure, not a warning.

## 3. Better instruments than a full build

Do not shell out to `next build` to answer "does this compile" or "is the article in
the first response byte". Two faster instruments exist:

- **The Next.js MCP server at `/_next/mcp`** exposes the running dev server's
  routes, server logs, and compilation issues. Its `get_compilation_issues` and
  `compile_route` tools answer the compilation question in the time a build spends
  starting up.
- **`agent-browser`** (https://github.com/vercel-labs/agent-browser) exposes DOM,
  console, network, and Web Vitals as structured text, including which Suspense
  boundaries are still pending. That is a better instrument for the Core Web Vitals
  thresholds and for "what is actually in the first chunk" than anything we would
  write.

Use them. Keep the curl.

## 4. Schema assertions

Run these against the **raw HTML** from the curl above, never against the rendered
DOM. A DOM-based validator passes markup a crawler never receives.

| Assertion                                                                                     | Why it is here                                                                                                                                                                                       |
| --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Every marked-up fact is visible on the page                                                   | "Don't mark up content that is not visible to readers of the page" is the single most enforced structured data policy, and a violation can earn a manual action that removes rich-result eligibility |
| If `FAQPage` is present, the FAQs render in the HTML                                          | Same policy, and the most common way blogs trip it                                                                                                                                                   |
| `author` is a linked `Person` node with `@id` and `url`, never a bare string                  | A bare string loses the entity link that E-E-A-T depends on                                                                                                                                          |
| `author.name` contains no job title, honorific, or publisher name                             | Explicit in Google's Article guidance. `Author.jobTitle` exists for exactly this                                                                                                                     |
| Every `sameAs` entry is an absolute URL, not a handle                                         | A handle disambiguates nothing                                                                                                                                                                       |
| `Organization.logo` has `width` and `height`                                                  | Required shape, and the config carries both                                                                                                                                                          |
| `datePublished` and `dateModified` carry a UTC offset and match the visible `<time dateTime>` | Three sources of the same date is three chances to disagree. Report the three observed values side by side, not a boolean                                                                            |
| `image` is at least 50,000 pixels and supplied at 16:9, 4:3, and 1:1                          | Google's stated recommendation for Article images                                                                                                                                                    |
| Exactly one `<script type="application/ld+json">` on the page, containing one `@graph`        | Two serialization points is how a graph starts contradicting itself                                                                                                                                  |
| `BlogPosting`, `WebPage`, `Person`, and `BreadcrumbList` are all present and linked by `@id`  | A disconnected node describes an unrelated thing rather than this page                                                                                                                               |
| The final `BreadcrumbList` item has no `item` property                                        | Correct for the current page, and flagged as an error by validators when present                                                                                                                     |

Then run both external validators and report both, because they answer different
questions:

- Rich Results Test (https://search.google.com/test/rich-results): rich-result
  eligibility.
- Schema Markup Validator (https://validator.schema.org/): full vocabulary validity.

## 5. Evidence, which is the assertion with no instrument

`agentblog audit` can tell you a number has no citation. It cannot tell you a
citation is wrong, and a confidently wrong citation is worse than a missing one.

For each entry in `citations[]`:

- **Fetch the URL.** Report whether it resolves, and whether it redirects.
- **Find the claim in it.** Quote the sentence the post's number came from. If you
  cannot find it, the assertion fails, regardless of how plausible the number is.
- **Check the grade.** `kind` should match what the source actually is:
  `peer-reviewed`, `official-docs`, `industry`, `news`, `other`. An industry blog
  filed as `peer-reviewed` is a misrepresentation the reader cannot see.

Report every source with its outcome. This section is slow and it is the reason the
audit exists.

## 6. Copy style and voice

`agentblog audit` covers the mechanical bans: the em dash, the double hyphen used
as a dash, "delve", "leverage", "robust", "seamless", "landscape", "tapestry", the
stock opener, and the "it is not just X, it is Y" construction. Report its result
and move on.

What is left needs reading:

- No claim phrased as evidence without a source. "Studies show", "experts agree",
  "industry reports suggest".
- No invented experience: no anecdote, no first-person story, no opinion the
  sources do not support.
- No closing flourish. No summary recap, no final metaphor inflating the point.
- No run of three sentences sharing a shape.

The full catalogue is in the `write-blog-post` skill's `references/voice.md`.

## 7. Publish-path assertions

- The publish webhook revalidates `/sitemap.xml` and `/feed.xml` as well as the
  post and index paths. Both are cached route handlers, so a publish that skips
  them pings IndexNow for a URL the site's own sitemap does not list.
- `revalidateTag` on the publish path uses `{ expire: 0 }`, not `'max'`. `'max'` is
  stale-while-revalidate, which invites the crawler you just summoned to be the
  visit that receives the stale body.
- No internal link resolves through a redirect. AI crawlers handle redirect chains
  poorly: Vercel and MERJ measured ChatGPT spending 14.36% of its fetches following
  redirects and 34.82% of them on 404 pages
  (https://vercel.com/blog/the-rise-of-the-ai-crawler, 17 December 2024).

`publish-blog-post` owns the rest of the publish sequence, including the IndexNow
response code. Hand off rather than duplicating it.

## 8. Fleet-level checks

```bash
npx agentblog audit --stale --days 90
npx agentblog audit --crawlers ./access.log
```

`--stale` ranks posts by `dateModified` age weighted by inbound internal links, so
the highest-authority stale posts surface first. Hand those to `refresh-blog-post`,
and note that skill's rule: a refresh updates `dateModified` only when the content
actually changed.

`--crawlers` parses a server or CDN access log and reports hits per bot per week.
A post nothing fetched is not a content problem.

## Reporting

Group findings by severity. A finding that is silently wrong outranks a finding
that is loudly wrong, because on this product every failure worth catching is
silent.

1. **Blocking**: a crawler receives no body text, a CDN returns 403, the article
   body is client-rendered, marked-up content is not visible on the page, a cited
   source does not contain the claim.
2. **Error**: schema assertions, date integrity, orphan post, missing capsule,
   anything `agentblog audit` reports as an error.
3. **Warning**: capsule length off by a few words, link count outside the range,
   copy style, voice.

Report every assertion, including the ones that passed. An audit that lists only
failures gives no evidence it ran the rest.
