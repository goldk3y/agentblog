/**
 * Site header.
 *
 * A Server Component apart from the theme toggle. The mobile menu is a
 * `<details>` element rather than a client component holding open state: it
 * works before hydration, it works with JavaScript off, and it is one of the two
 * places on this site where the disclosure pattern the blog block uses for FAQs
 * and the table of contents is worth demonstrating.
 */
import Link from 'next/link'

import { Github, Menu } from '@/components/site/icons'
import { ThemeToggle } from '@/components/site/theme-toggle'

const NAV = [
  { href: '/docs', label: 'Docs' },
  { href: '/docs/geo-playbook', label: 'GEO playbook' },
  { href: '/registry', label: 'Registry' },
  { href: '/blog', label: 'Blog' },
] as const

export function SiteHeader() {
  return (
    <header className="border-border bg-background/85 sticky top-0 z-40 border-b backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-5 sm:px-8">
        <Link
          href="/"
          className="text-foreground font-mono text-sm font-semibold tracking-tight"
          aria-label="AgentBlog home"
        >
          agentblog
          <span className="text-muted-foreground">.dev</span>
        </Link>

        <nav aria-label="Main" className="hidden flex-1 items-center gap-6 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-muted-foreground hover:text-foreground text-sm transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1 md:ml-0">
          <a
            href="https://github.com/agentblog/agentblog"
            className="text-muted-foreground hover:bg-accent hover:text-foreground rounded-md p-2 transition-colors"
            aria-label="AgentBlog on GitHub"
          >
            <Github className="size-4" />
          </a>
          <ThemeToggle />

          <details className="relative md:hidden">
            <summary
              className="text-muted-foreground hover:bg-accent hover:text-foreground flex cursor-pointer list-none items-center rounded-md p-2 transition-colors"
              aria-label="Open navigation"
            >
              <Menu className="size-4" />
            </summary>
            <nav
              aria-label="Mobile"
              className="border-border bg-popover absolute right-0 z-50 mt-2 w-48 rounded-lg border p-1.5 shadow-lg"
            >
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-popover-foreground hover:bg-accent block rounded-md px-3 py-2 text-sm transition-colors"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </details>
        </div>
      </div>
    </header>
  )
}
