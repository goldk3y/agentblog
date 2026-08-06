/**
 * `agentblog.config.ts`: the type, the helper, and the resolver.
 *
 * ---------------------------------------------------------------------------
 * THE SHAPE OF THIS FILE
 * ---------------------------------------------------------------------------
 * There are two config types here, and the distinction is load bearing:
 *
 *   `AgentBlogConfig`          what you write. Plain strings, most keys optional.
 *   `ResolvedAgentBlogConfig`  what the blog reads. Validated, branded, defaulted.
 *
 * `resolveConfig` is the boundary between them. It runs once at module scope in
 * `lib/config.ts`, so a bad value fails the build with a message that names the
 * key rather than producing `undefined` somewhere inside a JSON-LD graph three
 * files later.
 *
 * Branding only exists on the resolved side on purpose. If `siteUrl` were a
 * branded type on the input side you could not write `siteUrl: 'https://x.dev'`
 * in your own config file, which would be a strange thing to ask of a config
 * file. Validate at the boundary, brand on the inside.
 *
 * ---------------------------------------------------------------------------
 * WHY `defineConfig` INSTEAD OF `satisfies`
 * ---------------------------------------------------------------------------
 * `defineConfig` gives contextual inference, so the `deployHook` requirement
 * below can depend on which content source you passed. `satisfies` checks the
 * object against a fixed type and cannot do that.
 *
 * @see https://agentblog.dev/docs/configuration
 */
import { z } from 'zod'

import { AbsoluteUrl, HttpsUrl, Slug } from './schemas.ts'
import type { ContentSource } from './types.ts'
import { AgentBlogContentError } from './types.ts'

/* -------------------------------------------------------------------------- */
/*  What you write                                                            */
/* -------------------------------------------------------------------------- */

export interface AgentBlogConfigBase {
  /**
   * The production origin, https, no trailing slash. Every canonical URL, every
   * sitemap entry, and every JSON-LD `@id` is composed from this.
   */
  readonly siteUrl: string

  /**
   * The Open Graph locale form, `language_TERRITORY` with an underscore, not the
   * BCP-47 hyphen form. `en_US`, not `en-US`. Default `en_US`.
   *
   * It is written this way because `og:locale` accepts only this spelling, and
   * `bcp47Locale` converts it to `en-US` for `inLanguage`, the RSS `<language>`
   * element, and `Intl`. One field, both surfaces, no drift. `resolveConfig`
   * rejects the hyphen form with a message that says so.
   */
  readonly locale?: string

  readonly brand: {
    readonly name: string
    /**
     * `width` and `height` are required, not optional. Google's Organization
     * markup needs both, and a logo without dimensions is one of the most common
     * structured data errors on the web.
     */
    readonly logo: { readonly url: string; readonly width: number; readonly height: number }
    /**
     * Profile and entity URLs for the organization, as absolute URLs.
     *
     * This is the single most valuable property in the whole config. It maps
     * to `Organization.sameAs`, which is how an AI search engine resolves "the
     * company that published this" to a real entity instead of a string. LinkedIn,
     * Crunchbase, GitHub, YouTube, and Wikidata are the ones worth listing.
     */
    readonly sameAs?: readonly string[]
  }

  /** ISR window in seconds for blog routes. Default 3600. */
  readonly revalidate?: number

  /** Posts per page on the index. Default 12. */
  readonly postsPerPage?: number

  /**
   * Tag pages with fewer than this many posts get `robots: { index: false }`.
   *
   * Thin tag pages are the classic way a blog generates hundreds of near-empty
   * indexable URLs and dilutes its own crawl budget. Default 5.
   */
  readonly noindexTagsBelow?: number

  /** IndexNow submission. Requires a key; `agentblog init` generates one. */
  readonly indexnow?: { readonly enabled: boolean; readonly key?: string }

  /** Search engine site verification. Maps straight to Next.js `metadata.verification`. */
  readonly verification?: {
    readonly google?: string
    readonly yandex?: string
    readonly yahoo?: string
    readonly other?: Record<string, string | string[]>
  }

  /**
   * Declared AI access preferences, emitted into `robots.txt`.
   *
   * A forward looking seam. Three standards are converging on machine-readable
   * AI usage preferences (Cloudflare Content Signals, RSL, and the IETF AIPREF
   * draft) and all three attach to robots.txt or HTTP. When one lands, this same
   * config object emits it with no change to your config file.
   *
   * All three default to `true`. Setting `train: false` is a real tradeoff and
   * not a free one: some crawlers are multi-purpose, so opting out of training
   * can also opt you out of the search index that cites you.
   */
  readonly aiAccess?: {
    readonly train?: boolean
    readonly search?: boolean
    readonly agent?: boolean
  }

  /**
   * Build-time config linting. On by default.
   *
   * Set to `false` only if you know your `next.config.ts` is correct and you
   * want the warning gone. This is the sanctioned opt out; deleting the
   * `preflight` import from `app/blog/layout.tsx` is not, because then nothing
   * tells you when a later edit breaks the config.
   */
  readonly preflight?: boolean

  /** Pick one URL form and redirect the other. Default `false`. */
  readonly trailingSlash?: boolean

  /** Author slug used when a post omits one. */
  readonly defaultAuthor?: string
}

/**
 * The full config type.
 *
 * `deployHook` is required when the content source cannot publish without a
 * rebuild, and rejected when it can. That is the section 5.3 failure (publishing
 * a post that was never prerendered, then pinging a crawler to come look at it)
 * moved from a runtime surprise to a compile error.
 *
 * Swap `mdxSource` for `supabaseSource` in your config and the file stops type
 * checking until you supply a deploy hook. That is the single highest value
 * thing the type layer does here.
 */
export type AgentBlogConfig<S extends ContentSource = ContentSource> = AgentBlogConfigBase &
  (S extends ContentSource<'deploy-hook'>
    ? { readonly source: S; readonly deployHook: string }
    : { readonly source: S; readonly deployHook?: never })

/**
 * Identity function that exists purely for its type signature. Wrap your config
 * object in it so TypeScript can infer the content source and apply the
 * `deployHook` rule above.
 */
export function defineConfig<S extends ContentSource>(
  config: AgentBlogConfig<S>,
): AgentBlogConfig<S> {
  return config
}

/* -------------------------------------------------------------------------- */
/*  What the blog reads                                                       */
/* -------------------------------------------------------------------------- */

export interface ResolvedAgentBlogConfig {
  readonly siteUrl: HttpsUrl
  readonly locale: string
  readonly brand: {
    readonly name: string
    readonly logo: { readonly url: string; readonly width: number; readonly height: number }
    readonly sameAs: readonly AbsoluteUrl[]
  }
  readonly source: ContentSource
  readonly deployHook: string | undefined
  readonly revalidate: number
  readonly postsPerPage: number
  readonly noindexTagsBelow: number
  readonly indexnow: { readonly enabled: boolean; readonly key: string | undefined }
  readonly verification: {
    readonly google: string | undefined
    readonly yandex: string | undefined
    readonly yahoo: string | undefined
    readonly other: Record<string, string | string[]> | undefined
  }
  readonly aiAccess: { readonly train: boolean; readonly search: boolean; readonly agent: boolean }
  readonly preflight: boolean
  readonly trailingSlash: boolean
  readonly defaultAuthor: Slug | undefined
}

/**
 * The Open Graph locale form: `language_TERRITORY`, optionally with a script
 * subtag between them. `en_US`, `pt_BR`, `zh_Hans_CN`.
 *
 * Open Graph requires the underscore form. BCP 47, which `inLanguage`, the RSS
 * `<language>` element, and `Intl` all want, writes the same value with a
 * hyphen. One config field serves both because `bcp47Locale` in `lib/config.ts`
 * converts one way, and the conversion only runs one way: an `en-US` written
 * into the config reaches `og:locale` untouched and is invalid there.
 */
const OG_LOCALE = /^[a-z]{2,3}(?:_[A-Z][a-z]{3})*_[A-Z]{2}$/

/**
 * Validation for everything in the config except `source`, which is an object
 * with methods and is checked structurally below instead.
 *
 * ---------------------------------------------------------------------------
 * WHY `.strict()`, AND THE TRADEOFF THAT USUALLY ARGUES AGAINST IT
 * ---------------------------------------------------------------------------
 * `.strict()` on a config object is normally a hostile default, because it
 * forbids a user from parking their own keys next to ours and there is no way
 * for them to opt out.
 *
 * It is right here for one specific reason: the TypeScript side already forbids
 * unknown keys. `defineConfig` takes `AgentBlogConfig`, which has no index
 * signature, so `defineConfig({ revalidatee: 60, ... })` is already an excess
 * property error on the object literal. Without `.strict()` the runtime was
 * simply more permissive than the type, and the gap was reachable in the two
 * ways that matter: a JavaScript `agentblog.config.js`, and a config assembled
 * with a spread (`{ ...base, ...overrides }`), which suppresses excess property
 * checking. `revalidatee: 60` parsed clean and the blog ran on the default ISR
 * window with nothing anywhere saying so.
 *
 * So this does not remove a capability users have. It makes the runtime agree
 * with the type they are already held to. If a real need to carry extra keys
 * appears, the alternative is a declared `extra: Record<string, unknown>` field
 * that is validated as opaque and never read by the block, which keeps typo
 * detection on every key we do own.
 */
const ConfigShapeSchema = z
  .object({
    siteUrl: z
      .string()
      // A trailing slash here produces `https://site.dev//blog/post` in every
      // canonical, so normalise before branding rather than defending downstream.
      .transform((s) => s.replace(/\/+$/, ''))
      .pipe(HttpsUrl),
    locale: z
      .string()
      .default('en_US')
      // Two refinements rather than one, so the far more likely mistake gets the
      // message that names it. `en-US` is what every other locale-shaped API in
      // a Next.js project wants, so it is what people type, and it produces an
      // `og:locale` that Facebook, LinkedIn, and Slack all reject silently.
      .refine((value) => !value.includes('-'), {
        message:
          'is BCP 47 (`en-US`), but `og:locale` requires the Open Graph form with an ' +
          'underscore (`en_US`). Write the underscore form here: `bcp47Locale` in ' +
          '`lib/config.ts` converts it to the hyphen form for `inLanguage`, the RSS ' +
          '`<language>` element, and `Intl`, so this one field serves both.',
      })
      .refine((value) => OG_LOCALE.test(value), {
        message:
          'must be `language_TERRITORY`, lowercase language and uppercase territory, with ' +
          'an optional script subtag between them. `en_US`, `pt_BR`, `zh_Hans_CN`. ' +
          'A bare language (`en`) is not a valid `og:locale`.',
      }),
    brand: z.object({
      name: z.string().min(1),
      logo: z.object({
        url: z.string().min(1),
        width: z.number().int().positive(),
        height: z.number().int().positive(),
      }),
      sameAs: z.array(AbsoluteUrl).default([]),
    }),
    deployHook: z
      .url({ protocol: /^https$/, error: 'deployHook must be an absolute https URL' })
      .describe('Rebuild trigger. Plain http would leak the secret path in transit.')
      .optional(),
    revalidate: z.number().int().nonnegative().default(3600),
    postsPerPage: z.number().int().positive().default(12),
    noindexTagsBelow: z.number().int().nonnegative().default(5),
    indexnow: z
      .object({
        enabled: z.boolean(),
        /*
         * Exactly the pattern the CLI's `isValidIndexNowKey` enforces. The two
         * have to agree: the key becomes a file name at your domain root
         * (`public/<key>.txt`), so a slash or a dot produces a file the CLI and
         * the running app disagree about, and every submission returns 403 with
         * nothing on either side saying why.
         */
        key: z
          .string()
          .regex(
            /^[A-Za-z0-9-]{8,128}$/,
            'IndexNow keys are 8 to 128 characters of A-Z, a-z, 0-9, and hyphen. The key becomes a file name at your domain root, so a slash or a dot silently breaks verification.',
          )
          .optional(),
      })
      .default({ enabled: false }),
    verification: z
      .object({
        google: z.string().optional(),
        yandex: z.string().optional(),
        yahoo: z.string().optional(),
        other: z.record(z.string(), z.union([z.string(), z.array(z.string())])).optional(),
      })
      .default({}),
    aiAccess: z
      .object({
        train: z.boolean().default(true),
        search: z.boolean().default(true),
        agent: z.boolean().default(true),
      })
      .default({ train: true, search: true, agent: true }),
    preflight: z.boolean().default(true),
    trailingSlash: z.boolean().default(false),
    defaultAuthor: Slug.optional(),
  })
  .strict()

const CONTENT_SOURCE_METHODS = [
  'getAllPosts',
  'getPost',
  'getAllCategories',
  'getAllAuthors',
  'getPostsByCategory',
  'getPostsByAuthor',
  'getRelatedPosts',
] as const

/**
 * Parse, default, and brand the user's config. Called exactly once, at module
 * scope in `lib/config.ts`.
 *
 * @throws {AgentBlogContentError} naming the offending key, at build time.
 */
export function resolveConfig(input: unknown): ResolvedAgentBlogConfig {
  if (typeof input !== 'object' || input === null) {
    throw new AgentBlogContentError('agentblog.config.ts', [
      {
        path: [],
        message:
          'default export is missing or is not an object. It should be `export default defineConfig({ ... })`.',
      },
    ])
  }

  const { source, ...rest } = input as Record<string, unknown>

  const parsed = ConfigShapeSchema.safeParse(rest)
  if (!parsed.success) {
    throw new AgentBlogContentError(
      'agentblog.config.ts',
      parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
    )
  }

  const sourceIssues = validateSource(source)
  if (sourceIssues.length > 0) {
    throw new AgentBlogContentError('agentblog.config.ts', sourceIssues)
  }
  const contentSource = source as ContentSource

  if (contentSource.prerenderStrategy === 'deploy-hook' && !parsed.data.deployHook) {
    throw new AgentBlogContentError('agentblog.config.ts', [
      {
        path: ['deployHook'],
        message:
          `source "${contentSource.name}" declares prerenderStrategy "deploy-hook", which means a ` +
          'newly published post is not prerendered until a rebuild runs. Set `deployHook` to a ' +
          'rebuild trigger URL so the publish webhook can rebuild before pinging IndexNow.',
      },
    ])
  }

  return {
    ...parsed.data,
    source: contentSource,
    deployHook: parsed.data.deployHook,
    indexnow: { enabled: parsed.data.indexnow.enabled, key: parsed.data.indexnow.key },
    verification: {
      google: parsed.data.verification.google,
      yandex: parsed.data.verification.yandex,
      yahoo: parsed.data.verification.yahoo,
      other: parsed.data.verification.other,
    },
    defaultAuthor: parsed.data.defaultAuthor,
  }
}

function validateSource(source: unknown): { path: string[]; message: string }[] {
  if (typeof source !== 'object' || source === null) {
    return [
      {
        path: ['source'],
        message:
          'is missing. Set it to a content source, for example `mdxSource({ dir: "content/blog" })`.',
      },
    ]
  }
  const candidate = source as Record<string, unknown>
  const missing = CONTENT_SOURCE_METHODS.filter((m) => typeof candidate[m] !== 'function')
  if (missing.length > 0) {
    return [
      {
        path: ['source'],
        message: `does not implement the ContentSource interface. Missing: ${missing.join(', ')}.`,
      },
    ]
  }
  if (
    candidate['prerenderStrategy'] !== 'build' &&
    candidate['prerenderStrategy'] !== 'deploy-hook' &&
    candidate['prerenderStrategy'] !== 'on-demand'
  ) {
    return [
      {
        path: ['source', 'prerenderStrategy'],
        message: 'must be one of "build", "deploy-hook", or "on-demand".',
      },
    ]
  }
  return []
}
