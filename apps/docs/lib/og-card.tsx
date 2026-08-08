/* eslint-disable @next/next/no-img-element -- `ImageResponse` renders through
   Satori, which has no concept of `next/image`. The output is a PNG rather than
   a page, so the LCP advice the rule gives does not apply. */
/**
 * The social card for docs.agentblog.dev.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS NOT `fumadocs-ui/og`
 * ---------------------------------------------------------------------------
 * Fumadocs ships a `generate` helper and it is a scaffold rather than a design:
 * an 82px extra-bold title over a 52px description, separated by a 10px dashed
 * rule, above an 18px solid border and a placeholder circle where an icon goes.
 * It exists so a new site has a card on day one, which is the right thing for it
 * to be, and it is not what this site should ship.
 *
 * This card is the same one `apps/web` generates for blog posts: the same panel
 * on the same bleed, the same 80px margin, the same mark in the same corner.
 * A reader who sees a docs link and a blog link in the same feed should see one
 * product. The two files are deliberately separate copies rather than a shared
 * package, because the blog card lives in the registry and the registry is
 * forbidden from importing anything out of this workspace.
 *
 * The duplication is the palette, the geometry, the type scale, and the element
 * tree they produce. Keep every one of them equal to
 * `apps/web/registry/blog/lib/og-card.tsx` by hand. Nothing enforces it, so a
 * change to either card is a change to both.
 *
 * ---------------------------------------------------------------------------
 * ONE WEIGHT
 * ---------------------------------------------------------------------------
 * `next/og` bundles Geist Regular and uses it when no `fonts` option is passed.
 * Asking for `fontWeight: 700` does not synthesise a heavier cut, it selects the
 * nearest weight available, which is 400. Hierarchy here is size, colour, and
 * tracking. That is also why the Fumadocs default reads the way it does: its
 * `fontWeight: 800` title is rendered at 400.
 *
 * @see https://vercel.com/docs/og-image-generation
 */
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

/* -------------------------------------------------------------------------- */
/*  Palette and geometry. Satori has no CSS cascade, so these cannot be tokens */
/* -------------------------------------------------------------------------- */

const BLEED = '#0b0b0b'
const PANEL = '#1e1e1e'
const INK = '#ededed'
const MUTED = '#8f8f8f'

export const OG_SIZE = { width: 1200, height: 630 } as const

const PANEL_INSET = 24
const PANEL_RADIUS = 48
const MARGIN = 80
const MARK_SIZE = 160

/**
 * The mark, read once at module scope and inlined as a data URI.
 *
 * Satori rasterises SVG through resvg, so the source file is used directly and
 * there is no PNG export to keep in step with it. A read inside the render path
 * would run once per page instead of once per build.
 */
const markSvg = await readFile(join(process.cwd(), 'public', 'logos', 'agentblog-icon-logo.svg'))
const mark = `data:image/svg+xml;base64,${markSvg.toString('base64')}`

/**
 * The title size, stepped by length so a one word page title fills the canvas
 * and a long one still fits on three lines. Geist averages close to 0.52em per
 * character and the line box is `1200 - 2 * MARGIN` wide.
 */
function titleFontSize(title: string): number {
  if (title.length <= 30) return 76
  if (title.length <= 50) return 68
  return 60
}

/**
 * There is no description on this card, and that is a measurement rather than a
 * preference.
 *
 * The Fumadocs default puts one there, so the first version of this file did
 * too, and it does not fit. The arithmetic, against the real content:
 *
 *   available below the mark   630 - 2*MARGIN - MARK_SIZE            310px
 *   title, longest is 35 chars two lines at 68px, `lineHeight` 1.1   150px
 *   eyebrow plus its margin                                            58px
 *   description, longest 166   three lines at 30px, plus 24px margin  145px
 *                                                                    -----
 *                                                                     353px
 *
 * Forty-three pixels over, which Satori resolves by overlapping the mark. The
 * obvious escape is `lineClamp: 2` on the description. It silently does nothing
 * here, verified against a real render, so a clamp that appeared to work would
 * have shipped the overlap anyway.
 *
 * The remaining escapes each cost more than the description is worth: shrink the
 * mark and the card stops matching every other card in the product, or truncate
 * the description and the card advertises a sentence the page does not contain.
 * The eyebrow and the title already say which page this is.
 */
interface DocsOgCardProps {
  readonly eyebrow: string
  readonly title: string
}

/**
 * The card, as a Satori element tree.
 *
 * The mark takes its own row and the text block fills the rest with
 * `justifyContent: 'center'`, so the block centres in the space the mark leaves
 * rather than in the whole canvas. Centring against the canvas collides with the
 * mark as soon as a title runs to three lines.
 */
export function docsOgCard({ eyebrow, title }: DocsOgCardProps) {
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
          padding: MARGIN - PANEL_INSET,
          color: INK,
        }}
      >
        <img
          src={mark}
          width={MARK_SIZE}
          height={MARK_SIZE}
          alt=""
          style={{ objectFit: 'contain' }}
        />

        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          <div style={{ display: 'flex', fontSize: 32, color: MUTED, marginBottom: 20 }}>
            {eyebrow}
          </div>

          <div
            style={{
              display: 'flex',
              fontSize: titleFontSize(title),
              lineHeight: 1.1,
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
