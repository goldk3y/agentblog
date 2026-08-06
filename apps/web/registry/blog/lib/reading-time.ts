/**
 * Reading time, computed from markdown source with no dependencies.
 *
 * ---------------------------------------------------------------------------
 * WHY NOT AN NPM PACKAGE
 * ---------------------------------------------------------------------------
 * Every reading time package counts words in whatever string you hand it. Hand
 * it raw MDX and it counts `import`, `className`, `rehype-pretty-code`, and
 * every token inside a fenced code block. On a technical post with three code
 * samples that inflates the estimate by a third, and the number that appears
 * under the headline is the one readers use to decide whether to start reading.
 *
 * So the interesting work here is not the arithmetic, it is the stripping. This
 * file removes, in order: the frontmatter block, MDX `import`/`export` lines,
 * fenced and indented code, inline code spans, JSX and HTML tags, images, link
 * targets (keeping link text, which a reader does read), and the punctuation
 * that carries markdown structure rather than meaning.
 *
 * 220 words per minute is the middle of the range measured for adult silent
 * reading of non fiction prose. It is a deliberate round number, not a tuned
 * one; the estimate is a courtesy, not a measurement.
 *
 * The result is deterministic and pure, so it is safe at build time, at request
 * time, and inside a client component.
 */

const WORDS_PER_MINUTE = 220

/** A token counts as a word only if it contains a letter or a digit. */
const IS_WORD = /[\p{L}\p{N}]/u

/**
 * Strip everything a reader does not read.
 *
 * Order matters. Code fences go before inline code, or a stray backtick inside a
 * fence eats the rest of the document. Images go before links, because an image
 * is a link with a bang in front of it.
 */
function stripMarkdown(markdown: string): string {
  return (
    markdown
      // Frontmatter, written as a fence of three or more hyphens at the very top.
      .replace(/^\uFEFF?[ \t]*-{3,}[ \t]*\r?\n[\s\S]*?\r?\n-{3,}[ \t]*(?:\r?\n|$)/, '')
      // Fenced code blocks, backtick or tilde, with or without a language.
      .replace(/^[ \t]*(`{3,}|~{3,})[^\n]*\n[\s\S]*?^[ \t]*\1[ \t]*$/gm, '')
      // An unterminated fence at the end of the file.
      .replace(/^[ \t]*(`{3,}|~{3,})[\s\S]*$/m, '')
      // MDX module syntax. These lines are code that happens to sit in prose.
      .replace(/^[ \t]*(?:import|export)\s[^\n]*$/gm, '')
      // HTML comments and MDX expression braces.
      .replace(/<!--[\s\S]*?-->/g, '')
      // Inline code spans.
      .replace(/`+[^`\n]*`+/g, ' ')
      // Images, including the alt text: it is not body copy.
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
      // Links and reference links: keep the visible text, drop the target.
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/\[([^\]]*)\]\[[^\]]*\]/g, '$1')
      // Link reference definitions on their own line.
      .replace(/^[ \t]*\[[^\]]+\]:[^\n]*$/gm, '')
      // JSX and HTML tags. The children of a JSX component stay, which is right:
      // a <Callout> body is prose the reader reads.
      .replace(/<\/?[A-Za-z][^>]*>/g, ' ')
      // Heading markers, blockquote markers, list bullets, and table pipes.
      .replace(/^[ \t]*#{1,6}[ \t]+/gm, '')
      .replace(/^[ \t]*>[ \t]?/gm, '')
      .replace(/^[ \t]*(?:[*+-]|\d+[.)])[ \t]+/gm, '')
      .replace(/^[ \t]*\|?[ \t]*:?-{3,}:?[ \t]*(?:\|[ \t]*:?-{3,}:?[ \t]*)*\|?[ \t]*$/gm, '')
      .replace(/\|/g, ' ')
      // Thematic breaks.
      .replace(/^[ \t]*(?:\*[ \t]*){3,}$|^[ \t]*(?:-[ \t]*){3,}$|^[ \t]*(?:_[ \t]*){3,}$/gm, '')
      // Emphasis, strikethrough, and the escape backslash.
      .replace(/[*_~]+/g, '')
      .replace(/\\([\\`*_{}[\]()#+\-.!])/g, '$1')
  )
}

/**
 * Word count and estimated reading minutes for a post body.
 *
 * `minutes` is never zero: a two sentence post still takes a moment to read, and
 * "0 min read" reads like a bug.
 */
export function readingTime(markdown: string): { minutes: number; words: number } {
  const words = stripMarkdown(markdown)
    .split(/\s+/)
    .filter((token) => IS_WORD.test(token)).length

  return { minutes: Math.max(1, Math.round(words / WORDS_PER_MINUTE)), words }
}
