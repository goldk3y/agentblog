/**
 * The adapter contract suite.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS IS FOR
 * ---------------------------------------------------------------------------
 * Every `ContentSource` implementation must pass this suite. It asserts the
 * eight properties the rest of the blog silently assumes, each of which fails
 * quietly rather than loudly when an adapter gets it wrong.
 *
 * If you are writing an adapter, this is the acceptance test. Point it at your
 * factory and a description of your fixture data:
 *
 * ```ts
 * import { runSourceContractTests } from '@agentblog/schema/contract'
 *
 * runSourceContractTests(async () => mySource({ ... }), {
 *   posts: 3,
 *   drafts: 1,
 *   knownSlug: 'hello-world',
 * })
 * ```
 *
 * Run it with `node --test`.
 *
 * ---------------------------------------------------------------------------
 * A NOTE ON ASSERTION 4
 * ---------------------------------------------------------------------------
 * Purity is asserted by construction rather than by mocking. This suite runs in
 * plain Node with no Next.js request store present, so an adapter that reaches
 * for `cookies()` or `headers()` throws on the spot. That is a stronger check
 * than a stub, because it also catches transitive request-scoped access through
 * a client SDK.
 *
 * @see https://agentblog.dev/docs/content-sources
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { PostSchema, type Slug } from './schemas.ts'
import { AgentBlogSourceError, type ContentSource, type Post } from './types.ts'

export interface ContractFixtures {
  /** How many non-draft posts the fixture data contains. */
  readonly posts: number
  /** How many draft posts the fixture data contains. */
  readonly drafts: number
  /** A slug that exists in the fixture data and is not a draft. */
  readonly knownSlug: string
  /**
   * Optional transport call counter, reset and read by assertion 3.
   *
   * Supply this for any adapter that talks to a database or an HTTP API. Without
   * it the N+1 assertion is skipped and reported as skipped, because a filesystem
   * adapter has no transport to count.
   */
  readonly transport?: {
    reset(): void
    count(): number
  }
}

/**
 * Register the contract suite for one adapter.
 *
 * @param makeSource Factory returning a fresh, fully configured source.
 * @param fixtures   Description of the data the source is pointed at.
 */
export function runSourceContractTests(
  makeSource: () => Promise<ContentSource>,
  fixtures: ContractFixtures,
): void {
  describe('ContentSource contract', () => {
    /* 1 ---------------------------------------------------------------- */
    it('1. every returned post satisfies PostSchema', async () => {
      const source = await makeSource()
      const posts = await source.getAllPosts()
      assert.ok(posts.length > 0, 'fixture returned no posts')
      for (const post of posts) {
        const result = PostSchema.safeParse(post)
        assert.ok(
          result.success,
          `post "${post.slug}" does not satisfy PostSchema: ${
            result.success ? '' : JSON.stringify(result.error.issues, null, 2)
          }`,
        )
      }
    })

    /* 2 ---------------------------------------------------------------- */
    it('2. drafts are excluded by default and included on request', async () => {
      const source = await makeSource()
      const published = await source.getAllPosts()
      const withDrafts = await source.getAllPosts({ includeDrafts: true })

      assert.equal(published.length, fixtures.posts, 'default read returned the wrong post count')
      assert.equal(
        withDrafts.length,
        fixtures.posts + fixtures.drafts,
        'includeDrafts did not add exactly the fixture draft count',
      )
      assert.ok(
        published.every((p) => p.draft === false),
        'default read leaked a draft',
      )
    })

    /* 3 ---------------------------------------------------------------- */
    it('3. author and category are hydrated in a single round trip', async (t) => {
      const source = await makeSource()

      if (!fixtures.transport) {
        t.skip('adapter declared no transport to count (filesystem adapters have none)')
        return
      }

      fixtures.transport.reset()
      const posts = await source.getAllPosts()
      const calls = fixtures.transport.count()

      for (const post of posts) {
        assert.equal(typeof post.author, 'object', `post "${post.slug}" did not hydrate author`)
        assert.equal(typeof post.author.name, 'string', `post "${post.slug}" author is a stub`)
        assert.equal(typeof post.category, 'object', `post "${post.slug}" did not hydrate category`)
        assert.equal(typeof post.category.name, 'string', `post "${post.slug}" category is a stub`)
      }

      // The bound is deliberately generous. What matters is that the call count
      // does not scale with the number of posts, which is what turns a build
      // into an N+1 at exactly the moment you have the most content.
      assert.ok(
        calls <= 3,
        `getAllPosts issued ${calls} transport calls for ${posts.length} posts. ` +
          'Hydrate author and category with a join, not per post.',
      )
    })

    /* 4 ---------------------------------------------------------------- */
    it('4. every method is callable with no request context', async () => {
      const source = await makeSource()
      const slug = fixtures.knownSlug as Slug

      // Running in plain Node with no Next.js request store is the assertion:
      // any call into `cookies()` or `headers()` throws here.
      const post = await source.getPost(slug)
      assert.ok(post, `getPost("${fixtures.knownSlug}") returned null for a known slug`)

      await source.getAllCategories()
      await source.getAllAuthors()
      await source.getPostsByCategory(post.category.slug)
      await source.getPostsByAuthor(post.author.slug)
      await source.getRelatedPosts(post, 3)
    })

    /* 5 ---------------------------------------------------------------- */
    it('5. an unknown slug returns null rather than throwing', async () => {
      const source = await makeSource()
      const result = await source.getPost('definitely-not-a-real-post-slug' as Slug)
      assert.equal(result, null, 'an absent post must be null so the route can call notFound()')
    })

    /* 6 ---------------------------------------------------------------- */
    it('6. related posts return editorial picks first, in order', async () => {
      const source = await makeSource()
      const post = await source.getPost(fixtures.knownSlug as Slug)
      assert.ok(post)

      const related = await source.getRelatedPosts(post, 3)
      assert.ok(
        related.every((r) => r.slug !== post.slug),
        'getRelatedPosts returned the post itself',
      )

      const editorial = post.relatedPosts.slice(0, 3)
      for (const [index, slug] of editorial.entries()) {
        assert.equal(
          related[index]?.slug,
          slug,
          `editorial relatedPosts[${index}] must come first and in order`,
        )
      }
    })

    /* 7 ---------------------------------------------------------------- */
    it('7. prerenderStrategy is declared', async () => {
      const source = await makeSource()
      assert.ok(
        ['build', 'deploy-hook', 'on-demand'].includes(source.prerenderStrategy),
        `prerenderStrategy "${source.prerenderStrategy}" is not one of the three permitted values`,
      )
      assert.equal(typeof source.name, 'string')
      assert.ok(source.name.length > 0, 'source.name is used in error messages and must be set')
    })

    /* 8 ---------------------------------------------------------------- */
    it('8. ordering is stable across calls', async () => {
      const source = await makeSource()
      const first = (await source.getAllPosts()).map((p) => p.slug)
      const second = (await source.getAllPosts()).map((p) => p.slug)

      assert.deepEqual(
        first,
        second,
        'getAllPosts returned a different order on the second call. Unstable ordering makes ' +
          'generateStaticParams churn, which invalidates every cached page on every build.',
      )
    })
  })
}

/**
 * Assert that a thrown value is an `AgentBlogSourceError` from a given source.
 * Exported for adapter suites that want to test their own failure path.
 */
export function assertSourceError(error: unknown, sourceName: string): void {
  assert.ok(
    error instanceof AgentBlogSourceError,
    `expected AgentBlogSourceError, received ${String(error)}`,
  )
  assert.equal(error.source, sourceName)
}

/** Narrowing helper for adapter suites. */
export function isPost(value: unknown): value is Post {
  return PostSchema.safeParse(value).success
}
