#!/usr/bin/env node
/**
 * Assert the shared metadata defaults survive into a built post's HTML.
 *
 * ===========================================================================
 * THE FAILURE MODE THIS CATCHES
 * ===========================================================================
 * Next.js merges metadata between segments SHALLOWLY. From the generateMetadata
 * reference: metadata with nested fields such as `openGraph` and `robots`
 * defined in an earlier segment is "overwritten by the last segment to define
 * them."
 *
 * So a post page that sets `openGraph` at all replaces the root layout's entire
 * `openGraph` object, including `siteName` and `locale`. Every Open Graph card
 * from that install then has no site name. The same trap applies to `robots`: a
 * page that sets `robots` replaces the layout's `googleBot` block, taking
 * `max-snippet: -1` and `max-image-preview: large` with it. Those two are what
 * permit full snippets and large thumbnails in AI Overviews and AI Mode, so
 * losing them is a GEO regression rather than a formatting one.
 *
 * This is invisible everywhere it could be caught early. The types are correct:
 * both objects are valid `Metadata`. Every schema validator passes. The page
 * renders. The only place the loss is observable is the rendered HTML, which is
 * why this assertion reads HTML rather than source.
 *
 * The fix in the block is `lib/metadata.ts`: every segment that sets `openGraph`
 * or `robots` spreads the shared defaults. This script is what keeps that true
 * when someone adds a segment in month six and writes the object out by hand.
 *
 * Usage:
 *   node scripts/assert-og-defaults.mjs \
 *     --base-url http://localhost:3000 \
 *     --path /blog/hello-world \
 *     [--site-name "Fixture Blog"]
 *
 * @see https://agentblog.dev/docs/blog-block
 * @see BUILD-SPEC section 10, lib/metadata.ts
 */
const args = new Map()
for (let i = 2; i < process.argv.length; i += 1) {
  const arg = process.argv[i]
  if (!arg.startsWith('--')) continue
  const [key, inline] = arg.slice(2).split('=')
  args.set(key, inline ?? process.argv[++i])
}

const baseUrl = (args.get('base-url') ?? 'http://localhost:3000').replace(/\/$/, '')
const path = args.get('path') ?? '/blog'
const expectedSiteName = args.get('site-name')
const timeoutMs = Number(args.get('timeout') ?? 30_000)
const url = `${baseUrl}${path}`

/**
 * Each assertion names the tag, how to find it, and what its absence costs.
 * The cost line is the part that matters: a failure that only says "missing
 * og:site_name" gets muted, and a failure that says what it breaks gets fixed.
 */
const ASSERTIONS = [
  {
    id: 'og:site_name',
    test: (html) =>
      /<meta[^>]+property=["']og:site_name["'][^>]*content=["']([^"']+)["']/i.exec(html) ??
      /<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:site_name["']/i.exec(html),
    cost:
      'Every share card from this install shows the URL where the site name should be. ' +
      'The usual cause is a segment defining `openGraph` without spreading ' +
      '`openGraphDefaults` from lib/metadata.ts, which replaces the root object wholesale.',
  },
  {
    id: 'max-snippet',
    test: (html) => /max-snippet\s*:\s*(-?\d+)/i.exec(html),
    cost:
      'Without `max-snippet: -1`, Google caps the text it may quote from the page. That ' +
      'cap applies to AI Overviews and AI Mode too, so the page becomes less quotable in ' +
      'exactly the surfaces this product exists to win.',
  },
  {
    id: 'max-image-preview:large',
    test: (html) => /max-image-preview\s*:\s*large/i.exec(html),
    cost:
      'Without it, the thumbnail beside the result is small or absent. This is the same ' +
      'shallow-merge loss as the other two, one `robots` object away.',
  },
]

async function main() {
  console.log('assert-og-defaults')
  console.log(`  url: ${url}`)

  let response
  try {
    response = await fetch(url, {
      headers: { accept: 'text/html' },
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (error) {
    console.error('\nassert-og-defaults: FAIL\n')
    console.error(`  Request failed: ${error.message}`)
    console.error('  This script starts no server. Check the step that starts one.')
    process.exit(1)
  }

  if (response.status !== 200) {
    console.error('\nassert-og-defaults: FAIL\n')
    console.error(`  Expected 200, got ${response.status} from ${url}`)
    process.exit(1)
  }

  const html = await response.text()
  const failures = []

  for (const assertion of ASSERTIONS) {
    const match = assertion.test(html)
    if (!match) {
      failures.push(assertion)
      continue
    }
    console.log(`  found ${assertion.id}${match[1] ? ` = ${match[1]}` : ''}`)
  }

  if (expectedSiteName) {
    const match = ASSERTIONS[0].test(html)
    const actual = match?.[1]
    if (actual && actual !== expectedSiteName) {
      console.error('\nassert-og-defaults: FAIL\n')
      console.error(`  og:site_name is "${actual}", expected "${expectedSiteName}".`)
      console.error('  The tag survived the merge but is reading from the wrong config value.')
      process.exit(1)
    }
  }

  if (failures.length > 0) {
    console.error(`\nassert-og-defaults: FAIL (${failures.length} missing)\n`)
    for (const f of failures) {
      console.error(`  missing: ${f.id}`)
      console.error(`    ${f.cost}`)
      console.error('')
    }
    console.error('  Next.js merges metadata shallowly. Defining `openGraph` or `robots` in a')
    console.error('  segment replaces the parent object entirely, so every segment that sets')
    console.error('  either one must spread the defaults from lib/metadata.ts:')
    console.error('')
    console.error('    openGraph: { ...openGraphDefaults, type: "article", title, ... }')
    console.error('    robots:    { ...robotsDefaults, ... }')
    console.error('')
    console.error('  Nothing else catches this. It type checks, it validates, it renders.')
    process.exit(1)
  }

  console.log('  shared openGraph and robots defaults survived the merge. OK')
}

main()
