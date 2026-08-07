/**
 * The layout every documentation page renders inside: sidebar, navbar, search.
 *
 * The route group exists so that `app/not-found.tsx` and the route handlers
 * (`/llms.txt`, `/og/...`) are not wrapped in a sidebar they have no use for.
 */
import type { ReactNode } from 'react'

import { DocsLayout } from 'fumadocs-ui/layouts/docs'

import { baseOptions } from '@/lib/layout.shared'
import { source } from '@/lib/source'

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout {...baseOptions()} tree={source.getPageTree()}>
      {children}
    </DocsLayout>
  )
}
