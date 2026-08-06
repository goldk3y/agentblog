/**
 * The root layout patcher: `metadataBase`, `title.template`, and the RSS
 * `alternates` link.
 *
 * Merge semantics here are "write only when absent, and report what you left
 * alone". A `metadataBase` or a title template is an editorial decision the user
 * may already have made deliberately, and a tool that silently rewrites the site
 * title format is a tool people uninstall. Anything declined becomes a doctor
 * warning, so the user is told rather than left half configured.
 *
 * `title.template` belongs in the **root** layout specifically. Templates apply
 * to child segments only, so a template declared in `app/blog/layout.tsx` never
 * applies to `app/blog/page.tsx`. Putting it anywhere else is a silent no-op for
 * the blog index.
 *
 * @see https://agentblog.dev/docs/installation and 8.1 check 3
 */
import {
  createProject,
  getOrCreateObject,
  getProperty,
  Node,
  parseFile,
  setProperty,
  tsStringLiteral,
} from './ts-project.ts'
import type { ObjectLiteralExpression, SourceFile } from './ts-project.ts'
import type { PatchResult } from './next-config.ts'

export interface RootLayoutPatchOptions {
  readonly siteUrl: string
  readonly brandName: string
  /** Adds `alternates.types` with the RSS feed when absent. */
  readonly feedPath?: string
}

export function patchRootLayout(
  source: string,
  fileName: string,
  options: RootLayoutPatchOptions,
): PatchResult {
  const project = createProject()
  const sourceFile = parseFile(project, `/${fileName}`, source)

  const changes: string[] = []
  const declined: string[] = []

  const metadata = findMetadataObject(sourceFile)
  if (!metadata) {
    declined.push(
      `${fileName} has no \`export const metadata = { ... }\` object we can edit. Add metadataBase: new URL(${tsStringLiteral(options.siteUrl)}) and title.template by hand.`,
    )
    return { source, changes, declined }
  }

  patchMetadataBase(metadata, options, changes, declined)
  patchTitleTemplate(metadata, options, changes, declined)
  if (options.feedPath) patchFeedAlternate(metadata, options.feedPath, changes, declined)

  return { source: sourceFile.getFullText(), changes, declined }
}

/**
 * `export const metadata: Metadata = { ... }`.
 *
 * A layout that uses `generateMetadata` instead is legal and returns `null`
 * here. The caller reports that rather than inventing a second metadata source,
 * because two of them in one segment is its own bug.
 */
function findMetadataObject(sourceFile: SourceFile): ObjectLiteralExpression | null {
  const declaration = sourceFile.getVariableDeclaration('metadata')
  const initializer = declaration?.getInitializer()
  if (!initializer) return null
  if (Node.isObjectLiteralExpression(initializer)) return initializer
  if (Node.isSatisfiesExpression(initializer) || Node.isAsExpression(initializer)) {
    const inner = initializer.getExpression()
    if (Node.isObjectLiteralExpression(inner)) return inner
  }
  return null
}

/**
 * `new URL('')` throws `TypeError: Invalid URL` while the module is being
 * evaluated, which means `next dev` and `next build` both fail on the file this
 * patcher just wrote. This is reachable from `doctor --fix` as well as from
 * `init`, so the check lives here rather than only at the prompt.
 */
function isUsableSiteUrl(value: string): boolean {
  // Anchored at both ends, and quotes and backslashes are excluded outright.
  // The old form validated only the prefix, so `https://x.com') + evil` passed
  // and the only thing standing between that and emitted code was the capture
  // class of an unrelated regex in `doctor/fix.ts`. Values are emitted through
  // `tsStringLiteral` now as well: two independent reasons, because either one
  // failing alone should not be enough.
  if (!/^https?:\/\/[^\s'"`\\]+$/.test(value.trim())) return false
  try {
    new URL(value.trim())
    return true
  } catch {
    return false
  }
}

function patchMetadataBase(
  metadata: ObjectLiteralExpression,
  options: RootLayoutPatchOptions,
  changes: string[],
  declined: string[],
): void {
  if (!isUsableSiteUrl(options.siteUrl)) {
    declined.push(
      `app/layout: metadataBase was not written because ${JSON.stringify(options.siteUrl)} is not an absolute URL. Writing it would produce new URL(${JSON.stringify(options.siteUrl)}), which throws TypeError: Invalid URL when Next.js evaluates the layout, so every build would fail. Set siteUrl in agentblog.config.ts, or pass --site-url.`,
    )
    return
  }

  const existing = getProperty(metadata, 'metadataBase')
  if (existing) {
    declined.push(
      `app/layout: metadataBase is already set to ${existing.getInitializer()?.getText() ?? 'a value'}. Left alone. Confirm it matches siteUrl in agentblog.config.ts.`,
    )
    return
  }
  metadata.addPropertyAssignment({
    name: 'metadataBase',
    initializer: `new URL(${tsStringLiteral(options.siteUrl)})`,
    leadingTrivia:
      '\n// Next.js needs this to turn relative metadata URLs into absolute ones.\n// The build errors without it once any metadata field is relative.\n',
  })
  changes.push(`app/layout: added metadataBase (${options.siteUrl})`)
}

function patchTitleTemplate(
  metadata: ObjectLiteralExpression,
  options: RootLayoutPatchOptions,
  changes: string[],
  declined: string[],
): void {
  if (options.brandName.trim() === '') {
    declined.push(
      "app/layout: title.template was not written because no brand name is available. The template would have been '%s | ', which puts a trailing separator on every page title. Set brand.name in agentblog.config.ts, or pass --brand.",
    )
    return
  }

  const titleProperty = getProperty(metadata, 'title')
  const template = tsStringLiteral(`%s | ${options.brandName}`)

  if (!titleProperty) {
    metadata.addPropertyAssignment({
      name: 'title',
      initializer: `{ default: ${tsStringLiteral(options.brandName)}, template: ${template} }`,
    })
    changes.push('app/layout: added title.default and title.template')
    return
  }

  const initializer = titleProperty.getInitializer()
  if (!initializer || !Node.isObjectLiteralExpression(initializer)) {
    declined.push(
      'app/layout: `title` is a plain value, so title.template was not added. Change it to { default: ..., template: ... } to give post titles a site suffix.',
    )
    return
  }

  const titleObject = getOrCreateObject(metadata, 'title')
  if (!titleObject) return
  if (getProperty(titleObject, 'template')) {
    declined.push('app/layout: title.template is already set. Left alone.')
    return
  }
  setProperty(titleObject, 'template', template)
  changes.push('app/layout: added title.template')
}

function patchFeedAlternate(
  metadata: ObjectLiteralExpression,
  feedPath: string,
  changes: string[],
  declined: string[],
): void {
  const alternates = getOrCreateObject(metadata, 'alternates')
  if (!alternates) {
    declined.push('app/layout: `alternates` is not an object literal, so the RSS link was skipped.')
    return
  }
  if (getProperty(alternates, 'types')) {
    declined.push('app/layout: alternates.types is already set. The RSS link was left alone.')
    return
  }
  setProperty(alternates, 'types', `{ 'application/rss+xml': ${tsStringLiteral(feedPath)} }`)
  changes.push(`app/layout: added the RSS alternates link (${feedPath})`)
}
