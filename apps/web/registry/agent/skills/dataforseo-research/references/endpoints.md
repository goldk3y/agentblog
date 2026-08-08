# The endpoint cookbook

Reference material for `dataforseo-research`. Read it when you are choosing a
call, and before every call that costs more than a cent.

> **License.** This file is prose documentation, licensed CC BY 4.0. See
> `LICENSE-CONTENT` in the AgentBlog repository. Prices and parameters are
> DataForSEO's and are quoted from https://docs.dataforseo.com/v3/ as read in
> August 2026. Verify them against the account's own price list before spending.

## Contents

1. How to call these, whether over MCP or REST
2. Shared parameters, and the two that are billed
3. Finding candidate queries
4. Qualifying them
5. Competitors, and the gap
6. What the site already ranks for
7. AI Overviews in the SERP
8. Are we cited in AI answers
9. Reading our own pages
10. The price list
11. Traps that cost money quietly

---

## 1. How to call these, whether over MCP or REST

**Do not hardcode MCP tool names.** They are not stable, and at least five of
them currently point at endpoint paths DataForSEO has renamed. List the tools
available in the session, match on the distinctive part of the endpoint path
(`keyword_ideas`, `ranked_keywords`, `search_mentions`), and use what is
actually there.

The REST paths below are the contract. They are read from DataForSEO's own
machine-readable index at https://docs.dataforseo.com/v3/llms.txt and they are
what the MCP tools are wrappers over. When an MCP tool disagrees with a path
here, the path here is the one that is documented.

Every path is prefixed `https://api.dataforseo.com/v3/`. Every POST body is a
JSON array of task objects. Append `.ai` to any path for the trimmed response.

## 2. Shared parameters, and the two that are billed

| Parameter       | Notes                                                                    |
| --------------- | ------------------------------------------------------------------------ |
| `location_code` | Integer. United States is `2840`. Each API family has its own list       |
| `language_code` | `en`. Pair it with the location, never omit it                           |
| `limit`         | Labs default 100, max 1000. The trimmed response defaults it to 10       |
| `offset`        | Paging. LLM Mentions caps at 1000000, then use `search_after_token`      |
| `filters`       | A nested array, not an object. Maximum 8 conditions                      |
| `order_by`      | Array, maximum 3 rules, written as `"field,desc"`                        |
| `tag`           | Your own label, echoed back. Use the run date so responses are traceable |

Filters are nested arrays joined by string operators, which is the shape people
get wrong most often:

```json
[["keyword_info.search_volume", ">", 50], "and", ["keyword_properties.keyword_difficulty", "<", 40]]
```

Look the legal field names up per endpoint at `/dataforseo_labs/available_filters`,
which is free. Guessing a field name returns `40501` and wastes the call.

**Two parameters change the price rather than the result.**
`include_clickstream_data: true` doubles a Labs request. `depth` on a SERP call
is billed per ten results and rounds up, so `depth: 11` costs what `depth: 20`
costs.

## 3. Finding candidate queries

Three Labs endpoints expand a seed, and they do different things. Picking the
wrong one is the most common waste in a first run.

| Endpoint                                          | Returns                                                               | Use it when                                                  |
| ------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------ |
| `dataforseo_labs/google/keyword_suggestions/live` | Long-tail queries **containing** the seed                             | You have the right head term and want its tail               |
| `dataforseo_labs/google/related_keywords/live`    | The "searches related to" graph, expanded by `depth`                  | You want adjacent phrasing you would not have guessed        |
| `dataforseo_labs/google/keyword_ideas/live`       | Keywords in the same **category** as the seeds, need not contain them | You are mapping a subject you do not yet have vocabulary for |

`related_keywords` takes `depth` 0 to 4, returning roughly 1, 8, 72, 584, and
4680 keywords. **Depth 2 is the working default.** Depth 3 and 4 are how a
research run turns into a five-figure row count nobody reads.

For a blog, run `keyword_ideas` once per cluster on two or three seeds, then
`keyword_suggestions` on the handful of terms that survive. Both cost
$0.012 per call plus $0.00012 per row.

## 4. Qualifying them

Two endpoints take up to 1,000 keywords in a single call, which makes them the
cheapest per-keyword instruments in the whole API. Batch aggressively.

- `dataforseo_labs/google/bulk_keyword_difficulty/live` returns difficulty 0 to
  100 for up to 1,000 keywords.
- `dataforseo_labs/google/search_intent/live` returns intent and a probability
  for up to 1,000 keywords.

`dataforseo_labs/google/keyword_overview/live` returns volume, CPC, competition,
intent, and monthly series together, but it **caps at 700 keywords**, not 1,000.
Assuming a uniform cap fails on exactly this endpoint.

For volume specifically, `keywords_data/google_ads/search_volume/live` is Google
Ads data at $0.09 per call for up to 1,000 keywords. That is cheaper per keyword
than anything in Labs when all you need is volume.

**Intent is worth more than volume for a blog.** A 90-a-month informational query
that the roster can answer completely is worth more than a 5,000-a-month
transactional one that wants a product page.

## 5. Competitors, and the gap

Start by finding out who the actual competitors are rather than assuming. The
sites competing for the queries are usually not the businesses competing for the
customers.

- `dataforseo_labs/google/competitors_domain/live` ranks domains by how much
  their ranked keyword set overlaps ours.
- `dataforseo_labs/google/serp_competitors/live` does the same for a specific
  keyword set, which is the better instrument once clusters exist.

Then find the gap:

- `dataforseo_labs/google/domain_intersection/live` returns keywords where two
  domains both rank. Invert it with filters to get what they rank for and we do
  not, which is the content gap.
- `dataforseo_labs/google/relevant_pages/live` returns a competitor's pages
  ranked by traffic, which tells you which of their posts to study.
- `dataforseo_labs/google/page_intersection/live` does the same comparison at URL
  level rather than domain level. It is the one to reach for once you know which
  of their posts holds the cluster, because it answers what that page ranks for
  and ours does not, which is a brief. The domain-level version answers a question
  no single post can act on.

## 6. What the site already ranks for

`dataforseo_labs/google/ranked_keywords/live` returns every keyword a domain,
subdomain, or single page ranks for, with positions and SERP features.

Run this on the user's own domain in the first session. It is routinely the most
surprising output of a baseline run, because a blog usually ranks for a set of
queries nobody targeted, and those are the cheapest wins available: positions 4
to 20 on a query the site already half-answers beat a new post on a query it does
not answer at all.

`dataforseo_labs/google/domain_rank_overview/live` gives the distribution and
traffic estimate in one cheap call.

**The historical variants cost ten times their siblings.**
`historical_rank_overview`, `historical_bulk_traffic_estimation`, and
`domain_metrics_by_categories` are $0.12 per call plus $0.0012 per row, against
$0.012 plus $0.00012. Do not reach for them to answer a question the snapshot
files in `content/research/snapshots/` already answer, because after the second
run this skill has its own history and does not need to buy DataForSEO's.

## 7. AI Overviews in the SERP

`serp/google/organic/live/advanced` returns `ai_overview` as one item type
alongside `organic`, `featured_snippet`, and `people_also_ask`.

**`load_async_ai_overview` defaults to `false`, and with the default you get AI
Overview items from cache only.** Google loads these asynchronously, so the
default silently under-reports how often an AI Overview appears. Set it to
`true`. It adds $0.002, refunded when the element turns out not to be there.

This is the single most important parameter in this file. A run that leaves it
alone produces a report saying AI Overviews are rare for these queries, which is
a statement about DataForSEO's cache rather than about Google.

`people_also_ask_click_depth` from 1 to 4 expands the People Also Ask box into
real question phrasing at $0.00015 per click, refunded for clicks not performed.
That phrasing is the raw material for question-format headings, and it is the
cheapest source of real user wording in the API.

Google AI Mode has its own endpoint at `serp/google/ai_mode/live/advanced`, at
$0.004 live. Its `keyword` accepts up to 700 characters, because the queries
people put into AI Mode are sentences.

## 8. Are we cited in AI answers

This is the part of the API that measures the thing AgentBlog exists to improve.
It is also the most expensive per call and the least stable per measurement, so
read section 11 and the playbook before spending here.

| Endpoint                                                  | Returns                                       |
| --------------------------------------------------------- | --------------------------------------------- |
| `ai_optimization/llm_mentions/target_metrics/live`        | Citation metrics for one target, ours         |
| `ai_optimization/llm_mentions/multi_target_metrics/live`  | The same for several targets at once          |
| `ai_optimization/llm_mentions/top_mentioned_domains/live` | Who owns the answers in this subject          |
| `ai_optimization/llm_mentions/top_mentioned_pages/live`   | Which individual pages get cited              |
| `ai_optimization/llm_mentions/search_mentions/live`       | The underlying prompts and answers            |
| `ai_optimization/llm_mentions/top_mentioned_brands/live`  | Which brands own the subject, ours among them |
| `ai_optimization/llm_mentions/historical/live`            | DataForSEO's own series for a target          |
| `ai_optimization/llm_mentions/timeseries_delta/live`      | Change over a period                          |
| `ai_optimization/llm_mentions/timeseries_new_lost/live`   | What was gained and lost between two points   |

The last three are the exception to the rule that this skill buys its own history.
On a first run there is nothing in `content/research/snapshots/` to compare
against, so DataForSEO's series is the only past available and is worth the call
once. From the second run on, the snapshots answer the same question for nothing,
and the reason to keep buying these is a longer window than the catalog has yet,
not convenience.

`top_mentioned_brands` is the honest version of the share-of-voice number people
ask for. Read it as the standings in a subject rather than as a score.

Each has a `_lite` variant returning a simplified shape for less money. Prefer
the aggregate endpoints and the lite variants. `search_mentions` with `limit: 1000`
is $1.10 for one call, because the pricing is $0.10 per request plus $0.001 per
row.

**The field pair that decides whether the answer is right.** Each result carries
both `sources`, which the model actually cited, and `search_results`, which it
retrieved and may never have used. Counting `search_results` overstates citation
dramatically. `sources` is the number.

Two other fields are worth reading every time. `is_web_search_based` says whether
the model used live retrieval or answered from training, and a citation from
training is not something this quarter's writing caused. `fan_out_queries` is the
set of sub-queries the engine expanded the prompt into, which is the only
observed rather than guessed view of that expansion available here.

**Constraints.** `target` takes up to 10 entities and at least one must be an
`include`. `platform` is optional, and omitting it queries both ChatGPT and
Google AI Overview, which changes the row count you are billed for. ChatGPT data
is **United States and English only**.

`ai_optimization/ai_keyword_data/keywords_search_volume/live` returns an
`ai_search_volume` per keyword for up to 1,000 keywords at $0.01 plus $0.0001 per
row. Read DataForSEO's own note on it before quoting it: the values are
"calculated using statistical data from questions in the People Also Ask SERP
element". It is a modelled proxy for prompt volume, not observed LLM traffic, and
presenting it as the latter is the kind of claim `agentblog audit` exists to
catch elsewhere.

## 9. Reading our own pages

`on_page/content_parsing/live` returns a page's headings, links, and text as
structure. It answers whether the answer capsule is really the first thing under
the heading, and whether the H2s are really questions, against what the server
sent rather than against the MDX source.

`on_page/instant_pages` audits a single page with no crawl task at $0.00015.

Neither replaces the raw `curl` with a bot user agent in the `agentblog-audit`
skill. That check exists precisely because it has no tooling in the path.

## 10. The price list

Published prices, August 2026. **Read the account's real ones from the free
`/appendix/user_data` before estimating**, because they differ by plan.

| Call                                      | Price                                          |
| ----------------------------------------- | ---------------------------------------------- |
| Labs, standard endpoints                  | $0.012 per call plus $0.00012 per row          |
| Labs, historical variants                 | $0.12 per call plus $0.0012 per row            |
| Google Ads search volume, live            | $0.09 per call, up to 1,000 keywords           |
| SERP organic, task based, normal priority | $0.0006 per SERP                               |
| SERP organic, live                        | $0.002 per SERP                                |
| SERP organic, `load_async_ai_overview`    | plus $0.002, refunded if absent                |
| People Also Ask, per click                | $0.00015                                       |
| SERP AI Mode, live                        | $0.004                                         |
| AI keyword search volume                  | $0.01 per call plus $0.0001 per row            |
| LLM Mentions                              | $0.10 per call plus $0.001 per row             |
| LLM Responses, live                       | $0.0006 plus the model provider's token charge |
| OnPage, basic per page                    | $0.00015                                       |

A first baseline run for one blog, done the way the playbook describes, costs
well under a dollar if the AI citation section is aggregates only. It costs
several dollars if `search_mentions` is called at full limit. That difference is
the whole reason the cost gate exists.

**Live costs about 3.3 times the task-based price for the same SERP data.** When
a run needs many SERPs and can wait, post the tasks and collect them. When it
needs one, pay for live.

## 11. Traps that cost money quietly

Each of these produces a plausible answer, so nothing looks wrong.

- **`load_async_ai_overview` left at `false`.** Section 7. Reports cache as
  reality.
- **Counting `search_results` instead of `sources`.** Section 8. Inflates
  citation.
- **A search operator in a `keyword`.** `site:`, `intitle:`, `inurl:` and eleven
  others multiply the SERP price by **five**, with no warning. Filter after the
  call instead.
- **`include_clickstream_data: true`.** Doubles a Labs request for data a blog
  workflow rarely reads.
- **`depth` above 10 on SERP calls.** Billed per ten and rounded up.
- **The historical Labs endpoints.** Ten times the price of the snapshot you
  already store.
- **`limit: 1000` on LLM Mentions.** $1.10 per call.
- **Reading only the top-level `status_code`.** It can be `20000` over a failed
  task. Check `tasks_error` and each `tasks[i].status_code`.
- **Treating one AI citation measurement as a fact.** The playbook covers why.
