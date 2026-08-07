---
'agentblog': minor
---

Rework the post header and move the dates to the foot of the article.

**The header.** The trail is `Blog > Category` now. The Home crumb is gone from
every breadcrumb in the block, because Google's breadcrumb documentation states
that a `ListItem` for the top level path is not required and the SERP prefixes
the domain regardless, so it spent the first crumb restating the address bar.
The post crumb is gone too: it repeated the H1 four lines below it, and the
trail is more useful ending at a category hub a reader can actually go to. The
blog index renders no breadcrumb on page one, where the trail would be the
single word "Blog" above an H1 that says "Blog".

`<Breadcrumbs>` decides the current page from the crumb with no `href` rather
than from the last crumb, so a trail can end at a real destination and keep it
clickable. Every existing trail ends in a crumb with no `href`, so nothing else
changes.

The H1 drops to weight 500. At 48px a 600 reads as a headline shouting over the
sentence under it; the section headings stay at 600 because at 24px they have no
size advantage to trade. The byline moved up to sit directly under the H1 as one
line, `By {author} · {n} min read`, with no clock icon beside a phrase that
already says "read" and no rule under it. The answer capsule is now typeset as
what it is, the first paragraph of the article, at the same size and leading as
the body text.

**The dates.** `datePublished` and `dateModified` render at the foot of the
article as a new `<PostDates>`, exported from `components/blog/byline.tsx`,
under the hairline that used to sit in the header. They are labelled in words
now ("Published July 28, 2026 · Updated August 5, 2026"), which is the shape
Google's byline date documentation asks for and which the old bare date under
the title was not. Both keep their `<time dateTime>` elements carrying the raw
ISO values, so the JSON-LD, the feed, and the visible page still agree
byte for byte. Publishing to Google News is the one case that wants them back
between the headline and the body; `<PostDates>` takes a `className` and sets no
position of its own so you can move it.

**A breadcrumb bug went with it.** `buildArticleGraph` used to assemble its own
trail, and it had drifted: the page rendered `Home > Blog > Category > Post`
while the `BreadcrumbList` claimed `Home > Blog > Post`, which is marked-up
navigation no reader could see. It now takes the trail as an argument, so the
route builds one array and hands it to both.

**Upgrading:** `buildArticleGraph(post)` becomes
`buildArticleGraph(post, trail)`. If you have customised `app/blog/[slug]/page.tsx`,
pass it the same array you give `<Breadcrumbs>`. The reading size also moved out
of `@utility prose` and into `--agentblog-reading-size` and
`--agentblog-reading-leading` in `styles/agentblog.css`, so the body text and
the answer capsule cannot drift apart; change the size there rather than on
`prose`.
