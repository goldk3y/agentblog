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
  readonly className?: string
}

export function CopyCommand({ command, size = 'default', className }: CopyCommandProps) {
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
        'group border-border bg-card flex items-center gap-3 rounded-lg border font-mono',
        size === 'lg' ? 'px-4 py-3 text-sm sm:text-base' : 'px-3 py-2 text-xs sm:text-sm',
        className,
      )}
    >
      <span aria-hidden="true" className="text-muted-foreground shrink-0 select-none">
        $
      </span>
      <code className="text-foreground min-w-0 flex-1 overflow-x-auto whitespace-nowrap">
        {command}
      </code>
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy the command ${command}`}
        className="text-muted-foreground hover:bg-accent hover:text-foreground shrink-0 rounded-md p-1.5 transition-colors"
      >
        {copied ? <Check className="text-signal-ok size-4" /> : <Copy className="size-4" />}
      </button>
      <span aria-live="polite" className="sr-only">
        {copied ? 'Command copied to clipboard' : ''}
      </span>
    </div>
  )
}
