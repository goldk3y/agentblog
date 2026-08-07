#!/usr/bin/env node
/**
 * Assert the file count the documentation advertises matches the registry.
 *
 * ===========================================================================
 * THE FAILURE MODE THIS CATCHES
 * ===========================================================================
 * The README, the landing page, and the docs introduction all tell a reader how
 * many files `@agentblog/blog` writes into their project. That number is a
 * promise about the size of the thing they are about to install, and it is the
 * kind of number that is correct on the day it is written and wrong a month
 * later, because adding one route file to a registry item does not remind
 * anybody that three Markdown files quote a total.
 *
 * It went wrong exactly that way once already: the docs said forty when the real
 * count was seventy, and the same figure was doing double duty as the "about
 * forty separate things you have to get right" line in the problem statement, so
 * the two drifted together and neither read as a mistake.
 *
 * Nothing else notices. It is prose, so it compiles, lints, and renders.
 *
 * Usage:
 *   node scripts/assert-file-count.mjs
 *
 * The count is resolved from the registry source rather than from the built
 * output, so this runs without `shadcn build` and cannot be fooled by a stale
 * `public/r`.
 */
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** Chunk registries that contribute items to the published catalog. */
const CHUNKS = [
  'apps/web/registry/blog/registry.json',
  'apps/web/registry/agent/registry.json',
  'apps/web/registry/theme/registry.json',
]

/** The item a consumer installs, and the entry point for the dependency walk. */
const ENTRY = 'blog'

/**
 * Files that AgentBlog writes but that a reader would not count as "files you
 * get". Nothing is excluded today; the list exists so that a future exclusion
 * has to be written down and justified rather than applied silently.
 */
const NOT_COUNTED = []

/**
 * Every place the count appears in prose, with the pattern that finds it.
 *
 * Add a row when you quote the number somewhere new. A row whose pattern matches
 * nothing is reported as an error rather than skipped, because a silently
 * unmatched pattern is how this check would stop protecting a file.
 */
const CLAIM_SITES = [
  { path: 'README.md', pattern: /(\d+)\s+files\b/g },
  { path: 'apps/web/app/(marketing)/page.tsx', pattern: /(\d+)\s+files,/g },
  { path: 'apps/docs/content/docs/index.mdx', pattern: /writes\s+(\d+)\s+files/g },
  { path: 'apps/docs/content/docs/reference/files.mdx', pattern: /the\s+(\d+)\s+files/g },
]

function loadItems() {
  const items = new Map()
  for (const chunk of CHUNKS) {
    const registry = JSON.parse(readFileSync(join(ROOT, chunk), 'utf8'))
    for (const item of registry.items ?? []) items.set(item.name, item)
  }
  return items
}

/** Resolve `blog` through `registryDependencies`, collecting unique targets. */
function resolveTargets(items) {
  const seen = new Set()
  const targets = new Set()
  const unknown = new Set()

  const walk = (name) => {
    if (seen.has(name)) return
    seen.add(name)

    const item = items.get(name)
    if (!item) {
      // A bare name is a shadcn built-in (`card`, `button`). Those resolve
      // against the consumer's own configuration and are not ours to count.
      if (name.startsWith('@agentblog/')) unknown.add(name)
      return
    }

    for (const file of item.files ?? []) {
      const target = file.target ?? file.path
      if (!NOT_COUNTED.includes(target)) targets.add(target)
    }
    for (const dependency of item.registryDependencies ?? []) {
      walk(dependency.replace(/^@agentblog\//, ''))
    }
  }

  walk(ENTRY)
  return { targets, unknown }
}

function main() {
  console.log('assert-file-count')

  const items = loadItems()
  const { targets, unknown } = resolveTargets(items)

  if (unknown.size > 0) {
    console.error('\nassert-file-count: FAIL\n')
    console.error('  These registryDependencies name no item in any chunk:')
    for (const name of [...unknown].sort()) console.error(`    ${name}`)
    console.error('')
    console.error('  `shadcn registry validate` does not resolve cross-item dependencies, so an')
    console.error('  install would fail at fetch time with a 404 rather than here.')
    process.exit(1)
  }

  const actual = targets.size
  console.log(`  registry: ${actual} unique file target(s) reachable from @agentblog/${ENTRY}`)

  const problems = []
  for (const site of CLAIM_SITES) {
    const source = readFileSync(join(ROOT, site.path), 'utf8')
    site.pattern.lastIndex = 0

    let match
    let found = 0
    while ((match = site.pattern.exec(source)) !== null) {
      found += 1
      const claimed = Number(match[1])
      if (claimed !== actual) {
        problems.push(`${site.path}: says ${claimed}, registry has ${actual}`)
      }
    }

    if (found === 0) {
      problems.push(
        `${site.path}: the count is not stated any more, or the wording changed so this ` +
          'check can no longer find it. Update CLAIM_SITES rather than deleting the row.',
      )
    }
  }

  if (problems.length > 0) {
    console.error('\nassert-file-count: FAIL\n')
    for (const problem of problems) console.error(`  ${problem}`)
    console.error('')
    console.error('  The count is a promise about how much code a reader is about to accept into')
    console.error('  their repository. Update the prose, or explain the exclusion in NOT_COUNTED.')
    process.exit(1)
  }

  console.log(`  ${CLAIM_SITES.length} documentation claim(s) agree. OK`)
}

main()
