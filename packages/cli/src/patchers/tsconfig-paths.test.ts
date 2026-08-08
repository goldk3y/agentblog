/**
 * The `tsconfig.json` paths patcher.
 *
 * ===========================================================================
 * WHAT THIS FILE IS DEFENDING
 * ===========================================================================
 * A `src/` layout install used to produce a project that did not build. The
 * config file lands at the project root, `@/*` points at `src/`, and the single
 * import in `lib/config.ts` resolved to nothing:
 *
 *     Error: Module not found: Can't resolve '@/agentblog.config'
 *
 * The repair is one `paths` entry. Two properties make it safe to write into a
 * file the user owns, and both are easy to lose in a later refactor:
 *
 *   1. Comments and formatting survive. `tsconfig.json` is JSONC and is edited
 *      by hand more than almost any other file in a project, so a `JSON.parse`
 *      and `JSON.stringify` round trip would quietly delete every comment in it.
 *   2. Writing it twice is the same as writing it once, because `agentblog init`
 *      must be idempotent.
 *
 * The declines matter as much as the writes. `paths` is replaced wholesale by
 * the nearest config that defines it, so inventing one in a file that inherits
 * `"@/*"` through `extends` would break every `@/` import in the project. This
 * fixes a config import or it does nothing.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { CONFIG_PATH_TARGET, CONFIG_SPECIFIER, patchTsconfigPaths } from './tsconfig-paths.ts'

const options = { specifier: CONFIG_SPECIFIER, target: CONFIG_PATH_TARGET }
const patch = (source: string) => patchTsconfigPaths(source, 'tsconfig.json', options)

/**
 * Parse patched JSONC. `JSON.parse` rejects the comments these fixtures exist to
 * protect, so they come out first, by the crude rule that is safe here: every
 * fixture comment is a whole line of its own.
 */
const parseJsonc = (source: string) =>
  JSON.parse(
    source
      .split('\n')
      .filter((line) => !/^\s*(\/\/|\/\*)/.test(line))
      .join('\n'),
  )

/** What `create-next-app --src-dir` writes, trimmed to what matters here. */
const SRC_LAYOUT = `{
  "compilerOptions": {
    "strict": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"]
}
`

test('maps the config specifier in a src/ layout tsconfig', () => {
  const result = patch(SRC_LAYOUT)

  assert.equal(result.declined.length, 0)
  assert.equal(result.changes.length, 1)
  assert.match(result.source, /"@\/agentblog\.config": \["\.\/agentblog\.config\.ts"\]/)
  // The wildcard it overrides has to survive, or every other import breaks.
  assert.match(result.source, /"@\/\*": \["\.\/src\/\*"\]/)
  assert.deepEqual(JSON.parse(result.source).compilerOptions.paths, {
    '@/agentblog.config': ['./agentblog.config.ts'],
    '@/*': ['./src/*'],
  })
})

test('a second run changes nothing, because init must be idempotent', () => {
  const once = patch(SRC_LAYOUT).source
  const twice = patch(once)

  assert.equal(twice.source, once)
  assert.equal(twice.changes.length, 0)
  assert.equal(twice.declined.length, 0)
})

test('comments and formatting survive, because tsconfig.json is JSONC', () => {
  const commented = `{
  // The alias create-next-app writes.
  "compilerOptions": {
    /* Kept deliberately strict. */
    "strict": true,
    "paths": {
      // Everything under src.
      "@/*": ["./src/*"]
    }
  }
}
`
  const result = patch(commented)

  assert.match(result.source, /\/\/ The alias create-next-app writes\./)
  assert.match(result.source, /\/\* Kept deliberately strict\. \*\//)
  assert.match(result.source, /\/\/ Everything under src\./)
  assert.match(result.source, /"@\/agentblog\.config"/)
})

test('a comment mentioning paths or braces does not move the insertion', () => {
  const misleading = `{
  "compilerOptions": {
    // "paths": { "@/*": ["./nope/*"] } is what this used to be.
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
`
  const patched = patch(misleading).source
  assert.match(patched, /\/\/ "paths": \{ "@\/\*": \["\.\/nope\/\*"\] \} is what this used to be\./)
  assert.deepEqual(parseJsonc(patched).compilerOptions.paths, {
    '@/agentblog.config': ['./agentblog.config.ts'],
    '@/*': ['./src/*'],
  })
})

test('a single line paths object stays on one line', () => {
  const inline = `{ "compilerOptions": { "paths": { "@/*": ["./src/*"] } } }`
  const result = patch(inline)

  assert.ok(!result.source.includes('\n'), 'the patcher reformatted a single line file')
  assert.deepEqual(JSON.parse(result.source).compilerOptions.paths, {
    '@/agentblog.config': ['./agentblog.config.ts'],
    '@/*': ['./src/*'],
  })
})

test('an empty paths object is filled rather than corrupted', () => {
  const empty = `{
  "compilerOptions": {
    "paths": {}
  }
}
`
  const parsed = JSON.parse(patch(empty).source)
  assert.deepEqual(parsed.compilerOptions.paths, {
    '@/agentblog.config': ['./agentblog.config.ts'],
  })
})

test('a nested paths key elsewhere is not mistaken for compilerOptions.paths', () => {
  const nested = `{
  "compilerOptions": {
    "plugins": [{ "name": "next", "paths": { "decoy": ["./decoy"] } }],
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
`
  const parsed = JSON.parse(patch(nested).source)
  assert.deepEqual(parsed.compilerOptions.paths, {
    '@/agentblog.config': ['./agentblog.config.ts'],
    '@/*': ['./src/*'],
  })
  assert.deepEqual(parsed.compilerOptions.plugins[0].paths, { decoy: ['./decoy'] })
})

test('declines when paths is absent, rather than replacing an inherited map', () => {
  const inherits = `{
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "strict": true
  }
}
`
  const result = patch(inherits)

  assert.equal(result.changes.length, 0)
  assert.equal(result.source, inherits)
  assert.equal(result.declined.length, 1)
  assert.match(result.declined[0]!, /extends/)
})

test('declines when there is no compilerOptions to add to', () => {
  const result = patch(`{ "include": ["**/*.ts"] }`)

  assert.equal(result.changes.length, 0)
  assert.equal(result.declined.length, 1)
  assert.match(result.declined[0]!, /compilerOptions/)
})

test('an existing mapping is left exactly as the user wrote it', () => {
  const already = `{
  "compilerOptions": {
    "paths": {
      "@/agentblog.config": ["./config/agentblog.config.ts"],
      "@/*": ["./src/*"]
    }
  }
}
`
  const result = patch(already)

  assert.equal(result.source, already)
  assert.equal(result.changes.length, 0)
})
