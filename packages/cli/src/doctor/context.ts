/**
 * What every doctor check receives.
 *
 * Detection happens once, in `run.ts`, and is passed down. A check that
 * re-detects the project is a check that can disagree with its neighbours about
 * whether this is a `src/` layout, and the report then contradicts itself.
 */
import type { ProjectContext } from '../detect/project.ts'
import type { Reporter } from '../report/reporter.ts'

export interface DoctorContext {
  readonly project: ProjectContext
  readonly reporter: Reporter
  /** The live URL for checks 15 and 16. Absent means those checks are skipped. */
  readonly url: string | undefined
  /** Set when the user asked for repairs, so a check can phrase its remedy. */
  readonly fixing: boolean
}
