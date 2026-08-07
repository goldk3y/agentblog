/**
 * Env file editing.
 *
 * `init` writes to `.env.local`, not `.env`, and that is a deliberate departure
 * from what the registry does. The shadcn `envVars` field documents itself as
 * writing to "the project's `.env` file", and `.env` is commonly committed. The
 * two keys AgentBlog introduces (`INDEXNOW_KEY` and `AGENTBLOG_REVALIDATE_SECRET`)
 * are secrets, so putting them somewhere a default `.gitignore` already covers
 * is the right default. Doctor check 13 then verifies that whatever file ended
 * up holding them is actually ignored by git, because a registry-only install
 * will have taken the other path.
 *
 * @see https://docs.agentblog.dev/reference/cli#doctor
 */
import { isAgentBlogEnvComment } from '../constants.ts'

export interface EnvEntry {
  readonly key: string
  readonly value: string
  /** A short comment written above the key when it is first added. */
  readonly comment?: string
}

export interface EnvPatchResult {
  readonly source: string
  readonly changes: readonly string[]
  readonly declined: readonly string[]
}

/** Values already present in an env file, keyed by name. Quotes are stripped. */
export function parseEnv(source: string): Map<string, string> {
  const out = new Map<string, string>()
  for (const line of source.split(/\r?\n/)) {
    const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line)
    if (!match?.[1]) continue
    const raw = (match[2] ?? '').trim()
    const unquoted = /^(['"])([\s\S]*)\1$/.exec(raw)
    out.set(match[1], unquoted?.[2] ?? raw)
  }
  return out
}

/**
 * A key's value, or `null` when it is absent **or empty**.
 *
 * Emptiness is the load bearing half. `shadcn add` writes the `envVars` declared
 * on a registry item as bare `KEY=` lines, so a registry-only install leaves
 * `INDEXNOW_KEY=` and `AGENTBLOG_REVALIDATE_SECRET=` present and valueless. Code
 * that only asks whether the key exists then concludes the install is
 * configured, reports an empty value as a secret leaked into git, and offers to
 * "move" and "rotate" a value that is not there.
 */
export function envValue(source: string | null, key: string): string | null {
  if (source === null) return null
  const value = parseEnv(source).get(key)
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

/** `true` only when the key exists and carries a value. */
export function hasNonEmptyEnvValue(source: string | null, key: string): boolean {
  return envValue(source, key) !== null
}

/**
 * Append missing keys. An existing key is never overwritten: a user who already
 * set `INDEXNOW_KEY` has a key file deployed under that name, and replacing it
 * turns every future submission into a 403.
 */
export function upsertEnv(existing: string | null, entries: readonly EnvEntry[]): EnvPatchResult {
  const source = existing ?? ''
  const present = parseEnv(source)
  const changes: string[] = []
  const declined: string[] = []

  const additions: string[] = []
  let body = source

  for (const entry of entries) {
    const current = present.get(entry.key)

    // A real value belongs to the user. Never overwrite it: an IndexNow key in
    // particular is verified by a matching `public/<key>.txt`, so replacing one
    // silently breaks every submission that follows.
    if (typeof current === 'string' && current.trim().length > 0) {
      declined.push(`env: ${entry.key} is already set. Left alone.`)
      continue
    }

    /*
     * A key present with an EMPTY value is a placeholder, not a setting, and it
     * has to be filled rather than skipped.
     *
     * This is the state `shadcn add` leaves behind: the `envVars` declared on a
     * registry item are written as bare `KEY=` lines. Treating that as "already
     * set" meant `doctor --fix` computed a secret, announced "generated
     * AGENTBLOG_REVALIDATE_SECRET", wrote nothing, and left the publish webhook
     * rejecting every request. The user is then holding a secret that exists
     * only in their terminal scrollback.
     *
     * =====================================================================
     * THE LAST ASSIGNMENT IS THE ONE THAT MATTERS
     * =====================================================================
     * dotenv keeps the last assignment of a key, so filling the first one in
     * `INDEXNOW_KEY=\nOTHER=1\nINDEXNOW_KEY=\n` produced a file whose effective
     * value was still empty while the CLI reported "filled in the empty
     * INDEXNOW_KEY". The fill therefore targets the last occurrence, which is
     * the one the application will read, and the earlier shadowed copies are
     * reported so the user can delete them.
     *
     * `KEY=""` and `KEY=''` count as empty too. They used to fall through to
     * the append branch, which added a duplicate line below a placeholder that
     * stayed exactly where it was.
     */
    if (typeof current === 'string') {
      const filled = fillLastEmptyAssignment(body, entry.key, entry.value)
      if (filled) {
        body = filled.source
        changes.push(`env: filled in the empty ${entry.key}`)
        if (filled.shadowed > 0) {
          declined.push(
            `env: ${entry.key} is assigned ${filled.shadowed + 1} times. The last one was filled, because that is the one dotenv keeps. Delete the other ${filled.shadowed}.`,
          )
        }
        continue
      }
    }

    if (entry.comment) additions.push(`# ${entry.comment}`)
    additions.push(`${entry.key}=${entry.value}`)
    changes.push(`env: added ${entry.key}`)
  }

  if (additions.length === 0) return { source: body, changes, declined }

  const separator = body === '' ? '' : body.endsWith('\n') ? '' : '\n'
  return { source: `${body}${separator}${additions.join('\n')}\n`, changes, declined }
}

/**
 * Fill the LAST empty assignment of `key`, or `null` when there is not one.
 *
 * "Empty" means nothing after the `=`, or an empty quoted string. Returns the
 * new source and how many earlier assignments of the same key were shadowed,
 * so the caller can tell the user about them.
 */
function fillLastEmptyAssignment(
  source: string,
  key: string,
  value: string,
): { readonly source: string; readonly shadowed: number } | null {
  const assignment = new RegExp(`^([ \\t]*(?:export[ \\t]+)?${key}[ \\t]*=)[ \\t]*(.*)$`)
  const lines = source.split('\n')

  const indices: number[] = []
  for (let index = 0; index < lines.length; index += 1) {
    if (assignment.test(lines[index] ?? '')) indices.push(index)
  }

  const last = indices.at(-1)
  if (last === undefined) return null

  const match = assignment.exec(lines[last] ?? '')
  const rest = (match?.[2] ?? '').trim()
  if (rest !== '' && rest !== '""' && rest !== "''") return null

  lines[last] = `${match?.[1] ?? `${key}=`}${value}`
  return { source: lines.join('\n'), shadowed: indices.length - 1 }
}

/**
 * Remove keys we added. Used by `uninstall` and by the `--fix` secret move.
 *
 * The comment above a removed key goes with it **only when the CLI wrote that
 * comment**. Matching on "starts with `#`" instead deleted a user's own
 * `# my own note about the API base` sitting above `INDEXNOW_KEY`, silently,
 * on a command whose entire promise is that it touches only what it added.
 * `isAgentBlogEnvComment` matches against the closed set in `constants.ts`.
 */
export function removeEnvKeys(source: string, keys: readonly string[]): EnvPatchResult {
  const wanted = new Set(keys)
  const lines = source.split(/\r?\n/)
  const kept: string[] = []
  const changes: string[] = []
  const declined: string[] = []

  for (const line of lines) {
    const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line)
    if (match?.[1] && wanted.has(match[1])) {
      changes.push(`env: removed ${match[1]}`)
      const above = kept.at(-1)
      if (above !== undefined && isAgentBlogEnvComment(above)) {
        kept.pop()
      } else if (above !== undefined && above.trim().startsWith('#')) {
        declined.push(
          `env: the comment above ${match[1]} is yours, not ours, so it was left in place: ${above.trim()}`,
        )
      }
      continue
    }
    kept.push(line)
  }

  return { source: kept.join('\n'), changes, declined }
}
