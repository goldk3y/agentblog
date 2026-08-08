/**
 * The write path. Every byte this CLI changes in a user's repository goes
 * through here.
 *
 * Three properties, each of them cheaper to build than to explain away later:
 *
 * 1. **Nothing is written before it is shown.** Callers build the complete set
 *    of edits, print the unified diff, and only then apply. `--dry-run` is the
 *    same code path minus the final write, so what the dry run shows is exactly
 *    what the real run does rather than an approximation of it.
 *
 * 2. **Every modified file is backed up first**, to
 *    `.agentblog/backup/<timestamp>/`, with a manifest that records files which
 *    did not previously exist. `agentblog revert` restores the former and
 *    deletes the latter, so a revert returns the tree to its exact prior state
 *    rather than to something close to it.
 *
 * 3. **An edit that changes nothing is not an edit.** `changed` filters on
 *    content equality, which is what makes a second `init` a byte for byte
 *    no-op: the patchers are free to compute their desired output every time and
 *    let this layer notice there is nothing to do.
 */
import { accessSync, constants, readdirSync, rmdirSync, rmSync, statSync } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'

import { BACKUP_DIR } from '../constants.ts'
import { exists, readFile, readJson, writeFileEnsuringDir } from '../util/fs.ts'
import { unifiedDiff, unionMerge } from '../util/diff.ts'
import { printDiff, say, note } from '../util/log.ts'

/**
 * The new contents of a file: either a literal string, or a function that is
 * given whatever the file will contain when the edits before it have run.
 *
 * Pass a function whenever the edit is an *upsert* rather than a replacement.
 * `.env.local` is the case that forced this: two repairs add a key each, and
 * only the callback form lets the second one see the first one's key and decline
 * a duplicate. A plain string is still safe (see `add`), it is just blunter.
 */
export type EditContent = string | ((current: string | null) => string)

export interface FileEdit {
  /** Absolute path on disk. */
  readonly path: string
  /** Project relative path, used in diffs and messages. */
  readonly label: string
  /** Contents before the edit, or `null` when the file does not exist yet. */
  readonly before: string | null
  readonly after: EditContent
  /** One line explaining why, printed above the diff. */
  readonly reason: string
}

/** A `FileEdit` after `after` has been resolved against the running contents. */
interface ResolvedEdit {
  readonly path: string
  readonly label: string
  readonly before: string | null
  after: string
  reason: string
}

export interface BackupEntry {
  readonly label: string
  /** Relative path inside the backup directory, or `null` for a created file. */
  readonly copy: string | null
}

export interface BackupManifest {
  readonly createdAt: string
  readonly entries: readonly BackupEntry[]
}

export class PatchSet {
  private readonly edits: ResolvedEdit[] = []
  /** Resolved absolute path to its index in `edits`. One entry per file. */
  private readonly byPath = new Map<string, number>()

  /**
   * Record an edit, composing it with anything already queued for the same file.
   *
   * =========================================================================
   * ONE ENTRY PER FILE, ALWAYS
   * =========================================================================
   * Callers compute their `after` from the file as it is on disk, because that
   * is the only state they can see. Two of them targeting one path therefore
   * produce two answers to the same question, and appending both meant the
   * later write silently discarded the earlier one. That is how `doctor --fix`
   * came to print "generated AGENTBLOG_REVALIDATE_SECRET" and leave a
   * `.env.local` without it: the secrets fix and the secret-relocation fix each
   * rewrote the file from the same empty starting point. It also broke
   * idempotency, since the next run generated a different secret.
   *
   * So the set is keyed by resolved path and a repeat add composes rather than
   * appends:
   *
   *   - a callback `after` is applied to the running contents, which is exact;
   *   - a string `after` is union-merged against them, which keeps both edits'
   *     lines instead of picking a winner.
   *
   * `before` stays the real pre-write disk contents, so the diff, the backup,
   * and `revert` all describe the same single transition.
   */
  add(edit: FileEdit): void {
    const key = resolve(edit.path)
    const index = this.byPath.get(key)

    if (index === undefined) {
      this.edits.push({
        path: edit.path,
        label: edit.label,
        before: edit.before,
        after: resolveContent(edit.after, edit.before),
        reason: edit.reason,
      })
      this.byPath.set(key, this.edits.length - 1)
      return
    }

    const existing = this.edits[index]!
    existing.after =
      typeof edit.after === 'function'
        ? edit.after(existing.after)
        : unionMerge(existing.before, existing.after, edit.after)
    if (!existing.reason.includes(edit.reason)) existing.reason += `; ${edit.reason}`
  }

  /** Edits that would actually change the file. */
  get changed(): readonly ResolvedEdit[] {
    return this.edits.filter((edit) => edit.before !== edit.after)
  }

  get isEmpty(): boolean {
    return this.changed.length === 0
  }

  /** Print each change with its reason and a unified diff. */
  print(): void {
    for (const edit of this.changed) {
      say()
      note(`# ${edit.label}: ${edit.reason}`)
      printDiff(unifiedDiff(edit.label, edit.before, edit.after))
    }
  }

  /**
   * Back up and write. Returns the backup directory, or `null` when there was
   * nothing to do.
   *
   * =========================================================================
   * WHY THERE IS A WRITABILITY PASS BEFORE THE FIRST WRITE
   * =========================================================================
   * The write loop is a loop, so a failure part way through leaves the tree in
   * a state no single file describes: `next.config.ts` patched, `AGENTS.md` and
   * `.env.local` never created, and the IndexNow key announced but absent. The
   * measured case was one target made read only mid install.
   *
   * A full two phase write (temp file, then rename) does not fix that case: on
   * POSIX a rename over a read only file succeeds as long as the directory is
   * writable, so it would paper over the permission the user set rather than
   * respect it. Checking writability for every target first does fix it, and
   * fixes it in the strongest possible way, by failing before a single byte is
   * written rather than half way through.
   *
   * Anything that still fails after the check (a disk that fills between the
   * two passes, a file another process locks) throws `PatchWriteError`, which
   * names what was written and what was not and points at `agentblog revert`.
   * Reporting that is not a nicety: without it the user is told an install
   * failed and left to guess whether the recovery command applies.
   */
  apply(projectRoot: string): string | null {
    const changed = this.changed
    if (changed.length === 0) return null

    const unwritable = changed.filter((edit) => !isWritableTarget(edit.path))
    if (unwritable.length > 0) {
      throw new PatchWriteError(
        `${unwritable.length} file(s) cannot be written, so nothing was written at all.`,
        [],
        changed.map((edit) => edit.label),
        unwritable.map((edit) => edit.label),
      )
    }

    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupDir = join(projectRoot, BACKUP_DIR, stamp)

    const entries: BackupEntry[] = changed.map((edit) => {
      if (edit.before === null) return { label: edit.label, copy: null }
      writeFileEnsuringDir(join(backupDir, edit.label), edit.before)
      return { label: edit.label, copy: edit.label }
    })

    const manifest: BackupManifest = { createdAt: new Date().toISOString(), entries }
    writeFileEnsuringDir(join(backupDir, 'backup.json'), `${JSON.stringify(manifest, null, 2)}\n`)

    const written: string[] = []
    for (const edit of changed) {
      try {
        writeFileEnsuringDir(edit.path, edit.after)
      } catch (error) {
        throw new PatchWriteError(
          `${edit.label} could not be written: ${error instanceof Error ? error.message : String(error)}`,
          written,
          changed.slice(written.length).map((e) => e.label),
          [edit.label],
          backupDir,
        )
      }
      written.push(edit.label)
    }

    return backupDir
  }
}

/**
 * A write that failed part way through, carrying everything the user needs to
 * get back to a known state.
 *
 * The recovery is `agentblog revert`, and the error says so. An error that
 * names the failure but not the undo leaves the user believing a half patched
 * tree is now theirs to repair by hand, when the backup that makes it exact is
 * already on disk.
 */
export class PatchWriteError extends Error {
  readonly written: readonly string[]
  readonly notWritten: readonly string[]
  readonly blocked: readonly string[]
  readonly backupDir: string | null

  constructor(
    message: string,
    written: readonly string[],
    notWritten: readonly string[],
    blocked: readonly string[],
    backupDir: string | null = null,
  ) {
    super(message)
    this.name = 'PatchWriteError'
    this.written = written
    this.notWritten = notWritten
    this.blocked = blocked
    this.backupDir = backupDir
  }

  /** The whole report, one line each, ready to print. */
  lines(): string[] {
    const out = [this.message]
    if (this.written.length > 0) {
      out.push(`Written: ${this.written.join(', ')}`)
    } else {
      out.push('Nothing was written.')
    }
    if (this.notWritten.length > 0) out.push(`Not written: ${this.notWritten.join(', ')}`)
    if (this.blocked.length > 0) out.push(`Blocked: ${this.blocked.join(', ')}`)
    if (this.backupDir !== null) {
      out.push('Run `npx agentblog revert` to put every file back exactly as it was.')
    }
    return out
  }
}

/** `true` when we can write `path`, whether or not it exists yet. */
function isWritableTarget(path: string): boolean {
  try {
    const stat = statSync(path)
    if (!stat.isFile()) return false
    accessSync(path, constants.W_OK)
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') return false
  }
  // The file does not exist yet, so the question is whether the nearest
  // existing ancestor directory will let us create it.
  let directory = dirname(resolve(path))
  for (let depth = 0; depth < 64; depth += 1) {
    if (exists(directory)) {
      try {
        accessSync(directory, constants.W_OK)
        return true
      } catch {
        return false
      }
    }
    const parent = dirname(directory)
    if (parent === directory) return false
    directory = parent
  }
  return false
}

function resolveContent(content: EditContent, current: string | null): string {
  return typeof content === 'function' ? content(current) : content
}

/** Backup directories, newest last. */
export function listBackups(projectRoot: string): string[] {
  const root = join(projectRoot, BACKUP_DIR)
  if (!exists(root)) return []
  try {
    return readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()
  } catch {
    return []
  }
}

export function readBackupManifest(projectRoot: string, stamp: string): BackupManifest | null {
  return readJson<BackupManifest>(join(projectRoot, BACKUP_DIR, stamp, 'backup.json'))
}

/**
 * `true` when `candidate` resolves to something strictly inside `container`.
 *
 * The separator is load bearing. A bare `startsWith` says `/home/user-backup`
 * is inside `/home/user`, and the whole point of this predicate is that it is
 * not. Equality is excluded as well: the container itself is never a valid
 * target for a write or a delete.
 */
function isInside(container: string, candidate: string): boolean {
  const root = resolve(container)
  const target = resolve(candidate)
  return target.startsWith(root + sep)
}

export interface BackupPlan {
  /** Entries whose paths stay inside the project, in manifest order. */
  readonly entries: readonly BackupEntry[]
  /** One line per entry that tried to escape. Non-empty means stop. */
  readonly rejected: readonly string[]
}

/**
 * Read a backup manifest and refuse every entry that points outside the tree.
 *
 * ===========================================================================
 * WHY THIS EXISTS: A BACKUP MANIFEST IS UNTRUSTED INPUT
 * ===========================================================================
 * `.agentblog/backup/<stamp>/backup.json` is an ordinary file in the user's
 * repository, so it is committable, so it arrives with a `git clone`. Its
 * `label` and `copy` fields were fed straight to `join(projectRoot, label)` and
 * then to a write or an `rmSync`, which turned `npx agentblog revert` in a
 * freshly cloned repository into arbitrary file write and delete anywhere the
 * user can reach: `../../.ssh/authorized_keys` was overwritten and a file
 * outside the tree was deleted, and the command reported
 * "Restored 2 file(s), removed 1."
 *
 * So both halves are contained: `label` must resolve inside the project root,
 * and `copy` must resolve inside this backup's own directory. A rejected entry
 * stops the command rather than being skipped quietly, because a backup file
 * that tries to escape is either corrupt or hostile and neither is a thing to
 * continue past.
 */
export function readBackupPlan(projectRoot: string, stamp: string): BackupPlan | null {
  const manifest = readBackupManifest(projectRoot, stamp)
  if (!manifest) return null

  const backupDir = join(projectRoot, BACKUP_DIR, stamp)
  const entries: BackupEntry[] = []
  const rejected: string[] = []

  for (const entry of Array.isArray(manifest.entries) ? manifest.entries : []) {
    if (typeof entry?.label !== 'string' || entry.label.trim() === '') {
      rejected.push(`${stamp}: an entry has no label.`)
      continue
    }
    if (!isInside(projectRoot, join(projectRoot, entry.label))) {
      rejected.push(
        `${stamp}: the entry ${JSON.stringify(entry.label)} resolves outside the project, so it was refused.`,
      )
      continue
    }
    if (entry.copy !== null) {
      if (typeof entry.copy !== 'string' || !isInside(backupDir, join(backupDir, entry.copy))) {
        rejected.push(
          `${stamp}: the backup copy ${JSON.stringify(entry.copy)} resolves outside the backup directory, so it was refused.`,
        )
        continue
      }
    }
    entries.push({ label: entry.label, copy: entry.copy })
  }

  return { entries, rejected }
}

/**
 * Restore one backup. Files that did not exist before the patch are deleted,
 * along with any directory that only existed to hold them, which is what makes
 * revert exact rather than approximate.
 *
 * The directory half is not a nicety. `writeFileEnsuringDir` creates `public/`
 * on the way to writing an IndexNow key file, so a revert that deleted only the
 * file left an empty `public/` behind. An empty `public/` is not inert in
 * Next.js: it is a directory the framework serves from, and it is one more
 * thing the user has to notice and clean up after being told the restore was
 * exact.
 */
export function restoreBackup(
  projectRoot: string,
  stamp: string,
  options: { readonly dryRun: boolean },
): { readonly restored: string[]; readonly removed: string[]; readonly rejected: string[] } {
  const plan = readBackupPlan(projectRoot, stamp)
  const restored: string[] = []
  const removed: string[] = []
  if (!plan) return { restored, removed, rejected: [] }
  // A manifest that tries to reach outside the tree is refused whole. Restoring
  // the entries that happen to be legal would be acting on a file we have just
  // established we cannot trust.
  if (plan.rejected.length > 0) return { restored, removed, rejected: [...plan.rejected] }

  for (const entry of plan.entries) {
    const target = join(projectRoot, entry.label)
    if (entry.copy === null) {
      removed.push(entry.label)
      if (options.dryRun || !exists(target)) continue
      rmSync(target, { force: true })
      pruneEmptyDirectories(projectRoot, dirname(target))
      continue
    }
    const contents = readFile(join(projectRoot, BACKUP_DIR, stamp, entry.copy))
    if (contents === null) continue
    restored.push(entry.label)
    if (!options.dryRun) writeFileEnsuringDir(target, contents)
  }

  return { restored, removed, rejected: [] }
}

/**
 * Remove `directory` and its now-empty parents, stopping at the project root.
 *
 * `rmdirSync` refuses on a non-empty directory, so the guard is the operating
 * system's rather than ours, and a directory holding anything at all survives.
 *
 * The containment test includes the separator. `startsWith(root)` alone counts
 * `/home/user-backup` as living inside `/home/user`, which is how a walk that
 * looks bounded reaches a sibling of the project.
 */
function pruneEmptyDirectories(projectRoot: string, directory: string): void {
  const root = resolve(projectRoot)
  let current = resolve(directory)

  while (current !== root && current.startsWith(root + sep)) {
    try {
      rmdirSync(current)
    } catch {
      return
    }
    current = dirname(current)
  }
}
