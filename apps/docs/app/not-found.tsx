/**
 * 404.
 *
 * Rendered inside the home layout rather than the docs layout, so a mistyped
 * URL still gets the navbar and search without pretending it is a page in the
 * tree. The three links are the pages people are usually looking for.
 */
import Link from 'next/link'

import { HomeLayout } from 'fumadocs-ui/layouts/home'

import { baseOptions } from '@/lib/layout.shared'

const SUGGESTIONS = [
  { href: '/', label: 'Start here', hint: 'What AgentBlog is and who it is for' },
  { href: '/quickstart', label: 'Quickstart', hint: 'Install the blog in about five minutes' },
  { href: '/reference/cli', label: 'CLI reference', hint: 'Every command and every flag' },
] as const

export default function NotFound() {
  return (
    <HomeLayout {...baseOptions()}>
      <main className="mx-auto w-full max-w-2xl px-6 py-24">
        <p className="text-fd-muted-foreground font-mono text-sm">404</p>
        <h1 className="mt-3 text-3xl font-medium">This page does not exist</h1>
        <p className="text-fd-muted-foreground mt-3">
          The documentation moved to its own site recently. If you followed a link to
          agentblog.dev/docs, the page you want is here under a shorter path.
        </p>

        <ul className="mt-8 space-y-3">
          {SUGGESTIONS.map((item) => (
            <li key={item.href}>
              <Link href={item.href} className="font-medium underline underline-offset-4">
                {item.label}
              </Link>
              <span className="text-fd-muted-foreground"> {item.hint}</span>
            </li>
          ))}
        </ul>
      </main>
    </HomeLayout>
  )
}
