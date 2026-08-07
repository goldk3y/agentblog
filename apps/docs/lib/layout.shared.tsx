/**
 * Options every layout on this site shares: the wordmark, the navbar links, and
 * the GitHub icon.
 *
 * Kept in one function so the docs layout and the 404 page cannot drift into
 * two different headers.
 */
import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared'

import { GITHUB_URL, PRODUCT_URL } from '@/lib/site'

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <span className="font-mono text-[13px]">
          agentblog<span className="text-fd-muted-foreground">.dev/docs</span>
        </span>
      ),
      url: '/',
    },
    githubUrl: GITHUB_URL,
    links: [
      { text: 'Live demo', url: `${PRODUCT_URL}/blog`, external: true },
      { text: 'Registry', url: `${PRODUCT_URL}/registry`, external: true },
      { text: 'agentblog.dev', url: PRODUCT_URL, external: true },
    ],
  }
}
