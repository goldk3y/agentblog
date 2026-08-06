import Image from 'next/image'
import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { categoryPath, postPath } from '@/lib/config'
import { readingTime } from '@/lib/reading-time'
import type { PublishedPost } from '@/lib/types'
import { cn } from '@/lib/utils'

import { formatPostDate } from './byline'
import { ClockIcon } from './icons'

/**
 * One post, as a card, in a list.
 *
 * WHERE IT RENDERS
 * `post-list.tsx`, which is used by the blog index, category hubs, tag pages,
 * and author pages.
 *
 * WHY IT IS SHAPED THIS WAY
 * The card is built out of the consumer's own `Card` and `Badge` from
 * `@/components/ui/*`, not out of a private copy. `shadcn add` refuses to
 * overwrite a component the user has already customized, so a project that
 * restyled its `Card` gets that restyled card here for free. That inheritance is
 * the entire reason the block declares `card` and `badge` as bare-name registry
 * dependencies. @See https://agentblog.dev/docs/theming.3, rule 1.
 *
 * ⚠️ ADDING `'use client'` TO THIS FILE REMOVES EVERY POST LIST FROM THE RAW
 * HTML THAT AI CRAWLERS READ.
 * The blog index, every category hub, and every author page are nothing but a
 * grid of these cards. Client components hydrate; crawlers that do not run
 * JavaScript see whatever was in the first response byte. Keep this a server
 * component. If you need interactivity (a bookmark toggle, a hover preview),
 * put it in a small leaf client component and render it *inside* this card,
 * so the links and the titles stay in the server HTML.
 *
 * THE `priority` PROP
 * When true the hero image is passed `preload`, which emits a
 * `<link rel="preload">` for it. `priority` is the deprecated Next.js prop name
 * and is intentionally not what we pass through. At most ONE image per route may
 * be preloaded, and only when it is definitively the LCP element. Preloading
 * every card in a grid makes the browser fetch twelve images at highest priority
 * and reliably makes LCP worse than doing nothing. `post-list.tsx` exposes
 * `priorityFirst` for the single legitimate case.
 * @see https://agentblog.dev/docs/blog-block
 *
 * WHAT BREAKS IF YOU CHANGE IT
 * - Replacing the title `<Link>` with an onClick handler removes the post from
 *   the crawlable link graph, and the index page stops being a discovery path.
 * - Dropping `sizes` from the `fill` image makes Next.js serve the largest
 *   candidate to every viewport.
 */
export interface PostCardProps {
  readonly post: PublishedPost
  /**
   * Preload the hero image. Only for the single LCP image on a route. Read the
   * note above before setting this on more than one card.
   */
  readonly priority?: boolean | undefined
  /**
   * Heading level for the card title. Defaults to 2, which is correct under a
   * page whose H1 is the list heading. Pass 3 when the list itself sits under an
   * H2, so the document keeps a heading order with no skipped levels.
   */
  readonly headingLevel?: 2 | 3 | undefined
  readonly className?: string | undefined
}

export function PostCard({ post, priority, headingLevel, className }: PostCardProps) {
  const Heading = headingLevel === 3 ? 'h3' : 'h2'
  const href = postPath(post.slug)
  const { minutes } = readingTime(post.body)
  // `PostSchema` refuses a heroImage without a heroAlt, so the pair is either
  // fully present or fully absent. The render path narrows to an object rather
  // than casting, because an unlabelled image is an accessibility failure and a
  // cast would quietly let one through if the schema ever loosened.
  const hero =
    post.heroImage !== undefined && post.heroAlt !== undefined
      ? { src: post.heroImage, alt: post.heroAlt }
      : null

  return (
    <Card className={cn('overflow-hidden pt-0', className)}>
      {hero ? (
        // The image link duplicates the title link, so it is hidden from
        // assistive tech and removed from the tab order. A screen reader reader
        // hears one link per card, a mouse user can click the picture.
        <Link href={href} aria-hidden="true" tabIndex={-1} className="block">
          <div className="bg-muted relative aspect-[16/9] w-full overflow-hidden">
            <Image
              src={hero.src}
              alt={hero.alt}
              fill
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              preload={priority === true}
              className="object-cover"
            />
          </div>
        </Link>
      ) : null}

      {/* `Card` is set to `pt-0` above so the hero can sit flush with the top
          border. With no hero there is nothing to sit flush with, so the header
          takes the padding back. */}
      <CardHeader className={cn(hero === null && 'pt-6')}>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Link
            href={categoryPath(post.category.slug)}
            className="focus-visible:ring-ring rounded-md focus-visible:ring-2 focus-visible:outline-none"
          >
            <Badge variant="secondary">{post.category.name}</Badge>
          </Link>
        </div>

        <CardTitle>
          <Heading className="text-lg leading-snug">
            <Link
              href={href}
              className="focus-visible:ring-ring rounded-sm underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
            >
              {post.title}
            </Link>
          </Heading>
        </CardTitle>

        <CardDescription className="line-clamp-3">{post.description}</CardDescription>
      </CardHeader>

      <CardFooter className="text-muted-foreground mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        {/* Plain text, not a link. One link target per card keeps the card's
            anchor text unambiguous and stops list pages turning into link soup. */}
        <span>{post.author.name}</span>
        <span aria-hidden="true">·</span>
        <time dateTime={post.datePublished}>{formatPostDate(post.datePublished)}</time>
        <span aria-hidden="true">·</span>
        <span className="inline-flex items-center gap-1">
          <ClockIcon className="size-3.5" aria-hidden="true" />
          {`${minutes} min read`}
        </span>
      </CardFooter>
    </Card>
  )
}
