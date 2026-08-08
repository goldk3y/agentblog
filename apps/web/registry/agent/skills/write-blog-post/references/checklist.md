# Pre-publish checklist

**Run `npx agentblog audit <slug> --verbose` first.** This file holds only what that
command cannot check: judgment, truthfulness, and anything that needs a rendered
page. Duplicating a mechanical check here would give you two answers to one
question and invite you to trust the one you produced by reading.

Report each item as pass or fail **with the observed value**. "Sections: 190, 240,
310 words, one fail" is a report. "Sections checked" is not.

Do not report the post as ready while any item fails. List the failures, say what
each would take to fix, and stop.

> **License.** This file is prose documentation, licensed CC BY 4.0. See
> `LICENSE-CONTENT` in the AgentBlog repository.

---

## Evidence, which is the part that matters

- [ ] Every source in `citations[]` was **actually fetched during this session**.
      Name each one and say what it said. A citation copied from memory is a
      fabrication with a URL attached.
- [ ] Every number in the post appears in the source it is attributed to, at the
      precision stated. Quote the sentence you read it in.
- [ ] Every quotation is attributed to a named person or organisation, and appears
      on the page you fetched.
- [ ] Each `citations[].kind` matches what the source actually is:
      `peer-reviewed`, `official-docs`, `industry`, `news`, `other`.
- [ ] The evidence grade is carried in the prose as well as the frontmatter, so a
      reader knows a correlational figure is correlational.
- [ ] No claim is phrased as evidence without a source ("studies show", "experts
      agree", "it is widely believed"). Report any you removed.

## Structure and retrieval

- [ ] Each H2 section is 150 to 300 words. Report the count for each.
- [ ] Each H2 section makes complete sense read on its own, with no reliance on a
      definition, table, or antecedent from an earlier section.
- [ ] Entity names are repeated rather than replaced with pronouns across section
      boundaries.
- [ ] Heading levels descend without skipping. No H2 followed directly by an H4.
- [ ] A table of contents renders if the post exceeds roughly 1,200 words.
- [ ] Comparison or specification data is in a real markdown table, not narrated
      in prose.
- [ ] Every chart or diagram image is paired with its underlying numbers in a
      table nearby.
- [ ] No article body content sits behind a JavaScript-mounted accordion or tab.

## Frontmatter the audit cannot judge

- [ ] The file name matches the slug the post publishes at. Report both values.
      The adapter derives the slug from the file name, and a `slug` in frontmatter
      silently overrides it.
- [ ] `description` reads as a search result, not as a summary of a summary.
- [ ] `relatedPosts` names posts that genuinely belong, in the order they should
      appear.
- [ ] `faq` entries are questions a reader would actually ask, and they render
      visibly in the article. FAQ markup on invisible questions is a structured
      data policy violation.
- [ ] `heroAlt` describes what the image shows in plain language rather than
      naming keywords.
- [ ] The post is something the named author could credibly have written, given
      the `bio` and `knowsAbout` in `content/authors.json`.

## Links

- [ ] Anchor text is descriptive and names the target topic. No "click here", no
      "read more". Quote any anchor you rewrote.
- [ ] The inbound link added to an existing post reads naturally in that post
      rather than being bolted on. Name the post you edited and quote the sentence.
- [ ] No internal link resolves through a redirect. Single hop or none.

## Voice

Run the five questions at the end of `voice.md` and report each. Summarised here so
this file is complete, answered there:

- [ ] Every claim traces to something fetched.
- [ ] The named author would recognise this as their own writing.
- [ ] Every paragraph carries information, reasoning, or a necessary transition.
- [ ] No run of three sentences shares a shape.
- [ ] The post ends on a fact rather than on a flourish.

## After deploy

These need a live URL, so they belong to `agentblog-audit` and `publish-blog-post`
rather than to writing. Listed here so nobody assumes writing covered them.

- [ ] `curl -s -A "GPTBot" "$URL"` returns a distinctive sentence from the article
      body.
- [ ] The JSON-LD `@graph` validates against the **raw HTML**, not the rendered DOM.
- [ ] Core Web Vitals: LCP at or under 2.5s, INP at or under 200ms, CLS at or
      under 0.1.
