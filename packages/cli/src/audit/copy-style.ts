/**
 * The house copy style check.
 *
 * The rule above all others: no em dashes. The reason is commercial rather than
 * aesthetic. The em dash has become the most recognizable tell of machine
 * written prose, and readers discount text that leans on it. For a product whose
 * deliverable is AI assisted writing that gets cited, shipping copy that reads
 * as AI generated undermines the thing being sold. The seed posts are the format
 * specification, so a tell in them is inherited by every post written from that
 * template.
 *
 * The em dash pattern is written as the escape sequence \u2014 rather than as
 * the character itself, so that this file passes the very check it implements
 * and the repository wide copy style gate does not flag its own detector.
 *
 * A style guide nobody can run is a style guide nobody follows, which is why
 * this lives here rather than in a contributing document.
 *
 * @see https://agentblog.dev/docs/agent-layer
 */

export interface CopyIssue {
  readonly line: number
  /** Short label, used when several issues are summarized on one line. */
  readonly what: string
  readonly excerpt: string
}

interface Rule {
  readonly pattern: RegExp
  readonly what: string
}

const RULES: readonly Rule[] = [
  { pattern: /\u2014/, what: 'em dash' },
  // A double hyphen used as a dash, which is the same tell wearing a hat. A
  // command line flag (`--force`) is not, hence the surrounding spaces.
  { pattern: /\s--\s/, what: 'double hyphen used as a dash' },
  { pattern: /\bdelv(?:e|ing|ed)\b/i, what: '"delve"' },
  { pattern: /\bleverag(?:e|ing|ed)\b/i, what: '"leverage"' },
  { pattern: /\brobust\b/i, what: '"robust"' },
  { pattern: /\bseamless(?:ly)?\b/i, what: '"seamless"' },
  { pattern: /\blandscape\b/i, what: '"landscape"' },
  { pattern: /\btapestry\b/i, what: '"tapestry"' },
  {
    pattern: /in today'?s (?:fast[- ]paced|ever[- ]changing|digital) world/i,
    what: 'stock opener',
  },
  {
    pattern: /it(?:'|’)?s not just [^,.]{1,40}, it(?:'|’)?s/i,
    what: '"it is not just X, it is Y"',
  },
]

/** A paragraph that opens with a question the next sentence answers. */
const RHETORICAL_OPENER = /^(?:What|Why|How|Who|When|Where|Ever wondered)\b[^?\n]{5,120}\?\s*$/

/**
 * Every copy style problem in `source`, with line numbers.
 *
 * Fenced code blocks are skipped: a code sample is not prose, and flagging a
 * `--flag` inside a shell snippet would make the check unusable on exactly the
 * technical posts this product is for.
 */
export function findCopyStyleIssues(source: string): CopyIssue[] {
  const issues: CopyIssue[] = []
  const lines = source.split(/\r?\n/)
  let inFence = false

  lines.forEach((line, index) => {
    if (/^\s*(?:```|~~~)/.test(line)) {
      inFence = !inFence
      return
    }
    if (inFence) return

    for (const rule of RULES) {
      if (rule.pattern.test(line)) {
        issues.push({ line: index + 1, what: rule.what, excerpt: excerpt(line) })
      }
    }

    const previous = index === 0 ? '' : lines[index - 1]!
    if (previous.trim() === '' && RHETORICAL_OPENER.test(line.trim())) {
      issues.push({ line: index + 1, what: 'rhetorical question opener', excerpt: excerpt(line) })
    }
  })

  return issues
}

function excerpt(line: string): string {
  const trimmed = line.trim()
  return trimmed.length > 90 ? `${trimmed.slice(0, 87)}...` : trimmed
}
