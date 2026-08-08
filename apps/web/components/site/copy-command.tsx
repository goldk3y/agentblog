/**
 * A shell command with a copy button.
 *
 * The command text is real DOM text, not a `data-` attribute read by script, so
 * it is selectable, it is in the raw HTML, and it survives with JavaScript
 * disabled. Only the copy affordance needs the client.
 *
 * `navigator.clipboard` is unavailable on insecure origins and can be blocked by
 * permissions policy, so a failed write leaves the button in its resting state
 * rather than lying about success.
 */
'use client'

import { useCallback, useRef, useState } from 'react'

import { Check, Copy } from '@/components/site/icons'
import { cn } from '@/lib/utils'

interface CopyCommandProps {
  readonly command: string
  /** Larger presentation for the hero. Everything else uses the default. */
  readonly size?: 'default' | 'lg'
  /** Brand-blue edge and copy glyph. The copied state stays green either way. */
  readonly accent?: boolean
  readonly className?: string
}

export function CopyCommand({
  command,
  size = 'default',
  accent = false,
  className,
}: CopyCommandProps) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const copy = useCallback(() => {
    void navigator.clipboard
      .writeText(command)
      .then(() => {
        setCopied(true)
        if (timer.current !== null) clearTimeout(timer.current)
        timer.current = setTimeout(() => {
          setCopied(false)
        }, 1800)
      })
      .catch(() => {
        // Clipboard denied. The text is selectable, so there is a manual path.
      })
  }, [command])

  return (
    <div
      className={cn(
        'group bg-card flex items-center gap-3 rounded-lg border font-mono',
        accent ? 'border-brand-blue' : 'border-border',
        size === 'lg' ? 'text-mono-14 h-12 pr-2 pl-4' : 'text-mono-13 h-10 pr-1.5 pl-3.5',
        className,
      )}
    >
      <span aria-hidden="true" className="text-muted-foreground shrink-0 select-none">
        $
      </span>
      {/*
        `text-left` because this sits inside a centred hero. Without it the
        command inherits `text-align: center` and floats away from the `$`,
        which reads as a gap rather than as a prompt.
      */}
      <code className="text-foreground min-w-0 flex-1 overflow-x-auto text-left whitespace-nowrap">
        {command}
      </code>
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy the command ${command}`}
        className={cn(
          'shrink-0 rounded-md p-2 transition-colors',
          accent
            ? 'bg-brand-blue text-brand-blue-foreground hover:bg-brand-blue/90'
            : 'text-muted-foreground hover:bg-accent hover:text-foreground',
        )}
      >
        {copied ? (
          /*
            On the filled button the green sits at about 1.8:1 against the blue, so
            the glyph inherits white and the swap from copy to check, plus the live
            region below, carries the confirmation on its own.
          */
          <Check className={cn('size-3.5', accent ? '' : 'text-signal-ok')} />
        ) : (
          <Copy className="size-3.5" />
        )}
      </button>
      <span aria-live="polite" className="sr-only">
        {copied ? 'Command copied to clipboard' : ''}
      </span>
    </div>
  )
}
