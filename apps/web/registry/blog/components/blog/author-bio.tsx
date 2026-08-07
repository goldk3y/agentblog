import Link from 'next/link'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { authorPath } from '@/lib/config'
import type { Author } from '@/lib/types'
import { cn } from '@/lib/utils'

import { ExternalLinkIcon } from './icons'

/**
 * The author box below the article body.
 *
 * WHERE IT RENDERS
 * `app/blog/[slug]/page.tsx` after the share controls and before the related
 * posts, and at the top of `app/authors/[slug]/page.tsx`.
 *
 * WHY IT IS SHAPED THIS WAY
 * This is the visible half of the E-E-A-T story. The other half is the `Person`
 * node in the JSON-LD graph, and the two have to agree: `name`, `jobTitle`,
 * `knowsAbout`, and `sameAs` are rendered here from exactly the fields
 * `lib/schema.ts` reads. Search quality raters are directed to look an author up,
 * so this box exists to make that lookup succeed.
 *
 *   - `name` is the person's name alone. Job title, honorifics, and the
 *     publisher name are separate fields, because Google's Article guidance is
 *     explicit that `author.name` must not carry any of them. The schema
 *     enforces the split; this component preserves it visually.
 *   - `sameAs` links are the entity-disambiguation surface. They are rendered as
 *     real anchors with the destination host as the label, so both a human and a
 *     parser can see which profile is being claimed.
 *   - `bio` is required by the schema. An author box with no bio is decoration.
 *
 * WHERE A SHADCN PRIMITIVE DID NOT FIT CLEANLY
 * `Avatar` and `Separator` are Radix based, so in a standard shadcn install both
 * carry `'use client'`. They are used here anyway, and only here, for two
 * reasons: composing on the consumer's own primitives is the point of the block
 * (@See https://docs.agentblog.dev/guides/match-your-design#primitives-are-requested-by-bare-name), and neither one holds content.
 * The `Separator` is decorative, and the avatar is a photo whose absence costs a
 * non-JavaScript reader nothing, since the author's name, title, bio, and links
 * are all plain server-rendered text. Do not reach for a Radix primitive to hold
 * anything a crawler needs to read.
 *
 * WHAT BREAKS IF YOU CHANGE IT
 * - Concatenating the job title into `name` produces JSON-LD that fails Google's
 *   Article guidance and an author entity that resolves to nobody.
 * - Making `sameAs` links `rel="nofollow"` defeats their purpose. They exist to
 *   assert an identity, and the assertion is the link.
 * - Adding `'use client'` to this file removes the bio text, which is the actual
 *   trust signal, from the HTML.
 *
 * @see https://docs.agentblog.dev/concepts/geo-playbook*/
export interface AuthorBioProps {
  readonly author: Author
  /** Rendered as "N posts" when supplied. Omit on the author page itself. */
  readonly postCount?: number | undefined
  /**
   * Link the author's name to their author page. Defaults to true. Set false on
   * `/authors/[slug]` so the page does not link to itself.
   */
  readonly linkName?: boolean | undefined
  /**
   * Render the topic badges and the profile links inside the card.
   *
   * Defaults to true, which is right at the foot of an article where this card
   * is the only thing on the page describing the author. The author page passes
   * `false`, because it renders both as their own labelled sections below, and
   * a page that lists someone's expertise twice and their GitHub profile twice
   * reads as a template that was never looked at.
   */
  readonly showDetails?: boolean | undefined
  readonly className?: string | undefined
}

/** Initials for the avatar fallback. Two letters at most, so the circle fits. */
function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter((part) => part.length > 0)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
}

/** `https://github.com/janedoe` becomes `github.com`, which is the useful label. */
function hostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export function AuthorBio({ author, postCount, linkName, showDetails, className }: AuthorBioProps) {
  const shouldLink = linkName !== false
  const withDetails = showDetails !== false
  const href = authorPath(author.slug)

  return (
    <section
      className={cn(
        'not-prose border-border bg-card text-card-foreground rounded-xl border p-6',
        className,
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <Avatar className="size-16 shrink-0">
          {/* Empty alt on purpose: the author's name sits directly beside the
              photo, so a described avatar would make a screen reader announce
              the same name twice. This is the one image in the block that is
              genuinely decorative. */}
          {author.avatar !== undefined ? <AvatarImage src={author.avatar} alt="" /> : null}
          <AvatarFallback>{initialsOf(author.name)}</AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          {/* Stable id, same rule as every other H2 and H3 in the block. It is
              derived from the author slug rather than fixed, so a page that
              renders more than one author box (a co-authored post, an index of
              contributors) still gets one unique anchor per person. */}
          <h2 className="scroll-mt-24 text-lg font-semibold" id={`author-${author.slug}`}>
            {shouldLink ? (
              <Link
                href={href}
                rel="author"
                className="focus-visible:ring-ring rounded-sm underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
              >
                {author.name}
              </Link>
            ) : (
              author.name
            )}
          </h2>

          {/* Job title and employer stay out of `name`, deliberately. */}
          {author.jobTitle !== undefined || postCount !== undefined ? (
            <p className="text-muted-foreground mt-0.5 text-sm">
              {author.jobTitle}
              {author.jobTitle !== undefined && postCount !== undefined ? (
                <span aria-hidden="true">{' · '}</span>
              ) : null}
              {postCount !== undefined
                ? `${postCount} ${postCount === 1 ? 'post' : 'posts'}`
                : null}
            </p>
          ) : null}

          <p className="text-foreground mt-3 text-sm leading-relaxed">{author.bio}</p>

          {withDetails && author.knowsAbout.length > 0 ? (
            <>
              <Separator className="my-4" />
              <ul
                aria-label={`Topics ${author.name} writes about`}
                className="flex list-none flex-wrap gap-2 p-0"
              >
                {author.knowsAbout.map((topic) => (
                  <li key={topic}>
                    <Badge variant="secondary">{topic}</Badge>
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          {withDetails && author.sameAs.length > 0 ? (
            <ul className="mt-4 flex list-none flex-wrap gap-x-4 gap-y-2 p-0 text-sm">
              {author.sameAs.map((profile) => (
                <li key={profile}>
                  <a
                    href={profile}
                    rel="me noopener noreferrer"
                    target="_blank"
                    className="text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex items-center gap-1 rounded-sm underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
                  >
                    {hostLabel(profile)}
                    <ExternalLinkIcon className="size-3.5" aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </section>
  )
}
