/**
 * The doctor runner.
 *
 * Order matters in the report: dependencies, then configuration, then installed
 * files, then live crawler access. A user reading top to bottom meets the
 * findings in the order they have to fix them, and a wrong Tailwind version
 * explains half the findings below it.
 *
 * The exit code is the contract with CI: non-zero when any finding is an error.
 * Warnings and notes never fail a build, because a tool that fails builds over
 * advice gets removed from the pipeline and then catches nothing.
 */
import { runAgentsChecks } from './agents-checks.ts'
import { runBlockChecks } from './block-checks.ts'
import { runCodeChecks } from './code-checks.ts'
import { runConfigChecks } from './config-checks.ts'
import { runEnvChecks } from './env-checks.ts'
import { runLiveChecks } from './live-checks.ts'
import { runVersionChecks } from './version-checks.ts'
import { buildFixes } from './fix.ts'
import { applyPatches } from '../commands/write.ts'
import { detectProject, type ProjectContext } from '../detect/project.ts'
import { Reporter } from '../report/reporter.ts'
import { note, say, step, success } from '../util/log.ts'
import type { DoctorContext } from './context.ts'

export interface DoctorOptions {
  readonly cwd: string
  readonly url: string | undefined
  readonly fix: boolean
  readonly dryRun: boolean
  readonly verbose: boolean
  readonly offline: boolean
}

/** What `--fix` actually did, reported rather than assumed. */
export interface FixSummary {
  readonly applied: string[]
  readonly declined: string[]
  readonly files: string[]
  readonly dryRun: boolean
  readonly backup: string | null
}

export interface DoctorResult {
  readonly errors: number
  readonly warnings: number
  readonly project: ProjectContext
  readonly report: ReturnType<Reporter['toJson']>
  readonly fix: FixSummary | null
}

export async function runDoctor(options: DoctorOptions): Promise<DoctorResult> {
  const project = detectProject(options.cwd)

  const fix = options.fix ? await applyFixes(project, options) : null

  const reporter = await collect(project, options)
  reporter.print({ verbose: options.verbose })
  reporter.summary()

  return {
    errors: reporter.count('error'),
    warnings: reporter.count('warning'),
    project,
    report: reporter.toJson(),
    fix,
  }
}

async function collect(project: ProjectContext, options: DoctorOptions): Promise<Reporter> {
  const reporter = new Reporter()
  const ctx: DoctorContext = {
    project,
    reporter,
    url: options.url,
    fixing: options.fix,
  }

  await runVersionChecks(ctx, { offline: options.offline })
  runConfigChecks(ctx)
  runBlockChecks(ctx)
  runCodeChecks(ctx)
  runEnvChecks(ctx)
  runAgentsChecks(ctx)
  await runLiveChecks(ctx)

  return reporter
}

/**
 * Apply the repairs and report exactly what happened.
 *
 * The returned summary is the answer to "what did --fix change", and it is
 * derived from the patch set rather than from the list of things we intended to
 * change. A patcher that declines still contributes a line to `declined`, and a
 * patcher whose output matches the file on disk contributes nothing at all,
 * which is how the summary stays true on a second run.
 */
async function applyFixes(project: ProjectContext, options: DoctorOptions): Promise<FixSummary> {
  step('Computing repairs')
  const { patches, changes, declined } = buildFixes(project)

  if (patches.isEmpty) {
    note('Nothing to repair. Every patch site is already correct.')
    for (const line of declined) note(`  ${line}`)
    say()
    return { applied: [], declined, files: [], dryRun: options.dryRun, backup: null }
  }

  const files = patches.changed.map((edit) => edit.label)
  for (const change of changes) note(`  ${change}`)
  patches.print()

  // Anything we declined to change is printed either way. A user who is told
  // what was left alone can decide about it; one who is not is silently half
  // configured, which is the failure mode this whole product is about.
  const reportDeclined = (): void => {
    for (const line of declined) note(`  ${line}`)
  }

  if (options.dryRun) {
    say()
    reportDeclined()
    note(`Dry run. Nothing was written. ${files.length} file(s) would change: ${files.join(', ')}.`)
    say()
    return { applied: changes, declined, files, dryRun: true, backup: null }
  }

  const applied = applyPatches(patches, project.root)
  if (!applied.ok) {
    return { applied: [], declined, files: [], dryRun: false, backup: null }
  }
  const backup = applied.backupDir
  success(`Applied ${files.length} file change(s): ${files.join(', ')}.`)
  if (backup) note(`Backup: ${backup}. Restore it with npx agentblog revert.`)
  reportDeclined()
  say()
  await Promise.resolve()
  return { applied: changes, declined, files, dryRun: false, backup }
}
