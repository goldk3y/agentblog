/**
 * The only place MDX is compiled in AgentBlog. Keep it that way.
 *
 * ---------------------------------------------------------------------------
 * WHY `next-mdx-remote-client/rsc` AND NOT `@next/mdx`
 * ---------------------------------------------------------------------------
 * The decisive reason is the two plugin files sitting next to this one.
 *
 * `@next/mdx` compiles MDX through the Turbopack loader, and Turbopack is the
 * default bundler in Next 16. Turbopack's compiler is Rust, so it cannot accept
 * a JavaScript function as a plugin. Its documented workaround is to name
 * plugins as strings that Turbopack resolves by module name:
 * `remarkPlugins: ['remark-gfm', ['remark-toc', { heading: 'The Table' }]]`.
 *
 * `remarkExtractToc` and `remarkAnswerCapsule` are local functions in your
 * repository. Under `@next/mdx` plus Turbopack they would have to be published
 * to npm and resolvable by package name before they could run at all. That is
 * an absurd price for two files you can read in a minute.
 *
 * `next-mdx-remote-client` compiles MDX at runtime, inside this function, using
 * `@mdx-js/mdx` directly. It never touches the Turbopack loader, so neither the
 * string-name restriction nor the serializable-options restriction applies.
 * Local plugin functions work normally.
 *
 * The secondary reason: this same code path renders a `.mdx` file read off disk
 * and an MDX string read out of a database, because it takes a string and
 * returns a React element. `@next/mdx`'s pattern is a dynamic import of
 * `@/content/<slug>.mdx`, which ties content to the filesystem and cannot
 * satisfy the `ContentSource` interface in `lib/types.ts` for any adapter that
 * is not files on disk.
 *
 * ---------------------------------------------------------------------------
 * STABILITY IS THE DESIGN GOAL
 * ---------------------------------------------------------------------------
 * Every consumer of MDX in this blog calls `renderMdx(source, origin)` and
 * receives `{ content, toc }`. Nothing else in the codebase imports an MDX library,
 * knows what a vfile is, or names a plugin. If `next-mdx-remote-client` ever
 * stalls, swapping to `@mdx-js/mdx`'s own `compile` and `evaluate` is a change
 * to this one file with zero consumer impact. Adding a plugin is also a change
 * to this one file. Resist the urge to compile MDX anywhere else.
 *
 * Verified API of `next-mdx-remote-client@2.1.11`: the `/rsc` entrypoint
 * exports `MDXRemote` and `evaluate`. `evaluate({ source, options, components })`
 * resolves to `{ content, mod, frontmatter, scope, error? }`. It does not throw
 * on a compile failure, it returns the error on the result, which is why the
 * throw below is explicit.
 *
 * ===========================================================================
 * THE TRUST MODEL. READ THIS BEFORE POINTING A NEW CONTENT SOURCE AT IT
 * ===========================================================================
 * MDX is a programming language, not a markup format. `renderMdx` compiles the
 * body you give it and runs the result inside your server process, with that
 * process's `process`, `process.env`, and `process.getBuiltinModule` reachable
 * from any expression in the document.
 *
 * **A post body is code. Only pass this content from an author you would give a
 * shell account on the same machine.**
 *
 * Concretely, with no `import` statement anywhere in the file:
 *
 *     {(() => { const cp = process.getBuiltinModule('child_process')
 *               return cp.execSync('id -un').toString() })()}
 *
 * executes on the server and renders its output. `Secret is {process.env.X}`
 * prints an environment variable into public HTML. Both were reproduced against
 * this file.
 *
 * `disableImports` and `disableExports` are set below and they are worth having,
 * but be clear about what they do and do not buy:
 *
 *   they DO strip `import` and `export` statements from the document, so a body
 *   cannot pull in a module or hang a value off the evaluated module's exports;
 *
 *   they DO NOT stop expression evaluation. `{anything}` still runs. There is no
 *   option on `@mdx-js/mdx` or on `next-mdx-remote-client` that turns MDX into a
 *   sandbox, because evaluating expressions is what MDX is for.
 *
 * That is fine for `mdxSource`, where posts are files in your repository and
 * arrive through code review and a deploy. It is not fine the moment the content
 * source is something anyone but a trusted author can write to. If you are
 * writing a `supabaseSource`, a `sanitySource`, or anything with a non-admin
 * write path, the body from that source must not reach this function: render it
 * through a CommonMark pipeline with raw HTML disabled, or gate MDX behind an
 * author role you control. See the same warning on `ContentSource` in
 * `lib/types.ts`.
 *
 * @see https://docs.agentblog.dev/reference/files
 */
import 'server-only'

import { evaluate } from 'next-mdx-remote-client/rsc'
import type { ReactElement } from 'react'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import rehypePrettyCode from 'rehype-pretty-code'
import type { Options as PrettyCodeOptions } from 'rehype-pretty-code'
import rehypeSlug from 'rehype-slug'
import remarkGfm from 'remark-gfm'

import { mdxComponents } from '@/components/mdx'
import { FAQ_HEADING, FAQ_HEADING_ID } from '@/components/mdx/faq'
import { remarkAnswerCapsule } from '@/lib/mdx-plugins/remark-answer-capsule'
import { remarkExtractToc } from '@/lib/mdx-plugins/remark-extract-toc'
import type { TocEntry } from '@/lib/toc'

export interface RenderedMdx {
  readonly content: ReactElement
  readonly toc: TocEntry[]
  /**
   * The `id` to put on the FAQ section heading a route renders after the body,
   * and on the table-of-contents entry that points at it.
   *
   * It is issued here rather than chosen by the route because the only slugger
   * that can allocate a NON-COLLIDING id is the one that already issued every
   * body heading id. A post whose body contains an H2 titled "Frequently asked
   * questions" gets `frequently-asked-questions-1` back, which is exactly what
   * `rehype-slug` would have produced had the heading been in the body. See
   * `trailingHeadings` in `lib/mdx-plugins/remark-extract-toc.ts` for the bug
   * that made this necessary.
   *
   * Always a string. A route with no FAQ to render simply ignores it.
   */
  readonly faqHeadingId: string
}

/**
 * Two themes, resolved at compile time into `--shiki-light` and `--shiki-dark`
 * custom properties on every token. `styles/agentblog.css` picks between them
 * under `.dark`. `keepBackground: false` drops Shiki's own surface colour so
 * the code block sits on `bg-muted` like everything else.
 */
const prettyCode: PrettyCodeOptions = {
  theme: { light: 'github-light', dark: 'github-dark' },
  keepBackground: false,
}

/**
 * The anchor `rehype-autolink-headings` appends inside each heading. It is a
 * real `<a href="#id">` in the HTML, which is what gives search and retrieval
 * systems clean section boundaries. `styles/agentblog.css` keeps it faint until
 * the heading is hovered or the link is focused.
 */
const autolink = {
  behavior: 'append',
  properties: { className: ['agentblog-anchor'], ariaLabel: 'Link to this section' },
  content: { type: 'element', tagName: 'span', properties: {}, children: [] },
} as const

/** `3:12` or `3:1-3:11` anywhere in a message, which is how MDX writes positions. */
const POSITION_IN_MESSAGE = /\b(\d+):(\d+)(?:-\d+:\d+)?\b/

/**
 * Position of a compile failure, as `:line:column`, or `''` when the compiler
 * did not report one.
 *
 * Two sources, because there are two shapes this error arrives in.
 *
 * A raw `@mdx-js` syntax failure is a `VFileMessage` carrying `line` and
 * `column` as own properties. `VFileMessage` is not exported as a class anywhere
 * we can import from, and an `instanceof` against a transitive dependency's
 * class breaks the moment two copies of `vfile` are installed, so the two fields
 * are read structurally.
 *
 * `next-mdx-remote-client` does not hand that object over. `createFormattedMDXError`
 * in its `dist/lib/util.js` rebuilds a plain `Error` whose message is the
 * original text plus a code frame, so the structured fields are gone by the time
 * we see it and the only position left is the one inside the message. Hence the
 * regex fallback. Some MDX messages carry no position at all, which is why this
 * returns `''` rather than guessing: the code frame the library appends is the
 * better answer in that case, and the file name from `origin` is the part that
 * was actually missing.
 */
function positionOf(error: unknown): string {
  if (typeof error !== 'object' || error === null) return ''

  const { line, column, message } = error as {
    line?: unknown
    column?: unknown
    message?: unknown
  }
  if (typeof line === 'number') {
    return typeof column === 'number' ? `:${line}:${column}` : `:${line}`
  }

  const match = typeof message === 'string' ? POSITION_IN_MESSAGE.exec(message) : null
  return match ? `:${match[1]}:${match[2]}` : ''
}

/**
 * Turn a compile failure into an error that names the post.
 *
 * The compiler never sees a filename, because `renderMdx` is handed a body
 * string by design (see the header). Without this wrapper the thrown error reads
 * `Unexpected character '/' (U+002F) before local name` with a stack pointing at
 * this file, so a red build tells you MDX broke and not which of two hundred
 * posts broke it. The compiler's own message and stack are preserved on `cause`.
 */
function locateFailure(error: unknown, origin: string | undefined): Error {
  const where = origin ?? 'an MDX source with no origin passed to renderMdx()'
  const reason = error instanceof Error ? error.message : String(error)
  return new Error(`Failed to compile MDX in ${where}${positionOf(error)}: ${reason}`, {
    cause: error,
  })
}

/**
 * Compile an MDX string into a server-rendered element plus its table of
 * contents. The source may come from a file, a database row, or an API
 * response. This function does not care and must never start caring.
 *
 * `origin` names where the source came from and is used for one thing: the error
 * message when compilation fails. Pass the file path when the caller has one and
 * the post slug otherwise. It is optional so that a caller with genuinely no
 * origin (a scratch preview, a test) is not forced to invent one, and every
 * caller that has an origin should pass it.
 */
export async function renderMdx(source: string, origin?: string): Promise<RenderedMdx> {
  const { content, scope, error } = await evaluate<
    Record<string, never>,
    { toc: TocEntry[]; trailingToc: TocEntry[] }
  >({
    source,
    components: mdxComponents,
    options: {
      // Frontmatter is parsed by the content source before it ever reaches
      // here, so `Post.body` is already the body alone.
      parseFrontmatter: false,
      /*
       * Strip `import` and `export` from the document. Both default to `false`
       * in `next-mdx-remote-client@2.1.11`, which means nothing is stripped
       * unless you say so: `composeCompileOptions` in `dist/lib/compile.js`
       * passes `[disableExports && 'export', disableImports && 'import']` to
       * `remark-mdx-remove-esm`, and two `undefined`s remove nothing.
       *
       * `import` previously failed only by accident, because `mdxOptions.baseUrl`
       * is unset and `@mdx-js` throws when it has no base to resolve against.
       * An accident is not a control. `export` did not fail at all: a body could
       * write `export const stolen = process.env.SECRET` and read it back off
       * `mod`.
       *
       * Read the trust model in the header for what this does not fix. Stripping
       * ESM is a reduction in surface, not a sandbox, and the seed posts are
       * unaffected because MDX components arrive through the `components` map
       * rather than through an `import`.
       */
      disableExports: true,
      disableImports: true,
      // Lifts both fields written by `remarkExtractToc` onto the result.
      vfileDataIntoScope: ['toc', 'trailingToc'],
      scope: { toc: [], trailingToc: [] },
      mdxOptions: {
        /*
         * `trailingHeadings` is what makes the FAQ heading id come out of the
         * same slugger run as the body ids instead of being guessed by the post
         * route. Read the option's own doc comment before changing this array:
         * the id it reserves is the one thing standing between a post with a
         * body H2 titled "FAQ" and two elements sharing an id.
         */
        remarkPlugins: [
          remarkGfm,
          [remarkExtractToc, { trailingHeadings: [FAQ_HEADING] }],
          remarkAnswerCapsule,
        ],
        rehypePlugins: [
          rehypeSlug,
          [rehypeAutolinkHeadings, autolink],
          [rehypePrettyCode, prettyCode],
        ],
      },
    },
  })

  // `evaluate` swallows compile errors and returns an empty div. Deploying a
  // post whose body silently vanished is worse than a red build, so rethrow,
  // wrapped so the message names the post rather than only this file.
  if (error) throw locateFailure(error, origin)

  /*
   * `trailingToc[0]` is the FAQ entry, because `trailingHeadings` above has one
   * element. The fallback is the unallocated spelling from `components/mdx/faq`
   * and exists so the return type is a plain `string`; it can only be reached if
   * somebody empties that array, in which case the route renders the FAQ with
   * the same id it always had and nothing regresses silently.
   */
  return {
    content,
    toc: scope.toc,
    faqHeadingId: scope.trailingToc[0]?.id ?? FAQ_HEADING_ID,
  }
}
