/**
 * Anonymous, opt-out telemetry.
 *
 * ===========================================================================
 * THE SEND IS A NO-OP IN THIS RELEASE, ON PURPOSE
 * ===========================================================================
 * There is no network call here. Events are appended to a JSONL file under the
 * user's config directory and nothing reads it. The flag, the disclosure, and
 * the opt-out are shipped now so that the behaviour a user consents to on first
 * run is the behaviour they keep; turning on a real sink later is a version bump
 * and a changelog entry, not a surprise.
 *
 * What would be sent when a sink exists: command name, CLI version, Next.js and
 * React major versions, the chosen content source, and whether `doctor` passed.
 * Never a path, never a URL, never file contents, never anything from a post.
 *
 * Precedence, highest first: `--no-telemetry`, `DO_NOT_TRACK`,
 * `AGENTBLOG_TELEMETRY=0`, the stored preference, then the default (on).
 *
 * @see https://docs.agentblog.dev/project/roadmap
 */
import { appendFileSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

import { note, say } from './log.ts'
import { readJson, writeFileEnsuringDir } from './fs.ts'

interface TelemetryPrefs {
  readonly enabled: boolean
  readonly disclosed: boolean
}

function configDir(): string {
  const base = process.env['XDG_CONFIG_HOME'] ?? join(homedir(), '.config')
  return join(base, 'agentblog')
}

function prefsPath(): string {
  return join(configDir(), 'telemetry.json')
}

function readPrefs(): TelemetryPrefs {
  return readJson<TelemetryPrefs>(prefsPath()) ?? { enabled: true, disclosed: false }
}

function envOptOut(): boolean {
  const doNotTrack = process.env['DO_NOT_TRACK']
  if (doNotTrack && doNotTrack !== '0' && doNotTrack !== 'false') return true
  const own = process.env['AGENTBLOG_TELEMETRY']
  if (own === '0' || own === 'false') return true
  return false
}

export function isEnabled(flagDisabled: boolean): boolean {
  if (flagDisabled) return false
  if (envOptOut()) return false
  return readPrefs().enabled
}

/**
 * Print the disclosure once, the first time the CLI runs on this machine.
 *
 * Disclosing on first run rather than burying it in a README is the whole point.
 * A user who reads this and runs `agentblog telemetry off` has lost nothing.
 */
export function discloseOnce(): void {
  const prefs = readPrefs()
  if (prefs.disclosed) return
  say()
  note('AgentBlog collects anonymous usage data: the command you ran, the CLI version, your')
  note('Next.js and React major versions, the content source you picked, and whether doctor')
  note('passed. No paths, no URLs, no file contents, no post text.')
  note('Turn it off with `agentblog telemetry off`, `--no-telemetry`, or DO_NOT_TRACK=1.')
  note('In this release the events are written to a local file and never sent anywhere.')
  say()
  writePrefs({ enabled: prefs.enabled, disclosed: true })
}

export function writePrefs(prefs: TelemetryPrefs): void {
  writeFileEnsuringDir(prefsPath(), `${JSON.stringify(prefs, null, 2)}\n`)
}

export function setEnabled(enabled: boolean): void {
  writePrefs({ enabled, disclosed: true })
}

export function status(flagDisabled: boolean): string {
  if (flagDisabled) return 'disabled for this run by --no-telemetry'
  if (envOptOut())
    return 'disabled by an environment variable (DO_NOT_TRACK or AGENTBLOG_TELEMETRY)'
  return readPrefs().enabled ? 'enabled' : 'disabled'
}

/** Record an event. Local file only in this release. Never throws. */
export function track(
  event: string,
  properties: Readonly<Record<string, string | number | boolean>>,
  flagDisabled: boolean,
): void {
  if (!isEnabled(flagDisabled)) return
  try {
    mkdirSync(configDir(), { recursive: true })
    const record = { event, at: new Date().toISOString(), ...properties }
    appendFileSync(join(configDir(), 'events.jsonl'), `${JSON.stringify(record)}\n`, 'utf8')
  } catch {
    // Telemetry never interferes with the command the user actually ran.
  }
}
