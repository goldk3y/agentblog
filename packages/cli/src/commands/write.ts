/**
 * The one place a `PatchSet` is written to disk, and the one place a failed
 * write is reported.
 *
 * `PatchSet.apply` throws `PatchWriteError` when it cannot finish, carrying the
 * files it wrote, the files it did not, and the backup directory. Every command
 * that writes goes through here so that report reads the same way and always
 * ends with the recovery, which is `agentblog revert`.
 *
 * Before this existed, a target made read only mid install produced a bare
 * `EACCES` stack: `next.config.ts` was patched, `AGENTS.md`, `.env.local`, and
 * the IndexNow key file were never created, and nothing told the user that a
 * single command puts all of it back.
 *
 * @see https://docs.agentblog.dev/installation
 */
import { PatchWriteError, type PatchSet } from '../patchers/patch-set.ts'
import { bullet, report, say } from '../util/log.ts'

export interface ApplyResult {
  readonly ok: boolean
  /** The backup directory, when one was created. */
  readonly backupDir: string | null
}

/** Write the set, reporting a partial write in full rather than throwing. */
export function applyPatches(patches: PatchSet, projectRoot: string): ApplyResult {
  try {
    return { ok: true, backupDir: patches.apply(projectRoot) }
  } catch (error) {
    if (!(error instanceof PatchWriteError)) throw error
    const [message, ...rest] = error.lines()
    report(
      'error',
      message ?? 'The patch could not be written.',
      error.backupDir === null
        ? 'Fix the permission or the disk, then re-run.'
        : 'Run npx agentblog revert to put every file back exactly as it was.',
    )
    for (const line of rest) bullet(line)
    say()
    return { ok: false, backupDir: null }
  }
}
