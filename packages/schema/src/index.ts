/**
 * `@agentblog/schema`: the domain contract.
 *
 * This package is consumed by the CLI, by adapter test suites, and by
 * `scripts/codegen.mjs`, which copies `schemas.ts`, `types.ts`, and
 * `define-config.ts` verbatim into `apps/web/registry/blog/lib/` so that the
 * files shipped into a consumer's repository stay identical to the ones we
 * test against. Editing the copies directly will fail CI.
 *
 * Exports are named rather than star-re-exported, so a consumer's bundler can
 * tree-shake and so the public API is reviewable in one place.
 */

export {
  AbsoluteUrl,
  AuthorSchema,
  CategorySchema,
  CitationSchema,
  FaqEntrySchema,
  HttpsUrl,
  IsoDateTime,
  PostFrontmatterSchema,
  PostSchema,
  Slug,
} from './schemas.ts'

export {
  AgentBlogContentError,
  AgentBlogSourceError,
  type Author,
  type Category,
  type Citation,
  type ContentIssue,
  type ContentSource,
  type FaqEntry,
  type Post,
  type PostInput,
  type PostQuery,
  type PrerenderStrategy,
  type PublishedPost,
} from './types.ts'

export {
  type AgentBlogConfig,
  type AgentBlogConfigBase,
  defineConfig,
  type ResolvedAgentBlogConfig,
  resolveConfig,
} from './define-config.ts'
