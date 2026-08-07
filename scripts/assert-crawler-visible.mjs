#!/usr/bin/env node
/**
 * Assert a non-JavaScript crawler receives a complete page.
 *
 * ===========================================================================
 * THE FAILURE MODE THIS CATCHES
 * ===========================================================================
 * Every other check in this directory reads our source. This one reads what a
 * crawler literally receives over HTTP, with no browser, no hydration, no
 * JavaScript, and no test framework in between. That is its entire value, and it
 * is why it deliberately uses nothing but `fetch` and string search.
 *
 * Three ways a perfectly good looking install serves nothing to a crawler:
 *
 *   1. The body text only exists after hydration, because a component became a
 *      client component and mounts its content in an effect. Renders fine in a
 *      browser. Ships an empty `<main>` to GPTBot.
 *   2. `<title>` and the meta tags stream into `<body>` instead of landing in
 *      `<head>`, which is what happens to any bot outside `htmlLimitedBots` on a
 *      page with deferred metadata. Browsers do not care. Parsers that read the
 *      head and stop do.
 *   3. The route is not prerendered at all, so the first request gets a
 *      streaming shell.
 *
 * A DOM-based assertion cannot see any of these, because a DOM library executes
 * the same JavaScript the crawler will not.
 *
 * This script starts no server. The workflow starts one, then runs this against
 * it, so a failure here is unambiguously about the response rather than about
 * process management.
 *
 * Usage:
 *   node scripts/assert-crawler-visible.mjs \
 *     --base-url http://localhost:3000 \
 *     --path /blog/hello-world \
 *     --sentence "a distinctive sentence from the post body"
 *
 *   node scripts/assert-crawler-visible.mjs \
 *     --path /blog/hello-world \
 *     --sentence-from apps/fixture-next16/content/blog/hello-world.mdx
 *
 * `--sentence-from` takes the longest prose line out of a post's body, which
 * keeps the workflow from hard-coding a string that changes whenever the seed
 * content is edited. A hard-coded sentence that has drifted out of the post is a
 * check that fails for the wrong reason, and the usual repair for that is to
 * weaken the check.
 *
 * @see https://docs.agentblog.dev/reference/files
 */
import { readFileSync } from 'node:fs'
const args = new Map()
for (let i = 2; i < process.argv.length; i += 1) {
  const arg = process.argv[i]
  if (!arg.startsWith('--')) continue
  const [key, inline] = arg.slice(2).split('=')
  args.set(key, inline ?? process.argv[++i])
}

const baseUrl = (args.get('base-url') ?? 'http://localhost:3000').replace(/\/$/, '')
const path = args.get('path') ?? '/blog'
const timeoutMs = Number(args.get('timeout') ?? 30_000)

/** The longest plain prose line in an MDX body, which is the least fragile probe. */
function sentenceFrom(file) {
  const source = readFileSync(file, 'utf8')
  const body = source.replace(/^---\n[\s\S]*?\n---\n?/, '')
  const candidates = body
    .split('\n')
    .map((line) => line.trim())
    .filter(
      (line) =>
        line.length > 40 &&
        !line.startsWith('#') &&
        !line.startsWith('<') &&
        !line.startsWith('```') &&
        !line.startsWith('|') &&
        !line.startsWith('-') &&
        !line.includes('{'),
    )
    .sort((a, b) => b.length - a.length)

  return candidates[0]
}

const sentenceFromFile = args.get('sentence-from')
const sentence =
  args.get('sentence') ?? (sentenceFromFile ? sentenceFrom(sentenceFromFile) : undefined)

/**
 * A real GPTBot user agent string, not the bare token.
 *
 * Matching in Next.js is a substring test against the pattern, so the token
 * alone would pass while telling us nothing about how the real header behaves.
 */
const userAgent =
  args.get('ua') ??
  'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.2; +https://openai.com/gptbot'

const url = `${baseUrl}${path}`

function fail(lines) {
  console.error('\nassert-crawler-visible: FAIL\n')
  for (const line of lines) console.error(line)
  console.error('')
  process.exit(1)
}

if (!sentence) {
  fail([
    '  --sentence or --sentence-from is required.',
    '',
    '  Pass a distinctive sentence from the post body, long enough that it cannot',
    '  appear in a nav label or a meta description. The whole assertion is that',
    '  the article text is in the raw HTML, so a short or generic string would',
    '  pass against a page that shipped nothing.',
  ])
}

/**
 * Reduce markup and Markdown to comparable plain text.
 *
 * The assertion is that the article text reached the response, not that it
 * reached it character for character. Two things legitimately change it on the
 * way: inline Markdown becomes elements (backticks become `<code>`, asterisks
 * become `<strong>`), and JSX escapes apostrophes and quotes into numeric
 * entities. Comparing raw strings therefore produces false failures on posts
 * that are perfectly visible, which is the worst possible outcome for a gate
 * whose whole job is to be believed.
 *
 * Tags are dropped rather than replaced with a space, because `` `foo` `` renders
 * as `<code>foo</code>` with no surrounding whitespace in the source text.
 */
const normalize = (input) =>
  input
    // Strip HTML tags and Markdown inline syntax, then decode the entities JSX
    // emits, then collapse whitespace.
    .replace(/<[^>]*>/g, '')
    .replace(/[`*_]/g, '')
    .replace(/&#x27;|&#39;|&rsquo;/g, "'")
    .replace(/&quot;|&#34;|&ldquo;|&rdquo;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

async function main() {
  console.log('assert-crawler-visible')
  console.log(`  url:  ${url}`)
  console.log(`  ua:   ${userAgent}`)

  let response
  try {
    response = await fetch(url, {
      headers: { 'user-agent': userAgent, accept: 'text/html' },
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (error) {
    fail([
      `  Request failed: ${error.message}`,
      '',
      '  The server is not answering. This script starts nothing on purpose, so',
      '  check the step that was supposed to start it.',
    ])
  }

  /* ---- (a) status ------------------------------------------------------ */

  if (response.status !== 200) {
    const location = response.headers.get('location')
    fail([
      `  Expected 200, got ${response.status}.`,
      location ? `  Location: ${location}` : '',
      '',
      response.status >= 300 && response.status < 400
        ? '  A redirect is a failure here. Crawlers follow them, but a redirect on the' +
          '\n  canonical post URL means the URL in our sitemap is not the URL that serves' +
          '\n  the post, and link equity and citations split between the two.'
        : '  A crawler that gets this status indexes nothing.',
    ])
  }

  const html = await response.text()
  console.log(`  bytes: ${html.length}`)

  /* ---- (c) title in head, before body ---------------------------------- */

  const headOpen = html.search(/<head[\s>]/i)
  const headClose = html.search(/<\/head\s*>/i)
  const bodyOpen = html.search(/<body[\s>]/i)
  const titleAt = html.search(/<title[\s>]/i)

  const problems = []

  if (titleAt === -1) {
    problems.push([
      '  No `<title>` in the response at all.',
      '  Every AI answer surface and every search result needs one.',
    ])
  } else if (headOpen === -1 || headClose === -1) {
    problems.push([
      '  Could not locate `<head>` in the response.',
      '  The document is not a complete HTML page, which usually means a streaming',
      '  shell rather than a prerendered document.',
    ])
  } else if (titleAt < headOpen || titleAt > headClose) {
    problems.push([
      '  `<title>` is outside `<head>`.',
      `  head: ${headOpen}..${headClose}, title at ${titleAt}`,
      '',
      '  This is the streamed-metadata failure. Next.js defers metadata into the body',
      '  for any user agent outside `htmlLimitedBots`, and this user agent is outside',
      '  it. Add the bot to the config: npx agentblog@latest doctor --fix',
    ])
  } else if (bodyOpen !== -1 && titleAt > bodyOpen) {
    problems.push([
      '  `<title>` appears after `<body>` opens.',
      '  A parser that reads the head and stops sees a page with no title.',
    ])
  }

  /* ---- (b) the article text is in the raw HTML ------------------------- */

  const present = html.includes(sentence) || normalize(html).includes(normalize(sentence))

  if (!present) {
    problems.push([
      '  The post body sentence is not in the raw HTML.',
      `  Looked for: ${sentence}`,
      '',
      '  Either the content is mounted by JavaScript (a client component rendering in',
      '  an effect, a conditional mount instead of `<details>`), or the route is not',
      '  prerendered, or the text was HTML-escaped in a way plain search misses. Check',
      '  the escaping case by hand before assuming the first two: an apostrophe becomes',
      '  a numeric entity in JSX output.',
      '',
      '  If the content really is JavaScript-mounted, no crawler in this class ever',
      '  sees it, and neither does any AI answer engine.',
    ])
  }

  if (problems.length > 0) {
    fail(problems.flatMap((p) => [...p, '']))
  }

  console.log('  200, body text in raw HTML, <title> inside <head>. OK')
}

main()
