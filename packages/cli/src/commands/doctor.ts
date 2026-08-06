/**
 * `agentblog doctor`.
 *
 * Exit code is the whole point of the command in CI: non-zero when any finding
 * is an error. Everything else it prints is for a human, except `--json`, which
 * prints the same report as one document and nothing else so a pipeline can read
 * it without scraping the terminal output.
 */
import { runDoctor } from '../doctor/run.ts'
import { track } from '../util/telemetry.ts'
import { say, setSilent, step, writeRaw } from '../util/log.ts'

export interface DoctorCommandOptions {
  readonly url?: string
  readonly fix?: boolean
  readonly dryRun?: boolean
  readonly verbose?: boolean
  readonly offline?: boolean
  readonly json?: boolean
  readonly telemetry?: boolean
  readonly cwd?: string
}

export async function doctorCommand(options: DoctorCommandOptions): Promise<void> {
  const json = options.json ?? false
  setSilent(json)

  const cwd = options.cwd ?? process.cwd()
  step(`Checking ${cwd}`)
  if (options.url) say(`Live checks against ${options.url}`)

  const result = await runDoctor({
    cwd,
    url: options.url,
    fix: options.fix ?? false,
    dryRun: options.dryRun ?? false,
    verbose: options.verbose ?? false,
    offline: options.offline ?? false,
  })

  if (json) {
    writeRaw(
      `${JSON.stringify(
        {
          root: result.project.root,
          url: options.url ?? null,
          // Present only when --fix ran, so a consumer can tell "repaired
          // nothing" apart from "was never asked to repair anything".
          ...(result.fix ? { fix: result.fix } : {}),
          ...result.report,
        },
        null,
        2,
      )}\n`,
    )
  }

  track(
    'doctor',
    { errors: result.errors, warnings: result.warnings, live: Boolean(options.url) },
    options.telemetry === false,
  )

  process.exitCode = result.errors > 0 ? 1 : 0
}
