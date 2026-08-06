/**
 * `@agentblog-pro` registry namespace. Returns 402 for everything in v1.
 *
 * ===========================================================================
 * THIS IS A DELIBERATELY-BUILT SEAM, NOT AN UNFINISHED FEATURE
 * ===========================================================================
 * There is no paid tier yet. This route exists anyway, because the shape of the
 * thing has to be right before there is a product behind it, and the cost of
 * getting it right now is a file that returns one status code.
 *
 * shadcn namespaced registries already support authentication, through `headers`
 * and `params` with `${ENV_VAR}` expansion out of `process.env`:
 *
 *   {
 *     "registries": {
 *       "@agentblog":     "https://agentblog.dev/r/{name}.json",
 *       "@agentblog-pro": {
 *         "url": "https://agentblog.dev/r/pro/{name}.json",
 *         "headers": { "Authorization": "Bearer ${AGENTBLOG_TOKEN}" }
 *       }
 *     }
 *   }
 *
 * So the client half is fixed by someone else's protocol, and the server half is
 * a route handler that reads that header and decides. Standing it up now means
 * that when there is something to sell, no consumer's `components.json` has to
 * change and no install command has to be re-documented.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS PATH AND NOT `/r/[name]`
 * ---------------------------------------------------------------------------
 * `shadcn build` writes the public catalog to `public/r/`, and files in
 * `public/` are served at `/r/*.json`. A dynamic handler at `/r/[name]` would
 * sit on top of that namespace and the precedence between a static asset and a
 * dynamic route is not something worth relying on. `/r/pro/{name}.json` is a
 * disjoint namespace, which is also what the plan specifies.
 *
 * Keeping the pro namespace off the public registry directory is intentional
 * too. The directory requires items to be open source and publicly accessible
 * and wants a flat root layout, and an authed subpath satisfies neither.
 *
 * ---------------------------------------------------------------------------
 * STATUS CODE
 * ---------------------------------------------------------------------------
 * 402 Payment Required, for every request, authenticated or not. Not 404, which
 * would suggest a typo. Not 403, which would suggest the token was wrong. 402
 * says the item exists and is not yours, which is exactly true, and it is the
 * code a future entitlement check would return for a real unpaid user. That
 * means the client behaviour we ship today is the client behaviour we ship when
 * the product exists.
 *
 * @see https://agentblog.dev/docs/installation
 */

/** Bearer tokens are per-request, so this can never be a cached static route. */
export const dynamic = 'force-dynamic'

interface Entitlement {
  readonly ok: boolean
  readonly reason: string
}

/**
 * The entitlement lookup, in its final shape and with no product behind it.
 *
 * When there is one, this function reads the token, checks it against the
 * subscription store, and returns `{ ok: true }`. Nothing else in this file
 * changes. Keeping the signature honest now is the point of the seam.
 */
function checkEntitlement(token: string | null, item: string): Entitlement {
  if (token === null || token.length === 0) {
    return { ok: false, reason: 'no-token' }
  }
  // No paid tier exists, so no token can be entitled to anything.
  void item
  return { ok: false, reason: 'no-paid-tier' }
}

function bearerToken(request: Request): string | null {
  const header = request.headers.get('authorization')
  if (header === null) return null
  const match = /^Bearer\s+(.+)$/i.exec(header.trim())
  return match?.[1] ?? null
}

export async function GET(
  request: Request,
  context: { params: Promise<{ name: string }> },
): Promise<Response> {
  const { name } = await context.params

  // shadcn requests `{name}.json`. Strip the extension so the item name that
  // reaches the entitlement check is the item name, not the filename.
  const item = name.replace(/\.json$/, '')

  const entitlement = checkEntitlement(bearerToken(request), item)

  if (!entitlement.ok) {
    return Response.json(
      {
        error: 'payment_required',
        item,
        message:
          'The @agentblog-pro registry namespace is reserved. There is no paid tier yet, so nothing here is installable. Everything AgentBlog currently ships is in the public @agentblog namespace: npx shadcn@latest add @agentblog/blog',
        docs: 'https://agentblog.dev/docs/installation',
      },
      {
        status: 402,
        headers: {
          // No caching: the answer depends on a credential and will change when
          // the product exists.
          'cache-control': 'no-store',
        },
      },
    )
  }

  /*
   * Unreachable in v1. When it is reachable, this branch loads the item with
   * `loadRegistryItem` from the `shadcn/registry` package and returns it.
   *
   * The same handler is also where server-side registry search goes: the CLI
   * passes query parameters and expects a pre-filtered catalog carrying a
   * `pagination` object, whose presence is what tells the CLI the filtering
   * already happened. Free relevance control, same route.
   */
  return Response.json({ error: 'not_implemented' }, { status: 501 })
}
