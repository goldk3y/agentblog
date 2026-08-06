/**
 * `agentblog new <title>`: scaffold a post with correct frontmatter.
 *
 * The frontmatter this writes is the schema, exactly: ISO dates with an offset
 * (Google reinterprets an offset-less date in Googlebot's own timezone), a slug
 * with no leading date (a date in the slug advertises the post's age in every
 * search result and makes an evergreen refresh look stale), and an empty answer
 * capsule that `audit` will insist on before publish.
 *
 * ===========================================================================
 * THE AUTHOR AND CATEGORY COME FROM THE PROJECT, NOT FROM A GUESS
 * ===========================================================================
 * This command used to write `author: your-name` and `category: general`.
 * Neither slug exists: the shipped roster has `editorial` and `guest-author`,
 * and the shipped taxonomy has `ai-search`, `technical-seo`,
 * `content-strategy`, and `engineering`. `lib/sources/mdx.ts` hydrates by slug
 * and then validates with `onInvalid` defaulting to `throw`, so the documented
 * flow (`new`, then `audit`, then build) passed the audit and then failed the
 * build on a value this command had invented.
 *
 * So the roster on disk is read, `config.defaultAuthor` is preferred when it
 * resolves, and when neither file is there the output says so rather than
 * emitting a slug that cannot validate.
 *
 * @see https://agentblog.dev/docs/agent-layer
 */
import { join } from 'node:path'

import { Slug } from '@agentblog/schema'

import { detectProject } from '../detect/project.ts'
import { readRosters, type Roster } from '../detect/roster.ts'
import { exists, writeFileEnsuringDir } from '../util/fs.ts'
import { note, report, success } from '../util/log.ts'

export interface NewOptions {
  readonly dir?: string
  readonly slug?: string
  readonly author?: string
  readonly category?: string
  readonly cwd?: string
}

export function newCommand(title: string, options: NewOptions): void {
  const project = detectProject(options.cwd ?? process.cwd())
  const slug = options.slug ?? slugify(title)

  // The slug rules live in `@agentblog/schema` and nowhere else. Re-deriving
  // them here would let the CLI accept a slug the build later rejects, which is
  // the exact drift the shared package exists to prevent. Note the second rule:
  // a slug beginning with a date advertises the post's age in every search
  // result and makes an evergreen refresh look stale.
  const parsed = Slug.safeParse(slug)
  if (!parsed.success) {
    report(
      'error',
      `"${slug}" is not a valid slug: ${parsed.error.issues.map((issue) => issue.message).join('; ')}`,
      'Pass --slug with a lowercase, hyphen separated value that does not begin with a date.',
    )
    process.exitCode = 1
    return
  }

  const dir = options.dir ?? (project.usesSrcDir ? 'src/content/blog' : 'content/blog')
  const path = join(project.root, dir, `${slug}.mdx`)
  if (exists(path)) {
    report('error', `${dir}/${slug}.mdx already exists.`, 'Pick a different slug.')
    process.exitCode = 1
    return
  }

  const rosters = readRosters(project, join(project.root, dir))
  const author = resolveField({
    kind: 'author',
    requested: options.author,
    preferred: rosters.defaultAuthor,
    roster: rosters.authors,
  })
  const category = resolveField({
    kind: 'category',
    requested: options.category,
    roster: rosters.categories,
  })

  const now = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
  writeFileEnsuringDir(
    path,
    template({ title, slug, now, author: author.value, category: category.value }),
  )

  success(`Created ${dir}/${slug}.mdx`)
  for (const line of [...author.notes, ...category.notes]) note(line)
  note('Fill in the answer capsule: 40 to 60 words, a direct answer, no links.')
  note('Fill in the description: target 150 to 160 characters, hard floor 50, hard ceiling 160.')
  note(`Then run: npx agentblog audit ${slug}`)
}

/**
 * Which slug to write, and what to say about it.
 *
 * An empty value is written when nothing resolves, and the note says why. That
 * is deliberately not the same as writing a plausible looking slug: an empty
 * field is obviously unfinished to both a human and an agent, whereas
 * `category: general` looks done and fails four steps later.
 */
function resolveField(input: {
  readonly kind: 'author' | 'category'
  readonly requested?: string | undefined
  readonly preferred?: string | null
  readonly roster: Roster
}): { readonly value: string; readonly notes: string[] } {
  const { kind, requested, preferred, roster } = input
  const notes: string[] = []

  if (requested) {
    if (roster.slugs.length > 0 && !roster.slugs.includes(requested)) {
      notes.push(
        `The ${kind} "${requested}" is not in ${roster.path}. The build will reject it. Known: ${roster.slugs.join(', ')}.`,
      )
    }
    return { value: requested, notes }
  }

  if (preferred) return { value: preferred, notes }

  const first = roster.slugs[0]
  if (first) {
    notes.push(`Set ${kind}: ${first} from ${roster.path}. Change it if that is the wrong one.`)
    return { value: first, notes }
  }

  const why = (roster.problem ?? `no ${kind} records were found`).replace(/\.\s*$/, '')
  notes.push(`Left ${kind} empty: ${why}. Fill it in before you build, or it will not validate.`)
  return { value: '', notes }
}

function template(input: {
  title: string
  slug: string
  now: string
  author: string
  category: string
}): string {
  const { title, slug, now, author, category } = input
  return `---
slug: ${slug}
title: ${JSON.stringify(title)}
description: ""
answerCapsule: ""
datePublished: ${now}
dateModified: ${now}
author: ${author}
category: ${category}
tags: []
draft: true
citations: []
faq: []
---

## ${questionHeading(title)}

Answer the question in the first sentence, then qualify it. Repeat the entity
name rather than using a pronoun, so this section stands alone when it is
retrieved on its own.

## How does it work?

Each section is self contained. A reader who lands here from a link, and a model
that retrieves this chunk alone, both get a complete answer.

## What does the data say?

Every number needs a source link in the same paragraph, and every quotation
needs a named speaker. Add them to the citations frontmatter as well.

<Faq
  items={[
    { question: "", answer: "" },
  ]}
/>
`
}

/**
 * `What is <title>?`, without doubling punctuation the title already carries.
 *
 * A title of "What is GEO?" produced "## What is What is GEO??", which a writer
 * then has to notice and fix on every single post. A title that is already a
 * question is used as the heading unchanged.
 */
function questionHeading(title: string): string {
  const trimmed = title.trim().replace(/[?!.]+$/, '')
  if (/^(what|why|how|when|where|who|which|is|are|do|does|can|should)\b/i.test(trimmed)) {
    return `${trimmed}?`
  }
  return `What is ${trimmed}?`
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
