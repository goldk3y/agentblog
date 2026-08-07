/**
 * Keeping `.agentblog/` out of git.
 *
 * ===========================================================================
 * WHY THIS IS A SECRETS PROBLEM AND NOT A TIDINESS ONE
 * ===========================================================================
 * `.agentblog/backup/<stamp>/` holds a byte for byte copy of every file the CLI
 * modified, and `.env.local` is one of the files it modifies. So an install run
 * on a project that already had `.env.local` copies live secrets into
 * `.agentblog/backup/<stamp>/.env.local`, and `git add -A` stages them.
 *
 * The standard Next.js `.gitignore` happens to cover this, because its
 * `.env*.local` pattern matches at any depth. A project using a path anchored
 * `/.env.local` does not, and neither does one with no `.gitignore` at all.
 * Relying on which pattern the user picked is not a security posture.
 *
 * The write is append only and idempotent: git is asked first whether the path
 * is already ignored, so a project that covers it some other way gets no diff.
 *
 * @see https://docs.agentblog.dev/reference/cli#doctor
 */
import { isGitIgnored } from '../util/exec.ts'
import type { PatchResult } from './next-config.ts'

/** The entry we add. Trailing slash, because it is always a directory. */
export const AGENTBLOG_IGNORE_ENTRY = '.agentblog/'

const HEADER = '# AgentBlog backups and install manifest. Contains copies of .env.local.'

/**
 * `true` when git already ignores `.agentblog/` in this project.
 *
 * Git is the authority rather than a pattern match of our own: `.gitignore`
 * semantics include negation, precedence, nested files, and `core.excludesFile`,
 * and a reimplementation that is right most of the time is worse than no answer
 * at all here. `null` from `isGitIgnored` means git could not tell us (not a
 * repository, git missing), and then the literal check below decides.
 */
export function isAgentBlogIgnored(root: string, source: string | null): boolean {
  const fromGit = isGitIgnored(root, AGENTBLOG_IGNORE_ENTRY)
  if (fromGit !== null) return fromGit
  return hasLiteralEntry(source)
}

function hasLiteralEntry(source: string | null): boolean {
  if (source === null) return false
  return source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .some((line) => line === '.agentblog' || line === '.agentblog/' || line === '/.agentblog/')
}

/** Append the entry. Returns the file unchanged when it is already covered. */
export function addAgentBlogIgnore(source: string | null): PatchResult {
  if (hasLiteralEntry(source)) {
    return { source: source ?? '', changes: [], declined: [] }
  }
  const body = source ?? ''
  const separator = body === '' ? '' : body.endsWith('\n') ? '\n' : '\n\n'
  return {
    source: `${body}${separator}${HEADER}\n${AGENTBLOG_IGNORE_ENTRY}\n`,
    changes: ['.gitignore: added .agentblog/, which holds backup copies of .env.local'],
    declined: [],
  }
}
