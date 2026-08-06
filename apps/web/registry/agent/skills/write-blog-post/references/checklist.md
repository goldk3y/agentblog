# Pre-publish checklist

Run every item. Report each as pass or fail **with the observed value**, not with a
claim that you checked it. "Title tag: 54 chars, pass" is a report. "Title checked"
is not.

Do not report the post as ready while any item fails. List the failures, say what
each would take to fix, and stop.

> **License.** This file is prose documentation, licensed CC BY 4.0. See
> `LICENSE-CONTENT` in the AgentBlog repository.

---

## Metadata

- [ ] `title` at most 60 characters (70 is the hard stop the schema enforces), with
      the primary keyword near the front. Report the character count.
- [ ] Exactly one `<h1>` on the page, and it is the post title.
- [ ] `description` between 150 and 160 characters. Report the count.
- [ ] `description` is byte-identical to `BlogPosting.description` in the JSON-LD.
- [ ] `slug` is lowercase, hyphen separated, and carries no leading date.
- [ ] The file name matches the slug. The adapter derives the slug from the file
      name, and a `slug` in frontmatter silently overrides it, so a mismatch
      publishes at a URL that does not name the file. Report both values.
- [ ] `author` and `category` name records that exist in `content/authors.json`
      and `content/categories.json`. An unknown slug fails the build.

## Structure

- [ ] Answer capsule of 40 to 60 words under the H1. Report the word count.
- [ ] Answer capsule of 40 to 60 words under each H2. Report the count for each.
- [ ] No hyperlinks inside any capsule.
- [ ] Every H2 is in question format.
- [ ] Every H2 and H3 has a stable, lowercase, hyphenated `id`.
- [ ] Table of contents present if the post exceeds roughly 1,200 words.
- [ ] Each H2 section is 150 to 300 words and makes complete sense read in
      isolation.
- [ ] Entity names are repeated rather than replaced with pronouns across section
      boundaries.
- [ ] Heading levels descend without skipping (no H2 followed directly by H4).

## Evidence

- [ ] At least one statistic with a real number, cited to a source that was actually
      fetched. Name the source in the report.
- [ ] At least one quotation from a named source, cited. Name the source.
- [ ] Every statistic and quotation appears in `citations[]` with a `url` and a
      `kind`.
- [ ] No number in the post is unattributed. Report any that are.
- [ ] Comparison or specification data is in a real markdown table, not narrated in
      prose.
- [ ] Every chart or diagram image is paired with its underlying numbers in a table
      nearby.

## Links

- [ ] 5 to 15 contextual internal links in the body. Report the count.
- [ ] Anchor text is descriptive and names the target topic. No "click here", no
      "read more".
- [ ] At least one inbound internal link was **added to an existing post** pointing
      at this one. Name the post that was edited.
- [ ] `relatedPosts` is populated with slugs that exist.
- [ ] No internal link resolves through a redirect. Single hop or none.

## Frontmatter and schema

- [ ] `datePublished` and `dateModified` are ISO 8601 with a UTC offset.
- [ ] `dateModified` is greater than or equal to `datePublished`.
- [ ] `dateModified` matches the visible `<time dateTime>` and the JSON-LD exactly.
      Three sources of the same date is three chances to disagree.
- [ ] `author` and `category` resolve to real entries in the roster and the taxonomy.
- [ ] `heroImage` has a `heroAlt` that describes what the image shows in plain
      language.
- [ ] `BlogPosting`, `Person`, `WebPage`, and `BreadcrumbList` nodes are all present
      in one `@graph`, linked by `@id`.
- [ ] `FAQPage` is present only if the FAQ questions render visibly in the article.
- [ ] Every marked-up fact is visible on the page.
- [ ] The graph validates in the Rich Results Test and the Schema Markup Validator,
      **against the raw HTML** rather than the rendered DOM.

## Rendering and crawlers

- [ ] `curl -s -A "GPTBot" "$URL"` returns a distinctive sentence from the article
      body. Quote the sentence you tested with.
- [ ] `curl -s -A "GPTBot" "$URL" | head -c 4000` contains `<title>`, meaning the
      title landed in `<head>` and not in `<body>`.
- [ ] The same fetch returns HTTP 200 for `GPTBot`, `ClaudeBot`, `PerplexityBot`,
      `OAI-SearchBot`, and `Googlebot`. A 403 or a challenge page is a CDN blocking
      you, and it is a blocking failure, not a warning.
- [ ] No article body content is behind a JavaScript-mounted accordion or tab.
- [ ] Hero image renders through `next/image` with explicit `width` and `height`.

## Copy style

- [ ] Zero em dash characters in the post, the frontmatter, and the alt text. Zero
      double hyphens used as a dash.
- [ ] None of: "delve", "leverage", "robust", "seamless", "landscape", "tapestry".
- [ ] No "in today's fast-paced world" opener or any variant of it.
- [ ] No "it's not just X, it's Y" construction.
- [ ] No rhetorical question answered in the same paragraph. (Question-format H2
      headings are required and are not this.)
- [ ] No three-item list where two items carry the meaning.
- [ ] No section padded to reach a length target.

## Publish

- [ ] `revalidatePath` called for the post, the index, the category, and the author
      pages, plus `/sitemap.xml` and `/feed.xml`.
- [ ] IndexNow ping fired, and the response code reported. `200` is submitted, `202`
      is accepted with key validation pending, `403` means the key is invalid or
      missing, and `422` means the URL and host do not match. `403` and `422` look
      identical to success from the caller's side, so report the actual code.
- [ ] Lighthouse: LCP at or under 2.5s, INP at or under 200ms, CLS at or under 0.1.
