/**
 * Process helpers, and the one measured fact about `shadcn add` that this file
 * exists to encode.
 *
 * `shadcn add --yes` still blocks on an interactive overwrite prompt when a
 * target file already exists, which turns a CI install into a hung job with no
 * output. `--overwrite` is what actually makes it non-interactive. That was
 * measured against shadcn 4.16.2; see BUILD-SPEC section 12.
 */
import { spawnSync } from 'node:child_process'

export interface RunResult {
  readonly status: number
  readonly stdout: string
  readonly stderr: string
}

export type PackageManager = 'pnpm' | 'npm' | 'yarn' | 'bun'

export const PACKAGE_MANAGERS = ['pnpm', 'npm', 'yarn', 'bun'] as const

/**
 * `true` when `value` names a package manager we can drive.
 *
 * `dlxCommand` is an exhaustive switch over the union, so an unchecked string
 * arriving from `--package-manager` fell off the end and returned `undefined`.
 * The user saw `Cannot destructure property 'command' of 'dlxCommand(...)'`,
 * which describes our implementation rather than their typo.
 */
export function isPackageManager(value: unknown): value is PackageManager {
  return typeof value === 'string' && (PACKAGE_MANAGERS as readonly string[]).includes(value)
}

/**
 * The shadcn version every invocation is pinned to.
 *
 * `@latest` meant the behaviour the CLI was built against and the behaviour it
 * got could differ on any given day, and the measured facts in BUILD-SPEC
 * section 12 (`--overwrite` is what makes `add` non-interactive, `--name` is
 * what scaffolds into a directory, `registry:page` is framework gated) are
 * facts about a version, not about a package name.
 */
export const SHADCN_VERSION = '4.16.1'
export const SHADCN_PACKAGE = `shadcn@${SHADCN_VERSION}`

/** Run a command, inheriting stdio so the user sees progress as it happens. */
export function runInherit(command: string, args: readonly string[], cwd: string): number {
  const result = spawnSync(command, [...args], { cwd, stdio: 'inherit', shell: false })
  return result.status ?? 1
}

/** Run a command and capture its output. Never throws. */
export function runCapture(command: string, args: readonly string[], cwd: string): RunResult {
  const result = spawnSync(command, [...args], { cwd, encoding: 'utf8', shell: false })
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  }
}

/** The `dlx` equivalent for each package manager, used to invoke `shadcn`. */
export function dlxCommand(pm: PackageManager): { command: string; args: string[] } {
  switch (pm) {
    case 'pnpm':
      return { command: 'pnpm', args: ['dlx'] }
    case 'yarn':
      return { command: 'yarn', args: ['dlx'] }
    case 'bun':
      return { command: 'bunx', args: ['--bun'] }
    case 'npm':
      return { command: 'npx', args: ['--yes'] }
  }
}

/**
 * Build the `shadcn add` invocation.
 *
 * `--overwrite` is not optional on a re-install. Without it an install that
 * re-runs over an existing file waits forever on a prompt nobody is there to
 * answer. It is also the flag that let `shadcn add` replace a user's
 * `content/authors.json` and their edited seed posts, so `init` snapshots and
 * restores the content files around the call rather than trusting it.
 *
 * @see `packages/cli/src/commands/init-content.ts`
 */
export function shadcnAddArgs(items: readonly string[]): string[] {
  return [SHADCN_PACKAGE, 'add', ...items, '--yes', '--overwrite']
}

/**
 * `true` when `path` is ignored by git. Used by doctor check 13.
 *
 * `--` closes the option list. Every current caller passes a hard-coded
 * `.env` or `.env.local`, so a path beginning with a dash is not reachable
 * today, but a helper that only happens to be safe is one refactor from not
 * being.
 */
export function isGitIgnored(cwd: string, path: string): boolean | null {
  const result = runCapture('git', ['check-ignore', '-q', '--', path], cwd)
  // 0 means ignored, 1 means not ignored, anything else means git could not
  // answer (not a repository, git missing) and the caller should stay quiet.
  if (result.status === 0) return true
  if (result.status === 1) return false
  return null
}

/** `true` when `path` is tracked by git right now. */
export function isGitTracked(cwd: string, path: string): boolean | null {
  const result = runCapture('git', ['ls-files', '--error-unmatch', '--', path], cwd)
  if (result.status === 0) return true
  if (result.status === 1) return false
  return null
}
