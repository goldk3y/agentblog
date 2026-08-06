/**
 * IndexNow key generation and submission.
 *
 * The response codes matter more than they look. `403` (key invalid or missing
 * from the domain root) and `422` (URL does not match the host the key
 * authorizes) both look identical to success from a caller that only checks for
 * a thrown error, so every submission path here reports the code and what it
 * means. Silent failure is the recurring theme of this whole product, and a
 * ping command that always says "sent" is a small instance of it.
 *
 * Key rules, from the IndexNow specification: 8 to 128 characters drawn from
 * `a-z`, `A-Z`, `0-9`, and dashes; served at the domain root as `<key>.txt`,
 * UTF-8, containing the key and nothing else; a key hosted under a subpath only
 * authorizes URLs beneath that subpath. The per-request limit is 10,000 URLs.
 *
 * @see https://agentblog.dev/docs/agent-layer
 */
import { randomBytes } from 'node:crypto'

export const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow'

/** 32 lowercase hex characters. Inside the 8 to 128 range and easy to read aloud. */
export function generateIndexNowKey(): string {
  return randomBytes(16).toString('hex')
}

export function isValidIndexNowKey(key: string): boolean {
  return /^[A-Za-z0-9-]{8,128}$/.test(key)
}

/**
 * Is this `public/*.txt` an IndexNow key file?
 *
 * ---------------------------------------------------------------------------
 * NEVER INFER THIS FROM THE FILE NAME
 * ---------------------------------------------------------------------------
 * The key rules say 8 to 128 characters of `[A-Za-z0-9-]`, and that is a shape
 * an ordinary file name has too. `llms-full.txt` is nine such characters and
 * `security.txt` is eight, so a name-only test claimed both as key files. The
 * damage came in a pair: `doctor` raised a hard error telling the user their
 * `llms-full.txt` had to contain the word `llms-full` and nothing else, and
 * `--fix` did it, while `generateIndexNowKeyIfAbsent` concluded a key already
 * existed and IndexNow was never configured at all. This audience publishes
 * `llms-full.txt` on purpose.
 *
 * So a file counts only on evidence that it is a key, and there are exactly two
 * kinds. IndexNow fetches `<key>.txt` and compares the body byte for byte with
 * the key, so a body equal to the file's own base name is a key file by its own
 * construction. Otherwise `INDEXNOW_KEY` has to name it, which is the case where
 * the file is a key file whose contents are wrong and repairing it is the point.
 */
export function isIndexNowKeyFile(input: {
  /** Base name including the extension, for example `abc123def.txt`. */
  readonly fileName: string
  /** File contents, or `null` when it could not be read. */
  readonly contents: string | null
  /** `INDEXNOW_KEY` from the env files, when it has a value. */
  readonly envKey?: string | null | undefined
}): boolean {
  if (!input.fileName.endsWith('.txt')) return false
  const name = input.fileName.slice(0, -'.txt'.length)
  if (!isValidIndexNowKey(name)) return false

  if (input.envKey && input.envKey === name) return true
  return input.contents !== null && input.contents.trim() === name
}

const MEANINGS: Readonly<Record<number, string>> = {
  200: 'submitted, URLs received',
  202: 'accepted, key validation is still pending',
  400: 'bad request, the payload format is wrong',
  403: 'forbidden, the key file is missing from your domain root or does not match',
  422: 'unprocessable, the URLs do not belong to the host the key authorizes',
  429: 'rate limited, too many requests',
}

export interface IndexNowResult {
  readonly ok: boolean
  readonly status: number
  readonly meaning: string
}

export function explain(status: number): string {
  return MEANINGS[status] ?? 'unexpected status, treat as a failure'
}

/** Submit up to 10,000 URLs. Returns the code and what it means, never throws. */
export async function submit(input: {
  readonly host: string
  readonly key: string
  readonly keyLocation?: string
  readonly urls: readonly string[]
}): Promise<IndexNowResult> {
  const body: Record<string, unknown> = {
    host: input.host,
    key: input.key,
    urlList: input.urls.slice(0, 10_000),
  }
  if (input.keyLocation) body['keyLocation'] = input.keyLocation

  try {
    const response = await fetch(INDEXNOW_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify(body),
    })
    return {
      ok: response.status === 200 || response.status === 202,
      status: response.status,
      meaning: explain(response.status),
    }
  } catch (error) {
    return {
      ok: false,
      status: 0,
      meaning: `request failed before it reached IndexNow: ${String(error)}`,
    }
  }
}
