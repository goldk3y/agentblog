/**
 * `/editorial-policy`: the trust surface.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS PAGE SHIPS AT ALL
 * ---------------------------------------------------------------------------
 * Google's Search Quality Rater Guidelines send raters looking for exactly this
 * page when they assess a site's trustworthiness: who writes here, who checks
 * it, and what happens when something is wrong. Almost no blog has one, which is
 * precisely why having one is worth the hour. It is also the page an AI search
 * engine can cite when a user asks whether a source is reliable.
 *
 * ---------------------------------------------------------------------------
 * THIS IS A SKELETON. YOU MUST EDIT IT.
 * ---------------------------------------------------------------------------
 * Everything below is written as a real, defensible policy, not as filler, so
 * that editing it is a matter of correcting specifics rather than inventing
 * prose. But it currently describes a process that nobody has agreed to.
 *
 * Publishing it unedited is worse than not having the page: a policy that
 * describes a review process you do not run is a false trust signal, and the
 * corrections address below does not exist. Search every `EDIT:` marker in this
 * file before you ship it.
 *
 * @see https://agentblog.dev/docs/agent-layer
 */
import Link from 'next/link'
import type { ReactNode } from 'react'

import { blogPath, config } from '@/lib/config'
import { buildListMetadata } from '@/lib/metadata'

/** EDIT: a real inbox somebody reads. A corrections route nobody monitors is worse than none. */
const CORRECTIONS_EMAIL = 'corrections@example.com'

/** EDIT: bump this whenever the policy actually changes. Do not bump it for typo fixes. */
const LAST_REVIEWED = '2026-01-01'

export const metadata = buildListMetadata({
  title: 'Editorial policy',
  description: `How ${config.brand.name} researches, writes, reviews, and corrects what it publishes, and how AI is used in that process.`,
  path: '/editorial-policy',
})

interface SectionProps {
  readonly id: string
  readonly title: string
  readonly children: ReactNode
}

function Section({ id, title, children }: SectionProps) {
  return (
    <section className="border-border mt-12 border-t pt-8">
      {/* Stable id on every H2, same rule as every other page in this block. */}
      <h2 id={id} className="text-foreground text-xl font-semibold tracking-tight">
        {title}
      </h2>
      <div className="text-muted-foreground mt-4 flex flex-col gap-4 text-base leading-relaxed">
        {children}
      </div>
    </section>
  )
}

export default function EditorialPolicyPage() {
  return (
    /*
     * A `<div>`, and it must stay a `<div>`. This route renders into the host
     * application's shell, so a `<main>` here would nest inside the host's
     * `<main>`: invalid HTML, and two `main` landmarks on one page. The block
     * never renders `<main>` on any route. The full contract, including what
     * your root layout owes in return, is written at the top of
     * `app/blog/layout.tsx`.
     */
    <div className="mx-auto w-full max-w-2xl px-6 py-16">
      <h1 className="text-foreground text-3xl font-semibold tracking-tight sm:text-4xl">
        Editorial policy
      </h1>

      <p className="text-muted-foreground mt-4 text-base leading-relaxed">
        This page describes how {config.brand.name} decides what to publish, who checks it, and what
        happens when we get something wrong. It is deliberately specific, because a policy that
        cannot be checked against our actual output is not a policy.
      </p>

      <p className="text-muted-foreground mt-4 text-sm">
        Last reviewed <time dateTime={LAST_REVIEWED}>{LAST_REVIEWED}</time>
      </p>

      {/*
        Visible callout, not just a code comment. It is here so a half-finished
        policy cannot ship looking finished. Delete this whole block once you
        have replaced the placeholder text below.
      */}
      <aside
        role="note"
        className="border-border bg-muted text-foreground mt-8 rounded-lg border p-4 text-sm leading-relaxed"
      >
        <strong className="font-semibold">Template notice.</strong> This policy is the default
        shipped with the blog and has not been reviewed by anyone at {config.brand.name} yet.
        Replace the placeholder names, the review process, and the corrections address with what you
        actually do, then delete this notice. Publishing a process you do not follow is a worse
        trust signal than publishing no policy at all.
      </aside>

      <Section id="who-writes-here" title="Who writes here">
        <p>
          Every post carries a named author with a byline that links to a profile page listing their
          background, what they work on, and where else they publish. We do not publish under a
          house byline, a brand name, or an invented persona.
        </p>
        <p>
          Authors write about subjects they have direct working experience with. When a post covers
          something outside an author&rsquo;s day-to-day, we say so in the post and name the
          practitioner we checked it with.
        </p>
        <p>
          EDIT: name your actual authors here, or describe how someone becomes one. If you are a
          single-author blog, say that plainly. It is a stronger signal than implying a masthead you
          do not have.
        </p>
      </Section>

      <Section id="how-posts-are-reviewed" title="How posts are reviewed">
        <p>Before anything is published, it goes through the following:</p>
        <ol className="ml-5 flex list-decimal flex-col gap-2">
          <li>
            <span className="text-foreground font-medium">Factual review.</span> Every statistic,
            date, quotation, and product claim is traced to a primary source. Numbers that cannot be
            traced are removed rather than softened.
          </li>
          <li>
            <span className="text-foreground font-medium">Technical review.</span> Every code sample
            and command is run against the versions the post names. A post that pins a version has
            been tested on that version.
          </li>
          <li>
            <span className="text-foreground font-medium">Editorial review.</span> A second person
            reads for accuracy, structure, and whether the post answers the question it promises in
            the title.
          </li>
        </ol>
        <p>
          EDIT: if you are one person and steps two and three are the same pass, say that. Describe
          the review you run, not the review you would run with a staff of six.
        </p>
      </Section>

      <Section id="corrections" title="How we handle corrections">
        <p>
          If something here is wrong, we want to fix it, and we want the fix to be visible rather
          than quiet.
        </p>
        <p>
          Email{' '}
          <a
            href={`mailto:${CORRECTIONS_EMAIL}`}
            className="text-foreground underline underline-offset-4"
          >
            {CORRECTIONS_EMAIL}
          </a>{' '}
          with the post URL and the specific claim you are disputing. You will get a reply within
          five working days, including when the answer is that we are keeping the post as written
          and why.
        </p>
        <p>What happens next depends on what is wrong:</p>
        <ul className="ml-5 flex list-disc flex-col gap-2">
          <li>
            <span className="text-foreground font-medium">Factual error.</span> We correct the text
            and add a dated correction note at the foot of the post describing what changed. We do
            not silently edit a claim out of existence.
          </li>
          <li>
            <span className="text-foreground font-medium">Outdated but once accurate.</span> We
            update the post and change its modified date. The original claim stays visible in the
            update note where the distinction matters.
          </li>
          <li>
            <span className="text-foreground font-medium">Typo or broken link.</span> Fixed without
            a note, and without touching the modified date.
          </li>
        </ul>
        <p>
          That last rule is the one worth keeping. The modified date on a post is a freshness signal
          to both readers and search engines, and bumping it for a typo is a small lie that
          accumulates into a site whose dates mean nothing.
        </p>
      </Section>

      <Section id="how-we-use-ai" title="How we use AI in the writing process">
        <p>
          We use AI tools in this work and we would rather describe how than let you guess. What
          follows is the boundary we hold.
        </p>
        <p>
          <span className="text-foreground font-medium">We use it for:</span> research assistance
          and finding sources we then read ourselves, outlining and structural feedback, drafting
          passages a human then rewrites, editing for clarity, and generating the routine metadata
          around a post.
        </p>
        <p>
          <span className="text-foreground font-medium">We do not use it for:</span> publishing a
          draft no human has read end to end, generating statistics or quotations, inventing
          experience an author does not have, or producing citations without opening every source
          first.
        </p>
        <p>
          A named human author is accountable for every claim in every post, whatever tool helped
          produce the sentence it sits in. That accountability is the thing that does not change.
        </p>
        <p>
          EDIT: state your real boundary. An honest narrow policy beats an aspirational broad one.
        </p>
      </Section>

      <Section id="how-we-cite-sources" title="How we cite sources">
        <p>
          Claims that are not self-evident carry a link to where they came from, inline, at the
          point the claim is made. We link to the primary source rather than to coverage of it: the
          paper rather than the press release, the documentation rather than the blog post about the
          documentation.
        </p>
        <p>
          Where a source is behind a paywall we say so. Where a number comes from a vendor with an
          interest in it, we name the vendor next to the number. Where we could not verify something
          we wanted to use, we leave it out rather than hedge it into the text.
        </p>
        <p>
          Sources are dated in the post because a link to a moving document is a claim about what it
          said when we read it, not about what it says now.
        </p>
      </Section>

      <Section id="commercial-relationships" title="Commercial relationships">
        <p>
          EDIT: this section is a stub because only you know the answer. State whether you take paid
          placements, run affiliate links, accept review units, or write about products you have a
          financial interest in, and how each of those is disclosed on the page where it appears. If
          the answer is none of them, say that in one sentence. Either answer is fine; the omission
          is what costs you.
        </p>
      </Section>

      <Section id="contact" title="Contact">
        <p>
          Corrections and factual disputes:{' '}
          <a
            href={`mailto:${CORRECTIONS_EMAIL}`}
            className="text-foreground underline underline-offset-4"
          >
            {CORRECTIONS_EMAIL}
          </a>
          .
        </p>
        <p>
          Everything we publish is listed on the{' '}
          {/* `blogPath()`, not `/blog`. The helper is what applies
              `config.trailingSlash`, so a hardcoded literal links to a URL that
              308s on any site that turned the setting on. */}
          <Link href={blogPath()} className="text-foreground underline underline-offset-4">
            blog index
          </Link>
          .
        </p>
      </Section>
    </div>
  )
}
