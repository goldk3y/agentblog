/**
 * Terminal output primitives.
 *
 * One rule governs everything here: a failure line always states what to do
 * next. A check that reports a problem without a remedy is a check that
 * generates a support question, and this CLI reports problems in someone else's
 * repository where we cannot answer that question.
 *
 * House style: no em dashes anywhere in CLI output. Use a comma, a colon,
 * parentheses, or a full stop.
 *
 * @see https://agentblog.dev/docs/agent-layer
 */
import pc from 'picocolors'

import type { Finding } from '@agentblog/checks'

/** Severity prefixes are fixed width so findings line up in a scannable column. */
const PREFIX = {
  error: () => pc.red(pc.bold('ERROR')),
  warning: () => pc.yellow(pc.bold(' WARN')),
  info: () => pc.blue(pc.bold(' INFO')),
  ok: () => pc.green(pc.bold('   OK')),
  skip: () => pc.dim(' SKIP'),
} as const

export type Level = keyof typeof PREFIX

/**
 * `--json` mode routes through here rather than through a second code path.
 *
 * Every human facing helper below ends up calling `say`, so silencing it is
 * enough to guarantee that a `--json` run emits exactly one document on stdout
 * and nothing else. A second reporter that had to be kept in sync with this one
 * would drift, and a JSON reporter that drifts from the text reporter is worse
 * than no JSON reporter, because CI believes it.
 */
let silenced = false

export function setSilent(value: boolean): void {
  silenced = value
}

export function say(message = ''): void {
  if (silenced) return
  process.stdout.write(`${message}\n`)
}

/** Writes regardless of `setSilent`. Used for the one `--json` document. */
export function writeRaw(text: string): void {
  process.stdout.write(text)
}

/** A section heading. Groups findings so a long report stays readable. */
export function heading(title: string): void {
  say()
  say(pc.bold(pc.underline(title)))
}

export function note(message: string): void {
  say(pc.dim(message))
}

export function bullet(message: string): void {
  say(`  ${pc.dim('-')} ${message}`)
}

/** One line per finding, severity prefix first, remedy indented beneath it. */
export function report(level: Level, message: string, remedy?: string): void {
  say(`${PREFIX[level]()}  ${message}`)
  if (remedy) say(`        ${pc.dim('Fix:')} ${remedy}`)
}

export function reportFinding(finding: Finding): void {
  report(finding.severity, finding.message, finding.remedy)
}

/** A banner that is impossible to miss, used for blocking refusals. */
export function refusal(lines: readonly string[]): void {
  say()
  for (const line of lines) say(pc.red(line))
  say()
}

export function success(message: string): void {
  say(`${pc.green('✔')} ${message}`)
}

export function step(message: string): void {
  say(`${pc.cyan('›')} ${message}`)
}

/** Colourize a unified diff so the interesting lines are obvious. */
export function printDiff(diff: string): void {
  for (const line of diff.split('\n')) {
    if (line.startsWith('+++') || line.startsWith('---')) say(pc.bold(line))
    else if (line.startsWith('@@')) say(pc.cyan(line))
    else if (line.startsWith('+')) say(pc.green(line))
    else if (line.startsWith('-')) say(pc.red(line))
    else say(line)
  }
}

export { pc }
