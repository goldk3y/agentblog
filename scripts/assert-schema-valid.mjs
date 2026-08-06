#!/usr/bin/env node
/**
 * Validate every emitted registry JSON against the published shadcn schemas.
 *
 * ===========================================================================
 * THE FAILURE MODE THIS CATCHES
 * ===========================================================================
 * A malformed registry item does not fail our build. It fails on a stranger's
 * machine, once, at `shadcn add`, with a message about our JSON rather than
 * their project. They do not file an issue. They move on.
 *
 * The schemas are vendored into `scripts/schemas/` rather than fetched, so CI
 * has no network dependency and so a schema change upstream shows up as a
 * deliberate commit here with a diff someone read.
 *
 *   Fetched 2026-08-06 from:
 *     https://ui.shadcn.com/schema/registry-item.json
 *     https://ui.shadcn.com/schema/registry.json
 *   shadcn CLI at the time: 4.16.2
 *
 * ---------------------------------------------------------------------------
 * SCHEMA VALIDATION ALONE IS NOT A SUFFICIENT GATE
 * ---------------------------------------------------------------------------
 * Neither published schema sets `additionalProperties: false`. A typo in a key
 * name (`registryDependancies`, `titel`, `dependecies`) is therefore VALID
 * against the schema, and the field it was supposed to be is simply absent. The
 * item installs, quietly missing its dependencies.
 *
 * So `shadcn registry validate` must run too. It checks include rules and file
 * existence, which no JSON Schema can express, and it is strictly more useful
 * than this script. This one catches type and enum errors early and cheaply, in
 * a job that does not need the shadcn CLI. Both, always. Neither replaces the
 * other, and the CI pipeline runs them in that order.
 *
 * Usage:
 *   node scripts/assert-schema-valid.mjs [path/to/public/r]
 *
 * @see https://agentblog.dev/docs/../CONTRIBUTING.md
 * @see BUILD-SPEC section 12
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = resolve(ROOT, process.argv[2] ?? 'apps/web/public/r')
const SCHEMA_DIR = join(ROOT, 'scripts/schemas')

const ITEM_SCHEMA_ID = 'https://ui.shadcn.com/schema/registry-item.json'

const require = createRequire(import.meta.url)

let Ajv
try {
  Ajv = require('ajv')
  if (Ajv.default) Ajv = Ajv.default
} catch {
  console.error('assert-schema-valid: FAIL\n')
  console.error('  `ajv` is not installed. It is a root devDependency.')
  console.error('  Run `pnpm install`.')
  process.exit(1)
}

function main() {
  if (!existsSync(outDir)) {
    console.error('assert-schema-valid: FAIL\n')
    console.error(`  No registry output at ${outDir}`)
    console.error('  Run `pnpm --filter @agentblog/web registry:build` first.')
    process.exit(1)
  }

  /**
   * Both vendored schemas declare draft-07 over https. Ajv registers its
   * draft-07 meta schema under the http id, which is the canonical one, so it
   * refuses the https spelling with "no schema with key or ref". Normalizing the
   * declaration is preferable to editing the vendored files, which have to stay
   * byte-identical to what ui.shadcn.com serves for the diff to mean anything.
   */
  const loadSchema = (file) => {
    const schema = JSON.parse(readFileSync(join(SCHEMA_DIR, file), 'utf8'))
    if (typeof schema.$schema === 'string' && schema.$schema.includes('draft-07')) {
      schema.$schema = 'http://json-schema.org/draft-07/schema#'
    }
    return schema
  }

  const itemSchema = loadSchema('registry-item.schema.json')
  const registrySchema = loadSchema('registry.schema.json')

  // `strict: false` because these are third-party schemas we do not control and
  // must not edit. allErrors so one run reports everything wrong with an item
  // rather than the first thing.
  const ajv = new Ajv({ strict: false, allErrors: true, allowUnionTypes: true })

  // The catalog schema $refs the item schema by its published URL. Registering
  // it under that id is what keeps validation offline.
  ajv.addSchema(itemSchema, ITEM_SCHEMA_ID)

  const validateItem = ajv.compile(itemSchema)
  const validateRegistry = ajv.compile(registrySchema)

  const files = readdirSync(outDir)
    .filter((f) => f.endsWith('.json'))
    .sort()

  if (files.length === 0) {
    console.error('assert-schema-valid: FAIL\n')
    console.error(`  ${outDir} has no JSON files. The registry build produced nothing.`)
    process.exit(1)
  }

  console.log('assert-schema-valid')
  console.log(`  output:  ${relative(ROOT, outDir)}`)
  console.log(`  schemas: vendored, fetched 2026-08-06 from ui.shadcn.com`)

  let failed = 0

  for (const file of files) {
    const full = join(outDir, file)
    const isCatalog = file === 'registry.json'

    let json
    try {
      json = JSON.parse(readFileSync(full, 'utf8'))
    } catch (error) {
      console.error(`\n  ${file}: not valid JSON`)
      console.error(`    ${error.message}`)
      failed += 1
      continue
    }

    const validate = isCatalog ? validateRegistry : validateItem
    if (validate(json)) {
      console.log(`  ok ${file}${isCatalog ? ' (catalog)' : ` (${json.type})`}`)
      continue
    }

    failed += 1
    console.error(`\n  ${file}: ${validate.errors.length} schema error(s)`)
    for (const error of validate.errors) {
      const at = error.instancePath || '(root)'
      console.error(`    ${at} ${error.message}`)
      if (error.params && Object.keys(error.params).length > 0) {
        console.error(`      ${JSON.stringify(error.params)}`)
      }
    }
  }

  if (failed > 0) {
    console.error(`\nassert-schema-valid: FAIL (${failed} file(s))\n`)
    console.error('  These files are what `shadcn add` fetches. An invalid item fails on a')
    console.error("  stranger's machine with a message about our JSON, and they do not file")
    console.error('  an issue about it.')
    console.error('')
    console.error('  Remember that neither schema sets additionalProperties: false, so a')
    console.error('  misspelled key passes this check while doing nothing. Run')
    console.error('  `shadcn registry validate` as well. It is the stricter gate.')
    process.exit(1)
  }

  console.log(`  ${files.length} file(s) valid.`)
  console.log('  Note: schema validation is necessary and not sufficient. Neither schema')
  console.log('  sets additionalProperties: false, so `shadcn registry validate` must run too.')
}

main()
