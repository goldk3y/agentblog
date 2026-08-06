/**
 * The docs sidebar.
 *
 * A client component only because it needs `usePathname` to mark the current
 * page. The links themselves are real anchors rendered on the server, so the
 * navigation is complete in the initial HTML and works before hydration.
 */
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { cn } from '@/lib/utils'

export interface DocsNavGroup {
  readonly group: string
  readonly docs: readonly { readonly slug: string; readonly title: string }[]
}

export function DocsNav({
  groups,
  indexSlug,
}: {
  readonly groups: readonly DocsNavGroup[]
  /** `/docs` renders this page, so it has to highlight as if it were `/docs/<slug>`. */
  readonly indexSlug: string
}) {
  const rawPath = usePathname()
  const pathname = rawPath === '/docs' ? `/docs/${indexSlug}` : rawPath

  return (
    <nav aria-label="Documentation" className="space-y-7">
      {groups.map((group) => (
        <div key={group.group}>
          <h2 className="text-foreground font-mono text-xs tracking-wider uppercase">
            {group.group}
          </h2>
          <ul className="mt-3 space-y-0.5">
            {group.docs.map((doc) => {
              const href = `/docs/${doc.slug}`
              const active = pathname === href
              return (
                <li key={doc.slug}>
                  <Link
                    href={href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      '-ml-3 block rounded-md px-3 py-1.5 text-sm transition-colors',
                      active
                        ? 'bg-accent text-foreground font-medium'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {doc.title}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}
