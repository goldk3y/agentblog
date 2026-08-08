---
name: dataforseo-research
description: >
  Runs keyword, competitor, SERP, and AI citation research through DataForSEO, and
  keeps it. Reads the research catalog in content/research/ before spending
  anything: with no catalog it establishes a baseline of what the site ranks for,
  who owns the answers, and which queries are worth a post; with a catalog it
  re-asks the same questions, diffs against the stored snapshots, and reports what
  moved. Produces clusters built from SERP overlap, striking-distance wins,
  competitor page gaps, and a citation baseline, written to disk so the next run
  compares rather than repeats. Use when asked to research keywords or topics,
  find what to write about next, size an opportunity, check what a site ranks for,
  measure AI, LLM, or AI Overview visibility, analyse competitors, or put real
  numbers under a content plan.
argument-hint: '[topic, domain, or question]'
allowed-tools: Read Write Edit Glob Grep WebFetch Bash(curl *) Bash(npx agentblog *) Bash(git check-ignore *) Bash(claude mcp list)
license: MIT
compatibility: A Next.js project with AgentBlog installed, plus a DataForSEO account. Works over the DataForSEO MCP server or plain REST.
metadata:
  package: agentblog
  homepage: https://agentblog.dev
---

# Research the blog, and keep the research

Every other AgentBlog skill decides something. This one is the evidence those
decisions stand on, and it is the only skill that leaves durable state behind.

That state is the point. A research run that answers a question and evaporates is
a run the user pays for again next month, against a different sample, with no way
to tell a real change from a different question. A run that writes itself down
turns the second run into a diff, which is cheaper, faster, and the only thing
that can say whether the writing is working.

So the first move is never a query. **It is to look at `content/research/` and
find out what this project already knows.** That costs nothing, it decides
everything after it, and skipping it is how an agent bills a user for the answer
they already have on disk.

## The money rule

**Never make a billable call before printing an estimate and getting the user to
approve it.** DataForSEO is prepaid and real. A loop that expands a seed at depth
4 and then reads a SERP per row can spend a hundred dollars in one turn while
looking exactly like a run that spent forty cents.

Three things are free and none of them need approval: reading `content/research/`,
`GET /v3/appendix/user_data`, and any call sent to the sandbox host. Do all of
them first. Everything else waits for a yes.

```
- [ ] 1. Read the catalog before touching the API
- [ ] 2. Reach a working call
- [ ] 3. Decide which run this is, price it, get a yes
- [ ] 4. Baseline run, or
- [ ] 5. Delta run, or targeted run
- [ ] 6. Turn rows into decisions
- [ ] 7. Write the catalog back
- [ ] 8. Report, and hand off
```

Reference material, all one level down and all optional until you need it:

- **Access, credentials, MCP against REST, failure codes**: see
  [references/setup.md](references/setup.md).
- **Which endpoint answers which question, and what it costs**: see
  [references/endpoints.md](references/endpoints.md).
- **How to read the rows as editorial decisions**: see
  [references/playbook.md](references/playbook.md).
- **The on-disk catalog format and the comparison protocol**: see
  [references/catalog.md](references/catalog.md).

### 1. Read the catalog before touching the API

Glob `content/research/`. Then read, in this order, whatever exists:

- `content/research/ledger.md`, the append-only index of every run.
- `content/research/baseline.md`, the current standing answers.
- The filenames in `content/research/snapshots/`, which tell you what was
  measured and when without reading any of them.

Read the newest snapshot only for the question you are about to ask. The others
stay on disk costing nothing.

Also read what the research is for, because research nobody can act on is not
worth buying: `agentblog.config.ts` for the site URL and brand, `content/authors.json`
for what this roster can credibly write, `content/categories.json` for the current
taxonomy, `content/editorial-plan.md` if `plan-blog-content` has run, and the
posts in `content/blog/`.

Then say out loud which of the three states you are in, because the rest of the
run differs:

| On disk                                          | State                                 | Go to                 |
| ------------------------------------------------ | ------------------------------------- | --------------------- |
| No `content/research/`                           | First contact. Nothing is known       | Step 4                |
| A ledger with runs in it                         | There is a history to compare against | Step 5                |
| A ledger, and the user asked one narrow question | Targeted                              | Step 5, narrow branch |

### 2. Reach a working call

Climb this ladder and stop at the first rung that works. Do not install anything
without asking.

1. **MCP tools already in the session.** List them and match on the distinctive
   part of the endpoint path (`ranked_keywords`, `keyword_ideas`, `search_mentions`).
   Never hardcode an MCP tool name: they are not stable, and several currently
   point at paths DataForSEO has renamed.
2. **`DATAFORSEO_USERNAME` and `DATAFORSEO_PASSWORD` in the environment**, or in
   `.env.local`. Use REST.
3. **Neither.** Stop. Give the user the registration and credentials steps from
   [references/setup.md](references/setup.md) and offer to configure the MCP
   server, which needs a session restart and is therefore their call.

Then prove the credentials work before believing anything:

```bash
set -a; [ -f .env.local ] && . ./.env.local; set +a
curl -s -u "$DATAFORSEO_USERNAME:$DATAFORSEO_PASSWORD" \
  "https://api.dataforseo.com/v3/appendix/user_data"
```

Free, and it returns three things the run needs: `money.balance`, so you know
whether the plan can finish; the account's real `price` map, which differs by
plan and beats every published figure; and whether an LLM Mentions subscription
exists at all, which decides whether the AI citation half of this skill is
available.

**A connected MCP server is not an authenticated one.** It builds a valid header
out of two empty strings and reports itself connected, then returns 401 on every
call. `references/setup.md` section 3 has the reason and the fix.

### 3. Decide which run this is, price it, get a yes

Write the plan as a table before spending: each call, why it is in the run, the
row limit, and the cost from the account's own price map. Total it. Show the
balance next to the total.

Then cut it. A first baseline for one blog is well under a dollar when the AI
citation section is aggregates only, and several dollars the moment
`search_mentions` runs at full limit. Most of the value is in the cheap half.

Two habits that keep the estimate honest:

- **Batch everything that batches.** `bulk_keyword_difficulty` and `search_intent`
  take 1,000 keywords per call. `keyword_overview` takes 700, not 1,000. Sending
  200 keywords one at a time costs 200 times what one call costs and returns the
  same rows.
- **Tag every call with the run date**, so the response can be traced back to the
  question later. `tag` is echoed back and costs nothing.

If the balance cannot cover the plan, say so and propose the shorter plan
explicitly. Do not quietly run a smaller version and present it as the whole
thing: a report missing its AI citation section reads exactly like a site with no
AI citations.

### 4. Baseline run

The order matters, because each step narrows the next one and the cheapest
findings come first.

**4a. Harvest before you hunt.** `ranked_keywords` on the user's own domain, then
`domain_rank_overview` for the distribution. This is routinely the most surprising
output of a first run, because a blog usually ranks for queries nobody targeted.
Positions 4 to 20 on a query the site already half-answers beat a new post on a
query it does not answer at all, and they cost a refresh rather than an article.

**4b. Find out who the competitors actually are.** `competitors_domain` on the
domain. The sites competing for the queries are usually not the businesses
competing for the customers, and assuming otherwise is how a research run studies
the wrong sites carefully. Take the top three by keyword overlap, then `relevant_pages`
on each to see which of their posts carry the traffic. Those pages are the real
brief.

**4c. Expand, once, deliberately.** `keyword_ideas` on two or three seeds per
subject when you do not yet have the vocabulary, `keyword_suggestions` on the head
terms when you do, `related_keywords` at **depth 2** when you want phrasing you
would not have guessed. Depth 3 and 4 return 584 and 4,680 rows and are how a
research run becomes a spreadsheet nobody opens.

**4d. Qualify in bulk.** Push every candidate through
`bulk_keyword_difficulty` and `search_intent` in batched calls. Cheapest
instruments in the API per keyword. Drop everything the site cannot plausibly
rank for and everything whose intent wants a page this blog is not.

**4e. Read the SERPs of the finalists.** Ten to twenty queries, one
`serp/google/organic/live/advanced` each, with **`load_async_ai_overview: true`**
and `people_also_ask_click_depth: 2`.

This one call does four jobs: it shows whether an AI Overview fires, it shows who
holds the page, it gives you the People Also Ask phrasing that becomes question
headings, and its top-10 URL sets are what you cluster on in step 6.

`load_async_ai_overview` defaults to `false`, and at the default you get AI
Overview items from cache only. A run that leaves it alone reports that AI
Overviews are rare for these queries, which is a statement about DataForSEO's
cache and not about Google.

**4f. Take an AI citation baseline, aggregates only.** `top_mentioned_domains` for
the subject, and `target_metrics` for the site. Skip `search_mentions` on a first
run unless the user asks for the underlying prompts and accepts the price.

Record the exact prompt set, targets, platform, and date. Everything this section
is worth later depends on the next run asking the identical question.

### 5. Delta run, or targeted run

**The cheapest useful run is a diff, not a re-collection.** Something is already
on disk. Re-ask only what can have changed, and read the rest.

Re-measure: `ranked_keywords` on the domain, and the AI citation aggregates
against the same targets, platform, and prompt set as last time. Both move.

Do not re-measure: keyword expansion, difficulty, and intent. Those move slowly,
they are on disk, and re-buying them produces a diff full of rounding.

Then compare against the stored snapshot and report the four movements that
matter. Each one hands off somewhere different, which is why they are worth
separating rather than reporting as churn:

| Movement                                         | What it means                    | Hand to                             |
| ------------------------------------------------ | -------------------------------- | ----------------------------------- |
| A post fell several positions and did not change | Decay, or somebody else improved | `refresh-blog-post`                 |
| A query newly ranks at 4 to 20                   | Striking distance, unplanned     | `refresh-blog-post`                 |
| Two of our URLs rank for one query               | Cannibalisation                  | Merge, or differentiate the targets |
| A competitor page appeared where we were         | A specific page to beat          | `plan-blog-content`                 |

**Targeted branch.** When the user asked one narrow question, answer that
question and nothing else. Check the catalog first: if a snapshot from the last
few weeks already answers it, say so, quote it, and ask whether it is worth
re-buying. Then append the run to the ledger anyway, because a targeted answer is
still research and the next run should know it happened.

### 6. Turn rows into decisions

Rows are not a finding. [references/playbook.md](references/playbook.md) has the
reasoning and the honest limits. These five decide most runs, and they are here
rather than in the reference file because a rule you have to fetch is a rule you
will skip.

- **Cluster on SERP overlap, not on wording.** Two queries whose top ten share
  three or more URLs are one post, because Google has already decided they are
  one information need. Writing both is how a site competes with itself. Zero or
  one shared URL means two posts.
- **Intent decides the format before volume decides anything.** An informational
  query the roster can answer completely is worth more to this blog than a
  transactional query with ten times the volume, because the transactional SERP
  wants a product page and will not give the slot to a post.
- **Read the SERP, not the difficulty score.** A page of forum threads is an
  opening. A page of documentation from the vendor whose product the query names
  is not, at any difficulty score.
- **An AI Overview changes the target, not the decision.** Its presence means the
  click is going to be harder to win and the citation is the prize, which is the
  format `write-blog-post` already produces. Absence is not a reason to skip a
  query the site should own.
- **One AI citation measurement is not a fact.** These models are
  non-deterministic, so a single reading is a sample. Report the baseline as a
  sample with its date and prompt set attached, and never report a change from
  one measurement to one other measurement as a trend.

Then rank what survives by what the roster can credibly write, then by what
completes a hub too thin to index, and put raw volume last. That order comes from
`plan-blog-content` and this skill feeds it, so contradicting it here would just
produce a plan that gets reordered.

### 7. Write the catalog back

[references/catalog.md](references/catalog.md) has the exact file shapes. The
three rules that matter:

- **Snapshots are immutable.** Date-prefixed, never edited, never deleted. A
  rewritten snapshot destroys the only baseline the next run had.
- **The ledger is append-only**, one row per run, with the cost actually spent.
- **`baseline.md` is rewritten every run**, and git holds the previous version,
  which is what makes the diff reviewable by a person.

Store the request alongside the response. A snapshot without the exact body that
produced it cannot be re-asked identically, and a comparison between two
different questions is worse than no comparison, because it looks like a result.

`content/research/` sits outside `content/blog/`, so the content adapter never
reads it and none of it can become a published page by accident.

### 8. Report, and hand off

Report in this shape:

1. **What was already known**, from the catalog, and what this run added.
2. **What moved**, on a delta run, with the previous value beside the new one.
3. **The decisions**, as a short ranked list, each with the row that supports it.
4. **What was spent**, against the estimate, and the balance now.
5. **What is missing and why**, naming any section that a degraded state removed.

Then hand off by name rather than continuing:

- Clusters and priorities go to `plan-blog-content`, which turns them into
  `content/editorial-plan.md` with the link graph settled.
- Decayed and striking-distance posts go to `refresh-blog-post`.
- New posts go to `write-blog-post`, carrying the People Also Ask phrasing as the
  headings and the cited sources already found.

**What this cannot tell you.** DataForSEO measures the SERP and the answer, not
the cause. Nothing here establishes that a change in the writing produced a change
in the numbers, and the strongest published correlates of AI visibility are
off-site anyway. A research run that reports a rank movement as the result of last
month's posts has invented a causal claim out of two measurements, which is
exactly the kind of unsupported number `agentblog audit` exists to catch in the
posts themselves. Report what was observed, and say what is unexplained.
