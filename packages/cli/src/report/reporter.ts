/**
 * The findings collector, shared by `doctor` and `audit`.
 *
 * Grouping exists because a 32 check report read as a flat list is unusable. A
 * user scanning output wants to know which area is broken before they read a
 * single message, so checks are grouped by the file they are about.
 *
 * Skipped checks are first class rather than silent. A check that could not run
 * (no network, no git, no built output) and a check that passed are different
 * facts, and reporting the first as the second is how a verification tool loses
 * the only thing it sells.
 */
import type { Finding, Severity } from '@agentblog/checks'

import { heading, note, report, reportFinding, say, pc } from '../util/log.ts'

type Outcome =
  | { readonly kind: 'pass'; readonly name: string }
  | { readonly kind: 'skip'; readonly name: string; readonly reason: string }
  | { readonly kind: 'finding'; readonly name: string; readonly finding: Finding }

export class Reporter {
  private readonly groups = new Map<string, Outcome[]>()
  private current = 'General'

  group(name: string): void {
    this.current = name
    if (!this.groups.has(name)) this.groups.set(name, [])
  }

  private push(outcome: Outcome): void {
    const list = this.groups.get(this.current)
    if (list) list.push(outcome)
    else this.groups.set(this.current, [outcome])
  }

  pass(name: string): void {
    this.push({ kind: 'pass', name })
  }

  skip(name: string, reason: string): void {
    this.push({ kind: 'skip', name, reason })
  }

  finding(name: string, finding: Finding): void {
    this.push({ kind: 'finding', name, finding })
  }

  /** Convenience for the common case of building a finding inline. */
  fail(
    name: string,
    input: {
      readonly id: string
      readonly severity: Severity
      readonly message: string
      readonly remedy?: string
      readonly fixable?: boolean
    },
  ): void {
    const finding: Finding = input.remedy
      ? {
          id: input.id,
          severity: input.severity,
          message: input.message,
          remedy: input.remedy,
          fixable: input.fixable ?? false,
        }
      : {
          id: input.id,
          severity: input.severity,
          message: input.message,
          fixable: input.fixable ?? false,
        }
    this.push({ kind: 'finding', name, finding })
  }

  get findings(): Finding[] {
    return [...this.groups.values()]
      .flat()
      .flatMap((outcome) => (outcome.kind === 'finding' ? [outcome.finding] : []))
  }

  count(severity: Severity): number {
    return this.findings.filter((finding) => finding.severity === severity).length
  }

  get skipped(): { name: string; reason: string }[] {
    return [...this.groups.values()]
      .flat()
      .flatMap((outcome) =>
        outcome.kind === 'skip' ? [{ name: outcome.name, reason: outcome.reason }] : [],
      )
  }

  get passedCount(): number {
    return [...this.groups.values()].flat().filter((outcome) => outcome.kind === 'pass').length
  }

  /**
   * The same report, as data.
   *
   * `--json` on `doctor` and `audit` serializes this. It is derived from the
   * identical `groups` map the text reporter prints, so the two can never
   * disagree about what ran, which is the only reason a machine readable gate is
   * worth having in CI. Passing and skipped outcomes are always included: a
   * consumer filters, and a check that could not run is a different fact from a
   * check that passed.
   */
  toJson(): {
    groups: {
      name: string
      outcomes: (
        | { kind: 'pass'; name: string }
        | { kind: 'skip'; name: string; reason: string }
        | { kind: 'finding'; name: string; finding: Finding }
      )[]
    }[]
    summary: {
      passed: number
      errors: number
      warnings: number
      infos: number
      skipped: number
      fixable: number
    }
  } {
    return {
      groups: [...this.groups].map(([name, outcomes]) => ({ name, outcomes: [...outcomes] })),
      summary: {
        passed: this.passedCount,
        errors: this.count('error'),
        warnings: this.count('warning'),
        infos: this.count('info'),
        skipped: this.skipped.length,
        fixable: this.findings.filter((finding) => finding.fixable).length,
      },
    }
  }

  /**
   * Print the report. Passing checks are hidden unless `verbose`, because a wall
   * of green is how a real error gets missed.
   */
  print(options: { readonly verbose: boolean }): void {
    for (const [group, outcomes] of this.groups) {
      const interesting = outcomes.filter((outcome) => outcome.kind !== 'pass' || options.verbose)
      if (interesting.length === 0) continue
      heading(group)
      for (const outcome of interesting) {
        if (outcome.kind === 'pass') report('ok', outcome.name)
        else if (outcome.kind === 'skip') report('skip', `${outcome.name}: ${outcome.reason}`)
        else reportFinding(outcome.finding)
      }
    }
  }

  /** The closing line. States the counts and what to do next. */
  summary(): void {
    const errors = this.count('error')
    const warnings = this.count('warning')
    const infos = this.count('info')
    const skipped = this.skipped.length

    say()
    const parts = [
      `${this.passedCount} passed`,
      errors > 0 ? pc.red(`${errors} error${errors === 1 ? '' : 's'}`) : '0 errors',
      warnings > 0 ? pc.yellow(`${warnings} warning${warnings === 1 ? '' : 's'}`) : '0 warnings',
      `${infos} notes`,
      `${skipped} skipped`,
    ]
    say(parts.join(pc.dim(' · ')))

    const fixable = this.findings.filter((finding) => finding.fixable).length
    if (fixable > 0) {
      note(`${fixable} of these can be repaired: npx agentblog doctor --fix`)
    }
  }
}
