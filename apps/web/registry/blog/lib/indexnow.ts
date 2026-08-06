/**
 * IndexNow submission, implemented against the spec rather than the folklore.
 *
 * ===========================================================================
 * WHAT INDEXNOW IS AND WHY THE BLOCK BOTHERS
 * ===========================================================================
 * One HTTP POST tells Bing, Yandex, Seznam, and Naver that a URL changed, and
 * they fetch it instead of waiting for a crawl. That matters more than its
 * search share suggests: ChatGPT's search surface has historically leaned on
 * Bing's index, so being in Bing quickly is part of being citable quickly.
 *
 * ===========================================================================
 * THE THREE THINGS EVERY NAIVE IMPLEMENTATION GETS WRONG
 * ===========================================================================
 * 1. **The limit is 10,000 URLs per request, not per day.** The "per day"
 *    reading is common and leads people to batch and throttle for no reason.
 *
 * 2. **403 and 422 are indistinguishable from success unless you look.** A fire
 *    and forget `fetch` that ignores the response reports a healthy publish
 *    pipeline while every single submission is being rejected, for months. 403
 *    means the key file is not where `keyLocation` says it is. 422 means a URL
 *    in the batch does not belong to `host`. Both are configuration mistakes
 *    that never surface on their own, which is why this function returns the
 *    status and a plain sentence explaining it rather than a boolean.
 *
 * 3. **The key file has to exist at the domain root.** `<key>.txt`, UTF-8,
 *    containing the key and nothing else. A key hosted under a subpath only
 *    authorizes URLs beneath that subpath, so the root is the only location that
 *    covers a whole blog.
 *
 * ===========================================================================
 * CONTRACT
 * ===========================================================================
 * Returns `null` when there is nothing to do: IndexNow is disabled, no key is
 * configured, or the URL list is empty. Never throws, because it is called from
 * the publish webhook after the revalidation has already succeeded, and a failed
 * ping must not turn a successful publish into a 500.
 *
 * @see https://agentblog.dev/docs/agent-layer
 */
import { absoluteUrl, config } from '@/lib/config'

const ENDPOINT = 'https://api.indexnow.org/indexnow'

/** Per request, per the spec. Not per day, and not per domain. */
const MAX_URLS_PER_REQUEST = 10_000

/**
 * Every status the spec defines, in the caller's words rather than the
 * protocol's. These strings are printed by `agentblog ping` and logged by the
 * publish webhook, so they say what to do, not just what happened.
 */
const MEANINGS: Readonly<Record<number, string>> = {
  200: 'Submitted. The URLs were received and the key was validated.',
  202: 'Accepted. The URLs were received and key validation is still pending.',
  400: 'Bad request. The JSON body or one of the URLs in it is malformed.',
  403:
    'Forbidden. The key is invalid, or the key file is not served at its keyLocation. ' +
    'Check that the file exists at the site root and contains the key and nothing else.',
  422:
    'Unprocessable. A submitted URL does not belong to the declared host, or the key does ' +
    'not match the host. Check that siteUrl in agentblog.config.ts matches the URLs sent.',
  429: 'Rate limited. Too many submissions; back off and retry later.',
}

export interface IndexNowResult {
  /** `true` only for 200 and 202. Everything else is a rejection. */
  readonly ok: boolean
  /** The HTTP status, or `0` when the request never completed. */
  readonly status: number
  /** A sentence you can log or print verbatim. */
  readonly meaning: string
}

/**
 * Submit changed URLs to IndexNow.
 *
 * The key is read from `agentblog.config.ts` first and falls back to
 * `INDEXNOW_KEY` in the environment, so the secret never has to live in a
 * committed config file.
 */
export async function pingIndexNow(urls: readonly string[]): Promise<IndexNowResult | null> {
  if (!config.indexnow.enabled) return null

  const key = config.indexnow.key ?? process.env.INDEXNOW_KEY
  if (!key) return null

  const urlList = urls.slice(0, MAX_URLS_PER_REQUEST)
  if (urlList.length === 0) return null

  if (urls.length > MAX_URLS_PER_REQUEST) {
    console.warn(
      `[agentblog] IndexNow accepts ${MAX_URLS_PER_REQUEST} URLs per request; ` +
        `submitting the first ${MAX_URLS_PER_REQUEST} of ${urls.length}. ` +
        'Send the rest in a second call.',
    )
  }

  let host: string
  try {
    host = new URL(config.siteUrl).host
  } catch {
    return null
  }

  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host,
        key,
        // The key file lives at the site root. `absoluteUrl` leaves a path ending
        // in a file extension alone, so this stays correct with trailingSlash on.
        keyLocation: absoluteUrl(`/${key}.txt`),
        urlList,
      }),
    })

    const status = response.status
    return {
      ok: status === 200 || status === 202,
      status,
      meaning: MEANINGS[status] ?? `Unexpected status ${status} from ${ENDPOINT}.`,
    }
  } catch (cause) {
    // A network failure is reported, never rethrown: the post is already
    // published and revalidated by the time this runs.
    const detail = cause instanceof Error ? cause.message : String(cause)
    return {
      ok: false,
      status: 0,
      meaning: `The request to ${ENDPOINT} did not complete: ${detail}`,
    }
  }
}
