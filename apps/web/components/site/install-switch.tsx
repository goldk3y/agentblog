/**
 * The hero install command, with a switch between the two entry points.
 *
 * There genuinely are two, and they are for two different readers. A person runs
 * the CLI. A coding agent gets the plugin, which carries the same six skills
 * without touching the Next.js app at all. Presenting them as one command with a
 * footnote would hide the second from the audience it was built for.
 *
 * Both panels are in the DOM at all times and the inactive one is `hidden`,
 * rather than being unmounted. Two reasons: the command text is in the HTML
 * either way, and swapping mounted subtrees would re-run the copy button's state
 * and drop a "copied" confirmation mid-toast.
 */
'use client'

import { useId, useState } from 'react'

import { CopyCommand } from '@/components/site/copy-command'
import { cn } from '@/lib/utils'

const OPTIONS = [
  {
    id: 'you',
    label: 'For you',
    command: 'npx agentblog@latest init',
    note: 'Installs the blog into your Next.js app, then verifies it.',
  },
  {
    id: 'agent',
    label: 'For your agent',
    command: '/plugin marketplace add goldk3y/agentblog',
    note: 'Installs the six skills into Claude Code, with no app changes.',
  },
] as const

export function InstallSwitch() {
  const [active, setActive] = useState<(typeof OPTIONS)[number]['id']>('you')
  const base = useId()

  return (
    <div className="flex flex-col items-center">
      <div role="tablist" aria-label="Install method" className="flex items-center gap-1">
        {OPTIONS.map((option) => (
          <button
            key={option.id}
            id={`${base}-tab-${option.id}`}
            type="button"
            role="tab"
            aria-selected={option.id === active}
            aria-controls={`${base}-panel-${option.id}`}
            onClick={() => {
              setActive(option.id)
            }}
            className={cn(
              /* `font-semibold` after `text-label-13` on purpose: the scale step
                 carries weight 500, and this lifts both tabs one step to 600. */
              'text-label-13 rounded-full px-3.5 py-1.5 font-semibold transition-colors',
              option.id === active
                ? 'bg-brand-blue/10 text-brand-blue'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {OPTIONS.map((option) => (
        <div
          key={option.id}
          id={`${base}-panel-${option.id}`}
          role="tabpanel"
          aria-labelledby={`${base}-tab-${option.id}`}
          hidden={option.id !== active}
          className="w-full max-w-md"
        >
          <CopyCommand command={option.command} surface="hero" size="lg" accent className="mt-4" />
          <p className="text-muted-foreground text-copy-13 mt-3 text-center">{option.note}</p>
        </div>
      ))}
    </div>
  )
}
