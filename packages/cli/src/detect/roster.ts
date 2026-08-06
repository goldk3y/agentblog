/**
 * The author and category rosters a post's frontmatter has to resolve against.
 *
 * ===========================================================================
 * WHY THE CLI READS THESE FILES AT ALL
 * ===========================================================================
 * `lib/sources/mdx.ts` hydrates a post by slug and then validates, with
 * `onInvalid` defaulting to `throw`. So an `author` or `category` that names no
 * record is a build failure, with a good message, at the last possible moment.
 *
 * Two commands were producing exactly that failure and reporting success on the
 * way. `agentblog new` wrote `author: your-name` and `category: general`, and
 * neither slug exists in the shipped `content/authors.json` (`editorial`,
 * `guest-author`) or `content/categories.json` (`ai-search`, `technical-seo`,
 * `content-strategy`, `engineering`). `agentblog audit` then passed the file,
 * because nothing in the audit read the roster. The documented flow is
 * `new`, `audit`, build, and it failed at the one step that costs the most to
 * debug.
 *
 * Both now read this module, so the scaffold and the gate agree with the build
 * about what a valid slug is.
 *
 * The rosters are read as plain JSON rather than through `@agentblog/schema`:
 * we need the slugs, not a validated record, and a roster with one malformed
 * entry should still let us check the others.
 *
 * @see https://agentblog.dev/docs/agent-layer
 */
import { appPath, appPathLabel, type ProjectContext } from './project.ts'
import { exists, join, readFile, readJson, toPosixRelative } from '../util/fs.ts'

export interface Roster {
  /** Slugs found in the file, in file order. Empty when the file is unusable. */
  readonly slugs: readonly string[]
  /** Project relative path of the file that was read, or `null` when absent. */
  readonly path: string | null
  /** Set when the file exists but could not be read as a list of records. */
  readonly problem: string | null
}

export interface Rosters {
  readonly authors: Roster
  readonly categories: Roster
  /** `defaultAuthor` from `agentblog.config.ts`, when it names a real slug. */
  readonly defaultAuthor: string | null
}

/** The placeholder the shipped config and the old `new` template both used. */
const PLACEHOLDER_AUTHOR = 'your-name'

export function readRosters(project: ProjectContext, contentDir?: string): Rosters {
  const authors = readRoster(project, 'authors.json', contentDir)
  const categories = readRoster(project, 'categories.json', contentDir)
  return { authors, categories, defaultAuthor: readDefaultAuthor(project, authors) }
}

/**
 * Candidate locations, most specific first.
 *
 * `audit --dir` points at the posts, and the rosters sit beside that directory
 * rather than inside it, so its parent is tried before the conventional
 * locations. Without that, auditing a project whose posts live somewhere
 * unusual read the wrong roster or none at all.
 */
function readRoster(project: ProjectContext, fileName: string, contentDir?: string): Roster {
  const candidates = [
    ...(contentDir ? [join(contentDir, '..', fileName)] : []),
    appPath(project, join('content', fileName)),
    join(project.root, 'content', fileName),
  ]

  for (const candidate of candidates) {
    if (!exists(candidate)) continue
    const label = toPosixRelative(project.root, candidate)
    const parsed = readJson<unknown>(candidate)
    if (!Array.isArray(parsed)) {
      return { slugs: [], path: label, problem: `${label} is not a JSON array of records.` }
    }
    const slugs = parsed
      .map((record) =>
        record &&
        typeof record === 'object' &&
        typeof (record as { slug?: unknown }).slug === 'string'
          ? (record as { slug: string }).slug
          : null,
      )
      .filter((slug): slug is string => slug !== null && slug.trim().length > 0)
    if (slugs.length === 0) {
      return { slugs: [], path: label, problem: `${label} has no records with a slug.` }
    }
    return { slugs, path: label, problem: null }
  }

  return {
    slugs: [],
    path: null,
    problem: `No ${appPathLabel(project, `content/${fileName}`)}. It ships with @agentblog/source-mdx.`,
  }
}

/**
 * `defaultAuthor` from `agentblog.config.ts`, only when it resolves.
 *
 * Read textually rather than by evaluating the module: the config imports
 * `@/lib/define-config` and `@/lib/sources/mdx`, neither of which resolves
 * outside the consumer's own build. Both the `defaultAuthor:` field and the
 * `const DEFAULT_AUTHOR = '...'` the shipped template declares are matched,
 * because the template routes the value through that constant.
 *
 * The shipped placeholder is rejected explicitly. It is the value that produces
 * `unknown author slug "your-name"` at build time, so returning it here would
 * mean the scaffold confidently wrote the one slug guaranteed to fail.
 */
function readDefaultAuthor(project: ProjectContext, authors: Roster): string | null {
  const path = project.agentblogConfigPath
  if (!path) return null
  const source = readFile(path)
  if (source === null) return null

  const candidates = [
    /defaultAuthor\s*:\s*['"`]([^'"`]+)['"`]/.exec(source)?.[1],
    /DEFAULT_AUTHOR\s*=\s*['"`]([^'"`]+)['"`]/.exec(source)?.[1],
  ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0)

  for (const candidate of candidates) {
    if (candidate === PLACEHOLDER_AUTHOR) continue
    if (authors.slugs.length > 0 && !authors.slugs.includes(candidate)) continue
    return candidate
  }
  return null
}
