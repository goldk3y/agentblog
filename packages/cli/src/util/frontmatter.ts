/**
 * Frontmatter reading, delegated to a real YAML parser.
 *
 * This used to be hand rolled. It handled `key: value`, quoted scalars, and flat
 * block lists, and it silently mis-read everything else. Against the frontmatter
 * this product itself ships it returned the literal string `">-"` for
 * `answerCapsule`, a single mapping for a three entry `citations` list, and a
 * one key object for a four entry `faq` list. `audit` then reported "0 word
 * answer capsule" and "5 paragraphs with a statistic and no citation" against
 * posts that were correct, which is the worst failure a verification tool has:
 * confident, specific, and wrong.
 *
 * So the reader delegates to `yaml` (eemeli/yaml). Block scalars (`>-`, `|`),
 * lists of mappings, anchors, and flow collections all parse the way the build
 * pipeline parses them, which is the point: `audit` and the shipped MDX source
 * adapter must agree about what a post says.
 *
 * A malformed document is surfaced, never partially parsed. `error` carries the
 * parser's own message with the line and column inside the frontmatter block,
 * and the caller names the file. A half parsed document reported as findings is
 * how a writer gets sent to fix a capsule that is already there.
 */
import { parseDocument } from 'yaml'

export interface FrontmatterError {
  /** The parser's message, without the file name. The caller adds that. */
  readonly message: string
  /** 1 based, counted from the first line of the file, not of the block. */
  readonly line: number
  readonly column: number
}

export interface ParsedPost {
  readonly data: Readonly<Record<string, unknown>>
  readonly body: string
  /** `true` when the file opened with a `---` fence at all. */
  readonly hasFrontmatter: boolean
  /** Set when the block is not valid YAML. `data` is empty when it is set. */
  readonly error: FrontmatterError | null
}

const FENCE = /^---\r?\n/

export function parseFrontmatter(source: string): ParsedPost {
  if (!FENCE.test(source)) {
    return { data: {}, body: source, hasFrontmatter: false, error: null }
  }

  const end = source.indexOf('\n---', 3)
  if (end === -1) {
    return {
      data: {},
      body: source,
      hasFrontmatter: false,
      error: {
        message: 'the frontmatter opens with --- but never closes',
        line: 1,
        column: 1,
      },
    }
  }

  const blockStart = source.indexOf('\n') + 1
  const block = source.slice(blockStart, end)
  const body = source.slice(source.indexOf('\n', end + 1) + 1)

  // `prettyErrors` gives us line and column on each error rather than only a
  // character offset. The offset is relative to the block, so the line is
  // shifted by the one line the opening fence occupies.
  const document = parseDocument(block, { prettyErrors: true })
  const first = document.errors[0]
  if (first) {
    return {
      data: {},
      body,
      hasFrontmatter: true,
      error: {
        // `prettyErrors` appends "at line N, column M:" and a code frame to the
        // message. Both are dropped: the caller prints one location, and two
        // locations for one error is how a reader ends up looking at the wrong
        // line.
        message: (first.message.split('\n')[0] ?? first.message).replace(
          /\s*at line \d+, column \d+:?$/,
          '',
        ),
        line: (first.linePos?.[0]?.line ?? 1) + 1,
        column: first.linePos?.[0]?.col ?? 1,
      },
    }
  }

  const value: unknown = document.toJS({ maxAliasCount: 100 })
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return {
      data: {},
      body,
      hasFrontmatter: true,
      error: {
        message: 'the frontmatter is not a mapping of keys to values',
        line: 2,
        column: 1,
      },
    }
  }

  return {
    data: value as Record<string, unknown>,
    body,
    hasFrontmatter: true,
    error: null,
  }
}
