/**
 * The bordered panel.
 *
 * One shape, used by every framed region on the site: the crawler response
 * comparison, the install manifest, and the skills grid. A single component
 * means the border weight, the radius, and the header bar are decided once
 * rather than re-approximated at each call site, which is the difference
 * between three panels and one system.
 *
 * The header carries a monospace label naming what the reader is looking at,
 * usually a command or a path. It is a label, not a caption: say what the thing
 * is, and put anything that needs a sentence underneath the panel instead.
 */
import { cn } from '@/lib/utils'

interface PanelProps {
  /** Monospace label in the header bar. A command, a path, or a filename. */
  readonly label: string
  /** Optional dot before the label. Used only where the state carries meaning. */
  readonly tone?: 'neutral' | 'ok' | 'bad'
  readonly children: React.ReactNode
  /** Pushed to the right of the header bar. A count, or a second short fact. */
  readonly trailing?: React.ReactNode
  readonly className?: string
  /** Applied to the body, so callers can set their own padding or grid. */
  readonly bodyClassName?: string
}

export function Panel({
  label,
  tone = 'neutral',
  children,
  trailing,
  className,
  bodyClassName,
}: PanelProps) {
  return (
    <div
      className={cn(
        'border-border bg-card flex min-w-0 flex-col overflow-hidden rounded-xl border',
        className,
      )}
    >
      <div className="border-border bg-muted flex h-10 shrink-0 items-center gap-2 border-b px-4">
        {tone !== 'neutral' && (
          <span
            aria-hidden="true"
            className={cn(
              'size-1.5 shrink-0 rounded-full',
              tone === 'ok' && 'bg-signal-ok',
              tone === 'bad' && 'bg-signal-bad',
            )}
          />
        )}
        <code className="text-muted-foreground text-mono-12 min-w-0 truncate font-mono">
          {label}
        </code>
        {trailing !== undefined && (
          <span className="text-muted-foreground text-mono-12 ml-auto shrink-0 font-mono">
            {trailing}
          </span>
        )}
      </div>
      <div className={cn('min-w-0 flex-1', bodyClassName)}>{children}</div>
    </div>
  )
}
