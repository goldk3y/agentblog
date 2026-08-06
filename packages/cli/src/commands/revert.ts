/**
 * `agentblog revert`: put the files back.
 *
 * Reversibility is a much cheaper way to earn trust than brand equity. The
 * honest framing of what this CLI does is that an unknown binary rewrites your
 * `next.config.ts`, and the answer to that is not a paragraph of reassurance, it
 * is a command that undoes it exactly.
 *
 * Restore is exact rather than approximate: files that existed are rewritten
 * with their former contents, files that did not exist are deleted, and a
 * directory that only existed to hold a deleted file goes with it. Anything the
 * registry wrote is left alone, because that is `uninstall`'s job and deleting
 * someone's edited components on a revert would be its own disaster.
 *
 * **Scope, precisely.** Without `--all` this restores the **last** patch set and
 * nothing before it, because it is the undo for the run you just did: a second
 * `doctor --fix` should be undoable without also unwinding your `init`. Two runs
 * therefore need `--all`, and `uninstall` uses `--all` semantics for the same
 * reason. `--all` replays backups newest to oldest, which is the only order that
 * composes, since each restore undoes the run that produced it.
 *
 * @see https://agentblog.dev/docs/installation
 */
import { unifiedDiff } from '../util/diff.ts'
import { detectProject } from '../detect/project.ts'
import { listBackups, readBackupPlan, restoreBackup } from '../patchers/patch-set.ts'
import { readFile, join } from '../util/fs.ts'
import { BACKUP_DIR } from '../constants.ts'
import { bullet, note, printDiff, report, say, step, success } from '../util/log.ts'

export interface RevertOptions {
  readonly dryRun?: boolean
  readonly all?: boolean
  readonly cwd?: string
}

export function revertCommand(options: RevertOptions): void {
  const project = detectProject(options.cwd ?? process.cwd())
  const backups = listBackups(project.root)

  if (backups.length === 0) {
    note(`No backups found under ${BACKUP_DIR}. There is nothing to revert.`)
    return
  }

  const targets = options.all ? [...backups].reverse() : [backups.at(-1)!]
  if (!options.all && backups.length > 1) {
    note(
      `${backups.length} backups exist. This restores the last one only. Use --all to unwind all ${backups.length}.`,
    )
  }

  for (const stamp of targets) {
    const plan = readBackupPlan(project.root, stamp)
    if (!plan) {
      note(`${stamp}: no backup.json, skipping.`)
      continue
    }

    /*
     * A backup manifest is a committable file, so it arrives with a clone. One
     * that names a path outside the project is either corrupt or hostile, and
     * either way it stops the command: restoring the entries that happen to be
     * legal means acting on a file we have just decided we cannot trust.
     */
    if (plan.rejected.length > 0) {
      report(
        'error',
        `${stamp} names paths outside this project, so nothing was restored from it.`,
        'Inspect .agentblog/backup/ and delete the backup if you did not create it.',
      )
      for (const line of plan.rejected) bullet(line)
      process.exitCode = 1
      return
    }

    step(`Reverting ${stamp} (${plan.entries.length} file(s))`)

    for (const entry of plan.entries) {
      const current = readFile(join(project.root, entry.label))
      const previous =
        entry.copy === null ? null : readFile(join(project.root, BACKUP_DIR, stamp, entry.copy))
      if (entry.copy === null) {
        bullet(`${entry.label} will be deleted, it did not exist before the patch`)
        continue
      }
      if (previous === null) continue
      printDiff(unifiedDiff(entry.label, current, previous))
    }

    if (options.dryRun) {
      say()
      note('Dry run. Nothing was written.')
      continue
    }

    const result = restoreBackup(project.root, stamp, { dryRun: false })
    success(`Restored ${result.restored.length} file(s), removed ${result.removed.length}.`)
  }
}
