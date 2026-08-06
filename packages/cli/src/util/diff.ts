/**
 * A small unified diff, so `--dry-run` can show exactly what a patch will do.
 *
 * This is deliberately not a dependency. The inputs are config files, measured
 * in hundreds of lines, so a quadratic longest-common-subsequence table is both
 * fast enough and easier to audit than pulling in a diff library for a tool
 * whose entire pitch is that it edits your files carefully.
 *
 * Files past `MAX_LINES` fall back to a summary rather than a line diff, because
 * a quadratic table over a generated file is the one input that would make this
 * slow.
 */

const MAX_LINES = 4000
const CONTEXT = 3

type Op = { readonly kind: 'equal' | 'add' | 'remove'; readonly text: string }

function lcsOps(a: readonly string[], b: readonly string[]): Op[] {
  const rows = a.length
  const cols = b.length
  // table[i][j] is the length of the longest common subsequence of a[i..] and b[j..]
  const table: number[][] = Array.from({ length: rows + 1 }, () =>
    new Array<number>(cols + 1).fill(0),
  )

  for (let i = rows - 1; i >= 0; i -= 1) {
    for (let j = cols - 1; j >= 0; j -= 1) {
      const row = table[i]!
      const nextRow = table[i + 1]!
      row[j] = a[i] === b[j] ? nextRow[j + 1]! + 1 : Math.max(nextRow[j]!, row[j + 1]!)
    }
  }

  const ops: Op[] = []
  let i = 0
  let j = 0
  while (i < rows && j < cols) {
    if (a[i] === b[j]) {
      ops.push({ kind: 'equal', text: a[i]! })
      i += 1
      j += 1
    } else if (table[i + 1]![j]! >= table[i]![j + 1]!) {
      ops.push({ kind: 'remove', text: a[i]! })
      i += 1
    } else {
      ops.push({ kind: 'add', text: b[j]! })
      j += 1
    }
  }
  while (i < rows) {
    ops.push({ kind: 'remove', text: a[i]! })
    i += 1
  }
  while (j < cols) {
    ops.push({ kind: 'add', text: b[j]! })
    j += 1
  }
  return ops
}

/**
 * Combine two independent edits of the same `base`, line by line.
 *
 * ---------------------------------------------------------------------------
 * WHY A MERGE AND NOT "LAST WRITE WINS"
 * ---------------------------------------------------------------------------
 * Two repairs can legitimately target one file. `doctor --fix` generates
 * `AGENTBLOG_REVALIDATE_SECRET` into `.env.local` and, separately, moves
 * `INDEXNOW_KEY` out of a git tracked `.env` into the same file. Each computed
 * its result from the same pre-write disk contents, so applying them in order
 * meant the second one overwrote the first: the CLI announced a generated
 * secret that was never on disk, and the next run generated a different one.
 *
 * The merge is a union: every line either side inserted is kept, in base order,
 * with the earlier edit's insertions first; a base line either side deleted is
 * deleted. There is no conflict marker, because both properties this tool
 * needs (nothing is lost, the result is deterministic) hold without one, and a
 * conflict marker written into a user's `.env.local` would be worse than any
 * merge it could have prevented.
 */
export function unionMerge(base: string | null, ours: string, theirs: string): string {
  if (ours === theirs) return ours
  const baseText = base ?? ''
  if (ours === baseText) return theirs
  if (theirs === baseText) return ours

  const baseLines = baseText.split('\n')
  const left = editScript(baseLines, ours.split('\n'))
  const right = editScript(baseLines, theirs.split('\n'))

  const out: string[] = []
  for (let i = 0; i <= baseLines.length; i += 1) {
    out.push(...(left.insertions[i] ?? []))
    out.push(...(right.insertions[i] ?? []))
    if (i === baseLines.length) break
    if (left.kept[i] && right.kept[i]) out.push(baseLines[i]!)
  }
  return out.join('\n')
}

/** Per base line: was it kept, and what was inserted immediately before it. */
function editScript(
  baseLines: readonly string[],
  targetLines: readonly string[],
): { readonly kept: boolean[]; readonly insertions: string[][] } {
  const kept = new Array<boolean>(baseLines.length).fill(false)
  const insertions: string[][] = Array.from({ length: baseLines.length + 1 }, () => [])

  let index = 0
  for (const op of lcsOps(baseLines, targetLines)) {
    if (op.kind === 'add') {
      insertions[index]!.push(op.text)
      continue
    }
    kept[index] = op.kind === 'equal'
    index += 1
  }
  return { kept, insertions }
}

/**
 * A unified diff of `before` to `after`, or an empty string when they match.
 *
 * `before` may be `null`, which renders as a new file.
 */
export function unifiedDiff(path: string, before: string | null, after: string): string {
  if (before === after) return ''

  const aLines = before === null ? [] : before.split('\n')
  const bLines = after.split('\n')

  const header = [`--- ${before === null ? '/dev/null' : `a/${path}`}`, `+++ b/${path}`]

  if (aLines.length > MAX_LINES || bLines.length > MAX_LINES) {
    return [
      ...header,
      `@@ file is too large for a line diff (${aLines.length} to ${bLines.length} lines) @@`,
    ].join('\n')
  }

  const ops = lcsOps(aLines, bLines)

  const changedIndexes = ops.flatMap((op, index) => (op.kind === 'equal' ? [] : [index]))
  if (changedIndexes.length === 0) return ''

  // Group changed regions, with a few lines of context on each side.
  const hunks: { start: number; end: number }[] = []
  for (const index of changedIndexes) {
    const start = Math.max(0, index - CONTEXT)
    const end = Math.min(ops.length - 1, index + CONTEXT)
    const last = hunks.at(-1)
    if (last && start <= last.end + 1) last.end = Math.max(last.end, end)
    else hunks.push({ start, end })
  }

  const out = [...header]
  for (const hunk of hunks) {
    let aStart = 1
    let bStart = 1
    for (let k = 0; k < hunk.start; k += 1) {
      const kind = ops[k]!.kind
      if (kind !== 'add') aStart += 1
      if (kind !== 'remove') bStart += 1
    }
    let aCount = 0
    let bCount = 0
    const body: string[] = []
    for (let k = hunk.start; k <= hunk.end; k += 1) {
      const op = ops[k]!
      if (op.kind === 'equal') {
        aCount += 1
        bCount += 1
        body.push(` ${op.text}`)
      } else if (op.kind === 'remove') {
        aCount += 1
        body.push(`-${op.text}`)
      } else {
        bCount += 1
        body.push(`+${op.text}`)
      }
    }
    out.push(`@@ -${aStart},${aCount} +${bStart},${bCount} @@`, ...body)
  }

  return out.join('\n')
}
