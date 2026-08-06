/**
 * The AGENTS.md block.
 *
 * ===========================================================================
 * THIS FILE IS CO-OWNED WITH NEXT.JS
 * ===========================================================================
 * Next.js 16.3 writes `AGENTS.md` itself on `next dev`, managing the content
 * between `<!-- BEGIN:nextjs-agent-rules -->` and `<!-- END:nextjs-agent-rules -->`
 * and preserving everything outside those markers. Two rules follow, and both
 * are enforced here rather than trusted to a future contributor:
 *
 * 1. Our block goes **strictly after** the END marker. Never inside, never
 *    across, never between BEGIN and END. If a previous version of this tool (or
 *    a hand edit) left our block in the wrong place, `place` moves it rather
 *    than editing it where it sits.
 *
 * 2. **We never write `CLAUDE.md`.** Next generates it containing `@AGENTS.md`,
 *    which already imports our block. Writing there would put our rules into the
 *    agent's context twice, and `next dev` may rewrite the file underneath us.
 *    A hand-authored `CLAUDE.md` is the user's, and we leave it alone.
 *
 * @see https://agentblog.dev/docs/agent-layer
 */
import {
  AGENTBLOG_BLOCK_BEGIN,
  AGENTBLOG_BLOCK_END,
  NEXT_AGENT_RULES_BEGIN,
  NEXT_AGENT_RULES_END,
} from '../constants.ts'

export interface AgentsMdResult {
  readonly source: string
  readonly changes: readonly string[]
  readonly declined: readonly string[]
}

/** Where our block currently sits, if anywhere. */
export interface BlockPosition {
  readonly present: boolean
  readonly start: number
  readonly end: number
  /** `true` when the block overlaps the Next.js managed region. */
  readonly insideNextBlock: boolean
}

export function locateBlock(source: string): BlockPosition {
  const start = source.indexOf(AGENTBLOG_BLOCK_BEGIN)
  const endMarker = source.indexOf(AGENTBLOG_BLOCK_END)
  if (start === -1 || endMarker === -1 || endMarker < start) {
    return { present: false, start: -1, end: -1, insideNextBlock: false }
  }
  const end = endMarker + AGENTBLOG_BLOCK_END.length

  const nextBegin = source.indexOf(NEXT_AGENT_RULES_BEGIN)
  const nextEnd = source.indexOf(NEXT_AGENT_RULES_END)
  const insideNextBlock =
    nextBegin !== -1 && nextEnd !== -1 && start < nextEnd + NEXT_AGENT_RULES_END.length

  return { present: true, start, end, insideNextBlock }
}

/**
 * Put `block` in the file, replacing any previous copy of it.
 *
 * Idempotent: running this over its own output returns the same string, which is
 * what makes a second `init` a byte for byte no-op.
 */
export function placeBlock(existing: string | null, block: string): AgentsMdResult {
  const changes: string[] = []
  const declined: string[] = []

  if (existing === null) {
    return {
      source: `${block}`,
      changes: ['AGENTS.md: created with the AgentBlog block'],
      declined,
    }
  }

  const nextBegin = existing.indexOf(NEXT_AGENT_RULES_BEGIN)
  const nextEnd = existing.indexOf(NEXT_AGENT_RULES_END)
  if (nextBegin !== -1 && nextEnd === -1) {
    return {
      source: existing,
      changes,
      declined: [
        'AGENTS.md: found a Next.js BEGIN marker with no matching END marker. Left the file alone rather than risk writing inside the region Next.js rewrites on every `next dev`.',
      ],
    }
  }

  const position = locateBlock(existing)

  // Strip any previous copy of our block, wherever it was.
  let body = existing
  if (position.present) {
    body = `${existing.slice(0, position.start)}${existing.slice(position.end)}`.replace(
      /\n{3,}/g,
      '\n\n',
    )
    if (position.insideNextBlock) {
      changes.push(
        'AGENTS.md: moved the AgentBlog block out of the Next.js managed region and appended it after the END marker',
      )
    }
  }

  /*
   * Normalise the surviving text before reassembling, rather than trying to work
   * out the right separator for whatever the strip left behind.
   *
   * The subtle case is a file that contains nothing but our block. Removing it
   * leaves a lone newline, which is neither empty nor a clean paragraph break, so
   * a separator computed from its ending reintroduces blank lines on every run.
   * That is not cosmetic: `init` claims to be a byte for byte no-op on a second
   * run, and CI asserts it with `git diff --exit-code`. Trimming both ends and
   * joining with exactly one blank line makes the output a function of the
   * content alone, which is what idempotent means here.
   */
  const trimmedBody = body.replace(/^\s+/, '').replace(/\s+$/, '')
  const source = trimmedBody.length === 0 ? block : `${trimmedBody}\n\n${block}`

  if (source === existing) return { source, changes, declined }
  if (changes.length === 0) {
    changes.push(
      position.present
        ? 'AGENTS.md: updated the AgentBlog block'
        : 'AGENTS.md: appended the AgentBlog block after the Next.js managed region',
    )
  }
  return { source, changes, declined }
}

/**
 * Everything in the file except the region Next.js manages.
 *
 * Used before any check that judges the prose in AGENTS.md. Next.js writes that
 * region itself and rewrites it on every `next dev`, so holding the user
 * responsible for its wording would report a violation they cannot fix.
 */
export function stripNextManagedRegion(source: string): string {
  const begin = source.indexOf(NEXT_AGENT_RULES_BEGIN)
  const end = source.indexOf(NEXT_AGENT_RULES_END)
  if (begin === -1 || end === -1 || end < begin) return source
  return `${source.slice(0, begin)}${source.slice(end + NEXT_AGENT_RULES_END.length)}`
}

/** Remove our block and nothing else. Used by `uninstall`. */
export function removeBlock(existing: string): AgentsMdResult {
  const position = locateBlock(existing)
  if (!position.present) {
    return { source: existing, changes: [], declined: ['AGENTS.md: no AgentBlog block found'] }
  }
  const source = `${existing.slice(0, position.start)}${existing.slice(position.end)}`
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\n+/, '')
  return { source, changes: ['AGENTS.md: removed the AgentBlog block'], declined: [] }
}
