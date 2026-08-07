#!/usr/bin/env node
/**
 * Assert every internal link in the documentation resolves.
 *
 * ===========================================================================
 * THE FAILURE MODE THIS CATCHES
 * ===========================================================================
 * The docs site is a tree of MDX files whose URLs come from their paths, so
 * renaming a page or moving it between sections silently breaks every link to
 * it. Nothing else notices: MDX compiles, the build succeeds, the sidebar looks
 * right, and the broken link only shows up as a 404 for a reader who followed
 * it. On a documentation site the same fact is true twice over, because a docs
 * page that 404s is also a page an AI assistant will not cite.
 *
 * Anchors have the same problem one level down. `/installation#the-one-line`
 * resolves to a real page and lands the reader at the top of it, which is
 * indistinguishable from working unless you know what you were looking for.
 *
 * So: build the set of real page URLs from the file tree, build the set of
 * anchors from each page's headings, and check every internal link against
 * both. External links are not fetched, because a check that needs the network
 * is a check that fails for reasons that are not ours.
 *
 * Usage:
 *   node scripts/assert-docs-links.mjs
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CONTENT = join(ROOT, 'apps/docs/content/docs')

/**
 * Paths the docs site serves that are not pages in the content tree. Each one
 * is a route handler in `apps/docs/app`, so a link to it is correct and no
 * amount of walking the content directory will find it.
 */
const NON_PAGE_ROUTES = new Set(['/llms.txt', '/llms-full.txt'])

/* ========================================================================== */

/** Every `.mdx` file under the content directory, as absolute paths. */
function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...walk(full))
      continue
    }
    if (entry.isFile() && entry.name.endsWith('.mdx')) out.push(full)
  }
  return out
}

/** The URL a content file is served at, matching the loader's rules. */
function urlFor(file) {
  const rel = relative(CONTENT, file).split(sep).join('/')
  const withoutExtension = rel.replace(/\.mdx$/, '')
  const withoutIndex = withoutExtension.replace(/(^|\/)index$/, '')
  return withoutIndex === '' ? '/' : `/${withoutIndex}`
}

/**
 * GitHub-style heading slugs, which is what the docs site generates.
 *
 * Deliberately simple: lowercase, drop everything that is not a word character
 * or a space or a hyphen, then hyphenate. Inline code fences are stripped
 * first, because a heading that names a config key is written in backticks and
 * the backticks are not part of the slug.
 */
function slugify(heading) {
  return heading
    .replace(/`/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
}

/** Heading anchors on a page, from its `##` and `###` lines outside code fences. */
function anchorsIn(source) {
  const anchors = new Set()
  let inFence = false
  for (const line of source.split('\n')) {
    if (line.trimStart().startsWith('```')) {
      inFence = !inFence
      continue
    }
    if (inFence) continue
    const match = /^(#{2,4})\s+(.*)$/.exec(line)
    if (match?.[2] !== undefined) anchors.add(slugify(match[2]))
  }
  return anchors
}

/**
 * Internal links in a page: Markdown links, and the `href` of any component
 * (the Card components in these docs are links and are the easiest link in the
 * set to break, because they are the ones that point across sections).
 *
 * Link text may wrap across lines in this repository's prose, so the Markdown
 * pattern is run against the source with newlines intact and allows them inside
 * the label.
 */
function linksIn(source) {
  const found = []

  for (const match of source.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
    if (match[1] !== undefined) found.push(match[1])
  }
  for (const match of source.matchAll(/href="([^"]+)"/g)) {
    if (match[1] !== undefined) found.push(match[1])
  }

  return found.filter((href) => href.startsWith('/'))
}

function main() {
  console.log('assert-docs-links')

  if (!statSync(CONTENT, { throwIfNoEntry: false })) {
    console.error(`\nassert-docs-links: ${CONTENT} does not exist.\n`)
    process.exit(1)
  }

  const files = walk(CONTENT)
  const pages = new Map()
  for (const file of files) {
    const source = readFileSync(file, 'utf8')
    pages.set(urlFor(file), { file, anchors: anchorsIn(source), source })
  }

  console.log(`  ${pages.size} page(s)`)

  const problems = []

  for (const [url, page] of pages) {
    for (const href of linksIn(page.source)) {
      const [path = '', hash] = href.split('#')
      const target = path === '' ? url : path

      if (NON_PAGE_ROUTES.has(target)) continue

      // The Markdown variant of a page: `/installation.md`.
      if (target.endsWith('.md')) {
        const withoutExtension = target.replace(/\.md$/, '')
        const asPage = withoutExtension === '/index' ? '/' : withoutExtension
        if (!pages.has(asPage)) {
          problems.push(`${relative(ROOT, page.file)}: ${href} names no page`)
        }
        continue
      }

      const destination = pages.get(target)
      if (destination === undefined) {
        problems.push(`${relative(ROOT, page.file)}: ${href} names no page`)
        continue
      }

      if (hash !== undefined && hash !== '' && !destination.anchors.has(hash)) {
        problems.push(`${relative(ROOT, page.file)}: ${href} names no heading on ${target}`)
      }
    }
  }

  if (problems.length > 0) {
    console.error('\nassert-docs-links: FAIL\n')
    for (const problem of problems) console.error(`  ${problem}`)
    console.error('')
    console.error('  A broken internal link is a 404 for a reader and a dead end for an agent.')
    console.error('  Fix the link, or add the page it expects.')
    process.exit(1)
  }

  console.log('  every internal link and anchor resolves. OK')
}

main()
