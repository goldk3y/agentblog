/**
 * Resolve the `@/` alias for `node --test`.
 *
 * The registry block is authored exactly as a consumer sees it, with `@/` imports
 * resolved by `tsconfig.json` paths. Node does not read tsconfig paths, so this
 * hook teaches the loader the same two mappings the bundler already knows:
 *
 *   `@/lib/schemas` and `@/lib/types`  ->  packages/schema/src/*.ts
 *   everything else under `@/`         ->  apps/web/registry/blog/*.ts
 *
 * The first mapping is not a shortcut. In a consumer's repo those two modules are
 * verbatim copies of the schema package produced by `scripts/codegen.mjs`, with an
 * `import 'server-only'` banner added. Pointing the test at the originals tests the
 * same code without pulling `server-only` into plain Node, where it throws by
 * design.
 *
 * Registered with `node --test --import ./tests/alias-hook.mjs`.
 */
import { registerHooks } from 'node:module'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const appRoot = path.resolve(import.meta.dirname, '..')
const registryRoot = path.join(appRoot, 'registry', 'blog')
const schemaSrc = path.resolve(appRoot, '..', '..', 'packages', 'schema', 'src')

const exact = new Map([
  ['@/lib/schemas', path.join(schemaSrc, 'schemas.ts')],
  ['@/lib/types', path.join(schemaSrc, 'types.ts')],
  ['@/lib/define-config', path.join(schemaSrc, 'define-config.ts')],
])

registerHooks({
  resolve(specifier, context, nextResolve) {
    const override = exact.get(specifier)
    if (override) return { url: pathToFileURL(override).href, shortCircuit: true }

    if (specifier.startsWith('@/')) {
      const target = path.join(registryRoot, `${specifier.slice(2)}.ts`)
      return { url: pathToFileURL(target).href, shortCircuit: true }
    }

    return nextResolve(specifier, context)
  },
})
