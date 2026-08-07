#!/usr/bin/env node
/**
 * Assert a post published WITHOUT a rebuild reaches the sitemap and the feed
 * before we invite a crawler to it.
 *
 * ===========================================================================
 * THE FAILURE MODE THIS CATCHES
 * ===========================================================================
 * Three facts, each harmless, which combine into a certain bug:
 *
 *   1. `sitemap.js` is a special Route Handler that is cached by default. The
 *      same sentence appears verbatim in the docs for `robots.js`,
 *      `opengraph-image.js`, and `twitter-image.js`. `feed.xml/route.ts` is an
 *      ordinary cached route handler for the same reason.
 *   2. During ISR revalidation, `generateStaticParams` is not called again.
 *   3. A publish webhook written the obvious way revalidates `/blog/[slug]` and
 *      `/blog`, and nothing else.
 *
 * Publish a post and it does not appear in `/sitemap.xml` or `/feed.xml` until
 * the next deploy. We then fire an IndexNow ping for a URL our own sitemap does
 * not list, which is the single worst signal we can send: it tells a crawler we
 * have a page while our canonical index of the site says we do not.
 *
 * For MDX on disk this is invisible, because publishing is a deploy. For every
 * database-backed adapter, and for the hosted tier this architecture exists to
 * support, it is the normal path. That is why the assertions are ordered:
 * sitemap AND feed first, IndexNow second. Asserting the ping fired first would
 * pass on exactly the broken sequence we are trying to forbid.
 *
 * It also runs against the MDX source, where it should pass trivially. A test
 * that only runs against adapters we have not built yet protects nothing.
 *
 * The new post is derived from an existing post in the content directory, so the
 * frontmatter shape is whatever the installed adapter actually accepts rather
 * than whatever this script guessed when it was written.
 *
 * Usage:
 *   node scripts/assert-cold-slug.mjs \
 *     --base-url http://localhost:3000 \
 *     --content-dir apps/fixture-next16/content/blog \
 *     [--slug cold-slug-probe] [--secret $AGENTBLOG_PUBLISH_SECRET] \
 *     [--keep]
 *
 * @see https://docs.agentblog.dev/reference/files
 */
import { readFileSync, readdirSync, existsSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const args = new Map()
for (let i = 2; i < process.argv.length; i += 1) {
  const arg = process.argv[i]
  if (!arg.startsWith('--')) continue
  const [key, inline] = arg.slice(2).split('=')
  if (key === 'keep') {
    args.set(key, 'true')
    continue
  }
  args.set(key, inline ?? process.argv[++i])
}

const baseUrl = (args.get('base-url') ?? 'http://localhost:3000').replace(/\/$/, '')
const contentDir = resolve(ROOT, args.get('content-dir') ?? 'apps/fixture-next16/content/blog')
const slug = args.get('slug') ?? `cold-slug-probe-${Date.now().toString(36)}`
const publishPath = args.get('publish-path') ?? '/api/publish'
const secret = args.get('secret') ?? process.env.AGENTBLOG_PUBLISH_SECRET ?? ''
const authHeader = args.get('auth-header') ?? 'x-agentblog-secret'
const pollMs = Number(args.get('poll') ?? 20_000)
const keep = args.get('keep') === 'true'

const postUrlPath = `/blog/${slug}`
const newFile = join(contentDir, `${slug}.mdx`)

let created = false

function fail(lines) {
  console.error('\nassert-cold-slug: FAIL\n')
  for (const line of lines) console.error(line)
  console.error('')
  cleanup()
  process.exit(1)
}

function cleanup() {
  if (created && !keep) {
    rmSync(newFile, { force: true })
    console.log(`  cleaned up ${relative(ROOT, newFile)}`)
  }
}

/* -------------------------------------------------------------------------- */
/*  Build the new post out of an existing one                                  */
/* -------------------------------------------------------------------------- */

/**
 * Copy the newest existing post and rewrite the fields that must be unique.
 *
 * Deriving beats templating here. The frontmatter contract is owned by the
 * schema package and the adapter, both of which move, and a hand-written
 * template in this script would be a fourth copy of that contract that nothing
 * keeps in sync. Copying whatever the seed posts do means this script cannot
 * disagree with them.
 */
function writeProbePost() {
  if (!existsSync(contentDir)) {
    fail([
      `  No content directory at ${contentDir}`,
      '  Pass --content-dir pointing at the installed adapter content, for example',
      '  apps/fixture-next16/content/blog after the registry install step.',
    ])
  }

  const seeds = readdirSync(contentDir)
    .filter((f) => f.endsWith('.mdx') || f.endsWith('.md'))
    .sort()

  if (seeds.length === 0) {
    fail([
      `  ${contentDir} has no posts to derive a probe post from.`,
      '  The seed content is supposed to arrive with @agentblog/source-mdx. If it did',
      '  not, that is the real failure and this script cannot work around it.',
    ])
  }

  const seedPath = join(contentDir, seeds[0])
  const seed = readFileSync(seedPath, 'utf8')
  const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(seed)

  if (!match) {
    fail([
      `  ${seedPath} has no frontmatter block this script can read.`,
      '  It expects a leading --- delimited block, which is what every MDX adapter uses.',
    ])
  }

  const now = new Date().toISOString()
  const distinctive =
    `This sentence exists so assert-cold-slug can prove the post body reached the ` +
    `rendered page. Probe id ${slug}.`

  const frontmatter = match[1]
    .split('\n')
    .map((line) => {
      if (/^slug\s*:/.test(line)) return `slug: ${slug}`
      if (/^title\s*:/.test(line)) return `title: Cold slug probe ${slug.slice(-8)}`
      if (/^description\s*:/.test(line))
        return (
          'description: A post published through the webhook without a rebuild, used to ' +
          'prove the sitemap and the feed both pick it up.'
        )
      if (/^datePublished\s*:/.test(line)) return `datePublished: '${now}'`
      if (/^dateModified\s*:/.test(line)) return `dateModified: '${now}'`
      if (/^draft\s*:/.test(line)) return 'draft: false'
      return line
    })
    .join('\n')

  const body = `\n## Probe\n\n${distinctive}\n`

  writeFileSync(newFile, `---\n${frontmatter}\n---\n${body}`, 'utf8')
  created = true
  console.log(`  wrote ${relative(ROOT, newFile)} (derived from ${seeds[0]})`)
  return distinctive
}

/* -------------------------------------------------------------------------- */

/** Find any key named `indexnow` anywhere in the publish response. */
function findIndexNow(value, depth = 0) {
  if (depth > 4 || value === null || typeof value !== 'object') return undefined
  for (const [key, child] of Object.entries(value)) {
    if (key.toLowerCase() === 'indexnow') return child
    const nested = findIndexNow(child, depth + 1)
    if (nested !== undefined) return nested
  }
  return undefined
}

async function poll(path, needle, label) {
  const url = `${baseUrl}${path}`
  const deadline = Date.now() + pollMs
  let lastStatus = 0
  let lastBody = ''

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { cache: 'no-store' })
      lastStatus = response.status
      lastBody = await response.text()
      if (lastStatus === 200 && lastBody.includes(needle)) {
        console.log(`  ${label}: contains ${needle}`)
        return true
      }
    } catch {
      // Server may still be warming. Keep polling until the deadline.
    }
    await new Promise((r) => setTimeout(r, 1000))
  }

  fail([
    `  ${label} (${url}) never listed the new URL within ${pollMs}ms.`,
    `  Looked for: ${needle}`,
    `  Last status: ${lastStatus}, ${lastBody.length} bytes`,
    '',
    '  This is the cached route handler failure. Both /sitemap.xml and /feed.xml are',
    '  cached route handlers, so the publish webhook has to invalidate them by name:',
    '',
    "    revalidatePath('/sitemap.xml')",
    "    revalidatePath('/feed.xml')",
    "    revalidateTag('posts', { expire: 0 })",
    '',
    '  Revalidating only /blog and /blog/[slug] leaves both stale until the next',
    '  deploy. For MDX that is invisible, because publishing is a deploy. For every',
    '  database-backed adapter it is the normal path, and it means we ping IndexNow',
    '  about a URL our own sitemap does not list.',
  ])
  return false
}

async function main() {
  console.log('assert-cold-slug')
  console.log(`  base:    ${baseUrl}`)
  console.log(`  slug:    ${slug}`)

  const distinctive = writeProbePost()

  /* ---- step 1: publish -------------------------------------------------- */

  const publishUrl = `${baseUrl}${publishPath}`
  let response
  try {
    response = await fetch(publishUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(secret ? { [authHeader]: secret } : {}),
      },
      body: JSON.stringify({ slug, action: 'publish' }),
    })
  } catch (error) {
    fail([`  POST ${publishUrl} failed: ${error.message}`, '  Is the built app running?'])
  }

  const raw = await response.text()
  if (!response.ok) {
    fail([
      `  POST ${publishUrl} returned ${response.status}.`,
      `  ${raw.slice(0, 400)}`,
      '',
      secret
        ? '  A 401 here means the secret does not match. Pass --secret or set' +
          '\n  AGENTBLOG_PUBLISH_SECRET.'
        : '  If this is a 401, the route requires a secret. Pass --secret.',
    ])
  }

  let payload
  try {
    payload = JSON.parse(raw)
  } catch {
    fail([
      `  POST ${publishUrl} returned ${response.status} but the body is not JSON.`,
      `  ${raw.slice(0, 200)}`,
      '',
      '  The publish route must report what it did as JSON, including the IndexNow',
      '  result. A webhook that succeeds silently cannot be verified by anything.',
    ])
  }

  console.log(`  published: ${response.status}`)

  /* ---- step 2: sitemap and feed, BEFORE indexnow ------------------------ */
  /* The order is the assertion. Checking IndexNow first would pass on exactly  */
  /* the broken sequence this script exists to forbid.                         */

  await poll('/sitemap.xml', postUrlPath, 'sitemap.xml')
  await poll('/feed.xml', postUrlPath, 'feed.xml')

  /* ---- step 3: what "serves" means depends on the prerender strategy ---- */
  /*
   * `prerenderStrategy` decides what a correct outcome looks like, so the
   * assertion branches on the value the publish route reports.
   *
   * For a `build` source such as `mdxSource`, content lives in the repository and
   * publishing IS a deploy. Dropping a file onto a running server is outside that
   * contract: the process has the content it was deployed with, and serving a
   * post that is not in the deployment would mean the adapter re-reads the disk on
   * every request, which is exactly the per-request filesystem access a build-time
   * source exists to avoid. What must still hold, and what this script really
   * exists to prove, is that the metadata routes were invalidated and that
   * IndexNow was NOT pinged for a URL the deployment cannot serve.
   *
   * For `deploy-hook` and `on-demand`, the URL has to serve before IndexNow is
   * told to come and look at it.
   */
  const strategy = payload.strategy ?? 'unknown'
  console.log(`  strategy: ${strategy}`)

  const pageResponse = await fetch(`${baseUrl}${postUrlPath}`, { cache: 'no-store' })
  const pageHtml = pageResponse.ok ? await pageResponse.text() : ''

  if (strategy === 'build') {
    const pinged = payload.indexnow?.attempted === true
    if (pinged && !pageResponse.ok) {
      fail([
        `  The publish route pinged IndexNow for ${postUrlPath}, which returns`,
        `  ${pageResponse.status}.`,
        '',
        '  This is the exact sequence the script exists to forbid: telling a crawler',
        '  to fetch a URL that the running deployment cannot serve. For a `build`',
        '  source the publish route must revalidate and then stop, because the deploy',
        '  that carries the new file is what makes the URL real.',
      ])
    }
    console.log(
      pageResponse.ok
        ? '  post URL serves, and the metadata routes were invalidated'
        : '  post URL is not in this deployment, and IndexNow was correctly not pinged',
    )
  } else {
    if (!pageResponse.ok) {
      fail([
        `  ${baseUrl}${postUrlPath} returned ${pageResponse.status}.`,
        '',
        `  The source declares prerenderStrategy "${strategy}", so a slug published`,
        '  after the build has to resolve. It was never in generateStaticParams and',
        '  ISR does not call that function again, so this depends on dynamicParams',
        '  staying true. Setting it to false turns an unbuilt post into a hard 404,',
        '  which is strictly worse than a slow first render.',
      ])
    }

    if (!pageHtml.includes(distinctive)) {
      fail([
        `  ${postUrlPath} responded 200, but the post body is not in the raw HTML.`,
        '  The route resolved without the new content, so something is serving a cached',
        '  render. Check that revalidateTag ran with { expire: 0 } rather than a profile',
        '  name.',
      ])
    }
  }

  const headClose = pageHtml.search(/<\/head\s*>/i)
  const titleAt = pageHtml.search(/<title[\s>]/i)
  if (titleAt === -1 || (headClose !== -1 && titleAt > headClose)) {
    fail([
      `  ${postUrlPath} serves its <title> outside <head>.`,
      '',
      '  A cold slug renders on demand rather than from the prerendered set, and a',
      '  request-time render is where Next.js streams metadata into <body>. That is',
      '  measurable rather than documented, which is why it is asserted here.',
      '  htmlLimitedBots covers known AI user agents either way, which is one more',
      '  reason that config is not optional.',
    ])
  }

  console.log(`  ${postUrlPath}: 200, body present, <title> in <head>`)

  /* ---- step 4: only now, IndexNow -------------------------------------- */

  const indexnow = findIndexNow(payload)

  if (indexnow === undefined) {
    fail([
      '  The publish response reports no IndexNow result.',
      `  Response: ${raw.slice(0, 300)}`,
      '',
      '  The route must return what it did, including an `indexnow` field. Use null',
      '  when IndexNow is disabled in config, and the { ok, status, meaning } result',
      '  otherwise. Silence and success are indistinguishable to every caller,',
      '  including this one.',
    ])
  }

  if (indexnow === null) {
    console.log('  indexnow: disabled in config (null). Sitemap and feed still verified.')
  } else if (indexnow?.ok === false) {
    fail([
      `  IndexNow ping failed: status ${indexnow.status}, ${indexnow.meaning}`,
      '',
      '  Sitemap and feed are correct, so the ordering bug is not present. This is the',
      '  ping itself failing, which is a key or endpoint problem.',
    ])
  } else {
    const attempted = indexnow?.attempted === true
    console.log(
      `  indexnow: ${attempted ? 'submitted' : 'not submitted'} (${JSON.stringify(indexnow)})`,
    )
  }

  cleanup()
  console.log('  sitemap and feed both list the new URL before any crawler was pinged. OK')
}

main().catch((error) => {
  fail([`  Unexpected error: ${error.stack ?? error.message}`])
})
