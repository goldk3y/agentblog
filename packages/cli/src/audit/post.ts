/**
 * The per-post pre-publish gate.
 *
 * This implements the checklist in `the GEO playbook` section 6.3, in
 * the order a writer would work through it. Each check reports what to change,
 * not merely that something is wrong, because the audience is somebody about to
 * publish and the alternative is a list of complaints.
 *
 * Two checks are deliberately absent. "Comparison data in a real table" and
 * "every section self-contained" are editorial judgements a regular expression
 * cannot make, and a check that guesses at them would train users to ignore the
 * report. What is here is mechanical and provable.
 *
 * @see https://docs.agentblog.dev/concepts/geo-playbook
 */
import { basename } from 'node:path'
import { exists, join } from '../util/fs.ts'

import {
  checkAnswerCapsule,
  checkAuthorAndCategory,
  checkDates,
  checkHeadings,
  checkTitleAndDescription,
} from './post-checks.ts'
import {
  checkCitations,
  checkCopyStyle,
  checkHeroImage,
  checkInternalLinks,
  checkOrphan,
} from './post-links.ts'
import { parseFrontmatter, type FrontmatterError } from '../util/frontmatter.ts'
import { readFile, walk } from '../util/fs.ts'
import type { Rosters } from '../detect/roster.ts'
import type { Reporter } from '../report/reporter.ts'

export interface PostFile {
  readonly path: string
  readonly slug: string
  readonly data: Readonly<Record<string, unknown>>
  readonly body: string
  /** Set when the frontmatter is not valid YAML. `data` is empty when it is. */
  readonly frontmatterError: FrontmatterError | null
}

/**
 * Where posts live, for the two commands that have to agree about it.
 *
 * `audit` resolves it to read every post and `doctor --url` resolves it to pick
 * one real slug to probe. If those two disagreed, `doctor` would report a live
 * failure for a URL `audit` had never heard of.
 */
export function resolveContentDir(
  root: string,
  usesSrcDir: boolean,
  override?: string | undefined,
): string {
  if (override) return join(root, override)
  const candidate = join(root, usesSrcDir ? 'src/content/blog' : 'content/blog')
  return exists(candidate) ? candidate : join(root, 'content/blog')
}

export function loadPosts(dir: string): PostFile[] {
  return walk(dir, { extensions: ['.mdx', '.md'] })
    .map((path) => {
      const source = readFile(path)
      if (source === null) return null
      const parsed = parseFrontmatter(source)
      const slug =
        typeof parsed.data['slug'] === 'string'
          ? parsed.data['slug']
          : basename(path).replace(/\.mdx?$/, '')
      return {
        path,
        slug,
        data: parsed.data,
        body: parsed.body,
        frontmatterError: parsed.error,
      }
    })
    .filter((post): post is PostFile => post !== null)
}

export function auditPost(
  post: PostFile,
  all: readonly PostFile[],
  rosters: Rosters,
  reporter: Reporter,
): void {
  reporter.group(`Post: ${post.slug}`)

  // Every check below reads a frontmatter field. Running them against a document
  // that did not parse produces a page of confident findings about fields the
  // parser never saw, so the parse failure is reported on its own and the rest
  // of the checks are skipped rather than guessed at.
  if (post.frontmatterError) {
    const { message, line, column } = post.frontmatterError
    reporter.fail('frontmatter', {
      id: 'frontmatter-invalid',
      severity: 'error',
      message: `${post.path}:${line}:${column} is not valid YAML: ${message}. No other check ran for this post, because every one of them reads a field this document does not provide.`,
      remedy: 'Fix the YAML at that line, then re-run the audit.',
    })
    return
  }

  checkAnswerCapsule(post, reporter)
  checkAuthorAndCategory(post, rosters, reporter)
  checkHeadings(post, reporter)
  checkDates(post, reporter)
  checkTitleAndDescription(post, reporter)
  checkCitations(post, reporter)
  checkInternalLinks(post, all, reporter)
  checkOrphan(post, all, reporter)
  checkHeroImage(post, reporter)
  checkCopyStyle(post, reporter)
}

/** Slugs this post links to, from `/blog/<slug>` links. */
export function internalLinksIn(post: PostFile): string[] {
  return [
    ...post.body.matchAll(/\]\(\/blog\/([a-z0-9-]+)\)|href=["']\/blog\/([a-z0-9-]+)["']/g),
  ].map((match) => match[1] ?? match[2] ?? '')
}
