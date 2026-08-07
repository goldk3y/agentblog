/**
 * Layout for every route under `/blog`.
 *
 * ---------------------------------------------------------------------------
 * FOR THE HUMAN MAINTAINER AND FOR THE CODING AGENT EDITING THIS FILE
 * ---------------------------------------------------------------------------
 * This layout does three jobs and deliberately nothing else:
 *
 *   1. It calls `preflight()` at module scope. That is the only place in the
 *      shipped block where a misconfigured `next.config.ts` becomes visible.
 *      Module scope means it runs once per process on `next dev` and once per
 *      compilation on `next build`, which is exactly when a config warning is
 *      still cheap to act on. Do not move the call inside the component: a
 *      prerendered route renders once and then never again, so the warning
 *      would disappear the moment the page was cached.
 *   2. It wraps the blog in a single content column so the post route does not
 *      have to know anything about the host application's shell.
 *   3. It renders the footer link to `/editorial-policy`. That page is the
 *      Trust surface in E-E-A-T, and a link from every blog page is what makes
 *      it discoverable to a crawler that only ever fetches one article.
 *
 * ---------------------------------------------------------------------------
 * THE TRAP: DO NOT ADD `title.template` HERE
 * ---------------------------------------------------------------------------
 * `title.template` applies to CHILD segments only. A template declared in
 * `app/blog/layout.tsx` does NOT apply to `app/blog/page.tsx`, because that page
 * belongs to the same segment as this layout rather than a child of it. Adding
 * it here therefore produces a brand suffix on every post and no brand suffix on
 * the blog index, which looks like a random bug and is very hard to spot in
 * review. The template belongs in the ROOT layout (`app/layout.tsx`), which
 * `agentblog init` patches for you. `title.default` is required alongside it.
 *
 * Related trap: this file must not set `openGraph` or `robots` either. Metadata
 * merging is shallow, so defining `openGraph` at any level replaces the parent's
 * entire object and silently drops `og:site_name`. The blog pages build their
 * metadata through `@/lib/metadata`, which spreads the shared defaults. If you
 * ever need layout-level metadata here, spread `openGraphDefaults` and
 * `robotsDefaults` the same way the pages do.
 *
 * ---------------------------------------------------------------------------
 * THE LANDMARK CONTRACT. READ THIS BEFORE ADDING A `<main>` ANYWHERE.
 * ---------------------------------------------------------------------------
 * **The block never renders `<main>`, and never renders a skip link. Your root
 * layout owns both.** That is the whole premise of installing this as a block:
 * the host application owns the page shell, and every route here renders into
 * whatever `app/layout.tsx` already wraps around it.
 *
 * It is a contract rather than a preference because the alternative does not
 * work. A `<main>` in a block route lands inside the host's `<main>`, which is
 * invalid HTML and gives the page two `main` landmarks, and a screen reader
 * user then has to guess which one holds the article. There is no way for a
 * route in this block to know whether the host already provided one, so the
 * only answer that is right in every install is "never".
 *
 * What you owe the block in return, in your root layout:
 *
 *   1. Exactly one `<main id="main">` wrapping the route slot.
 *   2. A skip link, `<a href="#main">Skip to content</a>`, as the first
 *      focusable element on the page. Every post route puts a breadcrumb `nav`
 *      and a table-of-contents `nav` ahead of the article body, so without a
 *      bypass mechanism a keyboard user tabs through the whole contents list to
 *      reach the prose. That is WCAG 2.4.1, and the block cannot satisfy it
 *      from inside the shell.
 *
 * Nothing checks either one for you, which is why it is written here rather
 * than left implied. The footer below is the one landmark this block does
 * contribute, and it carries an `aria-label` for the same reason the rule
 * exists: your site footer is almost certainly also a `contentinfo`, and two
 * unnamed ones are indistinguishable in a landmark list.
 *
 * No `'use client'`. Nothing under `/blog` is a client component except the two
 * components that are documented as such, and both render meaningful content on
 * the server first.
 *
 * @see https://docs.agentblog.dev/reference/files
 */
import Link from 'next/link'

import { JsonLd } from '@/components/blog/json-ld'
import { blogPath, sitePath } from '@/lib/config'
import { preflight } from '@/lib/preflight'
import { buildOrgGraph } from '@/lib/schema'

// Module scope on purpose. See the header block above.
preflight()

export default function BlogLayout({ children }: LayoutProps<'/blog'>) {
  return (
    <div className="bg-background text-foreground min-h-screen">
      {/*
       * The Organization and WebSite nodes are emitted here, from the blog
       * layout, and this placement is deliberate.
       *
       * Every article graph built by `lib/schema.ts` references these two nodes
       * by `@id`: `BlogPosting.publisher` points at the Organization and
       * `WebPage.isPartOf` points at the WebSite. If nothing on the page emits
       * them, those references dangle. The graph still validates, because a
       * validator cannot know what a missing node was supposed to contain, and
       * it still means nothing, because the publisher resolves to no entity.
       *
       * Putting them in the blog layout rather than the root layout is what
       * makes the registry-only install correct on its own. A registry can write
       * this file; it cannot patch your root layout. If you also want
       * Organization markup on your marketing pages, add `buildOrgGraph()` there
       * too, but do not add it to a layout that wraps `/blog`, or every blog page
       * will carry the same two nodes twice.
       */}
      <JsonLd nodes={buildOrgGraph()} />

      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:py-16">{children}</div>

      {/*
       * The editorial policy link ships from every blog page on purpose. An AI
       * crawler routinely fetches a single article and nothing else, so a policy
       * page linked only from the site's own navigation is invisible to it.
       *
       * `/editorial-policy` comes from the optional `@agentblog/eeat-pages`
       * item. If you chose not to install it, either install it or replace this
       * href with your own policy page. Leaving a link to a 404 here is worse
       * than having no link at all.
       */}
      {/*
       * `aria-label` is load bearing, not decoration. This `<footer>` sits
       * inside `<body>` rather than inside a `<section>` or an `<article>`, so
       * it maps to a `contentinfo` landmark, and the host application almost
       * certainly renders its own site footer as a second one. Two unnamed
       * `contentinfo` landmarks are two identical entries in a screen reader's
       * landmark list. Naming this one is what makes them tellable apart. See
       * the landmark contract at the top of this file.
       */}
      <footer aria-label="Blog" className="border-border border-t">
        {/*
         * Every internal href here comes from a `@/lib/config` path helper where
         * one exists, because those helpers are what apply `config.trailingSlash`.
         * A hardcoded `/blog` on a site configured with `trailingSlash: true`
         * links to a URL that immediately 308s to `/blog/`, on every blog page,
         * which is a self-inflicted redirect chain that AI crawlers frequently do
         * not follow at all.
         *
         * `/feed.xml` is a literal on purpose: the helpers never add a trailing
         * slash to a last segment that looks like a file, so this path is already
         * in its final form. `/editorial-policy` has no helper of its own, so it
         * is the one href on this page that a `trailingSlash: true` site has to
         * fix by hand.
         */}
        <div className="text-muted-foreground mx-auto flex w-full max-w-3xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-6 text-sm sm:px-6">
          <Link className="hover:text-foreground underline underline-offset-4" href={blogPath()}>
            All posts
          </Link>
          <Link
            className="hover:text-foreground underline underline-offset-4"
            href={sitePath('/editorial-policy')}
          >
            Editorial policy
          </Link>
          <Link className="hover:text-foreground underline underline-offset-4" href="/feed.xml">
            RSS
          </Link>
        </div>
      </footer>
    </div>
  )
}
