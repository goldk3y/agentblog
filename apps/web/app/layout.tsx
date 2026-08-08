/**
 * Root layout for agentblog.dev.
 *
 * ===========================================================================
 * THIS FILE IS ALSO A SPECIFICATION
 * ===========================================================================
 * `agentblog init` patches a consumer's `app/layout.tsx` to reach the same end
 * state as the blocks marked `CLI-PATCHED` below. Everything else here is site
 * chrome that belongs to agentblog.dev and that the CLI never writes.
 *
 * If you change a `CLI-PATCHED` block, change
 * `packages/cli/src/patchers/root-layout.ts` in the same commit. The patcher's
 * merge semantics are the ones stated in `commands/init-patches.ts`: it only
 * writes `metadataBase` and `title.template` when they are absent, and it
 * reports rather than overwriting a value the user already set.
 *
 * ---------------------------------------------------------------------------
 * WHY EACH PATCHED PIECE MATTERS
 * ---------------------------------------------------------------------------
 * `metadataBase`      Next.js resolves every relative metadata URL against it.
 *                     Without it, a relative `openGraph.images` entry is a build
 *                     error, and an "absolute" path like `/og.png` silently
 *                     becomes a relative URL.
 * `title.template`    Applies to child segments only, and `title.default` is
 *                     required alongside it. A template declared in
 *                     `app/blog/layout.tsx` does not apply to `app/blog/page.tsx`,
 *                     which is why it lives here and not there.
 * `alternates.types`  Where RSS goes. Not `alternates.canonical`, not a hand
 *                     written `<link>` in `<head>`.
 * `verification`      Search Console and Bing ownership tokens, read from
 *                     `agentblog.config.ts` so verification is one config line.
 * Organization/WebSite JSON-LD
 *                     The two sitewide nodes every per-page `@graph` references
 *                     by `@id`. Emitting them once here means an article graph
 *                     can point at `#organization` instead of restating the
 *                     publisher on every post.
 *
 * @see https://docs.agentblog.dev/reference/files
 */
import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'

import { SiteFooter } from '@/components/site/footer'
import { SiteHeader } from '@/components/site/header'
import { ThemeProvider } from '@/components/site/theme-provider'
import { absoluteUrl, config } from '@/lib/config'

import './globals.css'

/*
 * Geist and Geist Mono, the two cuts of the one typeface the Geist design
 * system defines. Nothing else is loaded: the site has no serif, so a stray
 * `font-serif` resolves to nothing rather than to a font nobody chose.
 *
 * Both are variable fonts across weights 100 to 900, which is what makes the
 * heading weight of 450 in `globals.css` a real instance rather than a
 * synthesised one. `font-synthesis: none` in the base layer proves it: if the
 * variable axis were missing, headings would render at 400 and the difference
 * would be visible rather than silent.
 *
 * `next/font` self hosts the files, emits the `@font-face` rules at build time,
 * and sets `size-adjust` fallback metrics. No network request to a font CDN at
 * runtime, so no render-blocking third party and no layout shift when the
 * webfont arrives.
 */
const geistSans = Geist({
  subsets: ['latin'],
  variable: '--font-geist-sans',
  display: 'swap',
})

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
  display: 'swap',
})

/* -------------------------------------------------------------------------- */
/*  CLI-PATCHED: metadata                                                     */
/* -------------------------------------------------------------------------- */

export const metadata: Metadata = {
  metadataBase: new URL(config.siteUrl),
  title: {
    default: 'AgentBlog: an SEO and GEO complete blog for Next.js 16',
    template: `%s | ${config.brand.name}`,
  },
  description:
    'A Next.js 16 blog you install into your own app. Prerendered HTML for AI crawlers, a complete JSON-LD graph, sitemap, RSS, IndexNow, and agent skills that write and audit posts.',
  applicationName: config.brand.name,
  authors: [{ name: config.brand.name, url: config.siteUrl }],
  creator: config.brand.name,
  publisher: config.brand.name,
  alternates: {
    canonical: '/',
    types: {
      'application/rss+xml': [
        { url: absoluteUrl('/feed.xml'), title: `${config.brand.name} blog` },
      ],
    },
  },
  openGraph: {
    type: 'website',
    siteName: config.brand.name,
    locale: config.locale,
    url: config.siteUrl,
  },
  /*
   * Explicit spreads rather than `google: config.verification.google`, because
   * `exactOptionalPropertyTypes` rejects passing `undefined` to an optional
   * property. Writing the key only when a value exists also keeps the rendered
   * `<head>` free of empty verification tags.
   */
  verification: {
    ...(config.verification.google !== undefined ? { google: config.verification.google } : {}),
    ...(config.verification.yandex !== undefined ? { yandex: config.verification.yandex } : {}),
    ...(config.verification.yahoo !== undefined ? { yahoo: config.verification.yahoo } : {}),
    ...(config.verification.other !== undefined ? { other: config.verification.other } : {}),
  },
}

/*
 * One flat colour rather than a `prefers-color-scheme` pair. The site defaults
 * to dark for every visitor regardless of the OS setting (see
 * `components/site/theme-provider.tsx`), so keying the browser chrome off the OS
 * would paint a white address bar above a dark page on a light desktop. Nothing
 * can follow the toggle here: `theme-color` reads a meta tag, not the `.dark`
 * class, so the correct value is the one the first paint uses.
 */
export const viewport: Viewport = {
  themeColor: 'black',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    /*
     * `suppressHydrationWarning` is required by `next-themes`: the inline script
     * it injects sets the `class` and `style` attributes on `<html>` before
     * React hydrates, so server and client markup differ by design on this one
     * element. Scoped here, it does not suppress warnings anywhere else.
     */
    <html
      lang={config.locale.split('_')[0] ?? 'en'}
      suppressHydrationWarning
      /*
       * Declares the `scroll-behavior: smooth` that `globals.css` sets on this
       * element, and it is not decorative.
       *
       * Next.js pins `scroll-behavior: auto` on `<html>` for the duration of a
       * route transition so the scroll reset is instant, but it only does so
       * when this attribute is present. Reading the computed style on every
       * navigation would cost a forced reflow, so the attribute is the opt in.
       *
       * Without it, the App Router's scroll handler calls `scrollIntoView` on
       * the new segment, which React fans out over every top level child in
       * reverse order. Each call retargets a smooth animation that is still in
       * flight, and the final call (the hero, whose target clamps to 0) is a no
       * op against a page already at 0, so it never cancels the animation the
       * second section started. Clicking the wordmark from /blog then lands on
       * section two instead of the top.
       *
       * @see https://nextjs.org/docs/messages/missing-data-scroll-behavior
       */
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <body className="flex min-h-dvh flex-col antialiased">
        {/*
         * The Organization and WebSite nodes are NOT emitted here.
         *
         * `app/blog/layout.tsx`, which the registry installs, emits them for
         * every blog page, because the article graph references them by `@id`
         * and a registry cannot patch a root layout. Emitting them here as well
         * would put the same two nodes on every blog page twice.
         *
         * Marketing pages get them from `app/(marketing)/layout.tsx` instead.
         */}

        <ThemeProvider>
          <a
            href="#main"
            className="bg-primary text-primary-foreground sr-only rounded-md px-4 py-2 focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50"
          >
            Skip to content
          </a>
          <SiteHeader />
          <main id="main" className="flex-1">
            {children}
          </main>
          <SiteFooter />
        </ThemeProvider>
      </body>
    </html>
  )
}
