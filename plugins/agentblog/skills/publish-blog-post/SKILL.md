---
name: publish-blog-post
description: >
  Publishes a finished AgentBlog post and proves it landed: gates on agentblog
  audit, ships the change, revalidates the post, index, sitemap, and feed, submits
  to IndexNow, reports the real response code, then verifies as a crawler that the
  live URL serves the article body. Use before publishing, shipping, or going live
  with a post, when asked to submit a post to IndexNow, or when a published post is
  missing from the sitemap or serving stale content.
argument-hint: '[post slug]'
disable-model-invocation: true
allowed-tools: Read Glob Grep Bash(curl *) Bash(npx agentblog *) Bash(git status *) Bash(git diff *)
license: MIT
compatibility: A deployed AgentBlog site. Needs INDEXNOW_KEY and AGENTBLOG_REVALIDATE_SECRET.
metadata:
  package: agentblog
  homepage: https://agentblog.dev
---

# Publish a post, and prove it published

Manual invocation only. Publishing pings an external service and puts a URL in
front of crawlers, and an agent should not decide on its own that a draft looks
ready.

Everything in this sequence has a silent failure mode. IndexNow answers `403` for
an invalid key and `422` for a host mismatch, and from the caller's side both look
exactly like success. A sitemap that was not revalidated still returns `200`, just
without the new post in it. The whole skill is the habit of reading the code
instead of the absence of an error.

```
- [ ] 1. Gate
- [ ] 2. Confirm the post is actually publishable
- [ ] 3. Ship it
- [ ] 4. Revalidate and submit
- [ ] 5. Read the IndexNow code
- [ ] 6. Verify as a crawler
- [ ] 7. Report
```

## 1. Gate

```bash
npx agentblog audit <slug> --verbose
npx agentblog doctor --verbose
```

**Both must be clean, warnings included.** They exit non-zero on an error finding
and zero on a warning, so a successful exit code with three warnings under it is
not a pass. Read the findings.

Do not publish past a finding by deciding it is minor. Publishing is the step that
makes a mistake expensive: once a URL is submitted, a correction needs a second
submission and the first version may already have been read.

If the post has not been through `agentblog-audit`, run that first. It covers the
assertions the CLI cannot make, including whether the cited sources actually say
what the post claims.

## 2. Confirm the post is actually publishable

- `draft` is `false` or absent. A `draft: true` post is excluded from every query,
  the sitemap, and the feed, so publishing it does nothing and reports success.
- `datePublished` is not in the future.
- `dateModified` is greater than or equal to `datePublished`, and both carry a UTC
  offset.
- The slug matches the file name. Report both, because a `slug` in frontmatter
  silently overrides the file name, and you are about to submit a URL built from
  the frontmatter value.
- `git status` is clean apart from this post and the file you edited to add an
  inbound link. Publishing sweeps up whatever else is staged.

## 3. Ship it

Merge or deploy by whatever route the project uses. Wait for the deployment to
finish before step 4. Revalidating a route the new build has not replaced yet
caches the old body, and the next crawler visit is the one that reads it.

If `agentblog.config.ts` sets a `deployHook`, the adapter's `prerenderStrategy` is
`'deploy-hook'` and the deploy is what regenerates the static pages. Without the
hook configured, publishing without a rebuild serves stale content and reports
nothing.

## 4. Revalidate and submit

```bash
npx agentblog ping <slug>
```

One command does the whole publish path. It revalidates `/blog/<slug>`, `/blog`,
`/sitemap.xml`, and `/feed.xml`, then submits the post URL to IndexNow and prints
the real response code with its meaning and a remedy.

The two metadata routes are in that list because they are the ones that get
forgotten. `sitemap.xml` and `feed.xml` are cached route handlers, and
`generateStaticParams` does not re-run during ISR, so a publish path that skips
them pings IndexNow for a URL the site's own sitemap does not list. That is the
worst possible combination: you have invited a crawler to a page your own site
does not claim to have.

It exits non-zero when any step you asked for did not happen, including a missing
credential. A missing `AGENTBLOG_REVALIDATE_SECRET` or `INDEXNOW_KEY` is an error
rather than a warning, because a publish step that silently submits nothing and
reports success is the failure this command exists to make loud. Use
`--skip-revalidate` or `--skip-indexnow` only when you actually mean to skip one.

## 5. Read the IndexNow code

`ping` prints it. Report it verbatim rather than reporting "submitted".

| Code  | Meaning                            | What to do                                                                    |
| ----- | ---------------------------------- | ----------------------------------------------------------------------------- |
| `200` | Submitted                          | Nothing.                                                                      |
| `202` | Accepted, key validation pending   | Confirm the key file is actually deployed at the domain root. Re-check later. |
| `400` | Bad payload format                 | A bug in the tooling. Report it.                                              |
| `403` | Key invalid or missing at the root | The key file is not reachable at `https://<host>/<key>.txt`. Deploy it.       |
| `422` | URL and host do not match          | The submitted URL is not on the host that owns the key. Check `siteUrl`.      |
| `429` | Rate limited                       | Wait, then submit fewer URLs.                                                 |

`403` and `422` are the two that matter, because they are indistinguishable from
success unless somebody reads the number. The IndexNow limit is 10,000 URLs **per
request**, not per domain per day, so batching is rarely the problem.

## 6. Verify as a crawler

The publish is not finished until a crawler can read the post.

```bash
curl -s -A "GPTBot" "https://<host>/blog/<slug>" | grep -q "$DISTINCTIVE_SENTENCE"
curl -s "https://<host>/sitemap.xml" | grep -q "/blog/<slug>"
curl -s "https://<host>/feed.xml" | grep -q "/blog/<slug>"
```

Pick the distinctive sentence from the middle of the article body, not from the
capsule or the title, so a page that serves only its shell fails.

Run these **from outside the deployment's own network**. A request originating
inside can bypass the CDN rule that would block a real crawler.

Then:

```bash
npx agentblog doctor --url https://<host>/blog/<slug>
```

That probes the URL as GPTBot, ClaudeBot, PerplexityBot, OAI-SearchBot, and
Googlebot and names any CDN in front of it. A 403 or a challenge page for any of
them is a blocking failure, and it is the single most common reason a correctly
built blog gets no citations.

If the sitemap does not contain the slug, the revalidation did not take. Re-run
step 4 rather than assuming propagation.

## 7. Report

- The audit and doctor results, with observed values.
- The IndexNow response code and its meaning.
- Whether `/sitemap.xml` and `/feed.xml` now contain the URL, quoted.
- The crawler fetch result per user agent, with the sentence you tested with.
- Anything skipped, and why.

**Do not report the post as published while any of those is unverified.** "Deployed"
and "published" are different claims, and only one of them has been tested here.
