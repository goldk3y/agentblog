/**
 * The robots.txt subset the live checks reason about.
 *
 * ===========================================================================
 * WHAT THIS FILE IS DEFENDING
 * ===========================================================================
 * `doctor --url` fetched the page as five crawler user agents and never asked
 * whether those crawlers were allowed to want it. A well behaved bot reads
 * `robots.txt` first and never sends the request the fetch measures, so a site
 * serving `Disallow: /` scored a clean pass on the only check in the product
 * that exists to catch a site crawlers cannot read.
 *
 * That is a live possibility rather than a hypothetical: the shipped
 * `app/robots.ts` gates on `VERCEL_ENV === 'production'`, so any correct
 * install on a non-Vercel host serves `Disallow: /` in production until someone
 * sets `AGENTBLOG_PUBLIC_SITE=true`.
 *
 * A parser that guesses would produce the confident wrong answer this check was
 * added to stop, so the precedence rules are pinned here rather than trusted.
 *
 * Run with `pnpm --filter agentblog test`.
 *
 * @see https://www.rfc-editor.org/rfc/rfc9309.html
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { isAllowed, parseRobots } from './live-checks.ts'

test('the shipped non-production robots.txt blocks every agent', () => {
  const groups = parseRobots('User-Agent: *\nDisallow: /\n')

  assert.equal(isAllowed(groups, 'GPTBot', '/blog/post'), false)
  assert.equal(isAllowed(groups, 'Googlebot', '/blog/post'), false)
})

test('the shipped production robots.txt allows posts and blocks the api', () => {
  const groups = parseRobots('User-agent: *\nAllow: /\nDisallow: /api/\n')

  assert.equal(isAllowed(groups, 'ClaudeBot', '/blog/post'), true)
  assert.equal(isAllowed(groups, 'ClaudeBot', '/api/publish'), false)
})

test('a specific group wins over the wildcard, in both directions', () => {
  const blocked = parseRobots('User-agent: *\nAllow: /\n\nUser-agent: GPTBot\nDisallow: /\n')
  assert.equal(isAllowed(blocked, 'GPTBot', '/blog/post'), false)
  assert.equal(isAllowed(blocked, 'ClaudeBot', '/blog/post'), true)

  const allowed = parseRobots('User-agent: *\nDisallow: /\n\nUser-agent: GPTBot\nAllow: /\n')
  assert.equal(isAllowed(allowed, 'GPTBot', '/blog/post'), true)
  assert.equal(isAllowed(allowed, 'ClaudeBot', '/blog/post'), false)
})

test('agent tokens match case insensitively', () => {
  const groups = parseRobots('User-agent: gptbot\nDisallow: /\n')

  assert.equal(isAllowed(groups, 'GPTBot', '/blog/post'), false)
})

test('consecutive user-agent lines share the rules that follow them', () => {
  const groups = parseRobots('User-agent: GPTBot\nUser-agent: ClaudeBot\nDisallow: /blog/\n')

  assert.equal(isAllowed(groups, 'GPTBot', '/blog/post'), false)
  assert.equal(isAllowed(groups, 'ClaudeBot', '/blog/post'), false)
  assert.equal(isAllowed(groups, 'PerplexityBot', '/blog/post'), null)
})

test('the longest matching rule wins, not the first', () => {
  const groups = parseRobots('User-agent: *\nDisallow: /blog/\nAllow: /blog/public/\n')

  assert.equal(isAllowed(groups, 'GPTBot', '/blog/private/x'), false)
  assert.equal(isAllowed(groups, 'GPTBot', '/blog/public/x'), true)
})

test('allow breaks a tie of equal length', () => {
  const groups = parseRobots('User-agent: *\nDisallow: /blog/\nAllow: /blog/\n')

  assert.equal(isAllowed(groups, 'GPTBot', '/blog/post'), true)
})

test('an empty Disallow value grants access rather than blocking everything', () => {
  const groups = parseRobots('User-agent: *\nDisallow:\n')

  assert.equal(isAllowed(groups, 'GPTBot', '/blog/post'), true)
})

test('wildcards and the end anchor are honoured', () => {
  const groups = parseRobots('User-agent: *\nDisallow: /*.pdf$\n')

  assert.equal(isAllowed(groups, 'GPTBot', '/files/report.pdf'), false)
  assert.equal(isAllowed(groups, 'GPTBot', '/files/report.pdf.html'), true)
})

test('comments and blank lines are ignored', () => {
  const groups = parseRobots('# a note\n\nUser-agent: *   # trailing\nDisallow: /   \n')

  assert.equal(isAllowed(groups, 'GPTBot', '/blog/post'), false)
})

test('no applicable group is unknown, not allowed', () => {
  const groups = parseRobots('User-agent: Bingbot\nDisallow: /\n')

  assert.equal(isAllowed(groups, 'GPTBot', '/blog/post'), null)
})

test('sitemap and crawl-delay lines do not become rules', () => {
  const groups = parseRobots(
    'User-agent: *\nCrawl-delay: 1\nAllow: /\nSitemap: https://example.com/sitemap.xml\n',
  )

  assert.equal(groups.length, 1)
  assert.equal(groups[0]?.rules.length, 1)
  assert.equal(isAllowed(groups, 'GPTBot', '/blog/post'), true)
})
