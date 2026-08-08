/**
 * The repository star count, read on the server so it ships inside the HTML.
 *
 * The obvious implementation is a `useEffect` in the browser, and it is the
 * wrong one for this site twice over. It hands every visitor's IP to GitHub and
 * spends that IP's 60 requests an hour, and it puts the number outside the first
 * HTML response, which is the one thing this product exists to keep populated.
 * So the fetch happens at render, on the server, and the number is real DOM text
 * by the time any crawler reads the page.
 *
 * Two caches sit in front of GitHub. `next.revalidate` bounds this call, and the
 * page that calls it is itself `revalidate = 3600`, so a deployment asks GitHub
 * about once an hour per region no matter how much traffic arrives. That second
 * layer is why the abort signal below is safe: even if a signal were to bypass
 * the fetch cache, the page cache alone keeps this far under the unauthenticated
 * rate limit.
 *
 * Everything here fails to `null` rather than to zero. A rate-limited or slow
 * GitHub should cost the button its count, not turn it into a claim that nobody
 * has starred the repository.
 */
import 'server-only'

/** Also linked from the header, the footer, and `content/authors.json`. */
export const GITHUB_REPO_URL = 'https://github.com/goldk3y/agentblog'

const API_URL = 'https://api.github.com/repos/goldk3y/agentblog'

/** Matches the page's own ISR window. */
const REVALIDATE_SECONDS = 3600

/**
 * A prerender must not hang on a third party. Three seconds is generous for a
 * single GitHub GET and short enough that a build never waits on an outage.
 */
const TIMEOUT_MS = 3000

interface RepoResponse {
  readonly stargazers_count?: unknown
}

export async function getStarCount(): Promise<number | null> {
  try {
    const response = await fetch(API_URL, {
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        // GitHub asks every integration to identify itself, and unidentified
        // traffic is the first thing it throttles.
        'User-Agent': 'agentblog.dev',
        /*
          Optional. Unset, the call is unauthenticated and capped at 60 requests
          an hour per IP, which the two caches above already respect. Set, the
          cap is 5,000, which matters only if this site ever grows to many
          regions revalidating at once.
        */
        ...(process.env.GITHUB_TOKEN === undefined
          ? {}
          : { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }),
      },
      next: { revalidate: REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })

    if (!response.ok) return null

    const repo = (await response.json()) as RepoResponse
    const count = repo.stargazers_count

    return typeof count === 'number' && Number.isFinite(count) && count >= 0 ? count : null
  } catch {
    // Network error, timeout, or unparseable body. The button renders bare.
    return null
  }
}

/**
 * GitHub's own compact form, so the number beside our button reads the same as
 * the number on the page it links to: `938`, `1.2k`, `12.4k`.
 */
export function formatStarCount(count: number): string {
  if (count < 1000) return String(count)

  const thousands = count / 1000
  const rounded = thousands < 10 ? Math.round(thousands * 10) / 10 : Math.round(thousands)

  return `${String(rounded)}k`
}
