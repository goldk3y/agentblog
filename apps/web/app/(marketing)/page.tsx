/**
 * The landing page.
 *
 * Five sections and a close, in the order a reader forms the decision: the
 * pitch, the fact that makes the product necessary, what lands in the repo, who
 * writes the posts, what is included, and the command.
 *
 * Two rules govern the copy here. Every claim is either checkable from this page
 * or checkable against this site, and nothing is said twice. Detail that a
 * reader needs only after deciding lives in the docs, which is why this page is
 * about four hundred words rather than four thousand.
 *
 * The two `curl` panels are representative output rather than a live capture.
 * They are accurate in shape and abridged in length, which is a claim we can
 * defend. Anyone can check the right-hand one against this site.
 */
import type { Metadata } from 'next'
import Link from 'next/link'

import { CodePanel, type CodeLine } from '@/components/site/code-panel'
import { CopyCommand } from '@/components/site/copy-command'
import { FileBrowser } from '@/components/site/file-browser'
import {
  Braces,
  Eye,
  FileCode,
  FileText,
  Github,
  Palette,
  Quote,
  Rss,
  Stethoscope,
} from '@/components/site/icons'
import { InstallSwitch } from '@/components/site/install-switch'
import { Panel } from '@/components/site/panel'
import { Button } from '@/components/ui/button'
import { GITHUB_REPO_URL, formatStarCount, getStarCount } from '@/lib/github-stars'
import { getInstalledFiles } from '@/lib/installed-files'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'AgentBlog: an SEO and GEO complete blog for Next.js 16',
  description:
    'Install a Next.js 16 blog that AI crawlers can read: prerendered HTML, a connected JSON-LD graph, sitemap, RSS, IndexNow, OG images, and agent skills that write and audit posts.',
  alternates: { canonical: '/' },
}

/* -------------------------------------------------------------------------- */
/*  Layout primitives, local to this page                                     */
/* -------------------------------------------------------------------------- */

/**
 * The single content measure. Header, footer, and every section share it, so
 * every left edge on the page lines up with every other one.
 */
function Container({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-5xl px-6">{children}</div>
}

/**
 * A section with a centred header and a left-aligned body.
 *
 * Sections are separated by space rather than by rules. At this rhythm a
 * horizontal line adds a second separator to an edge that already has one, and
 * the page reads as a stack of boxes instead of a sequence of ideas.
 */
function Section({
  id,
  title,
  lead,
  children,
}: {
  id: string
  title: string
  lead: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className="py-20 sm:py-24">
      <Container>
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-heading-24 sm:text-heading-32 text-balance">{title}</h2>
          {/*
            The lead is held narrower than the heading on purpose. A centred
            paragraph needs a shorter measure than a left-aligned one to stay
            scannable, and holding it inside the heading's width keeps the two
            reading as one block rather than as two stacked elements.
          */}
          <p className="text-muted-foreground text-copy-16 mx-auto mt-4 max-w-lg text-pretty">
            {lead}
          </p>
        </div>
        <div className="mt-14">{children}</div>
      </Container>
    </section>
  )
}

/**
 * Inline code inside body copy.
 *
 * `whitespace-nowrap` because these are commands a reader is meant to copy, and
 * a command broken across a line looks like two commands.
 */
function C({ children }: { children: React.ReactNode }) {
  return (
    <code className="bg-muted text-foreground rounded-sm px-1.5 py-0.5 font-mono text-[0.9em] whitespace-nowrap">
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
  { text: '      reported that none of the major AI crawlers', tone: 'good' },
  { text: '      render JavaScript.</p>', tone: 'good' },
  { text: '      <h2 id="which-crawlers-render">Which crawlers render?</h2>', tone: 'good' },
  { text: '      <p>Googlebot renders. Bingbot renders on a delay.…', tone: 'good' },
  { text: '' },
  { text: '# 41 KB. The whole article, in one response.', tone: 'good' },
]

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * The star count is fetched at render, so the page has to refresh on a clock
 * rather than stay frozen at whatever the last deployment saw. This is the same
 * hour the blog routes use, and it is also the window `getStarCount` caches its
 * own fetch for.
 */
export const revalidate = 3600

export default async function LandingPage() {
  const installedFiles = getInstalledFiles()
  const stars = await getStarCount()

  return (
    <>
      {/* ---------------------------------------------------------------- */}
      {/*  Hero                                                            */}
      {/* ---------------------------------------------------------------- */}
      <section className="pt-20 pb-16 sm:pt-28 sm:pb-20">
        <Container>
          <div className="flex flex-col items-center text-center">
            <h1 className="text-heading-32 sm:text-heading-40 lg:text-heading-56 max-w-2xl text-balance">
              Install a blog that ranks and gets cited
            </h1>

            {/*
              Wide enough to hold both sentences on one line from `sm` up, which
              is how the lead is meant to read. `text-balance` is there for the
              narrower widths where it has to wrap.
            */}
            <p className="text-muted-foreground sm:text-copy-18 text-copy-16 mt-6 max-w-2xl text-balance">
              One command installs a complete, SEO optimized blog into your Next.js site. 100% Free
              & Open Source.
            </p>

            <div className="mt-10 w-full">
              <InstallSwitch />
            </div>

            {/*
              `rounded-md` is the 6px control step off `--radius`, not the 8px
              container step, so these read as controls beside the install pills
              rather than as small cards.
            */}
            <div className="text-copy-13 mt-10 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="https://docs.agentblog.dev"
                className="border-border text-muted-foreground hover:bg-accent hover:text-foreground inline-flex h-9 items-center gap-2 rounded-md border px-4 transition-colors"
              >
                {/* Decorative: the label beside it already names the destination. */}
                <FileText aria-hidden="true" className="size-4" />
                Documentation
              </Link>
              <Link
                href="/blog"
                className="border-border text-muted-foreground hover:bg-accent hover:text-foreground inline-flex h-9 items-center gap-2 rounded-md border px-4 transition-colors"
              >
                <Eye aria-hidden="true" className="size-4" />
                See it running
              </Link>
              {/*
                The count sits behind a rule rather than in parentheses so the
                button keeps one width when GitHub is unreachable and the count
                is absent. `tabular-nums` stops it twitching as the number grows.

                Zero is hidden as well as null. `getStarCount` already fails to
                null rather than to zero so an outage cannot invent the claim,
                but a true zero makes the same claim honestly, and a bare button
                asks for the star that a visible `0` argues against.
              */}
              <Link
                href={GITHUB_REPO_URL}
                className="border-border text-muted-foreground hover:bg-accent hover:text-foreground inline-flex h-9 items-center gap-2 rounded-md border px-4 transition-colors"
              >
                <Github aria-hidden="true" className="size-4" />
                Star on GitHub
                {stars !== null && stars > 0 && (
                  <>
                    <span aria-hidden="true" className="bg-border h-4 w-px" />
                    <span className="text-foreground tabular-nums">
                      {formatStarCount(stars)}
                      <span className="sr-only">{stars === 1 ? ' star' : ' stars'}</span>
                    </span>
                  </>
                )}
              </Link>
            </div>
          </div>
        </Container>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/*  The fact the product exists for                                 */}
      {/* ---------------------------------------------------------------- */}
      <Section
        id="what-crawlers-see"
        title="AI crawlers do not run JavaScript"
        lead="GPTBot, ClaudeBot, and PerplexityBot fetch your HTML once and read it as text. Whatever is missing from that first response is missing from the answer they write."
      >
        {/*
          `grid-cols-1` is load-bearing, not decorative. A grid with no template
          places items in one implicit column sized `auto`, whose max is
          max-content, so the panels below would size to their longest unwrapped
          line and push the whole page wider than a phone. `grid-cols-1` is
          `repeat(1, minmax(0, 1fr))`, which caps the track at the container and
          lets each `<pre>` scroll inside itself. Every grid on this page needs
          it for the same reason.
        */}
        <div className="grid grid-cols-1 items-stretch gap-8 lg:grid-cols-2">
          <CodePanel
            accent="bad"
            command='curl -sA "GPTBot" https://example.com/blog/do-ai-crawlers-run-js'
            lines={CLIENT_RENDERED}
            caption="A client-rendered blog. The article exists, but only after a bundle runs."
          />
          {/*
            The two captions are deliberately the same length. They sit under
            panels that stretch to a shared row height, so a caption that wrapped
            to one more line would push its panel's bottom edge out of line with
            the other. Restating what the panel already shows would also be the
            second time the reader is told.
          */}
          <CodePanel
            accent="good"
            command='curl -sA "GPTBot" https://agentblog.dev/blog/how-ai-search-engines-read-your-blog'
            lines={AGENTBLOG_RENDERED}
            caption="The same post on AgentBlog. Everything a crawler needs, in one response."
          />
        </div>

        <p className="text-muted-foreground text-copy-13 mt-8 text-center">
          Representative output, abridged for width. The right-hand command is real.
        </p>
      </Section>

      {/* ---------------------------------------------------------------- */}
      {/*  What lands in the repository                                    */}
      {/*                                                                  */}
      {/*  `scripts/assert-file-count.mjs` parses the digits in this        */}
      {/*  section's lead and fails the build when they stop matching what  */}
      {/*  `@agentblog/blog` actually resolves to. Reword it freely, but    */}
      {/*  keep the count in the form `76 files,`.                          */}
      {/* ---------------------------------------------------------------- */}
      <Section
        id="what-you-get"
        title="One command installs the whole blog"
        lead="76 files, and you own every one of them. No runtime package to depend on, and nothing of ours to upgrade around."
      >
        <FileBrowser files={installedFiles} initialPath="app/blog/[slug]/page.tsx" />

        {/* A caption for the panel above it, so it sits at the tighter gap. The
            paragraph below is a separate thought and keeps the section gap. */}
        <p className="text-muted-foreground text-copy-13 mt-4 text-center">
          Open any file to read the source it installs. Each preview is the first sixteen lines
          after the file header, and the whole file arrives with the install.
        </p>

        <p className="text-muted-foreground text-copy-14 mx-auto mt-8 max-w-2xl text-center">
          Already on shadcn? <C>npx shadcn@latest add @agentblog/blog</C> installs the same files,
          and <C>npx agentblog@latest doctor --fix</C> finishes the config a registry cannot reach.
        </p>
      </Section>

      {/* ---------------------------------------------------------------- */}
      {/*  Who writes the posts                                            */}
      {/* ---------------------------------------------------------------- */}
      <Section
        id="agent-layer"
        title="Your coding agent writes the posts"
        lead="Posts are MDX files in your repository. Installing AgentBlog also adds six skills and a rule block your agent reads, so it knows the format before you ask."
      >
        <Panel label=".claude/skills/" bodyClassName="grid grid-cols-1 sm:grid-cols-2">
          {SKILLS.map((skill, index) => (
            <div
              key={skill.name}
              className={cn(
                'border-border p-6',
                // Interior rules only, so the panel border is never doubled.
                index % 2 === 0 && 'sm:border-r',
                index >= 2 && 'border-t',
                index === 1 && 'border-t sm:border-t-0',
              )}
            >
              <h3 className="text-foreground text-mono-13 font-mono">{skill.name}</h3>
              <p className="text-muted-foreground text-copy-14 mt-2.5">{skill.description}</p>
            </div>
          ))}
        </Panel>
      </Section>

      {/* ---------------------------------------------------------------- */}
      {/*  What is included                                                */}
      {/* ---------------------------------------------------------------- */}
      <Section
        id="features"
        title="Everything a blog needs to get found"
        lead="Prerendering, structured data, feeds, and crawler wiring are built in. You write the posts."
      >
        <div className="grid grid-cols-1 gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <div key={feature.title}>
              {/*
                Title and body are the same size. The hierarchy is carried by
                weight and contrast, which is enough at this scale and keeps the
                six cards reading as one texture rather than six little pages.
              */}
              <div className="flex items-center gap-2">
                <feature.icon aria-hidden="true" className="text-muted-foreground size-3.5" />
                <h3 className="text-foreground text-label-14">{feature.title}</h3>
              </div>
              <p className="text-muted-foreground text-copy-14 mt-2.5">{feature.description}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ---------------------------------------------------------------- */}
      {/*  Close                                                           */}
      {/* ---------------------------------------------------------------- */}
      <section className="pb-24 sm:pb-32">
        <Container>
          <div className="flex flex-col items-start justify-between gap-8 sm:flex-row sm:items-center">
            <h2 className="text-heading-24 sm:text-heading-32 max-w-md text-balance">
              Install it in one command.
            </h2>
            <Button asChild size="lg" className="shrink-0">
              <Link href="https://docs.agentblog.dev/quickstart">Get started</Link>
            </Button>
          </div>
          <div className="mt-10 max-w-md">
            <CopyCommand command="npx agentblog@latest init" surface="closing-cta" accent />
          </div>
        </Container>
      </section>
    </>
  )
}

/* -------------------------------------------------------------------------- */
/*  Content                                                                   */
/* -------------------------------------------------------------------------- */

const SKILLS = [
  {
    name: 'agentblog-setup',
    description:
      'Finishes whatever the registry could not do on its own, then replaces the seed author, categories, and posts with yours, so the blog is about your subject and not ours.',
  },
  {
    name: 'plan-blog-content',
    description:
      'Decides what the site should be known for, mines the questions people actually search, and writes a backlog with the internal link direction already settled.',
  },
  {
    name: 'write-blog-post',
    description:
      'Writes to the format: answer capsule first, question headings, a cited statistic, comparison data in a table. It is instructed never to invent a figure or a quotation.',
  },
  {
    name: 'refresh-blog-post',
    description:
      'Re-fetches every source a post cites, checks it still says what the post says it says, and applies the smallest correct change. Nothing needed changing is a valid outcome.',
  },
  {
    name: 'agentblog-audit',
    description:
      'Fetches your deployed URL as GPTBot, checks the title landed in head, and validates the graph before you publish.',
  },
  {
    name: 'publish-blog-post',
    description:
      'Revalidates the post, the index, the sitemap, and the feed, submits to IndexNow, and reports the response code. A 403 and a 200 look identical until somebody reads the number.',
  },
] as const

const FEATURES = [
  {
    icon: FileCode,
    title: 'Prerendered HTML',
    description:
      'Every post is complete static HTML at build time. Nothing is deferred, and nothing mounts on interaction.',
  },
  {
    icon: Braces,
    title: 'Connected JSON-LD',
    description:
      'One graph per page. BlogPosting, Person, Organization, WebSite, and FAQPage, joined by @id instead of restated.',
  },
  {
    icon: Rss,
    title: 'Sitemap, Feed, IndexNow',
    description:
      'Dates come from your content, not from the deploy. Publishing pushes changed URLs to Bing, Yandex, Seznam, and Naver.',
  },
  {
    icon: Quote,
    title: 'Answer Capsules',
    description:
      'A direct answer under every heading, with no links inside it. That paragraph is the chunk a retrieval system lifts.',
  },
  {
    icon: Palette,
    title: 'Your Design System',
    description:
      'The blog reads your shadcn tokens and composes your primitives. It installs no theme, no base, and no font.',
  },
  {
    icon: Stethoscope,
    title: 'Doctor',
    description:
      'Fetches your deployed URL as five different bots and names what is missing. Run it from CI.',
  },
] as const
