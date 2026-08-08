# GEO playbook

Reference material for `write-blog-post` and `refresh-blog-post`. Load it when you
are choosing between techniques, or when a user asks why a suggestion matters and
deserves a real answer rather than an assertion.

> **License.** This file is prose documentation, licensed CC BY 4.0. See
> `LICENSE-CONTENT` in the AgentBlog repository. Figures quoted from third-party
> research below are attributed to their sources and remain those authors' work.

> **Scope.** This file deliberately contains no Next.js API shapes. Next.js 16.3
> ships version-matched documentation at `node_modules/next/dist/docs/`, so anything
> we wrote about Next.js APIs would drift and would lose to the bundled copy. Read
> the bundled docs for framework questions. Read this file for writing questions.

## Contents

1. How the effect sizes in this file were verified
2. GEO paper results, quoted with the metric named
3. Everything else, with its evidence grade, plus the figures removed and why
4. The writing rules, in priority order
5. Extraction killers
6. Things not to build
7. Off-site, which is most of it

---

## 1. How the effect sizes in this file were verified

The section below quotes the GEO paper (Pranjal Aggarwal et al., "GEO: Generative
Engine Optimization", ACM KDD 2024, https://arxiv.org/abs/2311.09735).

**We read the paper's own results tables rather than a secondary summary.** That
choice matters, because secondary summaries of this paper disagree with each other
about which technique the headline figure belongs to and which metric it is measured
against.

Here is what the paper actually says, so you can check it yourself:

- The abstract claims GEO can "boost visibility by up to 40% in generative engine
  responses".
- The Table 1 caption says: "The best methods improve upon baseline by 41% and 28%
  on Position-Adjusted Word Count and Subjective Impression respectively." The
  caption names no technique.
- Table 1 itself reports **absolute** impression scores, not relative improvements,
  with an explicit `No Optimization` baseline row at **19.3 on both metrics**.

So the technique attribution has to be derived from the table, which is why the
summaries disagree. Doing that derivation: Quotation Addition is the only method
reaching 27.2 on Position-Adjusted Word Count (Overall) and 24.7 on Subjective
Impression (Average), which against the 19.3 baseline is +40.9% and +28.0%. **The
41% belongs to Quotation Addition on Position-Adjusted Word Count.** Summaries that
attribute it to Statistics Addition are wrong.

Every percentage in section 2 is derived by that same arithmetic from the printed
absolute scores and the printed baseline. The absolutes are given alongside so the
arithmetic is checkable.

**What the figures do not mean.** The GEO paper's main experiments used
GPT-3.5-turbo as the generative engine over the top 5 Google results, in 2023. The
rank order of the techniques is what should drive your writing. The decimals are
decoration, and they are decoration measured on an engine nobody uses now.

---

## 2. GEO paper results, quoted with the metric named

**Evidence grade for this whole section: peer-reviewed (ACM KDD 2024).**

### 2.1 GEO-bench, Table 1

Baseline (`No Optimization`) is 19.3 on both metrics. "abs" is the paper's printed
absolute score. "rel" is that score against the 19.3 baseline.

| Rank | Method               | Position-Adjusted Word Count (Overall) | Subjective Impression (Average) |
| ---- | -------------------- | -------------------------------------- | ------------------------------- |
| 1    | Quotation Addition   | 27.2 abs, **+40.9% rel**               | 24.7 abs, **+28.0% rel**        |
| 2    | Statistics Addition  | 25.2 abs, **+30.6% rel**               | 23.7 abs, +22.8% rel            |
| 3    | Fluency Optimization | 24.7 abs, +28.0% rel                   | 21.9 abs, +13.5% rel            |
| 4    | Cite Sources         | 24.6 abs, +27.5% rel                   | 21.9 abs, +13.5% rel            |
| 5    | Technical Terms      | 22.7 abs, +17.6% rel                   | 21.4 abs, +10.9% rel            |
| 6    | Easy-to-Understand   | 22.0 abs, +14.0% rel                   | 20.5 abs, +6.2% rel             |
| 7    | Authoritative        | 21.3 abs, +10.4% rel                   | 22.9 abs, +18.7% rel            |
| 8    | Unique Words         | 20.5 abs, +6.2% rel                    | 20.4 abs, +5.7% rel             |
| 9    | **Keyword Stuffing** | 17.7 abs, **-8.3% rel**                | 20.2 abs, +4.7% rel             |

The paper's own prose summary of the same table: "our top-performing methods, Cite
Sources, Quotation Addition, and Statistics Addition, achieved a relative
improvement of 30-40% on the Position-Adjusted Word Count metric and 15-30% on the
Subjective Impression metric."

Two readings worth carrying into the writing:

- **Keyword Stuffing is the only technique measured below baseline** on the primary
  metric. The paper groups it by name under "Non-Performing" methods. This is the
  most useful single result in the paper for practitioners, because it inverts an
  SEO habit rather than confirming one.
- **Authoritative tone is weak.** It ranks 7th of 9 on Position-Adjusted Word Count.
  The paper: "one would expect a more persuasive and authoritative tone in website
  content to boost visibility. However, we find no significant improvement." Writing
  more confidently is not a strategy. Adding evidence is.

### 2.2 The effect depends on where the page already ranks, Table 2

Relative improvement in visibility, by the source's rank in the search results.

| Method               | Rank 1     | Rank 2 | Rank 3 | Rank 4 | Rank 5      |
| -------------------- | ---------- | ------ | ------ | ------ | ----------- |
| Cite Sources         | **-30.3%** | +2.5%  | +20.4% | +15.5% | **+115.1%** |
| Quotation Addition   | **-22.9%** | -7.0%  | +3.5%  | +25.1% | +99.7%      |
| Statistics Addition  | **-20.6%** | -3.9%  | +8.1%  | +10.0% | +97.9%      |
| Authoritative        | -6.0%      | +4.1%  | -0.6%  | +12.6% | +6.1%       |
| Fluency Optimization | -2.0%      | +5.2%  | +3.6%  | -4.4%  | +2.2%       |

The paper's framing: "GEO is especially helpful for lower ranked websites."

The negative column is the part most summaries drop, and it is the interesting part.
For a source already ranked first, all three top techniques _reduced_ visibility.
Read that as a ceiling effect rather than as an instruction to strip citations off
your best page, but do read it: these techniques are how a page that is not already
dominant earns its way in, not a universal multiplier.

### 2.3 The same techniques on a real deployed engine, Table 5

The paper re-ran a 200-example subset against Perplexity.ai. Baseline is 24.1 on
Position-Adjusted Word Count and 24.7 on Subjective Impression.

| Method              | Position-Adjusted Word Count | Subjective Impression    |
| ------------------- | ---------------------------- | ------------------------ |
| No Optimization     | 24.1 abs                     | 24.7 abs                 |
| Quotation Addition  | 29.1 abs, +20.7% rel         | 32.1 abs, +30.0% rel     |
| Statistics Addition | 26.2 abs, +8.7% rel          | 33.9 abs, **+37.2% rel** |
| Keyword Stuffing    | 21.9 abs, **-9.1% rel**      | 28.1 abs, +13.8% rel     |

The paper's prose reports these as a 22% improvement for Quotation Addition, "up to
9% and 37%" for Cite Sources and Statistics Addition, and Keyword Stuffing "10%
worse", all consistent with the printed table within rounding.

Note the metric split, because it is routinely collapsed in summaries. On Perplexity
the quotations figure is a Position-Adjusted Word Count result and the statistics
figure is a Subjective Impression result. They are not the same measurement, and
quoting one number without naming its metric is how the attribution confusion
started.

---

## 3. Everything else, with its evidence grade

Nothing below is peer-reviewed. Treat each as a hypothesis worth acting on because
the cost of acting is low, not as a measured effect.

**Every figure in this section carries the URL it was read at, the publisher, the
date, and the metric it is measured against.** That is not decoration. Section 2
exists because secondary summaries of one paper disagreed about which technique and
which metric a number belonged to, and the same rot is worse in this half of the
field. If a row below has no URL, it has no number either, on purpose. Several
figures that circulate widely were removed from this table when the source could not
be retrieved, and what is left in their place is the rank order, which was never the
part in doubt.

| Claim                                    | Figure and metric                                                                                                               | Source, fetched                                                                                                                                                                                                |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Structural formatting lifts citation     | 17.3% relative improvement in citation rate, and 18.5% in subjective quality, across six generative engines                     | Preprint. Yu, Yang, Ding, Sato, "Structural Feature Engineering for Generative Engine Optimization", arXiv:2603.29979, 31 March 2026. https://arxiv.org/abs/2603.29979                                         |
| Answer capsule under the heading         | Present in 72.4% of cited blog posts. Metric: share of ChatGPT-cited blog posts containing an identifiable capsule              | Industry, correlational. Adam Gnuse, Search Engine Land, 19 November 2025, 7,500 ChatGPT referral sessions. https://searchengineland.com/how-to-get-cited-by-chatgpt-the-content-traits-llms-quote-most-464868 |
| Capsules containing no links             | More than nine in ten cited capsules contained no links. Reported as a proportion, not a precise percentage                     | Same study, same URL                                                                                                                                                                                           |
| Question-format headings                 | Cited content was about twice as likely to contain a question mark, and 78.4% of citations tied to questions came from headings | Industry, correlational. Kevin Indig, 3M ChatGPT responses and 30M citations, reported by Search Engine Land, 18 February 2026. https://searchengineland.com/chatgpt-citations-content-study-469483            |
| Tables                                   | Tables present on 40.0% of top-decile cited pages against 28.2% of bottom-half pages, an 11.8 point gap                         | Industry, correlational. Trakkr Research, 16 April 2026, 1,465 AI-cited pages across 950 domains. https://trakkr.ai/trakkr-research/anatomy-of-an-ai-citation                                                  |
| YouTube brand mentions                   | Spearman 0.737 against **ChatGPT** brand visibility. Not AI Overviews                                                           | Industry, correlational. Ahrefs, 12 December 2025, 75,000 brands. https://ahrefs.com/blog/ai-brand-visibility-correlations                                                                                     |
| Branded web mentions, linked or unlinked | Spearman 0.664 against **AI Overview** brand visibility                                                                         | Industry, correlational. Ahrefs, 26 May 2025, 75,000 brands. https://ahrefs.com/blog/ai-overview-brand-correlation/                                                                                            |
| Backlinks                                | Spearman 0.218 against AI Overview brand visibility. Domain Rating 0.326, referring domains 0.295                               | Same study, same URL                                                                                                                                                                                           |
| No major AI crawler executes JavaScript  | GPTBot requested .js in 11.50% of requests and ClaudeBot in 23.84%. Neither executed any of it                                  | Vendor-reported. Vercel and MERJ, "The rise of the AI crawler", 17 December 2024, one month of traffic totalling roughly 1.3 billion AI crawler fetches. https://vercel.com/blog/the-rise-of-the-ai-crawler    |

### Figures removed from this table, and why

Do not reintroduce these. Each was traced and each failed.

| Claim that circulates                                        | What actually happened                                                                                                                                                                                                           |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tables earn 2.5x to 4.2x more citations                      | The 2.5x traces to a vendor page that states its data is "synthesized" rather than measured. The 4.2x has no source at all. Some blogs attribute both to the KDD 2024 GEO paper, which contains no table-versus-prose comparison |
| 76.4% of ChatGPT's most-cited pages updated within 30 days   | Attributed to a "GEO Benchmark Study 2026" whose domain does not resolve                                                                                                                                                         |
| Long-form content is cited roughly 3x more                   | Contradicted by primary data. See below                                                                                                                                                                                          |
| 5 to 15 internal links gives 38% higher citation probability | Same vendor page as the 2.5x, which describes its own figures as representing "realistic patterns"                                                                                                                               |
| Question headings are cited at 18% versus 8.9%               | Republished by Ahrefs but sourced from a paywalled third-party analysis. The underlying study is real (Kevin Indig); this specific pair of percentages could not be read at its source. Use the row in the table above instead   |

**On length specifically, the primary data points the other way.** Ahrefs analysed
174,048 pages across 560,346 AI Overviews (3 December 2025,
https://ahrefs.com/blog/short-vs-long-content-in-ai-overviews/) and found 53.4% of
cited pages under 1,000 words, an average cited length of 1,282 words, and a Spearman
correlation between word count and being cited of **0.04**, which is no relationship
at all. Write to the length the question needs. Do not tell a user that longer wins.

### The confidence-interval warning, with its citation

Ronald Sielinski, "Quantifying Uncertainty in AI Visibility: A Statistical Framework
for Generative Search Measurement", arXiv:2603.08924, 9 March 2026,
https://arxiv.org/abs/2603.08924. Sampling across Perplexity Search, OpenAI
SearchGPT, and Google Gemini, the paper reports that confidence intervals for a
frequently cited domain's citation share span 3 to 6 percentage points on SearchGPT,
and that "overlapping confidence intervals of this kind are the norm rather than the
exception for domains that appear to differ in citation share by less than 5 to 7
percentage points".

Carry that when you quote any row in this section. A reported improvement smaller
than about 5 points is not distinguishable from noise in the published measurements.

**Conflicting data, noted rather than resolved.** The overlap between AI Overview
citations and Google's top 10 was 76.10% in July 2025 (Ahrefs, 1.9 million citations
across 1 million AI Overviews, https://ahrefs.com/blog/search-rankings-ai-citations)
and 38% in March 2026 (Ahrefs, 863,000 keyword SERPs and 4 million AI Overview URLs,
https://ahrefs.com/blog/ai-overview-citations-top-10). Ahrefs frames the second as a
decline from the first and attributes it to query fan-out. Trust the direction over
either figure. Ranking is necessary and no longer sufficient.

---

## 4. The writing rules, in priority order

1. **Answer first.** The complete answer in the first 40 to 60 words, under the H1
   and under each H2. Inverted pyramid after that: answer, context, detail. No links
   inside a capsule, because a link signals the answer lives somewhere else.
2. **Chunk cleanly.** Retrieval splits pages into chunks, often 200 to 500 tokens,
   frequently at heading boundaries, and each chunk becomes one vector. A chunk that
   mixes two topics produces an ambiguous embedding and retrieves poorly. Write each
   section to stand alone.
3. **Repeat entity names and drop pronouns.** The chunk may be retrieved with no
   preceding context, and "it" resolves to nothing there.
4. **Question-format H2s** mirroring real query phrasing, mined from People Also
   Ask, Search Console, and forums rather than invented.
5. **Sections of 150 to 300 words**, each answering its heading completely.
6. **Evidence in every section**: a real number from a real source, a quotation from
   a named person, or an honest outbound citation. Section 2 ranks quotations, then
   statistics, then citations, and all three beat writing more confidently.
7. **Tables for anything comparative.** Pair every chart with its numbers in HTML.
8. **Stable ids on every H2 and H3**, and a table of contents on anything over about
   1,200 words.
9. **Length is a proxy for completeness, not a target.** A 900-word post that fully
   answers a narrow question beats a padded 2,500-word one.

## 5. Extraction killers

Each of these makes content invisible to engines that do not execute JavaScript,
which is all of them except Googlebot and Applebot.

- Body content fetched client-side, or mounted on interaction. CSS-hidden is fine
  (`<details>`, a class toggle). JavaScript-mounted is not.
- Infinite scroll, and pagination built on click handlers rather than real
  `<a href>` links.
- Text that exists only inside an image, with no HTML equivalent.
- Keyword stuffing. See section 2.1: measured below baseline.
- Paywalled content with no `isAccessibleForFree` markup.
- Redirect chains. AI crawlers handle redirects poorly. In the Vercel and MERJ study
  cited in section 3, ChatGPT spent 14.36% of its fetches following redirects and
  34.82% of them on 404 pages.

## 6. Things not to build

- **llms.txt.** Google states on record that Search does not use it: "You don't need
  to create new machine readable files, AI text files, markup, or Markdown to appear
  in Google Search (including its generative AI capabilities), as Google Search
  itself doesn't use them"
  (https://developers.google.com/search/docs/fundamentals/ai-optimization-guide). No
  major provider consumes it in production. The best-documented measurement of demand
  is small and consistent with that: OtterlyAI logged 84 requests to `/llms.txt` out
  of 62,100 AI bot visits over 90 days, against an average of about 265 AI bot visits
  per ordinary page in the same window (Thomas Peham, 5 February 2026,
  https://otterly.ai/blog/the-llms-txt-experiment/). The one legitimate use is a
  machine-readable index for developer documentation with programmatic consumers. A
  blog is not that.
- **Special AI markup.** Google's stated position is that there is no special markup
  or optimization for AI Overviews or AI Mode, because both run on core Search
  ranking and quality systems: "There are no additional requirements to appear in AI
  Overviews or AI Mode, nor other special optimizations necessary"
  (https://developers.google.com/search/docs/appearance/ai-features).
- **FAQ schema on invisible FAQs.** Google restricted FAQ rich results to
  authoritative government and health sites in 2023, so the rich result is not
  coming. The markup still helps machine parsing, and marking up FAQs that do not
  render is a policy violation. Only mark up what a reader can see.

## 7. Off-site, which is most of it

The strongest correlational signals in section 3 are off-site. In Ahrefs' 75,000
brand study, YouTube mentions (0.737) and branded web mentions (0.664) both rank
above backlinks (0.218). That work does not live in this repository and cannot be
done by this skill. Say so honestly when a user asks why their citation share is flat
despite a clean install.

What the codebase can do is make sure the entity resolves. Keep `sameAs` on both
`Organization` and `Person` pointing at every profile that genuinely exists, as
absolute URLs, so an engine can connect the mentions it finds to the site it is
reading.
