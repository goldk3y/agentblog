/**
 * `agentblog uninstall`: undo the wiring, and list what the registry wrote.
 *
 * The split is deliberate. We revert what we patched and remove what we
 * appended, because those are ours. We do **not** delete the files the registry
 * wrote, because the user has probably edited them and a tool that deletes
 * edited components on the way out is a tool nobody installs twice. They get a
 * list instead.
 *
 * Uninstall restores **every** backup, newest to oldest, which is what
 * `revert --all` does. `revert` on its own restores the last patch set, because
 * it is the documented undo for a single run. That difference is deliberate and
 * both help texts say so.
 *
 * ===========================================================================
 * THE BACKUP LIST IS READ BEFORE THE REMOVALS ARE APPLIED
 * ===========================================================================
 * `patches.apply()` creates a backup directory, and reading the list afterwards
 * therefore included the backup this very run had just made. Restoring that put
 * back everything uninstall had removed a moment earlier, and for a file only
 * uninstall touched (a user's own `.env` holding `INDEXNOW_KEY`) its own backup
 * was the only one holding the key, so the key came straight back while the
 * command reported "Updated 1 file(s). Restored 1 file(s), removed 0." A secret
 * left in a git tracked `.env` is the exact condition doctor check 13 exists to
 * flag, and uninstall was recreating it and calling it success.
 *
 * @see https://docs.agentblog.dev/installation
 */
import { rmSync } from 'node:fs'

import { AGENTBLOG_ENV_KEYS } from '../constants.ts'
import { detectProject } from '../detect/project.ts'
import { readManifest } from '../detect/routes.ts'
import { removeBlock } from '../patchers/agents-md.ts'
import { removeEnvKeys } from '../patchers/env.ts'
import { listBackups, PatchSet, restoreBackup } from '../patchers/patch-set.ts'
import { exists, join, readFile } from '../util/fs.ts'
import { bullet, note, report, say, step, success } from '../util/log.ts'
import { applyPatches } from './write.ts'

export interface UninstallOptions {
  readonly dryRun?: boolean
  readonly keepEnv?: boolean
  readonly keepBackups?: boolean
  readonly cwd?: string
}

export function uninstallCommand(options: UninstallOptions): void {
  const project = detectProject(options.cwd ?? process.cwd())
  const dryRun = options.dryRun ?? false

  step('Removing the AgentBlog wiring')

  // Read the backup list first. Anything created below is this run's own work,
  // and restoring it would undo the removals we are about to make.
  const backups = listBackups(project.root)
  // The registry file list comes from the install manifest, which lives under
  // `.agentblog/`, so it is read before that directory is removed and printed
  // afterwards.
  const registryFiles = collectRegistryFiles(project.root)

  const patches = new PatchSet()

  const agentsPath = join(project.root, 'AGENTS.md')
  const agentsSource = readFile(agentsPath)
  if (agentsSource !== null) {
    const result = removeBlock(agentsSource)
    patches.add({
      path: agentsPath,
      label: 'AGENTS.md',
      before: agentsSource,
      after: result.source,
      reason: 'remove the AgentBlog block, leaving everything else untouched',
    })
  }

  if (!options.keepEnv) {
    for (const name of ['.env', '.env.local']) {
      const path = join(project.root, name)
      const source = readFile(path)
      if (source === null) continue
      const result = removeEnvKeys(source, AGENTBLOG_ENV_KEYS)
      if (result.changes.length === 0) continue
      patches.add({
        path,
        label: name,
        before: source,
        after: result.source,
        reason: 'remove the AgentBlog env vars',
      })
    }
  }

  if (!patches.isEmpty) {
    patches.print()
    if (!dryRun) {
      const result = applyPatches(patches, project.root)
      if (!result.ok) {
        process.exitCode = 1
        return
      }
      success(`Updated ${patches.changed.length} file(s).`)
      if (result.backupDir) note(`Backup: ${result.backupDir}`)
    }
  } else {
    note('No AgentBlog block or env vars to remove.')
  }

  /*
   * Every backup taken BEFORE this run comes back, newest to oldest.
   *
   * Restoring only the oldest one was wrong in a way that reads as right: the
   * oldest backup does hold the state before the first `init`, but it holds it
   * only for the files that run touched. Anything a later run patched for the
   * first time was never in it, so a second run that added `htmlLimitedBots`
   * survived an `uninstall` that reported "Restored 3 file(s), removed 2" and
   * left the key fully patched.
   *
   * Newest first is the same order `revert --all` uses and the only order that
   * composes: each restore undoes the run that produced it, so replaying them
   * backwards walks the tree back through every run to its original state.
   */
  if (backups.length > 0) {
    step(`Reverting config patches from every backup, newest first (${backups.length})`)
    let restored = 0
    let removed = 0
    for (const stamp of [...backups].reverse()) {
      const result = restoreBackup(project.root, stamp, { dryRun })
      if (result.rejected.length > 0) {
        report(
          'error',
          `${stamp} names paths outside this project, so nothing was restored from it.`,
          'Inspect .agentblog/backup/ and delete the backup if you did not create it.',
        )
        for (const line of result.rejected) bullet(line)
        process.exitCode = 1
        return
      }
      restored += result.restored.length
      removed += result.removed.length
    }
    if (dryRun) {
      note(`Would restore ${restored} file(s) and remove ${removed}.`)
    } else {
      success(`Restored ${restored} file(s), removed ${removed}.`)
    }
  } else {
    note('No backups found, so next.config and app/layout were left as they are.')
    note('Remove htmlLimitedBots and metadataBase by hand if you want them gone.')
  }

  removeAgentBlogDirectory(project.root, { dryRun, keep: options.keepBackups ?? false })

  printRegistryFiles(registryFiles)

  if (dryRun) {
    say()
    note('Dry run. Nothing was written.')
  }
}

/**
 * `.agentblog/` goes last, because everything above reads from it.
 *
 * Leaving it behind meant the tree was not byte identical to the one before the
 * install, on a command whose whole claim is that it undoes the install. It
 * holds only our manifest and our backups, so it is ours to remove. Removing it
 * does throw away the undo history, which is why the line saying so is printed
 * rather than implied, and why `--keep-backups` exists.
 */
function removeAgentBlogDirectory(
  root: string,
  options: { readonly dryRun: boolean; readonly keep: boolean },
): void {
  const directory = join(root, '.agentblog')
  if (!exists(directory)) return

  if (options.keep) {
    note('.agentblog/ was kept because --keep-backups was passed. Delete it when you are happy.')
    return
  }
  if (options.dryRun) {
    note('.agentblog/ would be removed, along with every backup and the install manifest.')
    return
  }
  rmSync(directory, { recursive: true, force: true })
  note('Removed .agentblog/, so the backups and the install manifest are gone with it.')
}

/**
 * The registry wrote these. We list them rather than deleting them, because
 * they are probably not the files we installed any more.
 *
 * Read before `.agentblog/` is removed, printed after.
 */
function collectRegistryFiles(root: string): string[] | null {
  const project = detectProject(root)
  const manifest = readManifest(project)
  if (!manifest || manifest.files.length === 0) return null
  return manifest.files.filter((path) => exists(join(root, path)))
}

function printRegistryFiles(present: string[] | null): void {
  say()
  step('Files the registry wrote, which you can now delete')

  if (present === null) {
    note('No install manifest found. The usual locations are:')
    for (const path of [
      'app/blog/**',
      'app/authors/**',
      'app/sitemap.ts, app/robots.ts, app/feed.xml/route.ts',
      'components/blog/**, components/mdx/**',
      'lib/*.ts, lib/sources/**, lib/mdx-plugins/**',
      'agentblog.config.ts',
      'content/blog/**',
    ]) {
      bullet(path)
    }
    return
  }

  /*
   * Every path, never a truncated list.
   *
   * This command's whole contribution at this point is the list: it deliberately
   * deletes nothing, so a user's only way to finish the uninstall is to read
   * what it prints. Cutting the list off at forty and saying "and 9 more" means
   * the one instruction the command gives you is the one thing it withholds,
   * and there was no flag to get the rest.
   *
   * A long list is the correct output here. Forty-nine paths is what installing
   * forty-nine files earns you.
   */
  for (const path of present) bullet(path)
  say()
  note(`${present.length} file(s). Review before deleting: you have probably edited some of them.`)
  note('Add --json for a machine-readable list, for example to feed `xargs rm`.')

  /*
   * Four things the registry did NOT write as files, which a user still has to
   * undo by hand. Leaving them unsaid is how somebody "uninstalls" and keeps a
   * stylesheet import pointing at a deleted file.
   */
  say()
  step('Not files, so nothing above covers them')
  bullet("the `@import '../styles/agentblog.css'` line in your global stylesheet")
  bullet('the npm dependencies the install added, listed in package.json')
  bullet('@tailwindcss/typography, if nothing else in your project uses it')
  bullet('any environment variables you copied to your deployment')
}
