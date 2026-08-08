---
'agentblog': minor
---

Add a seventh agent skill, `dataforseo-research`, and wire it into the agent kit.

The other six skills apply a format. None of them can tell you whether it is
working, so every decision about what to write next was inference: `plan-blog-content`
mined queries out of web search results, and nothing measured what the site
already ranked for or whether an answer engine had ever cited it. This skill is
the evidence layer under the other six, and it is the only one that leaves state
behind.

**It reads before it spends.** DataForSEO is prepaid, and a keyword expansion at
depth 4 followed by a SERP read per row spends real money while looking exactly
like a run that spent forty cents. So the first move is never a query: the skill
globs `content/research/`, reads the ledger of what this project already knows,
probes the free `/appendix/user_data` endpoint for the account's live balance and
its actual per-endpoint prices, then prints a costed plan and waits for a yes.
Nothing billable happens before that.

**Runs compound instead of repeating.** Each run writes back to
`content/research/`: an append-only `ledger.md` with the cost actually spent, a
`baseline.md` of the current standing answers that git diffs between runs, and
dated immutable snapshots under `snapshots/` carrying the exact request body
beside the response. That last part is what makes a comparison valid. A snapshot
without the body that produced it cannot be re-asked identically, and two runs
that asked different questions produce a diff that reads as a result. With a
catalog on disk the second run re-measures only what moves, reads the rest, and
reports a delta.

**It is strategy rather than a query wrapper.** The skill carries four reference
files: how to get access and read a failure code, which endpoint answers which
question and what it costs, the on-disk catalog format and the comparison
protocol, and a playbook for turning rows into editorial decisions. The playbook
is the point. It grades its own evidence into what was measured this run, what
comes from published research, and what is only practitioner convention, and the
decisions it teaches are the ones professionals actually make: harvest the
positions 4 to 20 the site already holds before hunting new queries, cluster on
SERP overlap rather than on wording so the site stops competing with itself, let
intent decide the format before volume decides anything, read the SERP rather
than the difficulty score, and treat a single AI citation reading as a sample
from a non-deterministic process rather than as a value.

**Findings hand off by name.** Decayed and striking-distance posts go to
`refresh-blog-post`, clusters and priorities to `plan-blog-content`, new posts to
`write-blog-post` carrying the People Also Ask phrasing as headings.
`plan-blog-content` and `refresh-blog-post` now check `content/research/` before
falling back to inference.

Two traps in the DataForSEO API are called out because each produces a plausible
wrong answer rather than an error: `load_async_ai_overview` defaults to `false`,
so a run that leaves it alone reports on DataForSEO's cache and not on Google,
and each LLM Mentions result carries both `sources` and `search_results`, where
counting the latter inflates citation dramatically and in the flattering
direction.

The skill needs a DataForSEO account, which no other skill does. Without one it
explains how to get credentials rather than guessing at numbers. It works over
the DataForSEO MCP server or plain REST, and it never installs an MCP server
without asking, because that writes to configuration the user owns.

`@agentblog/blog` now writes 81 files rather than 76.
