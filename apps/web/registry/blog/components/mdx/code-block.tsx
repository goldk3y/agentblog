/**
 * Code rendering for MDX. Server Components, both of them.
 *
 * ---------------------------------------------------------------------------
 * THERE IS NO CLIENT-SIDE HIGHLIGHTER HERE, AND THERE MUST NOT BE ONE
 * ---------------------------------------------------------------------------
 * `rehype-pretty-code` runs Shiki during compilation in `lib/render-mdx.tsx`, so by
 * the time this component exists the code has already been tokenised into
 * spans, each carrying `--shiki-light` and `--shiki-dark` custom properties.
 * These components add layout and nothing else.
 *
 * That means zero highlighting JavaScript reaches the browser, and, more to the
 * point, the code is fully present in the server-rendered HTML. A crawler that
 * does not execute JavaScript reads your snippets. A client-side highlighter
 * would ship roughly a megabyte of grammars to render text the server already
 * had.
 *
 * If you want a copy button, it belongs in its own small client component
 * rendered *beside* the `<pre>`. The code itself stays server-rendered. Do not
 * turn this file into a client component to get one.
 *
 * ---------------------------------------------------------------------------
 * BLOCK CODE VERSUS INLINE CODE
 * ---------------------------------------------------------------------------
 * MDX maps both to `code`. The difference is the parent: block code sits inside
 * a `<pre>`, inline code does not. Rather than sniff for that at runtime, the
 * `pre` wrapper resets the styles its child `code` would otherwise inherit, so
 * `InlineCode` can style itself unconditionally and both cases come out right.
 *
 * @see https://agentblog.dev/docs/blog-block
 */
import type { ComponentPropsWithoutRef } from 'react'

/**
 * The block. `rehype-pretty-code` wraps this in a
 * `<figure data-rehype-pretty-code-figure>` and may put a `<figcaption>` title
 * above it, both styled in `styles/agentblog.css`.
 *
 * `keepBackground: false` in `lib/render-mdx.tsx` is why `bg-muted` here
 * actually shows: Shiki's own surface colour has been stripped, so the block
 * inherits the consumer's theme instead of GitHub's.
 *
 * `tabIndex={0}` is not optional. `overflow-x-auto` on a non-focusable element
 * gives a mouse user a scrollbar and a keyboard-only user no way to reach the
 * end of a long line, which is a WCAG 2.1.1 (Keyboard) failure. With the block
 * in the tab order the arrow keys scroll it. The code itself is still server
 * rendered: this changes focus behaviour and nothing about the markup a crawler
 * reads.
 *
 * ---------------------------------------------------------------------------
 * WHY THE FOCUSABLE `<pre>` CARRIES A ROLE AND A NAME
 * ---------------------------------------------------------------------------
 * The implicit ARIA role of `<pre>` is `generic`, and `generic` is one of the
 * roles that prohibits `aria-label` outright: a name set on it is not exposed.
 * So a `<pre tabindex="0">` on its own is a stop in the tab order that a screen
 * reader announces with no name at all, and the reader has to start reading
 * source code to find out where they landed.
 *
 * `role="group"` is what makes the name exposable. Deliberately not
 * `role="region"`: a region is a landmark, and a post with six snippets would
 * put six of them in the landmark list beside the article's real sections.
 *
 * The name includes the language because `data-language`, written by
 * `rehype-pretty-code` from the fence info string, is the one fact about the
 * block that is already true and needs no author to maintain it.
 */
interface CodeBlockProps extends ComponentPropsWithoutRef<'pre'> {
  /** Written onto the `<pre>` by `rehype-pretty-code` from the fence info string. */
  readonly 'data-language'?: string | undefined
}

export function CodeBlock({ className, ...props }: CodeBlockProps) {
  const language = props['data-language']

  return (
    <pre
      aria-label={
        language === undefined || language === '' ? 'Code block' : `Code block, ${language}`
      }
      role="group"
      tabIndex={0}
      {...props}
      className={merge(
        'border-border bg-muted focus-visible:ring-ring my-6 overflow-x-auto rounded-lg border p-4 text-sm leading-relaxed focus-visible:ring-2 focus-visible:outline-none [&_code]:bg-transparent [&_code]:p-0 [&_code]:font-normal [&_code]:text-inherit',
        className,
      )}
    />
  )
}

/**
 * Inline code. The `[&_code]` resets on `CodeBlock` above neutralise these
 * styles when the same element appears inside a `<pre>`.
 */
export function InlineCode({ className, ...props }: ComponentPropsWithoutRef<'code'>) {
  return (
    <code
      {...props}
      className={merge(
        'border-border bg-muted text-foreground rounded border px-[0.35em] py-[0.15em] font-mono text-[0.875em]',
        className,
      )}
    />
  )
}

/**
 * Join the component's own classes with whatever the pipeline passed in.
 * Written out rather than imported from `lib/utils.ts`, so the MDX components
 * stay installable without `cn()`. See the header of `components/mdx/index.tsx`
 * for why replacing an incoming `className` is a bug rather than a style.
 */
function merge(own: string, incoming: string | undefined): string {
  return incoming === undefined || incoming === '' ? own : `${own} ${incoming}`
}
