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
 * @see https://agentblog.dev/docs/troubleshooting-cdn
 */
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

  ctx.reporter.group(`Live crawler access (${ctx.url})`)

  // Said before any result, because a pass printed on the deploy host is the one
  // result in this whole report that can be confidently wrong.
  ctx.reporter.fail('16 where this ran', {
    id: 'live-origin-caveat',
    severity: 'info',
    message: `These requests came from this machine, wherever that is. Run them from CI or from your own laptop, not from inside the deployment: a request that starts inside the network can reach the origin without passing the CDN rule this check is looking for, and then a blocked site reports a pass.`,
    remedy: 'If this ran on the deploy host, run it again from somewhere outside the network.',
  })

  let cdn: string | null = null
  for (const agent of AGENTS) {
    const result = await fetchAs(ctx.url, agent.ua)
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
