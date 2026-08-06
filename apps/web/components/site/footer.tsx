/**
 * Site footer.
 *
 * Carries the licensing split, because three licenses scoped by directory is the
 * kind of thing people need to find without reading the repository. It also
 * carries the editorial policy link, which is the E-E-A-T surface the blog block
 * adds to a consumer's footer for the same reason.
 */
import Link from 'next/link'

const COLUMNS = [
  {
    heading: 'Product',
    links: [
      { href: '/docs/installation', label: 'Installation' },
      { href: '/docs/configuration', label: 'Configuration' },
      { href: '/registry', label: 'Registry items' },
      { href: '/docs/roadmap', label: 'Roadmap and non-goals' },
    ],
  },
  {
    heading: 'Learn',
    links: [
      { href: '/docs/geo-playbook', label: 'The GEO playbook' },
      { href: '/docs/seo-geo-checklist', label: 'SEO and GEO checklist' },
      { href: '/docs/troubleshooting-cdn', label: 'When your CDN blocks crawlers' },
      { href: '/docs/no-llms-txt', label: 'Why we do not ship llms.txt' },
    ],
  },
  {
    heading: 'This site',
    links: [
      { href: '/blog', label: 'Blog' },
      { href: '/editorial-policy', label: 'Editorial policy' },
      { href: '/feed.xml', label: 'RSS' },
      { href: '/docs/llms.txt', label: 'llms.txt' },
    ],
  },
] as const

export function SiteFooter() {
  return (
    <footer className="border-border border-t">
      <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="max-w-xs">
            <p className="text-foreground font-mono text-sm font-semibold">agentblog.dev</p>
            <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
              An SEO and GEO complete blog for Next.js 16, installed into your app as files you own.
            </p>
          </div>

          {COLUMNS.map((column) => (
            <div key={column.heading}>
              <h2 className="text-foreground text-xs font-semibold tracking-wider uppercase">
                {column.heading}
              </h2>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-border text-muted-foreground mt-12 flex flex-col gap-4 border-t pt-8 text-xs sm:flex-row sm:items-center sm:justify-between">
          <p>
            Code MIT. Documentation prose{' '}
            <a
              href="https://creativecommons.org/licenses/by/4.0/"
              className="hover:text-foreground underline underline-offset-2"
            >
              CC BY 4.0
            </a>
            . Seed posts CC0.
          </p>
          <p>
            <a
              href="https://github.com/goldk3y/agentblog"
              className="hover:text-foreground underline underline-offset-2"
            >
              github.com/goldk3y/agentblog
            </a>
          </p>
        </div>
      </div>
    </footer>
  )
}
