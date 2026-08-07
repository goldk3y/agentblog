import Image from 'next/image'
import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { categoryPath, postPath } from '@/lib/config'
import { readingTime } from '@/lib/reading-time'
import type { PublishedPost } from '@/lib/types'
import { cn } from '@/lib/utils'

import { formatPostDateShort } from './byline'
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
 * dependencies. @See https://docs.agentblog.dev/guides/match-your-design#primitives-are-requested-by-bare-name.
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
 * @see https://docs.agentblog.dev/reference/files
 *
 * THE WHOLE CARD IS THE CLICK TARGET, AND IT IS STILL ONE LINK
 * The title's `<Link>` carries `after:absolute after:inset-0`, which stretches a
 * transparent pseudo-element over the whole card. A reader can click anywhere;
 * a screen reader still hears exactly one link per card, whose accessible name
 * is the post title. This is the standard "stretched link" pattern and it has
 * one standard failure mode: any other interactive element inside the card is
 * covered by the pseudo-element and stops being clickable. The category badge
 * therefore carries `relative z-10` to sit above it. If you add a second control
 * to this card, it needs the same two classes or it will look enabled and do
 * nothing.
 *
 * Because the click target is now the card and not the words, the focus ring is
 * on the card too, via `has-[a:focus-visible]:ring-2`. Keyboard focus that lands
 * on a 20px underline inside a 350px card is technically visible and practically
 * missable.
 *
 * WHAT BREAKS IF YOU CHANGE IT
 * - Replacing the title `<Link>` with an onClick handler removes the post from
 *   the crawlable link graph, and the index page stops being a discovery path.
 * - Dropping `sizes` from the `fill` image makes Next.js serve the largest
 *   candidate to every viewport.
 * - Removing `relative` from the `Card` un-anchors the stretched link, which
 *   then covers the nearest positioned ancestor instead. In a grid that is the
 *   whole page.
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
    <Card
      className={cn(
        // `relative` anchors the stretched link. `h-full` makes every card in a
        // row the same height, which is what lets the meta row line up across
        // the grid instead of floating at whatever height the title ended.
        'group relative h-full gap-4 overflow-hidden pt-0',
        // The hover state is a fill rather than a shadow. A shadow is invisible
        // on the dark theme of a monochrome design system, and `--accent` is the
        // token that already means "this surface is being interacted with".
        'transition-colors duration-150',
        'hover:bg-accent/50',
        'has-[a:focus-visible]:ring-ring has-[a:focus-visible]:ring-offset-background has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-offset-2',
        className,
      )}
    >
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
              className="object-cover transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
            />
          </div>
        </Link>
      ) : null}

      {/* `Card` is set to `pt-0` above so the hero can sit flush with the top
          border. With no hero there is nothing to sit flush with, so the header
          takes the padding back. */}
      <CardHeader className={cn('gap-3', hero === null && 'pt-6')}>
        <div className="flex flex-wrap items-center gap-2">
          {/* `relative z-10` lifts the badge above the title's stretched link.
              Without it this is a link that cannot be clicked. */}
          <Link
            href={categoryPath(post.category.slug)}
            className="focus-visible:ring-ring relative z-10 rounded-full focus-visible:ring-2 focus-visible:outline-none"
          >
            <Badge variant="secondary">{post.category.name}</Badge>
          </Link>
        </div>

        <CardTitle>
          <Heading className="text-lg leading-snug font-semibold tracking-tight text-balance">
            <Link href={href} className="after:absolute after:inset-0 focus-visible:outline-none">
              {post.title}
            </Link>
          </Heading>
        </CardTitle>

        <CardDescription className="line-clamp-3 leading-relaxed text-pretty">
          {post.description}
        </CardDescription>
      </CardHeader>

      {/* `mt-auto` pins the meta to the bottom of a `h-full` card, so a
          two-line title and a three-line title still align across a row. The
          hairline gives the row a floor without adding a second surface. */}
      <CardFooter className="text-muted-foreground border-border mt-auto flex items-center justify-between gap-3 border-t pt-4 text-xs">
        {/* Plain text, not a link. One link target per card keeps the card's
            anchor text unambiguous and stops list pages turning into link soup. */}
        <span className="min-w-0 truncate">
          {post.author.name}
          <span aria-hidden="true">{' · '}</span>
          <time dateTime={post.datePublished}>{formatPostDateShort(post.datePublished)}</time>
        </span>
        <span className="inline-flex shrink-0 items-center gap-1.5">
          <ClockIcon className="size-3.5" aria-hidden="true" />
          {`${minutes} min`}
        </span>
      </CardFooter>
    </Card>
  )
}
