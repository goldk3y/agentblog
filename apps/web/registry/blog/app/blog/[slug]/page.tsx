/**
 * The blog post route. This file is the product.
 *
 * ---------------------------------------------------------------------------
 * FOR THE HUMAN MAINTAINER AND FOR THE CODING AGENT EDITING THIS FILE
 * ---------------------------------------------------------------------------
 * Everything an AI crawler ever sees of a post is the HTML this route returns in
 * its first response. GPTBot, ClaudeBot, PerplexityBot and friends do not
 * execute JavaScript, do not wait for streamed chunks, and usually fetch a page
 * exactly once. So the whole design goal here is boring and absolute: the
 * complete article, its metadata, and its JSON-LD must all be present in a
 * single static response body.
 *
 * Four things in this file are load bearing. Changing any of them silently
 * removes content from the response that a crawler actually reads. Each one is
 * commented at its own site below, but they are listed here so you see them
 * before you start editing:
 *
 *   1. `generateStaticParams` returns EVERY slug.
 *   2. `revalidate` is a numeric literal, not `config.revalidate`.
 *   3. `dynamicParams` stays `true`.
 *   4. The FAQ renders visibly, and the FAQ JSON-LD is emitted after it.
 *
 * There is no `'use client'` in this file and there must never be one. The two
 * client components in the block (`TableOfContents` and `ShareButtons`) render
 * their content on the server first and hydrate only to add scroll spy and share
 * intents on top of markup that is already in the HTML.
 *
 * @see https://docs.agentblog.dev/reference/files
 * @see https://docs.agentblog.dev/concepts/geo-playbook
 */
import type { Metadata } from 'next'
import Image from 'next/image'
import { notFound } from 'next/navigation'

import { AnswerCapsule } from '@/components/blog/answer-capsule'
import { AuthorBio } from '@/components/blog/author-bio'
import { Breadcrumbs } from '@/components/blog/breadcrumbs'
import { Byline } from '@/components/blog/byline'
import { JsonLd } from '@/components/blog/json-ld'
import { Faq, FAQ_HEADING } from '@/components/mdx/faq'
import { Prose } from '@/components/blog/prose'
import { RelatedPosts } from '@/components/blog/related-posts'
import { ShareButtons } from '@/components/blog/share-buttons'
import { TableOfContents } from '@/components/blog/table-of-contents'
import { absoluteUrl, categoryPath, postUrl } from '@/lib/config'
import { buildPostMetadata } from '@/lib/metadata'
import { renderMdx } from '@/lib/render-mdx'
import { getAllPosts, getPost, getRelatedPosts } from '@/lib/posts'
import { buildArticleGraph } from '@/lib/schema'
import type { TocEntry } from '@/lib/toc'

/*
 * ISR window in seconds. THIS MUST STAY A NUMERIC LITERAL.
 *
 * `export const revalidate = config.revalidate` does not work, and it fails in a
 * way that is easy to misread. Next.js reads route segment config twice: once by
 * evaluating the module, and once by statically reading the AST in
 * `next/dist/build/analysis/extract-const-value.js`. That AST reader accepts
 * only literals, `undefined`, array and object expressions, and template strings
 * with no interpolation. A member expression such as `config.revalidate` is
 * reported as `Unsupported node type "MemberExpression"`, which THROWS during
 * `next dev` (error E1013) and is logged as a build error in production.
 *
 * So the number is duplicated here on purpose. Keep it equal to `revalidate` in
 * `agentblog.config.ts`. `agentblog doctor` compares the two and fails when they
 * drift, because no type checker and no linter can catch this.
 */
export const revalidate = 3600

/*
 * Leave this `true`, which is also the Next.js default. It is written out rather
 * than omitted so that nobody "tidies up" by setting it to `false`.
 *
 * `dynamicParams = false` turns any slug that was not in `generateStaticParams`
 * at build time into a hard 404. Next.js does not re-run `generateStaticParams`
 * during ISR, so with a database-backed content source every newly published
 * post would 404 until the next deploy. A slow first render is strictly better
 * than a 404, especially since the publish webhook deliberately invites a
 * crawler to be that first request.
 */
export const dynamicParams = true

/**
 * Every slug. Not the most recent N, not one page of them, not a sample.
 *
 * READ THIS BEFORE YOU EDIT THE RETURN VALUE. Adding `.slice(0, 50)` or a
 * `limit` here does not make the build "faster" in any way you will be glad
 * about. It removes posts from the prerendered set. Those posts still resolve,
 * because `dynamicParams` is `true`, but they are rendered on demand, which
 * means their metadata can be streamed into `<body>` for bots on the
 * `htmlLimitedBots` list and their first byte arrives after a full render. Full
 * prerendering of every slug is the single mechanism that puts the complete
 * article in the first response byte and the metadata in `<head>`.
 *
 * If your build time is a real problem, the fix is a faster content source, not
 * fewer prerendered posts.
 */
export async function generateStaticParams() {
  const posts = await getAllPosts()
  return posts.map((post) => ({ slug: post.slug }))
}

export async function generateMetadata(props: PageProps<'/blog/[slug]'>): Promise<Metadata> {
  const { slug } = await props.params
  const post = await getPost(slug)

  // Returning `{}` lets the root layout's metadata stand for the 404 that the
  // page component is about to produce. Do not throw here.
  if (!post) return {}

  /*
   * `buildPostMetadata` is the only correct way to build metadata for a post,
   * because it is where `openGraphDefaults` and `robotsDefaults` get spread.
   *
   * Metadata merging in Next.js is SHALLOW. If you inline an `openGraph` object
   * here instead, this segment replaces the root layout's `openGraph` wholesale
   * and every post ships without `og:site_name` and `og:locale`. The same applies
   * to `robots`: defining it here without the shared defaults drops
   * `max-snippet: -1`, which is the directive that permits full snippets in AI
   * answers. Both failures are invisible to TypeScript and to every structured
   * data validator, which is precisely why the construction lives in one file.
   */
  const base = buildPostMetadata(post)

  return {
    ...base,
    /*
     * The canonical is composed by `postUrl`, never by string concatenation, so
     * that `siteUrl`, the trailing-slash policy, and the `/blog` prefix are all
     * decided in one place. `alternates` is itself a nested object, so it gets
     * the same shallow-merge treatment as `openGraph`: spread what
     * `buildPostMetadata` produced, then override only the canonical.
     */
    alternates: { ...base.alternates, canonical: postUrl(post.slug) },
  }
}

export default async function PostPage(props: PageProps<'/blog/[slug]'>) {
  // `params` is a Promise in Next.js 16 and synchronous access was removed
  // outright. The `PageProps<'/blog/[slug]'>` type comes from `next typegen`,
  // which derives it from the real route tree. Do not replace it with a
  // hand-written `{ params: Promise<{ slug: string }> }`: that keeps compiling
  // forever, including after somebody renames the segment.
  const { slug } = await props.params

  const post = await getPost(slug)

  // `getPost` returns `null` only when the post is genuinely absent. Every other
  // failure throws, which correctly fails the build rather than deploying a site
  // whose sitemap quietly lost half its URLs.
  if (!post) notFound()

  // The slug is passed as the origin so a body that fails to compile names the
  // post in the build error instead of pointing at `lib/render-mdx.tsx`.
  const [{ content, toc, faqHeadingId }, related] = await Promise.all([
    renderMdx(post.body, post.slug),
    getRelatedPosts(post, 3),
  ])

  // A table of contents on a two-heading post is noise. The guide puts the
  // threshold at roughly 1,200 words; heading count is the cheaper proxy and it
  // degrades in the right direction. The count is taken from the body headings
  // alone, before the synthetic FAQ entry below, so adding an FAQ never tips a
  // short post into having a table of contents.
  const showToc = toc.length >= 3

  /*
   * The FAQ entry is appended here rather than discovered.
   *
   * `remarkExtractToc` walks the MDX body, and `<Faq>` is rendered by this
   * route from `post.faq` in frontmatter, outside that body. So the extractor
   * cannot see the FAQ heading and never will. A reader scanning "On this page"
   * expects the FAQ to be listed, so the route contributes the one entry it
   * knows about.
   *
   * THE ID COMES FROM `renderMdx`, NOT FROM A CONSTANT. `faqHeadingId` was
   * issued by the same `github-slugger` instance that issued every body heading
   * id, after the whole body was walked, so it cannot collide with one. The
   * previous version of this line used a hardcoded `'faq'` that the slugger had
   * never seen, and a post with a body H2 titled "FAQ" shipped two
   * `<h2 id="faq">`, two `href="#faq"` entries in this list, and a "Frequently
   * asked questions" link that scrolled to the body heading.
   *
   * The same id goes to `<Faq headingId>` below. Those two uses must stay in
   * step, which is why the value is read once into a variable rather than
   * spelled out twice.
   *
   * If you add another route-level H2 below (the Sources section, say), reserve
   * its id the same way: add its text to `trailingHeadings` in
   * `lib/render-mdx.tsx` rather than inventing a literal here. Every id in this
   * list has to resolve to exactly one element on the page, or the link either
   * does nothing or goes somewhere else.
   */
  const tocEntries: readonly TocEntry[] =
    post.faq.length > 0
      ? [...toc, { id: faqHeadingId, text: FAQ_HEADING, depth: 2 } satisfies TocEntry]
      : toc

  return (
    <article>
      {/*
       * A real `<header>` for the article's title block.
       *
       * It is not decoration: `<header>` scoped inside `<article>` is a banner
       * landmark for the article itself, which is what groups the headline, the
       * answer capsule, the byline, and the breadcrumb trail into one unit for
       * a screen reader and for anything reconstructing the document outline.
       * `components/blog/byline.tsx` and `components/blog/prose.tsx` both
       * document this element by name, so do not unwrap it.
       */}
      <header>
        {/* Breadcrumb hrefs are composed by the config URL helpers, same as
            every canonical, so the visible trail and the BreadcrumbList JSON-LD
            built by `buildArticleGraph` can never disagree about a URL. The last
            crumb has no href because it is the current page. */}
        <Breadcrumbs
          trail={[
            { name: 'Home', href: absoluteUrl('/') },
            { name: 'Blog', href: absoluteUrl('/blog') },
            { name: post.category.name, href: categoryPath(post.category.slug) },
            { name: post.title },
          ]}
        />

        {/* Exactly one <h1> on this page, and it is the article headline. Every
            other heading in this file is an <h2>, and the MDX component map
            emits <h2>/<h3> with stable ids for the body. */}
        <h1 className="text-foreground mt-6 text-4xl font-semibold tracking-tight text-balance">
          {post.title}
        </h1>

        {/* The answer capsule sits directly under the H1: 40 to 60 words, the
            complete answer, no links inside it. This is the highest value block
            on the page for retrieval, because it is what survives chunk
            truncation, which is why it goes above the byline rather than below
            it. Passed as `children` rather than through the `text` prop so an
            MDX author and this route reach the component the same way. */}
        {post.answerCapsule ? <AnswerCapsule>{post.answerCapsule}</AnswerCapsule> : null}

        {/* Byline owns `rel="author"` on the author link and `<time dateTime>`
            on both dates. Those values must match the JSON-LD exactly, which
            they do because both read the same `post` object. */}
        <Byline post={post} />
      </header>

      {/* `PostSchema` already refuses a hero image without alt text, so this
          double guard is for the type checker rather than for the data. */}
      {post.heroImage && post.heroAlt ? (
        <figure className="mt-8">
          {/*
           * `preload` is deliberately NOT set here, and `priority` is deprecated
           * in Next.js 16 so it must never come back.
           *
           * The rule is that `preload` goes on an image only when that image is
           * definitively the LCP element. On this layout it is not: breadcrumbs,
           * the H1, the answer capsule, and the byline all sit above the hero, so
           * on a narrow viewport the H1 text block is usually LCP and preloading
           * the hero would compete with it for bandwidth. The Next.js docs make
           * the same point: `loading="eager"` with `fetchPriority="high"` is the
           * appropriate choice when LCP depends on viewport.
           *
           * If you measure the hero as LCP on your own layout, change
           * `loading="eager"` to `preload` and change nothing else. At most one
           * image per route may carry it.
           */}
          <Image
            alt={post.heroAlt}
            className="border-border w-full rounded-lg border"
            fetchPriority="high"
            height={630}
            loading="eager"
            sizes="(min-width: 768px) 768px, 100vw"
            src={post.heroImage}
            width={1200}
          />
          <figcaption className="text-muted-foreground mt-2 text-sm">{post.heroAlt}</figcaption>
        </figure>
      ) : null}

      {/* TableOfContents is a client component for scroll spy only. It renders
          the full list of links on the server first, so the anchors exist in the
          HTML whether or not JavaScript ever runs. */}
      {showToc ? <TableOfContents entries={tocEntries} /> : null}

      {/* The compiled MDX. `renderMdx` is the only place MDX is compiled in the
          whole block, which is what keeps the article render path free of client
          components and free of the Turbopack MDX loader restrictions. */}
      <Prose>{content}</Prose>

      {/*
       * VISIBLE FAQ. This block must stay in the rendered output.
       *
       * The FAQPage JSON-LD emitted at the bottom of this component describes
       * exactly these question and answer pairs. Google's structured data
       * policies forbid marking up content that is not visible to readers, so
       * deleting or conditionally mounting this section while leaving the schema
       * in place turns a working page into a guidelines violation.
       *
       * That is also why this is plain markup rather than an accordion that
       * mounts its children on click. CSS-hidden content is fine for crawlers;
       * JavaScript-mounted content is not.
       */}
      <Faq headingId={faqHeadingId} items={post.faq} />

      {/*
       * The FAQ is rendered from frontmatter, here, once. Do not also place a
       * `<Faq />` tag in the body of a post: the schema and the visible section
       * both read `post.faq`, and a second copy in the MDX would duplicate the
       * questions on the page while the JSON-LD still described only one set.
       */}

      {/* Outbound citations to named sources. The GEO paper measured citing
          sources as one of the few interventions with a peer-reviewed effect on
          how often a page is cited back, so these are content, not decoration. */}
      {post.citations.length > 0 ? (
        <section aria-labelledby="sources" className="mt-12">
          <h2 className="text-foreground text-2xl font-semibold tracking-tight" id="sources">
            Sources
          </h2>
          <ol className="text-muted-foreground mt-6 list-decimal space-y-2 pl-5 text-sm">
            {post.citations.map((citation) => (
              <li key={citation.url}>
                <a
                  className="hover:text-foreground underline underline-offset-4"
                  href={citation.url}
                  rel="noopener"
                >
                  {citation.name}
                </a>
                {citation.author ? <span>{`, ${citation.author}`}</span> : null}
                {citation.datePublished ? (
                  <span>
                    {', '}
                    <time dateTime={citation.datePublished}>
                      {citation.datePublished.slice(0, 10)}
                    </time>
                  </span>
                ) : null}
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {/*
       * Share controls, at the foot of the article body and above the author
       * box. The URL is composed on the server by `postUrl`, never read from
       * `window.location`: a client-side read produces a different string on
       * `localhost` and in a preview deployment, and it would leave the anchors
       * empty in the server HTML. Every target here is a real `<a href>`, so
       * this stays true with JavaScript disabled.
       */}
      <ShareButtons className="mt-12" title={post.title} url={postUrl(post.slug)} />

      {/* `postCount` is intentionally omitted here. Filling it would mean one
          `getPostsByAuthor` call per post at build time, which scales with post
          count for no reader benefit. The author page shows the count instead,
          where the query is already being made. */}
      <AuthorBio author={post.author} className="mt-8" />

      <RelatedPosts posts={related} />

      {/*
       * ONE serialization point for this page's structured data, and it is
       * placed AFTER the visible FAQ above on purpose. Script position does not
       * matter to any parser, but keeping the emit below the markup it describes
       * makes the dependency impossible to miss in review: if you delete the FAQ
       * section, you must also stop emitting FAQ markup.
       *
       * `buildArticleGraph` returns the complete connected node set for a post
       * (Article, WebPage, BreadcrumbList, the author Person, and FAQPage when
       * the post has visible FAQ entries). Do not add a second `<JsonLd>` to
       * this route: two nodes sharing an `@id` make the graph ambiguous and is
       * the most common way a valid-looking blog produces unusable structured
       * data.
       */}
      <JsonLd nodes={buildArticleGraph(post)} />
    </article>
  )
}
