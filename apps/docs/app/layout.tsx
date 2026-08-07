/**
 * Root layout for docs.agentblog.dev.
 *
 * Everything here is sitewide: the fonts, the theme provider, the search
 * dialog, and the metadata defaults every page inherits.
 *
 * The metadata block matters more than it looks. Next.js merges metadata
 * shallowly, so a page that sets `openGraph` at all replaces this object
 * entirely, including `siteName`. Pages here set only `title`, `description`,
 * and `openGraph.images`, and `app/[[...slug]]/page.tsx` spreads the defaults
 * back in rather than restating them. That is the same rule the blog block
 * documents, applied to the site that documents it.
 */
import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'

import { RootProvider } from 'fumadocs-ui/provider/next'

import { SITE_NAME, siteOrigin } from '@/lib/site'

import './global.css'

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

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin()),
  title: {
    default: 'AgentBlog docs',
    template: '%s | AgentBlog docs',
  },
  description:
    'How to install AgentBlog, configure it, and write posts that search engines rank and AI assistants cite.',
  applicationName: SITE_NAME,
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
  },
}

/*
 * One flat colour rather than a `prefers-color-scheme` pair, because the site
 * defaults to dark for every visitor regardless of the OS setting. Same
 * reasoning as the product site's root layout.
 */
export const viewport: Viewport = {
  themeColor: 'black',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    /*
     * `suppressHydrationWarning` is required by `next-themes`, which Fumadocs
     * uses inside RootProvider: its inline script sets `class` and `style` on
     * `<html>` before React hydrates, so server and client markup differ by
     * design on this one element.
     */
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <body className="flex min-h-screen flex-col antialiased">
        {/*
          Fumadocs owns the `next-themes` provider, so the dark default is set
          through its `theme` option rather than by mounting our own. Leaving
          `enableSystem` on would hand the decision back to the OS, which is what
          `defaultTheme` is trying to take away. The product site's provider
          carries the long version of this reasoning.
        */}
        <RootProvider theme={{ defaultTheme: 'dark', enableSystem: false }}>
          {children}
        </RootProvider>
      </body>
    </html>
  )
}
