---
'agentblog': patch
---

Title the blog index "Blog", not "Your Brand blog".

The index was the only list surface that put the brand in its own title. Every
other one (a category hub, a tag page, an author page, the editorial policy)
passes a bare title and lets the root layout's `title.template` add the site
name, which `agentblog init` writes as `%s | Your Brand`. So the index shipped
"Your Brand blog | Your Brand" as its document title, in the tab, in a search
result, and in an AI citation, and an H1 reading "Your Brand blog" on a page
already sitting on that brand's domain under that brand's header.

The `/blog/opengraph-image` card had the same doubling for the same reason.
`ogCard` renders the mark from `config.brand.logo` in the top left, falling back
to the brand name as a wordmark when there is no readable logo, so a headline of
`${config.brand.name} Blog` set the brand twice on one 1200x630 image. The card
now says "Blog" under the mark. Its `alt` still names the brand, because alt text
is read without the picture.

The `Blog` JSON-LD node keeps `name: "${brand} Blog"`. That is an entity name in
a graph rather than a page title, and "Blog" alone identifies nothing.

**Upgrading:** re-install `@agentblog/blog-routes` (or run `agentblog init`
again) to pick up both files. If you had edited either title yourself, keep your
version. Social scrapers that already cached the old card keep serving it until
their own TTL expires; the card's URL does not change, so force a refetch through
the platform's own tool if you need it sooner.
