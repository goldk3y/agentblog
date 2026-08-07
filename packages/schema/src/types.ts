/**
 * AgentBlog domain types and the `ContentSource` contract.
 *
 * ---------------------------------------------------------------------------
 * THE ONE INTERFACE THAT MATTERS
 * ---------------------------------------------------------------------------
 * `ContentSource` is where your posts come from. MDX files on disk is the only
 * implementation shipped in v1, but the interface is deliberately the narrowest
 * thing that a database, a headless CMS, or a hosted service can also satisfy.
 * Swapping storage should be one line in `agentblog.config.ts`.
 *
 * If you are writing your own adapter, read `THE PURITY RULE` below first, then
 * run `runSourceContractTests` from `@agentblog/schema/contract` against it. The
 * suite asserts the eight properties the rest of the blog silently assumes.
 *
 * ---------------------------------------------------------------------------
 * THE PURITY RULE
 * ---------------------------------------------------------------------------
 * Every method must be callable at build time, from `generateStaticParams()` and
 * `generateMetadata()`. No React hooks. No client-only SDKs. No request-scoped
 * auth, which means no `cookies()` and no `headers()`.
 *
 * This is the rule that preserves full prerendering, and full prerendering is
 * what puts the complete article in the first response byte. AI crawlers do not
 * execute JavaScript. A source that needs a request context turns every post
 * into an empty shell for exactly the readers this project exists to reach.
 *
 * @see https://docs.agentblog.dev/reference/content-sources
 */
import type { z } from 'zod'

import type {
  AuthorSchema,
  CategorySchema,
  CitationSchema,
  FaqEntrySchema,
  PostSchema,
} from './schemas.ts'
import type { Slug } from './schemas.ts'

/* -------------------------------------------------------------------------- */
/*  Inferred domain types. Every name below is inferred, never authored.       */
/* -------------------------------------------------------------------------- */

export type Post = z.infer<typeof PostSchema>
export type Author = z.infer<typeof AuthorSchema>
export type Category = z.infer<typeof CategorySchema>
export type Citation = z.infer<typeof CitationSchema>
export type FaqEntry = z.infer<typeof FaqEntrySchema>

/** Frontmatter as authored, before defaults are applied. */
export type PostInput = z.input<typeof PostSchema>

/**
 * A post guaranteed past the draft gate.
 *
 * `generateStaticParams` accepts only these, which makes it structurally
 * impossible to prerender a draft rather than merely unlikely.
 */
export type PublishedPost = Post & { draft: false }

/* -------------------------------------------------------------------------- */
/*  The ContentSource contract                                                */
/* -------------------------------------------------------------------------- */

/**
 * How a newly published post becomes a prerendered route.
 *
 * This matters more than it looks. Next.js does not re-run
 * `generateStaticParams` during ISR, so a slug that did not exist at build time
 * was never in the prerendered set. Each strategy states how that gap is closed:
 *
 * - `'build'`       Content lives in the repository, so publishing is a deploy.
 *                   Nothing extra to do. This is what `mdxSource` returns.
 * - `'deploy-hook'` The publish webhook triggers a rebuild and waits for it to
 *                   succeed before pinging IndexNow. Pinging first invites a
 *                   crawler to a URL that does not exist yet.
 * - `'on-demand'`   The adapter accepts a request-time first render. Only use
 *                   this if you have measured what that render actually returns
 *                   to a non-JavaScript crawler.
 */
export type PrerenderStrategy = 'build' | 'deploy-hook' | 'on-demand'

export interface PostQuery {
  /**
   * Drafts must be opted into, never out of. Defaults to `false` everywhere,
   * including in adapters you write yourself.
   */
  readonly includeDrafts?: boolean
  /** Reserved for multi-locale. v1 adapters may ignore this. */
  readonly locale?: string
}

/**
 * The storage interface. One implementation ships in v1 (`mdxSource`); the rest
 * are drop-in replacements.
 *
 * Two contract points that are easy to miss and expensive to get wrong:
 *
 * 1. **Hydration.** `Post.author` and `Post.category` are fully hydrated
 *    objects, and `getAllPosts()` must return them in a single round trip. Build
 *    time iterates every post, so a lazy reference becomes an N+1 against your
 *    database at exactly the moment you have the most posts. For a SQL adapter
 *    this means a join. Contract test 3 asserts the call count does not scale
 *    with post count.
 *
 * 2. **Errors.** `getPost` returns `null` only when the post is genuinely
 *    absent, which the route turns into `notFound()`. Every other failure
 *    throws `AgentBlogSourceError`. There is no `Result` type here on purpose:
 *    Next.js calls these functions itself, and at build time throwing is
 *    correct. A source that cannot be reached should fail the build rather than
 *    deploy a site whose sitemap quietly lost half its URLs.
 *
 * ---------------------------------------------------------------------------
 * `Post.body` IS EXECUTED AS CODE. THIS IS THE ONE THING TO GET RIGHT
 * ---------------------------------------------------------------------------
 * The body you return is compiled as MDX and evaluated in your server process by
 * `renderMdx`. MDX is a programming language: an expression in the document has
 * `process` and `process.env` in scope, and no option anywhere in the toolchain
 * turns that off, because evaluating expressions is what MDX is for.
 *
 * So the security question an adapter has to answer is not "is this string
 * well-formed", it is **who can write to this store**. `mdxSource` answers it
 * cleanly: bodies are files in the repository, so writing one requires commit
 * access and passes through review and a deploy.
 *
 * An adapter over a database, a CMS, or an HTTP API answers it only if every
 * write path is restricted to authors you would give a shell account to. If it
 * is not, do not return raw MDX from `getPost` and `getAllPosts`. Render the
 * stored content through a CommonMark pipeline with raw HTML disabled and return
 * the result, or gate MDX behind an author role your own code checks. Treating
 * a `body` column as untrusted input after it has reached `renderMdx` is too
 * late.
 */
export interface ContentSource<Strategy extends PrerenderStrategy = PrerenderStrategy> {
  /** How new posts enter the prerendered set. See `PrerenderStrategy`. */
  readonly prerenderStrategy: Strategy

  /** Stable identifier used in error messages and diagnostics, e.g. `'mdx'`. */
  readonly name: string

  getAllPosts(opts?: PostQuery): Promise<PublishedPost[]>
  getPost(slug: Slug, opts?: PostQuery): Promise<Post | null>
  getAllCategories(): Promise<Category[]>
  getAllAuthors(): Promise<Author[]>
  getPostsByCategory(slug: Slug): Promise<PublishedPost[]>
  getPostsByAuthor(slug: Slug): Promise<PublishedPost[]>

  /**
   * Related posts, editorial first.
   *
   * Returns `post.relatedPosts` in the order the author wrote them, then fills
   * to `limit` with computed matches: shared category, then shared tags, then
   * recency. Explicit beats computed; computed fills the gap.
   */
  getRelatedPosts(post: Post, limit: number): Promise<PublishedPost[]>
}

/* -------------------------------------------------------------------------- */
/*  Errors                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * A content source failed to answer.
 *
 * Thrown for transport failures, auth failures, and malformed responses. Never
 * thrown for "no such post", which is `null`.
 */
export class AgentBlogSourceError extends Error {
  /** The `ContentSource.name` that failed, e.g. `'mdx'`. */
  readonly source: string
  /** The method that failed, e.g. `'getAllPosts'`. */
  readonly operation: string

  // Fields are declared and assigned rather than written as constructor
  // parameter properties, so this file runs unchanged under every transpiler
  // including Node's own type stripping, which does not support them.
  constructor(source: string, operation: string, options?: { cause?: unknown }) {
    super(`[agentblog:${source}] ${operation} failed`, options)
    this.name = 'AgentBlogSourceError'
    this.source = source
    this.operation = operation
  }
}

/** One issue from a failed parse, flattened so this type needs no Zod import. */
export interface ContentIssue {
  readonly path: readonly (string | number | symbol)[]
  readonly message: string
}

/**
 * A post, an author record, or the config failed validation.
 *
 * `location` is always a file path or a record id. "Invalid input" at build time
 * is worthless when two hundred files could be the culprit, so a malformed post
 * has to name itself.
 */
export class AgentBlogContentError extends Error {
  /** File path or record id of the offending content. */
  readonly location: string
  /** Every issue found, so one parse reports every problem rather than the first. */
  readonly issues: readonly ContentIssue[]

  constructor(location: string, issues: readonly ContentIssue[]) {
    const detail = issues
      .map((i) => `  ${i.path.map(String).join('.') || '(root)'}: ${i.message}`)
      .join('\n')
    super(`[agentblog] ${location} is invalid:\n${detail}`)
    this.name = 'AgentBlogContentError'
    this.location = location
    this.issues = issues
  }
}
