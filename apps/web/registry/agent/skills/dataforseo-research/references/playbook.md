# The research playbook

Reference material for `dataforseo-research`. Read it when you are deciding what
a set of rows means, when you are choosing between two queries that both look
fine, or when a user asks why a recommendation is a recommendation and deserves a
real answer rather than an assertion.

> **License.** This file is prose documentation, licensed CC BY 4.0. See
> `LICENSE-CONTENT` in the AgentBlog repository. Figures quoted from third-party
> research are attributed and remain those authors' work.

> **Scope.** No endpoint paths, parameters, or prices live here. Those are in the
> endpoint cookbook beside this file. This file is about what to conclude.

## Contents

1. What a research run is actually for
2. The evidence, graded, including what is only convention
3. Harvest before you hunt
4. Clustering on SERP overlap
5. Intent, and what a blog can win
6. Reading a SERP as an opportunity
7. The gap is a page-level question
8. Measuring AI citation without lying to yourself
9. Cadence, and what a comparison has to hold constant
10. Anti-patterns, each of which produces a confident wrong answer

---

## 1. What a research run is actually for

A blog gets traffic and citations for queries where three things are true at
once: somebody asks it, this roster can answer it better than what currently
holds the page, and the answer belongs in a blog post rather than on some other
kind of page.

Every instrument in this skill exists to test one of those three. Volume tests the
first. Difficulty, the SERP itself, and the competitor's page test the second.
Intent tests the third. A run that only measures volume has tested one third of
the question and will happily recommend a query the site cannot win with a format
that does not fit.

The output of a run is not a keyword list. It is a ranked set of decisions, each
with the row that supports it, and each pointing at a skill that acts on it.

## 2. The evidence, graded, including what is only convention

Say which of these three a claim is, whenever it decides something expensive.

**Measured here.** Anything read out of a DataForSEO response this run. Positions,
SERP composition, the presence of an AI Overview, the citation counts. These are
observations of a sample at a moment.

**Published research.** Two figures worth carrying, both from Ahrefs, both
correlational and industry rather than peer reviewed:

- Across 75,000 brands, the strongest correlates of AI visibility were off-site:
  YouTube mentions at Spearman 0.737 and branded web mentions at 0.664, against
  backlinks at 0.218 (https://ahrefs.com/blog/ai-brand-visibility-correlations,
  12 December 2025). This is the single most important number in this file,
  because it bounds what any amount of research inside this repository can do.
- Across 174,048 pages in 560,346 AI Overviews, the correlation between word count
  and being cited was 0.04, with 53.4% of cited pages under 1,000 words
  (https://ahrefs.com/blog/short-vs-long-content-in-ai-overviews/, 3 December
  2025). Word count is not a lever. Do not recommend a length.

**Practitioner convention.** Widely used, not established by a study anybody can
point at. The three-shared-URL clustering threshold in section 4 and the
positions 4 to 20 striking-distance band in section 3 are both conventions. They
are good defaults and they are not findings. Do not present either as research,
and do not let a user's specific SERP lose an argument to a rule of thumb.

## 3. Harvest before you hunt

The first question of a first run is not "what should we write". It is "what does
this site already almost rank for", and it is asked with one call against the
user's own domain.

A blog that has been publishing for any length of time ranks for queries nobody
targeted, because posts get read for reasons their authors did not plan. Those
queries are the cheapest inventory available:

- **Positions 4 to 20.** The page is already considered relevant. Something
  specific is missing, and finding it is a reading job on one existing post, not a
  writing job on a new one. The conventional band is 11 to 20, which is page two.
  Widen it to 4, because moving from 7 to 3 changes the click share more than
  moving from 18 to 12 does, and both are within reach of the same edit.
- **A post that fell and did not change.** The post is the same, so the SERP moved
  around it. Either the query drifted, or somebody published something better.
  Look at what now holds the positions above it before touching the post.
- **Two of our URLs on one query.** Cannibalisation. Neither page accumulates the
  signals that would have made one of them the answer. Decide which page owns the
  query, then either merge the other into it or retarget it. Merging is usually
  right, and the internal links have to move with it.

Each of these ends at `refresh-blog-post`, not at `write-blog-post`. A refresh of
a post with inbound links and existing position beats a new post with neither,
and the whole point of running this step first is that the comparison is available
before anybody commits to writing.

## 4. Clustering on SERP overlap

Group queries by what the search engine returns for them, not by how they are
worded.

**The rule.** Two queries whose top ten results share three or more URLs belong
on one page. Zero or one shared URL means two pages. Two is a judgement call, and
the tie-breaker is whether one post could answer both without changing subject.

**Why it beats grouping by wording.** String similarity is a guess about intent.
The SERP is the engine's already-published answer to that guess. When two
differently worded queries return the same pages, the engine has decided they are
one information need, and a site that publishes two posts against them splits its
own signals between two pages that then compete. When two similarly worded
queries return different pages, one post covering both will satisfy neither.

**What this decides beyond the post count.** The query in the cluster with the
broadest SERP overlap across the others is the pillar. The rest are supporting
posts, and they link up to it. That is exactly the structure `plan-blog-content`
needs, and deriving it from measured overlap is better than deriving it from
which query has the highest volume, because volume does not tell you which page
the engine would treat as the parent.

Clustering needs one SERP read per query, so it is the step that decides the
budget. Cluster the ten to twenty finalists, not the six hundred candidates.

## 5. Intent, and what a blog can win

Intent is worth more than volume for a blog, because it decides whether a post is
even the right object.

- **Informational.** The blog's home ground. A post can hold the page and can be
  the thing an answer engine quotes.
- **Commercial investigation.** Comparisons, alternatives, "best" queries. A post
  can win these, and the SERP will tell you whether the current holders are
  editorial or vendor pages. Worth doing when the roster has real grounds for an
  opinion, and a trap when it does not, because an uninformed comparison is the
  most obviously thin thing a blog can publish.
- **Transactional and navigational.** Not a blog post. The SERP wants a product
  page, a pricing page, or a specific brand's own site. Recommending a post here
  produces an article that ranks nowhere and serves nobody.

A 90-a-month informational query this roster can answer completely is worth more
than a 5,000-a-month transactional one it cannot, and a run that sorts by volume
inverts exactly that.

## 6. Reading a SERP as an opportunity

The difficulty score is a summary. The SERP is the evidence, and it answers a
question the score cannot: what would we have to beat.

Read four things off it:

- **Who holds the top five.** Forum threads and thin aggregators are an opening.
  Primary documentation from the vendor the query names is not, at any difficulty
  score, because no post outranks a product's own reference for a question about
  that product.
- **Which SERP features fire.** A featured snippet is a specific extractable
  answer somebody already wrote, and the shape of it tells you what format wins.
  People Also Ask is the cheapest source of real user phrasing in the whole API,
  and that phrasing becomes question-format H2s rather than being paraphrased into
  marketing wording.
- **Whether an AI Overview appears.** Its presence means the click is harder and
  the citation is the prize, which is the format `write-blog-post` already
  produces. It is not a reason to skip a query the site should own, and its
  absence is not a reason to relax the format, because the element appears and
  disappears on the same query over time.
- **Whether the results answer the question the query asks.** When the top ten
  are all adjacent but none of them answers it directly, that is the best finding
  a research run can produce, and no metric in the API reports it.

## 7. The gap is a page-level question

Domain-level competitor overlap tells you who to study. It does not tell you what
to write, because a domain does not rank, a page does.

Work down: find the competing domains by keyword overlap, take the top three, then
pull each one's pages ranked by traffic. Those pages are the brief. Read the ones
that hold the queries in the clusters, and record for each what it actually covers
and where it stops. Where it stops is the post.

Two failure modes here:

- **Studying the businesses instead of the pages.** The sites competing for the
  queries are usually not the companies competing for the customers. A publisher
  with no product often holds more of the subject's queries than any vendor does.
- **Producing a keyword gap and calling it a content gap.** A list of queries a
  competitor ranks for and we do not is not a plan. Most of that list is queries
  this roster should not write about. The gap worth acting on is a query inside a
  cluster we already own, where their page is the reason we do not hold it.

## 8. Measuring AI citation without lying to yourself

This is the part of the API that measures the thing AgentBlog exists to improve,
and it is the easiest place in this skill to produce a confident wrong number.

**Count `sources`, not `search_results`.** The model retrieves far more than it
cites. `search_results` is what it looked at, `sources` is what it used. Counting
retrieval as citation inflates the number dramatically and in the flattering
direction, which is why nobody catches it.

**Read `is_web_search_based`.** A citation produced from training data is not
something this quarter's writing caused, and reporting it as though it were
attributes an outcome to work that could not have produced it.

**Read `fan_out_queries`.** The sub-queries the engine expanded the prompt into
are the only observed rather than guessed view of that expansion available
anywhere in this stack. They are a better source of post targets than any keyword
endpoint, because they are what the engine actually asked on the user's behalf.

**Treat one measurement as a sample.** These models are non-deterministic: the
same prompt run repeatedly returns different answers with different citations. A
single reading is a draw from a distribution, not a value. Two readings taken a
month apart differ for reasons that include the writing and also include the
weather. Report a baseline with its date, its prompt set, its targets, and its
platform attached, and never report the difference between two single
measurements as a trend.

**Say which platform.** Omitting the platform queries both ChatGPT and Google AI
Overview and changes the row count billed. ChatGPT data is United States and
English only, so a non-US site measuring without saying so is reporting a number
about a market it does not sell in.

## 9. Cadence, and what a comparison has to hold constant

A comparison is only a comparison if the question did not change. Hold the
target, the platform, the location, the language, the prompt set, and the limit
constant between runs, and record all six in the snapshot. Change one of them and
you have a new baseline, not a movement, and the honest thing to do is say so and
start the series again.

Sensible defaults, all adjustable and none of them findings:

| Measurement                           | Cadence                                      | Why not more often                                                                   |
| ------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------ |
| Own ranked keywords                   | Monthly                                      | Positions move daily and the noise swamps the signal below a month                   |
| AI citation aggregates                | Monthly, same prompt set                     | Expensive, and non-deterministic enough that weekly readings mostly measure variance |
| Cluster SERPs                         | When a cluster is being planned or replanned | The composition is stable enough that re-reading it monthly buys nothing             |
| Keyword expansion, difficulty, intent | Once, then when the subject changes          | These move over quarters, and they are already on disk                               |

The rule underneath all four rows: re-buy what moves, read what does not.

## 10. Anti-patterns, each of which produces a confident wrong answer

- **Starting with expansion.** The first call of a first run is against the user's
  own domain. Starting with a seed expansion produces six hundred rows and no idea
  which of them the site is already close to.
- **Sorting by volume.** It inverts section 5 and buries every query worth writing.
- **Recommending a word count.** Correlation 0.04. Section 2.
- **Clustering by wording.** Section 4. Produces posts that compete with each
  other, which is worse than not writing the second one.
- **Reporting `search_results` as citations.** Section 8.
- **Comparing two runs that asked different questions.** Section 9. Worse than no
  comparison, because it looks like a result.
- **Attributing a movement to the writing.** Nothing in this API establishes
  cause, and the strongest published correlates of AI visibility are off-site.
  Report the movement, name the plausible causes, and say which one the data
  cannot distinguish.
- **Re-buying what is on disk.** The catalog exists so the second run is a diff.
  A run that re-collects everything has thrown away the only compounding asset
  this skill produces.
