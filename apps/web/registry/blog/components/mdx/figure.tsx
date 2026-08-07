/**
 * `<Figure>` - an image with a caption, plus the `img` adapter for MDX.
 *
 * ---------------------------------------------------------------------------
 * WHY A FIGURE AND NOT A BARE IMAGE
 * ---------------------------------------------------------------------------
 * `alt` says what the image *is*. `<figcaption>` says what it *means*, and it
 * is the part that survives into an extracted chunk as ordinary prose. An
 * original chart of your own data is one of the stronger assets a post can
 * carry, and it is worth roughly nothing to a machine unless the numbers exist
 * in HTML nearby. Pair a chart with the table that produced it.
 *
 * If critical text lives only inside the image, a crawler that does not run OCR
 * never sees it. Mirror it in the caption or the body.
 *
 * ---------------------------------------------------------------------------
 * DIMENSIONS, AND WHY THEY ARE NOT OPTIONAL IN PRACTICE
 * ---------------------------------------------------------------------------
 * `next/image` needs intrinsic dimensions to reserve space, and space it does
 * not reserve is a layout shift. Markdown's `![alt](src)` carries no
 * dimensions, so `MdxImage` falls back to a 16:9 box. Authors who care about
 * CLS should use `<Figure width height />` explicitly.
 *
 * `preload` (not `priority`, which is deprecated in Next 16) belongs on at most
 * one image per route, and only when that image is definitively the LCP
 * element. Setting it on three images preloads three and prioritises none.
 *
 * Remote sources need `images.remotePatterns` in `next.config.ts`. `agentblog
 * doctor` checks for it.
 *
 * @see https://docs.agentblog.dev/concepts/geo-playbook*/
import Image from 'next/image'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'

const FALLBACK_WIDTH = 1600
const FALLBACK_HEIGHT = 900

/** Article measure at desktop, full viewport below it. Keeps srcset honest. */
const SIZES = '(min-width: 768px) 720px, 100vw'

export interface FigureProps {
  readonly src: string
  /** Describe what the image shows, in plain language. Never leave it empty. */
  readonly alt: string
  readonly caption?: ReactNode
  readonly width?: number
  readonly height?: number
  /** At most one per route, and only for the LCP image. */
  readonly preload?: boolean
}

export function Figure({ src, alt, caption, width, height, preload }: FigureProps) {
  return (
    <figure className="my-8">
      <Image
        src={src}
        alt={alt}
        width={width ?? FALLBACK_WIDTH}
        height={height ?? FALLBACK_HEIGHT}
        sizes={SIZES}
        className="border-border h-auto w-full rounded-xl border"
        {...(preload === true ? { preload: true } : {})}
      />
      {caption !== undefined && (
        <figcaption className="text-muted-foreground mt-3 text-sm leading-relaxed">
          {caption}
        </figcaption>
      )}
    </figure>
  )
}

/**
 * The `img` mapping for MDX.
 *
 * Markdown gives us `src`, `alt`, and the title in `![alt](src "title")`. The
 * title becomes the caption, which is the closest markdown gets to a
 * `<figcaption>` without dropping to JSX.
 */
export function MdxImage({ src, alt, title, width, height }: ComponentPropsWithoutRef<'img'>) {
  // MDX types `src` as `string | Blob | undefined`. Anything but a string is
  // not something `next/image` can render, and rendering nothing is better than
  // rendering a broken box.
  if (typeof src !== 'string' || src.length === 0) return null

  const parsedWidth = toDimension(width)
  const parsedHeight = toDimension(height)

  return (
    <Figure
      src={src}
      // An empty alt is an accessibility failure that `agentblog audit` reports.
      // It is not this component's job to invent one.
      alt={alt ?? ''}
      {...(title !== undefined && title.length > 0 ? { caption: title } : {})}
      {...(parsedWidth !== undefined ? { width: parsedWidth } : {})}
      {...(parsedHeight !== undefined ? { height: parsedHeight } : {})}
    />
  )
}

function toDimension(value: string | number | undefined): number | undefined {
  if (value === undefined) return undefined
  const n = typeof value === 'number' ? value : Number.parseInt(value, 10)
  return Number.isFinite(n) && n > 0 ? n : undefined
}

export default Figure
