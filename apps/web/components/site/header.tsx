/**
 * Site header.
 *
 * A Server Component apart from the theme toggle. The mobile menu is a
 * `<details>` element rather than a client component holding open state: it
 * works before hydration, it works with JavaScript off, and it is one of the two
 * places on this site where the disclosure pattern the blog block uses for FAQs
 * and the table of contents is worth demonstrating.
 *
 * The container measure matches the one every page section uses, so the wordmark
 * sits on the same left edge as the first word of every heading below it.
 */
import Link from 'next/link'

import { Github, Menu } from '@/components/site/icons'
import { ThemeToggle } from '@/components/site/theme-toggle'

/**
 * The documentation is its own site, so those two entries are absolute URLs.
 * `next/link` renders a plain anchor for an external href, which is what we
 * want: there is nothing to prefetch across an origin.
 */
const NAV = [
  { href: 'https://docs.agentblog.dev', label: 'Docs' },
  { href: 'https://docs.agentblog.dev/concepts/geo-playbook', label: 'GEO playbook' },
  { href: '/registry', label: 'Registry' },
  { href: '/blog', label: 'Blog' },
] as const

export function SiteHeader() {
  return (
    <header className="border-border bg-background/80 sticky top-0 z-40 border-b backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-8 px-6">
        <Link
          href="/"
          className="text-foreground text-label-16 flex items-center gap-2"
          aria-label="AgentBlog home"
        >
          {/*
            A plain `img` rather than `next/image`: the optimizer passes SVG
            through untouched, so the component would add a preload tag and a
            wrapper for no resizing work.

            The source SVG bakes its drop shadow into the viewBox, so the
            48-unit rounded square sits at the top of a 54-unit canvas, leaving
            6 units of slack below it and none above. Shifting down by half that
            slack optically centres the square against the wordmark; without it
            the mark reads high. The translate is a percentage so it stays
            correct if the box is resized: 3 of 54 units is 5.5% of the height.
          */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logos/agentblog-icon-logo.svg"
            alt=""
            width={32}
            height={32}
            className="size-8 translate-y-[5.5%]"
          />
          AgentBlog
        </Link>

        <nav aria-label="Main" className="hidden flex-1 items-center gap-6 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-muted-foreground hover:text-foreground text-copy-14 transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-0.5 md:ml-0">
          <a
            href="https://github.com/goldk3y/agentblog"
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
                  className="text-popover-foreground hover:bg-accent text-copy-14 block rounded-md px-3 py-2 transition-colors"
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
