---
name: write-blog-post
description: >
  Writes or rewrites a blog post that generative engines cite, in a Next.js project
  running AgentBlog: answer-first capsules, question-format H2 headings,
  self-contained sections, statistics and quotations verified at a real source,
  prose that does not read as machine-written, and frontmatter that parses against
  the AgentBlog post schema. Use when asked to write a post, draft an article,
  outline a piece, add a post to the blog, rewrite a post for AI visibility, or
  make a post citable, in any project that has an agentblog.config.ts.
argument-hint: '[topic or target query]'
allowed-tools: Read Write Edit Glob Grep WebSearch WebFetch Bash(npx agentblog *)
license: MIT
compatibility: A Next.js project with AgentBlog installed. Needs web access to verify sources.
metadata:
  package: agentblog
  homepage: https://agentblog.dev
---

# Write a blog post for AI citation

This post has to survive two readers: a person deciding whether to trust it, and a
retrieval system deciding whether to quote it. The rules below serve both. They are
not style preferences, they are the shape that gets extracted.

Assume the shadcn CLI skill already covers the registry and component primitives.
Assume `node_modules/next/dist/docs/` already covers Next.js APIs. This skill covers
only what those do not: how to write the post.

## Rules you may not violate

These are in the body rather than in a reference file, because a rule you have to
fetch is a rule you will skip.

- **Never fabricate a statistic, a quotation, or a source.** If you cannot verify a
  number at a real source you have actually fetched, state the claim qualitatively
  instead ("most", "a majority of", "the largest share") and say where the
  qualitative claim comes from. Do not round an unverified number into precision.
  Do not attribute a quote to a person unless you fetched the page it appears on.
  One invented figure turns this skill from an asset into a liability, because the
  post is then worse than not publishing.
- **Never invent experience.** No anecdote, no first-person story, no "a client we
  worked with", no opinion the source material does not support, no detail added
  for texture. Writing that sounds human by inventing a human is the worst
  available outcome: it is fabrication that also reads as fabrication. Credibility
  here comes from verified evidence and a named author with a real bio.
- **Never use an em dash.** Not one. Use a comma, a colon, parentheses, or a full
  stop and a new sentence. Do not substitute a double hyphen either. The em dash is
  the most recognisable tell of machine-written prose, and a product that sells
  AI-assisted writing cannot ship copy that reads as AI-generated. This covers the
  post body, the frontmatter, the alt text, and anything else you write into the
  repository. `agentblog audit` fails the post on it.
- **Never keyword-stuff.** In the GEO paper's own results table, keyword stuffing
  scored _below_ the unoptimised baseline on Position-Adjusted Word Count. It is
  the one technique measured to make things worse.
- **Never pad to hit a word count.** Length is a proxy for completeness, not a
  target. Padding degrades the retrieval quality of every section it touches,
  because a chunk that wanders retrieves worse than a chunk that does not.

Constructions that are banned outright, with no exceptions:

- "In today's fast-paced world", or any variant of throat-clearing before the answer.
- "It's not just X, it's Y."
- A rhetorical question followed immediately by its own answer as a paragraph opener.
  (Question-format **H2 headings** are required. Rhetorical questions inside prose
  are banned. These are different things.)
- The words "delve", "leverage", "robust", "seamless", "landscape", "tapestry".
- Three-item lists where two items carry the meaning. Cut the filler item.
- "Studies show", "experts agree", "industry reports suggest". Name the source and
  link it, or cut the claim.

The full catalogue of weaker patterns is in `references/voice.md`, and step 9 is
where you work through it.

## Procedure

Copy this into your reply and check items off as you go. Steps 8 through 11 are the
ones that get skipped when the draft feels finished, which is why they are listed.

```
- [ ] 1. Read the project
- [ ] 2. Fix the target query and its sub-questions
- [ ] 3. Outline in question-format H2s
- [ ] 4. Draft answer-first
- [ ] 5. Write self-contained sections
- [ ] 6. Ground every section in evidence
- [ ] 7. Put comparison data in a real table
- [ ] 8. Wire the post into the link graph
- [ ] 9. Revise for voice
- [ ] 10. Write the frontmatter
- [ ] 11. Run agentblog audit, then the judgment checks
```

### 1. Read the project before you write

- Read `agentblog.config.ts` for `brand.name`, `siteUrl`, `locale`, and
  `defaultAuthor`.
- Read `content/authors.json` for the author roster. `author.name` is a person's
  name and nothing else: no job title, no honorific, no publisher name. `jobTitle`
  is a separate field for exactly this reason. Note the author's `bio` and
  `knowsAbout`, because the post has to be something that person could credibly
  have written.
- Read `content/categories.json` for the taxonomy.
- Glob `content/blog/*.mdx` and read the frontmatter of every existing post, plus
  the body of the closest one. You need four things: the brand voice, the category
  and cluster structure, the internal link graph (`relatedPosts` plus in-body
  links), and the house sentence rhythm.

**Categories.** `category` in frontmatter must name a `slug` that exists in
`content/categories.json`, or the build fails with `unknown category slug`. Prefer
an existing category: five to ten fixed categories is the working range, because
each one is an indexable hub page and a hub with two posts on it is a crawl
liability rather than an asset.

A fresh install ships four categories that are AgentBlog's own topics, not the
user's, so on an early post there may genuinely be no fit. When there is none, say
so, propose the new category, and add a record to `content/categories.json` in the
same change as the post:

```json
{
  "slug": "your-new-category",
  "name": "Your New Category",
  "description": "Two sentences saying what belongs in this category and what does not. The hub page is indexable, so this is published prose, and the schema rejects an empty one."
}
```

`slug` is lowercase and hyphen separated. Do not add a category you will put one
post in, and do not add one silently: name it in your report.

### 2. Fix the target query and its sub-questions

Identify the head query the post answers, then the sub-questions a reader who asked
it would ask next. Use `WebSearch` to find the real phrasing people use, from People
Also Ask boxes and forum threads, rather than the phrasing you would invent. The
sub-questions become the H2s.

Read the top two or three results that already rank. You are looking for what they
fail to answer, not for what to restate.

### 3. Outline in question-format H2s

Every H2 is a question a real person would type. Give every H2 and H3 a stable,
lowercase, hyphenated `id` derived from its text. Nest H2 then H3 with no skipped
levels. The title lives in frontmatter and renders as the page's only H1, so the
body starts at H2.

Content that a generative engine cites is about twice as likely to contain a question
mark, and 78.4% of citations tied to questions came from headings rather than body
text (Kevin Indig, 3M ChatGPT responses and 30M citations, reported by Search Engine
Land, 18 February 2026, industry and correlational). The mechanism is more convincing
than the correlation: a heading phrased as a question matches the shape of the query
the retrieval system is matching against.

### 4. Draft answer-first

- **The `answerCapsule` frontmatter field**: 40 to 60 words answering the head query
  completely. It renders under the H1. No preamble, no hyperlinks.
- **Under each H2**: a 40 to 60 word capsule answering that heading's question, then
  the supporting detail.

The capsule is what gets lifted into an answer. If it needs the paragraph after it
to make sense, it is not a capsule.

### 5. Write self-contained sections

150 to 300 words per H2 section. Each section must make complete sense read in
isolation, because retrieval systems split pages into chunks at heading boundaries
and a chunk arrives without its neighbours.

- **Repeat the entity name instead of using a pronoun.** Write "Next.js Cache
  Components", not "it". This will feel repetitive as you write and will read
  correctly to anyone who lands mid-page.
- One idea per paragraph.
- Front-load the highest-value sentence in each section so it survives truncation.
- Never rely on a table caption or a definition from two sections earlier.

### 6. Ground every section in evidence

Each post needs at least one real statistic with a real number and at least one
quotation from a named source, and both must be cited. Fetch the source. Read it.
Then write the claim.

`agentblog audit` warns when a post has neither, and errors when a post makes
statistical or quoted claims with no `citations[]` entries at all. It cannot tell
you that one claim among several is unsourced, and it can never tell you a
citation is wrong. That half is yours, and step 11 is where you report it.

Carry the evidence grade with the claim, in the prose, the way a competent editor
would: "peer-reviewed", "industry study, correlational", "vendor-reported". Record
the same grade in the `citations[].kind` frontmatter field. A reader who knows a
number is correlational trusts you more, not less.

If a source will not load or the number is not in it, do not use the number.

### 7. Put comparison data in a real table

Anything with more than two dimensions goes in a markdown table, never in prose.
Tables are associated with citation, and prose that describes a table is prose that
a retrieval system has to reconstruct.

Pair every chart or diagram image with the underlying numbers in a table nearby, so
the data is machine-readable. Text that exists only inside an image does not exist.

### 8. Wire the post into the link graph

- 5 to 15 contextual internal links in the body, with descriptive anchor text that
  names the target topic. Never "click here", never "read more". `agentblog audit`
  reports the count and fails outside that range.
- **Add at least one inbound link from an existing post** to the new post, by
  editing that post. A post with no inbound links is an orphan, and the audit fails
  on it.
- Fill `relatedPosts` with the slugs that genuinely belong, in the order they should
  appear.

### 9. Revise for voice

Read `references/voice.md` and work the draft against it. Do this after the draft
exists and before the frontmatter is final. Writing while scanning a list of
forbidden patterns produces prose that avoids them and says nothing.

The three failures that survive every other check in this skill:

- **Uniform sentence length.** Read each paragraph aloud in your head. Where three
  sentences in a row share a shape, rewrite the middle one. Do not alternate lengths
  mechanically, which is a different pattern rather than the absence of one.
- **A closing flourish.** No summary recap, no final metaphor that inflates the
  point. End on the strongest concrete thing the post established.
- **Weasel attribution.** Anything phrased as evidence that carries none.

Do not flatten the draft into uniform polish while fixing it. Leave strong sentences
alone.

### 10. Write the frontmatter

The contract is `PostFrontmatterSchema` in the AgentBlog schema package, and it
rejects the post at build time. Full field reference in `references/schema-reference.md`.

`npx agentblog new "Your Title"` scaffolds a file with the correct shape, and takes
`--slug`, `--dir`, `--author`, and `--category`. Use it rather than writing the block
from memory.

- `slug`: lowercase, hyphen separated, no slashes, **no leading date**. A date in
  the slug advertises the post's age forever. The filename is the slug: the MDX
  adapter derives it from the file name with `.mdx` removed, so
  `content/blog/do-ai-crawlers-run-javascript.mdx` publishes at
  `/blog/do-ai-crawlers-run-javascript`. A `slug` in frontmatter overrides the
  filename silently, which is how a post ends up at a URL that does not match the
  file anyone is editing. Name the file correctly and either omit `slug` or write
  the same value.
- `title`: at most 70 characters, aim for 60. Keyword near the front.
- `description`: target 150 to 160 characters. The schema's hard floor is 50, so a
  shorter one parses, and a 60-character description wastes most of the space a
  search result gives you. This must match `BlogPosting.description` exactly, so
  write it once and do not paraphrase it later.
- `answerCapsule`: the 40 to 60 word capsule from step 4.
- `datePublished` and `dateModified`: ISO 8601 **with a UTC offset**, for example
  `2026-08-06T09:30:00-04:00`. A bare `YYYY-MM-DD` is widened to midnight UTC by the
  adapter, which is a convenience rather than a licence: write the offset when the
  publish time matters. Without an offset Google reads the date in Googlebot's
  timezone, which can move a post across a day boundary.
- `author`, `category`: slugs that exist in the roster and the taxonomy. The adapter
  hydrates them, and an unknown slug fails the build.
- `tags`, `relatedPosts`, `citations`, `faq`: fill them. They default to empty, so
  the schema will not remind you.
- `heroImage` requires `heroAlt`. The alt text describes what the image shows in
  plain language. It is not a keyword slot.

### 11. Run the audit, then the judgment checks

```bash
npx agentblog audit <slug> --verbose
```

That command is the mechanical half of the gate and it is not optional. It checks
capsule presence and length, links inside capsules, question headings, heading ids,
title and description lengths, date offsets and ordering, evidence presence,
internal link counts, broken internal links, orphan status, hero alt text, and copy
style, and reports observed values. Do not restate any of it by reading.

It exits non-zero on an error and zero on a warning, so read the findings rather
than the exit code. **Do not report the post as done while it reports anything at
either severity.**

Then run `references/checklist.md`, which holds only the checks a script cannot
make. Report each as pass or fail **with the observed value**, not with a claim
that you looked.

**Do not report the post as done while any item fails.** List the failures, say what
each would take to fix, and stop. A checklist you always pass is a checklist you are
not running.

## Reference material

Load these when the step that names them arrives. The rules above are the part you
always need.

| File                             | When to read it                                                                                                                                 |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `references/voice.md`            | Step 9, every time. The full pattern catalogue for the revision pass.                                                                           |
| `references/checklist.md`        | Step 11, every time. Only the checks `agentblog audit` cannot make.                                                                             |
| `references/schema-reference.md` | Step 10, and any time you are debugging the JSON-LD `@graph` the block emits.                                                                   |
| `references/geo-playbook.md`     | Choosing between techniques, or explaining to a user why a suggestion matters. Carries the verified effect sizes with the metric named on each. |

## FAQ section

If the post has genuine reader questions, add an `faq` array to the frontmatter. The
questions render visibly on the page before they are ever emitted as `FAQPage`
JSON-LD. Marking up an FAQ that is not visible on the page is a structured-data
policy violation and the most common way blogs earn one.

Do not add an FAQ section because the schema supports one. Add it because a reader
would ask those questions.
