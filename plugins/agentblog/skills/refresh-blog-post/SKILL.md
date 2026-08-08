---
name: refresh-blog-post
description: >
  Refreshes an existing blog post: re-verifies every statistic and citation against
  its source, replaces facts that have moved, and updates dateModified only when
  the content actually changed. Use when asked to update or refresh a post, when a
  post is stale or its stats are out of date, when a cited source has been revised,
  or when agentblog audit --stale flags it.
argument-hint: '[post slug]'
allowed-tools: Read Write Edit Glob Grep WebSearch WebFetch Bash(npx agentblog *)
license: MIT
compatibility: A Next.js project with AgentBlog installed. Needs web access to re-verify sources.
metadata:
  package: agentblog
  homepage: https://agentblog.dev
---

# Refresh an existing blog post

Refreshing is not rewriting. The job is to find what has changed in the world since
the post was published and correct the post to match, then leave everything else
alone. A refresh that rewrites prose which was already correct produces a large
diff with no information in it, and makes the real corrections harder to review.

## The rule this skill exists to enforce

**Touch `dateModified` only if the content actually changed.**

Bold, because it is the whole discipline. A `dateModified` that does not correspond
to a real change is a trust-destroying signal, and a refresh tool that bumps the
date unconditionally is a machine for manufacturing exactly that signal at scale.

Freshness is widely reported to correlate with citation. The specific percentages
in circulation do not survive being traced, so do not quote one: the most repeated
of them comes from a study whose publisher's domain no longer resolves. The
qualitative claim is still a reason to genuinely update posts on a schedule. It is
not a reason to restamp them. The engines that reward freshness are the same ones
that can compare the date you claim against the content they already have.

Concretely:

- Fixed a number, replaced a dead citation, added a new section, corrected a claim:
  **update `dateModified`**.
- Fixed a typo, reflowed a paragraph, changed a hyphen, reformatted a table with
  the same contents: **do not update `dateModified`**.
- Verified every fact and found nothing had changed: **do not update
  `dateModified`**, and say so in the report. "Nothing needed changing" is a
  successful outcome of this skill, not a failure.

If you are unsure whether a change counts, ask whether a reader who had already
read the post would want to know about it. If not, the date does not move.

## The other rules, unchanged from writing

These apply to everything you add during a refresh:

- **Never fabricate a statistic, a quotation, or a source.** If a number has moved
  and you cannot verify the new one at a real source you fetched, remove the
  precision and state the claim qualitatively. Do not update a figure to a
  plausible newer figure. That is worse than leaving the old one, because the old
  one at least has a source.
- **Never invent experience.** No anecdote, no first-person story, no opinion the
  sources do not support, added to make a rewritten passage read as human.
- **Never use an em dash.** Not in new prose, not in a corrected sentence, not
  anywhere. Use a comma, a colon, parentheses, or a full stop. Do not use a double
  hyphen as a substitute.
- No keyword stuffing, no padding, and none of "delve", "leverage", "robust",
  "seamless", "landscape", "tapestry". `agentblog audit` fails the post on all of
  them.

## Procedure

### 1. Read the post and its provenance

- Read the post file and its frontmatter.
- Note `datePublished`, `dateModified`, and how long ago that was.
- List every `citations[]` entry, and every number, date, version, price, and
  proper-noun claim in the body. That list is your work queue, and you will report
  against it.
- Check `content/research/` for this post's URL. If `dataforseo-research` has run,
  it may already say what position this post holds, whether it fell without the
  post changing, and which competitor page took the slot. A refresh aimed at a
  measured decline is a different edit from a refresh aimed at stale citations,
  and knowing which one this is before starting saves rewriting the wrong half.

### 2. Re-fetch every cited source

For each entry in `citations[]`, `WebFetch` the URL and check three things:

- **Does it still resolve?** A 404 or a redirect to a homepage means the citation
  is dead. Find the current location of the same source, or replace the source, or
  remove the claim. Do not leave a dead link.
- **Does it still say what the post says it says?** Documentation gets rewritten,
  studies get corrected, vendors quietly restate numbers. This is the check that
  matters most and the one that is easiest to skip. Quote the sentence you read the
  number in.
- **Has it been superseded?** A newer edition, a follow-up study, a newer version
  of the same document.

Record the outcome for each source.

### 3. Re-run the post's searches

`WebSearch` the post's target query and its H2 questions again. You are looking for
facts in the post that are now wrong, sub-questions that did not exist when the
post was written and now do, and better sources for claims the post already makes.

### 4. Apply the smallest correct change

- Update the numbers that moved, with the new source.
- Replace dead or superseded citations, and keep `citations[].kind` accurate to
  what the replacement actually is.
- Add a section only if a genuinely new sub-question needs answering, and write it
  to the same standard as a new post: a 40 to 60 word capsule under the heading,
  150 to 300 words, self-contained, entity names repeated rather than pronouns.
- Leave prose that is still correct exactly as it is.

Do not improve the writing while you are here. If the post needs a rewrite, say so
and stop, rather than smuggling one in under a refresh.

### 5. Decide the date, deliberately

Look at the diff. If it contains only formatting, whitespace, or typo fixes, leave
`dateModified` alone. Otherwise set it to now, in ISO 8601 **with a UTC offset**.

`dateModified` must be greater than or equal to `datePublished`, and it must match
the visible `<time dateTime>` and the JSON-LD exactly. The block renders all three
from frontmatter, so editing frontmatter is the only edit needed.

### 6. Re-run the audit

```bash
npx agentblog audit <slug> --verbose
```

A refresh can break what the original passed: a replaced link can be broken, a
removed paragraph can drop the internal link count below five, a new section can
arrive without a capsule. Report the output. Do not restate its checks by reading.

### 7. Report

State plainly:

- Every source re-checked, with its outcome: unchanged, updated, dead, superseded.
- Every claim that changed, with the old value, the new value, and the source.
- Whether `dateModified` was touched, **and why or why not**.
- Anything you could not verify, and what you did about it.

## When to escalate instead of refreshing

Say so and stop, rather than refreshing, when:

- More than roughly half the post's claims are now wrong. That is a rewrite, and
  `write-blog-post` owns it.
- The post's central premise has been invalidated. Refreshing the numbers around a
  dead premise produces a well-cited wrong article.
- The post targets a query nobody asks any more. Consider a redirect to the post
  that replaced it, rather than an update.
