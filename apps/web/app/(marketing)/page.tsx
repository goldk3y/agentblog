/**
 * The landing page.
 *
 * The structure follows the argument, not a template: state the pitch, then show
 * the one comparison that makes it concrete, then explain each mechanic behind
 * it, then explain the install honestly including the part that needs a second
 * command.
 *
 * The two `curl` panels are labelled as representative output rather than a live
 * capture. They are accurate in shape and abridged in length, which is a claim
 * we can defend. Anyone can check the right-hand one against this site.
 */
import type { Metadata } from 'next'
import Link from 'next/link'

import { CodePanel, type CodeLine } from '@/components/site/code-panel'
import { CopyCommand } from '@/components/site/copy-command'
import { ArrowRight } from '@/components/site/icons'

export const metadata: Metadata = {
  title: 'AgentBlog: an SEO and GEO complete blog for Next.js 16',
  description:
    'Install a Next.js 16 blog that AI crawlers can read: prerendered HTML, a connected JSON-LD graph, sitemap, RSS, IndexNow, OG images, and agent skills that write and audit posts.',
  alternates: { canonical: '/' },
}

/* -------------------------------------------------------------------------- */
/*  Layout primitives, local to this page                                     */
/* -------------------------------------------------------------------------- */

function Section({
  id,
  eyebrow,
  title,
  lead,
  children,
  bordered = true,
}: {
  id: string
  eyebrow: string
  title: string
  lead?: string
  children: React.ReactNode
  bordered?: boolean
}) {
  return (
    <section id={id} className={bordered ? 'border-border border-t' : undefined}>
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
        <p className="text-muted-foreground font-mono text-xs tracking-wider uppercase">
          {eyebrow}
        </p>
        <h2 className="mt-4 max-w-3xl font-serif text-3xl leading-[1.15] font-semibold tracking-tight text-balance sm:text-4xl">
          {title}
        </h2>
        {lead !== undefined && (
          <p className="text-muted-foreground mt-5 max-w-2xl text-base leading-relaxed sm:text-lg">
            {lead}
          </p>
        )}
        <div className="mt-12">{children}</div>
      </div>
    </section>
  )
}

function Mechanic({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-border border-t pt-5">
      <h3 className="text-foreground text-sm font-semibold tracking-tight">{title}</h3>
      <p className="text-muted-foreground mt-2.5 text-sm leading-relaxed">{children}</p>
    </div>
  )
}

/** Inline code inside body copy. */
function C({ children }: { children: React.ReactNode }) {
  return (
    <code className="bg-muted text-foreground rounded-sm px-1.5 py-0.5 font-mono text-[0.85em]">
      {children}
    </code>
  )
}

/* -------------------------------------------------------------------------- */
/*  The comparison, as data                                                   */
/* -------------------------------------------------------------------------- */

const CLIENT_RENDERED: readonly CodeLine[] = [
  { text: '<!doctype html>', tone: 'muted' },
  { text: '<html lang="en">', tone: 'muted' },
  { text: '  <head>', tone: 'muted' },
  { text: '    <meta charset="utf-8" />', tone: 'muted' },
  { text: '    <meta name="viewport" content="width=device-width" />', tone: 'muted' },
  { text: '    <link rel="stylesheet" href="/assets/index-a1c9f2.css" />', tone: 'muted' },
  { text: '  </head>', tone: 'muted' },
  { text: '  <body>', tone: 'muted' },
  { text: '    <div id="root"></div>', tone: 'bad' },
  { text: '    <script type="module" src="/assets/index-7f2b04.js"></script>', tone: 'bad' },
  { text: '  </body>', tone: 'muted' },
  { text: '</html>', tone: 'muted' },
  { text: '' },
  { text: '# 412 bytes. No title, no description, no article.', tone: 'bad' },
]

const AGENTBLOG_RENDERED: readonly CodeLine[] = [
  { text: '<!doctype html>', tone: 'muted' },
  { text: '<html lang="en">', tone: 'muted' },
  { text: '  <head>', tone: 'muted' },
  { text: '    <title>Do AI crawlers run JavaScript? | AgentBlog</title>', tone: 'good' },
  { text: '    <meta name="description" content="No. GPTBot, ClaudeBot,', tone: 'good' },
  { text: '      and PerplexityBot fetch HTML once and parse it as text." />', tone: 'good' },
  { text: '    <link rel="canonical" href="https://agentblog.dev/blog/…" />', tone: 'good' },
  { text: '    <script type="application/ld+json">{"@context":', tone: 'good' },
  { text: '      "https://schema.org","@graph":[{"@type":"BlogPosting",…', tone: 'good' },
  { text: '  </head>', tone: 'muted' },
  { text: '  <body>', tone: 'muted' },
  { text: '    <article>', tone: 'muted' },
  { text: '      <h1>Do AI crawlers run JavaScript?</h1>', tone: 'good' },
  { text: '      <p>No. Vercel and MERJ instrumented AI crawler', tone: 'good' },
  { text: '      traffic across Vercel’s network over a month and', tone: 'good' },
  { text: '      reported plainly that none of the major AI crawlers', tone: 'good' },
  { text: '      render JavaScript.</p>', tone: 'good' },
  { text: '      <h2 id="which-crawlers-render">Which crawlers render?</h2>', tone: 'good' },
  { text: '      <p>Googlebot renders. Bingbot renders on a delay.…', tone: 'good' },
  { text: '' },
  { text: '# 41 KB. The whole article, in one response.', tone: 'good' },
]

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

export default function LandingPage() {
  return (
    <>
      {/* ---------------------------------------------------------------- */}
      {/*  Hero                                                            */}
      {/* ---------------------------------------------------------------- */}
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-6xl px-5 pt-20 pb-24 sm:px-8 sm:pt-28 sm:pb-32">
          <p className="text-muted-foreground font-mono text-xs tracking-wider uppercase">
            Next.js 16 · React 19 · Tailwind v4 · shadcn/ui
          </p>

          <h1 className="mt-6 max-w-4xl font-serif text-4xl leading-[1.08] font-semibold tracking-tight text-balance sm:text-6xl">
            Everything a Next.js blog needs to rank and to get cited.
          </h1>

          <p className="text-muted-foreground mt-7 max-w-2xl text-lg leading-relaxed">
            Search and AI answers are the two organic channels nearly everyone knows they should
            have, and almost nobody sets up properly. AgentBlog does the prerendering, the metadata,
            the structured data, the sitemap, the feed, and the crawler wiring, and hands you the
            source. Posts are files in your repository, so your coding agent can write and maintain
            them.
          </p>

          <div className="mt-10 max-w-xl">
            <CopyCommand command="npx agentblog@latest init" size="lg" />
            <p className="text-muted-foreground mt-4 text-sm">
              Already on shadcn? <C>npx shadcn@latest add @agentblog/blog</C> installs the files,
              then <C>npx agentblog@latest doctor --fix</C> finishes the config.
            </p>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
            <Link
              href="/docs/installation"
              className="text-brand inline-flex items-center gap-1.5 font-medium hover:underline"
            >
              Read the install guide
              <ArrowRight className="size-3.5" />
            </Link>
            <Link href="/registry" className="text-muted-foreground hover:text-foreground">
              Browse the registry
            </Link>
            <Link href="/blog" className="text-muted-foreground hover:text-foreground">
              See it running
            </Link>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/*  The demonstration                                               */}
      {/* ---------------------------------------------------------------- */}
      <Section
        id="what-crawlers-see"
        eyebrow="The demonstration"
        title="What an AI crawler actually receives"
        lead="GPTBot, ClaudeBot, and PerplexityBot fetch your HTML once and do not execute JavaScript. Whatever is missing from that first response is missing from the answer they write. Here is the same article on two blogs."
      >
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-8">
          <CodePanel
            accent="bad"
            command='curl -sA "GPTBot" https://example.com/blog/do-ai-crawlers-run-js'
            lines={CLIENT_RENDERED}
            caption="A client-rendered blog. The article text exists, but it arrives after a JavaScript bundle runs, and no major AI crawler runs one. View source, not the DevTools element inspector, which shows you the post-JavaScript DOM."
          />
          <CodePanel
            accent="good"
            command='curl -sA "GPTBot" https://agentblog.dev/blog/how-ai-search-engines-read-your-blog'
            lines={AGENTBLOG_RENDERED}
            caption="The same post on AgentBlog. Title, description, canonical, and the full JSON-LD graph inside head, with the article body in the same response. Nothing is deferred and nothing is mounted on interaction."
          />
        </div>

        <p className="text-muted-foreground mt-10 max-w-2xl text-sm leading-relaxed">
          Both panels are representative output, abridged for width. They are accurate in shape
          rather than captured live. The right-hand command is real: run it and grep for a sentence
          you can see on the page.
        </p>
      </Section>

      {/* ---------------------------------------------------------------- */}
      {/*  Manifest                                                        */}
      {/* ---------------------------------------------------------------- */}
      <Section
        id="what-you-get"
        eyebrow="The install"
        title="70 files, and you own every one of them"
        lead="That is what resolving @agentblog/blog through its dependency graph writes. shadcn puts them in your repository. There is no runtime package to depend on, no framework of ours to upgrade around, and nothing stopping you from deleting the parts you do not want."
      >
        <div className="grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {MANIFEST.map((group) => (
            <div key={group.heading}>
              <h3 className="text-foreground font-mono text-xs tracking-wider uppercase">
                {group.heading}
              </h3>
              <ul className="text-muted-foreground mt-4 space-y-1.5 font-mono text-xs leading-relaxed">
                {group.files.map((file) => (
                  <li key={file} className="truncate">
                    {file}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      {/* ---------------------------------------------------------------- */}
      {/*  Mechanics                                                       */}
      {/* ---------------------------------------------------------------- */}
      <Section
        id="mechanics"
        eyebrow="The hard part"
        title="Why this is difficult, and what specifically we do about it"
        lead="No single item below is hard. The difficulty is that there are dozens of them and about half fail silently, so you find out months later when nothing ranks and nothing cites you. These are the twelve that carry the most weight."
      >
        <div className="grid gap-x-10 gap-y-8 md:grid-cols-2">
          <Mechanic title="Prerendered HTML in the first response byte">
            <C>generateStaticParams</C> returns every slug, never a slice and never a page of them,
            so every post is complete static HTML at build time. No Suspense fallback in the article
            path and no content mounted on interaction. No client component withholds content from
            the HTML either: the two that exist, <C>TableOfContents</C> and <C>ShareButtons</C>,
            render their full markup server-side, and hydration only adds scroll state.
          </Mechanic>

          <Mechanic title="The htmlLimitedBots union">
            Next.js streams metadata into <C>&lt;body&gt;</C> for dynamically rendered pages, and
            exempts a built-in list of bots that cannot execute JavaScript. GPTBot, ClaudeBot, and
            PerplexityBot are not on that list. Setting the config <em>replaces</em> the default
            rather than extending it, so the CLI writes the union and refuses to narrow it.
            Narrowing costs you Googlebot, Bingbot, and every social preview.
          </Mechanic>

          <Mechanic title="A connected JSON-LD graph">
            One <C>ld+json</C> block per page carrying BlogPosting, Person, Organization, WebSite,
            WebPage, BreadcrumbList, and FAQPage, joined by <C>@id</C> instead of restated. Typed
            with <C>schema-dts</C>, serialized in exactly one function, and escaped so a value
            containing markup cannot close the script tag early.
          </Mechanic>

          <Mechanic title="A sitemap built from real content dates">
            <C>lastModified</C> comes from each post&apos;s <C>dateModified</C>, never from{' '}
            <C>new Date()</C>. A sitemap claiming every page changed on every deploy teaches a
            crawler to stop reading the field.
          </Mechanic>

          <Mechanic title="RSS, discoverable the way Next.js expects">
            A route handler emitting RSS 2.0, linked from the root layout through{' '}
            <C>alternates.types</C>. The publish webhook revalidates the feed and the sitemap as
            well as the post routes, because both are cached route handlers and a new post otherwise
            never reaches either.
          </Mechanic>

          <Mechanic title="IndexNow, with the failure codes surfaced">
            Publishing submits changed URLs to IndexNow, which Bing, Yandex, Seznam, and Naver
            consume. A <C>403</C> for an invalid key and a <C>422</C> for a host mismatch look
            identical to success from the caller&apos;s side, so they are reported rather than
            swallowed.
          </Mechanic>

          <Mechanic title="Open Graph images, per post">
            Site-level and per-post <C>opengraph-image.tsx</C>, with fonts and logos read at module
            scope rather than on every request. Next.js enforces its 8MB limit as a build error, not
            a warning, which is worth knowing before you embed a font file in one.
          </Mechanic>

          <Mechanic title="Answer capsules">
            A direct 40 to 60 word answer under the H1 and under each H2, containing no links. That
            paragraph is the chunk a retrieval system lifts, and a link inside it fragments the
            chunk. The audit measures the length rather than trusting it.
          </Mechanic>

          <Mechanic title="Question headings with stable anchors">
            Every H2 and H3 carries a stable <C>id</C>. The table of contents is real anchor links
            rendered server-side, and the FAQ is a <C>&lt;details&gt;</C> element. Neither mounts
            conditionally, so both are in the HTML a crawler reads.
          </Mechanic>

          <Mechanic title="Real tables">
            Comparison and specification data goes in a <C>&lt;table&gt;</C> rather than a
            paragraph. The MDX component map ships one that stays readable at narrow widths by
            scrolling inside its own container instead of widening the page.
          </Mechanic>

          <Mechanic title="E-E-A-T surfaces that resolve to something">
            A linked author page emitting <C>Person</C>, <C>rel=&quot;author&quot;</C> on the
            byline, visible <C>&lt;time dateTime&gt;</C> values that match the JSON-LD exactly, and
            an <C>/editorial-policy</C> page with a corrections policy skeleton. Marked-up facts
            that are not visible on the page are the most enforced structured data violation there
            is.
          </Mechanic>

          <Mechanic title="A preflight check that makes silence loud">
            The blog layout imports a build-time check that reads your <C>next.config.ts</C> off
            disk and names what is missing, on every <C>next dev</C> and every build. It warns and
            never throws, because failing someone&apos;s production build over a config lint gets
            the import deleted. <C>preflight: false</C> is the sanctioned way to turn it off.
          </Mechanic>
        </div>
      </Section>

      {/* ---------------------------------------------------------------- */}
      {/*  Agent layer                                                     */}
      {/* ---------------------------------------------------------------- */}
      <Section
        id="agent-layer"
        eyebrow="The agent layer"
        title="Your coding agent already knows how to write for this"
        lead="Posts are MDX files in your repository, which is the only reason any of this works. Installing AgentBlog also writes four skills into .claude/skills/ and a ten-rule block into your AGENTS.md, which every agent tool that reads that file will pick up."
      >
        <div className="grid gap-8 md:grid-cols-2">
          <div>
            <h3 className="text-foreground font-mono text-sm font-semibold">write-blog-post</h3>
            <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
              The writing playbook: answer capsule first, question headings, entity names repeated
              instead of pronouns, at least one cited statistic and one named-source quotation,
              comparison data in a table. The instruction never to invent a statistic or a quotation
              sits in always-loaded context, not in a reference file it might not read. Its
              reference playbook carries the URL, the publisher, the date, and the metric for every
              figure it quotes, and a list of the well-known figures we removed because we could not
              retrieve their sources.
            </p>
          </div>
          <div>
            <h3 className="text-foreground font-mono text-sm font-semibold">refresh-blog-post</h3>
            <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
              Re-fetches every source a post cites, checks whether it still says what the post says
              it says, and applies the smallest correct change. It moves <C>dateModified</C> only
              when the content actually changed, because a date that moves on every deploy teaches
              every consumer of that field to ignore it. &ldquo;Nothing needed changing&rdquo; is a
              successful outcome, and it is instructed to say so and stop.
            </p>
          </div>
          <div>
            <h3 className="text-foreground font-mono text-sm font-semibold">agentblog-setup</h3>
            <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
              Reads the install state and finishes whatever the registry could not do on its own:
              patches <C>next.config.ts</C> and the root layout, fills in <C>agentblog.config.ts</C>
              , then verifies with <C>agentblog doctor</C>. It exists so that a registry-only
              install converges on a correct one without the user knowing that was a question.
            </p>
          </div>
          <div>
            <h3 className="text-foreground font-mono text-sm font-semibold">agentblog-audit</h3>
            <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
              The pre-publish gate, run deliberately rather than opportunistically. It fetches the
              deployed URL as GPTBot and greps for a distinctive sentence, checks that{' '}
              <C>&lt;title&gt;</C> landed in <C>&lt;head&gt;</C>, validates the graph against
              Google&apos;s structured data policies, and flags dates that disagree with the
              frontmatter.
            </p>
          </div>
        </div>

        <p className="text-muted-foreground mt-10 max-w-2xl text-sm leading-relaxed">
          The same four skills ship as a Claude Code plugin, so you can install them without
          touching your Next.js app: <C>/plugin marketplace add goldk3y/agentblog</C> then{' '}
          <C>/plugin install agentblog@agentblog</C>.
        </p>
      </Section>

      {/* ---------------------------------------------------------------- */}
      {/*  Two-layer install                                               */}
      {/* ---------------------------------------------------------------- */}
      <Section
        id="install"
        eyebrow="How it installs"
        title="Two layers, and the honest reason there are two"
        lead="A shadcn registry can write files and install npm dependencies. It cannot patch an existing next.config.ts, because the registry format has no patch step, no postinstall, and no scripts field. That is the entire reason the CLI exists."
      >
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="border-border rounded-xl border p-6">
            <p className="text-muted-foreground font-mono text-xs tracking-wider uppercase">
              Layer 1
            </p>
            <CopyCommand
              command="npx shadcn@latest add @agentblog/blog"
              className="bg-background mt-4"
            />
            <p className="text-muted-foreground mt-5 text-sm leading-relaxed">
              Writes the files and installs the dependencies. Fetches inspectable JSON from a URL
              you can read first, supports <C>--dry-run</C> and <C>--diff</C>, and will not
              overwrite a component you have already customized. You can also take one piece:{' '}
              <C>@agentblog/blog-schema</C> for the JSON-LD builders alone.
            </p>
          </div>
          <div className="border-border rounded-xl border p-6">
            <p className="text-muted-foreground font-mono text-xs tracking-wider uppercase">
              Layer 2
            </p>
            <CopyCommand command="npx agentblog@latest init" className="bg-background mt-4" />
            <p className="text-muted-foreground mt-5 text-sm leading-relaxed">
              Patches <C>next.config.ts</C> and <C>app/layout.tsx</C> with AST edits rather than
              regex, writes <C>agentblog.config.ts</C>, generates an IndexNow key, and finishes by
              running <C>doctor</C>. It backs up every file it touches to <C>.agentblog/backup/</C>{' '}
              and prints the diff before applying it. It calls <C>shadcn add</C> internally, so this
              is layer 1 with the config work done.
            </p>
          </div>
        </div>

        <div className="border-border bg-muted/40 mt-8 rounded-xl border p-6">
          <h3 className="text-foreground text-sm font-semibold">
            If you skip the CLI, the failure is invisible
          </h3>
          <p className="text-muted-foreground mt-3 max-w-3xl text-sm leading-relaxed">
            An unpatched <C>next.config.ts</C> gives you a blog that looks completely correct and
            serves <C>&lt;title&gt;</C> inside <C>&lt;body&gt;</C> to the crawlers that matter most.
            Shipping that quietly is not acceptable, so four independent things tell you: the
            build-time preflight warning, the <C>docs</C> string that prints during install, the{' '}
            <C>agentblog-setup</C> skill, and the <C>AGENTS.md</C> block.{' '}
            <C>npx agentblog@latest doctor --fix</C> closes it in one command.
          </p>
        </div>
      </Section>

      {/* ---------------------------------------------------------------- */}
      {/*  Theming                                                         */}
      {/* ---------------------------------------------------------------- */}
      <Section
        id="theming"
        eyebrow="Theming"
        title="It inherits your design system. It does not bring one."
        lead="Installing AgentBlog changes nothing about how your app looks. The blog composes your existing shadcn primitives and reads your existing tokens, so /blog matches the rest of your product on the day you install it and keeps matching it when you retheme."
      >
        <div className="grid gap-10 md:grid-cols-2">
          <div className="text-muted-foreground space-y-4 text-sm leading-relaxed">
            <p>
              Every component is styled with shadcn&apos;s semantic tokens: <C>bg-background</C>,{' '}
              <C>text-muted-foreground</C>, <C>border-border</C>, and the <C>--radius</C> scale. No
              palette utilities, no colour literals, and no <C>dark:</C> colour variants anywhere,
              because the tokens already flip under <C>.dark</C>. A lint gate in CI keeps that true
              in month six.
            </p>
            <p>
              The primitives it composes on (<C>card</C>, <C>badge</C>, <C>separator</C>,{' '}
              <C>avatar</C>, <C>button</C>) are declared as bare names, so they resolve against your{' '}
              <C>components.json</C>, your component base, your base colour, and any of those files
              you have already edited. That is the inheritance mechanism, and it is free as long as
              we do not fight it.
            </p>
          </div>
          <div className="text-muted-foreground space-y-4 text-sm leading-relaxed">
            <p>
              Adding <C>/blog</C> to an existing app installs no base, no theme, and no font. A{' '}
              <C>registry:base</C> item carries a style, an icon library, and a base colour;
              applying one to an app that already has a visual identity is a request to replace it.
            </p>
            <p>
              Long-form reading does need a measure and a prose scale that shadcn does not define.
              Those ship as <C>--agentblog-</C> prefixed variables, each defined in terms of a token
              you already have, so they track your theme without introducing a colour of their own.
            </p>
            <p>
              If <C>agentblog init</C> finds Tailwind but no <C>components.json</C>, it refuses and
              prints the <C>shadcn init</C> command instead of running it for you. Picking a base
              colour and a component library on your behalf is exactly the thing this section exists
              to prevent.
            </p>
          </div>
        </div>
      </Section>

      {/* ---------------------------------------------------------------- */}
      {/*  Non-goals                                                       */}
      {/* ---------------------------------------------------------------- */}
      <Section
        id="non-goals"
        eyebrow="Non-goals"
        title="What v1 deliberately does not do"
        lead="Each of these is a decision with a reason, not a gap we have not got to yet."
      >
        <div className="grid gap-x-10 gap-y-8 md:grid-cols-2">
          <Mechanic title="Multi-locale routing is out">
            Full i18n means locale-prefixed routes, <C>alternates.languages</C> in both the metadata
            and the sitemap, per-locale feeds, translation linking, and locale-filtered
            prerendering. What we did take is the cheap half: four optional fields on the content
            source contract, reserved now, so adding locale later is not a breaking change to the
            one interface that has to stay stable.
          </Mechanic>

          <Mechanic title="Tailwind v3 is unsupported, and doctor errors">
            v3 stored colours as bare HSL channel triplets and v4 stores complete <C>oklch()</C>{' '}
            values, so the token bridge would need two versions and the wrong one fails silently.
            More decisively, v3 users have to pin <C>shadcn@2.3.0</C>, a CLI released before
            namespaces, <C>include</C>, <C>registry:base</C>, and the registry directory. Half of
            the install story does not function there.
          </Mechanic>

          <Mechanic title="The blog ships no llms.txt">
            Google is on record that Search does not use it, no major provider consumes it in
            production, and the best-instrumented measurement we could retrieve logged 84 requests
            to <C>/llms.txt</C> against 62,100 AI bot visits over 90 days, on a site whose average
            page saw about 265. We do serve it for <C>/docs</C>, where the readers genuinely are
            coding agents and the token saving is real, and we wrote down{' '}
            <Link href="/docs/no-llms-txt" className="text-brand hover:underline">
              why the distinction holds
            </Link>
            .
          </Mechanic>

          <Mechanic title="Monorepos are detected, not certified">
            shadcn already routes files sensibly across workspaces when each one has its own{' '}
            <C>components.json</C>, and our bare-name dependencies inherit that for free.{' '}
            <C>doctor</C> detects a workspace layout and reports where each file landed. It never
            blocks. A monorepo fixture is not in CI yet, so this is disclosed support rather than
            certified support, and{' '}
            <Link href="/docs/monorepo" className="text-brand hover:underline">
              the docs say exactly where the line is
            </Link>
            .
          </Mechanic>
        </div>
      </Section>

      {/* ---------------------------------------------------------------- */}
      {/*  Close                                                           */}
      {/* ---------------------------------------------------------------- */}
      <section className="border-border border-t">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
          <h2 className="max-w-2xl font-serif text-3xl leading-[1.15] font-semibold tracking-tight text-balance sm:text-4xl">
            Install it, then check it with curl.
          </h2>
          <div className="mt-9 max-w-xl space-y-3">
            <CopyCommand command="npx agentblog@latest init" size="lg" />
            <CopyCommand command="npx agentblog@latest doctor --url https://yoursite.com/blog" />
          </div>
          <p className="text-muted-foreground mt-6 max-w-xl text-sm leading-relaxed">
            The second command fetches your live URL as five different bots. It is the only check
            here that catches a perfectly installed blog that a CDN is quietly blocking. Run it from
            CI or from your laptop rather than from inside the deployment: the fetch starts wherever
            the CLI does, and a request from inside your own network can walk straight past the rule
            you are testing for.
          </p>
          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm">
            <Link href="/docs" className="text-brand font-medium hover:underline">
              Documentation
            </Link>
            <Link href="/docs/geo-playbook" className="text-muted-foreground hover:text-foreground">
              The GEO playbook
            </Link>
            <a
              href="https://github.com/goldk3y/agentblog"
              className="text-muted-foreground hover:text-foreground"
            >
              Source on GitHub
            </a>
          </div>
        </div>
      </section>
    </>
  )
}

/* -------------------------------------------------------------------------- */
/*  Manifest data                                                             */
/* -------------------------------------------------------------------------- */

const MANIFEST = [
  {
    heading: 'Routes',
    files: [
      'app/blog/page.tsx',
      'app/blog/[slug]/page.tsx',
      'app/blog/[slug]/opengraph-image.tsx',
      'app/blog/category/[slug]/page.tsx',
      'app/blog/tag/[slug]/page.tsx',
      'app/authors/[slug]/page.tsx',
      'app/editorial-policy/page.tsx',
    ],
  },
  {
    heading: 'SEO routes',
    files: [
      'app/sitemap.ts',
      'app/robots.ts',
      'app/feed.xml/route.ts',
      'app/opengraph-image.tsx',
      'app/not-found.tsx',
      'app/api/publish/route.ts',
    ],
  },
  {
    heading: 'Components',
    files: [
      'components/blog/answer-capsule.tsx',
      'components/blog/breadcrumbs.tsx',
      'components/blog/byline.tsx',
      'components/blog/json-ld.tsx',
      'components/blog/table-of-contents.tsx',
      'components/mdx/callout.tsx',
      'components/mdx/faq.tsx',
      'components/mdx/table.tsx',
    ],
  },
  {
    heading: 'Library',
    files: [
      'lib/config.ts',
      'lib/posts.ts',
      'lib/schema.ts',
      'lib/metadata.ts',
      'lib/render-mdx.tsx',
      'lib/indexnow.ts',
      'lib/preflight.ts',
      'lib/ai-referrers.ts',
    ],
  },
  {
    heading: 'Content and config',
    files: [
      'agentblog.config.ts',
      'content/blog/*.mdx',
      'content/authors.json',
      'styles/agentblog.css',
    ],
  },
  {
    heading: 'Agent layer',
    files: [
      '.claude/skills/write-blog-post/',
      '.claude/skills/refresh-blog-post/',
      '.claude/skills/agentblog-setup/',
      '.claude/skills/agentblog-audit/',
      'AGENTS.agentblog.md',
    ],
  },
] as const
