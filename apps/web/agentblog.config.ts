/**
 * agentblog.dev's own AgentBlog config. Real values, not a template.
 *
 * ---------------------------------------------------------------------------
 * WHY THERE ARE TWO OF THESE FILES IN THE REPO
 * ---------------------------------------------------------------------------
 * `registry/blog/agentblog.config.ts` is the annotated template the registry
 * writes to a consumer's project root. This file is the one agentblog.dev
 * actually runs on, and it sits at this app's root because that is where the
 * template lands too.
 *
 * Both would match `@/agentblog.config` under the registry-first alias in
 * `tsconfig.json`, and the registry copy would win, so `tsconfig.json` pins the
 * exact specifier `@/agentblog.config` to this file. Exact path mappings beat
 * wildcard ones. If you ever see `Your Brand` or `yourdomain.com` rendered on
 * agentblog.dev, that pin is what broke.
 *
 * The `dir` below points into the registry source for the same reason every
 * route under `app/blog/**` is a re-export: the demo blog reads the same seed
 * content the registry ships, so what is published here is what a consumer gets.
 *
 * @see https://docs.agentblog.dev/reference/configuration
 */
import { defineConfig } from '@/lib/define-config'
import { mdxSource } from '@/lib/sources/mdx'

export default defineConfig({
  siteUrl: 'https://agentblog.dev',
  locale: 'en_US',

  brand: {
    name: 'AgentBlog',
    logo: { url: '/logo.png', width: 512, height: 512 },
    sameAs: ['https://github.com/agentblog', 'https://www.npmjs.com/package/agentblog'],
  },

  /*
   * The dogfood blog reads the registry's seed posts rather than a copy under
   * `apps/web/content`. One set of files, so the posts on agentblog.dev are
   * literally the posts a consumer installs.
   */
  source: mdxSource({
    dir: 'registry/blog/content/blog',
    authorsFile: 'content/authors.json',
    categoriesFile: 'content/categories.json',
  }),

  revalidate: 3600,
  postsPerPage: 12,
  noindexTagsBelow: 5,

  /*
   * Off until the key file is generated and served from the domain root. Turning
   * it on without `public/<key>.txt` in place makes every submission come back
   * 403, which reads as success from the caller's side.
   */
  indexnow: { enabled: false },

  aiAccess: { train: true, search: true, agent: true },
  preflight: true,
  trailingSlash: false,

  /*
   * No `defaultAuthor`. Every seed post names its author in frontmatter, and the
   * roster this site reads is the registry's seed `authors.json`, so pointing a
   * default at a slug that does not exist there would fail the build rather than
   * fall back to anything.
   */
})
