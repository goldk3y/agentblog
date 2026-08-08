# The research catalog

Reference material for `dataforseo-research`. Read it before writing anything
into `content/research/`, and before comparing a new measurement against an old
one.

> **License.** This file is prose documentation, licensed CC BY 4.0. See
> `LICENSE-CONTENT` in the AgentBlog repository.

## Contents

1. Why the research lives in the repository
2. The layout
3. `ledger.md`, the index every run reads first
4. `baseline.md`, the current standing answers
5. `snapshots/`, and the rule that makes them worth keeping
6. The `_meta` block, which is what makes a snapshot re-askable
7. Bootstrapping the directory on a first run
8. The comparison protocol
9. Size, and what to do when the directory gets big
10. What must never be written here

---

## 1. Why the research lives in the repository

Because the next agent is not this one.

A research finding held in a conversation dies with the session. The user then
asks the same question next month, a different agent runs a different query
against a different sample, and the two answers disagree for reasons nobody can
reconstruct. That is not research, it is repeated purchasing.

Committing the research to the repository fixes three things at once. Any agent in
any session can read what is already known before spending. Git holds the previous
version of every file, so a change is a reviewable diff rather than an assertion.
And the raw responses stay available, so a later question can often be answered
from disk for nothing.

`content/research/` sits outside `content/blog/`, so the content adapter never
reads it and nothing in it can become a published page by accident. This is the
same placement `content/editorial-plan.md` already uses.

## 2. The layout

```
content/research/
├── README.md                     written once, for the human who finds this directory
├── ledger.md                     append-only index of every run
├── baseline.md                   the current standing answers, rewritten each run
└── snapshots/
    ├── 2026-08-08-account.json
    ├── 2026-08-08-ranked-keywords.json
    ├── 2026-08-08-competitors.json
    ├── 2026-08-08-candidates.json
    ├── 2026-08-08-serp-chunking-strategies.json
    └── 2026-08-08-ai-citations.json
```

Every snapshot filename is `YYYY-MM-DD-<what>.json`, using the date the call was
made rather than the date the file was written. Sorting the directory sorts the
history, and the filenames alone tell a new agent what has been measured without
reading a byte of JSON.

Use these `<what>` names, and add new ones rather than overloading an existing
one: `account`, `ranked-keywords`, `competitors`, `competitor-pages`,
`candidates`, `serp-<cluster-slug>`, `ai-citations`, `ai-prompts`.

## 3. `ledger.md`, the index every run reads first

The ledger is the whole point of the catalog. It is the one file a run must read
before it does anything else, and it is append-only: correct a mistake by adding
a row that says so, never by editing history.

```markdown
# Research ledger

Every DataForSEO run against this project. Append only. Newest last.

Site: https://example.com
Location: 2840 (United States), language `en`, unless a row says otherwise.

| Date       | Type     | Questions asked                                  | Snapshots                                                                        | Spent  | What changed                                                                  |
| ---------- | -------- | ------------------------------------------------ | -------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------- |
| 2026-08-08 | baseline | What do we rank for, who competes, what to write | ranked-keywords, competitors, candidates, serp-chunking-strategies, ai-citations | $0.71  | First run. 214 ranked keywords, 9 in positions 4 to 20, 0 AI citations found  |
| 2026-09-05 | delta    | What moved in rankings and AI citations          | ranked-keywords, ai-citations                                                    | $0.34  | 3 posts gained, 1 fell 6 places without changing, first citation on 2 prompts |
| 2026-09-11 | targeted | Is "rag evaluation metrics" worth a post         | serp-rag-evaluation                                                              | $0.004 | Yes. Top 5 is forum threads and one vendor blog from 2024                     |
```

Then a short prose section under the table for anything a cell cannot hold: a
prompt set that changed and why, a degraded run and which section it lost, a
finding that needed a sentence.

## 4. `baseline.md`, the current standing answers

One file that answers, right now, the questions a run exists to answer. Rewritten
in full every run. Git holds the previous version, and that diff is the most
readable artefact this skill produces, so keep the section order stable between
runs or the diff becomes noise.

```markdown
# Research baseline

Last updated 2026-09-05 from the run of the same date. Every number here is a
sample, with the snapshot that produced it named beside it.

## What the site ranks for

217 keywords, 12 in positions 4 to 20. Source: 2026-09-05-ranked-keywords.json.

| Query | Position | Was | Our URL | Action |
| ----- | -------- | --- | ------- | ------ |

## Who competes for these queries

## The clusters, and the pillar of each

| Cluster | Pillar query | Members | Shared URLs | Intent | AI Overview |
| ------- | ------------ | ------- | ----------- | ------ | ----------- |

## AI citation

Prompt set of 12, ChatGPT and Google AI Overview, United States, English.
Baseline taken 2026-08-08, re-measured 2026-09-05. Source: 2026-09-05-ai-citations.json.
Non-deterministic: read these as samples, not values.

## Open questions this research has not answered
```

That last section is not decoration. It is what stops the next run from starting
over: it says what was deliberately left unmeasured and what it would cost.

## 5. `snapshots/`, and the rule that makes them worth keeping

**A snapshot is immutable.** Never edit one, never delete one, never overwrite one
because a call was re-run the same day. A snapshot is the record of what an API
returned at a moment, and rewriting it destroys the only baseline the next
comparison had. If a call is repeated on the same date, suffix the second one
(`2026-08-08-ranked-keywords-2.json`) and say in the ledger why.

Store the trimmed response, not a summary. The trimmed `.ai` response costs the
same as the full one and is already stripped of the fields nobody reads. A summary
written now cannot answer a question asked later, and the whole reason to keep
these is that later questions are free to answer from disk.

Set `limit` explicitly on every call that goes into a snapshot. The trimmed
response defaults `depth` and `limit` to 10, so a snapshot taken without an
explicit limit is silently ten rows, and a comparison against a later run that set
one will show a gain that is entirely an artefact of the request.

## 6. The `_meta` block, which is what makes a snapshot re-askable

Every snapshot file is an object with two keys: the request that produced it, and
the response. Not the bare response.

```json
{
  "_meta": {
    "run": "2026-09-05",
    "type": "delta",
    "endpoint": "dataforseo_labs/google/ranked_keywords/live.ai",
    "transport": "rest",
    "request": [
      {
        "target": "example.com",
        "location_code": 2840,
        "language_code": "en",
        "limit": 500,
        "tag": "2026-09-05-delta"
      }
    ],
    "status_code": 20000,
    "tasks_error": 0,
    "cost": 0.072,
    "compares_to": "2026-08-08-ranked-keywords.json"
  },
  "response": {}
}
```

`request` is the load-bearing field. A snapshot without the exact body that
produced it cannot be re-asked identically, and a comparison between two different
questions is worse than no comparison because it looks like a result. `compares_to`
names the snapshot this one is a successor of, which turns the directory into a
series rather than a pile.

Record `status_code` and `tasks_error` from the response, both of them. The
top-level status can be `20000` over a failed task, so a snapshot that stored only
the top-level code can be a record of a failure that reads as a success.

## 7. Bootstrapping the directory on a first run

Create all four paths in the same commit as the first run's data, so the directory
is never half-formed.

`README.md` is written once and then left alone. It exists for the human who finds
this directory in a diff and wonders what it is:

```markdown
# Research

DataForSEO research for this blog, kept in the repository so it compounds.

- `ledger.md` is the index of every run. Read it first.
- `baseline.md` is the current standing answer to what we rank for, who competes,
  and what to write next. It is rewritten each run; git holds the previous one.
- `snapshots/` holds the raw API responses, dated and immutable.

The `dataforseo-research` skill maintains all of this. It reads the ledger before
spending anything, so it can tell you what is already known rather than buying it
again. Nothing here is published: the blog only reads `content/blog/`.
```

Do not gitignore this directory. Committing it is the mechanism, not a side
effect. The files carry no credentials, and the responses are data the account
already paid for.

## 8. The comparison protocol

Run this whenever a snapshot has a predecessor.

1. **Confirm the questions match.** Compare the two `_meta.request` bodies field by
   field. Target, platform, location, language, limit, filters, and prompt set all
   have to be identical. If any differs, this is a new baseline. Say so in the
   ledger, start the series again, and do not report a movement.
2. **Diff the rows, keyed on the stable identifier.** Keyword for keyword rows,
   URL for page rows, prompt for citation rows. Never diff by array position: the
   ordering is not stable and a reordered response reads as total churn.
3. **Classify each difference** as new, lost, improved, declined, or unchanged.
   The counts of each are the headline, and they belong in the ledger row.
4. **Separate what moved from what was not asked last time.** A row that is new
   because the earlier run used a smaller limit is not a gain. This is the failure
   that step 1 and the explicit-limit rule in section 5 exist to prevent, and it
   is the most common way a delta run reports a fictional improvement.
5. **Attribute nothing.** Report the movement and the plausible causes. Nothing in
   this data distinguishes a change caused by the writing from a change caused by
   a competitor, an algorithm update, or, for the citation numbers, sampling.

## 9. Size, and what to do when the directory gets big

Snapshots are small. A 500-row trimmed Labs response is on the order of a hundred
kilobytes, so a monthly cadence produces a directory a reader can still browse
after several years, and the git history is the point rather than a cost.

Two limits worth respecting anyway. Do not commit a `search_mentions` response at
`limit: 1000` unless the run needed it, because that is a large file for data
mostly summarised elsewhere. And do not store raw HTML SERP responses: keep the
advanced JSON, which is what every comparison reads.

If the directory ever does need pruning, prune the middle of a series and keep the
endpoints, then record in the ledger which files were removed. Never prune the
oldest snapshot in a series: it is the baseline every long comparison runs
against.

## 10. What must never be written here

- **Credentials.** Not in a `_meta` block, not in a shell snippet copied into the
  ledger, not in a README. They live in the environment or in `.env.local`, and
  `git check-ignore .env.local` is the check to run before touching that file. A
  committed API password is a bill somebody else can run up.
- **A summary in place of a response.** Section 5.
- **An estimate in the ledger's `Spent` column.** Record what was actually spent,
  read back from the account. An estimate recorded as a fact makes the whole
  column useless for budgeting the next run.
- **A finding without the snapshot that supports it.** Every number in
  `baseline.md` names its source file. A number with no source cannot be checked,
  cannot be re-derived, and is indistinguishable from one that was invented.
