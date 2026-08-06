/**
 * `mdxSource`: MDX files on disk. The reference `ContentSource` implementation.
 *
 * ---------------------------------------------------------------------------
 * READ THIS FIRST IF YOU ARE WRITING YOUR OWN ADAPTER
 * ---------------------------------------------------------------------------
 * This file is the worked example. A `supabaseSource`, a `sanitySource`, or a
 * hosted source is the same seven methods with a different `readBundle`. The
 * shape below is deliberate and worth copying:
 *
 *   1. `mdxSource(opts)` resolves its options once and returns a plain object
 *      of closures. No class, no `this`, so a method can be destructured off
 *      the source and passed to `generateStaticParams` without losing binding.
 *   2. Every read goes through `loadBundle`, which returns posts, authors, and
 *      categories together. One trip, everything hydrated. Contract assertion 3
 *      exists because a lazy `author` reference becomes an N+1 against your
 *      database at exactly the moment you have the most posts.
 *   3. Sorting happens once, in `byRecencyThenSlug`, and is total. Contract
 *      assertion 8 exists because unstable ordering makes `generateStaticParams`
 *      churn, which invalidates every cached page on every build.
 *   4. Public methods are wrapped in `guarded`, which turns anything unexpected
 *      into an `AgentBlogSourceError` naming the operation that failed.
 *
 * ---------------------------------------------------------------------------
 * THE PURITY RULE
 * ---------------------------------------------------------------------------
 * Every method here is callable at build time, from `generateStaticParams()` and
 * `generateMetadata()`. No hooks, no `cookies()`, no `headers()`. That is what
 * keeps posts fully prerendered, and full prerendering is what puts the whole
 * article in the first response byte for crawlers that do not run JavaScript.
 *
 * ---------------------------------------------------------------------------
 * WHAT `prerenderStrategy: 'build'` MEANS HERE
 * ---------------------------------------------------------------------------
 * Content lives in the repository, so publishing a post is a git push and a
 * deploy. A new slug is always present the next time `generateStaticParams` runs,
 * so there is nothing extra to do when one appears, and `agentblog.config.ts`
 * does not require a `deployHook`. A database-backed source cannot say that,
 * which is why it declares `'deploy-hook'` instead.
 *
 * @see https://agentblog.dev/docs/content-sources
 */
import { readFile, readdir, stat } from 'node:fs/promises'
import path from 'node:path'

import matter from 'gray-matter'

import { AuthorSchema, CategorySchema, PostSchema } from '@/lib/schemas'
import type { Slug } from '@/lib/schemas'
import { AgentBlogContentError, AgentBlogSourceError } from '@/lib/types'
import type {
  Author,
  Category,
  ContentIssue,
  ContentSource,
  Post,
  PostQuery,
  PublishedPost,
} from '@/lib/types'

/* -------------------------------------------------------------------------- */
/*  Options                                                                   */
/* -------------------------------------------------------------------------- */

export interface MdxSourceOptions {
  /** Directory of .mdx files, relative to the project root. No default. */
  readonly dir: string
  /** Author records, relative to the project root. Defaults to `content/authors.json`. */
  readonly authorsFile?: string
  /** Category records, relative to the project root. Defaults to `content/categories.json`. */
  readonly categoriesFile?: string
  /**
   * Author slug applied to a post whose frontmatter omits `author`. No default,
   * so a post without an author fails validation unless this is set.
   *
   * ---------------------------------------------------------------------------
   * WHY THIS IS AN OPTION AND NOT READ FROM `config.defaultAuthor`
   * ---------------------------------------------------------------------------
   * `agentblog.config.ts` calls `mdxSource(...)` to build its own `source` field,
   * and `lib/config.ts` imports `agentblog.config.ts`. If this file imported
   * `@/lib/config` to read `config.defaultAuthor`, the cycle would close:
   * config imports the source, source imports config. Under a bundler that
   * resolves to a partially initialised module, which surfaces as
   * `config is undefined` at module scope and not as a helpful error.
   *
   * The slug therefore travels as an option, passed by the one file that already
   * owns both sides. Do not "simplify" this by importing the config here.
   */
  readonly defaultAuthor?: string
  /** Fail the build on a malformed post (default) or skip it with a warning. */
  readonly onInvalid?: 'throw' | 'warn'
}

/** `ContentSource.name`, and the prefix on every error this file throws. */
const SOURCE_NAME = 'mdx'

const DEFAULT_AUTHORS_FILE = 'content/authors.json'
const DEFAULT_CATEGORIES_FILE = 'content/categories.json'

/**
 * `.mdx` only, and the `?` that used to be on the `x` was a real bug rather than
 * a convenience.
 *
 * `lib/render-mdx.tsx` compiles every body as MDX, so a `.md` file accepted here
 * was never treated as CommonMark, it was treated as MDX with a different
 * extension. That is fine until a post uses markdown that MDX does not share.
 * `<https://example.com/x>` is a legal CommonMark autolink and is what many
 * editors emit; under the MDX parser the `<` opens a JSX tag and the compile
 * fails with `Unexpected character '/' (U+002F) before local name`, which aborts
 * `next build` for the whole site. `<br>` and `<img src=...>` fail the same way.
 *
 * The alternative was a second, CommonMark pipeline for `.md`. It was rejected:
 * every other surface in the product (the component map, the FAQ and answer
 * capsule components, the docs, the seed posts) says MDX, so a second dialect
 * would mean two renderers, two component stories, and a post whose behaviour
 * depends on its file extension. One dialect, named honestly, is the smaller
 * thing to maintain. `readMdFileNames` below makes the exclusion audible.
 */
const POST_FILE = /\.mdx$/

/** Matched only to warn about it. See `POST_FILE` and `warnAboutMarkdownFiles`. */
const IGNORED_MARKDOWN_FILE = /\.md$/

/* -------------------------------------------------------------------------- */
/*  Internal shapes                                                           */
/* -------------------------------------------------------------------------- */

/** Options after `process.cwd()` resolution. Also the memoization cache key. */
interface ResolvedPaths {
  readonly dir: string
  readonly authorsFile: string
  readonly categoriesFile: string
  readonly defaultAuthor: string | undefined
  readonly onInvalid: 'throw' | 'warn'
}

/**
 * One read of the content directory: every post (drafts included), sorted, with
 * `author` and `category` already hydrated, plus the full record lists.
 *
 * Drafts are kept in the bundle rather than filtered here so that a single cached
 * read can answer both `getAllPosts()` and `getAllPosts({ includeDrafts: true })`.
 */
interface ContentBundle {
  readonly posts: readonly Post[]
  readonly authors: readonly Author[]
  readonly categories: readonly Category[]
}

/**
 * The slice of a Zod schema that the record loader needs.
 *
 * Declared structurally rather than as `z.ZodType<T>` because `AuthorSchema` and
 * `CategorySchema` both use `.default()`, which makes their input type differ from
 * their output type. A structural type accepts both without a cast and does not
 * pin this file to one Zod major version.
 */
interface RecordSchema<T> {
  safeParse(
    value: unknown,
  ):
    | { readonly success: true; readonly data: T }
    | { readonly success: false; readonly error: { readonly issues: readonly ZodIssueLike[] } }
}

interface ZodIssueLike {
  readonly path: readonly (string | number | symbol)[]
  readonly message: string
}

/* -------------------------------------------------------------------------- */
/*  The factory                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Build a content source over a directory of MDX files.
 *
 * ```ts
 * // agentblog.config.ts
 * export default defineConfig({
 *   source: mdxSource({ dir: 'content/blog', defaultAuthor: 'your-name' }),
 *   defaultAuthor: 'your-name',
 *   // ...
 * })
 * ```
 *
 * `defaultAuthor` appears twice on purpose. See `MdxSourceOptions.defaultAuthor`
 * for the import cycle that keeps this file from reading the config itself.
 */
export function mdxSource(opts: MdxSourceOptions): ContentSource<'build'> {
  // Paths resolve against `process.cwd()`, which Next.js sets to the project root
  // for both `next dev` and `next build`. Resolving once here means an option
  // typo surfaces as one clear path in the error message rather than as a
  // different path per call site.
  /*
   * `turbopackIgnore` on the three resolves, and it is not a workaround.
   *
   * Turbopack traces filesystem access statically. It cannot prove which
   * directory `opts.dir` resolves to, so it assumes the worst and traces the
   * whole project, copying your source tree and `public/` next to the server
   * bundle. That inflates every deployment and can trip a platform size limit.
   *
   * A computed path is unavoidable here: the directory comes from the user's
   * `agentblog.config.ts`, so it can never be a literal. The annotation says we
   * take responsibility for declaring the dependency, and the way to declare it
   * is `outputFileTracingIncludes` in `next.config.ts`, which `agentblog init`
   * writes for you and which `doctor` checks. That is the correct mechanism:
   * it names the content directory explicitly instead of tracing everything.
   */
  const paths: ResolvedPaths = {
    dir: path.resolve(/* turbopackIgnore: true */ process.cwd(), opts.dir),
    authorsFile: path.resolve(
      /* turbopackIgnore: true */ process.cwd(),
      opts.authorsFile ?? DEFAULT_AUTHORS_FILE,
    ),
    categoriesFile: path.resolve(
      /* turbopackIgnore: true */ process.cwd(),
      opts.categoriesFile ?? DEFAULT_CATEGORIES_FILE,
    ),
    defaultAuthor: opts.defaultAuthor,
    onInvalid: opts.onInvalid ?? 'throw',
  }

  const load = (): Promise<ContentBundle> => loadBundle(paths)

  async function getAllPosts(query?: PostQuery): Promise<PublishedPost[]> {
    return guarded('getAllPosts', async () => {
      const bundle = await load()
      return selectPosts(bundle.posts, query)
    })
  }

  async function getPost(slug: Slug, query?: PostQuery): Promise<Post | null> {
    return guarded('getPost', async () => {
      const bundle = await load()
      const post = bundle.posts.find((candidate) => candidate.slug === slug)
      // A missing file is `null` so the route can call `notFound()`. Everything
      // else throws, because at build time a source that cannot answer should
      // fail the build rather than ship a sitemap that quietly lost URLs.
      if (!post) return null
      // A draft is "absent" too unless the caller opted in. Drafts are opted into,
      // never out of, so a preview route has to ask.
      if (post.draft && query?.includeDrafts !== true) return null
      return post
    })
  }

  async function getAllCategories(): Promise<Category[]> {
    return guarded('getAllCategories', async () => [...(await load()).categories])
  }

  async function getAllAuthors(): Promise<Author[]> {
    return guarded('getAllAuthors', async () => [...(await load()).authors])
  }

  async function getPostsByCategory(slug: Slug): Promise<PublishedPost[]> {
    return guarded('getPostsByCategory', async () => {
      const bundle = await load()
      return selectPosts(bundle.posts, undefined).filter((post) => post.category.slug === slug)
    })
  }

  async function getPostsByAuthor(slug: Slug): Promise<PublishedPost[]> {
    return guarded('getPostsByAuthor', async () => {
      const bundle = await load()
      return selectPosts(bundle.posts, undefined).filter((post) => post.author.slug === slug)
    })
  }

  async function getRelatedPosts(post: Post, limit: number): Promise<PublishedPost[]> {
    return guarded('getRelatedPosts', async () => {
      const bundle = await load()
      // Never the post itself, never a draft. Both are contract assertion 6.
      const pool = selectPosts(bundle.posts, undefined).filter((c) => c.slug !== post.slug)
      return pickRelated(post, pool, limit)
    })
  }

  return {
    prerenderStrategy: 'build',
    name: SOURCE_NAME,
    getAllPosts,
    getPost,
    getAllCategories,
    getAllAuthors,
    getPostsByCategory,
    getPostsByAuthor,
    getRelatedPosts,
  }
}

/* -------------------------------------------------------------------------- */
/*  Error boundary                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Wrap a public method so that anything unexpected becomes an
 * `AgentBlogSourceError` naming the operation.
 *
 * `AgentBlogContentError` passes through untouched. It already names the offending
 * file and every Zod issue in it, which is strictly more useful than
 * "getAllPosts failed".
 */
async function guarded<T>(operation: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run()
  } catch (error) {
    if (error instanceof AgentBlogContentError) throw error
    throw new AgentBlogSourceError(SOURCE_NAME, operation, { cause: error })
  }
}

/* -------------------------------------------------------------------------- */
/*  The per-process cache                                                     */
/* -------------------------------------------------------------------------- */

/**
 * One entry per resolved directory, holding the in-flight promise rather than the
 * resolved value so that concurrent callers share a single read.
 *
 * A production build calls into this source many times for the same content:
 * `generateStaticParams` once, then `generateMetadata` and the page body once per
 * post, plus `sitemap.ts` and `feed.xml`. Without memoization a 200 post blog
 * re-reads 200 files a few hundred times.
 */
const bundleCache = new Map<string, { stamp: string; bundle: Promise<ContentBundle> }>()

/**
 * Every field of `ResolvedPaths`, not just the three paths.
 *
 * `defaultAuthor` and `onInvalid` are both read by `parsePost` and
 * `normalizeFrontmatter`, so two sources over the same directory that differ
 * only in those two produce genuinely different bundles. Keyed on the paths
 * alone, the second source silently received the first one's bundle: a config
 * with `onInvalid: 'warn'` inherited a bundle built under `'throw'`, and a post
 * relying on a different `defaultAuthor` came back hydrated with the wrong
 * person. Nothing errors, which is why it survived review the first time.
 *
 * NUL as the separator rather than a space, because a directory path is allowed
 * to contain a space and a separator that can appear inside a component is not a
 * separator: dir 'a b' plus authorsFile 'c' and dir 'a' plus authorsFile 'b c'
 * join to the same string. NUL cannot appear in a path on any platform this
 * code runs on.
 */
function cacheKey(paths: ResolvedPaths): string {
  return [
    paths.dir,
    paths.authorsFile,
    paths.categoriesFile,
    paths.defaultAuthor ?? '',
    paths.onInvalid,
  ].join('\u0000')
}

/**
 * A cheap fingerprint of the content: the directory's mtime plus the mtime of
 * each metadata file.
 *
 * A directory's mtime changes when a file is added to it or removed from it, so
 * three `stat` calls are enough to notice that the post set changed, without
 * re-reading every post to find out. Editing a post in place does not change the
 * directory mtime, and that is fine: an edit to a file already in the deployment
 * arrives with a rebuild, and under `next dev` the cache is off entirely.
 *
 * Why this matters at all, given that `mdxSource` declares
 * `prerenderStrategy: 'build'`. The publish webhook revalidates `/sitemap.xml`
 * and `/feed.xml`, and those handlers re-render inside a long-lived server
 * process. Caching for the lifetime of that process means a revalidation
 * regenerates the sitemap from the post set the process started with, so the
 * webhook appears to work and changes nothing. Worse, a production server runs
 * several worker processes, so whether the new post appeared would depend on
 * which worker answered, which is the least debuggable failure available.
 */
async function contentStamp(paths: ResolvedPaths): Promise<string> {
  const parts = await Promise.all(
    [paths.dir, paths.authorsFile, paths.categoriesFile].map(async (target) => {
      try {
        const info = await stat(target)
        return String(info.mtimeMs)
      } catch {
        // A missing metadata file is a real condition that `readBundle` reports
        // properly. Here it only has to be a stable part of the fingerprint.
        return 'missing'
      }
    }),
  )
  return parts.join(' ')
}

async function loadBundle(paths: ResolvedPaths): Promise<ContentBundle> {
  // The tradeoff, stated explicitly: caching is on only when `NODE_ENV` is
  // 'production', which is what `next build` sets. Under `next dev` every read
  // hits the disk again, so saving a file shows up on the next request instead of
  // requiring a server restart. That costs a directory scan per request in dev,
  // which is the correct trade: dev has tens of posts and a human waiting, build
  // has hundreds of posts and no one waiting.
  if (process.env['NODE_ENV'] !== 'production') return readBundle(paths)

  const key = cacheKey(paths)
  const stamp = await contentStamp(paths)
  const cached = bundleCache.get(key)
  if (cached && cached.stamp === stamp) return cached.bundle

  const bundle = readBundle(paths)
  bundleCache.set(key, { stamp, bundle })
  // Never cache a rejection. A transient read failure should be retryable rather
  // than poisoning every later call in the process.
  void bundle.catch(() => {
    const current = bundleCache.get(key)
    if (current?.bundle === bundle) bundleCache.delete(key)
  })
  return bundle
}

/* -------------------------------------------------------------------------- */
/*  Reading                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * The single round trip.
 *
 * Authors and categories are read once, before any post is parsed, and passed to
 * every post as lookup maps. This is the filesystem version of the join that a
 * SQL adapter has to write, and it is what contract assertion 3 is about.
 */
async function readBundle(paths: ResolvedPaths): Promise<ContentBundle> {
  const [authors, categories] = await Promise.all([
    readRecords<Author>(paths.authorsFile, AuthorSchema, 'author'),
    readRecords<Category>(paths.categoriesFile, CategorySchema, 'category'),
  ])

  const authorsBySlug = new Map(authors.map((author) => [String(author.slug), author]))
  const categoriesBySlug = new Map(categories.map((c) => [String(c.slug), c]))

  const entries = (await readdir(paths.dir, { withFileTypes: true })).filter((entry) =>
    entry.isFile(),
  )

  const fileNames = entries
    .map((entry) => entry.name)
    .filter((name) => POST_FILE.test(name))
    // Sort the filenames, not just the posts, so `onInvalid: 'warn'` prints its
    // warnings in the same order on every machine.
    .sort(compareStrings)

  warnAboutMarkdownFiles(
    entries
      .map((entry) => entry.name)
      .filter((name) => IGNORED_MARKDOWN_FILE.test(name))
      .sort(compareStrings),
    paths.dir,
  )

  const sources = await Promise.all(
    fileNames.map(async (name) => ({
      name,
      file: path.join(paths.dir, name),
      raw: await readFile(path.join(paths.dir, name), 'utf8'),
    })),
  )

  const posts: Post[] = []
  for (const source of sources) {
    const post = parsePost(source, authorsBySlug, categoriesBySlug, paths)
    if (post) posts.push(post)
  }
  posts.sort(byRecencyThenSlug)

  // `Category.latestPostDate` is derived, not authored: `sitemap.ts` needs a real
  // `lastModified` for each category hub, and stamping the build time there is a
  // false freshness signal. Deriving it needs the posts, and hydrating the posts
  // needs the categories, so it happens in a second pass and the hydrated
  // references are rewritten to match. One category object, one value.
  const enriched = withLatestPostDates(categories, posts)
  const enrichedBySlug = new Map(enriched.map((c) => [String(c.slug), c]))
  const linked = posts.map((post) => {
    const category = enrichedBySlug.get(String(post.category.slug))
    return category ? { ...post, category } : post
  })

  return { posts: linked, authors, categories: enriched }
}

/**
 * Say out loud that a `.md` file in the content directory is not being published.
 *
 * A warning rather than a thrown error, and the line between the two is what the
 * file most likely is. A `.md` file here is usually an author's `README.md` or a
 * note to themselves, and failing every build in a repository that happens to
 * contain one would be hostile. It is occasionally a post whose extension is
 * wrong, and that case is silent 404 territory, which is exactly the failure
 * mode this whole file is written to avoid. One line on stdout at build time
 * covers both: the note-keeper ignores it, the author who renamed a file finds
 * it in the build log.
 */
function warnAboutMarkdownFiles(names: readonly string[], dir: string): void {
  if (names.length === 0) return
  console.warn(
    `${SOURCE_NAME}: ignoring ${names.length} .md file(s) in ${dir}: ${names.join(', ')}.\n` +
      '  AgentBlog compiles posts as MDX only. Rename to .mdx to publish, or move the file ' +
      'out of the content directory to silence this.',
  )
}

/**
 * Read and validate a JSON array of records.
 *
 * The `location` on every error is the file path, so a bad author record names the
 * file it lives in instead of surfacing as "invalid input" during a build that
 * touched two hundred files.
 */
async function readRecords<T>(file: string, schema: RecordSchema<T>, label: string): Promise<T[]> {
  const raw = await readFile(file, 'utf8')

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    throw new AgentBlogContentError(file, [
      { path: [], message: `is not valid JSON: ${String(error)}` },
    ])
  }

  if (!Array.isArray(parsed)) {
    throw new AgentBlogContentError(file, [
      { path: [], message: `must be a JSON array of ${label} records.` },
    ])
  }

  const records: T[] = []
  const issues: ContentIssue[] = []
  for (const [index, entry] of parsed.entries()) {
    const result = schema.safeParse(entry)
    if (result.success) records.push(result.data)
    else
      issues.push(
        ...result.error.issues.map((i) => ({ path: [index, ...i.path], message: i.message })),
      )
  }
  if (issues.length > 0) throw new AgentBlogContentError(file, issues)

  return records
}

/**
 * Parse one file into a `Post`, or return `null` when it is invalid and
 * `onInvalid` is `'warn'`.
 */
function parsePost(
  source: { name: string; file: string; raw: string },
  authors: ReadonlyMap<string, Author>,
  categories: ReadonlyMap<string, Category>,
  paths: ResolvedPaths,
): Post | null {
  const { data, content } = matter(source.raw)
  const normalized = normalizeFrontmatter(data, content, source.name, authors, categories, paths)

  const result = PostSchema.safeParse(normalized.value)
  const issues: ContentIssue[] = [
    ...normalized.issues,
    ...(result.success
      ? []
      : result.error.issues.map((i) => ({ path: i.path, message: i.message }))),
  ]

  if (issues.length === 0 && result.success) return result.data

  const error = new AgentBlogContentError(source.file, issues)
  if (paths.onInvalid === 'warn') {
    console.warn(`${error.message}\n  Skipping this post because onInvalid is "warn".`)
    return null
  }
  throw error
}

/* -------------------------------------------------------------------------- */
/*  Frontmatter normalisation                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Apply the authoring conveniences, then hand a plain object to `PostSchema`.
 *
 * Frontmatter is written by humans and by agents, so a small amount of tolerance
 * here buys a lot. Each convenience below is deliberate and bounded; anything not
 * listed is the schema's business, not this function's.
 */
function normalizeFrontmatter(
  raw: Record<string, unknown>,
  body: string,
  fileName: string,
  authors: ReadonlyMap<string, Author>,
  categories: ReadonlyMap<string, Category>,
  paths: ResolvedPaths,
): { value: Record<string, unknown>; issues: ContentIssue[] } {
  const issues: ContentIssue[] = []
  const value: Record<string, unknown> = { ...raw, body }

  // Convenience 1: the slug defaults to the filename. `my-post.mdx` is already a
  // statement of intent, and repeating it in frontmatter is one more thing to get
  // out of sync with the URL.
  if (value['slug'] === undefined) value['slug'] = fileName.replace(POST_FILE, '')

  // Convenience 2: a bare `YYYY-MM-DD` is widened to midnight UTC. `IsoDateTime`
  // requires an offset because Google reinterprets an offset-less date in
  // Googlebot's own timezone, but demanding `2026-08-06T00:00:00Z` in handwritten
  // frontmatter is hostile. Widening also covers the YAML parser turning an
  // unquoted date into a JavaScript `Date`, which would otherwise fail every time.
  value['datePublished'] = widenDate(value['datePublished'])
  value['dateModified'] = widenDate(value['dateModified'])
  if (Array.isArray(value['citations'])) {
    value['citations'] = value['citations'].map((citation) =>
      isRecord(citation) && 'datePublished' in citation
        ? { ...citation, datePublished: widenDate(citation['datePublished']) }
        : citation,
    )
  }

  // Convenience 3: an omitted `author` falls back to the configured default.
  // This runs before hydration below, so the default goes through the same
  // "does that slug exist" check as an author written in frontmatter and a
  // typo in the config is reported against the post that relied on it.
  if (value['author'] === undefined && paths.defaultAuthor !== undefined) {
    value['author'] = paths.defaultAuthor
  }

  // Convenience 4: `author` and `category` may be a slug string. Frontmatter
  // references a record; the adapter hydrates it. Inline objects still work, for
  // the one-off post whose author is not in the roster.
  if (typeof value['author'] === 'string') {
    const author = authors.get(value['author'])
    if (author) value['author'] = author
    else issues.push(unknownRecord('author', value['author'], paths.authorsFile))
  }
  if (typeof value['category'] === 'string') {
    const category = categories.get(value['category'])
    if (category) value['category'] = category
    else issues.push(unknownRecord('category', value['category'], paths.categoriesFile))
  }

  return { value, issues }
}

const BARE_DATE = /^\d{4}-\d{2}-\d{2}$/

function widenDate(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string' && BARE_DATE.test(value)) return `${value}T00:00:00Z`
  return value
}

function unknownRecord(field: 'author' | 'category', slug: string, file: string): ContentIssue {
  return {
    path: [field],
    message: `unknown ${field} slug "${slug}". Add a record with that slug to ${file}, or inline the ${field} object in this post's frontmatter.`,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/* -------------------------------------------------------------------------- */
/*  Selection, ordering, and related posts                                    */
/* -------------------------------------------------------------------------- */

function isPublished(post: Post): post is PublishedPost {
  return post.draft === false
}

/**
 * Apply the draft gate.
 *
 * The cast on the `includeDrafts` branch is the one place this file lies to the
 * type system, and it is the interface's own wart: the list methods return
 * `PublishedPost[]` so that `generateStaticParams` is structurally unable to emit
 * a draft slug, which leaves no honest type for the opted-in preview read.
 */
function selectPosts(posts: readonly Post[], query: PostQuery | undefined): PublishedPost[] {
  if (query?.includeDrafts === true) return [...posts] as PublishedPost[]
  return posts.filter(isPublished)
}

/**
 * Newest first, then slug ascending as a tiebreak.
 *
 * The tiebreak is not cosmetic. Two posts published on the same day would
 * otherwise sort by whatever order the filesystem handed them back, and an
 * ordering that changes between machines makes `generateStaticParams` churn.
 */
function byRecencyThenSlug(a: Post, b: Post): number {
  const delta = Date.parse(b.datePublished) - Date.parse(a.datePublished)
  return delta !== 0 ? delta : compareStrings(String(a.slug), String(b.slug))
}

/** Code-unit comparison, not `localeCompare`, so the order does not vary by locale. */
function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/**
 * Editorial picks first, in the order the author wrote them, then computed fills.
 *
 * Precedence is the whole point: `post.relatedPosts` is a human decision and beats
 * anything this function can infer. Computed matches only fill the remaining slots,
 * ranked by shared category, then shared tag count, then recency.
 */
function pickRelated(post: Post, pool: readonly PublishedPost[], limit: number): PublishedPost[] {
  const bySlug = new Map(pool.map((candidate) => [String(candidate.slug), candidate]))
  const picked: PublishedPost[] = []
  const taken = new Set<string>()

  for (const slug of post.relatedPosts) {
    if (picked.length >= limit) break
    const match = bySlug.get(String(slug))
    if (!match || taken.has(String(slug))) continue
    picked.push(match)
    taken.add(String(slug))
  }

  if (picked.length >= limit) return picked

  const tags = new Set(post.tags.map((tag) => tag.toLowerCase()))
  const sharedTags = (candidate: Post): number =>
    candidate.tags.filter((tag) => tags.has(tag.toLowerCase())).length
  const sameCategory = (candidate: Post): number =>
    candidate.category.slug === post.category.slug ? 1 : 0

  const computed = pool
    .filter((candidate) => !taken.has(String(candidate.slug)))
    .sort(
      (a, b) =>
        sameCategory(b) - sameCategory(a) ||
        sharedTags(b) - sharedTags(a) ||
        byRecencyThenSlug(a, b),
    )

  return [...picked, ...computed.slice(0, limit - picked.length)]
}

/**
 * Stamp each category with the publish date of its newest published post.
 * Categories with no published posts are returned unchanged, so `sitemap.ts` can
 * tell "no posts yet" from "posts, none recent".
 */
function withLatestPostDates(categories: readonly Category[], posts: readonly Post[]): Category[] {
  const latest = new Map<string, string>()
  for (const post of posts) {
    if (post.draft) continue
    const slug = String(post.category.slug)
    const current = latest.get(slug)
    if (!current || Date.parse(post.datePublished) > Date.parse(current)) {
      latest.set(slug, post.datePublished)
    }
  }
  return categories.map((category) => {
    const date = latest.get(String(category.slug))
    return date ? { ...category, latestPostDate: date as Category['latestPostDate'] } : category
  })
}
