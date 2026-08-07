/**
 * Site footer.
 *
 * Carries the licensing split, because three licenses scoped by directory is the
 * kind of thing people need to find without reading the repository. It also
 * carries the editorial policy link, which is the E-E-A-T surface the blog block
 * adds to a consumer's footer for the same reason.
 *
 * Column headings are the label role and links are the copy role, one step down
 * in size and one step down in contrast. That pair is the whole hierarchy here;
 * the footer needs no third level.
 */
import Link from 'next/link'

/** The documentation is its own site. Those links are absolute for that reason. */
const DOCS = 'https://docs.agentblog.dev'

const COLUMNS = [
  {
    heading: 'Product',
    links: [
      { href: `${DOCS}/installation`, label: 'Installation' },
      { href: `${DOCS}/reference/configuration`, label: 'Configuration' },
      { href: '/registry', label: 'Registry items' },
      { href: `${DOCS}/project/roadmap`, label: 'Roadmap and non-goals' },
    ],
  },
  {
    heading: 'Learn',
    links: [
      { href: `${DOCS}/concepts/geo-playbook`, label: 'The GEO playbook' },
      { href: `${DOCS}/guides/pre-publish-checklist`, label: 'SEO and GEO checklist' },
      {
        href: `${DOCS}/troubleshooting/cdn-blocking-crawlers`,
        label: 'When your CDN blocks crawlers',
      },
      { href: `${DOCS}/concepts/why-no-llms-txt`, label: 'Why we do not ship llms.txt' },
    ],
  },
  {
    heading: 'This site',
    links: [
      { href: '/blog', label: 'Blog' },
      { href: '/editorial-policy', label: 'Editorial policy' },
      { href: '/feed.xml', label: 'RSS' },
      { href: `${DOCS}/llms.txt`, label: 'llms.txt' },
    ],
  },
] as const

export function SiteFooter() {
  return (
    <footer className="border-border border-t">
      <div className="mx-auto w-full max-w-5xl px-6 py-16">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="max-w-xs">
            <p className="text-foreground text-mono-13 font-mono">agentblog.dev</p>
            <p className="text-muted-foreground text-copy-13 mt-3">
              An SEO and GEO complete blog for Next.js 16, installed into your app as files you own.
            </p>
          </div>

          {COLUMNS.map((column) => (
            <div key={column.heading}>
              <h2 className="text-foreground text-label-13">{column.heading}</h2>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-muted-foreground hover:text-foreground text-copy-13 transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-border text-muted-foreground text-copy-13 mt-14 flex flex-col gap-3 border-t pt-8 sm:flex-row sm:items-center sm:justify-between">
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
