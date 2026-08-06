---
name: refresh-blog-post
description: >
  Refresh an existing blog post: re-verify every statistic and citation against its
  source, replace facts that have moved, and update dateModified only when the
  content actually changed. Use when a post is stale, when agentblog audit --stale
  flags it, or when a cited source has been updated.
when_to_use: >
  Trigger phrases include "update this post", "refresh the blog post about",
  "these stats are out of date", "re-check the sources in", "this post is stale".
argument-hint: '[post slug]'
paths:
  - content/blog/**
allowed-tools: Read Write Edit Glob Grep WebSearch WebFetch
---

# Refresh an existing blog post

Refreshing is not rewriting. The job is to find what has changed in the world since
the post was published and correct the post to match, then leave everything else
alone. A refresh that rewrites prose which was already correct produces a large diff
with no information in it, and makes the real corrections harder to review.

## The rule this skill exists to enforce

**Touch `dateModified` only if the content actually changed.**

Bold, because it is the whole discipline. A `dateModified` that does not correspond
to a real change is a trust-destroying signal: it is one of the errors the schema
error table calls out by name, and a refresh tool that bumps the date
unconditionally is a machine for manufacturing exactly that signal at scale.

Freshness is widely reported to correlate with citation. The specific percentages in
circulation do not survive being traced, so do not quote one: the most repeated of
them comes from a study whose publisher's domain no longer resolves, and
`references/geo-playbook.md` lists it among the figures removed for that reason. The
qualitative claim is still a reason to genuinely update posts on a schedule. It is
not a reason to restamp them. The engines that reward freshness are the same ones
that can compare the date you claim against the content they already have.

Concretely:

- Fixed a number, replaced a dead citation, added a new section, corrected a claim:
  **update `dateModified`**.
- Fixed a typo, reflowed a paragraph, changed a hyphen, reformatted a table with the
  same contents: **do not update `dateModified`**.
- Verified every fact and found nothing had changed: **do not update
  `dateModified`**, and say so in the report. "Nothing needed changing" is a
  successful outcome of this skill, not a failure.

If you are unsure whether a change counts, ask yourself whether a reader who had
already read the post would want to know about it. If not, the date does not move.

## The other rules, unchanged from writing

These apply to everything you add during a refresh:

- **Never fabricate a statistic, a quotation, or a source.** If a number has moved
  and you cannot verify the new one at a real source you fetched, remove the
  precision and state the claim qualitatively. Do not update a figure to a plausible
  newer figure. That is worse than leaving the old one, because the old one at least
  has a source.
- **Never use an em dash.** Not in new prose, not in a corrected sentence, not
  anywhere. Use a comma, a colon, parentheses, or a full stop. Do not use a double
  hyphen as a substitute.
- No keyword stuffing, no padding, and none of the banned openers or filler words in
  `write-blog-post`.

## Procedure

### 1. Read the post and its provenance

- Read the post file and its frontmatter.
- Note `datePublished`, `dateModified`, and how long ago that was.
- List every `citations[]` entry, and every number, date, version, price, and
  proper-noun claim in the body. That list is your work queue.

### 2. Re-fetch every cited source

For each entry in `citations[]`, `WebFetch` the URL and check three things:

- **Does it still resolve?** A 404 or a redirect to a homepage means the citation is
  dead. Find the current location of the same source, or replace the source, or
  remove the claim. Do not leave a dead link.
- **Does it still say what the post says it says?** Documentation gets rewritten,
  studies get corrected, vendors quietly restate numbers. This is the check that
  matters most and the one that is easiest to skip.
- **Has it been superseded?** A newer edition, a follow-up study, a newer version of
  the same doc.

Record the outcome for each source. You will report it.

### 3. Re-run the post's searches

`WebSearch` the post's target query and its H2 questions again. You are looking for
three things:

- Facts in the post that are now wrong.
- Sub-questions that did not exist when the post was written and now do.
- Newer or better sources for claims the post already makes.

### 4. Apply the smallest correct change

- Update the numbers that moved, with the new source.
- Replace dead or superseded citations.
- Add a section only if a genuinely new sub-question needs answering, and write it
  to the same standard as `write-blog-post` step 5: 40 to 60 word capsule, 150 to
  300 words, self-contained, entity names repeated.
- Update `citations[]` to match what the body now cites, including `kind`.
- Leave prose that is still correct exactly as it is.

Do not "improve" the writing while you are here. If the post needs a rewrite, say so
and stop, rather than smuggling one in under a refresh.

### 5. Decide the date, deliberately

Look at the diff. If it contains only formatting, whitespace, or typo fixes, leave
`dateModified` alone. Otherwise set it to now, in ISO 8601 **with a UTC offset**.

`dateModified` must be greater than or equal to `datePublished`, and it must match
the visible `<time dateTime>` and the JSON-LD exactly. The block renders all three
from frontmatter, so editing frontmatter is the only edit needed.

### 6. Report

State plainly:

- Every source re-checked, with its outcome: unchanged, updated, dead, superseded.
- Every claim that changed, with the old value, the new value, and the source.
- Whether `dateModified` was touched, **and why or why not**.
- Anything you could not verify, and what you did about it.

Then run the items in the `write-blog-post` skill's `references/checklist.md` that a
refresh can affect: the evidence block, the links block, the frontmatter and schema
block, and the copy style block. Report pass or fail with observed values.

## When to escalate instead of refreshing

Say so and stop, rather than refreshing, when:

- More than roughly half the post's claims are now wrong. That is a rewrite.
- The post's central premise has been invalidated. Refreshing the numbers around a
  dead premise produces a well-cited wrong article.
- The post targets a query nobody asks any more. Consider a redirect to the post
  that replaced it, rather than an update.
