import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import './globals.css'

/**
 * The fixture's root layout, deliberately missing two metadata fields.
 *
 * ===========================================================================
 * DO NOT ADD `metadataBase` OR `title.template` HERE
 * ===========================================================================
 * Same reason as `next.config.ts`, and the same silent failure if someone tidies
 * it up. These two fields are what `agentblog doctor --fix` writes through
 * `packages/cli/src/patchers/root-layout.ts`, and CI asserts the patch landed.
 * Filling them in by hand leaves the patcher with nothing to do, so the
 * assertion passes against values a human typed rather than against the tool's
 * output, which is the case it exists to check.
 *
 * There is no `title` key here either, and that is forced rather than chosen.
 * Next.js types `title` as a string or a `TemplateString`, and `TemplateString`
 * requires `template` alongside `default`, so "an object with a default and no
 * template" does not type check. A plain string would type check and would be
 * worse: the patcher deliberately declines to convert one, because a site's
 * title format is an editorial decision belonging to whoever wrote it. Leaving
 * `title` out entirely is the only state in which the patcher writes both halves
 * and CI can see it happen.
 *
 * `apps/web/app/layout.tsx` is the reference end state. Read the fields there.
 */
export const metadata: Metadata = {
  description: 'Install target for the AgentBlog registry and CLI.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
