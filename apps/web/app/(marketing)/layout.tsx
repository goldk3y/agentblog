/**
 * Layout for the marketing route group.
 *
 * It exists for one reason: to emit the sitewide Organization and WebSite
 * JSON-LD on pages that are not blog pages.
 *
 * The blog block emits those two nodes from `app/blog/layout.tsx`, because the
 * article graph references them by `@id` and a shadcn registry can write a blog
 * layout but cannot patch a root layout. Putting them in the root layout as well
 * would emit the same two nodes twice on every blog page, so the marketing group
 * carries its own copy instead. Neither layout wraps the other.
 */
import type { ReactNode } from 'react'

import { buildOrgGraph, renderJsonLd } from '@/lib/schema'

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        // `renderJsonLd` is the single serialization point in the block, and it
        // escapes `<` so a brand name containing markup cannot close the script
        // tag early. Never call `JSON.stringify` here directly.
        dangerouslySetInnerHTML={{ __html: renderJsonLd(buildOrgGraph()) }}
      />
      {children}
    </>
  )
}
