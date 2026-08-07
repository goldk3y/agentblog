/**
 * The `next.config.*` patcher.
 *
 * ===========================================================================
 * THE ONE THING IN THIS FILE THAT MUST NEVER BE CHANGED
 * ===========================================================================
 * `htmlLimitedBots` **overrides** the Next.js default bot list. It does not
 * extend it. Next's own documentation says so: "Specifying a `htmlLimitedBots`
 * config will override the Next.js' default list."
 *
 * So a patch that writes only the AI crawlers silently removes Googlebot,
 * Bingbot, Applebot, Twitterbot, LinkedInBot, Slackbot, Discordbot,
 * facebookexternalhit, and WhatsApp from HTML-limited treatment. Those bots then
 * receive `<title>` and `<meta>` inside `<body>` on any page with streamed
 * metadata. That trades an AI-search win for an SEO and social-preview loss,
 * invisibly, which is strictly worse than doing nothing at all.
 *
 * Every write below therefore goes through `buildHtmlLimitedBotsPattern`, which
 * unions the Next defaults, whatever the project already had, and the AI
 * crawlers, in that order, deduplicated case-insensitively. Running it over its
 * own output is a no-op, which is what makes a second `init` a no-op.
 *
 * Second binding fact: the value must be a **`RegExp` literal**, never a string.
 * Next 16's config schema is `z.instanceof(RegExp)` and a string fails config
 * validation outright. `setProperty` emits the initializer verbatim for exactly
 * this reason.
 *
 * @see https://docs.agentblog.dev/reference/files
 */
import { buildHtmlLimitedBotsPattern } from '@agentblog/checks'

import {
  createProject,
  duplicateKeyRisk,
  findExportedConfig,
  findExportedObject,
  getArray,
  getOrCreateObject,
  getProperty,
  getPropertyText,
  normalizeText,
  parseFile,
  setProperty,
  spreadRiskFor,
  SyntaxKind,
} from './ts-project.ts'
import type { ObjectLiteralExpression } from './ts-project.ts'

export interface RemotePattern {
  readonly protocol?: 'https' | 'http'
  readonly hostname: string
  readonly pathname?: string
}

export interface NextConfigPatchOptions {
  /** Qualities the block's `<Image>` calls actually use. Unioned, deduped, sorted. */
  readonly qualities?: readonly number[]
  /** Appended only when no structurally equal entry is already present. */
  readonly remotePatterns?: readonly RemotePattern[]
  /**
   * Every path the content source opens at runtime, as globs relative to the
   * project root, for example `['./content/blog/**\/*', './content/authors.json',
   * './content/categories.json']`. Empty or omitted when the project uses a
   * content source that reads nothing off disk. Build it with `contentPathsOf`.
   */
  readonly contentPaths?: readonly string[]
}

export interface PatchResult {
  readonly source: string
  /** What changed, one line each, for the summary above the diff. */
  readonly changes: readonly string[]
  /** What we declined to change and why. These become doctor warnings. */
  readonly declined: readonly string[]
}

const BOTS_COMMENT = `
/**
 * Bots listed here receive fully blocking metadata: \`<title>\` and every
 * \`<meta>\` tag land inside \`<head>\` rather than streaming into \`<body>\`.
 *
 * This value REPLACES the Next.js default list rather than extending it, so it
 * is the Next.js defaults union the AI crawlers. Narrowing it to only the AI
 * crawlers would silently drop Googlebot, Bingbot, and every social preview
 * bot, which trades an AI-search win for an SEO loss.
 *
 * Written by \`agentblog\`. Re-run \`npx agentblog doctor --fix\` after editing,
 * so the union stays intact.
 */
`

const QUALITIES_COMMENT = `
// Next.js 16 rejects any quality not listed here with a 400 from the image
// optimizer, and the default is [75]. The blog uses 75 for cards and 90 for
// hero images.
`

export function patchNextConfig(
  source: string,
  fileName: string,
  options: NextConfigPatchOptions = {},
): PatchResult {
  const project = createProject()
  const sourceFile = parseFile(project, `/${fileName}`, source)
  const found = findExportedConfig(sourceFile)
  const config = found.object

  const changes: string[] = []
  const declined: string[] = []

  if (!config) {
    return {
      source,
      changes,
      declined: [
        found.declined
          ? `${fileName} was left alone because ${found.declined}`
          : `${fileName} does not export an object literal we can edit safely. Add the settings by hand: htmlLimitedBots, images.qualities.`,
      ],
    }
  }

  patchHtmlLimitedBots(config, changes, declined)
  patchImages(config, options, changes, declined)
  patchFileTracing(config, options, changes, declined)

  return { source: sourceFile.getFullText(), changes, declined }
}

/**
 * The union write, and the three states in which it refuses to happen.
 *
 * ---------------------------------------------------------------------------
 * WHEN THIS DECLINES, AND WHY DECLINING IS THE ONLY HONEST ANSWER
 * ---------------------------------------------------------------------------
 * The header above says a patch must never narrow the set. Three shapes make it
 * impossible to keep that promise by writing, so each one leaves the property
 * byte-identical and reports what a human has to do instead:
 *
 * 1. **A value we cannot read as a literal.** `htmlLimitedBots: MY_BOTS`,
 *    `new RegExp(...)`, or any call expression. `extractPattern` returns
 *    `undefined` for these, and the union would then be computed from the Next
 *    defaults plus our AI list alone. Writing that deletes every bot the user
 *    put in `MY_BOTS` and reports success, which is worse than doing nothing:
 *    the file still reads as if their list is in force.
 *
 * 2. **A spread that could carry the key.** `{ ...base }` merges at runtime and
 *    the later key wins, so appending our own property overrides whatever
 *    `base` contributed while the spread stays on screen looking authoritative.
 *    A spread of a local object literal we can actually read is checked and
 *    allowed through; anything imported or computed is not.
 *
 * 3. **A union that will not compile with the flags in play.** The regex is
 *    evaluated by Next.js before anything else in the application, so a pattern
 *    that throws stops the app from starting at all.
 */
function patchHtmlLimitedBots(
  config: ObjectLiteralExpression,
  changes: string[],
  declined: string[],
): void {
  const duplicate = duplicateKeyRisk(config, 'htmlLimitedBots')
  if (duplicate) {
    declined.push(
      `next.config: ${duplicate}. Nothing was written. Delete the ones you do not want, leave a single \`htmlLimitedBots\`, and re-run.`,
    )
    return
  }

  const spread = spreadRiskFor(config, 'htmlLimitedBots')
  if (spread) {
    declined.push(
      `next.config: \`htmlLimitedBots\` was left alone because ${spread} could already set it, and a key written after a spread silently overrides it. Add the AgentBlog union to that object by hand, or move the spread above an explicit htmlLimitedBots and re-run.`,
    )
    return
  }

  const existingText = getPropertyText(config, 'htmlLimitedBots')
  const existing = existingText === null ? undefined : extractPattern(existingText)
  const flags = existingText === null ? 'i' : unionFlags(existingText)

  if (existingText !== null && existing === undefined) {
    declined.push(
      `next.config: \`htmlLimitedBots\` is set to ${summarize(existingText)}, which is not a regex or plain string literal this tool can read (an identifier, a call, or a template literal that interpolates). It was left exactly as it is, because merging a value we cannot read would delete the bots it matches. Widen it by hand: keep every branch you have and add the Next.js default list plus the AI crawlers, or replace it with a regex literal and re-run.`,
    )
    return
  }

  const pattern = buildHtmlLimitedBotsPattern(existing)
  const initializer = `/${pattern}/${flags}`

  if (!compiles(pattern, flags)) {
    declined.push(
      `next.config: \`htmlLimitedBots\` was left alone because the union of your pattern and the AgentBlog list does not compile as a regular expression with flags \`${flags}\`. Next.js evaluates this value before anything else, so writing it would stop the application from starting.`,
    )
    return
  }

  if (existingText === null) {
    config.addPropertyAssignment({
      name: 'htmlLimitedBots',
      initializer,
      leadingTrivia: BOTS_COMMENT,
    })
    changes.push('next.config: added htmlLimitedBots (Next.js defaults union the AI crawlers)')
    return
  }

  if (setProperty(config, 'htmlLimitedBots', initializer)) {
    changes.push(
      'next.config: widened htmlLimitedBots to a superset of the Next.js default list plus the AI crawlers',
    )
  }
}

/** `true` when the pattern is a legal regular expression under these flags. */
function compiles(pattern: string, flags: string): boolean {
  try {
    new RegExp(pattern, flags)
    return true
  } catch {
    return false
  }
}

/** The value as it appears in the file, trimmed to one readable line. */
function summarize(text: string): string {
  const oneLine = text.replace(/\s+/g, ' ').trim()
  return oneLine.length > 80 ? `\`${oneLine.slice(0, 77)}...\`` : `\`${oneLine}\``
}

/**
 * The source of a regex literal, or the contents of a string literal.
 *
 * ---------------------------------------------------------------------------
 * A TEMPLATE LITERAL WITH A SUBSTITUTION IS NOT READABLE
 * ---------------------------------------------------------------------------
 * Backticks are accepted here because a plain template literal with no
 * substitution is a string like any other, and reading it is correct. One that
 * interpolates is not: for `` `AcmeBot|${OTHER}` `` the characters `${OTHER}`
 * were taken literally and emitted inside a regex literal, where `$` is an end
 * anchor and `{OTHER}` is a literal brace run, producing a branch that can
 * never match anything. The user's dynamic bot list was gone, and the run
 * reported "widened htmlLimitedBots to a superset".
 *
 * So a substitution returns `undefined`, which routes into the same decline
 * path as `htmlLimitedBots: MY_BOTS`: leave the value byte identical and say
 * what a human has to do. A plain template literal keeps working.
 */
function extractPattern(text: string): string | undefined {
  const trimmed = text.trim()
  const asRegex = /^\/((?:[^/\\\n]|\\.)+)\/([gimsuy]*)$/.exec(trimmed)
  if (asRegex?.[1]) return asRegex[1]
  const asString = /^(['"`])([\s\S]*)\1$/.exec(trimmed)
  if (!asString?.[2]) return undefined
  if (asString[1] === '`' && hasSubstitution(asString[2])) return undefined
  return asString[2]
}

/** `true` when the template body interpolates, ignoring an escaped `\${`. */
function hasSubstitution(body: string): boolean {
  for (let index = 0; index < body.length; index += 1) {
    if (body[index] === '\\') {
      index += 1
      continue
    }
    if (body[index] === '$' && body[index + 1] === '{') return true
  }
  return false
}

/** Keep whatever flags they had, and make sure `i` is one of them. */
function unionFlags(text: string): string {
  const match = /\/([gimsuy]*)$/.exec(text.trim())
  const flags = new Set((match?.[1] ?? '').split(''))
  flags.delete('')
  flags.add('i')
  return [...flags].sort().join('')
}

function patchImages(
  config: ObjectLiteralExpression,
  options: NextConfigPatchOptions,
  changes: string[],
  declined: string[],
): void {
  const wantedQualities = options.qualities ?? [75, 90]

  // Same hazard as `htmlLimitedBots`, and for the same reason: the reader takes
  // the first `images`, the runtime takes the last, so editing either one while
  // both exist produces a file that describes a configuration it does not have.
  const duplicate = duplicateKeyRisk(config, 'images')
  if (duplicate) {
    declined.push(
      `next.config: ${duplicate}. images.qualities and images.remotePatterns were not written. Leave a single \`images\` key and re-run.`,
    )
    return
  }

  // Same hazard as `htmlLimitedBots`: an `images` key added after a spread
  // replaces whatever the spread contributed rather than extending it.
  const spread = spreadRiskFor(config, 'images')
  if (spread) {
    declined.push(
      `next.config: \`images\` was left alone because ${spread} could already set it, and a key written after a spread silently overrides it. Add images.qualities to that object by hand.`,
    )
    return
  }

  const images = getOrCreateObject(config, 'images')
  if (!images) {
    declined.push(
      'next.config: `images` is not an object literal, so images settings were skipped.',
    )
    return
  }

  // qualities: union with whatever is there, dedupe, sort. Idempotent by
  // construction, so a second run produces identical text.
  const qualitiesProperty = getProperty(images, 'qualities')
  const existingArray = getArray(images, 'qualities')
  if (qualitiesProperty && !existingArray) {
    declined.push('next.config: `images.qualities` is not an array literal, so it was left alone.')
  } else {
    const existing = (existingArray?.getElements() ?? [])
      .map((element) => Number(element.getText()))
      .filter((value) => Number.isFinite(value))
    const merged = [...new Set([...existing, ...wantedQualities])].sort((a, b) => a - b)
    const initializer = `[${merged.join(', ')}]`
    if (!qualitiesProperty) {
      images.addPropertyAssignment({
        name: 'qualities',
        initializer,
        leadingTrivia: QUALITIES_COMMENT,
      })
      changes.push(`next.config: added images.qualities ${initializer}`)
    } else if (setProperty(images, 'qualities', initializer)) {
      changes.push(`next.config: images.qualities is now ${initializer}`)
    }
  }

  // remotePatterns: append only when no structurally equal entry exists.
  const wantedPatterns = options.remotePatterns ?? []
  if (wantedPatterns.length === 0) return

  const patternsProperty = getProperty(images, 'remotePatterns')
  if (!patternsProperty) {
    images.addPropertyAssignment({
      name: 'remotePatterns',
      initializer: `[${wantedPatterns.map(renderRemotePattern).join(', ')}]`,
    })
    changes.push(`next.config: added images.remotePatterns (${wantedPatterns.length} entries)`)
    return
  }

  const array = getArray(images, 'remotePatterns')
  if (!array) {
    declined.push(
      'next.config: `images.remotePatterns` is not an array literal, so it was left alone.',
    )
    return
  }

  const present = new Set(array.getElements().map((element) => normalizeText(element.getText())))
  for (const wanted of wantedPatterns) {
    const rendered = renderRemotePattern(wanted)
    if (present.has(normalizeText(rendered))) continue
    array.addElement(rendered)
    changes.push(`next.config: added images.remotePatterns entry for ${wanted.hostname}`)
  }
}

function renderRemotePattern(pattern: RemotePattern): string {
  const parts = [`protocol: '${pattern.protocol ?? 'https'}'`, `hostname: '${pattern.hostname}'`]
  if (pattern.pathname) parts.push(`pathname: '${pattern.pathname}'`)
  return `{ ${parts.join(', ')} }`
}

/** `true` when the config sets `agentRules: false`, which doctor reports. */
export function hasAgentRulesDisabled(source: string): boolean {
  const project = createProject()
  const sourceFile = parseFile(project, '/next.config.ts', source)
  const config = findExportedObject(sourceFile)
  if (!config) return false
  const initializer = getProperty(config, 'agentRules')?.getInitializer()
  return initializer?.getKind() === SyntaxKind.FalseKeyword
}

/**
 * The route glob every content path is declared under.
 *
 * `/**` rather than `/blog/**`, because content is read from more routes than
 * the blog ones. `sitemap.xml` and `feed.xml` reread it whenever the publish
 * webhook revalidates them, `/authors/[slug]` rereads it on every ISR refresh,
 * and `/api/publish` reads it on every call. Naming routes one at a time means
 * the next route that reads a post is a 500 nobody wrote down, and a content
 * directory is small enough that the narrower key buys nothing worth that.
 */
const TRACING_ROUTE_KEY = '/**'

/** What the pre-1.0 patcher wrote. Reported when found, never rewritten. */
const LEGACY_ROUTE_KEY = '/blog/**'

/**
 * Declare the files the content source reads in `outputFileTracingIncludes`.
 *
 * `lib/sources/mdx.ts` reads posts and rosters at runtime, not only at build
 * time: the blog index renders on demand because it reads `searchParams`, and
 * the publish webhook regenerates `sitemap.xml` and `feed.xml`. Turbopack cannot
 * see those reads, because the paths are computed from the user's config rather
 * than written as literals.
 *
 * Left undeclared, there are two bad outcomes and no good one. Either Turbopack
 * traces the whole project, which copies the entire source tree and `public/`
 * next to the server bundle and can trip a platform size limit, or the files are
 * missing at runtime and every on-demand render is a 500 while the prerendered
 * pages keep serving, which is a half-broken blog that looks fine on the home
 * page.
 *
 * Declaring them explicitly is what earns the `turbopackIgnore` annotations in
 * `lib/sources/mdx.ts`. The annotation says "we take responsibility for this
 * dependency"; this is where the responsibility is discharged.
 */
function patchFileTracing(
  config: ObjectLiteralExpression,
  options: NextConfigPatchOptions,
  changes: string[],
  declined: string[],
): void {
  const contentPaths = options.contentPaths ?? []
  if (contentPaths.length === 0) return

  const literal = `[${contentPaths.map((p) => `'${p}'`).join(', ')}]`

  const duplicate = duplicateKeyRisk(config, 'outputFileTracingIncludes')
  if (duplicate) {
    declined.push(duplicate)
    return
  }

  const spread = spreadRiskFor(config, 'outputFileTracingIncludes')
  if (spread) {
    declined.push(spread)
    return
  }

  const includes = getOrCreateObject(config, 'outputFileTracingIncludes')
  if (!includes) {
    declined.push(
      'next.config: `outputFileTracingIncludes` is set to something this tool cannot read, so the content files were not declared. Add `' +
        `'${TRACING_ROUTE_KEY}': ${literal}` +
        '` by hand.',
    )
    return
  }

  // A user who already declared something for this key knows more about their
  // deployment than we do. Report rather than merge: a wrong trace list is a
  // deploy that is missing files at runtime, which is worse than a large one.
  // This is also what makes a second `agentblog init` a no-op.
  const existing =
    getProperty(includes, `'${TRACING_ROUTE_KEY}'`) ?? getProperty(includes, TRACING_ROUTE_KEY)
  if (existing) {
    declined.push(
      `next.config: \`outputFileTracingIncludes\` already has an entry for /**, so it was left alone. Confirm it covers ${contentPaths.join(', ')}.`,
    )
    return
  }

  includes.addPropertyAssignment({ name: `'${TRACING_ROUTE_KEY}'`, initializer: literal })
  changes.push(
    `next.config: declared ${contentPaths.join(', ')} in outputFileTracingIncludes, so routes that render on demand can read posts at runtime`,
  )

  // An install from before the key widened still carries the old entry. Both
  // apply, so the deployment is correct either way and deleting someone's config
  // to tidy up is not worth the risk. Say it is redundant and leave it to them.
  const legacy =
    getProperty(includes, `'${LEGACY_ROUTE_KEY}'`) ?? getProperty(includes, LEGACY_ROUTE_KEY)
  if (legacy) {
    declined.push(
      `next.config: the older ${LEGACY_ROUTE_KEY} entry in \`outputFileTracingIncludes\` is now covered by ${TRACING_ROUTE_KEY} and can be deleted.`,
    )
  }
}
