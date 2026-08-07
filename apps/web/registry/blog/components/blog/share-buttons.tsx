'use client'

import { useCallback, useState } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { CheckIcon, LinkIcon, MailIcon, ShareIcon } from './icons'

/**
 * Share controls for a post.
 *
 * WHERE IT RENDERS
 * `app/blog/[slug]/page.tsx`, at the foot of the article body (after the FAQ
 * and the sources list) and immediately before the author bio.
 *
 * ⚠️ THIS IS THE SECOND AND LAST CLIENT COMPONENT IN THE BLOCK, AND IT EARNS THE
 * BOUNDARY THE SAME WAY THE TABLE OF CONTENTS DOES.
 * Every share target is a real `<a href>` that works with JavaScript disabled:
 * the X and LinkedIn intents are ordinary URLs and the email option is a
 * `mailto:`. The only thing the client boundary buys is the copy-link button,
 * which needs `navigator.clipboard`, and its "Copied" confirmation. Turn the
 * JavaScript off and the component still shares.
 * @see https://docs.agentblog.dev/reference/files
 *
 * WHY NO BRAND ICONS
 * Lucide deprecated its brand glyphs and may remove them in a minor release,
 * which would break a consumer's build on an unrelated upgrade. Each control
 * therefore carries a visible text label instead, which also means none of them
 * is an icon-only control without an accessible name. The icons that remain are
 * neutral and `aria-hidden`.
 * @see `icons.tsx`
 *
 * WHY THE URL IS A PROP
 * The canonical, absolute post URL is composed on the server by the helpers in
 * `@/lib/config` and passed down. Reading `window.location.href` in an effect
 * would produce a different string in preview deployments, behind a proxy, and
 * on `localhost`, and would leave the anchors empty in the server HTML.
 *
 * WHAT BREAKS IF YOU CHANGE IT
 * - Turning the anchors into `onClick` handlers that call `window.open` makes
 *   every share target vanish from the markup and blocks middle-click and
 *   open-in-new-tab.
 * - Dropping `rel="noopener noreferrer"` on the `target="_blank"` links hands
 *   the opened page a reference to this one.
 */
export interface ShareButtonsProps {
  /** Absolute canonical URL of the post. Build it with `postUrl` from `@/lib/config`. */
  readonly url: string
  /** Post title, used as the pre-filled share text. */
  readonly title: string
  /** Accessible name for the group. */
  readonly label?: string | undefined
  readonly className?: string | undefined
}

export function ShareButtons({ url, title, label, className }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false)

  const copy = useCallback(() => {
    // Older browsers and any non-secure context have no clipboard API. Failing
    // quietly is correct: the share links beside this button still work.
    if (typeof navigator === 'undefined' || navigator.clipboard === undefined) return

    void navigator.clipboard.writeText(url).then(
      () => {
        setCopied(true)
        window.setTimeout(() => setCopied(false), 2000)
      },
      () => setCopied(false),
    )
  }, [url])

  const encodedUrl = encodeURIComponent(url)
  const encodedTitle = encodeURIComponent(title)

  const targets = [
    { name: 'X', href: `https://x.com/intent/post?url=${encodedUrl}&text=${encodedTitle}` },
    {
      name: 'LinkedIn',
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    },
  ] as const

  return (
    <div
      role="group"
      aria-label={label ?? 'Share this post'}
      className={cn('not-prose flex flex-wrap items-center gap-2', className)}
    >
      <span className="text-muted-foreground inline-flex items-center gap-1.5 text-sm">
        <ShareIcon className="size-4" aria-hidden="true" />
        Share
      </span>

      {targets.map((target) => (
        <Button key={target.name} asChild variant="outline" size="sm">
          <a href={target.href} target="_blank" rel="noopener noreferrer">
            {target.name}
          </a>
        </Button>
      ))}

      <Button asChild variant="outline" size="sm">
        <a href={`mailto:?subject=${encodedTitle}&body=${encodedUrl}`}>
          <MailIcon className="size-4" aria-hidden="true" />
          Email
        </a>
      </Button>

      <Button type="button" variant="outline" size="sm" onClick={copy}>
        {copied ? (
          <CheckIcon className="size-4" aria-hidden="true" />
        ) : (
          <LinkIcon className="size-4" aria-hidden="true" />
        )}
        {copied ? 'Copied' : 'Copy link'}
      </Button>

      {/* The confirmation is announced rather than only shown, so a screen
          reader user gets the same feedback as a sighted one. */}
      <span aria-live="polite" className="sr-only">
        {copied ? 'Link copied to clipboard' : ''}
      </span>
    </div>
  )
}
