---
name: plan-blog-content
description: >
  Builds the editorial plan a blog needs before anyone writes: the entity the site
  should be known for, a taxonomy of five to ten category hubs, query clusters
  mined from what people actually search, a pillar and supporting post per cluster
  with the internal link direction decided in advance, and a prioritised backlog
  written to content/editorial-plan.md. Use when asked what to write about, for a
  content or editorial plan, a topic or keyword cluster map, a blog strategy or
  calendar, or when a blog has posts but no structure connecting them.
allowed-tools: Read Write Edit Glob Grep WebSearch WebFetch Bash(npx agentblog *)
license: MIT
compatibility: A Next.js project with AgentBlog installed. Needs web access to mine real queries.
metadata:
  package: agentblog
  homepage: https://agentblog.dev
---

# Plan what the blog is for

A pile of individually good posts does not get cited. Retrieval systems resolve
entities and follow links, so what earns citations is a site that is legibly about
something, with hub pages that have enough on them to be worth indexing and a link
graph that says which post is the authority on what.

This skill produces a plan. It writes no posts. The deliverable is
`content/editorial-plan.md`, and every line of it has to be specific enough that
`write-blog-post` can start from one row without asking a question.

Be honest with the user about the limit of this work. In Ahrefs' study of 75,000
brands, the strongest correlates of AI visibility were off-site: YouTube mentions
at Spearman 0.737 and branded web mentions at 0.664, against backlinks at 0.218
(https://ahrefs.com/blog/ai-brand-visibility-correlations, 12 December 2025,
industry and correlational). None of that lives in this repository. A perfect
editorial plan is necessary and it is not sufficient, and saying so early is better
than saying it in month four.

```
- [ ] 1. Read what already exists
- [ ] 2. Name the entity
- [ ] 3. Mine real queries
- [ ] 4. Cluster into hubs
- [ ] 5. Assign pillars and supporting posts
- [ ] 6. Check what is already answered well
- [ ] 7. Write the backlog
- [ ] 8. Reconcile the taxonomy
```

### 1. Read what already exists

- `agentblog.config.ts` for `brand.name`, `siteUrl`, and `defaultAuthor`.
- `content/authors.json`. `knowsAbout` and `bio` are the constraint nobody
  remembers: a plan that requires posts this roster cannot credibly write is a plan
  to publish thin content under a real name. If the plan needs expertise the roster
  does not have, the answer is a new author record, not a shrug.
- `content/categories.json` for the current taxonomy.
- Every post in `content/blog/`. Record the target query, the category, and both
  directions of its internal links.

```bash
npx agentblog audit --stale --days 90
```

Run it before planning anything new. It ranks posts by `dateModified` age weighted
by inbound internal links, so it tells you which existing posts are worth more than
a new one. Refreshing a post with authority usually beats writing a fourth post
nobody links to.

### 2. Name the entity

Write one sentence: **this site is the place to read about X**. Then check it
against three things: the products or services the business actually sells, the
expertise in `content/authors.json`, and what a reader arriving from a generative
answer would expect to find.

Narrower wins. A site about "retrieval evaluation for RAG systems" resolves as an
entity. A site about "AI" does not resolve as anything, and it competes with every
publisher on earth for queries it cannot win.

This sentence decides everything after it. Get the user to agree to it explicitly
rather than inferring it and proceeding.

### 3. Mine real queries

**Check `content/research/` first.** If `dataforseo-research` has run, its
`baseline.md` already holds measured clusters, the queries this site is close to
ranking for, and the People Also Ask phrasing, all of it better evidence than
anything this step can produce on its own. Use it, and use this step only for what
it did not cover. If that directory does not exist and the project has a
DataForSEO account, running that skill first is worth the delay: it is the
difference between a plan built on measurement and a plan built on inference.

Otherwise, `WebSearch` the entity's obvious head terms. Collect phrasing from
People Also Ask boxes, forum threads, and the questions competitors' posts
actually answer in their H2s. If the project has Search Console access, that is
better than all of it.

Two rules:

- **Do not invent phrasing.** The point of this step is the gap between how a
  practitioner phrases a question and how a marketer would. The practitioner's
  phrasing is the one that matches a retrieval query.
- **Record the question, not the keyword.** "how long should a rag chunk be" is a
  target. "rag chunk size" is a keyword, and a keyword does not tell you what the
  post has to answer.

Collect 40 to 80 real questions before clustering. Fewer and the clusters are
guesses.

### 4. Cluster into hubs

Group the questions by what a reader would consider one subject. Each surviving
group becomes a category in `content/categories.json`.

**Five to ten categories, and no more.** Each is an indexable hub page. A hub with
two posts on it is a crawl liability rather than an asset, so a category needs at
least four to six posts planned before it earns a slug. Categories that cannot
reach that go back into a neighbouring cluster.

Every category needs a real two-sentence description saying what belongs in it and
what does not, because the hub page is indexable published prose and the schema
rejects an empty one.

### 5. Assign pillars and supporting posts

Within each cluster, decide which single post is the authority and which support
it. Then decide the link direction **now**, in the plan, rather than post by post:

- Every supporting post links up to its pillar, with anchor text naming the
  pillar's topic.
- The pillar links down to every supporting post.
- Cross-cluster links happen where the subject genuinely crosses, and not to hit a
  count.

Deciding this in advance is the entire reason to plan. Decided post by post, the
graph becomes whatever the most recent post felt like linking to, and the pillar
never accumulates the inbound links that make it the authority.

Every post in the plan must have at least one planned inbound link before it is
written, because a post with none is an orphan and `agentblog audit` fails it.

### 6. Check what is already answered well

For each planned post, look at what currently ranks and what a generative engine
currently answers. Drop or reframe anything where a well-resourced publisher has
already answered the question completely and you would only be paraphrasing.

Reframe toward what the roster can say and others cannot: a measurement somebody
ran, a failure mode from real operation, a comparison nobody has done, a document
read properly rather than summarised.

**Do not plan by length.** Ahrefs analysed 174,048 pages across 560,346 AI
Overviews and found the correlation between word count and being cited was 0.04,
which is no relationship at all, with 53.4% of cited pages under 1,000 words
(https://ahrefs.com/blog/short-vs-long-content-in-ai-overviews/, 3 December 2025).
Plan the question each post answers. Length follows.

### 7. Write the backlog

Write `content/editorial-plan.md`. It sits outside `content/blog/`, so the content
adapter never reads it and it cannot become a published page by accident.

One table per cluster, plus the entity sentence at the top:

| Target question (as searched) | Role | Category | Author | Links out to | Links in from | Sources already found | Priority |
| ----------------------------- | ---- | -------- | ------ | ------------ | ------------- | --------------------- | -------- |

`Sources already found` is what makes this plan worth more than a list of titles.
When step 3 or step 6 turned up a study, a specification, or a primary document
worth citing, put the URL in the row. The writing skill has a hard rule against
citing anything it did not fetch, so a plan that carries real sources removes the
most expensive part of writing each post.

Prioritise by three things in this order: whether the roster can credibly write it,
whether it completes a hub that is currently too thin to index, and whether anyone
is searching for it. Traffic potential is last, because a hub that never reaches
enough posts never earns the citations any of them would have brought.

### 8. Reconcile the taxonomy

The plan is not finished until `content/categories.json` matches it.

- Adding a category is safe.
- **Removing or renaming a slug that any existing post names in frontmatter fails
  the next build** with `unknown category slug`. Change the posts in the same
  commit, or leave the slug in place until the posts move.
- A fresh install ships four categories that are AgentBlog's own topics. If
  `agentblog-setup` has not replaced them yet, do that here.

Then report: the entity sentence, the categories with their post counts, the
backlog length, which existing posts should be refreshed instead of replaced, and
what the plan cannot do because it is off-site.
