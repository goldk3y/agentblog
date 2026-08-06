#!/usr/bin/env node
/**
 * Assert the built catalog meets the shadcn registry-directory rules.
 *
 * ===========================================================================
 * THE FAILURE MODE THIS CATCHES
 * ===========================================================================
 * Getting listed in the shadcn registry directory is the precondition for every
 * discovery claim AgentBlog makes: without a listing, nothing resolves
 * `@agentblog/blog` unless the user already typed the namespace into their own
 * `components.json`, and the shadcn MCP server only sees registries that are
 * already in that file. The listing is a third-party PR with review latency.
 *
 * The directory's requirements are checked by a validator we do not run and
 * cannot see. If `shadcn build` output stops meeting them, we find out weeks
 * later, in someone else's review queue, on the one task in the plan with the
 * longest turnaround. Nothing local goes red. The build succeeds. The site
 * deploys. The registry installs fine for anyone who already knows the name.
 *
 * Verbatim requirements, from the registry-directory docs:
 *
 *   2. valid JSON conforming to the registry schema
 *   3. flat: `/registry.json` and `/component-name.json` at the registry root,
 *      with no nested items
 *   4. "The `files` array, if present, must NOT include a `content` property"
 *
 * Requirement 4 reads like it conflicts with `shadcn build`, which inlines
 * `content` into every emitted item. Measured against shadcn 4.16.2: the CATALOG
 * (`public/r/registry.json`) legitimately omits `content` while the per-item
 * JSONs carry it. So rule 4 constrains the catalog only, and this script asserts
 * exactly that rather than the stricter reading, which would be unimplementable.
 *
 * Run after `shadcn build`.
 *
 * Usage:
 *   node scripts/assert-catalog-shape.mjs [path/to/public/r]
 *
 * @see https://agentblog.dev/docs/installation
 * @see BUILD-SPEC section 12
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = resolve(ROOT, process.argv[2] ?? 'apps/web/public/r')
const catalogPath = join(outDir, 'registry.json')

/** Top-level keys the registry schema allows on a catalog. */
const ALLOWED_CATALOG_KEYS = new Set([
  '$schema',
  'name',
  'homepage',
  'include',
  'items',
  'pagination',
])

/** Every `type` the shadcn 4.16.2 item enum accepts. */
const ITEM_TYPES = new Set([
  'registry:lib',
  'registry:block',
  'registry:component',
  'registry:ui',
  'registry:hook',
  'registry:theme',
  'registry:page',
  'registry:file',
  'registry:style',
  'registry:base',
  'registry:font',
  'registry:item',
])

const errors = []
const notes = []

const error = (message, detail) => errors.push({ message, detail })

function main() {
  if (!existsSync(catalogPath)) {
    console.error('assert-catalog-shape: FAIL\n')
    console.error(`  No catalog at ${catalogPath}`)
    console.error('  Run `pnpm --filter @agentblog/web registry:build` first.')
    process.exit(1)
  }

  const raw = readFileSync(catalogPath, 'utf8')

  let catalog
  try {
    catalog = JSON.parse(raw)
  } catch (e) {
    console.error('assert-catalog-shape: FAIL\n')
    console.error(`  ${catalogPath} is not valid JSON.`)
    console.error(`  ${e.message}`)
    process.exit(1)
  }

  console.log('assert-catalog-shape')
  console.log(`  catalog: ${catalogPath}`)

  /* ---- requirement 2: shape ------------------------------------------- */

  for (const key of Object.keys(catalog)) {
    if (!ALLOWED_CATALOG_KEYS.has(key)) {
      error(
        `Catalog has an unknown top-level key: "${key}"`,
        'The registry schema does not set additionalProperties: false, so neither ' +
          'the published schema nor `shadcn registry validate` rejects this. The ' +
          'directory validator may. Remove it or add it to ALLOWED_CATALOG_KEYS here ' +
          'once the schema grows it.',
      )
    }
  }

  if (typeof catalog.name !== 'string' || catalog.name.length === 0) {
    error('Catalog has no `name`.', 'Required when a registry.json is used as the root registry.')
  }
  if (typeof catalog.homepage !== 'string' || catalog.homepage.length === 0) {
    error('Catalog has no `homepage`.', 'Required for the root registry.')
  }

  if (Array.isArray(catalog.include) && catalog.include.length > 0) {
    error(
      'The built catalog still has an `include` array.',
      '`shadcn build` is supposed to resolve includes into a single flat `items` ' +
        'array. An `include` surviving into public/r means the build did not run, ' +
        'or ran against the wrong file. A consumer fetching this catalog would have ' +
        'to fetch the chunks too, which the directory does not support.',
    )
  }

  if (!Array.isArray(catalog.items)) {
    error(
      'Catalog has no `items` array.',
      'The catalog is the flat index. Without it there is nothing to list.',
    )
    report()
    return
  }

  console.log(`  items:   ${catalog.items.length}`)

  /* ---- requirement 3: flat, and every item has its own file ------------ */

  const seen = new Map()
  const emitted = new Set(
    readdirSync(outDir)
      .filter((f) => f.endsWith('.json') && f !== 'registry.json')
      .map((f) => f.slice(0, -'.json'.length)),
  )

  for (const [index, item] of catalog.items.entries()) {
    const where = `items[${index}]`

    if (typeof item?.name !== 'string' || item.name.length === 0) {
      error(`${where} has no \`name\`.`, 'Required by the registry-item schema.')
      continue
    }
    const at = `items[${index}] "${item.name}"`

    if (seen.has(item.name)) {
      error(
        `${at} duplicates the name used by items[${seen.get(item.name)}].`,
        'Item names address a single URL, so a duplicate means one of the two is ' +
          'unreachable and which one wins is build-order dependent.',
      )
    }
    seen.set(item.name, index)

    if (item.name.includes('/')) {
      error(
        `${at} has a slash in its name.`,
        'Requirement 3 is a flat layout: /registry.json and /item-name.json at the ' +
          'registry root. A slash implies a nested path, which the directory rejects.',
      )
    }

    if (!ITEM_TYPES.has(item.type)) {
      error(
        `${at} has type "${item.type}", which is not in the shadcn 4.16.2 enum.`,
        `Allowed: ${[...ITEM_TYPES].join(', ')}`,
      )
    }

    if (!emitted.has(item.name)) {
      error(
        `${at} has no ${item.name}.json next to the catalog.`,
        'The catalog advertises an item that cannot be fetched. `shadcn add` against ' +
          'that name 404s for every consumer.',
      )
    }

    if (typeof item.description !== 'string' || item.description.length === 0) {
      notes.push(
        `${at} has no \`description\`. Registry metadata is read by LLMs before it is ` +
          'read by people, and an item with no description is an item an agent will not choose.',
      )
    }

    /* ---- requirement 4: no `content` in the catalog -------------------- */

    if (item.files === undefined) continue

    if (!Array.isArray(item.files)) {
      error(`${at} has a \`files\` property that is not an array.`, '')
      continue
    }

    for (const [fileIndex, file] of item.files.entries()) {
      const fileAt = `${at} files[${fileIndex}]`

      if (Object.hasOwn(file ?? {}, 'content')) {
        error(
          `${fileAt} has a \`content\` property.`,
          'Registry directory requirement 4 forbids `content` in the catalog. Measured ' +
            'against shadcn 4.16.2, the catalog omits it while the per-item JSON carries ' +
            'it, so this appearing here means the build changed or the file was written ' +
            'by something other than `shadcn build`. A catalog with every source file ' +
            'inlined is also enormous, which is the practical reason the rule exists.',
        )
      }

      if (typeof file?.path !== 'string' || file.path.length === 0) {
        error(`${fileAt} has no \`path\`.`, 'Required by the registry-item schema.')
      }

      if (
        (file?.type === 'registry:file' || file?.type === 'registry:page') &&
        typeof file?.target !== 'string'
      ) {
        error(
          `${fileAt} is ${file.type} but has no \`target\`.`,
          'The schema requires a target for these two types. Without it the file lands ' +
            'nowhere and `shadcn add` reports success anyway.',
        )
      }
    }
  }

  /* ---- orphans ---------------------------------------------------------- */

  for (const name of emitted) {
    if (!seen.has(name)) {
      notes.push(
        `${name}.json is emitted but not listed in the catalog. It is installable by ` +
          'anyone who knows the name, and invisible to search and to the MCP server.',
      )
    }
  }

  report()
}

function report() {
  for (const note of notes) console.log(`  note: ${note}`)

  if (errors.length === 0) {
    console.log('  flat layout, no `content` in the catalog, every item fetchable. OK')
    return
  }

  console.error(`\nassert-catalog-shape: FAIL (${errors.length} problem(s))\n`)
  for (const { message, detail } of errors) {
    console.error(`  ${message}`)
    if (detail) console.error(`    ${detail}`)
    console.error('')
  }
  console.error('  These are the shadcn registry-directory requirements. Failing them does')
  console.error('  not break a local install, it blocks or reverts the directory listing,')
  console.error('  which is what makes `@agentblog/*` resolvable without hand configuration.')
  process.exit(1)
}

main()
