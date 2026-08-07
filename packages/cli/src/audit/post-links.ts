/**
 * Evidence, links, and copy style: the checks that ask whether a post is worth
 * citing rather than whether it is shaped correctly.
 *
 * A number or a quotation without a source is the fastest way to lose the trust
 * this format is built on, and it is the one thing a language model will happily
 * invent. An orphan post is one nothing links to, which is discovered last and
 * carries no internal authority.
 *
 * @see https://docs.agentblog.dev/concepts/geo-playbook*/
import { findCopyStyleIssues } from './copy-style.ts'
import { internalLinksIn, type PostFile } from './post.ts'
import type { Reporter } from '../report/reporter.ts'

/**
 * A number or a quotation without a source is the fastest way to lose the trust
 * this whole format is built on, and it is the one thing a language model will
 * happily invent.
 */
export function checkCitations(post: PostFile, reporter: Reporter): void {
  const citations = Array.isArray(post.data['citations']) ? post.data['citations'] : []
  const paragraphs = post.body.split(/\n{2,}/)

  const statistics = paragraphs.filter((paragraph) =>
    /\b\d+(?:\.\d+)?\s?%|\b\d{1,3}(?:,\d{3})+\b|\b\d+(?:\.\d+)?\s?(?:x|times)\b/i.test(paragraph),
  )
  const quotations = paragraphs.filter((paragraph) => /^>\s|["“][^"”]{40,}["”]/.test(paragraph))

  const uncited = [...statistics, ...quotations].filter(
    (paragraph) => !/\[[^\]]+\]\(https?:\/\/|<a\s+[^>]*href=|<Stat[^>]*source=/i.test(paragraph),
  )

  if (statistics.length === 0 && quotations.length === 0) {
    reporter.fail('citations', {
      id: 'no-evidence',
      severity: 'warning',
      message: `${post.slug} contains no statistic and no named source quotation. Both are what make a post worth citing rather than worth summarizing.`,
      remedy: 'Add at least one real number and one quotation, each with a source link.',
    })
    return
  }

  if (uncited.length > 0 && citations.length === 0) {
    reporter.fail('citations', {
      id: 'uncited-claims',
      severity: 'error',
      message: `${post.slug} has ${uncited.length} paragraph(s) with a statistic or quotation and no link or citation entry. First: "${uncited[0]!.slice(0, 80).replace(/\s+/g, ' ')}..."`,
      remedy: 'Link the source inline, or add it to the citations frontmatter.',
    })
    return
  }

  reporter.pass(`citations (${statistics.length} statistics, ${quotations.length} quotations)`)
}

export function checkInternalLinks(
  post: PostFile,
  all: readonly PostFile[],
  reporter: Reporter,
): void {
  const links = internalLinksIn(post)
  if (links.length < 5) {
    reporter.fail('internal links', {
      id: 'too-few-internal-links',
      severity: 'warning',
      message: `${post.slug} has ${links.length} internal links. The target is 5 to 15.`,
      remedy:
        'Link to the related posts you already have. This is how a hub and spoke structure forms.',
    })
    return
  }
  if (links.length > 15) {
    reporter.fail('internal links', {
      id: 'too-many-internal-links',
      severity: 'info',
      message: `${post.slug} has ${links.length} internal links, past the 15 link guideline.`,
      remedy: 'Keep the ones that are genuinely contextual.',
    })
    return
  }

  const known = new Set(all.map((other) => other.slug))
  const broken = links.filter((slug) => !known.has(slug))
  if (broken.length > 0) {
    reporter.fail('internal links', {
      id: 'broken-internal-links',
      severity: 'error',
      message: `${post.slug} links to posts that do not exist: ${broken.join(', ')}.`,
      remedy: 'Fix the slug, or write the post first.',
    })
    return
  }
  reporter.pass(`internal links (${links.length})`)
}

/** A post nothing links to is a post crawlers reach last and rank lowest. */
export function checkOrphan(post: PostFile, all: readonly PostFile[], reporter: Reporter): void {
  const inbound = all.filter(
    (other) => other.slug !== post.slug && internalLinksIn(other).includes(post.slug),
  ).length

  if (inbound === 0 && all.length > 1) {
    reporter.fail('orphan', {
      id: 'orphan-post',
      severity: 'warning',
      message: `Nothing links to ${post.slug}. An orphan post is discovered last and carries no internal authority.`,
      remedy: 'Add a contextual link from at least one existing post.',
    })
    return
  }
  reporter.pass(`inbound internal links (${inbound})`)
}

export function checkHeroImage(post: PostFile, reporter: Reporter): void {
  const hero = post.data['heroImage']
  if (typeof hero !== 'string' || hero === '') {
    /*
     * No hero means no `BlogPosting.image`, which Google lists as a recommended
     * Article property. It is a warning and not an error because the markup is
     * valid without it and nothing breaks.
     *
     * It is reported at all because the omission is invisible from the post:
     * `lib/schema.ts` drops the `image` key entirely when `heroImage` is
     * absent, so the graph is quietly one recommended property short and the
     * page still renders perfectly. The seed posts ship without one, and the
     * seed posts are the format every generated post copies.
     *
     * The generated `opengraph-image` is deliberately NOT substituted here.
     * Google asks for an image that represents the article "rather than logos
     * or captions", and a card with the title set in type is closer to a
     * caption than to a photograph of the subject. Claiming it as the
     * article's representative image would be the CLI answering a question
     * only the writer can answer.
     *
     * @see https://developers.google.com/search/docs/appearance/structured-data/article
     */
    reporter.fail('hero image', {
      id: 'hero-image-missing',
      severity: 'warning',
      message: `${post.slug} has no heroImage, so BlogPosting.image is omitted from the structured data and the post has no representative image for rich results.`,
      remedy:
        'Add heroImage and heroAlt to the frontmatter. Use an image about the subject, not a logo or a title card.',
    })
    return
  }
  if (typeof post.data['heroAlt'] !== 'string' || post.data['heroAlt'] === '') {
    reporter.fail('hero image', {
      id: 'hero-alt-missing',
      severity: 'error',
      message: `${post.slug} sets heroImage without heroAlt.`,
      remedy:
        'Describe the image. An unlabelled hero is an accessibility failure and a lost signal.',
    })
  }
}

export function checkCopyStyle(post: PostFile, reporter: Reporter): void {
  const issues = findCopyStyleIssues(post.body)
  if (issues.length === 0) {
    reporter.pass('copy style')
    return
  }
  for (const issue of issues.slice(0, 8)) {
    reporter.fail('copy style', {
      id: 'copy-style',
      severity: 'warning',
      message: `${post.slug}:${issue.line} contains ${issue.what}. ${issue.excerpt}`,
      remedy: 'Use a comma, a colon, parentheses, or a full stop and a new sentence.',
    })
  }
  if (issues.length > 8) {
    reporter.fail('copy style', {
      id: 'copy-style-more',
      severity: 'warning',
      message: `${post.slug} has ${issues.length - 8} further copy style issues.`,
      remedy: 'Fix the ones above, then re-run.',
    })
  }
}
