/**
 * The MDX component map.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS FILE DECIDES
 * ---------------------------------------------------------------------------
 * Two different things live in one object here, and it is worth naming them:
 *
 *   1. **Element overrides.** Lowercase keys (`h2`, `a`, `table`, `pre`) replace
 *      what plain markdown compiles to. An author gets these by writing
 *      markdown and never thinks about them.
 *   2. **Author-usable components.** Capitalised keys (`Callout`, `Stat`,
 *      `Quote`, `Faq`, `Figure`, `KeyTakeaways`) are what makes `<Stat .../>`
 *      resolve inside a `.mdx` file. Without an entry here, MDX renders an
 *      unknown component as an error.
 *
 * `lib/render-mdx.tsx` passes this object to `evaluate()`. It is the only
 * consumer.
 *
 * ---------------------------------------------------------------------------
 * WHAT IS DELIBERATELY NOT MAPPED, AND WHY
 * ---------------------------------------------------------------------------
 * `p`, `ul`, `ol`, `li`, `strong`, and `em` are left to
 * `@tailwindcss/typography`, which `styles/agentblog.css` binds to the
 * consumer's tokens through `--tw-prose-*`. Adding pass-through components for
 * them would put long-form styling in two places that have to agree, and the
 * second one always loses. If body copy looks wrong, fix the binding in
 * `agentblog.css`, not here.
 *
 * ---------------------------------------------------------------------------
 * WHY EVERY COMPONENT HERE MERGES `className` INSTEAD OF REPLACING IT
 * ---------------------------------------------------------------------------
 * The pipeline DOES pass a `className` to these elements, and a component that
 * writes its own `className` after `{...props}` silently throws that one away.
 * The case that proved it: `remark-rehype` emits the GFM footnote section label
 * as `<h2 class="sr-only" id="footnote-label">`. Dropping `sr-only` puts a
 * full-size heading reading "Footnotes" in the middle of the article, with an
 * autolink anchor, and it is not in the table of contents because the extractor
 * never saw it. `rehype-autolink-headings` is the other source: it appends an
 * `<a class="agentblog-anchor">` inside every heading, and replacing that class
 * is what makes the anchor render as a full body link instead of the faint
 * marker `styles/agentblog.css` styles.
 *
 * So every override below destructures `className` out and merges it with
 * `mergeClasses`. Component styles come first and the incoming class comes last,
 * which is only a reading order: CSS precedence is decided by the stylesheet,
 * not by the order of names in the attribute. There is no `cn()` import, so the
 * block has no dependency on the consumer having `lib/utils.ts`.
 *
 * @see https://docs.agentblog.dev/guides/match-your-design
 */
import type { ComponentPropsWithoutRef } from 'react'

import { Callout } from '@/components/mdx/callout'
import { CodeBlock, InlineCode } from '@/components/mdx/code-block'
import { Faq } from '@/components/mdx/faq'
import { Figure, MdxImage } from '@/components/mdx/figure'
import { KeyTakeaways } from '@/components/mdx/key-takeaways'
import { Quote } from '@/components/mdx/quote'
import { Stat } from '@/components/mdx/stat'
import { Table, Tbody, Td, Th, Thead, Tr } from '@/components/mdx/table'
import { sitePath } from '@/lib/config'

/**
 * Join a component's own classes with whatever the pipeline passed in, dropping
 * the empty cases so the attribute never gains a stray space.
 */
function mergeClasses(own: string, incoming: string | undefined): string {
  return incoming === undefined || incoming === '' ? own : `${own} ${incoming}`
}

/**
 * `scroll-mt-24` on every heading. Without it, following a table of contents
 * link parks the heading underneath a sticky header and the reader lands on the
 * paragraph above the section they asked for.
 *
 * The trailing `<a class="agentblog-anchor">` inside each heading is appended
 * by `rehype-autolink-headings`. It arrives as part of `children` and is styled
 * in `styles/agentblog.css`, where it stays faint until the heading is hovered.
 *
 * `className` is merged rather than replaced. See the file header: the GFM
 * footnote label arrives here as an `sr-only` H2 and has to stay hidden.
 */
function H2({ className, ...props }: ComponentPropsWithoutRef<'h2'>) {
  return (
    <h2
      {...props}
      className={mergeClasses(
        'agentblog-heading text-foreground mt-12 mb-4 scroll-mt-24 text-2xl font-semibold tracking-tight first:mt-0',
        className,
      )}
    />
  )
}

function H3({ className, ...props }: ComponentPropsWithoutRef<'h3'>) {
  return (
    <h3
      {...props}
      className={mergeClasses(
        'agentblog-heading text-foreground mt-8 mb-3 scroll-mt-24 text-xl font-semibold tracking-tight first:mt-0',
        className,
      )}
    />
  )
}

function H4({ className, ...props }: ComponentPropsWithoutRef<'h4'>) {
  return (
    <h4
      {...props}
      className={mergeClasses(
        'agentblog-heading text-foreground mt-6 mb-2 scroll-mt-24 text-base font-semibold first:mt-0',
        className,
      )}
    />
  )
}

/**
 * Anything with a scheme (`https:`, `mailto:`, `tel:`), a protocol-relative
 * `//host/path`, or a bare fragment belongs to somewhere this block does not
 * route. Everything else that starts with a single `/` is an internal,
 * root-relative path and is the trailing-slash policy's business.
 *
 * A relative href such as `./sibling` is left alone deliberately: resolving it
 * needs the URL of the page the post is rendered on, and `renderMdx` does not
 * know that by design.
 */
const HAS_ITS_OWN_DESTINATION = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i

/**
 * Links.
 *
 * External links open in a new tab and carry `rel="noopener noreferrer"`.
 * Internal ones do not, because opening your own site in a new tab is a
 * decision the reader did not ask for.
 *
 * `noopener` matters: without it the opened page can reach back through
 * `window.opener`. `noreferrer` goes with it so the target sees no referrer.
 *
 * Outbound citations are an asset rather than a leak. The GEO paper measures a
 * 30 to 40% band for citing sources, so this component is built to make them
 * comfortable to write, not to discourage them.
 *
 * ---------------------------------------------------------------------------
 * WHY AN INTERNAL HREF GOES THROUGH `sitePath()`
 * ---------------------------------------------------------------------------
 * MDX is the one surface where a href is typed by hand, in a `.mdx` file, by
 * somebody who is thinking about the sentence rather than about
 * `config.trailingSlash`. Every other internal link in the block comes from a
 * `@/lib/config` helper, so it is the only place the policy could not be
 * applied, and nothing lints for it.
 *
 * On a `trailingSlash: true` site an authored `/blog/some-post` is a 308 to
 * `/blog/some-post/` on every in-article link. AI crawlers frequently do not
 * follow those, which loses exactly the internal link graph the citations are
 * there to build. `sitePath` splits a query or fragment off before it
 * normalises, so `/blog/post#section` survives as `/blog/post/#section`.
 */
function MdxLink({ href, className, children, ...props }: ComponentPropsWithoutRef<'a'>) {
  const resolved =
    href === undefined || HAS_ITS_OWN_DESTINATION.test(href) || !href.startsWith('/')
      ? href
      : sitePath(href)
  const isExternal = resolved !== undefined && /^https?:\/\//i.test(resolved)

  return (
    <a
      {...(resolved !== undefined ? { href: resolved } : {})}
      {...(isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      {...props}
      className={mergeClasses(
        'text-primary font-medium underline underline-offset-4 hover:no-underline',
        className,
      )}
    >
      {children}
    </a>
  )
}

/**
 * The markdown `>` blockquote. Attribution is unavailable in markdown syntax,
 * so this path renders the unattributed form. Authors who can name a source
 * should write `<Quote source="..." cite="...">` instead, which is measurably
 * more effective.
 */
function MdxBlockquote({ children, cite }: ComponentPropsWithoutRef<'blockquote'>) {
  return <Quote {...(cite !== undefined ? { cite } : {})}>{children}</Quote>
}

function Hr({ className, ...props }: ComponentPropsWithoutRef<'hr'>) {
  return <hr {...props} className={mergeClasses('border-border my-10', className)} />
}

export const mdxComponents = {
  /* Element overrides */
  h2: H2,
  h3: H3,
  h4: H4,
  a: MdxLink,
  hr: Hr,
  img: MdxImage,
  pre: CodeBlock,
  code: InlineCode,
  blockquote: MdxBlockquote,
  table: Table,
  thead: Thead,
  tbody: Tbody,
  tr: Tr,
  th: Th,
  td: Td,

  /* Author-usable components */
  Callout,
  Faq,
  Figure,
  KeyTakeaways,
  Quote,
  Stat,
}

export default mdxComponents
