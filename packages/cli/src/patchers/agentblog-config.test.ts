/**
 * The placeholder contract for `agentblog.config.ts`.
 *
 * ===========================================================================
 * WHAT THIS FILE IS DEFENDING
 * ===========================================================================
 * The shipped template holds the default author in a constant, because one
 * value has to reach both `mdxSource(...)` and the `defaultAuthor` field and
 * the adapter cannot read the field back without closing an import cycle:
 *
 *     const DEFAULT_AUTHOR = 'your-name'
 *     source: mdxSource({ dir: 'content/blog', defaultAuthor: DEFAULT_AUTHOR }),
 *     defaultAuthor: DEFAULT_AUTHOR,
 *
 * The patcher only understood string literals, so it read `DEFAULT_AUTHOR` as
 * "not a plain string", declined, and left `'your-name'` in place on every
 * install that ever ran. Nothing failed at install time. `doctor` reported zero
 * errors. The first post written without an explicit `author` then failed the
 * build with `unknown author slug "your-name"`, which is the shape of failure
 * this repository exists to prevent.
 *
 * The first two tests below are the regression. The third is the one that says
 * why the fix rewrites the constant rather than the property: if it wrote
 * `defaultAuthor: 'editorial'` and left the constant alone, the config field and
 * the frontmatter parser would disagree and the build would still fail.
 *
 * Run with `pnpm --filter agentblog test`.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { patchAgentblogConfig } from './agentblog-config.ts'

/** The shape the registry ships, reduced to the parts the patcher touches. */
const TEMPLATE = `import { defineConfig } from '@/lib/define-config'
import { mdxSource } from '@/lib/sources/mdx'

const DEFAULT_AUTHOR = 'your-name'

export default defineConfig({
  siteUrl: 'https://yourdomain.com',
  brand: {
    name: 'Your Brand',
  },
  source: mdxSource({ dir: 'content/blog', defaultAuthor: DEFAULT_AUTHOR }),
  defaultAuthor: DEFAULT_AUTHOR,
})
`

function patch(source: string, values: Parameters<typeof patchAgentblogConfig>[2]) {
  return patchAgentblogConfig(source, 'agentblog.config.ts', values)
}

test('defaultAuthor held in a const is filled in, not declined', () => {
  const result = patch(TEMPLATE, { defaultAuthor: 'editorial' })

  assert.match(result.source, /const DEFAULT_AUTHOR = 'editorial'/)
  assert.equal(result.declined.length, 0)
  assert.ok(result.changes.some((line) => line.includes('DEFAULT_AUTHOR')))
})

test('both readers of the constant see the chosen slug', () => {
  const result = patch(TEMPLATE, { defaultAuthor: 'editorial' })

  // The property keeps reading the constant rather than being rewritten to a
  // literal, so `mdxSource` and `defaultAuthor` cannot drift apart.
  assert.match(result.source, /defaultAuthor: DEFAULT_AUTHOR/)
  assert.match(
    result.source,
    /mdxSource\(\{ dir: 'content\/blog', defaultAuthor: DEFAULT_AUTHOR \}\)/,
  )
  assert.doesNotMatch(result.source, /your-name/)
})

test('a constant the user already answered is left alone', () => {
  const answered = TEMPLATE.replace("'your-name'", "'stan'")
  const result = patch(answered, { defaultAuthor: 'editorial' })

  assert.match(result.source, /const DEFAULT_AUTHOR = 'stan'/)
  assert.equal(result.changes.length, 0)
  assert.ok(result.declined.some((line) => line.includes('already "stan"')))
})

test('an identifier that resolves to no local constant is reported, not guessed at', () => {
  const imported = TEMPLATE.replace("const DEFAULT_AUTHOR = 'your-name'\n\n", '').replace(
    "import { mdxSource } from '@/lib/sources/mdx'",
    "import { mdxSource } from '@/lib/sources/mdx'\nimport { DEFAULT_AUTHOR } from './authors'",
  )
  const result = patch(imported, { defaultAuthor: 'editorial' })

  assert.equal(result.changes.length, 0)
  assert.ok(result.declined.some((line) => line.includes('not a string constant')))
})

test('plain string placeholders still fill in', () => {
  const result = patch(TEMPLATE, { siteUrl: 'https://example.com', brandName: 'Example' })

  assert.match(result.source, /siteUrl: 'https:\/\/example\.com'/)
  assert.match(result.source, /name: 'Example'/)
})

test('a brand name containing a quote is escaped rather than breaking the file', () => {
  const result = patch(TEMPLATE, { brandName: "Stan's Blog" })

  assert.match(result.source, /name: 'Stan\\'s Blog'/)
  assert.doesNotMatch(result.source, /name: 'Stan's/)
})
