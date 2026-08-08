#!/usr/bin/env node
/**
 * Assert no client component reaches server-only code, transitively.
 *
 * ===========================================================================
 * THE FAILURE MODE THIS CATCHES
 * ===========================================================================
 * Zod never needs to reach the browser in AgentBlog. Content is validated at
 * build time or in a route handler, never at render time in a client component.
 * `lib/schemas.ts`, `lib/config.ts`, `lib/define-config.ts`, and `lib/posts.ts`
 * all carry `import 'server-only'`, which turns a client import of any of them
 * into a build error rather than a quietly larger bundle.
 *
 * So the build does catch this. The problem is what the build says when it does:
 * a `server-only` violation surfaces as a module resolution error deep inside a
 * generated chunk, naming a file the developer did not import, in a project that
 * is not ours. In a consumer's repository, after they added one `'use client'`
 * to a component that was working a minute ago, that error is close to
 * unreadable.
 *
 * This script fails first, with the whole import chain, in our repository,
 * before anything ships. The point is not to catch a bug the compiler misses.
 * It is to catch it while the message can still be comprehensible.
 *
 * Resolution is fully transitive with a cycle guard, not one level deep. Two
 * levels would be enough for the shapes we ship today, and the regression this
 * guards against is exactly the one where someone adds a third.
 *
 * Usage:
 *   node scripts/assert-no-server-only-in-client.mjs [registry/blog dir]
 *
 * @see CONTRIBUTING.md, "Zod stays on the server"
 * @see https://docs.agentblog.dev/reference/content-sources
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const blockDir = resolve(ROOT, process.argv[2] ?? 'apps/web/registry/blog')

/** Bare specifiers that must never be reachable from a client component. */
const FORBIDDEN_BARE = new Set(['zod', 'server-only', 'gray-matter', 'node:fs', 'fs'])

/** Aliased modules that must never be reachable from a client component. */
const FORBIDDEN_ALIASES = new Set([
  '@/lib/config',
  '@/lib/schemas',
  '@/lib/posts',
  '@/lib/define-config',
  '@/agentblog.config',
])

/**
 * The importable package a specifier belongs to.
 *
 * `zod/v4` is `zod`. `node:fs/promises` is `node:fs`. `@scope/pkg/deep` is
 * `@scope/pkg`. A relative or aliased path is returned unchanged, because those
 * are matched against `FORBIDDEN_ALIASES` instead.
 */
function packageRoot(specifier) {
  if (specifier.startsWith('.') || specifier.startsWith('@/') || specifier.startsWith('~/')) {
    return specifier
  }
  const parts = specifier.split('/')
  if (specifier.startsWith('node:')) return parts[0]
  if (specifier.startsWith('@')) return parts.slice(0, 2).join('/')
  return parts[0]
}

const SOURCE_EXTENSIONS = ['.ts', '.tsx']
const SKIP_DIRS = new Set(['node_modules', '.next', 'dist', '.turbo', 'content'])

const rel = (p) => relative(ROOT, p).split(sep).join('/')

/* -------------------------------------------------------------------------- */

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue
      walk(full, out)
      continue
    }
    if (entry.isFile() && SOURCE_EXTENSIONS.some((e) => entry.name.endsWith(e))) out.push(full)
  }
  return out
}

/**
 * Replace every comment with spaces, preserving offsets.
 *
 * Without this a commented-out `// import { z } from 'zod'` fails the gate, and a
 * check that fails on code nobody ships is a check people learn to override.
 */
function blankComments(source) {
  let out = ''
  let i = 0
  let inString = null
  while (i < source.length) {
    const ch = source[i]
    const next = source[i + 1]
    if (inString) {
      if (ch === '\\') {
        out += ch + (next ?? '')
        i += 2
        continue
      }
      if (ch === inString) inString = null
      out += ch
      i += 1
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      inString = ch
      out += ch
      i += 1
      continue
    }
    if (ch === '/' && next === '/') {
      while (i < source.length && source[i] !== '\n') {
        out += ' '
        i += 1
      }
      continue
    }
    if (ch === '/' && next === '*') {
      while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) {
        out += source[i] === '\n' ? '\n' : ' '
        i += 1
      }
      out += '  '
      i += 2
      continue
    }
    out += ch
    i += 1
  }
  return out
}

/** Every static import, re-export, and dynamic import specifier in a file. */
function specifiersOf(rawSource) {
  const source = blankComments(rawSource)
  const found = new Set()
  const patterns = [
    /import\s+[^'"]*from\s*['"]([^'"]+)['"]/g,
    /import\s*['"]([^'"]+)['"]/g,
    /export\s+[^'"]*from\s*['"]([^'"]+)['"]/g,
    /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ]
  for (const pattern of patterns) {
    let match
    while ((match = pattern.exec(source)) !== null) found.add(match[1])
  }
  return [...found]
}

/**
 * Resolve a specifier to a file inside the block, or null when it leaves it.
 *
 * `@/` is the alias every shipped file uses, and it points at the block root
 * because that is exactly what the block becomes in a consumer's project.
 */
function resolveSpecifier(specifier, fromFile) {
  let base
  if (specifier.startsWith('@/')) {
    base = join(blockDir, specifier.slice(2))
  } else if (specifier.startsWith('.')) {
    base = resolve(dirname(fromFile), specifier)
  } else {
    return null
  }

  const candidates = [
    base,
    ...SOURCE_EXTENSIONS.map((e) => base + e),
    ...SOURCE_EXTENSIONS.map((e) => join(base, `index${e}`)),
  ]
  for (const candidate of candidates) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate
  }
  return null
}

const hasUseClient = (source) => /^\s*['"]use client['"]/m.test(source)
const hasServerOnly = (source) => /import\s*['"]server-only['"]/.test(source)

/* -------------------------------------------------------------------------- */

const violations = []

/** Breadth-first walk from a client entry point, keeping the path that found it. */
function inspect(entry, cache) {
  const queue = [[entry]]
  const visited = new Set([entry])

  while (queue.length > 0) {
    const chain = queue.shift()
    const current = chain[chain.length - 1]

    let source = cache.get(current)
    if (source === undefined) {
      source = readFileSync(current, 'utf8')
      cache.set(current, source)
    }

    if (current !== entry && hasServerOnly(source)) {
      violations.push({
        entry,
        chain,
        reason: `${rel(current)} carries \`import 'server-only'\``,
      })
    }

    for (const specifier of specifiersOf(source)) {
      // Compare on the package root, not the whole specifier. `zod/v4` and
      // `gray-matter/lib/index.js` are the same dependency reaching the same
      // bundle, and an exact-match set is blind to both. `node:fs/promises`
      // needs the same treatment, which is why the `node:` prefix is kept.
      if (FORBIDDEN_BARE.has(packageRoot(specifier)) || FORBIDDEN_ALIASES.has(specifier)) {
        violations.push({
          entry,
          chain: [...chain, specifier],
          reason: `\`${specifier}\` must never reach the client bundle`,
        })
        continue
      }

      const resolved = resolveSpecifier(specifier, current)
      if (!resolved || visited.has(resolved)) continue
      visited.add(resolved)
      queue.push([...chain, resolved])
    }
  }
}

function main() {
  console.log('assert-no-server-only-in-client')

  if (!existsSync(blockDir)) {
    console.log(`  ${rel(blockDir)} does not exist yet. Nothing to check.`)
    return
  }

  const files = walk(blockDir).sort()
  const cache = new Map()
  const clientFiles = files.filter((f) => {
    const source = readFileSync(f, 'utf8')
    cache.set(f, source)
    return hasUseClient(source)
  })

  console.log(`  scanned: ${files.length} file(s), ${clientFiles.length} with 'use client'`)
  for (const file of clientFiles) console.log(`    client: ${rel(file)}`)

  for (const entry of clientFiles) inspect(entry, cache)

  if (violations.length === 0) {
    console.log('  no client component reaches server-only code. OK')
    return
  }

  console.error(`\nassert-no-server-only-in-client: FAIL (${violations.length} chain(s))\n`)
  for (const v of violations) {
    console.error(`  ${v.reason}`)
    console.error('  Import chain:')
    for (const [index, step] of v.chain.entries()) {
      const label = typeof step === 'string' && step.includes(sep) ? rel(step) : step
      console.error(`    ${index === 0 ? "'use client'  " : '   imports    '} ${label}`)
    }
    console.error('')
  }
  console.error('  Fixes, in order of preference:')
  console.error('    1. Move the data access to the server component that renders this one and')
  console.error('       pass the result down as a prop. This is almost always the right answer.')
  console.error('    2. Move the shared value into a module with no server dependencies.')
  console.error('    3. Drop the `use client` directive. Most components do not need it.')
  console.error('')
  console.error('  Left alone this becomes a `server-only` build error in a consumer project,')
  console.error('  naming a generated chunk rather than the file above.')
  process.exit(1)
}

main()
