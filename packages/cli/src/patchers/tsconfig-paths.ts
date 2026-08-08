/**
 * The `tsconfig.json` patcher: making `@/agentblog.config` resolve in a `src/`
 * layout.
 *
 * ===========================================================================
 * THE FAILURE MODE THIS CLOSES
 * ===========================================================================
 * `agentblog.config.ts` belongs at the project root, next to `next.config.ts`,
 * and `lib/config.ts` is the single module that reads it, through
 * `@/agentblog.config`.
 *
 * In a flat layout `@/*` maps to `./*`, that specifier lands on the root file,
 * and nothing needs doing. In a `src/` layout `@/*` maps to `./src/*`, so the
 * same specifier looks for `src/agentblog.config.ts`. The file is not there and
 * must not be: shadcn writes it from a `~/agentblog.config.ts` target, and `~`
 * means the project root literally rather than the source directory.
 *
 * Measured on a clean `create-next-app --src-dir` project with the block
 * installed through the registry, the build stops before any of our code runs:
 *
 *     Error: Module not found: Can't resolve '@/agentblog.config'
 *     Error: Turbopack build failed with 1 error
 *
 * That is early and loud, which is the good news, and it is also unactionable:
 * the message names a specifier rather than a fix, and the runtime guard in
 * `lib/preflight.ts` that explains this exact situation can never print, because
 * module resolution fails before a single module is evaluated.
 *
 * ---------------------------------------------------------------------------
 * WHY AN EXACT PATH ENTRY RATHER THAN MOVING THE FILE
 * ---------------------------------------------------------------------------
 * The alternative is to stop targeting the project root and let the file land
 * under the `lib` alias, where `src/` resolution would work by itself. That
 * trades a one line tsconfig entry for moving a config file out of the place
 * every other config file in a Next.js project lives, and it would relocate
 * `agentblog.config.ts` under everyone who already has one.
 *
 * TypeScript resolves `paths` by the longest prefix before any `*`, so an entry
 * with no wildcard always beats `@/*` no matter which order the two appear in.
 * The entry is written first anyway, because the reason it exists is only
 * legible next to the wildcard it overrides.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS EDITS TEXT INSTEAD OF PARSING
 * ---------------------------------------------------------------------------
 * `tsconfig.json` is JSONC. `create-next-app` writes no comments, but the file
 * is edited by hand more than almost any other in a project, and a
 * `JSON.parse` and `JSON.stringify` round trip would silently delete every
 * comment and every deliberate bit of formatting in it. So this inserts one
 * member into an existing object and touches nothing else, and the diff a user
 * approves is one line.
 *
 * @see https://www.typescriptlang.org/docs/handbook/modules/reference.html
 * @see https://docs.agentblog.dev/reference/configuration
 */
import type { PatchResult } from './next-config.ts'

/** The specifier `lib/config.ts` imports. The only importer, by design. */
export const CONFIG_SPECIFIER = '@/agentblog.config'

/** Where the file actually is, relative to the project root. */
export const CONFIG_PATH_TARGET = './agentblog.config.ts'

/**
 * Blank every comment while preserving length, so offsets computed against the
 * mask address the same characters in the original.
 *
 * String aware, because `"https://example.com"` inside a `paths` target is not
 * the start of a line comment and a checker that thinks it is would blank the
 * rest of the line and lose a brace.
 */
function maskComments(source: string): string {
  let out = ''
  let index = 0
  let inString = false

  while (index < source.length) {
    const char = source[index]!
    const next = source[index + 1]

    if (inString) {
      if (char === '\\') {
        out += source.slice(index, index + 2)
        index += 2
        continue
      }
      if (char === '"') inString = false
      out += char
      index += 1
      continue
    }

    if (char === '"') {
      inString = true
      out += char
      index += 1
      continue
    }

    if (char === '/' && next === '/') {
      while (index < source.length && source[index] !== '\n') {
        out += ' '
        index += 1
      }
      continue
    }

    if (char === '/' && next === '*') {
      while (index < source.length && !(source[index] === '*' && source[index + 1] === '/')) {
        out += source[index] === '\n' ? '\n' : ' '
        index += 1
      }
      out += '  '
      index += 2
      continue
    }

    out += char
    index += 1
  }

  return out
}

/** The span of the object literal that follows `"key":`, or `null`. */
function objectSpan(masked: string, from: number): { open: number; close: number } | null {
  let index = masked.indexOf(':', from)
  if (index === -1) return null

  index += 1
  while (index < masked.length && /\s/.test(masked[index]!)) index += 1
  if (masked[index] !== '{') return null

  const open = index
  let depth = 0
  let inString = false

  for (let scan = open; scan < masked.length; scan += 1) {
    const char = masked[scan]!
    if (inString) {
      if (char === '\\') {
        scan += 1
        continue
      }
      if (char === '"') inString = false
      continue
    }
    if (char === '"') {
      inString = true
      continue
    }
    if (char === '{' || char === '[') depth += 1
    if (char === '}' || char === ']') {
      depth -= 1
      if (depth === 0) return { open, close: scan }
    }
  }

  return null
}

/**
 * Index of `"key"` declared directly in the object spanning `open` to `close`,
 * ignoring the same key nested inside a member of it.
 *
 * The depth check is what keeps a `"paths"` key belonging to some other object
 * from being mistaken for `compilerOptions.paths`.
 */
function memberKeyIndex(masked: string, open: number, close: number, key: string): number {
  const needle = `"${key}"`
  let depth = 0
  let inString = false

  for (let scan = open + 1; scan < close; scan += 1) {
    const char = masked[scan]!
    if (inString) {
      if (char === '\\') {
        scan += 1
        continue
      }
      if (char === '"') inString = false
      continue
    }
    if (char === '"') {
      if (depth === 0 && masked.startsWith(needle, scan)) return scan
      inString = true
      continue
    }
    if (char === '{' || char === '[') depth += 1
    if (char === '}' || char === ']') depth -= 1
  }

  return -1
}

/** The indentation of the line `index` sits on. */
function indentOfLine(source: string, index: number): string {
  const lineStart = source.lastIndexOf('\n', index) + 1
  const match = /^[ \t]*/.exec(source.slice(lineStart, index))
  return match ? match[0] : ''
}

export interface TsconfigPathsOptions {
  /** The bare specifier to map. */
  readonly specifier: string
  /** The project-relative file it must resolve to. */
  readonly target: string
}

/**
 * Add one exact `paths` entry to an existing `compilerOptions.paths` object.
 *
 * Declines rather than guesses when there is no local `paths` object to add to.
 * Writing one would not be additive: `paths` is replaced wholesale by the
 * nearest config that defines it, so a file that inherits `"@/*"` through
 * `extends` would lose it the moment this wrote a `paths` of its own, and every
 * `@/` import in the project would stop resolving. Trading a config import for
 * every import is not a repair.
 */
export function patchTsconfigPaths(
  source: string,
  label: string,
  options: TsconfigPathsOptions,
): PatchResult {
  const { specifier, target } = options
  const changes: string[] = []
  const masked = maskComments(source)

  const rootOpen = masked.indexOf('{')
  if (rootOpen === -1) {
    return {
      source,
      changes,
      declined: [`${label} has no JSON object in it, so "${specifier}" was not added.`],
    }
  }

  const compilerIndex = masked.indexOf('"compilerOptions"')
  const compilerSpan = compilerIndex === -1 ? null : objectSpan(masked, compilerIndex)
  if (!compilerSpan) {
    return {
      source,
      changes,
      declined: [
        `${label} has no compilerOptions object, so "${specifier}" was not added. Add "paths": { "${specifier}": ["${target}"] } to compilerOptions by hand.`,
      ],
    }
  }

  const pathsIndex = memberKeyIndex(masked, compilerSpan.open, compilerSpan.close, 'paths')
  if (pathsIndex === -1) {
    return {
      source,
      changes,
      declined: [
        `${label} defines no compilerOptions.paths, so "${specifier}" was not added. Adding one here would replace any paths inherited through "extends" rather than extend them, which would break every @/ import in the project. Add "${specifier}": ["${target}"] to the paths object that does define "@/*".`,
      ],
    }
  }

  const pathsSpan = objectSpan(masked, pathsIndex)
  if (!pathsSpan) {
    return {
      source,
      changes,
      declined: [
        `${label} has a compilerOptions.paths that is not an object, so "${specifier}" was not added.`,
      ],
    }
  }

  // Already mapped. Return the source untouched so a second run is a no-op even
  // before the patch set compares contents.
  if (memberKeyIndex(masked, pathsSpan.open, pathsSpan.close, specifier) !== -1) {
    return { source, changes, declined: [] }
  }

  const entry = `"${specifier}": ["${target}"]`
  const body = masked.slice(pathsSpan.open + 1, pathsSpan.close)
  const isEmpty = body.trim() === ''
  const multiline = body.includes('\n')

  let insertion: string
  if (isEmpty) {
    insertion = multiline
      ? `\n${indentOfLine(source, pathsSpan.open)}  ${entry}\n${indentOfLine(source, pathsSpan.open)}`
      : ` ${entry} `
  } else if (multiline) {
    const firstMember = pathsSpan.open + 1 + (body.length - body.trimStart().length)
    insertion = `\n${indentOfLine(source, firstMember)}${entry},`
  } else {
    insertion = ` ${entry},`
  }

  const patched =
    source.slice(0, pathsSpan.open + 1) +
    insertion +
    (isEmpty ? source.slice(pathsSpan.close) : source.slice(pathsSpan.open + 1))

  changes.push(
    `mapped ${specifier} to ${target} in ${label}, so lib/config.ts resolves the config from a src/ layout`,
  )

  return { source: patched, changes, declined: [] }
}
