/**
 * Checks over the project's configuration files.
 *
 * Covers doctor checks 1, 2, 3, 11, 25, 26, 27, and 31.
 *
 * Check 1 is the one that matters. It asserts a **superset**: the configured
 * `htmlLimitedBots` pattern must contain every branch of the Next.js default
 * list plus every AI crawler. A pattern that dropped default branches is
 * reported at a higher severity than a missing pattern, and as a separate
 * finding, because a narrowed pattern is an active regression against Googlebot
 * and every social preview bot, whereas a missing one is only a missed
 * opportunity. `@agentblog/checks` produces both findings with those severities
 * already, which is why this file delegates rather than re-deriving them.
 *
 * @see https://docs.agentblog.dev/reference/files
 */
import {
  analyzeHtmlLimitedBots,
  checkNextConfig,
  checkRootLayout,
  stripComments,
} from '@agentblog/checks'

import { usesDefineConfig } from '../patchers/agentblog-config.ts'
import { appPathLabel } from '../detect/project.ts'
import { blockFiles } from '../detect/routes.ts'
import { readFile, toPosixRelative } from '../util/fs.ts'
import { readJsonc } from '../detect/resolve.ts'
import { join } from 'node:path'
import { NO_COMPONENTS_JSON_MESSAGE, PLACEHOLDER_AUTHOR } from '../constants.ts'
import type { DoctorContext } from './context.ts'

export function runConfigChecks(ctx: DoctorContext): void {
  const { project, reporter } = ctx

  checkNextConfigFile(ctx)
  checkRootLayoutFile(ctx)
  checkComponentsJson(ctx)
  checkTsconfig(ctx)
  checkAgentblogConfig(ctx)
  checkSingleConfigImporter(ctx)
  checkSeedContent(ctx)

  if (project.workspaceRoot) {
    reporter.group('Monorepo')
    reporter.fail('32 monorepo disclosure', {
      id: 'monorepo-detected',
      severity: 'info',
      message: `This project sits inside a workspace rooted at ${project.workspaceRoot}. agentblog.config.ts, AGENTS.md, and the skills were written to ${project.root}, not to the workspace root.`,
      remedy: 'https://docs.agentblog.dev/guides/monorepo',
    })
  }
}

function checkNextConfigFile(ctx: DoctorContext): void {
  const { project, reporter } = ctx
  reporter.group('next.config')

  if (!project.nextConfigPath) {
    reporter.fail('1 htmlLimitedBots', {
      id: 'next-config-missing',
      severity: 'error',
      message: 'No next.config file found. This does not look like a Next.js project root.',
      remedy: 'Run this command from the directory that holds package.json and next.config.ts.',
    })
    return
  }

  const label = toPosixRelative(project.root, project.nextConfigPath)
  const source = readFile(project.nextConfigPath)
  if (source === null) {
    reporter.skip('1 htmlLimitedBots', `${label} could not be read`)
    return
  }

  const findings = checkNextConfig({ source, path: label })
  for (const finding of findings) reporter.finding(nameForFinding(finding.id), finding)

  const report = analyzeHtmlLimitedBots(source)
  if (
    report.configured &&
    report.missingDefaults.length === 0 &&
    report.missingAiCrawlers.length === 0
  ) {
    reporter.pass('1 htmlLimitedBots is a superset of the Next.js defaults plus the AI crawlers')
  }
  if (!findings.some((finding) => finding.id === 'image-qualities-missing')) {
    reporter.pass('11 images.qualities is configured')
  }
  if (!findings.some((finding) => finding.id === 'cache-components-enabled')) {
    reporter.pass('2 cacheComponents is off')
  }
}

const FINDING_NAMES: Readonly<Record<string, string>> = {
  'html-limited-bots-missing': '1 htmlLimitedBots missing',
  'html-limited-bots-narrowed': '1 htmlLimitedBots narrowed',
  'html-limited-bots-incomplete': '1 htmlLimitedBots incomplete',
  'image-qualities-missing': '11 images.qualities',
  'cache-components-enabled': '2 cacheComponents',
  'metadata-base-missing': '3 metadataBase',
  'title-template-missing': '3 title.template',
}

function nameForFinding(id: string): string {
  return FINDING_NAMES[id] ?? id
}

function checkRootLayoutFile(ctx: DoctorContext): void {
  const { project, reporter } = ctx
  reporter.group('app/layout')

  if (!project.rootLayoutPath) {
    reporter.fail('3 root layout', {
      id: 'root-layout-missing',
      severity: 'error',
      message: `No root layout found at ${appPathLabel(project, 'app/layout.tsx')}.`,
      remedy: 'App Router projects need a root layout. Create one before installing the blog.',
    })
    return
  }

  const label = toPosixRelative(project.root, project.rootLayoutPath)
  const source = readFile(project.rootLayoutPath)
  if (source === null) {
    reporter.skip('3 root layout', `${label} could not be read`)
    return
  }

  const findings = checkRootLayout({ source, path: label })
  for (const finding of findings) reporter.finding(nameForFinding(finding.id), finding)
  if (findings.length === 0) reporter.pass('3 metadataBase and title.template are set')

  // `--fix` adds this link, so it is announced here rather than appearing in a
  // diff nothing warned about. `alternates.types` is where RSS goes in Next.js
  // 16 metadata; without it the feed exists and no reader can discover it.
  if (/application\/rss\+xml/.test(source)) {
    reporter.pass('3 the root layout advertises the RSS feed')
  } else {
    reporter.fail('3 RSS alternates link', {
      id: 'rss-alternates-missing',
      severity: 'warning',
      message: `${label} does not set alternates.types['application/rss+xml'], so /feed.xml is served but never advertised in the document head.`,
      remedy: 'npx agentblog doctor --fix adds the link pointing at /feed.xml.',
      fixable: true,
    })
  }
}

function checkComponentsJson(ctx: DoctorContext): void {
  const { project, reporter } = ctx
  reporter.group('shadcn')

  if (!project.componentsJson) {
    reporter.fail('31 components.json', {
      id: 'components-json-missing',
      severity: 'error',
      message: 'components.json is missing, so this project has never run shadcn init.',
      remedy: NO_COMPONENTS_JSON_MESSAGE.split('\n').join(' '),
    })
    return
  }
  reporter.pass('31 components.json is present')
}

/**
 * Check 25. Reported as warnings on purpose: this is the consumer's tsconfig,
 * not ours, and the flags are advice about their own type safety rather than
 * something AgentBlog depends on.
 */
function checkTsconfig(ctx: DoctorContext): void {
  const { project, reporter } = ctx
  reporter.group('tsconfig')

  // Read as JSONC: Next.js writes comments into tsconfig.json, and a config
  // file people edit by hand acquires comments regardless.
  const tsconfig = readJsonc<{ compilerOptions?: Record<string, unknown> }>(
    join(project.root, 'tsconfig.json'),
  )
  if (!tsconfig) {
    reporter.skip('25 tsconfig flags', 'tsconfig.json is absent or could not be parsed')
    return
  }

  const options = tsconfig.compilerOptions ?? {}
  const missing = (['exactOptionalPropertyTypes', 'noUncheckedIndexedAccess'] as const).filter(
    (flag) => options[flag] !== true,
  )
  if (missing.length > 0) {
    reporter.fail('25 tsconfig flags', {
      id: 'tsconfig-strictness',
      severity: 'warning',
      message: `tsconfig.json does not set ${missing.join(' or ')}. The blog compiles either way, but posts[0] is typed as defined when it is not.`,
      remedy: `Add "${missing[0]}": true to compilerOptions.`,
    })
  }

  const resolution = options['moduleResolution']
  if (
    typeof resolution === 'string' &&
    !['bundler', 'nodenext'].includes(resolution.toLowerCase())
  ) {
    reporter.fail('25 moduleResolution', {
      id: 'tsconfig-module-resolution',
      severity: 'warning',
      message: `tsconfig.json sets moduleResolution "${resolution}". TypeScript 7 rejects everything except bundler and nodenext.`,
      remedy: 'Set "moduleResolution": "bundler".',
    })
  }
  if (options['baseUrl'] !== undefined) {
    reporter.fail('25 baseUrl', {
      id: 'tsconfig-base-url',
      severity: 'warning',
      message:
        'tsconfig.json sets baseUrl, which TypeScript 7 removed. paths now resolve against the project root.',
      remedy: 'Delete baseUrl and make the paths entries project relative.',
    })
  }
  if (missing.length === 0 && options['baseUrl'] === undefined) {
    reporter.pass('25 tsconfig is TypeScript 7 ready')
  }
}

function checkAgentblogConfig(ctx: DoctorContext): void {
  const { project, reporter } = ctx
  reporter.group('agentblog.config')

  if (!project.agentblogConfigPath) {
    reporter.fail('26 agentblog.config.ts', {
      id: 'agentblog-config-missing',
      severity: 'error',
      message: 'agentblog.config.ts is missing from the project root.',
      remedy: 'npx shadcn@latest add @agentblog/blog, then npx agentblog init',
    })
    return
  }

  const source = readFile(project.agentblogConfigPath)
  if (source === null) {
    reporter.skip('26 defineConfig', 'agentblog.config.ts could not be read')
    return
  }

  if (!usesDefineConfig(source)) {
    reporter.fail('26 defineConfig', {
      id: 'define-config-missing',
      severity: 'error',
      message:
        'agentblog.config.ts exports a bare object rather than defineConfig({ ... }). Without the wrapper, a source that needs a deployHook stops being a compile error and becomes a runtime surprise.',
      remedy: 'Wrap the exported object in defineConfig(...) from @/lib/define-config.',
    })
  } else {
    reporter.pass('26 agentblog.config.ts uses defineConfig')
  }

  // Comments first. The template explains `siteUrl` using the placeholder as an
  // example, so matching the raw text would report a correctly filled in config
  // as unconfigured.
  const code = stripComments(source)
  if (/https:\/\/yourdomain\.com/.test(code)) {
    reporter.fail('26 siteUrl placeholder', {
      id: 'site-url-placeholder',
      severity: 'error',
      message:
        'agentblog.config.ts still has the placeholder siteUrl. Every canonical URL, sitemap entry, and JSON-LD @id is composed from it.',
      remedy: 'Set siteUrl to your production origin, https, with no trailing slash.',
    })
  }
  /*
   * Check 26, the author half.
   *
   * Both spellings are matched because the template holds the slug in a
   * `DEFAULT_AUTHOR` constant while a hand edited config often flattens it to a
   * literal, and a check that knows only one of them passes on the other.
   *
   * It reports as an error even though a fresh install builds clean. Both seed
   * posts name `editorial` explicitly, so the placeholder only bites on the
   * first post written without an `author` line, and it bites as a build
   * failure. An unfired build failure sitting in a config file is not a warning.
   */
  const defaultAuthor =
    /defaultAuthor\s*:\s*['"`]([^'"`]+)['"`]/.exec(code)?.[1] ??
    /DEFAULT_AUTHOR\s*=\s*['"`]([^'"`]+)['"`]/.exec(code)?.[1]
  if (defaultAuthor === PLACEHOLDER_AUTHOR) {
    reporter.fail('26 defaultAuthor placeholder', {
      id: 'default-author-placeholder',
      severity: 'error',
      message: `agentblog.config.ts still has the placeholder defaultAuthor "${PLACEHOLDER_AUTHOR}", which matches no record in content/authors.json. The first post written without an explicit author fails the build with: unknown author slug "${PLACEHOLDER_AUTHOR}".`,
      remedy:
        'Set defaultAuthor to a slug that exists in content/authors.json, such as editorial. In the shipped template that means editing the DEFAULT_AUTHOR constant at the top of the file.',
    })
  } else if (defaultAuthor !== undefined) {
    reporter.pass(`26 defaultAuthor is "${defaultAuthor}", not the placeholder`)
  }

  if (/sameAs:\s*\[\s*\]/.test(code)) {
    reporter.fail('brand.sameAs', {
      id: 'same-as-empty',
      severity: 'warning',
      message:
        'brand.sameAs is empty, so Organization markup has nothing to resolve your company to. This is the highest value field in the config.',
      remedy: 'Add absolute profile URLs: LinkedIn, Crunchbase, GitHub, Wikidata.',
    })
  }
}

/**
 * Check 27. Exactly one module may import `@/agentblog.config`, and it is
 * `lib/config.ts`. More than one means the alias has been hardcoded somewhere
 * the CLI cannot fix for a `src/` layout.
 */
function checkSingleConfigImporter(ctx: DoctorContext): void {
  const { project, reporter } = ctx
  reporter.group('agentblog.config')

  // Comments are stripped first. `lib/preflight.ts` documents the alias hazard
  // by quoting the import statement in its own header comment, and a raw text
  // match reads that as a second importer. Matching prose is how a check earns
  // the reputation of crying wolf, which is how it stops being read.
  const importers = blockFiles(project).filter((path) => {
    const source = readFile(path)
    if (source === null) return false
    return /(?:^|\n)\s*import[^\n]*from\s+['"]@\/agentblog\.config['"]/.test(stripComments(source))
  })

  if (importers.length === 0) {
    reporter.skip('27 single config importer', 'no installed block files import the config yet')
    return
  }
  if (importers.length === 1 && /lib[/\\]config\.tsx?$/.test(importers[0]!)) {
    reporter.pass('27 lib/config.ts is the only module importing agentblog.config')
    return
  }
  reporter.fail('27 single config importer', {
    id: 'multiple-config-importers',
    severity: 'warning',
    message: `${importers.length} modules import @/agentblog.config: ${importers
      .map((path) => toPosixRelative(project.root, path))
      .join(', ')}. Only lib/config.ts should.`,
    remedy: 'Import { config } from "@/lib/config" instead.',
  })
}

/**
 * The author roster still carries the values the seed content shipped with.
 *
 * This is a warning rather than an error because it is a content decision, but
 * it is worth a check: an author bio renders under every post and on the author
 * page, and it feeds `Person.description` in the JSON-LD, so an unedited
 * template bio is published prose that claims an entity we cannot resolve. It is
 * also the single most likely thing to go live unnoticed, because the site looks
 * finished with it in place.
 */
function checkSeedContent(ctx: DoctorContext): void {
  const { project, reporter } = ctx
  reporter.group('Content')

  const candidates = ['content/authors.json', 'src/content/authors.json']
  const found = candidates
    .map((relativePath) => ({ relativePath, source: readFile(join(project.root, relativePath)) }))
    .find((entry) => entry.source !== null)

  if (!found?.source) {
    reporter.skip('author roster', 'no content/authors.json, so another content source is in use')
    return
  }

  const untouched = [
    'Replace this with',
    'Replace with a topic',
    'replace-with-a-real',
    'The Editorial Team',
    'Guest Author',
  ].filter((marker) => found.source!.includes(marker))

  if (untouched.length === 0) {
    reporter.pass('author roster has been edited')
    return
  }

  reporter.fail('author roster', {
    id: 'seed-authors-unedited',
    severity: 'warning',
    message: `${found.relativePath} still contains seed template text (${untouched[0]}). Author bios render under every post and become Person.description in the structured data.`,
    remedy: `Edit ${found.relativePath}: a real name, a real bio, and absolute sameAs profile URLs.`,
  })
}
