---
title: The GEO playbook
description: How to write a post that an AI search engine will cite, with the evidence grade attached to every claim.
group: Writing
order: 2
---

Generative engine optimization is writing so that a retrieval system can find your page, lift a coherent chunk out of it, and attribute the chunk to you. It overlaps heavily with good SEO, and where it does not, the differences are specific enough to write down.

Every claim below carries an evidence grade, because the honest state of this field is that some of it is peer-reviewed and most of it is vendor correlation. The rank order of the techniques is more reliable than any individual percentage.

## The one thing that has to be true first

AI crawlers fetch your HTML once and do not execute JavaScript. Vercel and MERJ instrumented roughly 1.3 billion AI crawler fetches across Vercel's network over a month and reported that none of the major AI crawlers render JavaScript. GPTBot requested `.js` files in 11.50% of its requests and ClaudeBot in 23.84%, and neither executed any of it, which is the detail that makes server logs misleading: fetching a script is not running it. Googlebot renders. Bingbot renders on a delay. GPTBot, ClaudeBot, PerplexityBot, and CCBot do not.

**Evidence grade: vendor-reported, from production traffic.** [The rise of the AI crawler](https://vercel.com/blog/the-rise-of-the-ai-crawler), Vercel and MERJ, 17 December 2024.

So the first question about any page is not how it is written, it is whether the text is in the first response at all. Check it the way a crawler does:

```bash
curl -s -A "GPTBot" https://yoursite.com/blog/your-post | grep "a distinctive sentence"
```

If that fails, nothing else on this page matters. Use view source, not the DevTools element inspector, which shows you the DOM after JavaScript has run.

Four things break this regardless of framework: client-side data fetching in an effect, content mounted on interaction (accordions and tabs that render children only on click), infinite scroll, and text that exists only inside an image.

## Structure the page answer-first

### The answer capsule

Under the H1, and under each H2, write a direct answer of 40 to 60 words containing no links.

That paragraph is the chunk a retrieval system lifts. A link inside it fragments the chunk and pulls the reader out of the answer at the exact moment the answer is being given. Length matters because too short reads as a fragment and too long stops being liftable.

Answer capsules were present in 72.4% of the blog posts ChatGPT cited in one analysis of 7,500 ChatGPT referral sessions, and more than nine in ten of those capsules contained no links. **Evidence grade: industry, correlational.** Adam Gnuse, [Search Engine Land](https://searchengineland.com/how-to-get-cited-by-chatgpt-the-content-traits-llms-quote-most-464868), 19 November 2025.

### Question-format headings

Write H2s as the question a person would type. "Do AI crawlers run JavaScript?" rather than "JavaScript execution".

Across 3 million ChatGPT responses and 30 million citations, cited content was about twice as likely to contain a question mark, and 78.4% of the citations tied to questions came from headings rather than body text. **Evidence grade: industry, correlational.** Kevin Indig's study, [as reported by Search Engine Land](https://searchengineland.com/chatgpt-citations-content-study-469483), 18 February 2026. The mechanism is more convincing than the correlation: a heading phrased as a question matches the query shape a retrieval system is matching against.

Every H2 and H3 needs a stable `id`. This helps readers, enables jump-to links in search results, and gives a retrieval system clean section boundaries.

### Section length

150 to 300 words per section, each self-contained. A section that only makes sense after reading the previous one is a bad chunk, because it will be retrieved on its own.

## Write for chunk quality

This is the most important writing rule on the page and the least intuitive.

**Repeat entity names instead of using pronouns.** "AgentBlog writes the sitemap from content dates" survives being lifted out of context. "It writes the sitemap from content dates" does not. Human copy editors remove this repetition; retrieval systems need it.

The same logic governs everything else in this section:

- Define an acronym in every section that uses it, not once at the top.
- Do not open a section with "as mentioned above".
- Make each section's first sentence say what the section is about, without borrowing from its heading.

## Formatting elements, ranked

Every figure is given against a named metric, because that is where the secondary literature on this paper falls apart. The GEO paper reports two metrics, Position-Adjusted Word Count (PAWC) and Subjective Impression (SI), and a summary that quotes one number without saying which metric it belongs to is the reason five blog posts will give you five different rankings.

Both columns are relative to the paper's printed `No Optimization` baseline of 19.3 on both metrics.

| Rank | Element                       | Position-Adjusted Word Count | Subjective Impression | Evidence grade |
| ---- | ----------------------------- | ---------------------------- | --------------------- | -------------- |
| 1    | Quotations from named sources | **+40.9%**                   | +28.0%                | Peer-reviewed  |
| 2    | Statistics with numbers       | +30.6%                       | +22.8%                | Peer-reviewed  |
| 3    | Fluency optimization          | +28.0%                       | +13.5%                | Peer-reviewed  |
| 4    | Outbound citations            | +27.5%                       | +13.5%                | Peer-reviewed  |
| 5    | Technical terms               | +17.6%                       | +10.9%                | Peer-reviewed  |
| 6    | Easy-to-understand language   | +14.0%                       | +6.2%                 | Peer-reviewed  |
| 7    | Authoritative tone alone      | +10.4%                       | +18.7%                | Peer-reviewed  |
| 8    | Unique words                  | +6.2%                        | +5.7%                 | Peer-reviewed  |
| 9    | **Keyword stuffing**          | **-8.3%**                    | +4.7%                 | Peer-reviewed  |

The peer-reviewed figures come from Table 1 of the GEO paper ([Aggarwal et al., KDD 2024](https://arxiv.org/abs/2311.09735)), measured on GPT-3.5-turbo against top-5 Google sources in 2023. Directionally valid, not guarantees on 2026 engines. Treat the rank order as the finding and the decimals as decoration.

Three rows are worth reading twice:

- **Authoritative tone is weak on the primary metric and ranks 7th of 9 there.** Its stronger SI number is the reason it gets quoted as a headline technique. The paper's own conclusion is that a more persuasive and authoritative tone produced no significant improvement. Writing more confidently is not a strategy. Adding evidence is.
- **Outbound citations sit below fluency optimization on PAWC**, not in a 30 to 40% band. The paper's prose groups Cite Sources with the top methods, which is where the inflated number comes from.
- **Keyword stuffing is the only technique measured below baseline.** It is not neutral. It measures worse than doing nothing.

Two non-peer-reviewed rows belong alongside these, kept separate because the evidence is a different kind:

| Element                        | Reported effect                                                             | Evidence grade                                                                                                         |
| ------------------------------ | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Structural formatting          | 17.3% relative improvement in citation rate across six engines              | Preprint, [arXiv:2603.29979](https://arxiv.org/abs/2603.29979)                                                         |
| Tables present on a cited page | On 40.0% of top-decile cited pages against 28.2% of bottom-half cited pages | Industry, correlational, [Trakkr Research](https://trakkr.ai/trakkr-research/anatomy-of-an-ai-citation), 16 April 2026 |

### Tables

Put comparison and specification data in a real `<table>`. Not a bulleted list that describes a table, and not a paragraph that enumerates one. A table is structurally unambiguous about which value belongs to which row, which is exactly what a retrieval system needs and exactly what prose obscures.

### Statistics and quotations

One real statistic and one named-source quotation per post, each cited, is the floor. Both are the highest-effect techniques in the table, and both are the two things a language model will happily invent if you let it.

The `write-blog-post` skill carries the instruction never to fabricate either, in bold, in always-loaded context. Treat it the same way when you are writing by hand.

## Word count

Longer is not better, and the widely quoted claim that long-form posts are cited three times more often has no source we could retrieve. The primary data points the other way: across 174,048 pages appearing in 560,346 AI Overviews, 53.4% of cited pages were under 1,000 words, the average cited page ran 1,282 words, and the correlation between word count and being cited was 0.04, which is no relationship at all. **Evidence grade: industry, correlational.** [Ahrefs](https://ahrefs.com/blog/short-vs-long-content-in-ai-overviews/), 3 December 2025.

Length is a proxy for completeness, not a target. Write exactly as long as it takes to fully answer the query and its sub-questions, then stop. A 900-word post that fully answers a narrow question beats a padded 2,500-word one, and the padding actively degrades the chunk quality of every section it touches.

## Freshness

Recency is worth acting on and the specific figures in circulation are not worth quoting. The most repeated one, that 76.4% of ChatGPT's most-cited pages were updated within 30 days, traces to a study whose publisher's domain no longer resolves. **Evidence grade: none we could retrieve.** The `refresh-blog-post` skill is built on the mechanism rather than the number.

Update your best posts on a schedule, and change `dateModified` only when the content actually changed. A `dateModified` that moves on every deploy teaches every consumer of that field to ignore it, which costs you the signal you were trying to send.

## Internal links

Five to fifteen contextual links per post. Every new post should also receive at least one inbound link from an existing post, added in the same commit. These numbers are a working range rather than a measured optimum: the "38% higher citation probability" figure attached to them online comes from a vendor page that describes its own data as synthesized rather than measured.

Orphan posts are the most common structural failure on a blog that otherwise does everything right. A post with no inbound internal links is discovered only through the sitemap, and it inherits none of the topical context that makes the rest of your cluster legible.

Never put a link inside an answer capsule.

## Entity building

An AI answer engine has to resolve "who published this" to something. That resolution is what turns a citation into attribution.

- `Organization.sameAs` pointing at profiles a third party can verify: LinkedIn, Crunchbase, GitHub, YouTube, Wikidata.
- An author page emitting `Person`, linked from the byline with `rel="author"`.
- An editorial policy page with a real corrections process.
- Consistent naming. The same organization name everywhere, spelled the same way.

Off-site mentions carry more weight than raw backlink counts for AI citation specifically. Across 75,000 brands, Ahrefs measured Spearman correlations of 0.664 for branded web mentions and 0.218 for backlinks against AI Overview brand visibility, with Domain Rating at 0.326. A separate Ahrefs study of the same brand set put YouTube mentions at 0.737 against ChatGPT brand visibility. **Evidence grade: industry, correlational, and correlation is not causation here.** [AI Overview brand visibility factors](https://ahrefs.com/blog/ai-overview-brand-correlation/), 26 May 2025, and [AI brand visibility correlations](https://ahrefs.com/blog/ai-brand-visibility-correlations), 12 December 2025.

Being discussed on Reddit, in a comparison post, or in documentation someone else maintains is closer to the mechanism than acquiring a link.

## What to avoid

- **Keyword stuffing.** Measurably worse than baseline.
- **Content behind interaction.** Accordions and tabs that mount children on click.
- **Text only in images.** Non-OCR crawlers see nothing. Mirror it in HTML.
- **Marked-up facts that are not on the page.** The most enforced structured data policy, and violations can earn a manual action that removes rich result eligibility entirely.
- **llms.txt.** See [why we do not ship it](/docs/no-llms-txt).
- **Padding.** Every filler paragraph makes the chunks around it worse.

## The pre-publish gate

Everything above is checkable. See the [SEO and GEO checklist](/docs/seo-geo-checklist), which is what `agentblog audit` runs.

## Caveats

The AI crawler situation changes every quarter. OAI-SearchBot appeared in 2024, Claude-SearchBot split off in 2025, Cloudflare changed its defaults in September 2026. Any specific list of user agents in this document has a half-life measured in months, which is why the block vendors the list and diffs it against upstream on a schedule rather than transcribing it once.

The correlational figures come from vendors, several of whom have a product to sell. Ronald Sielinski's [Quantifying Uncertainty in AI Visibility](https://arxiv.org/abs/2603.08924) (arXiv:2603.08924, 9 March 2026) sampled Perplexity Search, OpenAI SearchGPT, and Google Gemini repeatedly and found that confidence intervals on a frequently cited domain's citation share span 3 to 6 percentage points, and that overlapping intervals are the norm for domains appearing to differ by less than 5 to 7 points. So an intervention that looks like it moved your citation share by three points may have moved nothing. Treat the correlational rows as hypotheses worth testing on your own content, not as settled numbers.

Several figures that circulate widely are absent from this page on purpose, because we could not retrieve their sources. The full list, with what happened to each, is in the `references/geo-playbook.md` that ships with the `write-blog-post` skill.

---

_This page is licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Reproduce it, translate it, quote it. Credit `agentblog.dev` with a link._
