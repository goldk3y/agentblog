---
title: Why the blog block does not ship llms.txt
description: The evidence against llms.txt for content sites, the one carve-out where it is genuinely useful, and why this docs site takes it.
group: Project
order: 1
---

The blog block ships no `llms.txt`. Not as an option, not behind a flag. This docs site does serve one, at [`/docs/llms.txt`](/docs/llms.txt), and the distinction is the whole point.

## The evidence

- **Gary Illyes, Google Search Central Deep Dive (APAC), July 23, 2025:** Google does not support `llms.txt` and is not planning to.
- **John Mueller** compared it on the record to the discredited keywords meta tag.
- **Google's [AI optimization guide](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide):** "You don't need to create new machine readable files, AI text files, markup, or Markdown to appear in Google Search (including its generative AI capabilities), as Google Search itself doesn't use them." The same page adds that maintaining one for other services "will neither harm nor help your site's visibility or rankings in Google Search, as Google Search ignores them."
- **No major LLM provider consumes it in production.**
- **An SE Ranking study** found that removing `llms.txt` as a variable _improved_ their citation-prediction model, which means it was adding noise.
- **OtterlyAI instrumented one site for 90 days** and logged 84 requests to `/llms.txt` out of 62,100 AI bot visits. An ordinary page on the same site averaged about 265 AI bot visits in the same window. [The llms.txt experiment](https://otterly.ai/blog/the-llms-txt-experiment/), Thomas Peham, 5 February 2026.

That last measurement is the one worth sitting with. The file that exists to be read by AI crawlers was fetched by them roughly a third as often as a random page that was not written for them at all.

A larger figure circulates, 408 requests out of more than 500 million AI bot visits. We do not use it here. It comes from a vendor with no published methodology, no data window, and no dataset, and a number that convenient deserves the same scrutiny as the claim it is arguing against.

It neither helps nor hurts SEO. The cost of shipping one is not the file, it is the implication: a blog that ships an `llms.txt` is telling its owner that the file does something, and that owner will spend an hour maintaining it that belongs somewhere else.

## The carve-out, stated precisely

There is a legitimate use, and it is narrow: **developer documentation with programmatic consumers, where the token-efficiency win is real.**

The mechanism is different from the citation claim. Nobody is arguing a crawler discovers your docs through `llms.txt`. The argument is that when an agent has already been pointed at your docs and needs to read them, a Markdown index and Markdown page variants cost a fraction of the tokens that rendered HTML with navigation chrome costs. That is a measurable saving on a real workflow, not a ranking hypothesis.

Next.js does exactly this, serving `/docs/llms.txt` and `/docs/llms-full.txt` and a Markdown variant of every page when you append `.md` to the URL.

## Why this site takes it and the block does not

Our primary reader genuinely is a coding agent trying to install a package. The whole distribution argument for this product is that agents are the channel. So `/docs` here serves:

- [`/docs/llms.txt`](/docs/llms.txt), an index of every page with its description
- [`/docs/llms-full.txt`](/docs/llms-full.txt), every page concatenated
- A `.md` variant of every page: [`/docs/installation.md`](/docs/installation.md), and so on

Your blog is not that. Its readers are people, plus crawlers that want HTML with structured data in it. Serving those crawlers a second, parallel representation of the same content adds a surface to keep in sync and buys nothing measurable.

## What to do instead

The hour you would spend on `llms.txt` is better spent on:

1. **Server-rendered HTML.** The text in the first response, with no JavaScript required. This is the whole ball game and most sites fail it.
2. **Structured data.** A connected `@graph` that resolves your author and your organization to real entities.
3. **Third-party mentions.** Being discussed somewhere you do not control is closer to the mechanism than anything you can put in your own root directory.

All three are things AgentBlog either does for you or tells you how to do. `llms.txt` is not.

## If you want one anyway

It is your repository. A route handler at `app/llms.txt/route.ts` returning a plain-text index is about fifteen lines, and nothing in the block will fight you.

We are not going to ship it by default, because shipping it implies it works.

---

_This page is licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)._
