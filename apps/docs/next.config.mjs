import { createMDX } from 'fumadocs-mdx/next'

/**
 * docs.agentblog.dev.
 *
 * `.mjs` rather than `.ts` because Fumadocs MDX is ESM only and its Next.js
 * plugin has to be imported before the config object is evaluated. A `.ts`
 * config would need Node's native TypeScript resolver to load it, which is one
 * more thing that can differ between a laptop and a build container.
 *
 * @type {import('next').NextConfig}
 */
const config = {
  /**
   * Bots listed here receive fully blocking metadata: `<title>` and every
   * `<meta>` tag land inside `<head>` rather than streaming into `<body>`.
   *
   * This value REPLACES the Next.js default list rather than extending it, so
   * it is the Next.js defaults union the AI crawlers. It is the same value
   * `agentblog doctor --fix` writes into a consumer's config, kept here byte for
   * byte so this site is subject to the rule it documents.
   *
   * `node scripts/assert-htmlbots-superset.mjs apps/docs/next.config.mjs` fails
   * the build if this list ever narrows.
   */
  htmlLimitedBots:
    /[\w-]+-Google|Google-[\w-]+|Chrome-Lighthouse|Slurp|DuckDuckBot|baiduspider|yandex|sogou|bitlybot|tumblr|vkShare|quora link preview|redditbot|ia_archiver|Bingbot|BingPreview|applebot|facebookexternalhit|facebookcatalog|Twitterbot|LinkedInBot|Slackbot|Discordbot|WhatsApp|SkypeUriPreview|Yeti|googleweblight|GPTBot|OAI-SearchBot|ChatGPT-User|OAI-AdsBot|ClaudeBot|Claude-SearchBot|Claude-User|anthropic-ai|PerplexityBot|Perplexity-User|Meta-ExternalAgent|Meta-ExternalFetcher|CCBot|Bytespider|Amazonbot|MistralAI-User|cohere-ai|DuckAssistBot|Diffbot|YouBot|Applebot-Extended/i,

  /*
   * The Markdown variant of every page, at `<url>.md`.
   *
   * App Router segments are path segments rather than filename patterns, so
   * `/installation.md` cannot be expressed as a route, and a page and a route
   * handler cannot share a segment folder. Rewriting to a sibling tree is the
   * way to get the URL we want.
   *
   * `:path*` is lazy in `path-to-regexp`, so it stops before the literal `.md`
   * rather than swallowing it.
   *
   * @see app/md/[[...slug]]/route.ts
   */
  async rewrites() {
    return [
      // The index page first: Next.js normalises a trailing `index` segment
      // away, so `/md/index` would resolve back to `/md` and 404. Mapping it
      // straight to `/md` is the same destination without the detour.
      { source: '/index.md', destination: '/md' },
      { source: '/:path*.md', destination: '/md/:path*' },
    ]
  },
}

const withMDX = createMDX()

export default withMDX(config)
