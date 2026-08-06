---
name: agentblog-audit
description: >
  Run the AgentBlog pre-publish gate against a post or a deployed URL: raw crawler
  fetch, JSON-LD assertions, date integrity, link graph, capsule length, and copy
  style. Reports pass or fail per assertion with observed values. Invoke deliberately
  before publishing or before a release.
argument-hint: '[post slug or URL]'
disable-model-invocation: true
allowed-tools: Read Glob Grep Bash(curl *) Bash(npx agentblog *)
---

# Pre-publish audit

This skill is manual-invocation only (`disable-model-invocation: true`), because an
audit that runs opportunistically is an audit nobody reads. Run it when you mean to
gate a publish.

Every assertion below reports **pass or fail with the observed value**. "JSON-LD
validates" is a wish, not a check. "`author` is `{ "@id": "https://…#person" }`,
pass" is a check.

**Do not report the post as ready while any assertion fails.**

## 1. The raw crawler fetch, which nothing replaces

```bash
curl -s -A "GPTBot" "$URL" | grep -q "$DISTINCTIVE_SENTENCE"
curl -s -A "GPTBot" "$URL" | head -c 4000 | grep -q "<title>"
```

Keep this check exactly as it is, with no tooling around it. Its entire value is
that it uses none: it tests what a non-JavaScript crawler literally receives, with
no bundler, no browser, and no framework in the path. Every other instrument in this
file tells you what the system believes. This one tells you what went over the wire.

Pick the distinctive sentence from the middle of the article body, not from the
capsule or the title, so a page that renders only its shell fails.

Then repeat across the user agents that matter, from outside the deployment's own
network:

```bash
for UA in GPTBot ClaudeBot PerplexityBot OAI-SearchBot Googlebot; do
  printf '%s: ' "$UA"
  curl -s -o /dev/null -w '%{http_code}\n' -A "$UA" "$URL"
done
```

All five must return `200` with body text. A `403`, a `429`, or a challenge page is
a CDN blocking crawlers regardless of what `robots.txt` allows, and it is a
**blocking** failure. Name the CDN.

This matters more than it looks. Cloudflare classifies multi-purpose crawlers by
their broadest use, and Googlebot crawls for both Search and AI training with one
bot. Ticking a setting that reads as "do not train on my content" can therefore
remove the site from Google. That is why `Googlebot` is in the loop above.

The second assertion, `<title>` inside the first 4000 bytes, is checking placement
rather than existence. Next.js appends deferred metadata into `<body>` for user
agents it does not classify as HTML-limited, so a `<title>` that appears late in the
document is a `<title>` the crawler read as body text.

## 2. Better instruments for everything else

Do not shell out to a full `next build` to answer "does this compile" or "is the
article in the first response byte". Two faster instruments exist:

- **The Next.js MCP server at `/_next/mcp`** exposes the running dev server's
  routes, server logs, and compilation issues. Its `get_compilation_issues` and
  `compile_route` tools answer the compilation question in the time a build spends
  starting up.
- **`agent-browser`** (https://github.com/vercel-labs/agent-browser) exposes DOM,
  console, network, and Web Vitals as structured text, including which Suspense
  boundaries are still pending. That is a far better instrument for the Core Web
  Vitals thresholds and for "what is actually in the first chunk" than anything we
  would write.

Use them. Keep the curl.

## 3. Schema assertions

Run these against the **raw HTML** from the curl above, never against the rendered
DOM. A DOM-based validator passes markup a crawler never receives.

| Assertion                                                                                    | Why it is here                                                                                                                                                                                       |
| -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Every marked-up fact is visible on the page                                                  | "Don't mark up content that is not visible to readers of the page" is the single most enforced structured data policy, and a violation can earn a manual action that removes rich-result eligibility |
| If `FAQPage` is present, the FAQs render in the HTML                                         | Same policy, and the most common way blogs trip it                                                                                                                                                   |
| `author` is a linked `Person` node with `@id` and `url`, never a bare string                 | A bare string loses the entity link that E-E-A-T depends on                                                                                                                                          |
| `author.name` contains no job title, honorific, or publisher name                            | Explicit in Google's Article guidance. `Author.jobTitle` exists for exactly this                                                                                                                     |
| Every `sameAs` entry is an absolute URL, not a handle                                        | A handle disambiguates nothing                                                                                                                                                                       |
| `Organization.logo` has `width` and `height`                                                 | Required shape, and the config carries both                                                                                                                                                          |
| `datePublished` and `dateModified` are ISO 8601 **with a UTC offset**                        | Google falls back to Googlebot's timezone when the offset is missing, which can move a post across a day boundary                                                                                    |
| `image` is at least 50,000 pixels and supplied at 16:9, 4:3, and 1:1                         | Google's stated recommendation for Article images                                                                                                                                                    |
| Exactly one `<script type="application/ld+json">` on the page, containing one `@graph`       | Two serialization points is how a graph starts contradicting itself                                                                                                                                  |
| `BlogPosting`, `WebPage`, `Person`, and `BreadcrumbList` are all present and linked by `@id` | A disconnected node describes an unrelated thing rather than this page                                                                                                                               |
| The final `BreadcrumbList` item has no `item` property                                       | Correct for the current page, and flagged as an error by validators when present                                                                                                                     |

Then run both external validators and report both, because they answer different
questions:

- Rich Results Test (https://search.google.com/test/rich-results): rich-result
  eligibility.
- Schema Markup Validator (https://validator.schema.org/): full vocabulary validity.

## 4. Date integrity

Three sources of the same date is three chances to disagree.

- `dateModified` in frontmatter equals the visible `<time dateTime>` attribute.
- Both equal `dateModified` in the JSON-LD.
- `dateModified` is greater than or equal to `datePublished`.
- Both carry a UTC offset.

Report the three observed values side by side, not a boolean.

## 5. Content assertions

- Answer capsule present under the H1, 40 to 60 words. Report the count.
- Answer capsule under each H2, 40 to 60 words. Report each count.
- No hyperlinks inside any capsule.
- Every H2 and H3 has a stable `id`.
- Exactly one `<h1>`.
- Heading levels descend without skipping.
- Every H2 is in question format.
- At least one cited statistic and one cited named-source quotation.
- Comparison data is in a real `<table>` with `<thead>` and `<tbody>`.

## 6. Link graph

- 5 to 15 contextual internal links in the body. Report the count.
- The post has at least one inbound internal link from another post. Zero inbound
  links is an orphan and a failure. Name the linking posts.
- No internal link resolves through a redirect. AI crawlers handle redirect chains
  poorly: Vercel and MERJ measured ChatGPT spending 14.36% of its fetches following
  redirects and 34.82% of them on 404 pages
  (https://vercel.com/blog/the-rise-of-the-ai-crawler, 17 December 2024).
- Every internal link target exists.

## 7. Copy style

Mechanical, so it is checkable rather than a matter of taste.

- Zero em dash characters (`U+2014`) anywhere in the post, the frontmatter, or the
  alt text. Zero double hyphens used as a dash.
- None of: "delve", "leverage", "robust", "seamless", "landscape", "tapestry".
- No "in today's fast-paced world" opener or any variant.
- No "it's not just X, it's Y" construction.
- No rhetorical question answered in the same paragraph. Question-format H2 headings
  are required and are not this.

## 8. Publish-path assertions

- The publish webhook revalidates `/sitemap.xml` and `/feed.xml` as well as the post
  and index paths. Both are cached route handlers, so a publish that skips them
  pings IndexNow for a URL the site's own sitemap does not list.
- `revalidateTag` on the publish path uses `{ expire: 0 }`, not `'max'`. `'max'` is
  stale-while-revalidate, which invites the crawler you just summoned to be the
  visit that receives the stale body.
- The IndexNow key file exists in `public/` and matches `INDEXNOW_KEY`.
- The IndexNow response code is surfaced, not swallowed. `200` submitted, `202`
  accepted with key validation pending, `400` bad format, `403` key invalid or
  missing, `422` URL and host mismatch, `429` rate-limited. `403` and `422` are
  silent-failure modes that look identical to success from the caller's side.
- The IndexNow limit is 10,000 URLs **per request**, not per domain per day.

## 9. Delegate the rest

```bash
npx agentblog audit --schema --links --dates --capsules
npx agentblog audit --stale --days 90
npx agentblog doctor
```

`agentblog audit --stale` ranks posts by `dateModified` age, weighted by inbound
internal links, so the highest-authority stale posts surface first. Hand those to
`refresh-blog-post`, and note that skill's rule: a refresh updates `dateModified`
only when the content actually changed.

## Reporting

Group findings by severity. A finding that is silently wrong outranks a finding that
is loudly wrong, because on this product every failure worth catching is silent.

1. **Blocking**: a crawler receives no body text, a CDN returns 403, the article
   body is client-rendered, marked-up content is not visible on the page.
2. **Error**: schema assertions, date integrity, orphan post, missing capsule.
3. **Warning**: capsule length off by a few words, link count outside the range,
   copy style.

Report every assertion, including the ones that passed. An audit that lists only
failures gives no evidence it ran the rest.
