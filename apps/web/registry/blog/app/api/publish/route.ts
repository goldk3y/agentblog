/**
 * `POST /api/publish`: the publish webhook.
 *
 * ===========================================================================
 * WHAT THIS ENDPOINT IS FOR
 * ===========================================================================
 * One endpoint, three triggers. For an MDX-on-disk blog the trigger is a git
 * push (your host redeploys and this is optional). For a database-backed source
 * it is a row-change webhook. For a hosted publishing agent it is a direct call.
 * The body is always the same: `{ "slug": "my-post" }`.
 *
 * ===========================================================================
 * THE TWO CORRECTIONS THIS FILE EXISTS TO ENCODE
 * ===========================================================================
 *
 * ---------------------------------------------------------------------------
 * 1. REVALIDATE THE METADATA ROUTES, NOT ONLY THE PAGE ROUTES
 * ---------------------------------------------------------------------------
 * `sitemap.xml`, `feed.xml`, `robots.txt`, and every `opengraph-image` are
 * special Route Handlers that Next.js caches by default. Revalidating only
 * `/blog/<slug>` and `/blog` leaves the sitemap and the feed serving their
 * build-time output.
 *
 * The consequence is specific and bad: we then fire an IndexNow ping for a URL
 * that our own sitemap does not list. We are simultaneously telling a search
 * engine "this page is new and important" and "this page does not exist on my
 * site". On a filesystem-backed blog you will never see this, because publishing
 * is a deploy and the deploy rebuilds everything. On any database-backed source
 * it happens on every single publish.
 *
 * So `handlerPathsFor()` below is load-bearing. Do not delete it to make the
 * function faster.
 *
 * ---------------------------------------------------------------------------
 * 2. `revalidateTag('posts', { expire: 0 })`, NEVER `'max'`
 * ---------------------------------------------------------------------------
 * `'max'` is stale-while-revalidate: the tag is marked stale, and fresh data is
 * only fetched when a page using it is next visited. On a publish event that is
 * exactly backwards, because the IndexNow ping we are about to send is an
 * invitation for a crawler to BE that next visit. The crawler arrives, receives
 * the stale body, and triggers a background refresh it will never come back to
 * see. For a blog whose entire premise is what lands in the first response byte,
 * that undoes the point of the endpoint.
 *
 * In Next.js 16.3 the second argument is required by the type signature. The
 * single-argument form is deprecated rather than removed.
 *
 * ===========================================================================
 * ENVIRONMENT
 * ===========================================================================
 *   AGENTBLOG_REVALIDATE_SECRET   required. Shared secret for this endpoint.
 *   AGENTBLOG_DEPLOY_WAIT_MS      optional. Deploy wait budget, default 45000.
 *
 * @see https://agentblog.dev/docs/blog-block
 */
import { revalidatePath, revalidateTag } from 'next/cache'
import { createHash, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'

import { authorPath, blogPath, categoryPath, config, postPath, postUrl } from '@/lib/config'
import { pingIndexNow } from '@/lib/indexnow'
import { getPost } from '@/lib/posts'
import { Slug } from '@/lib/schemas'

/** Node APIs (`node:crypto`) and a real outbound fetch to our own origin. */
export const runtime = 'nodejs'

/** Never cache a webhook. Every call must do the work it says it does. */
export const dynamic = 'force-dynamic'

/**
 * The deploy wait below can hold the request open. 60 seconds is the ceiling on
 * a Vercel Hobby plan; raise it here and in `AGENTBLOG_DEPLOY_WAIT_MS` together
 * if your plan allows more.
 */
export const maxDuration = 60

/* ========================================================================== */
/*  Request contract                                                          */
/* ========================================================================== */

/**
 * `Slug` rather than `z.string()`.
 *
 * This value is interpolated into `revalidatePath()` and into a URL we then
 * fetch. The slug brand rejects slashes, dots, and anything that is not
 * lowercase-and-hyphens, which closes the path traversal that a bare string
 * would leave open. Validation at the boundary, as everywhere else in the block.
 */
const PublishRequestSchema = z.object({ slug: Slug })

/* ========================================================================== */
/*  Deploy wait tuning                                                        */
/* ========================================================================== */

const DEFAULT_DEPLOY_WAIT_MS = 45_000

/** Deploys never finish instantly. Probing immediately just burns the budget. */
const FIRST_PROBE_DELAY_MS = 8_000
const PROBE_INTERVAL_MS = 5_000

function deployWaitBudgetMs(): number {
  const raw = process.env.AGENTBLOG_DEPLOY_WAIT_MS
  const parsed = raw === undefined ? Number.NaN : Number(raw)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_DEPLOY_WAIT_MS
}

/* ========================================================================== */
/*  Auth                                                                      */
/* ========================================================================== */

/**
 * Constant-time secret comparison.
 *
 * Both sides are hashed first so the buffers are always 32 bytes. That matters:
 * `timingSafeEqual` throws on unequal lengths, and the usual workaround (compare
 * lengths, bail early) leaks the secret's length through timing. Hashing removes
 * the question entirely.
 */
function secretsMatch(presented: string, expected: string): boolean {
  const a = createHash('sha256').update(presented, 'utf8').digest()
  const b = createHash('sha256').update(expected, 'utf8').digest()
  return timingSafeEqual(a, b)
}

/**
 * Accept the secret as `Authorization: Bearer <secret>` or as
 * `x-agentblog-secret: <secret>`. The first is what most platforms send; the
 * second is what most no-code webhook builders can actually configure.
 */
function presentedSecret(request: Request): string | null {
  const authorization = request.headers.get('authorization')
  if (authorization && /^Bearer /i.test(authorization)) {
    return authorization.slice('Bearer '.length).trim()
  }
  return request.headers.get('x-agentblog-secret')
}

/* ========================================================================== */
/*  Revalidation                                                              */
/* ========================================================================== */

/**
 * Route handler paths that carry post data and are cached by default.
 *
 * `robots.txt` is deliberately absent: nothing in it derives from a post, so
 * revalidating it on every publish would be work that can never change a byte.
 *
 * `/sitemap.xml` and `/feed.xml` are literals rather than helper calls because
 * both end in a file extension, and the path helpers in `@/lib/config` never
 * append a trailing slash to a segment that looks like a file. They are already
 * in final form. The OG image path is built from `postPath` so the slug is
 * encoded exactly once, in the same place every other post URL is built.
 */
function handlerPathsFor(slug: string): string[] {
  return [
    '/sitemap.xml',
    '/feed.xml',
    /**
     * Best effort. Next.js derives its own route path for metadata image
     * handlers and appends a generated suffix for cache busting, so this call
     * may be a no-op depending on how your deployment names the route. It costs
     * nothing when it misses, and the reliable invalidation for an OG image is a
     * deploy. Say so out loud rather than implying a guarantee.
     */
    `${postPath(slug).replace(/\/$/, '')}/opengraph-image`,
  ]
}

/* ========================================================================== */
/*  Deploy hook                                                               */
/* ========================================================================== */

/**
 * What we know about whether the new URL is actually servable.
 *
 * Read these as claims about the URL, not about the deploy platform:
 *
 *   'not-needed'      the route was already servable, or the source prerenders
 *                     new slugs without a rebuild.
 *   'confirmed-live'  we fired the hook and then observed the URL return a
 *                     non-404 from the public origin.
 *   'timed-out'       we fired the hook and never observed a non-404 inside the
 *                     budget. The deploy may still land later.
 *   'hook-failed'     the deploy hook itself did not accept the request.
 *   'not-configured'  the source needs a rebuild and no `deployHook` is set.
 */
type DeployOutcome =
  'not-needed' | 'confirmed-live' | 'timed-out' | 'hook-failed' | 'not-configured'

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Does the public origin serve this URL right now?
 *
 * The cache-busting query parameter is the point of the function. Without it a
 * CDN can answer from its cached copy of the 404 we are trying to see disappear,
 * and we would report success or failure based on a stale edge object rather
 * than on the origin. Next.js ignores unknown query parameters when matching a
 * route, so the probe URL and the canonical URL resolve to the same page.
 */
async function urlIsServable(url: string): Promise<boolean> {
  const separator = url.includes('?') ? '&' : '?'
  try {
    const response = await fetch(`${url}${separator}agentblog-probe=${Date.now()}`, {
      method: 'GET',
      cache: 'no-store',
      redirect: 'follow',
      headers: { accept: 'text/html', 'user-agent': 'agentblog-publish-webhook' },
    })
    return response.ok
  } catch {
    // A network failure is not evidence that the page exists.
    return false
  }
}

/**
 * Fire the deploy hook, then wait until the URL answers.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS GUARANTEES, AND WHAT IT DOES NOT
 * ---------------------------------------------------------------------------
 * Guaranteed: we do not ping IndexNow before we have seen the public origin
 * return a non-404 for the exact URL we are about to submit. That is the whole
 * requirement. Pinging first invites a crawler to a URL that does not exist yet,
 * and a crawler that receives a 404 on its first visit is expensive to convince
 * otherwise.
 *
 * NOT guaranteed, and worth knowing before you rely on this:
 *
 *   - We do not talk to your platform's deployment API. A deploy hook returns
 *     "accepted", not "finished", and there is no portable completion signal
 *     across Vercel, Netlify, Cloudflare Pages, and a self-hosted runner. So the
 *     URL responding is our proxy for "the deploy succeeded", and it is a proxy.
 *   - A non-404 is not proof the page is correct. It proves the route resolves.
 *     If the new build shipped a broken post, this reports success.
 *   - CDNs are regional. The URL answering from the region this function runs in
 *     does not prove it answers everywhere yet.
 *   - The wait is bounded (`AGENTBLOG_DEPLOY_WAIT_MS`, default 45s, inside a
 *     60s function ceiling). A slow build will time out. When it does we return
 *     202 and DO NOT ping, so a retry is safe and idempotent. Timing out is the
 *     honest answer, not a failure to handle.
 *   - Paths are revalidated before this runs, so a retry after a timeout costs
 *     one more ping and nothing else.
 */
async function fireDeployHookAndWait(url: string): Promise<DeployOutcome> {
  const hook = config.deployHook
  if (!hook) return 'not-configured'

  try {
    const response = await fetch(hook, { method: 'POST', cache: 'no-store' })
    if (!response.ok) return 'hook-failed'
  } catch {
    return 'hook-failed'
  }

  const budget = deployWaitBudgetMs()
  const deadline = Date.now() + budget

  await sleep(Math.min(FIRST_PROBE_DELAY_MS, budget))

  while (Date.now() < deadline) {
    if (await urlIsServable(url)) return 'confirmed-live'
    await sleep(PROBE_INTERVAL_MS)
  }

  return 'timed-out'
}

/* ========================================================================== */
/*  Response shapes                                                           */
/* ========================================================================== */

interface IndexNowReport {
  readonly attempted: boolean
  /** Present only when attempted. `200` submitted, `202` pending key validation. */
  readonly status?: number
  readonly ok?: boolean
  readonly meaning?: string
  /** Present only when skipped. */
  readonly reason?: string
}

function json(status: number, body: Record<string, unknown>): Response {
  return Response.json(body, { status })
}

/* ========================================================================== */
/*  Handler                                                                   */
/* ========================================================================== */

export async function POST(request: Request): Promise<Response> {
  const expected = process.env.AGENTBLOG_REVALIDATE_SECRET
  if (!expected) {
    // A server misconfiguration, not an auth decision. Answering 401 here would
    // make a dead endpoint indistinguishable from a live one with a bad secret,
    // which is the exact debugging trap this product exists to remove.
    return json(500, {
      ok: false,
      error: 'AGENTBLOG_REVALIDATE_SECRET is not set on this deployment.',
    })
  }

  const presented = presentedSecret(request)
  // One message for both "no header" and "wrong secret". A caller learns only
  // that it is not authorized, which is all it is entitled to know.
  if (presented === null || !secretsMatch(presented, expected)) {
    return json(401, { ok: false, error: 'Unauthorized.' })
  }

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return json(400, { ok: false, error: 'Request body must be JSON.', issues: [] })
  }

  const parsed = PublishRequestSchema.safeParse(raw)
  if (!parsed.success) {
    return json(400, {
      ok: false,
      error: 'Invalid request body.',
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.map(String).join('.') || '(root)',
        message: issue.message,
      })),
    })
  }

  const { slug } = parsed.data
  const url = postUrl(slug)
  const strategy = config.source.prerenderStrategy

  /**
   * `getPost` returns `null` for a slug the source does not know, and also for a
   * post still marked `draft`, because drafts are opted into rather than out of
   * everywhere in this block.
   *
   * Either way we revalidate what we safely can and stop short of IndexNow.
   * Summoning a crawler to a draft or to a slug that does not exist is worse
   * than doing nothing at all.
   */
  const post = await getPost(slug)

  const revalidated: string[] = []

  const revalidatePage = (path: string): void => {
    revalidatePath(path, 'page')
    revalidated.push(path)
  }
  const revalidateHandler = (path: string): void => {
    revalidatePath(path)
    revalidated.push(path)
  }

  /*
   * Every path here comes from a `@/lib/config` helper rather than from string
   * concatenation, for the same reason every canonical does: the helpers are the
   * one place that knows about `config.trailingSlash` and slug encoding, so the
   * path revalidated and the path served are constructed by the same code.
   * (`revalidatePath` strips a trailing slash of its own accord, so the two
   * spellings invalidate the same entry either way. That is a reason not to worry
   * about the helper's output, not a reason to hand-build the string.)
   */
  revalidatePage(postPath(slug))
  revalidatePage(blogPath())
  if (post) {
    revalidatePage(categoryPath(post.category.slug))
    revalidatePage(authorPath(post.author.slug))
  }
  for (const path of handlerPathsFor(slug)) revalidateHandler(path)

  /**
   * `{ expire: 0 }`, not `'max'`. See correction 2 in the file header. The
   * second argument is required by the type signature in Next.js 16.3.
   */
  revalidateTag('posts', { expire: 0 })

  if (!post) {
    return json(202, {
      ok: false,
      slug,
      url,
      strategy,
      revalidated,
      deploy: { outcome: 'not-needed' },
      indexnow: {
        attempted: false,
        reason: 'slug is unknown to the content source, or is a draft',
      },
      warning:
        'Paths were revalidated but IndexNow was not pinged, because the content source does ' +
        'not return a published post for this slug.',
    })
  }

  /**
   * Branch on how new slugs enter the prerendered set.
   *
   * Next.js does not re-run `generateStaticParams` during ISR, so a slug that
   * did not exist at build time was never in the prerendered set and no amount
   * of `revalidatePath` creates it: there is nothing cached to invalidate.
   *
   *   'build'       content lives in the repository, so the push that added the
   *                 file is already the deploy. Nothing to wait for.
   *   'on-demand'   the adapter accepts a request-time first render, so the URL
   *                 resolves on first visit with `dynamicParams` at its default.
   *   'deploy-hook' the URL may not exist yet. Probe first, because an existing
   *                 slug whose content merely changed needs no rebuild at all,
   *                 and a rebuild per edit is an expensive way to find that out.
   */
  let deployOutcome: DeployOutcome = 'not-needed'
  if (strategy === 'deploy-hook') {
    deployOutcome = (await urlIsServable(url)) ? 'not-needed' : await fireDeployHookAndWait(url)
  }

  const urlIsLive = deployOutcome === 'not-needed' || deployOutcome === 'confirmed-live'

  let indexnow: IndexNowReport
  if (!urlIsLive) {
    indexnow = {
      attempted: false,
      reason: `deploy outcome was "${deployOutcome}"; the URL was not confirmed servable`,
    }
  } else {
    const result = await pingIndexNow([url])
    indexnow =
      result === null
        ? { attempted: false, reason: 'IndexNow is disabled in agentblog.config.ts' }
        : { attempted: true, ok: result.ok, status: result.status, meaning: result.meaning }
  }

  /**
   * Status codes the caller can act on.
   *
   *   200  everything this endpoint promises actually happened
   *   202  revalidated, but the ping was deferred. Retrying is safe
   *   502  the deploy hook itself refused the request
   *
   * A failed IndexNow ping does not fail the request: `403` (key invalid) and
   * `422` (host mismatch) are configuration problems, and they are reported in
   * the body rather than hidden behind a 200 that means nothing.
   */
  const status = deployOutcome === 'hook-failed' ? 502 : urlIsLive ? 200 : 202

  return json(status, {
    ok: urlIsLive,
    slug,
    url,
    strategy,
    revalidated,
    deploy: { outcome: deployOutcome },
    indexnow,
  })
}
