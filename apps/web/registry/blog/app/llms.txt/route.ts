/**
 * `/llms.txt`: the blog as one Markdown index, for agents that ask for it.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS IS WORTH, HONESTLY
 * ---------------------------------------------------------------------------
 * It is not an SEO lever and nothing here pretends otherwise. Google has said
 * no Search system reads `llms.txt`, and OpenAI's and Google's crawlers do not
 * request it in meaningful volume. If that were the whole picture this file
 * would not exist, because a route that only looks like an optimisation is
 * worse than no route.
 *
 * It exists because two consumers do read it. Perplexity has confirmed it
 * fetches `llms.txt` and uses it to decide which pages are worth retrieving,
 * and Anthropic recommends publishing one and honours it in Claude's retrieval.
 * Those are the two ends of this product's whole thesis: an assistant deciding
 * what to fetch, and an assistant deciding what to cite.
 *
 * So treat it as an agent-readable table of contents, not as a ranking signal.
 * The cost is one cached route generated from the same content source that
 * already produces `sitemap.xml` and `feed.xml`, and the benefit is that a
 * retrieval agent gets titles, URLs, and one-line descriptions in a single
 * request instead of crawling for them.
 *
 * ---------------------------------------------------------------------------
 * THIS IS A CACHED ROUTE HANDLER
 * ---------------------------------------------------------------------------
 * Same mechanism as `app/feed.xml/route.ts` and `app/sitemap.ts`: no
 * request-time API means the response is cached, so a post published without a
 * rebuild does not appear here until something invalidates it.
 * `app/api/publish/route.ts` revalidates this path for that reason, and the
 * `revalidate` export below is the backstop for installs whose webhook was
 * never wired up.
 *
 * @see https://llmstxt.org
 * @see https://docs.agentblog.dev/reference/files
 */
import { absoluteUrl, config, postUrl } from '@/lib/config'
import { getAllPosts } from '@/lib/posts'
import type { PublishedPost } from '@/lib/types'

/**
 * ISR backstop. Hardcoded rather than read from `config.revalidate` because
 * route segment config must be statically analysable.
 */
export const revalidate = 3600

/**
 * Markdown is a link label, not a document, so only the characters that would
 * break `[text](url)` are escaped. Escaping more would put backslashes into
 * prose that a model then reads as content.
 */
function escapeLinkText(value: string): string {
  return value.replace(/([[\]])/g, '\\$1')
}

/** One line per post, in the `- [title](url): description` form the spec uses. */
function renderPost(post: PublishedPost): string {
  return `- [${escapeLinkText(post.title)}](${postUrl(post.slug)}): ${collapse(post.description)}`
}

/**
 * Newlines inside a description would end the list item and silently truncate
 * everything after them, so they are folded to spaces rather than trusted.
 */
function collapse(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

/** Posts grouped under their category, categories in first-appearance order. */
function byCategory(posts: readonly PublishedPost[]): Map<string, PublishedPost[]> {
  const groups = new Map<string, PublishedPost[]>()
  for (const post of posts) {
    const existing = groups.get(post.category.name)
    if (existing) existing.push(post)
    else groups.set(post.category.name, [post])
  }
  return groups
}

export async function GET(): Promise<Response> {
  const all = await getAllPosts()

  // Newest first, exactly as the feed sorts. The source is not contractually
  // required to sort, and an index whose order changes between requests is an
  // index a retrieval agent cannot cache.
  const posts = [...all].sort((a, b) => Date.parse(b.datePublished) - Date.parse(a.datePublished))

  const lines: string[] = [
    `# ${config.brand.name}`,
    '',
    `> ${collapse(`Blog posts from ${config.brand.name}. Every entry below links to a page whose full article text is in the server rendered HTML.`)}`,
    '',
  ]

  for (const [category, group] of byCategory(posts)) {
    lines.push(`## ${category}`, '')
    for (const post of group) lines.push(renderPost(post))
    lines.push('')
  }

  if (posts.length === 0) {
    lines.push('## Posts', '', 'No posts have been published yet.', '')
  }

  // `Optional` is the one section name the spec assigns meaning to: it marks
  // links a consumer may skip when it is short of context. Machine readable
  // indexes belong there, because they duplicate what is already above.
  lines.push(
    '## Optional',
    '',
    `- [Sitemap](${absoluteUrl('/sitemap.xml')}): every indexable URL on this site.`,
    `- [RSS feed](${absoluteUrl('/feed.xml')}): the most recent posts as RSS 2.0.`,
    `- [Editorial policy](${absoluteUrl('/editorial-policy')}): how these posts are written, reviewed, and corrected.`,
    '',
  )

  return new Response(lines.join('\n'), {
    headers: {
      // Plain text, because the path ends in `.txt` and a consumer that sniffs
      // the extension and the type disagreeing is a consumer that skips it.
      'Content-Type': 'text/plain; charset=utf-8',
      // Advisory only. The authoritative cache lifetime is the `revalidate`
      // export plus whatever the publish webhook invalidates.
      'Cache-Control': 'public, max-age=0, must-revalidate',
    },
  })
}
