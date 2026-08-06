/**
 * `agentblog init`: the second layer of the two-layer install.
 *
 * The shadcn registry writes files. This command does the wiring the registry
 * format cannot express: it has no `patch`, no `postinstall`, and no `scripts`
 * field, so it cannot add `htmlLimitedBots` to an existing `next.config.ts`, add
 * `metadataBase` to a layout, generate an IndexNow key, or verify any of it.
 * Every one of those is load bearing, and a registry-only install produces a
 * blog that looks right and is invisible to GPTBot.
 *
 * Order: refuse, prompt, install, patch, verify. Nothing is written until every
 * requirement passes, and everything written goes through the patch set, which
 * backs up first and prints a diff.
 *
 * @see https://agentblog.dev/docs/installation
 */
import prompts from 'prompts'

import { BLOG_REGISTRY_ITEM, SOURCE_REGISTRY_ITEMS } from '../constants.ts'
import { appPathLabel, detectProject, type ProjectContext } from '../detect/project.ts'
import { readManifest, writeManifest } from '../detect/routes.ts'
import { DEFAULT_REGISTRY_URL } from '../patchers/components-json.ts'
import { PatchSet } from '../patchers/patch-set.ts'
import { restoreContent, snapshotContent } from './init-content.ts'
import {
  generateIndexNowKeyIfAbsent,
  generateRevalidateSecretIfAbsent,
  installedFiles,
  patchComponentsRegistry,
  patchConfigFiles,
  type InitAnswers,
} from './init-patches.ts'
import { runDoctor } from '../doctor/run.ts'
import { checkRequirements } from './init-requirements.ts'
import { applyPatches } from './write.ts'
import { dlxCommand, runInherit, shadcnAddArgs } from '../util/exec.ts'
import { toPosixRelative } from '../util/fs.ts'
import { bullet, note, report, say, step, success } from '../util/log.ts'
import { track } from '../util/telemetry.ts'

export interface InitOptions {
  readonly dryRun?: boolean
  readonly force?: boolean
  readonly yes?: boolean
  readonly skipInstall?: boolean
  readonly reinstall?: boolean
  readonly telemetry?: boolean
  readonly cwd?: string
  readonly siteUrl?: string
  readonly brand?: string
  readonly author?: string
  readonly source?: string
  readonly registry?: string
}

export async function initCommand(options: InitOptions): Promise<void> {
  const project = detectProject(options.cwd ?? process.cwd())
  step(`Installing AgentBlog into ${project.root}`)
  describeLayout(project)

  const requirements = checkRequirements(project, { force: options.force ?? false })
  if (!requirements.ok) {
    process.exitCode = 1
    return
  }

  const answers = await ask(options)
  if (!answers) {
    note('Nothing was written.')
    process.exitCode = 1
    return
  }

  /*
   * The registry namespace is written and applied BEFORE `shadcn add` runs.
   *
   * `shadcn add @agentblog/blog` resolves the prefix through `registries` in
   * `components.json`, so on a clean shadcn project the documented headline
   * command failed with `Unknown registry "@agentblog"`. Queuing this patch
   * alongside `next.config.ts` would have written it a minute after the install
   * it exists to enable had already failed.
   */
  const registryPatches = new PatchSet()
  const registryChanges: string[] = []
  const registryDeclined: string[] = []
  patchComponentsRegistry(
    project,
    answers.registryUrl,
    registryPatches,
    registryChanges,
    registryDeclined,
  )
  if (!registryPatches.isEmpty) {
    for (const change of registryChanges) bullet(change)
    registryPatches.print()
    if (!options.dryRun) {
      const applied = applyPatches(registryPatches, project.root)
      if (!applied.ok) {
        process.exitCode = 1
        return
      }
    }
  }
  for (const line of registryDeclined) note(`  ${line}`)

  if (!runInstallStep(project, answers, options)) {
    process.exitCode = 1
    return
  }

  const patches = new PatchSet()
  const changes: string[] = []
  const declined: string[] = []
  const indexNowKey = generateIndexNowKeyIfAbsent(project)
  const revalidateSecret = generateRevalidateSecretIfAbsent(project)

  patchConfigFiles(project, answers, indexNowKey, revalidateSecret, patches, changes, declined)

  if (patches.isEmpty) {
    success('Every patch site is already correct. Nothing to write.')
  } else {
    for (const change of changes) bullet(change)
    patches.print()

    if (options.dryRun) {
      say()
      note('Dry run. Nothing was written.')
      return
    }

    const applied = applyPatches(patches, project.root)
    if (!applied.ok) {
      process.exitCode = 1
      return
    }
    success(`Wrote ${patches.changed.length} file change(s).`)
    if (applied.backupDir) {
      note(
        `Backup: ${toPosixRelative(project.root, applied.backupDir)}. Undo with npx agentblog revert.`,
      )
    }
    for (const line of declined) note(`  ${line}`)
  }

  if (!options.dryRun) {
    writeManifest(project, {
      installedAt: new Date().toISOString(),
      cliVersion: process.env['AGENTBLOG_VERSION'] ?? '0.1.0',
      files: installedFiles(project),
      items: [BLOG_REGISTRY_ITEM, SOURCE_REGISTRY_ITEMS[answers.source] ?? ''].filter(Boolean),
      contentDir: appPathLabel(project, 'content/blog'),
    })
  }

  track(
    'init',
    { source: answers.source, dryRun: options.dryRun === true },
    options.telemetry === false,
  )

  say()
  step('Verifying the install')
  const result = await runDoctor({
    cwd: project.root,
    url: undefined,
    fix: false,
    dryRun: false,
    verbose: false,
    offline: false,
  })
  process.exitCode = result.errors > 0 ? 1 : 0
}

function describeLayout(project: ProjectContext): void {
  bullet(`layout: ${project.usesSrcDir ? 'src/ directory' : 'project root'}`)
  bullet(`package manager: ${project.packageManager}`)
  if (project.workspaceRoot) {
    bullet(`monorepo detected, workspace root ${project.workspaceRoot}`)
    note(
      'agentblog.config.ts, AGENTS.md, and the skills go into this package, not the workspace root.',
    )
  }
}

/**
 * The three answers with no safe default, and the one rule each is held to.
 *
 * The interactive prompts and the `--yes` path both read this table, which is
 * the point of having it. When they were separate, `--yes` accepted an empty
 * string for all three and the layout patcher wrote `metadataBase: new URL('')`
 * and `title: { default: '', template: '%s | ' }`. `new URL('')` throws
 * `TypeError: Invalid URL` at module evaluation, so `next dev` and `next build`
 * both failed on a file the tool had just written, on the documented
 * non-interactive path.
 */
const REQUIRED_ANSWERS = [
  {
    key: 'siteUrl',
    flag: '--site-url <url>',
    prompt: 'Production site URL (https, no trailing slash)',
    rule: /^https:\/\/[^\s/]+/,
    complaint: 'Must be an absolute https URL',
  },
  {
    key: 'brand',
    flag: '--brand <name>',
    prompt: 'Brand name (used as og:site_name and Organization.name)',
    rule: /\S/,
    complaint: 'Required',
  },
  {
    key: 'author',
    flag: '--author <slug>',
    prompt: 'Default author slug (lowercase, hyphenated)',
    rule: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    complaint: 'Lowercase and hyphen separated',
  },
] as const satisfies readonly {
  key: 'siteUrl' | 'brand' | 'author'
  flag: string
  prompt: string
  rule: RegExp
  complaint: string
}[]

async function ask(options: InitOptions): Promise<InitAnswers | null> {
  if (options.yes) return withoutPrompts(options)

  const response = await prompts(
    [
      {
        type: options.source ? null : 'select',
        name: 'source',
        message: 'Where do your posts live?',
        choices: [
          {
            title: 'MDX files in the repository',
            value: 'mdx',
            description: 'Publishing is a git push',
          },
        ],
        initial: 0,
      },
      ...REQUIRED_ANSWERS.map((answer) => ({
        type: (options[answer.key] ? null : 'text') as 'text' | null,
        name: answer.key,
        message: answer.prompt,
        validate: (value: string) => (answer.rule.test(value) ? true : answer.complaint),
      })),
    ],
    { onCancel: () => false },
  )

  const source = options.source ?? (response['source'] as string | undefined)
  const siteUrl = options.siteUrl ?? (response['siteUrl'] as string | undefined)
  const brand = options.brand ?? (response['brand'] as string | undefined)
  const author = options.author ?? (response['author'] as string | undefined)
  if (!source || !siteUrl || !brand || !author) {
    note('Cancelled.')
    return null
  }

  return {
    source,
    siteUrl,
    brand,
    author,
    registryUrl: options.registry ?? DEFAULT_REGISTRY_URL,
  }
}

/**
 * `--yes` refuses rather than inventing values.
 *
 * There is no defensible default for a site URL, a brand name, or an author
 * slug, so the honest non-interactive contract is "pass them or I stop". Each
 * value is held to the same rule the matching prompt uses, because a flag that
 * accepts what the prompt rejects is the same bug arriving through a different
 * door.
 */
function withoutPrompts(options: InitOptions): InitAnswers | null {
  const missing = REQUIRED_ANSWERS.filter((answer) => !options[answer.key])
  if (missing.length > 0) {
    report(
      'error',
      `--yes skips the prompts, so ${missing.map((answer) => answer.key).join(', ')} must come from a flag. Without ${missing.length > 1 ? 'them' : 'it'} the layout patcher would write metadataBase: new URL(''), which throws TypeError: Invalid URL and fails every build.`,
      `Pass ${missing.map((answer) => answer.flag).join(' ')}`,
    )
    return null
  }

  const invalid = REQUIRED_ANSWERS.filter((answer) => !answer.rule.test(options[answer.key] ?? ''))
  if (invalid.length > 0) {
    for (const answer of invalid) {
      report(
        'error',
        `${answer.flag.split(' ')[0]} is ${JSON.stringify(options[answer.key])}. ${answer.complaint}.`,
      )
    }
    return null
  }

  return {
    source: options.source ?? 'mdx',
    siteUrl: options.siteUrl!,
    brand: options.brand!,
    author: options.author!,
    registryUrl: options.registry ?? DEFAULT_REGISTRY_URL,
  }
}

/**
 * Decide whether `shadcn add` runs at all, then run it safely.
 *
 * ===========================================================================
 * THREE RULES, ALL OF THEM PAID FOR
 * ===========================================================================
 * 1. **A project that already has AgentBlog does not get a second install.**
 *    `init` re-ran `shadcn add --overwrite` unconditionally and replaced the
 *    tester's author record, their category, and an inbound link they had added
 *    to a seed post, reporting `Updated 5 files`. The install manifest already
 *    records that we have been here, so it is read and the step is skipped.
 *    `--reinstall` forces it for the case where the file copy genuinely needs
 *    redoing, and it says what that costs.
 *
 * 2. **Content is never overwritten.** `--overwrite` cannot be dropped (without
 *    it `add` blocks on an interactive prompt the moment any target exists,
 *    including the `components/ui/*` files a shadcn project already has), so
 *    the content files are snapshotted before and restored after. The registry
 *    seed only ever lands where there was nothing.
 *
 * 3. **What is outside the backup is stated, not implied.** `shadcn add` writes
 *    outside our `PatchSet`, so `agentblog revert` cannot undo the code and
 *    route files it writes. That sentence is printed before the command runs
 *    rather than discovered afterwards.
 *
 * @see `init-content.ts`
 */
function runInstallStep(
  project: ProjectContext,
  answers: InitAnswers,
  options: InitOptions,
): boolean {
  const items = [BLOG_REGISTRY_ITEM, SOURCE_REGISTRY_ITEMS[answers.source]].filter(
    (item): item is string => Boolean(item),
  )
  const { command, args } = dlxCommand(project.packageManager)
  const commandLine = `${command} ${[...args, ...shadcnAddArgs(items)].join(' ')}`

  if (options.skipInstall) {
    note('Skipping shadcn add because --skip-install was passed. Only the config patches will run.')
    return true
  }

  const manifest = readManifest(project)
  if (manifest && !options.reinstall) {
    step('AgentBlog is already installed here, so the registry files were left alone')
    bullet(`installed ${manifest.installedAt} by agentblog ${manifest.cliVersion}`)
    bullet(`${manifest.files.length} file(s) recorded in .agentblog/manifest.json`)
    note('The config patches below still run, and they are idempotent.')
    note(
      'Pass --reinstall to run `shadcn add --overwrite` again. It replaces the block code, and your content is snapshotted and restored either way.',
    )
    return true
  }

  if (options.dryRun) {
    /*
     * `--dry-run` used to imply `--skip-install` and print "Skipping shadcn
     * add", so the flag recommended for reading the plan first hid the half of
     * the operation that actually failed on a clean project. It prints the real
     * command now, and nothing runs.
     */
    step('Dry run: this is the install command, and it was not run')
    bullet(commandLine)
    bullet(`registry: ${answers.registryUrl}`)
    note('Files shadcn writes are outside the AgentBlog backup, so revert cannot undo them.')
    return true
  }

  // Taken before the call, restored after it. See `init-content.ts`.
  const snapshots = snapshotContent(project)
  if (snapshots.length > 0) {
    note(`${snapshots.length} existing content file(s) will be kept, whatever the registry ships.`)
  }
  note('shadcn writes the block code and routes. Those files are outside the AgentBlog backup.')

  step(`Running ${commandLine}`)
  const status = runInherit(command, [...args, ...shadcnAddArgs(items)], project.root)
  const kept = restoreContent(snapshots)
  if (kept.length > 0) {
    success(`Kept your version of ${kept.length} content file(s) the registry would have replaced:`)
    for (const label of kept) bullet(label)
  }

  if (status !== 0) {
    note('shadcn add failed. Nothing was patched.')
    if (project.componentsJson?.registries === undefined) {
      note(
        'If it said `Unknown registry "@agentblog"`, check the registries entry in components.json.',
      )
    }
    return false
  }
  return true
}
