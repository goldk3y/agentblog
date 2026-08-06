---
title: Content sources
description: The ContentSource contract, the MDX adapter that ships with the block, and how to write your own.
group: Reference
order: 3
---

A content source is the boundary between the blog and wherever your posts live. Every route reads posts through `lib/posts.ts`, which is a thin facade over `config.source`, so swapping the source is one line in `agentblog.config.ts` and nothing else in the blog changes.

```ts
source: mdxSource({ dir: 'content/blog' })
```

## The contract

```ts
interface ContentSource<Strategy extends PrerenderStrategy = PrerenderStrategy> {
  readonly name: string
  readonly prerenderStrategy: Strategy

  getAllPosts(opts?: PostQuery): Promise<PublishedPost[]>
  getPost(slug: string, opts?: PostQuery): Promise<Post | null>
  getAllCategories(): Promise<Category[]>
  getAllAuthors(): Promise<Author[]>
  getPostsByCategory(slug: string): Promise<PublishedPost[]>
  getPostsByAuthor(slug: string): Promise<PublishedPost[]>
  getRelatedPosts(post: Post, limit: number): Promise<PublishedPost[]>
}
```

`Post`, `Author`, `Category`, `Citation`, and `FaqEntry` are all inferred from Zod schemas with `z.infer`. None of them is hand-written as an interface, so the shape you validate and the shape you type cannot drift. A lint rule bans `interface Post`.

## prerenderStrategy

This is the field that prevents the worst failure in the system, and it is why the adapter interface carries it rather than leaving publishing to convention.

| Value           | Meaning                                                   | Consequence                                     |
| --------------- | --------------------------------------------------------- | ----------------------------------------------- |
| `'build'`       | Every post is known at build time                         | Nothing extra required. `mdxSource` is this     |
| `'deploy-hook'` | Publishing needs a rebuild before the post exists as HTML | `deployHook` becomes a compile-time requirement |
| `'on-demand'`   | New posts render on first request                         | Measure that render before you rely on it       |

The failure it prevents: you publish a post to a database, the webhook pings IndexNow, a crawler arrives within seconds, and `generateStaticParams` has not re-run since the last deploy, so the route was never prerendered. What the crawler gets depends on your `dynamicParams` setting and on whether the first render finishes inside its timeout. Both are worse than a static file.

With `'deploy-hook'`, the config does not type check until you supply a rebuild trigger, and the publish webhook fires the rebuild before it pings anything.

## The MDX adapter

```ts
mdxSource({
  dir: 'content/blog',
  authorsFile: 'content/authors.json',
  onInvalid: 'warn',
})
```

| Option           | Default                   | Notes                                                                         |
| ---------------- | ------------------------- | ----------------------------------------------------------------------------- |
| `dir`            | required                  | Directory of `.mdx` files, relative to the project root                       |
| `authorsFile`    | `content/authors.json`    | Author records, keyed by slug                                                 |
| `categoriesFile` | `content/categories.json` | Category records, keyed by slug                                               |
| `defaultAuthor`  | none                      | Author slug applied when frontmatter omits `author`. Must exist in the roster |
| `onInvalid`      | `'throw'`                 | `'warn'` skips a malformed post and logs it instead of failing the build      |

`prerenderStrategy` is `'build'`. Frontmatter is validated with `PostFrontmatterSchema`, and a post with a bad `datePublished` or a missing `description` names the file and the field.

A post whose `datePublished` is in the future, or whose `draft` flag is set, is excluded from `getAllPosts` and therefore from the sitemap, the feed, and `generateStaticParams`. It is still readable by slug in development.

`defaultAuthor` appears twice in `agentblog.config.ts`, once as an option to `mdxSource` and once as a config field, and the file declares it as a single constant handed to both. That is not redundancy: `lib/config.ts` imports the config file and the config file builds the source, so an adapter that read the config field back would close an import cycle.

### Where the slug comes from

The file name is the slug. `content/blog/do-ai-crawlers-run-javascript.mdx` publishes at `/blog/do-ai-crawlers-run-javascript`, and the `.mdx` extension is the only thing removed. Only `.mdx` is read: a `.md` file in the directory is skipped with a build-log warning, because the renderer compiles every body as MDX and CommonMark that MDX does not share (an autolink like `<https://example.com>`, a bare `<br>`) fails the compile for the whole site.

A `slug` in frontmatter overrides the file name, silently and with no warning. That is occasionally what you want, when a published URL has to outlive a file rename, and it is otherwise a way to end up at a URL that names no file anyone is editing. Keep them identical unless you have a reason not to, and if you do have a reason, the frontmatter value is the one that is real.

### The two content files posts point at

`author` and `category` in frontmatter are slug references, hydrated from `content/authors.json` and `content/categories.json` during the same read. A slug with no record is a build failure that names the post, the field, and the file to add the record to. An inline object works too, for the one-off post whose author is not in the roster.

This is the coupling that catches most new installs, because the shipped seed posts name shipped records. See [the build fails after I edited content](/docs/troubleshooting#the-build-fails-after-i-edited-content).

## Writing your own adapter

Three things to get right, in order of how expensive they are to get wrong.

### Hydrate in bulk, not per post

`getAllPosts` is called by the sitemap, the feed, and `generateStaticParams`. If your implementation fetches each post's author with a separate query, a 400-post blog issues 400 extra round trips on every build, and the build time grows with the content rather than staying flat.

The adapter contract test spies on the transport and asserts that the call count does not scale with post count. That test exists because this is the mistake every database adapter makes first.

### Return dates as ISO 8601 with an offset

`datePublished` and `dateModified` are branded `IsoDateTime` values. An offset is required, not decorative: Google defaults to Googlebot's own timezone when one is missing, which quietly shifts your publish date.

### Declare your strategy honestly

If publishing does not rebuild the site, say `'deploy-hook'`. The compile error that follows is the point.

## Testing an adapter

```ts
import { runSourceContractTests } from '@agentblog/schema/contract'

runSourceContractTests(async () => myAdapter({/* ... */}), fixtures)
```

The package exports three entry points and no others: `.` for the schemas and types, `./contract` for this suite, and `./config` for `defineConfig`.

Eight assertions, run against a fixture you describe to the suite:

| #   | Assertion                                               | The mistake it catches                                         |
| --- | ------------------------------------------------------- | -------------------------------------------------------------- |
| 1   | Every returned post satisfies `PostSchema`              | A shape that validates in your tests and not in the blog's     |
| 2   | Drafts are excluded by default and included on request  | A draft in the sitemap, or a draft you cannot preview          |
| 3   | Author and category are hydrated in a single round trip | The N+1 that makes build time scale with post count            |
| 4   | Every method is callable with no request context        | An adapter that reads `cookies()` and breaks static generation |
| 5   | An unknown slug returns `null` rather than throwing     | A 500 where a 404 belongs                                      |
| 6   | Related posts return editorial picks first, in order    | Editorial intent silently reordered by a similarity score      |
| 7   | `prerenderStrategy` is declared                         | The staleness bug the field exists to make a compile error     |
| 8   | Ordering is stable across calls                         | A sitemap and an index page that disagree about post order     |

Passing the suite is the definition of a working adapter. `agentblog doctor` does not re-check any of it, because a bad adapter fails at build.

## Roadmap

`mdxSource` ships in v1. Supabase and Convex adapters follow, in that order, along with a hosted source. Because every one implements the same interface and passes the same suite, migrating between them is a config line rather than a rewrite. That is the whole reason this layer exists.
