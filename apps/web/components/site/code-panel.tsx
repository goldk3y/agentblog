/**
 * A terminal-styled code panel with per-line emphasis.
 *
 * Deliberately not a syntax highlighter. The two panels on the landing page are
 * making one point each, and the point is carried by which lines are present,
 * not by which token is a keyword. A per-line `tone` lets the interesting lines
 * be legible and the boilerplate recede, which a general purpose highlighter
 * actively works against.
 *
 * Long lines scroll inside the panel rather than widening the page.
 */
import { cn } from '@/lib/utils'

export type LineTone = 'default' | 'muted' | 'good' | 'bad'

export interface CodeLine {
  readonly text: string
  readonly tone?: LineTone
}

const TONE_CLASS: Record<LineTone, string> = {
  default: 'text-foreground',
  muted: 'text-muted-foreground',
  good: 'text-signal-ok',
  bad: 'text-signal-bad',
}

interface CodePanelProps {
  /** Rendered in the panel chrome. Usually the command that produced the output. */
  readonly command: string
  readonly lines: readonly CodeLine[]
  /** Shown under the panel. Say what the reader is looking at. */
  readonly caption?: string
  readonly accent?: 'good' | 'bad' | 'none'
  readonly className?: string
}

export function CodePanel({ command, lines, caption, accent = 'none', className }: CodePanelProps) {
  return (
    <figure className={cn('flex min-w-0 flex-col', className)}>
      <div className="border-border bg-card flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border">
        <div className="border-border bg-muted/60 flex items-center gap-2 border-b px-4 py-2.5">
          <span
            aria-hidden="true"
            className={cn(
              'size-2 shrink-0 rounded-full',
              accent === 'good' && 'bg-signal-ok',
              accent === 'bad' && 'bg-signal-bad',
              accent === 'none' && 'bg-muted-foreground/40',
            )}
          />
          <code className="text-muted-foreground min-w-0 truncate font-mono text-xs">
            {command}
          </code>
        </div>
        <pre className="min-w-0 flex-1 overflow-x-auto p-4 font-mono text-[0.75rem] leading-relaxed">
          <code>
            {lines.map((line, index) => (
              <span
                // Output lines have no stable identity and the array is static.
                key={index}
                className={cn('block whitespace-pre', TONE_CLASS[line.tone ?? 'default'])}
              >
                {line.text === '' ? ' ' : line.text}
              </span>
            ))}
          </code>
        </pre>
      </div>
      {caption !== undefined && (
        <figcaption className="text-muted-foreground mt-3 text-sm leading-relaxed">
          {caption}
        </figcaption>
      )}
    </figure>
  )
}
