/**
 * The individual pre-publish checks, one function per checklist item.
 *
 * Split out of `post.ts` so that the loader and the orchestration stay readable
 * and each check can be read on its own. Every check takes the post, sometimes
 * its neighbours, and the reporter, and reports either a pass or a finding that
 * states what to change.
 *
 * @see https://docs.agentblog.dev/concepts/geo-playbook*/
import { IsoDateTime } from '@agentblog/schema'

import type { PostFile } from './post.ts'
import type { Roster, Rosters } from '../detect/roster.ts'
import type { Reporter } from '../report/reporter.ts'

/**
 * The answer capsule is the 40 to 60 word direct answer under the H1. It is the
 * single most extractable unit on the page: it is what an assistant lifts when
 * it cites you, so length is not a stylistic preference.
 */
export function checkAnswerCapsule(post: PostFile, reporter: Reporter): void {
  const fromFrontmatter =
    typeof post.data['answerCapsule'] === 'string' ? post.data['answerCapsule'] : null
  const fromBody = /<AnswerCapsule[^>]*>([\s\S]*?)<\/AnswerCapsule>/.exec(post.body)?.[1] ?? null
  const capsule = fromFrontmatter ?? fromBody

  if (!capsule) {
    reporter.fail('answer capsule', {
      id: 'capsule-missing',
      severity: 'error',
      message: `${post.slug} has no answer capsule. Nothing on the page is shaped for extraction.`,
      remedy: 'Add answerCapsule to the frontmatter: a 40 to 60 word direct answer, no links.',
    })
    return
  }

  const words = capsule
    .replace(/<[^>]+>/g, ' ')
    .split(/\s+/)
    .filter((word) => /\w/.test(word)).length

  if (words < 40 || words > 60) {
    reporter.fail('answer capsule', {
      id: 'capsule-length',
      severity: 'warning',
      message: `${post.slug} has a ${words} word answer capsule. The target is 40 to 60.`,
      remedy:
        words < 40
          ? 'Add the qualifying detail that makes it stand alone.'
          : 'Cut it back to the direct answer.',
    })
    return
  }

  if (/\[[^\]]*\]\([^)]*\)|<a\s/i.test(capsule)) {
    reporter.fail('answer capsule', {
      id: 'capsule-has-links',
      severity: 'warning',
      message: `${post.slug} has links inside the answer capsule. A capsule should read as one self contained sentence group.`,
      remedy: 'Move the links into the section below the capsule.',
    })
    return
  }

  reporter.pass(`answer capsule (${words} words)`)
}

/**
 * Every H2 must produce a stable, unique anchor id. Two headings that slug to
 * the same id give you one working anchor and one that silently jumps to the
 * wrong section, which breaks the table of contents and every deep link an
 * assistant might cite.
 */
export function checkHeadings(post: PostFile, reporter: Reporter): void {
  const headings = [...post.body.matchAll(/^(#{2,3})\s+(.+?)\s*$/gm)].map((match) => ({
    depth: match[1]!.length,
    text: match[2]!,
    id: slugify(match[2]!),
  }))

  const h2s = headings.filter((heading) => heading.depth === 2)
  if (h2s.length === 0) {
    reporter.fail('headings', {
      id: 'no-h2',
      severity: 'warning',
      message: `${post.slug} has no H2 headings, so it has no retrievable chunks.`,
      remedy: 'Break the article into question shaped H2 sections.',
    })
    return
  }

  const empty = headings.filter((heading) => heading.id === '')
  const seen = new Map<string, number>()
  const duplicates: string[] = []
  for (const heading of headings) {
    const count = (seen.get(heading.id) ?? 0) + 1
    seen.set(heading.id, count)
    if (count === 2) duplicates.push(heading.text)
  }

  if (empty.length > 0 || duplicates.length > 0) {
    reporter.fail('headings', {
      id: 'heading-ids',
      severity: 'error',
      message: `${post.slug} has heading ids that will not work: ${[
        ...empty.map((heading) => `"${heading.text}" produces an empty id`),
        ...duplicates.map((text) => `"${text}" duplicates an earlier id`),
      ].join('; ')}.`,
      remedy: 'Reword so each heading slugs to a distinct, non-empty anchor.',
    })
    return
  }

  const questions = h2s.filter((heading) => heading.text.trim().endsWith('?')).length
  if (questions === 0) {
    reporter.fail('headings', {
      id: 'no-question-headings',
      severity: 'info',
      message: `${post.slug} has no question format H2s. Question headings match how people and assistants phrase queries.`,
      remedy: 'Rewrite two or three headings as the question that section answers.',
    })
  }
  reporter.pass(`headings (${h2s.length} H2s, all with unique ids)`)
}

export function checkDates(post: PostFile, reporter: Reporter): void {
  const published =
    typeof post.data['datePublished'] === 'string' ? post.data['datePublished'] : null
  const modified = typeof post.data['dateModified'] === 'string' ? post.data['dateModified'] : null

  if (!published || !modified) {
    reporter.fail('dates', {
      id: 'dates-missing',
      severity: 'error',
      message: `${post.slug} is missing ${!published ? 'datePublished' : 'dateModified'}.`,
      remedy: 'Both are required, ISO 8601 with a UTC offset.',
    })
    return
  }

  // The date rule is `IsoDateTime` from `@agentblog/schema`, which requires an
  // explicit UTC offset. Google falls back to Googlebot's own timezone when a
  // date carries none, which silently shifts every published date by hours and
  // can move a post across a day boundary.
  const invalid = [published, modified].filter((date) => !IsoDateTime.safeParse(date).success)
  if (invalid.length > 0) {
    reporter.fail('dates', {
      id: 'dates-no-offset',
      severity: 'error',
      message: `${post.slug} has dates that are not ISO 8601 with a UTC offset (${invalid.join(', ')}).`,
      remedy: 'Write them as 2026-08-06T09:30:00Z or with an explicit offset.',
    })
    return
  }

  if (Date.parse(modified) < Date.parse(published)) {
    reporter.fail('dates', {
      id: 'dates-out-of-order',
      severity: 'error',
      message: `${post.slug} has dateModified before datePublished.`,
      remedy: 'Correct the frontmatter.',
    })
    return
  }

  reporter.pass('dates carry offsets and are in order')
  reporter.skip(
    'dateModified agrees with the visible time and the JSON-LD',
    'the block renders both from this same frontmatter through lib/schema.ts, so they cannot disagree unless the template was edited. Verifying the rendered output needs a build.',
  )
}

export function checkTitleAndDescription(post: PostFile, reporter: Reporter): void {
  const title = typeof post.data['title'] === 'string' ? post.data['title'] : ''
  const description = typeof post.data['description'] === 'string' ? post.data['description'] : ''

  if (title.length === 0) {
    reporter.fail('title', {
      id: 'title-missing',
      severity: 'error',
      message: `${post.slug} has no title.`,
      remedy: 'Add one, 60 characters or fewer, with the keyword near the front.',
    })
  } else if (title.length > 70) {
    reporter.fail('title', {
      id: 'title-too-long',
      severity: 'error',
      message: `${post.slug} has a ${title.length} character title. 70 is the hard limit and 60 is the target.`,
      remedy: 'Shorten it. Google truncates around 60.',
    })
  } else if (title.length > 60) {
    reporter.fail('title', {
      id: 'title-long',
      severity: 'warning',
      message: `${post.slug} has a ${title.length} character title, past the 60 character target.`,
      remedy: 'Trim it so it survives truncation in the search result.',
    })
  }

  checkDescriptionLength(post.slug, description, reporter)
}

/**
 * One rule for description length, stated the same way everywhere.
 *
 * Two numbers were in play and they were not the same kind of number, which is
 * how `agentblog new`, the schema, and the shipped skill ended up disagreeing.
 * 150 to 160 is the **target**: it is the band that survives truncation in a
 * search result without being cut off, so it is what a writer aims at. 50 is the
 * **hard floor** `PostFrontmatterSchema` enforces, and 160 the hard ceiling, so
 * anything outside those does not build at all. Below the floor and above the
 * ceiling are errors; inside the schema but short of the target is a warning,
 * because it publishes and it underperforms.
 */
function checkDescriptionLength(slug: string, description: string, reporter: Reporter): void {
  const length = description.length

  if (length === 0) {
    reporter.fail('description', {
      id: 'description-missing',
      severity: 'error',
      message: `${slug} has no description. The target is 150 to 160 characters, and the schema rejects anything under 50.`,
      remedy: 'Write it as the sentence you want quoted under the title in a search result.',
    })
    return
  }
  if (length < 50) {
    reporter.fail('description', {
      id: 'description-below-floor',
      severity: 'error',
      message: `${slug} has a ${length} character description. The schema enforces a hard floor of 50, so this does not build. The target is 150 to 160.`,
      remedy: 'Write it as the sentence you want quoted under the title in a search result.',
    })
    return
  }
  if (length > 160) {
    reporter.fail('description', {
      id: 'description-above-ceiling',
      severity: 'error',
      message: `${slug} has a ${length} character description. The schema enforces a hard ceiling of 160, so this does not build. The target is 150 to 160.`,
      remedy: 'Cut it to the one sentence that answers the title.',
    })
    return
  }
  if (length < 150) {
    reporter.fail('description', {
      id: 'description-length',
      severity: 'warning',
      message: `${slug} has a ${length} character description. It builds, and the target is 150 to 160: a shorter one leaves usable space in the search result empty.`,
      remedy: 'Add the qualifying clause that makes it stand alone.',
    })
    return
  }
  reporter.pass(`description (${length} characters, target 150 to 160)`)
}

/**
 * Does the post's `author` and `category` name a record that exists?
 *
 * ---------------------------------------------------------------------------
 * THE GATE HAS TO AGREE WITH THE BUILD
 * ---------------------------------------------------------------------------
 * `lib/sources/mdx.ts` hydrates a post by slug and validates with `onInvalid`
 * defaulting to `throw`, so an unknown author or category is a build failure.
 * Nothing in the audit read the roster, so `agentblog audit` passed a post that
 * `next build` then refused, which is the one thing a pre-publish gate must not
 * do. The scaffold made it routine: `agentblog new` wrote `author: your-name`
 * and `category: general`, and neither slug exists.
 *
 * When the roster file itself is missing the finding is a warning rather than
 * an error, because the failure is then the install and not the post, and every
 * post in the directory would otherwise fail for the same reason.
 */
export function checkAuthorAndCategory(post: PostFile, rosters: Rosters, reporter: Reporter): void {
  checkAgainstRoster(post, 'author', rosters.authors, reporter)
  checkAgainstRoster(post, 'category', rosters.categories, reporter)
}

function checkAgainstRoster(
  post: PostFile,
  field: 'author' | 'category',
  roster: Roster,
  reporter: Reporter,
): void {
  const raw = post.data[field]
  const value = typeof raw === 'string' ? raw.trim() : ''

  if (value === '') {
    // `author` may be omitted when `defaultAuthor` supplies it, so an absent
    // author is only a problem when nothing can fill it. `category` is
    // required by `PostFrontmatterSchema`.
    if (field === 'category') {
      reporter.fail(field, {
        id: 'category-missing',
        severity: 'error',
        message: `${post.slug} has no category. The schema requires one, so this does not build.`,
        remedy: roster.slugs.length > 0 ? `Use one of: ${roster.slugs.join(', ')}.` : 'Add one.',
      })
      return
    }
    reporter.fail(field, {
      id: 'author-missing',
      severity: 'warning',
      message: `${post.slug} has no author, so it falls back to defaultAuthor in agentblog.config.ts.`,
      remedy: 'Name the author explicitly, or confirm defaultAuthor names a real record.',
    })
    return
  }

  if (roster.slugs.length === 0) {
    reporter.fail(field, {
      id: `${field}-roster-missing`,
      severity: 'warning',
      message: `${post.slug} names the ${field} "${value}" and there is no roster to check it against: ${roster.problem ?? 'the file was not found'}`,
      remedy: 'Install @agentblog/source-mdx, or pass --dir so the rosters are found beside it.',
    })
    return
  }

  if (!roster.slugs.includes(value)) {
    reporter.fail(field, {
      id: `${field}-unknown`,
      severity: 'error',
      message: `${post.slug} names the ${field} "${value}", which is not in ${roster.path}. The build fails on this with "unknown ${field} slug".`,
      remedy: `Use one of: ${roster.slugs.join(', ')}. Or add the record to ${roster.path}.`,
    })
    return
  }

  reporter.pass(`${field} "${value}" resolves in ${roster.path}`)
}

/** Anchor id generation, matching what rehype-slug produces at build time. */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/`|\*|_/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
