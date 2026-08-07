/**
 * Layout for every route under `/authors`.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS FILE EXISTS AT ALL
 * ---------------------------------------------------------------------------
 * It does exactly one job: emit the `Organization` and `WebSite` nodes.
 *
 * Both the article graph and the person graph reference those two nodes by
 * `@id`. `BlogPosting.publisher` and `Person.worksFor` both point at
 * `{siteUrl}/#organization`, and `WebPage.isPartOf` points at
 * `{siteUrl}/#website`. An `@id` reference is a pointer, not a definition, so
 * something rendered on the page has to define what it points at. If nothing
 * does, the reference dangles: the graph still validates, because a validator
 * cannot know what a missing node was supposed to contain, and it still means
 * nothing, because the publisher and the employer resolve to no entity.
 *
 * `app/blog/layout.tsx` does this for everything under `/blog`. `/authors`
 * lives outside `/blog` and therefore inherits none of it, which left the one
 * page whose entire purpose is entity resolution emitting a `Person` whose
 * `worksFor` resolved to nothing.
 *
 * ---------------------------------------------------------------------------
 * WHAT BREAKS IF YOU CHANGE IT
 * ---------------------------------------------------------------------------
 * - Deleting this file returns `/authors/[slug]` to a dangling `worksFor`.
 * - Moving `buildOrgGraph()` into your root layout instead means every blog page
 *   emits the two nodes twice, once from here or from `app/blog/layout.tsx` and
 *   once from the root. Two nodes sharing an `@id` make the graph ambiguous.
 *   Pick one place per route subtree.
 * - Do not add `openGraph` or `robots` here. Metadata merging is shallow, so
 *   defining either at this level replaces the root layout's entire object and
 *   silently drops `og:site_name`. The author page builds its metadata through
 *   `@/lib/metadata`, which spreads the shared defaults.
 *
 * No `'use client'`, and no wrapper markup: the author page supplies its own
 * content column so this layout stays a pure structured-data carrier.
 *
 * @see https://docs.agentblog.dev/reference/files
 * @see app/blog/layout.tsx, which makes the same decision for `/blog`
 */
import { JsonLd } from '@/components/blog/json-ld'
import { buildOrgGraph } from '@/lib/schema'

export default function AuthorsLayout({ children }: LayoutProps<'/authors'>) {
  return (
    <>
      <JsonLd nodes={buildOrgGraph()} />
      {children}
    </>
  )
}
