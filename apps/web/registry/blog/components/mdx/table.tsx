/**
 * Table primitives for MDX.
 *
 * ---------------------------------------------------------------------------
 * WHY COMPARISON AND SPECIFICATION DATA BELONGS IN A REAL TABLE
 * ---------------------------------------------------------------------------
 * The same five rows written as prose and written as a `<table>` are not the
 * same content to a retrieval system. A table gives every cell an explicit row
 * and column, so "what is the price of the Pro plan" resolves to one cell,
 * while the prose version requires the model to reconstruct a relationship the
 * markup never stated. Industry measurements put tables at roughly 2.5 to 4.2x
 * the citation rate of the equivalent prose (correlational, but the mechanism
 * is not mysterious).
 *
 * So: `<thead>` and `<tbody>` are real, headers are `<th>` with a scope, and
 * the table is never replaced by a grid of divs. `remark-gfm` in
 * `lib/render-mdx.tsx` is what lets an author write pipe tables in MDX and get
 * this markup out.
 *
 * One writing rule that belongs with the component: a table has to be readable
 * where it sits. Do not rely on a caption two sections earlier to explain what
 * the columns mean, because the chunk that gets retrieved is the table.
 *
 * ---------------------------------------------------------------------------
 * WHY THE WRAPPER IS A DIV AND NOT `overflow` ON THE TABLE
 * ---------------------------------------------------------------------------
 * A table cannot scroll itself. The wrapper is what keeps a six-column
 * comparison from forcing horizontal scroll on the whole page at 375px, and it
 * is inside the article, so the table markup a crawler reads is untouched.
 *
 * ---------------------------------------------------------------------------
 * WHY THE WRAPPER IS FOCUSABLE
 * ---------------------------------------------------------------------------
 * `overflow-x-auto` on a plain `<div>` gives a mouse user a scrollbar and gives
 * a keyboard-only user nothing: there is no way to move focus into the region,
 * so the columns past the right edge are unreachable. That is a WCAG 2.1.1
 * (Keyboard) failure, and it is invisible in review because the table looks
 * fine on a desktop viewport.
 *
 * `tabIndex={0}` puts the scroll container in the tab order, at which point the
 * arrow keys scroll it.
 *
 * ---------------------------------------------------------------------------
 * WHY `role="region"` IS CONDITIONAL
 * ---------------------------------------------------------------------------
 * A region is a landmark, and a landmark is only useful if it has a name a
 * reader can tell apart from the others. This component used to default
 * `aria-label` to the literal string `'Table'`, and since a pipe table written
 * in MDX never passes `label`, a post with two tables shipped two landmarks
 * both announced as "Table". That is worse than no landmark: it adds two
 * indistinguishable stops to the landmark list and tells the reader nothing.
 *
 * So the name is derived, never invented. An explicit `label` wins; failing
 * that, a `<caption>` inside the table supplies it, which is the element that
 * exists for exactly this purpose and which also names the table visibly, so
 * the visible name and the accessible one cannot drift. With no name available,
 * `role="region"` and `aria-label` are both omitted and the wrapper stays a
 * plain focusable scroll container: the `<table>` inside it is still announced
 * as a table with its own row and column semantics, so nothing about the
 * content becomes unreachable.
 *
 * `tabIndex` stays on unconditionally, because WCAG 2.1.1 does not care whether
 * the container has a name.
 *
 * BE CLEAR ABOUT WHICH BRANCH A POST TAKES. A `remark-gfm` pipe table, which is
 * how every table in a `.mdx` file is written, produces `thead` and `tbody` and
 * nothing else, and it has no syntax for passing a prop. Writing literal
 * `<table>` JSX in MDX does not help either: `components` is applied to
 * markdown constructs only, and `@mdx-js/mdx@3` compiles a lowercase JSX tag
 * straight to the intrinsic element, so such a table never reaches this file at
 * all. An MDX-authored table therefore always takes the unnamed branch, on
 * purpose. `label` and `<caption>` are for `<Table>` rendered from your own
 * TSX.
 *
 * @see https://docs.agentblog.dev/concepts/geo-playbook
 */
import { Children, isValidElement } from 'react'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'

export interface TableProps extends ComponentPropsWithoutRef<'table'> {
  /**
   * Accessible name for the scrollable region around the table. Set it when a
   * post has several tables and none of them carry a `<caption>`, so the
   * landmarks are distinguishable.
   */
  readonly label?: string | undefined
}

export function Table({ label, className, children, ...props }: TableProps) {
  const name = label ?? captionText(children)

  return (
    <div
      /*
       * `not-prose` on the wrapper, not on the table.
       *
       * `@tailwindcss/typography` gives every `<table>` a 2em block margin. Ours
       * is inside a bordered panel, so that margin rendered as an unexplained
       * 40px strip between the panel's top border and the header row, on every
       * table in every post. Overriding it with a `my-0` utility is a
       * specificity race against a plugin-generated `:where()` rule, and it is
       * the wrong fix anyway: `Thead`, `Tbody`, `Tr`, `Th`, and `Td` below all
       * carry their own classes, so there is nothing in here the plugin should
       * be styling at all.
       */
      className="not-prose border-border focus-visible:ring-ring my-8 w-full overflow-x-auto rounded-xl border focus-visible:ring-2 focus-visible:outline-none"
      // Both attributes or neither. See "WHY `role=\"region\"` IS CONDITIONAL".
      {...(name === undefined ? {} : { role: 'region', 'aria-label': name })}
      tabIndex={0}
    >
      <table {...props} className={merge('w-full border-collapse text-left text-sm', className)}>
        {children}
      </table>
    </div>
  )
}

/**
 * The text of a `<caption>` among the table's children, if there is one.
 *
 * A caption written in TSX arrives here as a React element whose `type` is the
 * string `'caption'`. Reading it rather than asking for a second `label` is
 * what keeps the visible name and the accessible name the same string. See the
 * header for why an MDX-authored table never reaches this function.
 */
function captionText(children: ReactNode): string | undefined {
  for (const child of Children.toArray(children)) {
    if (!isValidElement(child) || child.type !== 'caption') continue
    const text = plainText((child.props as { children?: ReactNode }).children).trim()
    return text.length > 0 ? text : undefined
  }
  return undefined
}

/** The visible text of a React subtree. Enough for a caption, and no more. */
function plainText(node: ReactNode): string {
  if (typeof node === 'string') return node
  if (typeof node === 'number') return String(node)
  if (Array.isArray(node)) return (node as ReactNode[]).map(plainText).join('')
  if (isValidElement(node)) return plainText((node.props as { children?: ReactNode }).children)
  return ''
}

/**
 * The row and cell primitives all merge `className` rather than replacing it,
 * for the reason set out in the header of `components/mdx/index.tsx`: a
 * component that writes its own `className` after `{...props}` discards
 * whatever the pipeline sent, and the pipeline does send one. Nothing sends one
 * to these particular elements today, and that is not a reason to leave the
 * trap armed in five more places.
 */
function merge(own: string, incoming: string | undefined): string {
  return incoming === undefined || incoming === '' ? own : `${own} ${incoming}`
}

export function Thead({ className, ...props }: ComponentPropsWithoutRef<'thead'>) {
  return <thead {...props} className={merge('bg-muted text-muted-foreground', className)} />
}

export function Tbody({ className, ...props }: ComponentPropsWithoutRef<'tbody'>) {
  return <tbody {...props} className={merge('divide-border divide-y', className)} />
}

export function Tr({ className, ...props }: ComponentPropsWithoutRef<'tr'>) {
  return <tr {...props} className={merge('border-border border-b last:border-0', className)} />
}

/**
 * `scope` is set unconditionally. A header cell without one is ambiguous to a
 * screen reader in any table wider than two columns, and `remark-gfm` does not
 * emit it.
 */
export function Th({ className, ...props }: ComponentPropsWithoutRef<'th'>) {
  return (
    <th
      scope="col"
      {...props}
      className={merge('text-foreground px-4 py-3 align-top text-sm font-semibold', className)}
    />
  )
}

export function Td({ className, ...props }: ComponentPropsWithoutRef<'td'>) {
  return <td {...props} className={merge('text-foreground px-4 py-3 align-top', className)} />
}
