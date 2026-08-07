/* eslint-disable @next/next/no-img-element -- `ImageResponse` renders through
   Satori, which understands a small subset of HTML and CSS and has no concept of
   `next/image`. A plain `img` element is the only one available in this file, and
   the output is a static PNG rather than a page, so the LCP advice the rule gives
   does not apply here. */
/**
 * Site-level Open Graph card, at `/opengraph-image`.
 *
 * ---------------------------------------------------------------------------
 * THE COLOUR LITERALS IN THIS FILE ARE INTENTIONAL AND SANCTIONED
 * ---------------------------------------------------------------------------
 * Everywhere else in this block, hardcoded colours are a lint failure: pages use
 * semantic Tailwind tokens (`bg-background`, `text-muted-foreground`) so the
 * theme flips correctly and the block inherits the consumer's design system.
 *
 * This file is the documented exception, and it is an exception of necessity
 * rather than convenience. `ImageResponse` renders through Satori, which has no
 * DOM, no stylesheet, and therefore no CSS custom properties. It cannot read
 * `--background`. The only way to colour a generated PNG is a literal.
 *
 * The palette is kept deliberately neutral so it composes with any brand. If you
 * want it on-brand, edit the constants below; do not try to wire them to your
 * theme tokens, because there is nothing at this layer to read them from.
 *
 * ---------------------------------------------------------------------------
 * HARD LIMITS AND ONE PERFORMANCE RULE
 * ---------------------------------------------------------------------------
 * - `opengraph-image` output must be at most 8MB or THE BUILD FAILS. (The
 *   `twitter-image` limit is 5MB.) A 1200x630 PNG from this layout is a few tens
 *   of kilobytes, so the only realistic way to breach it is embedding a large
 *   asset.
 * - `ImageResponse` has a 500KB bundle ceiling covering JSX, CSS, fonts, and
 *   images. That is why `readBrandLogo` below refuses an oversized file rather
 *   than letting it break the build somewhere less obvious.
 * - Any file read happens ONCE, at module scope. A `readFile` inside the default
 *   export runs on every single OG generation, which for a blog with two hundred
 *   posts is two hundred disk reads for a byte-identical result.
 * - Satori supports flexbox and a subset of CSS. `display: grid` does not work.
 *   Every element with children below sets `display: flex` explicitly.
 *
 * @see https://docs.agentblog.dev/reference/files
 */
import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { extname, join } from 'node:path'

import { config } from '@/lib/config'

export const alt = `${config.brand.name} blog`
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

/* -------------------------------------------------------------------------- */
/*  Palette. Literals are permitted in this file only. See the header.         */
/* -------------------------------------------------------------------------- */

const INK = '#0b0b0f'
const PAPER = '#fafafa'
const MUTED = '#a1a1aa'
const RULE = '#27272a'
const ACCENT = '#6366f1'

/** Refuse anything that would eat the 500KB bundle budget on its own. */
const MAX_LOGO_BYTES = 150_000

/**
 * Read the brand logo once, at module scope, and inline it as a data URI.
 *
 * Returns `null` rather than throwing on every failure path, because a missing
 * or remote logo must degrade to a wordmark rather than break the build of every
 * route that has an OG image.
 */
async function readBrandLogo(): Promise<string | null> {
  const url = config.brand.logo.url

  // A remote logo would mean a network fetch per generation, which is precisely
  // the per-request work this module-scope read exists to avoid.
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) return null

  const extension = extname(url).toLowerCase()
  // PNG and JPEG only. Satori's SVG support is partial and the failure mode is a
  // blank card, which is worse than a wordmark.
  const mime =
    extension === '.png'
      ? 'image/png'
      : extension === '.jpg' || extension === '.jpeg'
        ? 'image/jpeg'
        : null
  if (!mime) return null

  try {
    const bytes = await readFile(join(process.cwd(), 'public', url.replace(/^\/+/, '')))
    if (bytes.byteLength > MAX_LOGO_BYTES) {
      console.warn(
        `[agentblog] ${url} is ${bytes.byteLength} bytes, over the ${MAX_LOGO_BYTES} byte ` +
          'budget for an inlined OG asset. Falling back to a text wordmark.',
      )
      return null
    }
    return `data:${mime};base64,${bytes.toString('base64')}`
  } catch {
    return null
  }
}

const brandLogo = await readBrandLogo()

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        backgroundColor: INK,
        color: PAPER,
        padding: 72,
        fontFamily: 'sans-serif',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        {brandLogo ? (
          <img src={brandLogo} width={56} height={56} alt="" style={{ borderRadius: 12 }} />
        ) : null}
        <div style={{ display: 'flex', fontSize: 32, fontWeight: 600, letterSpacing: -0.5 }}>
          {config.brand.name}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'flex', width: 96, height: 6, backgroundColor: ACCENT }} />
        <div
          style={{
            display: 'flex',
            fontSize: 68,
            fontWeight: 700,
            lineHeight: 1.1,
            letterSpacing: -2,
          }}
        >
          Writing worth citing
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderTop: `1px solid ${RULE}`,
          paddingTop: 28,
          fontSize: 24,
          color: MUTED,
        }}
      >
        <div style={{ display: 'flex' }}>{config.siteUrl.replace(/^https?:\/\//, '')}</div>
        <div style={{ display: 'flex' }}>Blog</div>
      </div>
    </div>,
    { ...size },
  )
}
