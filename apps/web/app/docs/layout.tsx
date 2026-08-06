/**
 * Docs shell: sidebar plus content column.
 *
 * The sidebar is built from the frontmatter of every file in `content/docs/`, so
 * adding a page is adding a Markdown file. There is no navigation array to keep
 * in sync, which is the usual way a docs site ends up with an orphaned page.
 */
import type { Metadata } from 'next'

import { DocsNav } from '@/components/site/docs-nav'
import { DOCS_INDEX_SLUG, getDocNav } from '@/lib/docs'

export const metadata: Metadata = {
  title: { default: 'Documentation', template: '%s | AgentBlog docs' },
}

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const groups = getDocNav().map((entry) => ({
    group: entry.group,
    docs: entry.docs.map((doc) => ({ slug: doc.slug, title: doc.title })),
  }))

  return (
    <div className="mx-auto flex max-w-6xl gap-12 px-5 py-12 sm:px-8 lg:py-16">
      <aside className="hidden w-56 shrink-0 lg:block">
        <div className="sticky top-24 max-h-[calc(100dvh-8rem)] overflow-y-auto pr-2 pb-8">
          <DocsNav groups={groups} indexSlug={DOCS_INDEX_SLUG} />
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* Small screens get the same navigation inside a disclosure. */}
        <details className="border-border mb-10 rounded-lg border p-4 lg:hidden">
          <summary className="text-foreground cursor-pointer list-none text-sm font-medium">
            All documentation
          </summary>
          <div className="mt-5">
            <DocsNav groups={groups} indexSlug={DOCS_INDEX_SLUG} />
          </div>
        </details>

        {children}
      </div>
    </div>
  )
}
