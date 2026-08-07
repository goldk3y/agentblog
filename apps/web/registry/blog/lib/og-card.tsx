/**
 * The Open Graph card, in one file.
 *
 * `app/blog/opengraph-image.tsx` and `app/blog/[slug]/opengraph-image.tsx` both
 * render this. They used to hold two copies of the same layout with a note
 * telling you to keep seven constants in sync by hand, which is a rule that
 * holds until the first time somebody changes one card and ships.
 *
 * ---------------------------------------------------------------------------
 * THE COLOUR LITERALS IN THIS FILE ARE INTENTIONAL AND SANCTIONED
 * ---------------------------------------------------------------------------
 * Everywhere else in this block a hardcoded colour is a lint failure: pages use
 * semantic tokens (`bg-background`, `text-muted-foreground`) so the theme flips
 * correctly and the block inherits your design system.
 *
 * This file is the documented exception, and it is an exception of necessity.
 * Satori has no DOM, no stylesheet, and therefore no CSS custom properties. It
 * cannot read `--background`. A literal is the only way to colour a PNG.
 *
 * MAKING THE CARD YOURS IS A FOUR LINE EDIT. Change the four colours below to
 * the resolved values of your own `--background`, `--card`, `--foreground`, and
 * `--muted-foreground`. Resolved, not `var(--card)`: paste the hex or `oklch()`
 * your stylesheet ends up at. Nothing else in the card needs touching, and no
 * other file repeats these values.
 *
 * ---------------------------------------------------------------------------
 * TYPOGRAPHY, AND WHY THERE IS EXACTLY ONE WEIGHT
 * ---------------------------------------------------------------------------
 * `next/og` bundles Geist Regular and uses it when no `fonts` option is passed.
 * That is one weight, 400, and asking for `fontWeight: 600` does not synthesise
 * a bolder cut: Satori picks the nearest weight it has, which is the one it has.
 * So the hierarchy here is carried by size, colour, and tracking rather than by
 * weight, which is the correct way to build it anyway.
 *
 * To use your own typeface, read a `.ttf` or `.otf` at module scope and pass it
 * through the `fonts` option of `ImageResponse` in both routes:
 *
 *     const brand = await readFile(join(process.cwd(), 'public/fonts/Brand.ttf'))
 *     new ImageResponse(ogCard({ ... }), {
 *       ...OG_SIZE,
 *       fonts: [{ name: 'Brand', data: brand, weight: 400, style: 'normal' }],
 *     })
 *
 * and add `fontFamily: 'Brand'` to the root style below. Only `ttf`, `otf`, and
 * `woff` parse, and the whole `ImageResponse` bundle (JSX, CSS, fonts, images)
 * has a 500KB ceiling, so one weight of one family is the realistic budget.
 *
 * ---------------------------------------------------------------------------
 * HARD LIMITS
 * ---------------------------------------------------------------------------
 * - `opengraph-image` output must be at most 8MB or THE BUILD FAILS. The
 *   `twitter-image` limit is 5MB. This layout produces a few tens of kilobytes,
 *   so the only realistic way to breach it is embedding a large asset.
 * - Satori supports flexbox and a subset of CSS. `display: grid` does not work,
 *   and every element with children below sets `display: flex` explicitly
 *   because Satori requires it rather than inferring it.
 * - Any file read happens ONCE, at module scope. A `readFile` inside the render
 *   path runs on every card, which for two hundred posts is two hundred reads
 *   for byte-identical output.
 *
 * @see https://docs.agentblog.dev/reference/files
 * @see https://vercel.com/docs/og-image-generation
 */
import { readFile } from 'node:fs/promises'
import { extname, join } from 'node:path'

import { config } from '@/lib/config'

/* -------------------------------------------------------------------------- */
/*  Palette. Literals are permitted in this file only. See the header.        */
/* -------------------------------------------------------------------------- */

/** The bleed behind the panel. Your `--background`. */
const BLEED = '#0b0b0b'
/** The panel itself. Your `--card`. */
const PANEL = '#1e1e1e'
/** Title and wordmark. Your `--foreground`. */
const INK = '#ededed'
/** The eyebrow. Your `--muted-foreground`. */
const MUTED = '#8f8f8f'

/* -------------------------------------------------------------------------- */
/*  Geometry                                                                  */
/* -------------------------------------------------------------------------- */

/** 1200x630 is what every platform crops against. Do not change it. */
export const OG_SIZE = { width: 1200, height: 630 } as const

export const OG_CONTENT_TYPE = 'image/png'

/** The panel floats inside the canvas, so the card has an edge on any feed. */
const PANEL_INSET = 24
const PANEL_RADIUS = 48

/** Distance from the canvas edge to the content. The panel absorbs the inset. */
const MARGIN = 80

/** The brand mark, square. A non-square logo is letterboxed by `objectFit`. */
const MARK_SIZE = 160

/* -------------------------------------------------------------------------- */
/*  The brand mark                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Refuse anything that would eat the 500KB `ImageResponse` budget on its own.
 *
 * A logo over this size is nearly always a full resolution export that was never
 * meant for a 160px slot. Resize it rather than raising this number.
 */
const MAX_LOGO_BYTES = 150_000

const LOGO_MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
}

/**
 * Read `brand.logo.url` out of `public/` once, at module scope, and inline it as
 * a data URI.
 *
 * ---------------------------------------------------------------------------
 * IF YOUR CARDS SHOW A WORDMARK WHERE YOUR LOGO SHOULD BE, IT IS ONE OF THESE
 * ---------------------------------------------------------------------------
 * Every failure path returns `null` and the card falls back to your brand name
 * set in the mark's position. That is deliberate: a missing logo must not fail
 * the build of every route that has an OG image. It does mean the failure is
 * quiet, so the four causes are listed here and `agentblog doctor` reports them.
 *
 *   1. `brand.logo.url` is a remote URL. Refused on purpose. A remote logo is a
 *      network fetch per generation, which is exactly the per-request work this
 *      module-scope read exists to avoid. Copy the file into `public/`.
 *   2. The extension is not `.png`, `.jpg`, `.jpeg`, or `.svg`. A `.webp` or an
 *      `.ico` will not rasterise here.
 *   3. There is no such file under `public/`. `brand.logo.url` is a URL path, so
 *      `/logo.png` means `public/logo.png`.
 *   4. The file is over 150KB. See `MAX_LOGO_BYTES`.
 *
 * NO LOGO AT ALL? Export a square PNG at 512x512 with a transparent background,
 * save it as `public/logo.png`, and set
 * `brand: { logo: { url: '/logo.png', width: 512, height: 512 } }` in
 * `agentblog.config.ts`. Those dimensions are also what `Organization.logo` in
 * the JSON-LD graph needs, so one file serves the card and the structured data.
 * Google does not accept SVG for `Organization.logo`, which is why the config
 * field wants a raster even though the card here will take either.
 */
async function readBrandMark(): Promise<string | null> {
  const url = config.brand.logo.url

  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) return null

  const mime = LOGO_MIME[extname(url).toLowerCase()]
  if (mime === undefined) return null

  try {
    const bytes = await readFile(join(process.cwd(), 'public', url.replace(/^\/+/, '')))
    if (bytes.byteLength > MAX_LOGO_BYTES) {
      console.warn(
        `[agentblog] ${url} is ${bytes.byteLength} bytes, over the ${MAX_LOGO_BYTES} byte budget ` +
          'for an inlined Open Graph asset. Falling back to a text wordmark.',
      )
      return null
    }
    return `data:${mime};base64,${bytes.toString('base64')}`
  } catch {
    return null
  }
}

const brandMark = await readBrandMark()

/* -------------------------------------------------------------------------- */
/*  Type scale                                                                */
/* -------------------------------------------------------------------------- */

/**
 * The title size, stepped by length so a short title fills the canvas and a long
 * one still fits.
 *
 * A single fixed size is the usual approach and it is what makes most generated
 * cards look wrong: at a size chosen for the longest title, a five word headline
 * sits marooned in the middle of the panel.
 *
 * The steps are derived rather than guessed. Geist averages close to 0.52em per
 * character, the line box is `1200 - 2 * MARGIN` wide, and `PostSchema` caps a
 * title at 70 characters. Every step below therefore lands on three lines or
 * fewer, and three lines at `TITLE_LINE_HEIGHT` clears the mark above it. Raise
 * the schema cap and this function is what has to move with it.
 */
export function titleFontSize(title: string): number {
  if (title.length <= 30) return 76
  if (title.length <= 50) return 68
  return 60
}

const TITLE_LINE_HEIGHT = 1.1
const EYEBROW_SIZE = 32

/* -------------------------------------------------------------------------- */
/*  The card                                                                  */
/* -------------------------------------------------------------------------- */

interface OgCardProps {
  /**
   * The line above the title. Omit it on a card that stands for a whole surface
   * rather than one post, where there is no honest thing for it to say.
   */
  readonly eyebrow?: string
  readonly title: string
}

/**
 * The card, as a Satori element tree.
 *
 * The mark sits in its own row at the top and the text block takes the rest of
 * the height with `justifyContent: 'center'`, so the block is centred in the
 * space the mark leaves rather than in the whole canvas. Centring against the
 * canvas is the obvious reading of "vertically centred" and it collides with the
 * mark on a three line title, which only shows up on the longest post you have.
 */
export function ogCard({ eyebrow, title }: OgCardProps) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        backgroundColor: BLEED,
        padding: PANEL_INSET,
      }}
    >
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: PANEL,
          borderRadius: PANEL_RADIUS,
          // The panel already carries `PANEL_INSET`, so this is what brings the
          // content to `MARGIN` from the canvas edge.
          padding: MARGIN - PANEL_INSET,
          color: INK,
        }}
      >
        {brandMark ? (
          /*
           * THE DISABLE HAS TO BE HERE, NOT AT THE TOP OF THE FILE.
           *
           * `ImageResponse` renders through Satori, which implements a small
           * subset of HTML and has no concept of `next/image`. A plain `img` is
           * the only element available, and the output is a PNG rather than a
           * page, so the LCP advice the rule gives does not apply.
           *
           * A file-level eslint-disable banner would be the tidier place for
           * that, and it does not survive the trip: `shadcn add` strips the
           * leading comment block from every file it installs. The banner would
           * be present in this repo and absent in yours, so the warning would
           * appear in your project and never in ours, which is the worst place
           * for a lint rule to disagree. A directive attached to the line it
           * governs sits inside the JSX and is copied along with it.
           */
          // eslint-disable-next-line @next/next/no-img-element -- see above
          <img
            src={brandMark}
            width={MARK_SIZE}
            height={MARK_SIZE}
            alt=""
            style={{ objectFit: 'contain' }}
          />
        ) : (
          /*
           * The fallback when there is no readable logo. See `readBrandMark` for
           * the four reasons you are looking at this instead of your mark.
           */
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              height: MARK_SIZE,
              fontSize: 40,
              letterSpacing: -1,
            }}
          >
            {config.brand.name}
          </div>
        )}

        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          {eyebrow !== undefined ? (
            <div
              style={{
                display: 'flex',
                fontSize: EYEBROW_SIZE,
                color: MUTED,
                // Geist tightens as it grows, so the eyebrow is the one line
                // that reads better at its natural tracking.
                letterSpacing: 0,
                marginBottom: 20,
              }}
            >
              {eyebrow}
            </div>
          ) : null}

          <div
            style={{
              display: 'flex',
              fontSize: titleFontSize(title),
              lineHeight: TITLE_LINE_HEIGHT,
              // Negative tracking at display sizes is what makes a large Geist
              // heading read as one shape rather than as spaced out letters.
              letterSpacing: -2,
            }}
          >
            {title}
          </div>
        </div>
      </div>
    </div>
  )
}
