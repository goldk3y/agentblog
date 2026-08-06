/**
 * `/robots.txt`.
 *
 * ---------------------------------------------------------------------------
 * THE MOST IMPORTANT THING ON THIS PAGE IS NOT IN THIS FILE
 * ---------------------------------------------------------------------------
 * robots.txt is the innermost layer of crawler access control, and it is the
 * last one a request reaches. A CDN sitting in front of your origin can refuse
 * an AI crawler before this file is ever read, and when that happens everything
 * here is correct and completely inert.
 *
 * This is not hypothetical. Cloudflare's default for new domains, for new sites
 * on existing accounts, and for Free-tier accounts that have not changed their
 * settings blocks Training and Agent crawlers. And blocking "Training" also
 * blocks multi-purpose crawlers, which per Cloudflare's own announcement
 * includes Googlebot, Applebot, and BingBot. So a perfect install can lose
 * organic search, silently, because of a setting in a different product.
 *
 * Nothing in this repository can detect that from the inside. The only check
 * that catches it fetches your live URL from outside your deployment's network:
 *
 *     npx agentblog doctor --url https://your-live-site.com
 *
 * Run it after your first deploy. It is the single highest-value check in the
 * whole tool, and it is the reason "my robots.txt is open but I get no ChatGPT
 * citations" is such a common complaint.
 *
 * ---------------------------------------------------------------------------
 * NON-VERCEL DEPLOYMENTS: READ THIS OR YOUR SITE WILL BE BLOCKED
 * ---------------------------------------------------------------------------
 * The environment guard below fails closed. Vercel sets `VERCEL_ENV` for you;
 * nothing else does. If you deploy anywhere else, set `AGENTBLOG_PUBLIC_SITE=true`
 * in your production environment or this file emits a blanket `Disallow: /`.
 *
 * Failing closed is deliberate. Guessing wrong in the permissive direction gets
 * a staging site indexed and competing with production, which takes weeks to
 * undo. Guessing wrong in the restrictive direction is one environment variable
 * and is visible the moment anyone opens `/robots.txt`.
 *
 * @see https://agentblog.dev/docs/troubleshooting-cdn
 */
import type { MetadataRoute } from 'next'

import { absoluteUrl, config } from '@/lib/config'
import { AI_CRAWLERS } from '@/lib/preflight-checks'
import type { AiCrawler } from '@/lib/preflight-checks'

/** One entry of the array form of `MetadataRoute.Robots['rules']`, derived rather than retyped. */
type RobotsRule = Extract<MetadataRoute.Robots['rules'], unknown[]>[number]

/**
 * Anthropic honours the non-standard `Crawl-delay` directive, which most
 * crawlers ignore. One second is a courtesy, not a throttle: a large value on a
 * crawler you want citations from is a self-inflicted wound.
 *
 * Note that `crawlDelay` is a first-class field on a robots rule, so it does not
 * need the `other` escape hatch. `other` is used further down for a directive
 * the Next.js API genuinely does not model.
 */
const ANTHROPIC_CRAWL_DELAY_SECONDS = 1

/**
 * Paths that never belong in a search index.
 *
 * Note what is NOT here: the noindexed tag pages. Blocking a URL in robots.txt
 * stops the crawler from fetching it, which means it never reads the `noindex`
 * on the page, which means the URL can still surface as a bare listing. If you
 * want a page out of the index, let it be crawled and let it say `noindex`.
 */
const PRIVATE_PATHS = ['/api/']

/** Crawlers of one purpose, split by whether Anthropic operates them. */
function crawlersFor(purpose: AiCrawler['purpose'], anthropic: boolean): string[] {
  return AI_CRAWLERS.filter(
    (crawler) => crawler.purpose === purpose && (crawler.operator === 'Anthropic') === anthropic,
  ).map((crawler) => crawler.ua)
}

/** `Allow: /` or `Disallow: /`, as a spreadable fragment. */
function access(allowed: boolean): { allow: string } | { disallow: string } {
  return allowed ? { allow: '/' } : { disallow: '/' }
}

export default function robots(): MetadataRoute.Robots {
  const isProduction =
    process.env.VERCEL_ENV === 'production' || process.env.AGENTBLOG_PUBLIC_SITE === 'true'

  /**
   * Preview and development deployments block everything.
   *
   * This is the cheapest possible defence against the most common self-inflicted
   * SEO wound there is: a preview URL that ranks against production, splits its
   * own signals, and shows a half-finished draft to real users. Three lines.
   */
  if (!isProduction) {
    return { rules: [{ userAgent: '*', disallow: '/' }] }
  }

  const rules: RobotsRule[] = [{ userAgent: '*', allow: '/', disallow: PRIVATE_PATHS }]

  /**
   * Split AI access rules, driven by `config.aiAccess`.
   *
   * The three purposes are genuinely different decisions and you are entitled to
   * make them separately:
   *
   *   search  the crawler that fetches you so an assistant can cite you
   *   agent   the crawler that fetches you because a user asked, right now
   *   train   the crawler that fetches you to put you in a model's weights
   *
   * `train: false` is a real tradeoff and not a free one. Vendor documentation
   * draws the boundary between "training" and "retrieval" more cleanly than
   * reality does, and some crawlers serve both. Opting out of training can opt
   * you out of the index that would have cited you.
   *
   * This is also the seam for the AI-access standards currently converging on
   * robots.txt (Cloudflare Content Signals, RSL, the IETF AIPREF draft). When
   * one of them lands, it is emitted from this same config object and no
   * consumer has to touch `agentblog.config.ts`.
   */
  const purposes = [
    ['search', config.aiAccess.search],
    ['agent', config.aiAccess.agent],
    ['train', config.aiAccess.train],
  ] as const

  for (const [purpose, allowed] of purposes) {
    const others = crawlersFor(purpose, false)
    if (others.length > 0) {
      rules.push({ userAgent: others, ...access(allowed) })
    }

    // Anthropic's bots get their own group so `Crawl-delay` lands only on the
    // agents that read it. Same allow/disallow decision, one extra directive.
    const anthropic = crawlersFor(purpose, true)
    if (anthropic.length > 0) {
      rules.push({
        userAgent: anthropic,
        ...access(allowed),
        crawlDelay: ANTHROPIC_CRAWL_DELAY_SECONDS,
      })
    }
  }

  /**
   * A worked example of the per-rule `other` field, new in Next.js 16.3.0.
   *
   * `Clean-param` tells Yandex that these query parameters do not change the
   * page, so `?utm_source=x` and the bare URL are one document rather than two.
   * The Next.js robots API does not model it, values in `other` are passed
   * through verbatim and unvalidated, and the type is
   * `Record<string, string | number | Array<string | number>>` per rule.
   *
   * Safe to delete if you do not care about Yandex. It is here because it is a
   * real directive with real syntax, which is more useful to copy from than an
   * invented one.
   */
  rules.push({
    userAgent: 'Yandex',
    allow: '/',
    other: { 'Clean-param': 'utm_source&utm_medium&utm_campaign&ref /' },
  })

  /**
   * Not modelled above: OpenAI's `OAI-AdsBot`, which validates ad landing pages
   * and, per OpenAI's own documentation, does not respect robots.txt. It falls
   * under the `*` rule. Writing a directive for a crawler that documents itself
   * as ignoring directives would be decoration.
   */

  return {
    rules,
    sitemap: absoluteUrl('/sitemap.xml'),
    host: config.siteUrl,
  }
}
