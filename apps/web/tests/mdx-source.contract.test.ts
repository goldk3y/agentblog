/**
 * The acceptance test for `mdxSource`.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS FILE LIVES HERE
 * ---------------------------------------------------------------------------
 * It cannot live next to the adapter under `registry/blog/**`, because everything
 * in that tree is copied verbatim into the consumer's repository and a consumer
 * should not inherit our fixtures. It cannot live in `packages/schema` either,
 * since that package must not import the registry. `apps/web/tests` is the one
 * place that can see both.
 *
 * The suite itself is `runSourceContractTests` from `@agentblog/schema/contract`,
 * the same eight assertions every adapter has to pass. Anything below it is
 * specific to the MDX adapter: the authoring conveniences and the draft gate.
 *
 * Run with `pnpm --filter @agentblog/web test`.
 *
 * @see https://agentblog.dev/docs/content-sources
 */
import assert from 'node:assert/strict'
import path from 'node:path'
import { describe, it } from 'node:test'

import { runSourceContractTests } from '@agentblog/schema/contract'
import type { Slug } from '@agentblog/schema'

import { mdxSource } from '@/lib/sources/mdx'

/**
 * `mdxSource` resolves its paths against `process.cwd()`, so the fixture paths are
 * expressed relative to wherever the test runner was launched from. Computing that
 * relative path here keeps the suite runnable from the app directory, from the repo
 * root, and from Turborepo.
 */
const fixtures = path.relative(process.cwd(), path.join(import.meta.dirname, 'fixtures/content'))

const makeSource = async () =>
  mdxSource({
    dir: path.join(fixtures, 'blog'),
    authorsFile: path.join(fixtures, 'authors.json'),
    categoriesFile: path.join(fixtures, 'categories.json'),
  })

/* The fixture set: alpha-post, beta-post, gamma-post published; delta-draft not. */
runSourceContractTests(makeSource, {
  posts: 3,
  drafts: 1,
  knownSlug: 'alpha-post',
  // No transport to count. A filesystem adapter has none, so assertion 3 reports
  // itself as skipped rather than passing vacuously.
})

describe('mdxSource authoring conveniences', () => {
  it('defaults the slug to the filename', async () => {
    const source = await makeSource()
    const post = await source.getPost('alpha-post' as Slug)
    // alpha-post.mdx declares no `slug` in its frontmatter.
    assert.equal(post?.slug, 'alpha-post')
  })

  it('widens a bare YYYY-MM-DD date to an offset-bearing timestamp', async () => {
    const source = await makeSource()
    const post = await source.getPost('alpha-post' as Slug)
    assert.equal(post?.datePublished, '2026-03-01T00:00:00.000Z')
    assert.equal(post?.dateModified, '2026-03-02T00:00:00.000Z')
    assert.equal(post?.citations[0]?.datePublished, '2026-01-05T00:00:00.000Z')
  })

  it('hydrates author and category from their slug strings', async () => {
    const source = await makeSource()
    const post = await source.getPost('beta-post' as Slug)
    assert.equal(post?.author.name, 'Second Author')
    assert.equal(post?.category.name, 'Beta')
  })

  it('derives Category.latestPostDate from published posts only', async () => {
    const source = await makeSource()
    const categories = await source.getAllCategories()
    const alpha = categories.find((c) => c.slug === 'alpha')
    // delta-draft is newer (2026-04-01) but is a draft, so alpha-post wins.
    assert.equal(alpha?.latestPostDate, '2026-03-01T00:00:00.000Z')
  })
})

describe('mdxSource draft gate', () => {
  it('returns null for a draft unless includeDrafts is set', async () => {
    const source = await makeSource()
    assert.equal(await source.getPost('delta-draft' as Slug), null)
    const preview = await source.getPost('delta-draft' as Slug, { includeDrafts: true })
    assert.equal(preview?.slug, 'delta-draft')
  })

  it('keeps drafts out of by-author and by-category reads', async () => {
    const source = await makeSource()
    const byAuthor = await source.getPostsByAuthor('test-author' as Slug)
    const byCategory = await source.getPostsByCategory('alpha' as Slug)
    assert.deepEqual(
      byAuthor.map((p) => p.slug),
      ['alpha-post', 'gamma-post'],
    )
    assert.deepEqual(
      byCategory.map((p) => p.slug),
      ['alpha-post', 'gamma-post'],
    )
  })
})

describe('mdxSource ordering and related posts', () => {
  it('sorts published posts by datePublished descending', async () => {
    const source = await makeSource()
    const posts = await source.getAllPosts()
    assert.deepEqual(
      posts.map((p) => p.slug),
      ['alpha-post', 'beta-post', 'gamma-post'],
    )
  })

  it('honours editorial order and never returns the post itself or a draft', async () => {
    const source = await makeSource()
    const post = await source.getPost('alpha-post' as Slug)
    assert.ok(post)
    const related = await source.getRelatedPosts(post, 3)
    // Frontmatter lists gamma-post before beta-post, which is the reverse of the
    // recency order. Editorial intent wins.
    assert.deepEqual(
      related.map((p) => p.slug),
      ['gamma-post', 'beta-post'],
    )
  })

  it('fills computed matches by category, then shared tags, then recency', async () => {
    const source = await makeSource()
    const post = await source.getPost('beta-post' as Slug)
    assert.ok(post)
    // beta-post has no editorial relatedPosts, so every slot is computed. Nothing
    // shares its category, so the shared "shared" tag and recency decide.
    const related = await source.getRelatedPosts(post, 2)
    assert.deepEqual(
      related.map((p) => p.slug),
      ['alpha-post', 'gamma-post'],
    )
  })
})
