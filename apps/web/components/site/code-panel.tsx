/**
 * A terminal-styled code panel with per-line emphasis.
 *
 * Deliberately not a syntax highlighter. The two panels on the landing page are
 * making one point each, and the point is carried by which lines are present,
 * not by which token is a keyword. A per-line `tone` lets the interesting lines
 * be legible and the boilerplate recede, which a general purpose highlighter
 * actively works against.
 *
 * The two signal colours are the only chromatic values on the landing page. They
 * are legitimate under the Geist rule that colour must add meaning, because the
 * two panels also differ in their content and each carries a written caption, so
 * nothing here is conveyed by hue alone.
 *
 * Long lines scroll inside the panel rather than widening the page.
 */
import { Panel } from '@/components/site/panel'
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
  /** Shown under the panel. One sentence saying what the reader is looking at. */
  readonly caption?: string
  readonly accent?: 'good' | 'bad' | 'none'
  readonly className?: string
}

export function CodePanel({ command, lines, caption, accent = 'none', className }: CodePanelProps) {
  return (
    <figure className={cn('flex min-w-0 flex-col', className)}>
      <Panel
        label={command}
        tone={accent === 'good' ? 'ok' : accent === 'bad' ? 'bad' : 'neutral'}
        className="flex-1"
      >
        <pre className="text-mono-12 h-full min-w-0 overflow-x-auto p-4 font-mono">
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
      </Panel>
      {caption !== undefined && (
        <figcaption className="text-muted-foreground text-copy-14 mt-4">{caption}</figcaption>
      )}
    </figure>
  )
}
