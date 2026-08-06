---
title: AI referrer tracking
description: How lib/ai-referrers.ts classifies a visit that came from ChatGPT, Perplexity, or Claude, and the three lines that send it to the analytics tool you already run.
group: Operations
order: 4
---

`lib/ai-referrers.ts` answers one question: did this visit come from an AI assistant, and which one. It is a pure function with no dependencies, it sends nothing anywhere, and it sets no cookie. Wiring it to your analytics is your decision and stays your decision.

## Why AI referrals need their own dimension

Assistant referrals do not group with search traffic in any default report. `chatgpt.com` arrives as an ordinary referral, sitting in the same list as a forum link and a newsletter, and `perplexity.ai` sits three rows below it. The one number that tells you whether writing for retrieval is working is scattered across a dozen rows that nobody totals.

Classifying at the source collapses those rows into one dimension you can chart over time. That chart is the only feedback loop this product has, because AI answer engines send no query data, no impression counts, and no rank.

## The API

```ts
import { classifyReferrer, isAiReferrer } from '@/lib/ai-referrers'

classifyReferrer('https://chatgpt.com/c/abc123')
// { source: 'chatgpt', host: 'chatgpt.com' }

classifyReferrer('https://news.ycombinator.com/item?id=1')
// null

isAiReferrer(document.referrer)
// boolean
```

| Export             | Signature                                                                                         |
| ------------------ | ------------------------------------------------------------------------------------------------- |
| `classifyReferrer` | `(referrer: string \| null \| undefined) => AiReferrer \| null`                                   |
| `isAiReferrer`     | `(referrer: string \| null \| undefined) => boolean`                                              |
| `AiReferrer`       | `{ source: AiReferrerSource; host: string }`                                                      |
| `AiReferrerSource` | `'chatgpt' \| 'perplexity' \| 'gemini' \| 'copilot' \| 'claude' \| 'grok' \| 'you' \| 'other-ai'` |

`null` covers empty referrers, direct traffic, unparseable strings, and every ordinary referral, so you can branch on truthiness and be done.

The input may be a full URL or a bare hostname. `document.referrer` gives you a full URL and a `Referer` header usually does too, but log pipelines and tag managers hand over bare hosts often enough that handling it here beats handling it at every call site.

## The wiring, per tool

Three lines against whatever you already run. Put them in a client component that renders on the post route, or on the server against the `Referer` header.

```ts
// Google Analytics 4
const ai = classifyReferrer(document.referrer)
if (ai) gtag('event', 'ai_referral', { ai_source: ai.source, ai_host: ai.host })

// Vercel Analytics
const ai = classifyReferrer(document.referrer)
if (ai) track('ai_referral', { source: ai.source, host: ai.host })

// PostHog
const ai = classifyReferrer(document.referrer)
if (ai) posthog.capture('ai_referral', { source: ai.source, host: ai.host })
```

Chart `ai_source` as the dimension and `ai_host` as the drill-down. The host is kept alongside the source deliberately: it is how you notice a subdomain that started sending traffic before it has a name in the union.

## It is safe in a client component

`lib/ai-referrers.ts` has no `server-only` import, no Node built-ins, no config import, and no I/O. That is intentional. It is meant to be importable from a `'use client'` component so it can read `document.referrer` on the first paint of a post.

It is the only file in `lib/` with that property. Everything else that touches config imports `server-only`, and `scripts/assert-no-server-only-in-client.mjs` fails the build if that changes.

## What it recognizes

Four matching strategies, in this order.

| Strategy         | Example                                                                   | Why it is separate                                                                                                                      |
| ---------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Exact host       | `chatgpt.com`, `chat.openai.com`, `bard.google.com`                       | Legacy hostnames stay alive in old links for years                                                                                      |
| Path-scoped host | `bing.com/chat`                                                           | `bing.com` alone is a search referral. Counting all of it as AI overstates badly                                                        |
| Apex suffix      | `*.perplexity.ai`, `*.claude.ai`, `*.x.ai`                                | These products add and rename subdomains, and a new one should keep reporting                                                           |
| Known other      | `poe.com`, `phind.com`, `meta.ai`, `chat.mistral.ai`, `chat.deepseek.com` | Classified as `other-ai` so assistant traffic is never counted as an ordinary referral just because the product is newer than this file |

Adding a host to the `other-ai` list is the low-risk edit. Make it freely.

## Why we do not ship the integration

Shipping a GA4 integration means picking GA4 for you, adding a dependency to a block whose entire pitch is that it adds none, and owning a consent surface we cannot see. The classifier is the part that is genuinely hard to get right, and it is the part where a mistake is silent: a subdomain that stops matching does not throw, it just quietly stops appearing in your numbers.

See [Roadmap and non-goals](/docs/roadmap) for the rest of what v1 leaves to you on purpose.
