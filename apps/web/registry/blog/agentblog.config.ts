/**
 * agentblog.config.ts
 *
 * ---------------------------------------------------------------------------
 * THE ONE FILE YOU EDIT
 * ---------------------------------------------------------------------------
 * Everything else AgentBlog installed reads from here through `@/lib/config`.
 * Canonical URLs, the sitemap, `robots.txt`, RSS, every JSON-LD `@id`, and the
 * Open Graph cards are all composed from these values, so a wrong value here is
 * wrong in roughly forty places at once.
 *
 * This file must sit at the **project root**, next to `package.json` and
 * `next.config.ts`, including in a `src/` layout. Next.js documents that config
 * files stay at the root, and the registry writes this one with a `~/` target,
 * which means project root by definition.
 *
 * Values are validated once, at module scope, by `resolveConfig` inside
 * `lib/config.ts`. A bad value fails the build with a message naming the key
 * rather than producing `undefined` inside a JSON-LD graph three files later.
 *
 * ---------------------------------------------------------------------------
 * FOR A CODING AGENT EDITING THIS FILE
 * ---------------------------------------------------------------------------
 * Change values, not structure. Do not add fields that are not documented below;
 * `resolveConfig` ignores unknown keys, so an invented field is silently dead.
 * Do not import from this file anywhere: `lib/config.ts` is the only module in
 * the block permitted to read it, and `agentblog doctor` enforces that.
 */
import { defineConfig } from '@/lib/define-config'
import { mdxSource } from '@/lib/sources/mdx'

/**
 * The author a post falls back to when its frontmatter omits `author`.
 *
 * **This value must be a slug that exists in `content/authors.json`.** It ships
 * as `your-name`, which is a placeholder and matches no record, so the first
 * post you write without an explicit `author` fails the build with
 * `unknown author slug "your-name"`. `agentblog init` replaces it with the
 * default author you choose at the prompt; on the registry-only path you set it
 * by hand. Either way, set it to a slug the roster actually has before you write
 * a post that relies on it.
 *
 * The seed posts do not rely on it. Both name `editorial` explicitly, which is
 * the record shipped at the top of `content/authors.json`.
 *
 * It is declared once here because it has to reach two places: `mdxSource`
 * below, which applies it while parsing frontmatter, and the `defaultAuthor`
 * config field, which is the documented surface. The MDX adapter cannot read
 * the config field directly, because `lib/config.ts` imports this file and this
 * file builds the source, so a read back the other way would close an import
 * cycle. One constant, no drift, and nothing imports anything it should not.
 */
const DEFAULT_AUTHOR = 'your-name'

export default defineConfig({
  /**
   * Production origin. https, no trailing slash, no path.
   *
   * Every canonical link, sitemap entry, RSS `<link>`, and schema.org `@id` is
   * built from this string. Point it at the domain readers actually visit, not
   * at a preview deployment, or you will publish canonicals that tell Google to
   * index a URL nobody links to.
   */
  siteUrl: 'https://yourdomain.com',

  /**
   * The Open Graph locale: a language tag and a region joined by an underscore,
   * such as `en_US`, `en_GB`, or `pt_BR`. Emitted verbatim as `og:locale`.
   *
   * It is not a BCP 47 tag, which spells the same value `en-US`. Everywhere BCP
   * 47 is required (schema.org `inLanguage`, the RSS `<language>` element, and
   * `Intl` formatting) the block converts this value through `bcp47Locale` in
   * `lib/config.ts`, so one field serves both spellings and they cannot drift.
   * Write the underscore form here.
   *
   * Multi-locale is a v1 non-goal; the field exists so adding it later is not a
   * breaking change.
   */
  locale: 'en_US',

  brand: {
    /** Publisher name. Appears in `og:site_name` and as `Organization.name`. */
    name: 'Your Brand',

    /**
     * Publisher logo. `width` and `height` are required, not optional.
     *
     * Google's Organization markup needs both, and a logo without dimensions is
     * one of the most common structured data errors on the web. The path is
     * resolved against `siteUrl`, so `/logo.png` means
     * `https://yourdomain.com/logo.png`.
     */
    logo: { url: '/logo.png', width: 512, height: 512 },

    /**
     * Profile and entity URLs for the organization, as absolute URLs.
     *
     * This is the highest value single property in the file. It maps to
     * `Organization.sameAs`, which is how a search engine or an AI assistant
     * resolves "the company that published this" to a real entity instead of a
     * string that happens to look like a company name. Entity resolution is what
     * lets a model cite you by name and attribute the claim correctly.
     *
     * List the profiles that a third party can verify: LinkedIn, Crunchbase,
     * GitHub, YouTube, and Wikidata carry the most weight. Bare handles are
     * rejected at build time, because `@yourbrand` disambiguates nothing.
     *
     * If you fill in exactly one field in this file beyond `siteUrl`, fill in
     * this one.
     */
    sameAs: [
      'https://www.linkedin.com/company/yourbrand',
      'https://www.crunchbase.com/organization/yourbrand',
      'https://github.com/yourbrand',
      'https://www.youtube.com/@yourbrand',
    ],
  },

  /**
   * Where posts come from.
   *
   * `mdxSource` reads `.mdx` files off disk, so publishing is a git push and a
   * deploy. Swapping this for a database backed source changes one line here and
   * nothing else in the blog, which is the whole point of the adapter. Sources
   * that cannot publish without a rebuild also require a `deployHook`, and the
   * compiler will tell you so the moment you swap them in.
   */
  source: mdxSource({ dir: 'content/blog', defaultAuthor: DEFAULT_AUTHOR }),

  /**
   * ISR window in seconds for blog routes. 3600 means a published post is at
   * most an hour stale without a rebuild. The publish webhook revalidates
   * immediately, so this is the floor, not the latency you should expect.
   */
  revalidate: 3600,

  /** Posts per page on `/blog`. Pagination uses real `<a href>` links. */
  postsPerPage: 12,

  /**
   * Tag pages with fewer than this many posts get `robots: { index: false }`.
   *
   * Thin tag pages are the classic way a blog generates hundreds of near empty
   * indexable URLs and spends its own crawl budget on them. Categories are
   * always indexable; tags have to earn it.
   */
  noindexTagsBelow: 5,

  /**
   * IndexNow submission from the publish webhook. Bing, Yandex, Seznam, and
   * Naver consume it, and ChatGPT search leans on Bing's index.
   *
   * Turn this on after `agentblog init` has generated a key, or set
   * `INDEXNOW_KEY` in your environment. `lib/indexnow.ts` reads the config key
   * first and falls back to `process.env.INDEXNOW_KEY`, so the secret never has
   * to live in this committed file. The matching `<key>.txt` must be served from
   * your domain root or every submission comes back 403.
   */
  indexnow: { enabled: false },

  /**
   * Search engine ownership verification, mapped straight onto Next.js
   * `metadata.verification`. One config line instead of a hand edited layout.
   * Paste the token from the HTML tag method, not the whole meta tag.
   */
  // verification: { google: 'your-search-console-token' },

  /**
   * Declared AI access preferences, emitted into `robots.txt`.
   *
   * All three default to `true`. Setting `train: false` is a real tradeoff and
   * not a free one: several crawlers are multi purpose, so opting out of
   * training can also opt you out of the search index that would have cited you.
   */
  aiAccess: { train: true, search: true, agent: true },

  /**
   * Build time config linting. On by default.
   *
   * It reads `next.config.*` off disk and warns when required settings are
   * missing. Set it to `false` only once you know your config is correct and you
   * want the warning gone. Deleting the `preflight` import from
   * `app/blog/layout.tsx` is not the sanctioned way to silence it, because then
   * nothing tells you when a later edit breaks the config again.
   */
  preflight: true,

  /**
   * Pick one URL form and let Next.js redirect the other. This must match
   * `trailingSlash` in `next.config.ts`, because the URL helpers in
   * `lib/config.ts` compose canonicals from it. Two different answers means
   * every canonical points at a URL that immediately redirects.
   */
  trailingSlash: false,

  /**
   * Author slug used when a post omits one. See `DEFAULT_AUTHOR` at the top of
   * this file: the same constant is handed to `mdxSource` above, which is what
   * actually applies it while parsing frontmatter.
   */
  defaultAuthor: DEFAULT_AUTHOR,
})
