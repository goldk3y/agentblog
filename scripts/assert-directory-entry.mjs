#!/usr/bin/env node
/**
 * Assert `shadcn-directory-entry.json` still describes the registry we deploy.
 *
 * ===========================================================================
 * THE FAILURE MODE THIS CATCHES
 * ===========================================================================
 * Being listed in the shadcn registry directory is what makes `@agentblog`
 * resolve for someone who has never heard the name. Measured against shadcn
 * 4.16.1, an unlisted namespace does not resolve at all: `shadcn search
 * @agentblog` in a project that has not already written the URL into its own
 * `components.json` fails with "Unknown registry". Every discovery claim in the
 * README depends on that listing existing.
 *
 * The listing lives in somebody else's repository. Once merged, nothing in this
 * repository is coupled to it, and nothing here goes red when the two disagree.
 * If the deploy moves off `agentblog.dev`, or `shadcn build` starts writing
 * somewhere other than `public/r`, the directory keeps pointing at the old URL
 * and the only symptom is `shadcn add @agentblog/blog` failing on a stranger's
 * machine, once, with a 404 they will not report.
 *
 * So this script pins the entry to the two files that decide those URLs, and
 * `--live` re-checks the deployment itself.
 *
 * ---------------------------------------------------------------------------
 * WHAT THE DIRECTORY ACTUALLY VALIDATES
 * ---------------------------------------------------------------------------
 * Their gate is `apps/v4/scripts/validate-registries.mts`, and it is five
 * fields: `name` matching /^@[a-zA-Z0-9][a-zA-Z0-9-_]*$/, `homepage` as a URL,
 * `url` containing the literal `{name}`, `description` as a string, and `logo`
 * as a string. That is a low bar and passing it is not the interesting part.
 * The reviewable part is the prose requirements, which no validator reads:
 *
 *   1. the registry must be open source and publicly accessible
 *   2. valid JSON conforming to the registry schema
 *   3. flat: `/registry.json` and `/component-name.json` at the registry root
 *   4. "The `files` array, if present, must NOT include a `content` property"
 *
 * Requirements 2 through 4 are asserted against the built output by
 * `assert-catalog-shape.mjs` and `assert-schema-valid.mjs`. This script covers
 * the entry itself and the agreement between the entry and the build.
 *
 * Usage:
 *   node scripts/assert-directory-entry.mjs [--live]
 *
 * @see https://ui.shadcn.com/docs/registry/registry-index
 * @see scripts/assert-catalog-shape.mjs
 */
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ENTRY_PATH = join(ROOT, 'shadcn-directory-entry.json')
const REGISTRY_PATH = join(ROOT, 'registry.json')
const COMPONENTS_PATH = join(ROOT, 'apps/web/components.json')

/** The exact key set `validate-registries.mts` parses. Anything else is a typo. */
const REQUIRED_KEYS = ['name', 'homepage', 'url', 'description', 'logo']

/** Verbatim from `registryEntrySchema` in `validate-registries.mts`. */
const NAME_PATTERN = /^@[a-zA-Z0-9][a-zA-Z0-9-_]*$/

/**
 * Descriptions render in a directory of several hundred registries, in a card
 * that does not grow. The longest one shipped today is 355 characters, so that
 * is the ceiling a reviewer has already accepted rather than a guess.
 */
const DESCRIPTION_MAX = 355

const problems = []
const fail = (message) => problems.push(message)

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'))

/* -------------------------------------------------------------------------- */
/*  The entry, against the directory's own schema                             */
/* -------------------------------------------------------------------------- */

const entry = readJson(ENTRY_PATH)

const keys = Object.keys(entry).sort()
const expected = [...REQUIRED_KEYS].sort()
if (keys.join() !== expected.join()) {
  fail(
    `keys are ${keys.join(', ')}. The directory reads exactly ` +
      `${expected.join(', ')}, and silently ignores anything else, so an extra ` +
      `key is a field that never arrives.`,
  )
}

if (typeof entry.name !== 'string' || !NAME_PATTERN.test(entry.name)) {
  fail(`name ${JSON.stringify(entry.name)} does not match ${NAME_PATTERN}.`)
}

if (!entry.url?.includes('{name}')) {
  fail('url has no {name} placeholder, which is the one thing their validator checks it for.')
}

if (typeof entry.description !== 'string' || entry.description.length === 0) {
  fail('description is empty. It is the only sentence a reader gets in the directory.')
}

if (entry.description?.length > DESCRIPTION_MAX) {
  fail(
    `description is ${entry.description.length} characters, over the ${DESCRIPTION_MAX} ceiling.`,
  )
}

if (typeof entry.logo !== 'string' || !entry.logo.trimStart().startsWith('<svg')) {
  fail('logo must be an inline SVG string. Every one of the listed registries is.')
}

if (entry.logo?.includes('\n')) {
  fail('logo contains a newline. It is pasted into a one line JSON value.')
}

for (const field of ['homepage', 'url']) {
  const value = entry[field]
  if (typeof value !== 'string') continue
  try {
    const parsed = new URL(value.replace('{name}', 'registry'))
    if (parsed.protocol !== 'https:') fail(`${field} is not https.`)
  } catch {
    fail(`${field} ${JSON.stringify(value)} is not a URL.`)
  }
}

/* -------------------------------------------------------------------------- */
/*  Agreement with the registry we actually build and the namespace we ship    */
/* -------------------------------------------------------------------------- */

const registry = readJson(REGISTRY_PATH)

if (entry.name !== `@${registry.name}`) {
  fail(
    `entry name ${entry.name} does not match registry.json name ${registry.name}. ` +
      'The directory key and the registry key are the same identity.',
  )
}

if (entry.homepage !== registry.homepage) {
  fail(`entry homepage ${entry.homepage} does not match registry.json ${registry.homepage}.`)
}

/**
 * `apps/web/components.json` is the dogfood consumer, so its `registries` entry
 * is the URL template we prove works on every build. If the directory advertises
 * a different one, one of the two is wrong and it is not the one under test.
 */
const components = readJson(COMPONENTS_PATH)
const dogfood = components.registries?.[entry.name]

if (!dogfood) {
  fail(`apps/web/components.json does not register ${entry.name}, so nothing here exercises it.`)
} else if (dogfood !== entry.url) {
  fail(`entry url ${entry.url} does not match the dogfood template ${dogfood}.`)
}

/* -------------------------------------------------------------------------- */
/*  The deployment, on request                                                 */
/* -------------------------------------------------------------------------- */

const live = process.argv.includes('--live')

if (live && problems.length === 0) {
  const catalogUrl = entry.url.replace('{name}', 'registry')
  const response = await fetch(catalogUrl)

  if (!response.ok) {
    fail(`GET ${catalogUrl} returned ${response.status}. The directory would point at a 404.`)
  } else {
    const catalog = await response.json()
    const names = (catalog.items ?? []).map((item) => item.name)

    if (names.length === 0) fail(`${catalogUrl} has no items.`)

    // Requirement 3 is about resolution, not about the catalog alone: every
    // name in it has to be fetchable at the same flat root.
    for (const name of names) {
      const itemUrl = entry.url.replace('{name}', name)
      const head = await fetch(itemUrl, { method: 'HEAD' })
      if (!head.ok) fail(`GET ${itemUrl} returned ${head.status}, but the catalog lists it.`)
    }

    console.log(`  live:     ${catalogUrl} serves ${names.length} item(s), all fetchable`)
  }
}

/* -------------------------------------------------------------------------- */

console.log('assert-directory-entry')
console.log(`  entry:    ${entry.name} -> ${entry.url}`)
console.log(`  checked:  ${live ? 'schema, agreement, deployment' : 'schema, agreement'}`)

if (problems.length > 0) {
  console.log('')
  console.log(`assert-directory-entry: FAIL (${problems.length} problem(s))`)
  console.log('')
  for (const problem of problems) console.log(`  ${problem}`)
  console.log('')
  console.log('  The entry is submitted to shadcn-ui/ui and reviewed by hand, so a')
  console.log('  mistake here costs a review cycle rather than a redeploy.')
  process.exit(1)
}

if (!live) console.log('  pass --live to also check the deployed registry responds.')
console.log('  entry matches the registry it advertises. OK')
