/**
 * `remarkAnswerCapsule` - a lint, not a transform.
 *
 * ---------------------------------------------------------------------------
 * WHAT AN ANSWER CAPSULE IS AND WHY IT GETS ITS OWN PLUGIN
 * ---------------------------------------------------------------------------
 * The answer capsule is the 40 to 60 word direct answer that opens a post. It
 * is the passage an AI engine lifts verbatim when it cites you, which makes it
 * the single highest-value paragraph on the page: state the complete answer
 * first, no preamble, no links inside it. A capsule appeared in 72.4% of
 * ChatGPT-cited pages in Indig's corpus (industry study, directional).
 *
 * Under 40 words the passage rarely answers the question completely, so an
 * engine has to stitch it together with surrounding text and the citation goes
 * to whoever wrote a self-contained one. Over 60 words it gets truncated and
 * the sentence that survives is no longer the answer.
 *
 * The H1 is not in the MDX body: it comes from frontmatter and is rendered by
 * the post route. So the capsule is simply the first paragraph of the document,
 * or the first paragraph after an H1 if an author wrote one anyway.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS WARNS AND NEVER FAILS
 * ---------------------------------------------------------------------------
 * `agentblog audit` is where this rule is enforced properly: it reads the whole
 * corpus, reports every post at once, and exits non-zero in CI. This plugin
 * exists only to surface the same thing in the terminal while you are writing,
 * at the moment the post compiles. A build that refuses to render a post
 * because its opening paragraph is eight words long would be a worse tool than
 * one that renders it and tells you.
 *
 * ---------------------------------------------------------------------------
 * WHY IT ALSO WRITES TO THE CONSOLE
 * ---------------------------------------------------------------------------
 * `file.message()` is the correct unified-ecosystem way to report this, and any
 * tooling that inspects the vfile will find it. But `evaluate()` from
 * `next-mdx-remote-client` returns content, frontmatter, and scope, and does
 * not hand the vfile back to its caller, so a message alone would go nowhere.
 * We mirror it to `console.warn` in development for that reason. Production
 * builds stay quiet: by then `agentblog audit` has already had its say.
 *
 * @see https://docs.agentblog.dev/reference/files
 * @see https://docs.agentblog.dev/concepts/geo-playbook*/
import type { Nodes, Paragraph, Root } from 'mdast'
import type { VFile } from 'vfile'

const MIN_WORDS = 40
const MAX_WORDS = 60
const RULE_ID = 'answer-capsule'

export function remarkAnswerCapsule() {
  return (tree: Root, file: VFile): undefined => {
    const opening = openingParagraph(tree)

    if (!opening) {
      warn(file, `post has no opening paragraph, so it has no answer capsule`, undefined)
      return
    }

    const words = countWords(paragraphText(opening))
    if (words < MIN_WORDS || words > MAX_WORDS) {
      warn(
        file,
        `answer capsule is ${String(words)} words, target is ${String(MIN_WORDS)} to ${String(
          MAX_WORDS,
        )}. This paragraph is what an AI engine quotes, so it has to answer the question on its own.`,
        opening,
      )
    }
  }
}

/**
 * The first paragraph of the body.
 *
 * Only top-level children are considered. A paragraph nested in a blockquote or
 * a list is not an opening answer, and treating it as one would produce a
 * warning the author cannot act on.
 */
function openingParagraph(tree: Root): Paragraph | undefined {
  for (const node of tree.children) {
    if (node.type === 'paragraph') return node
    // An H1 in the body is redundant with the frontmatter title, but authors
    // write one sometimes. Step over it rather than reporting the wrong node.
    if (node.type === 'heading' && node.depth === 1) continue
    if (node.type === 'thematicBreak') continue
    // Anything else first (a table, a code block, a component) means the post
    // opens with something other than prose, which is its own problem.
    return undefined
  }
  return undefined
}

function paragraphText(node: Nodes): string {
  if (node.type === 'text' || node.type === 'inlineCode') return node.value
  if ('children' in node) {
    let out = ''
    for (const child of node.children) out += paragraphText(child)
    return out
  }
  return ''
}

function countWords(text: string): number {
  const trimmed = text.trim()
  return trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length
}

function warn(file: VFile, reason: string, place: Nodes | undefined): undefined {
  const message = file.message(reason)
  message.ruleId = RULE_ID
  message.source = 'agentblog'
  // `fatal: false` is the vfile default and is the whole point here: this is a
  // warning, and nothing downstream is allowed to promote it.
  message.fatal = false
  if (place?.position) message.place = place.position

  if (process.env.NODE_ENV !== 'production') {
    console.warn(`[agentblog:${RULE_ID}] ${reason}`)
  }
}
