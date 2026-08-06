---
title: SEO and GEO checklist
description: The pre-publish gate agentblog audit runs, split into what the tooling checks and what only you can.
group: Writing
order: 3
---

Run this before every post. `npx agentblog audit <slug>` automates the mechanical half and reports each item pass or fail.

## Before the first post

These are install-time and only need doing once.

- [ ] `htmlLimitedBots` in `next.config.ts` is a superset of the Next.js default list plus the AI crawlers
- [ ] `metadataBase` and `title.template` with `title.default` in the root layout
- [ ] `images.qualities` lists every quality the block actually uses
- [ ] `app/robots.ts` has the deployment guard, so preview URLs are not indexed
- [ ] `sitemap.xml` and `feed.xml` both resolve and both list real content
- [ ] Sitemap submitted to Google Search Console and Bing Webmaster Tools
- [ ] Search Console and Bing verification tokens in `agentblog.config.ts`
- [ ] IndexNow key file served from the domain root and matching `INDEXNOW_KEY`
- [ ] `Organization.sameAs` points at at least two profiles a third party can verify
- [ ] `/editorial-policy` exists and says something specific
- [ ] `npx agentblog doctor --url <a live post URL>` passes, including the Googlebot fetch

That last one is the check most people skip and the one most likely to fail. See [When your CDN blocks crawlers](/docs/troubleshooting-cdn).

## Content

- [ ] One `<h1>`, and it matches the intent of the target query
- [ ] `title` is 60 characters or fewer and reads as itself, not as a keyword string
- [ ] `description` is 150 to 160 characters and is a description, not a teaser
- [ ] Answer capsule under the H1: 40 to 60 words, direct, no links
- [ ] An answer capsule under each H2, same rules
- [ ] H2s are phrased as questions where a question is what a reader would ask
- [ ] Sections are 150 to 300 words and each stands alone
- [ ] Entity names repeated rather than replaced by pronouns
- [ ] At least one real statistic, cited
- [ ] At least one named-source quotation, cited
- [ ] Comparison or specification data is in a `<table>`, not in prose
- [ ] Five to fifteen contextual internal links
- [ ] At least one existing post now links to this one
- [ ] No keyword stuffing. It measures worse than baseline
- [ ] No em dashes, and none of the other copy tells

## Frontmatter

- [ ] `title`, `description`, `datePublished`, `dateModified`, `author`, `category`
- [ ] Dates are ISO 8601 **with an offset**
- [ ] `dateModified` changed only because the content changed
- [ ] `tags` are terms a reader would use, and there are not thirty of them
- [ ] `citations` carry a source and a kind
- [ ] `faq` entries match questions actually answered in the body

## Structured data

- [ ] Exactly one `ld+json` block, containing a connected `@graph`
- [ ] Every marked-up fact is visible on the page
- [ ] `FAQPage` present implies the FAQs render in HTML
- [ ] `author` is a linked `Person` node with `@id` and `url`, never a bare string
- [ ] `author.name` contains no job title, honorific, or publisher name
- [ ] Every `sameAs` entry is an absolute URL
- [ ] `Organization.logo` carries `width` and `height`
- [ ] `image` supplied at 16:9, 4:3, and 1:1, each at least 50,000 pixels
- [ ] Validated against the raw HTML, not the rendered DOM

Run the markup through Google's Rich Results Test for eligibility and the Schema Markup Validator for full vocabulary. They answer different questions, so the audit reports both.

## Images

- [ ] Descriptive file names, not `IMG_1234.png`
- [ ] `alt` describes what the image shows, in plain language
- [ ] Captions in a `<figcaption>` where they add context
- [ ] Every chart is paired with its underlying numbers in an HTML table nearby
- [ ] No critical text that exists only inside an image
- [ ] `preload` on at most one image, and only where it is definitively the LCP element

## The crawler check

Do this after deploying, every time.

```bash
curl -s -A "GPTBot" "$URL" | grep -q "a distinctive sentence from the article"
curl -s -A "GPTBot" "$URL" | head -c 4000 | grep -q "<title>"
```

The first asserts that the article text reaches a crawler that runs no JavaScript. The second asserts that `<title>` landed inside `<head>` rather than being appended to `<body>`, which is what happens when metadata streams.

Then the version that catches a CDN:

```bash
npx agentblog doctor --url "$URL"
```

## After publishing

- [ ] The publish webhook fired, and revalidated `/sitemap.xml` and `/feed.xml` as well as the post
- [ ] IndexNow returned 200 or 202, not 403 or 422
- [ ] The post appears in `sitemap.xml` with the right `lastModified`
- [ ] The post appears in `feed.xml`
- [ ] The canonical URL on the page matches the sitemap entry exactly, including the trailing slash

## What no tool can check

- Whether the post answers the question a reader actually has.
- Whether the statistic is true.
- Whether the quotation is real and correctly attributed.
- Whether you would link to this post from another site.

The audit will pass a post that fails all four.
