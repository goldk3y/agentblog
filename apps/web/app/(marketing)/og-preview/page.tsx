/* eslint-disable @next/next/no-img-element -- every image on this page is a
   1200x630 Open Graph card, and the whole point is to see the exact bytes a
   scraper will fetch. `next/image` would re-encode and resize them, which is the
   one thing this page must not do. */
/**
 * Every Open Graph card this site produces, on one page.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS SHOWS REAL PNGs AND NOT A REACT MOCK
 * ---------------------------------------------------------------------------
 * The tempting version renders `ogCard()` straight into the DOM, since it is
 * ordinary JSX with inline styles and the browser would happily lay it out. It
 * would also lie. The shipped cards are rendered by Satori, which implements a
 * subset of flexbox, resolves fonts differently, and rasterises through resvg.
 * A DOM preview agrees with it right up to the moment a design decision depends
 * on the difference, which is the only moment a preview is worth having.
 *
 * So each frame below is an `<img>` pointed at the real route. What you see is
 * what a scraper gets.
 *
 * This page is agentblog.dev furniture. It is not in any registry item, so a
 * consumer never installs it.
 */
import type { Metadata } from 'next'

import { OG_SAMPLES } from './samples'

import { blogPath, config, postPath } from '@/lib/config'
import { titleFontSize } from '@/lib/og-card'
import { getAllPosts } from '@/lib/posts'

/**
 * The caption under each generated card: how long the title is, and which step
 * of the type scale that lands on.
 *
 * The size is computed with the same function the card uses rather than written
 * out, so this page cannot claim a step the renderer did not pick. It is also
 * the only place the scale is observable: `titleFontSize` lives in a `.tsx`
 * module, and `node --test` cannot load JSX, so there is no unit test to put
 * this assertion in.
 */
function scaleNote(title: string): string {
  return `${String(title.length)} characters, ${String(titleFontSize(title))}px`
}

export const metadata: Metadata = {
  title: 'Open Graph preview',
  description: 'Every social card agentblog.dev generates, at the size a scraper fetches it.',
  /*
   * An internal design tool has no business in an index, and it is linked from
   * nowhere, so `follow` buys nothing either. Defining `robots` here replaces the
   * layout's object wholesale, which is the intended outcome for this one page
   * and a bug on any other. See `lib/metadata.ts`.
   */
  robots: { index: false, follow: false },
}

interface Card {
  readonly label: string
  readonly note: string
  readonly src: string
}

/** One card, at half size, with the URL it came from. */
function CardFrame({ card }: { card: Card }) {
  return (
    <figure className="flex flex-col gap-3">
      <img
        src={card.src}
        width={1200}
        height={630}
        alt={card.label}
        className="border-border w-full rounded-lg border"
      />
      <figcaption className="flex flex-col gap-1">
        <span className="text-foreground text-sm font-medium">{card.label}</span>
        <span className="text-muted-foreground text-sm">{card.note}</span>
        <code className="text-muted-foreground font-mono text-xs">{card.src}</code>
      </figcaption>
    </figure>
  )
}

function Group({ title, lead, cards }: { title: string; lead: string; cards: Card[] }) {
  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-foreground text-2xl">{title}</h2>
        <p className="text-muted-foreground max-w-2xl text-sm">{lead}</p>
      </div>
      <div className="grid gap-10 sm:grid-cols-2">
        {cards.map((card) => (
          <CardFrame key={card.src} card={card} />
        ))}
      </div>
    </section>
  )
}

export default async function OgPreviewPage() {
  const posts = await getAllPosts()

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-16 px-6 py-16">
      <header className="flex flex-col gap-3">
        <h1 className="text-foreground text-3xl">Open Graph preview</h1>
        <p className="text-muted-foreground max-w-2xl">
          Every card is the real PNG from its route, at 1200x630. Rendering the layout in the
          browser instead would disagree with Satori in exactly the cases worth looking at.
        </p>
      </header>

      <Group
        title="The site"
        lead="A static file at app/opengraph-image.png. It covers the landing page and everything else outside /blog, and nothing the blog block installs can overwrite it."
        cards={[
          {
            label: 'agentblog.dev',
            note: 'Static PNG, served by the file convention with its own alt text sidecar.',
            src: '/opengraph-image.png',
          },
        ]}
      />

      <Group
        title="The blog"
        lead="Generated from agentblog.config.ts. Every list surface points at this one card by name: /blog and its pagination, category hubs, tag pages, author pages, and the editorial policy."
        cards={[
          {
            label: 'Blog and every list surface',
            note: 'The mark and the word Blog, because one image stands for a dozen URLs.',
            src: blogPath() + '/opengraph-image',
          },
        ]}
      />

      <Group
        title="Posts"
        lead={`Generated at build time, one per post, from the title in frontmatter. The eyebrow is always "${config.brand.name} Blog".`}
        cards={posts.map((post) => ({
          label: post.title,
          note: scaleNote(post.title),
          src: `${postPath(post.slug)}/opengraph-image`,
        }))}
      />

      <Group
        title="Title lengths"
        lead="The three steps of titleFontSize, so the type scale can be judged without waiting for a post that happens to be the right length. The last is the 70 character maximum PostSchema allows."
        cards={OG_SAMPLES.map((sample, index) => ({
          label: sample.label,
          note: scaleNote(sample.title),
          src: `/og-preview/sample/${String(index)}`,
        }))}
      />
    </div>
  )
}
