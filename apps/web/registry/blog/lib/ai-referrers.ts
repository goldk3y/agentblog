/**
 * Classify a referrer as AI assistant traffic. Pure function, zero dependencies.
 *
 * ===========================================================================
 * WE SHIP THE CLASSIFIER, NOT AN ANALYTICS INTEGRATION
 * ===========================================================================
 * This file does not talk to GA4, Vercel Analytics, PostHog, or anything else,
 * and it never will. It takes a referrer string and tells you which AI assistant
 * it came from. Where that answer goes is your decision, and it stays your
 * decision: the block adds no analytics dependency, sends no data anywhere, and
 * sets no cookie.
 *
 * That is the honest scope. Wiring it up is three lines against whatever you
 * already run:
 *
 *     // Google Analytics 4
 *     const ai = classifyReferrer(document.referrer)
 *     if (ai) gtag('event', 'ai_referral', { ai_source: ai.source, ai_host: ai.host })
 *
 *     // Vercel Analytics
 *     const ai = classifyReferrer(document.referrer)
 *     if (ai) track('ai_referral', { source: ai.source, host: ai.host })
 *
 *     // PostHog
 *     const ai = classifyReferrer(document.referrer)
 *     if (ai) posthog.capture('ai_referral', { source: ai.source, host: ai.host })
 *
 * On the server the same call works against the `Referer` header.
 *
 * ===========================================================================
 * WHY THIS IS WORTH MEASURING SEPARATELY
 * ===========================================================================
 * Assistant referrals do not group with search traffic in any default report.
 * `chatgpt.com` shows up as an ordinary referral alongside a forum link, so the
 * one number that tells you whether writing for AI retrieval is working is
 * scattered across a dozen rows that nobody totals. Classifying at the source
 * gives you a single dimension you can chart.
 *
 * ===========================================================================
 * SAFE IN A CLIENT COMPONENT
 * ===========================================================================
 * No `server-only`, no Node built ins, no config import, no I/O. This module is
 * intentionally importable from a `'use client'` component so it can read
 * `document.referrer` on the first paint of a post.
 */

export type AiReferrerSource =
  'chatgpt' | 'perplexity' | 'gemini' | 'copilot' | 'claude' | 'grok' | 'you' | 'other-ai'

export interface AiReferrer {
  readonly source: AiReferrerSource
  /** The normalised hostname, lowercased, so you can chart the long tail too. */
  readonly host: string
}

/**
 * Exact hostnames, including the ones that only differ by a `www.` or a legacy
 * name kept alive by old links (`chat.openai.com`, `bard.google.com`).
 */
const EXACT_HOSTS: Readonly<Record<string, AiReferrerSource>> = {
  'chatgpt.com': 'chatgpt',
  'www.chatgpt.com': 'chatgpt',
  'chat.openai.com': 'chatgpt',
  'perplexity.ai': 'perplexity',
  'www.perplexity.ai': 'perplexity',
  'gemini.google.com': 'gemini',
  'bard.google.com': 'gemini',
  'copilot.microsoft.com': 'copilot',
  'claude.ai': 'claude',
  'www.claude.ai': 'claude',
  'grok.com': 'grok',
  'www.grok.com': 'grok',
  'x.ai': 'grok',
  'www.x.ai': 'grok',
  'you.com': 'you',
  'www.you.com': 'you',
}

/**
 * Apex domains whose subdomains belong to the same assistant.
 *
 * These products add and rename subdomains regularly. Matching the apex means a
 * new one keeps reporting as itself instead of silently dropping out of the
 * numbers, which is the failure mode that makes a metric quietly wrong rather
 * than obviously broken.
 */
const APEX_SUFFIXES: readonly (readonly [string, AiReferrerSource])[] = [
  ['.chatgpt.com', 'chatgpt'],
  ['.perplexity.ai', 'perplexity'],
  ['.claude.ai', 'claude'],
  ['.grok.com', 'grok'],
  ['.x.ai', 'grok'],
  ['.you.com', 'you'],
]

/**
 * Hosts that are AI assistants but have no dedicated member in the union.
 *
 * `other-ai` exists so that assistant traffic is never counted as an ordinary
 * referral just because the product is newer than this file. Add to this list
 * freely; it is the low risk edit.
 */
const OTHER_AI_HOSTS: readonly string[] = [
  'poe.com',
  'phind.com',
  'meta.ai',
  'chat.mistral.ai',
  'chat.deepseek.com',
]

/**
 * Assistants that live on a path of a general purpose host. Bing's chat surface
 * is the one that matters: `bing.com` alone is a search referral, and counting
 * it as AI would overstate the number badly.
 */
const PATH_SCOPED: readonly (readonly [string, string, AiReferrerSource])[] = [
  ['bing.com', '/chat', 'copilot'],
  ['www.bing.com', '/chat', 'copilot'],
  ['cn.bing.com', '/chat', 'copilot'],
]

/**
 * Parse a referrer that may be a full URL or a bare hostname.
 *
 * `document.referrer` is a full URL; a `Referer` header usually is too, but log
 * pipelines and tag managers hand over bare hosts often enough to be worth
 * handling here rather than at every call site.
 */
function parse(referrer: string): { host: string; path: string } | null {
  const trimmed = referrer.trim()
  if (trimmed === '') return null

  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`

  try {
    const url = new URL(candidate)
    if (url.hostname === '') return null
    return { host: url.hostname.toLowerCase(), path: url.pathname.toLowerCase() }
  } catch {
    return null
  }
}

/**
 * The AI assistant a visit came from, or `null` for everything else.
 *
 * `null` covers empty referrers, direct traffic, unparseable strings, and every
 * ordinary referral, so a caller can branch on truthiness and be done.
 */
export function classifyReferrer(referrer: string | null | undefined): AiReferrer | null {
  if (referrer === null || referrer === undefined) return null

  const parsed = parse(referrer)
  if (parsed === null) return null
  const { host, path } = parsed

  const exact = EXACT_HOSTS[host]
  if (exact !== undefined) return { source: exact, host }

  for (const [scopedHost, prefix, source] of PATH_SCOPED) {
    if (host === scopedHost && path.startsWith(prefix)) return { source, host }
  }

  for (const [suffix, source] of APEX_SUFFIXES) {
    if (host.endsWith(suffix)) return { source, host }
  }

  if (OTHER_AI_HOSTS.includes(host)) return { source: 'other-ai', host }

  return null
}

/** Whether a referrer is any AI assistant. Thin wrapper for filters and guards. */
export function isAiReferrer(referrer: string | null | undefined): boolean {
  return classifyReferrer(referrer) !== null
}
