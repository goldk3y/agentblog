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
        <span className="flex items-center gap-2 text-base">
          {/*
            A plain `img` rather than `next/image`: the optimizer passes SVG
            through untouched, so the component would add a preload tag and a
            wrapper for no resizing work.

            The source SVG bakes its drop shadow into the viewBox, so the
            48-unit rounded square sits at the top of a 54-unit canvas, leaving
            6 units of slack below it and none above. Shifting down by half that
            slack optically centres the square against the wordmark. The
            translate is a percentage so it stays correct if the box is resized:
            3 of 54 units is 5.5% of the height.

            The same mark and the same nudge live in the product site header, in
            `apps/web/components/site/header.tsx`.
          */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logos/agentblog-icon-logo.svg"
            alt=""
            width={28}
            height={28}
            className="size-7 translate-y-[5.5%]"
          />
          {/*
            The two words are one text run separated by an ordinary space, not
            two flex children: a flex gap here would set them as far apart as
            the icon is from the wordmark, and they read as a phrase.
          */}
          <span>
            <span className="font-medium">AgentBlog</span>{' '}
            <span className="text-fd-muted-foreground font-normal">Docs</span>
          </span>
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
