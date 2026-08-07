/**
 * `<Stat>` - one number, labelled and sourced.
 *
 * ---------------------------------------------------------------------------
 * WHY A COMPONENT FOR A NUMBER
 * ---------------------------------------------------------------------------
 * Adding statistics is the second strongest change measured in the GEO paper
 * (Aggarwal et al., ACM KDD 2024): about +31% on position-adjusted word count,
 * and around +37% on Perplexity. Directional, measured on 2023 models, and
 * still the cheapest edit available to most posts.
 *
 * The component exists to make the *sourced* version the easy one to write. An
 * unsourced number is a claim; a number with an attributed source is evidence,
 * and evidence is what gets quoted. `source` and `href` are optional in the
 * type and mandatory in practice.
 *
 * For more than two or three related numbers, use a real `<table>` instead. A
 * table states the relationship between the numbers, which a row of stat blocks
 * only implies.
 *
 * ---------------------------------------------------------------------------
 * MARKUP
 * ---------------------------------------------------------------------------
 * `<figure>` with the value in a `<p>` and the label in `<figcaption>`. The
 * value is deliberately not a heading: it is not a section boundary, and
 * putting it in an H2 would corrupt the document outline and the table of
 * contents built from it.
 *
 * @see https://docs.agentblog.dev/concepts/geo-playbook*/
export interface StatProps {
  /** The number as it should read, units included. For example `2.5x` or `72.4%`. */
  readonly value: string
  /** What the number measures. A full clause reads better than a fragment. */
  readonly label: string
  // `?: T | undefined`, not `?: T`. Under `exactOptionalPropertyTypes` the plain
  // form rejects `<Stat source={maybeUndefined} />`.
  // @see components/blog/prose.tsx
  /** Who reported it. */
  readonly source?: string | undefined
  /** Where it was reported. Turns `source` into a link. */
  readonly href?: string | undefined
}

export function Stat({ value, label, source, href }: StatProps) {
  return (
    <figure className="border-border my-8 border-y py-6">
      <p className="text-foreground text-4xl font-semibold tracking-tight tabular-nums">{value}</p>
      <figcaption className="text-muted-foreground mt-2 text-sm leading-relaxed text-pretty">
        {label}
        {source !== undefined && (
          <>
            {' '}
            <span className="text-muted-foreground">
              (
              {href !== undefined ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-4"
                >
                  {source}
                </a>
              ) : (
                source
              )}
              )
            </span>
          </>
        )}
      </figcaption>
    </figure>
  )
}

export default Stat
