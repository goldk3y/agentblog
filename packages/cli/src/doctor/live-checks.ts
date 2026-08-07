/**
 * The live crawler checks.
 *
 * Two documented checks share one set of requests, and they report under their
 * own numbers so a failure maps to the list:
 *
 *   check 15  `<title>` arrives inside `<head>`, not streamed into `<body>`
 *   check 16  each crawler user agent receives the article at all
 *
 * ===========================================================================
 * THIS IS THE MOST VALUABLE CHECK IN THE PRODUCT
 * ===========================================================================
 * Every other check reads files. This one is the only thing that catches a
 * correctly installed blog that is nonetheless invisible, and that failure is
 * both common and completely silent from inside the repository.
 *
 * The cause is usually the CDN, not the code. From September 15 2026,
 * Cloudflare blocks Training and Agent crawlers by default on ad-displaying
 * pages for new domains, new sites on existing accounts, and any Free tier
 * account that has not changed the setting. Search crawlers stay allowed. And
 * the part that turns a GEO issue into an SEO emergency, in Cloudflare's own
 * words: "multi-purpose crawlers such as Googlebot, Applebot, and BingBot will
 * be blocked by customers who have selected to block Training."
 *
 * So a developer can put a perfect install behind a free Cloudflare zone, tick
 * one box, and lose Googlebot. `doctor` passes. `preflight` is silent. Every
 * file on disk is correct. Only a real request with a real crawler user agent
 * finds it, which is why `Googlebot` is in the list alongside the AI crawlers.
 *
 * WHERE YOU RUN THIS DECIDES WHETHER IT MEANS ANYTHING. `fetchAs` is an ordinary
 * `fetch` from wherever the CLI process happens to be. Run it from CI or from
 * your own machine, never from inside the deployment: a request that originates
 * inside the network can reach the origin without passing through the CDN rule
 * this check exists to find, and it then reports a pass for a site that is
 * blocked to everyone outside. The check says so in its own output rather than
 * relying on the reader having read this comment.
 *
 * @see https://docs.agentblog.dev/troubleshooting/cdn-blocking-crawlers
 */
import { loadPosts, resolveContentDir } from '../audit/post.ts'
import type { DoctorContext } from './context.ts'

interface Agent {
  readonly name: string
  readonly ua: string
  /** What the operator says this bot is for. Changes the advice we give. */
  readonly purpose: 'search' | 'train' | 'agent'
}

const AGENTS: readonly Agent[] = [
  {
    name: 'GPTBot',
    purpose: 'train',
    ua: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.2; +https://openai.com/gptbot',
  },
  {
    name: 'OAI-SearchBot',
    purpose: 'search',
    ua: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot',
  },
  {
    name: 'ClaudeBot',
    purpose: 'train',
    ua: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ClaudeBot/1.0; +claudebot@anthropic.com',
  },
  {
    name: 'PerplexityBot',
    purpose: 'search',
    ua: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot',
  },
  {
    name: 'Googlebot',
    purpose: 'search',
    ua: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  },
]

/** Phrases that mean a challenge page rather than the article. */
const CHALLENGE_MARKERS = [
  'just a moment',
  'checking your browser',
  'attention required',
  'enable javascript and cookies to continue',
  'verify you are human',
  'ddos protection by',
]

interface Fetched {
  readonly status: number
  readonly body: string
  readonly headers: Headers
}

/** Blog routes that are real pages but are never a post. */
const NON_POST_SEGMENTS = new Set(['category', 'tag', 'page'])

interface Probe {
  /** The URL every agent is actually sent to. */
  readonly url: string
  /** Explains a URL the user did not type, or `null` when they typed it. */
  readonly derivedFrom: string | null
}

/**
 * The URL to probe, which is not always the URL the user passed.
 *
 * ===========================================================================
 * WHY THIS IS NOT JUST `ctx.url`
 * ===========================================================================
 * `--url` is documented as a live URL and the natural thing to hand it is the
 * site root. AgentBlog's primary install path is adding a blog to an app that
 * already exists, so that root is somebody else's landing page. It is often a
 * marketing hero of a dozen words, and check 16 then reported five errors
 * saying the article was client rendered, on an install where every article was
 * prerendered correctly. Those errors exit non-zero, so a correct install broke
 * the CI step that was added to protect it, and the remedy told the user to go
 * looking for a server component behind a page that is not an article at all.
 *
 * A false error in the one check nobody can verify from inside the repository
 * is worse than no check: it is the finding people learn to ignore. So a URL
 * that does not already name a post is treated as an origin, and the probe
 * targets a real slug read off disk. The derivation is printed, because a check
 * that silently tests a different URL than the one you gave it is its own trap.
 */
function resolveProbeUrl(ctx: DoctorContext): Probe {
  const given = ctx.url as string
  if (namesAPost(given)) return { url: given, derivedFrom: null }

  const dir = resolveContentDir(ctx.project.root, ctx.project.usesSrcDir)
  const slug = loadPosts(dir)[0]?.slug
  if (!slug) return { url: given, derivedFrom: null }

  try {
    return { url: new URL(`/blog/${slug}`, given).toString(), derivedFrom: given }
  } catch {
    return { url: given, derivedFrom: null }
  }
}

/** `true` when the path is `/blog/<slug>` rather than an index or a taxonomy. */
function namesAPost(url: string): boolean {
  let path: string
  try {
    path = new URL(url).pathname
  } catch {
    return false
  }
  const segments = path.split('/').filter(Boolean)
  const blogAt = segments.indexOf('blog')
  if (blogAt === -1) return segments.length > 0
  const next = segments[blogAt + 1]
  return next !== undefined && !NON_POST_SEGMENTS.has(next)
}

export async function runLiveChecks(ctx: DoctorContext): Promise<void> {
  if (!ctx.url) {
    ctx.reporter.group('Live crawler access')
    ctx.reporter.skip(
      '16 live crawler access',
      'no --url was given. This is the only check that catches a correct install that crawlers cannot reach. Run it from CI or your own machine, not from inside the deployment.',
    )
    ctx.reporter.skip('15 title placement in the live response', 'no --url was given')
    return
  }

  const probe = resolveProbeUrl(ctx)
  ctx.reporter.group(`Live crawler access (${probe.url})`)

  if (probe.derivedFrom) {
    ctx.reporter.fail('16 probe URL', {
      id: 'live-probe-derived',
      severity: 'info',
      message: `${probe.derivedFrom} does not name a post, so these checks measure a real article instead. Word counts on a site root say nothing about whether your posts are readable.`,
      remedy: 'Pass a post URL directly to probe a specific one.',
    })
  }

  // Said before any result, because a pass printed on the deploy host is the one
  // result in this whole report that can be confidently wrong.
  ctx.reporter.fail('16 where this ran', {
    id: 'live-origin-caveat',
    severity: 'info',
    message: `These requests came from this machine, wherever that is. Run them from CI or from your own laptop, not from inside the deployment: a request that starts inside the network can reach the origin without passing the CDN rule this check is looking for, and then a blocked site reports a pass.`,
    remedy: 'If this ran on the deploy host, run it again from somewhere outside the network.',
  })

  const robots = await fetchRobots(probe.url)
  const path = pathOf(probe.url)

  let cdn: string | null = null
  for (const agent of AGENTS) {
    assessRobots(ctx, agent, robots, path)

    const result = await fetchAs(probe.url, agent.ua)
    if (!result) {
      ctx.reporter.fail(`16 ${agent.name}`, {
        id: `live-fetch-failed-${agent.name}`,
        severity: 'error',
        message: `The request as ${agent.name} did not complete. The host may be refusing the connection outright.`,
        remedy:
          'Check the URL, then check your CDN or firewall logs for a block on this user agent.',
      })
      continue
    }

    cdn ??= detectCdn(result.headers)
    assess(ctx, agent, result, cdn)
  }

  if (cdn) {
    ctx.reporter.fail('16 CDN detected', {
      id: 'cdn-detected',
      severity: 'info',
      message: `This site is served through ${cdn}. The CDN decides which crawlers reach your HTML, and it does so above anything in this repository.`,
      remedy: remediationFor(cdn),
    })
  }
}

/* -------------------------------------------------------------------------- */
/*  robots.txt                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Whether the site's own `robots.txt` lets each crawler have the page.
 *
 * ===========================================================================
 * THE FAILURE THIS EXISTS FOR
 * ===========================================================================
 * The shipped `app/robots.ts` serves `Disallow: /` unless it can prove it is in
 * production, and it proves that with `VERCEL_ENV === 'production'`. Off Vercel
 * that variable does not exist, so a correct install on Netlify, Fly, Cloud Run,
 * or any container ships a production site that asks every crawler to leave.
 * `AGENTBLOG_PUBLIC_SITE=true` is the documented answer and it is one line in a
 * dashboard nobody revisits.
 *
 * Until now the live checks fetched the page as five crawler user agents and
 * never asked whether those crawlers were allowed to want it. A well behaved
 * bot reads `robots.txt` first and never sends the request that check 16
 * measures, so a completely deindexed site scored a clean pass on the one check
 * that exists to catch a site crawlers cannot read. Fetching one more file
 * closes that, and it is the cheapest request in this whole command.
 *
 * `null` means the question could not be answered (no `robots.txt`, or it did
 * not parse), which is reported as unknown rather than as a pass.
 */
export interface RobotsGroup {
  readonly tokens: readonly string[]
  readonly rules: readonly RobotsRule[]
}

interface RobotsRule {
  readonly allow: boolean
  readonly path: string
}

/**
 * A deliberately small subset of RFC 9309: groups, `Allow`, `Disallow`, `*`,
 * and `$`. Enough to answer "is this one path allowed for this one token",
 * which is the only question asked here. Anything it cannot parse it drops,
 * because a robots parser that guesses would produce exactly the confident
 * wrong answer this check was added to stop.
 *
 * @see https://www.rfc-editor.org/rfc/rfc9309.html
 */
export function parseRobots(text: string): RobotsGroup[] {
  const groups: RobotsGroup[] = []
  let tokens: string[] = []
  let rules: RobotsRule[] = []
  let collectingTokens = false

  const flush = (): void => {
    if (tokens.length > 0) groups.push({ tokens, rules })
    tokens = []
    rules = []
  }

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim()
    if (line === '') continue
    const separator = line.indexOf(':')
    if (separator === -1) continue

    const field = line.slice(0, separator).trim().toLowerCase()
    const value = line.slice(separator + 1).trim()

    if (field === 'user-agent') {
      // A new user-agent line after rules starts a new group. Consecutive ones
      // share the group that follows them.
      if (!collectingTokens) flush()
      collectingTokens = true
      tokens.push(value.toLowerCase())
      continue
    }

    if (field === 'allow' || field === 'disallow') {
      collectingTokens = false
      rules.push({ allow: field === 'allow', path: value })
    }
  }
  flush()
  return groups
}

/**
 * `true` when `path` is allowed for `token`, `false` when disallowed, `null`
 * when no group applies.
 *
 * Group selection and rule precedence both follow the specification: the most
 * specific user-agent group wins and `*` is the fallback, then the longest
 * matching rule wins, and `Allow` breaks a tie.
 */
export function isAllowed(
  groups: readonly RobotsGroup[],
  token: string,
  path: string,
): boolean | null {
  const lower = token.toLowerCase()
  const specific = groups.filter((group) => group.tokens.includes(lower))
  const applicable = specific.length > 0 ? specific : groups.filter((g) => g.tokens.includes('*'))
  if (applicable.length === 0) return null

  let winner: RobotsRule | null = null
  for (const group of applicable) {
    for (const rule of group.rules) {
      if (rule.path === '' || !matchesRobotsPath(rule.path, path)) continue
      if (
        winner === null ||
        rule.path.length > winner.path.length ||
        (rule.path.length === winner.path.length && rule.allow)
      ) {
        winner = rule
      }
    }
  }
  return winner === null ? true : winner.allow
}

/** `*` matches any run of characters, a trailing `$` anchors the end. */
function matchesRobotsPath(pattern: string, path: string): boolean {
  const anchored = pattern.endsWith('$')
  const body = anchored ? pattern.slice(0, -1) : pattern
  const expression = body
    .split('*')
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*')
  return new RegExp(`^${expression}${anchored ? '$' : ''}`).test(path)
}

async function fetchRobots(probeUrl: string): Promise<readonly RobotsGroup[] | null> {
  let robotsUrl: string
  try {
    robotsUrl = new URL('/robots.txt', probeUrl).toString()
  } catch {
    return null
  }
  const result = await fetchAs(robotsUrl, AGENTS[0]?.ua ?? '')
  if (!result || result.status !== 200) return null
  // A robots.txt route that errors into an HTML page is not a robots.txt.
  if (/^\s*</.test(result.body)) return null
  return parseRobots(result.body)
}

async function fetchAs(url: string, ua: string): Promise<Fetched | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.signal.aborted || controller.abort(), 15_000)
  try {
    const response = await fetch(url, {
      headers: { 'user-agent': ua, accept: 'text/html,application/xhtml+xml' },
      redirect: 'follow',
      signal: controller.signal,
    })
    return { status: response.status, body: await response.text(), headers: response.headers }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/** The path a robots rule is matched against, `/` when the URL will not parse. */
function pathOf(url: string): string {
  try {
    return new URL(url).pathname
  } catch {
    return '/'
  }
}

/**
 * Check 16, the half that runs before any request.
 *
 * A crawler that reads `Disallow: /` never asks for the page, so every result
 * below this line describes traffic that would not happen. That makes this the
 * one finding here worth reporting even though the fetch that follows it
 * succeeds: the fetch proves the origin will serve a bot, not that any bot will
 * ever ask.
 */
function assessRobots(
  ctx: DoctorContext,
  agent: Agent,
  robots: readonly RobotsGroup[] | null,
  path: string,
): void {
  const name = `16 ${agent.name} robots.txt`

  if (robots === null) {
    ctx.reporter.skip(name, 'no parseable robots.txt was served, so nothing could be decided')
    return
  }

  const allowed = isAllowed(robots, agent.name, path)
  if (allowed === false) {
    ctx.reporter.fail(name, {
      id: `live-robots-disallowed-${agent.name}`,
      severity: 'error',
      message: `robots.txt disallows ${path} for ${agent.name}, so this crawler will never request the page no matter how well it renders.${agent.name === 'Googlebot' ? ' This also removes the site from classic search.' : ''}`,
      remedy:
        'The shipped app/robots.ts serves Disallow: / unless VERCEL_ENV is production. Off Vercel, set AGENTBLOG_PUBLIC_SITE=true on the production deployment. See https://docs.agentblog.dev/deploy.',
    })
    return
  }

  if (allowed === null) {
    ctx.reporter.skip(name, 'robots.txt has no group matching this agent or *')
    return
  }
  ctx.reporter.pass(`16 ${agent.name}: robots.txt allows ${path}`)
}

function assess(ctx: DoctorContext, agent: Agent, result: Fetched, cdn: string | null): void {
  const name = `16 ${agent.name}`

  if (result.status === 403 || result.status === 401 || result.status === 429) {
    ctx.reporter.fail(name, {
      id: `live-blocked-${agent.name}`,
      severity: 'error',
      message: `${agent.name} received HTTP ${result.status}. This bot cannot read the page at all, so nothing it powers can cite you.${agent.name === 'Googlebot' ? ' Blocking Googlebot also removes you from classic search.' : ''}`,
      remedy: cdn
        ? remediationFor(cdn)
        : 'Find what returns 403 for this user agent: CDN bot rules, a WAF rule, or origin middleware.',
    })
    return
  }

  if (result.status !== 200) {
    ctx.reporter.fail(name, {
      id: `live-status-${agent.name}`,
      severity: 'error',
      message: `${agent.name} received HTTP ${result.status} rather than 200.`,
      remedy: 'Check for a redirect chain, a geo rule, or an origin error on this route.',
    })
    return
  }

  const lower = result.body.toLowerCase()
  const challenge = CHALLENGE_MARKERS.find((marker) => lower.includes(marker))
  if (challenge) {
    ctx.reporter.fail(name, {
      id: `live-challenge-${agent.name}`,
      severity: 'error',
      message: `${agent.name} received 200 but the body is an interstitial ("${challenge}"), not your article. A crawler stores the challenge page, which is worse than a 403 because it looks like success.`,
      remedy: cdn
        ? remediationFor(cdn)
        : 'Turn off bot challenges for verified crawler user agents.',
    })
    return
  }

  const words = countVisibleWords(result.body)
  if (words < 50) {
    ctx.reporter.fail(name, {
      id: `live-empty-${agent.name}`,
      severity: 'error',
      message: `${agent.name} received 200 with only ${words} words of visible text. AI crawlers do not execute JavaScript, so a client rendered body is an empty shell to them.`,
      remedy:
        'Confirm the article renders in a server component and that the route is prerendered.',
    })
    return
  }

  ctx.reporter.pass(`16 ${agent.name}: 200, ${words} words`)
  assessTitlePlacement(ctx, agent, lower)
}

/**
 * Check 15, reported under its own number.
 *
 * It shares check 16's requests because issuing a second round of them would
 * double the traffic to prove the same bytes twice, but a user reading a failure
 * has to be able to map it back to the documented list, and "16" for a metadata
 * streaming failure sends them to the wrong entry.
 */
function assessTitlePlacement(ctx: DoctorContext, agent: Agent, lower: string): void {
  const name = `15 ${agent.name}`
  const headEnd = lower.indexOf('</head>')
  const titleAt = lower.indexOf('<title')

  if (titleAt === -1) {
    ctx.reporter.fail(name, {
      id: `live-no-title-${agent.name}`,
      severity: 'error',
      message: `${agent.name} received a page with no <title> at all.`,
      remedy: 'Set metadata on the route, and metadataBase in the root layout.',
    })
    return
  }
  if (headEnd !== -1 && titleAt > headEnd) {
    ctx.reporter.fail(name, {
      id: `live-title-in-body-${agent.name}`,
      severity: 'error',
      message: `${agent.name} received <title> inside <body>. That is the metadata streaming trap: this bot is not in htmlLimitedBots, so Next.js streams its metadata.`,
      remedy: 'npx agentblog doctor --fix, which unions the bot into htmlLimitedBots.',
      fixable: true,
    })
    return
  }
  ctx.reporter.pass(`15 ${agent.name}: <title> arrived inside <head>`)
}

/** Strip scripts, styles, and tags, then count words. */
function countVisibleWords(html: string): number {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
  return text.split(/\s+/).filter((word) => word.length > 1).length
}

function detectCdn(headers: Headers): string | null {
  const server = headers.get('server')?.toLowerCase() ?? ''
  if (server.includes('cloudflare') || headers.has('cf-ray')) return 'Cloudflare'
  if (headers.has('x-vercel-id') || server.includes('vercel')) return 'Vercel'
  if (headers.has('x-amz-cf-id')) return 'CloudFront'
  if (server.includes('akamai') || headers.has('x-akamai-transformed')) return 'Akamai'
  if (headers.has('x-fastly-request-id') || server.includes('fastly')) return 'Fastly'
  return null
}

function remediationFor(cdn: string): string {
  switch (cdn) {
    case 'Cloudflare':
      return 'Cloudflare dashboard, your zone, Settings, AI crawler controls. Allow Search and Agent crawlers. Note that blocking Training also blocks Googlebot, Applebot, and BingBot, because they are multi-purpose crawlers.'
    case 'Vercel':
      return 'Vercel project, Firewall, check Bot Protection and any custom rule matching crawler user agents.'
    case 'CloudFront':
      return 'Check the AWS WAF web ACL on this distribution for a bot control rule group blocking these user agents.'
    case 'Akamai':
      return 'Check Bot Manager categories for this property. Verified crawlers must be allowed.'
    case 'Fastly':
      return 'Check any bot detection or rate limiting VCL on this service.'
    default:
      return 'Check the CDN or WAF in front of this origin for a rule matching crawler user agents.'
  }
}
