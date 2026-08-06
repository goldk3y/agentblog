/**
 * ! GENERATED FILE. DO NOT EDIT.
 *
 * Source of truth: `packages/checks/src/core.ts` in the AgentBlog repository.
 * Regenerate with `pnpm codegen`.
 *
 * This file is copied verbatim so that the code running in your project is the
 * same code the AgentBlog test suite runs against. Edits here are safe to make
 * in your own repository once installed, but they will be overwritten if you
 * reinstall the block.
 */
/**
 * AgentBlog configuration checks.
 *
 * ===========================================================================
 * THIS FILE IS COPIED VERBATIM INTO EVERY CONSUMER PROJECT
 * ===========================================================================
 * `scripts/codegen.mjs` copies this file to
 * `apps/web/registry/blog/lib/preflight-checks.ts`, which the registry then
 * writes into a consumer's repository as `lib/preflight-checks.ts`. CI fails if
 * the copy has drifted.
 *
 * Two consequences, both binding:
 *
 *   1. **Zero imports.** Not `zod`, not `node:fs`, not another file in this
 *      package. The consumer's copy has no `node_modules` entry to import from.
 *      Everything here is pure string and RegExp work over file contents that
 *      the caller supplies.
 *
 *   2. **No side effects.** The caller decides whether to warn, throw, or fix.
 *      `lib/preflight.ts` warns at build time; `agentblog doctor` reports and
 *      can fix. Both read the same predicates, which is the only way those two
 *      tools cannot drift and disagree in front of a user.
 *
 * @see https://agentblog.dev/docs/cli-reference
 */

/* ========================================================================== */
/*  Severity and findings                                                     */
/* ========================================================================== */

/**
 * How badly a check failed.
 *
 * The distinction between `error` and `warning` is not cosmetic. A narrowed
 * `htmlLimitedBots` is an *active regression* against Googlebot and every social
 * preview bot, whereas a missing one is only a missed opportunity. Reporting
 * both as "problem" would bury the one that is actively costing traffic.
 */
export type Severity = 'error' | 'warning' | 'info'

export interface Finding {
  /** Stable id, e.g. `'html-limited-bots-narrowed'`. Used by `--fix` routing. */
  readonly id: string
  readonly severity: Severity
  /** One line, present tense, states what is wrong. */
  readonly message: string
  /** What to do about it. Omitted when there is nothing actionable. */
  readonly remedy?: string
  /** Whether `agentblog doctor --fix` can repair this automatically. */
  readonly fixable: boolean
}

/* ========================================================================== */
/*  The Next.js default HTML-limited bot list, vendored                       */
/* ========================================================================== */

/**
 * Next.js 16.3.0's built-in `htmlLimitedBots` pattern, copied verbatim from
 * `next/dist/shared/lib/router/utils/html-bots.js`.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS VENDORED AND WHY IT MATTERS MORE THAN IT LOOKS
 * ---------------------------------------------------------------------------
 * Setting `htmlLimitedBots` in `next.config.ts` **overrides** this list. It does
 * not extend it. From the Next.js documentation:
 *
 *   "Specifying a `htmlLimitedBots` config will override the Next.js' default
 *    list."
 *
 * So a config that lists only the AI crawlers silently drops Googlebot, Bingbot,
 * Applebot, Twitterbot, LinkedInBot, Slackbot, Discordbot, facebookexternalhit,
 * and WhatsApp from HTML-limited treatment. Those bots then receive `<title>`
 * and `<meta>` inside `<body>` on any page with streamed metadata. That trades a
 * GEO win for an SEO and social-preview loss, invisibly.
 *
 * Every write path in AgentBlog therefore unions rather than replaces, and
 * `agentblog doctor` asserts a superset rather than merely asserting that GPTBot
 * appears.
 *
 * This list is a moving target. `scripts/assert-html-bots-current.mjs` diffs it
 * against the installed Next.js on every CI run, so the day Next adds a bot we
 * find out from a red build rather than from a customer.
 *
 * @see https://nextjs.org/docs/app/api-reference/config/next-config-js/htmlLimitedBots
 */
export const NEXT_DEFAULT_HTML_LIMITED_BOTS =
  '[\\w-]+-Google|Google-[\\w-]+|Chrome-Lighthouse|Slurp|DuckDuckBot|baiduspider|yandex|sogou|bitlybot|tumblr|vkShare|quora link preview|redditbot|ia_archiver|Bingbot|BingPreview|applebot|facebookexternalhit|facebookcatalog|Twitterbot|LinkedInBot|Slackbot|Discordbot|WhatsApp|SkypeUriPreview|Yeti|googleweblight'

/** The Next.js version the list above was vendored from. */
export const NEXT_DEFAULT_HTML_LIMITED_BOTS_VERSION = '16.3.0'

/**
 * A crawler AgentBlog adds to the HTML-limited set.
 *
 * `purpose` records what the operator says the bot does, because the answer
 * changes the advice we give. A `search` bot fetching your page is how you get
 * cited; a `train` bot is how you enter a model's weights. Those are different
 * decisions, and a site owner is entitled to make them separately.
 */
export interface AiCrawler {
  /** The user-agent token, matched case-insensitively as a substring. */
  readonly ua: string
  readonly operator: string
  readonly purpose: 'search' | 'train' | 'agent' | 'ads'
  /** Operator documentation, so a reader can verify rather than trust us. */
  readonly docs: string
}

/**
 * AI crawlers that fetch and read HTML.
 *
 * Deliberately excluded: `Google-Extended` and `Applebot-Extended`, which are
 * training opt-out tokens rather than crawlers. They never issue a request, so
 * adding them here would be noise. The Google and Apple families are already
 * covered by the vendored default list above.
 */
export const AI_CRAWLERS: readonly AiCrawler[] = [
  // OpenAI. Note that OAI-AdsBot does not respect robots.txt.
  {
    ua: 'GPTBot',
    operator: 'OpenAI',
    purpose: 'train',
    docs: 'https://developers.openai.com/api/docs/bots',
  },
  {
    ua: 'OAI-SearchBot',
    operator: 'OpenAI',
    purpose: 'search',
    docs: 'https://developers.openai.com/api/docs/bots',
  },
  {
    ua: 'ChatGPT-User',
    operator: 'OpenAI',
    purpose: 'agent',
    docs: 'https://developers.openai.com/api/docs/bots',
  },
  {
    ua: 'OAI-AdsBot',
    operator: 'OpenAI',
    purpose: 'ads',
    docs: 'https://developers.openai.com/api/docs/bots',
  },

  // Anthropic. IP ranges are published at https://claude.com/crawling/bots.json
  {
    ua: 'ClaudeBot',
    operator: 'Anthropic',
    purpose: 'train',
    docs: 'https://claude.com/crawling/bots.json',
  },
  {
    ua: 'Claude-SearchBot',
    operator: 'Anthropic',
    purpose: 'search',
    docs: 'https://claude.com/crawling/bots.json',
  },
  {
    ua: 'Claude-User',
    operator: 'Anthropic',
    purpose: 'agent',
    docs: 'https://claude.com/crawling/bots.json',
  },
  {
    ua: 'anthropic-ai',
    operator: 'Anthropic',
    purpose: 'train',
    docs: 'https://claude.com/crawling/bots.json',
  },

  // Perplexity
  {
    ua: 'PerplexityBot',
    operator: 'Perplexity',
    purpose: 'search',
    docs: 'https://docs.perplexity.ai/docs/resources/perplexity-crawlers',
  },
  {
    ua: 'Perplexity-User',
    operator: 'Perplexity',
    purpose: 'agent',
    docs: 'https://docs.perplexity.ai/docs/resources/perplexity-crawlers',
  },

  // Meta
  {
    ua: 'Meta-ExternalAgent',
    operator: 'Meta',
    purpose: 'train',
    docs: 'https://developers.facebook.com/docs/sharing/webmasters/web-crawlers',
  },
  {
    ua: 'Meta-ExternalFetcher',
    operator: 'Meta',
    purpose: 'agent',
    docs: 'https://developers.facebook.com/docs/sharing/webmasters/web-crawlers',
  },

  // Others with published crawler documentation
  {
    ua: 'CCBot',
    operator: 'Common Crawl',
    purpose: 'train',
    docs: 'https://commoncrawl.org/ccbot',
  },
  { ua: 'Bytespider', operator: 'ByteDance', purpose: 'train', docs: 'https://www.bytedance.com' },
  {
    ua: 'Amazonbot',
    operator: 'Amazon',
    purpose: 'search',
    docs: 'https://developer.amazon.com/amazonbot',
  },
  {
    ua: 'MistralAI-User',
    operator: 'Mistral',
    purpose: 'agent',
    docs: 'https://docs.mistral.ai/robots',
  },
  { ua: 'cohere-ai', operator: 'Cohere', purpose: 'train', docs: 'https://cohere.com' },
  {
    ua: 'DuckAssistBot',
    operator: 'DuckDuckGo',
    purpose: 'search',
    docs: 'https://duckduckgo.com/duckduckgo-help-pages/results/duckassistbot/',
  },
  {
    ua: 'Diffbot',
    operator: 'Diffbot',
    purpose: 'train',
    docs: 'https://docs.diffbot.com/docs/en/guides-diffbot-crawler',
  },
  { ua: 'YouBot', operator: 'You.com', purpose: 'search', docs: 'https://about.you.com/youbot/' },
  {
    ua: 'Applebot-Extended',
    operator: 'Apple',
    purpose: 'train',
    docs: 'https://support.apple.com/en-us/119829',
  },
] as const

/** Just the user-agent tokens, in declaration order. */
export const AI_CRAWLER_UAS: readonly string[] = AI_CRAWLERS.map((c) => c.ua)

/* ========================================================================== */
/*  Pattern union                                                             */
/* ========================================================================== */

/**
 * Split a regex alternation into trimmed, non-empty **top level** branches.
 *
 * "Top level" is the whole job. A naive `pattern.split('|')` is correct only
 * while every `|` in the pattern separates two branches, and it silently
 * shreds anything else: `(GPTBot|Foo)|(GPTBot|Bar)` becomes four fragments,
 * two of which carry an unbalanced parenthesis, and `[a|b]-Bot` becomes `[a`
 * and `b]-Bot`. Rejoining those fragments produces either a regex that throws
 * at `next.config` evaluation time (so the application stops starting) or,
 * worse, one that compiles and no longer matches what the user wrote.
 *
 * So the scanner below tracks three things and nothing else: backslash
 * escapes, character classes, and group nesting. That is the entire grammar
 * needed to find the top level pipes, and it is small enough to audit without
 * shipping a regex parser into a consumer's repository.
 */
function splitAlternation(pattern: string): string[] {
  const branches: string[] = []
  let current = ''
  let depth = 0
  let inClass = false

  for (let i = 0; i < pattern.length; i += 1) {
    const ch = pattern[i]!
    if (ch === '\\') {
      current += ch + (pattern[i + 1] ?? '')
      i += 1
      continue
    }
    if (inClass) {
      if (ch === ']') inClass = false
      current += ch
      continue
    }
    if (ch === '[') {
      inClass = true
      current += ch
      continue
    }
    if (ch === '(') {
      depth += 1
      current += ch
      continue
    }
    if (ch === ')') {
      if (depth > 0) depth -= 1
      current += ch
      continue
    }
    if (ch === '|' && depth === 0) {
      branches.push(current)
      current = ''
      continue
    }
    current += ch
  }
  branches.push(current)

  return branches.map((s) => s.trim()).filter((s) => s.length > 0)
}

/**
 * `true` when every `|` in the pattern separates two top level branches.
 *
 * This is the exact condition under which branch-wise union is safe, and it is
 * deliberately narrower than "contains a group or a character class". Our own
 * written value contains `[\w-]+-Google`, so a test that rejected every `[`
 * would classify the value this module itself emits as unreadable and wrap it
 * on the second run, which would end idempotency. What actually matters is
 * whether a `|` hides inside a group, a class, or an escape.
 */
function isFlatAlternation(pattern: string): boolean {
  let depth = 0
  let inClass = false

  for (let i = 0; i < pattern.length; i += 1) {
    const ch = pattern[i]!
    if (ch === '\\') {
      if (pattern[i + 1] === '|') return false
      i += 1
      continue
    }
    if (inClass) {
      if (ch === '|') return false
      if (ch === ']') inClass = false
      continue
    }
    if (ch === '[') {
      inClass = true
      continue
    }
    if (ch === '(') {
      depth += 1
      continue
    }
    if (ch === ')') {
      if (depth > 0) depth -= 1
      continue
    }
    if (ch === '|' && depth > 0) return false
  }
  return true
}

/**
 * Split `(?:core)|rest` back into its two halves, or `null` when the pattern is
 * not in that shape.
 *
 * This is what makes the opaque path below a fixed point. Wrapping produces
 * `(?:whatever the user wrote)|<our union>`, and a second run has to recognise
 * its own output rather than wrapping it again, which would nest a group per
 * run forever.
 */
function splitWrapped(pattern: string): { core: string; rest: string } | null {
  if (!pattern.startsWith('(?:')) return null

  let depth = 0
  let inClass = false
  for (let i = 0; i < pattern.length; i += 1) {
    const ch = pattern[i]!
    if (ch === '\\') {
      i += 1
      continue
    }
    if (inClass) {
      if (ch === ']') inClass = false
      continue
    }
    if (ch === '[') {
      inClass = true
      continue
    }
    if (ch === '(') {
      depth += 1
      continue
    }
    if (ch !== ')') continue
    depth -= 1
    if (depth > 0) continue
    // `i` is the parenthesis closing the leading group.
    if (pattern[i + 1] !== '|') return null
    return { core: pattern.slice(3, i), rest: pattern.slice(i + 2) }
  }
  return null
}

/**
 * `true` when the source is a legal regular expression on its own.
 *
 * The gate for the third path in `buildHtmlLimitedBotsPattern`. Nothing here
 * imports anything, so `RegExp` doing the parsing is both the simplest answer
 * and the only one available.
 */
function compilesAsPattern(source: string): boolean {
  try {
    new RegExp(source, 'i')
    return true
  } catch {
    return false
  }
}

/** The Next.js defaults union the AI crawlers, deduplicated case-insensitively. */
function unionBranches(...groups: readonly (readonly string[])[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const group of groups) {
    for (const branch of group) {
      const key = branch.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      out.push(branch)
    }
  }
  return out
}

/**
 * Build the `htmlLimitedBots` pattern AgentBlog wants: the Next.js default list,
 * union whatever the project already had, union the AI crawlers.
 *
 * ---------------------------------------------------------------------------
 * TWO PATHS, AND WHICH SHAPE TAKES WHICH
 * ---------------------------------------------------------------------------
 * **Flat path.** The existing pattern is a plain alternation: every `|` in it
 * separates two branches, so the branches can be read out, merged with ours,
 * and written back in one list. This is the ordinary case, including every
 * value this function has ever written, and it is the path worth keeping
 * because the result is one readable line where a human can see their own bot
 * sitting next to Googlebot.
 *
 * **Opaque path.** The existing pattern hides a `|` inside a group, a
 * character class, or an escape (`(GPTBot|Foo)|Bar`, `[a|b]-Bot`, `Acme\|Bot`).
 * Branch-wise merging is not defined for those, and attempting it produced
 * exactly the failures this path exists to prevent: an unbalanced `)` that
 * throws when Next.js evaluates the config, a `Lone quantifier brackets` error
 * under the `u` flag, and a valid-looking regex whose second branch had
 * quietly become `b]-Cat`. So the whole pattern is wrapped as
 * `(?:<theirs>)|<ours>` and never taken apart. Their expression keeps its exact
 * meaning, ours is appended, and nothing is parsed that we cannot parse.
 *
 * Both paths are fixed points. Re-running the flat path finds every branch
 * already present. Re-running the opaque path recognises its own
 * `(?:core)|rest` shape via `splitWrapped` and rebuilds the same string rather
 * than nesting another group.
 *
 * **Third path: an input that does not compile is discarded.** Both paths above
 * assume the input is a regular expression, and neither is a fixed point when
 * it is not. Feeding in `(AcmeBot`, which has an unbalanced parenthesis, grew
 * the result from 581 to 1158 to 1735 bytes over three runs and never produced
 * anything that compiles, because `splitWrapped` cannot recognise a wrap whose
 * group never closes, so every run wrapped the previous run's output again. The
 * CLI's own write path is protected by a `compiles()` gate, but this function
 * ships verbatim into every consumer project as `lib/preflight-checks.ts`,
 * where the caller has no such gate. So a value we cannot even parse as a regex
 * is treated as opaque and not unioned at all: the result is the union we can
 * vouch for, it compiles, and it is stable on the second run.
 *
 * @param existing The project's current pattern source, if it already has one.
 */
export function buildHtmlLimitedBotsPattern(existing?: string): string {
  const defaults = splitAlternation(NEXT_DEFAULT_HTML_LIMITED_BOTS)

  // Next's defaults first, so a diff against upstream stays readable.
  if (!existing) return unionBranches(defaults, AI_CRAWLER_UAS).join('|')

  if (!compilesAsPattern(existing)) return unionBranches(defaults, AI_CRAWLER_UAS).join('|')

  if (isFlatAlternation(existing)) {
    return unionBranches(defaults, splitAlternation(existing), AI_CRAWLER_UAS).join('|')
  }

  const wrapped = splitWrapped(existing)
  const core = wrapped ? wrapped.core : existing
  // Branches the user appended after a previous wrap are kept, as long as that
  // tail is itself flat. When it is not, the whole thing goes back in the group.
  const tail = wrapped && isFlatAlternation(wrapped.rest) ? splitAlternation(wrapped.rest) : []
  if (wrapped && tail.length === 0 && wrapped.rest.trim().length > 0) {
    return `(?:${existing})|${unionBranches(defaults, AI_CRAWLER_UAS).join('|')}`
  }

  return `(?:${core})|${unionBranches(defaults, tail, AI_CRAWLER_UAS).join('|')}`
}

/**
 * Which required branches a pattern is missing.
 *
 * Matching is case-insensitive and exact per branch. A pattern that happens to
 * match `GPTBot` through some broader expression still counts as missing the
 * branch, because we cannot prove equivalence of two regexes and a false pass
 * here is the failure this whole module exists to prevent.
 */
export function missingBranches(pattern: string, required: readonly string[]): string[] {
  const present = new Set(splitAlternation(pattern).map((b) => b.toLowerCase()))
  return required.filter((r) => !present.has(r.toLowerCase()))
}

export interface HtmlLimitedBotsReport {
  /** `true` when `next.config.*` sets the key at all. */
  readonly configured: boolean
  /** Default-list branches the configured pattern dropped. Empty is correct. */
  readonly missingDefaults: readonly string[]
  /** AI crawler branches not covered. Empty is correct. */
  readonly missingAiCrawlers: readonly string[]
  /** The pattern found in the config, if any. */
  readonly pattern?: string
}

/**
 * Locate and evaluate `htmlLimitedBots` in the text of a `next.config.*` file.
 *
 * Text matching rather than an AST walk is deliberate. This same function runs
 * inside `lib/preflight.ts` in a consumer's repository, where there is no
 * TypeScript compiler to borrow and no dependency we are allowed to add. The
 * CLI does use an AST when it *writes*, because writing needs precision that
 * reading does not.
 *
 * Note that Next.js 16 requires a `RegExp` here, not a string: the config schema
 * is `z.instanceof(RegExp)` and a string fails config validation outright.
 */
export function analyzeHtmlLimitedBots(configSource: string): HtmlLimitedBotsReport {
  // Strings are blanked as well as comments. `env: { NOTE: 'set
  // htmlLimitedBots: /GPTBot/i' }` sitting above a perfectly correct real value
  // used to win, because this finder takes the first match in the file. The
  // result was a permanent ERROR that `--fix` could not clear, since the patcher
  // writes through the AST while the reader kept reading the string.
  const stripped = blankCommentsAndStrings(configSource)
  const match = /htmlLimitedBots\s*:\s*\/((?:[^/\\\n]|\\.)+)\/([gimsuy]*)/.exec(stripped)

  if (!match?.[1]) {
    return { configured: false, missingDefaults: [], missingAiCrawlers: [] }
  }

  const pattern = match[1]
  return {
    configured: true,
    pattern,
    missingDefaults: missingBranches(pattern, splitAlternation(NEXT_DEFAULT_HTML_LIMITED_BOTS)),
    missingAiCrawlers: missingBranches(pattern, AI_CRAWLER_UAS),
  }
}

/* ========================================================================== */
/*  next.config checks                                                        */
/* ========================================================================== */

export interface NextConfigInput {
  /** Full text of `next.config.ts` / `.mjs` / `.js`. */
  readonly source: string
  /** Path, used only in messages. */
  readonly path: string
}

/**
 * Every `next.config.*` finding AgentBlog knows how to report.
 *
 * `lib/preflight.ts` prints the errors and warnings at build time.
 * `agentblog doctor` prints all of them and can fix the fixable ones.
 */
export function checkNextConfig(input: NextConfigInput): Finding[] {
  const findings: Finding[] = []
  const source = blankCommentsAndStrings(input.source)
  const bots = analyzeHtmlLimitedBots(input.source)

  if (!bots.configured) {
    findings.push({
      id: 'html-limited-bots-missing',
      severity: 'error',
      message:
        `${input.path} does not set \`htmlLimitedBots\`. GPTBot, ClaudeBot, and PerplexityBot ` +
        'will receive `<title>` and `<meta>` inside `<body>` on any page with streamed metadata.',
      remedy: 'npx agentblog@latest doctor --fix',
      fixable: true,
    })
  } else {
    // Reported separately and at a higher severity than the AI half, because a
    // narrowed pattern is an active regression rather than a missed chance.
    if (bots.missingDefaults.length > 0) {
      findings.push({
        id: 'html-limited-bots-narrowed',
        severity: 'error',
        message:
          `${input.path} sets \`htmlLimitedBots\` to a pattern that drops ` +
          `${bots.missingDefaults.length} bot(s) from the Next.js default list, including ` +
          `${bots.missingDefaults.slice(0, 4).join(', ')}. This config overrides the default ` +
          'list rather than extending it, so those bots have lost HTML-limited treatment.',
        remedy:
          'npx agentblog@latest doctor --fix, which unions your pattern with the Next.js ' +
          'default list instead of replacing it.',
        fixable: true,
      })
    }
    if (bots.missingAiCrawlers.length > 0) {
      findings.push({
        id: 'html-limited-bots-incomplete',
        severity: 'warning',
        message:
          `${input.path} sets \`htmlLimitedBots\` but omits ` +
          `${bots.missingAiCrawlers.join(', ')}.`,
        remedy: 'npx agentblog@latest doctor --fix',
        fixable: true,
      })
    }
  }

  if (!/qualities\s*:/.test(source)) {
    findings.push({
      id: 'image-qualities-missing',
      severity: 'warning',
      message:
        `${input.path} does not set \`images.qualities\`. Next.js 16 defaults it to [75] and the ` +
        'image optimizer returns 400 for any other quality, so a hero image at quality 90 fails ' +
        'in production while working in development.',
      remedy: 'npx agentblog@latest doctor --fix',
      fixable: true,
    })
  }

  if (/cacheComponents\s*:\s*true/.test(source)) {
    findings.push({
      id: 'cache-components-enabled',
      severity: 'warning',
      message:
        `${input.path} enables \`cacheComponents\`. The default AgentBlog routes use classic ` +
        'prerendering with `export const revalidate`, which is not how Cache Components wants to ' +
        'be driven.',
      remedy:
        'Set `cacheComponents: false`, or convert the blog routes yourself to `use cache` with ' +
        '`cacheLife` and `cacheTag`. There is no AgentBlog route variant for Cache Components yet.',
      fixable: false,
    })
  }

  return findings
}

/* ========================================================================== */
/*  Root layout checks                                                        */
/* ========================================================================== */

/**
 * `metadataBase` and `title.template` both belong in the root layout.
 *
 * `title.template` applies to *child* segments only, so a template declared in
 * `app/blog/layout.tsx` does not apply to `app/blog/page.tsx`. Putting it
 * anywhere but the root is a silent no-op for the blog index.
 */
export function checkRootLayout(input: { source: string; path: string }): Finding[] {
  const findings: Finding[] = []
  const source = blankCommentsAndStrings(input.source)

  if (!/metadataBase\s*:/.test(source)) {
    findings.push({
      id: 'metadata-base-missing',
      severity: 'error',
      message:
        `${input.path} does not set \`metadataBase\`. Next.js needs it to turn relative metadata ` +
        'URLs into absolute ones, and the build errors without it once any metadata field is relative.',
      remedy: 'npx agentblog@latest doctor --fix',
      fixable: true,
    })
  }

  if (!/template\s*:/.test(source)) {
    findings.push({
      id: 'title-template-missing',
      severity: 'warning',
      message: `${input.path} does not set \`title.template\`, so post titles carry no site suffix.`,
      remedy: 'npx agentblog@latest doctor --fix',
      fixable: true,
    })
  }

  return findings
}

/* ========================================================================== */
/*  Shared helpers                                                            */
/* ========================================================================== */

/**
 * Remove line and block comments so a commented-out example does not read as a
 * live setting.
 *
 * String **contents survive**, and two callers depend on that: `readJsonc` in
 * the CLI parses the result as JSON, and doctor check 26 looks for the
 * placeholder `siteUrl`, which is a string literal. Use
 * `blankCommentsAndStrings` for anything that matches on code shape rather than
 * on string values.
 */
export function stripComments(source: string): string {
  let out = ''
  let i = 0
  let inString: string | null = null

  while (i < source.length) {
    const ch = source[i]!
    const next = source[i + 1]

    if (inString) {
      if (ch === '\\') {
        out += ch + (next ?? '')
        i += 2
        continue
      }
      if (ch === inString) inString = null
      out += ch
      i += 1
      continue
    }

    if (ch === '"' || ch === "'" || ch === '`') {
      inString = ch
      out += ch
      i += 1
      continue
    }

    if (ch === '/' && next === '/') {
      while (i < source.length && source[i] !== '\n') i += 1
      continue
    }

    if (ch === '/' && next === '*') {
      i += 2
      while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) i += 1
      i += 2
      continue
    }

    out += ch
    i += 1
  }

  return out
}

/**
 * Blank comments **and string contents**, replacing every blanked character
 * with a space and keeping newlines, so byte offsets and line numbers are
 * identical to the input.
 *
 * ---------------------------------------------------------------------------
 * WHY BLANKING STRINGS IS NOT OPTIONAL HERE
 * ---------------------------------------------------------------------------
 * The matchers in this file look for a setting by name and take the first hit.
 * A string that merely mentions the setting therefore beat the real value:
 *
 *   env: { NOTE: 'remember to set htmlLimitedBots: /GPTBot/i' },
 *   htmlLimitedBots: <the correct union>,
 *
 * read as a pattern of `GPTBot`, which reports 27 dropped default bots at
 * `error` severity forever. `doctor` exits 1, `lib/preflight.ts` warns on every
 * build, and `--fix` cannot clear it, because the patcher writes through the
 * AST while the reader keeps reading the string.
 *
 * The quotes themselves are kept so the result still parses as the same shape,
 * and offsets are preserved so a caller can map a match back into the original
 * text. Regex literals are left alone: reading one is the whole point.
 */
export function blankCommentsAndStrings(source: string): string {
  const out: string[] = []
  let i = 0
  let inString: string | null = null

  /** Emit spaces for `text`, keeping any newline it contains. */
  const blank = (text: string) => {
    out.push(text.replace(/[^\n]/g, ' '))
  }

  while (i < source.length) {
    const ch = source[i]!
    const next = source[i + 1]

    if (inString) {
      if (ch === '\\') {
        blank(ch + (next ?? ''))
        i += 2
        continue
      }
      if (ch === inString) {
        inString = null
        out.push(ch)
        i += 1
        continue
      }
      blank(ch)
      i += 1
      continue
    }

    if (ch === '"' || ch === "'" || ch === '`') {
      inString = ch
      out.push(ch)
      i += 1
      continue
    }

    if (ch === '/' && next === '/') {
      const start = i
      while (i < source.length && source[i] !== '\n') i += 1
      blank(source.slice(start, i))
      continue
    }

    if (ch === '/' && next === '*') {
      const start = i
      i += 2
      while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) i += 1
      i = Math.min(i + 2, source.length)
      blank(source.slice(start, i))
      continue
    }

    out.push(ch)
    i += 1
  }

  return out.join('')
}

/** Sort findings so the most severe are reported first. */
export function bySeverity(a: Finding, b: Finding): number {
  const rank = { error: 0, warning: 1, info: 2 } as const
  return rank[a.severity] - rank[b.severity]
}

/** `true` when any finding would fail a build gate. */
export function hasErrors(findings: readonly Finding[]): boolean {
  return findings.some((f) => f.severity === 'error')
}
