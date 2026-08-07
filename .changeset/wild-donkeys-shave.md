---
'agentblog': patch
---

Declare every file the content source reads in `outputFileTracingIncludes`, not
just the posts directory.

`mdxSource` reads `dir`, `authorsFile`, and `categoriesFile`, and the two roster
files sit beside the posts directory rather than inside it. The patcher declared
only the posts directory, so a deployment shipped the posts and left the authors
behind. Post pages kept serving because they are prerendered, while `/blog`
returned a 500 with `ENOENT ... content/authors.json`, because it reads
`searchParams` and therefore renders on demand.

The route key widened from `/blog/**` to `/**` at the same time. `sitemap.xml`,
`feed.xml`, `/authors/[slug]`, and `/api/publish` all read content too, and
naming routes one at a time makes the next one that does a 500 nobody wrote
down.

`agentblog doctor --fix` repairs an existing install. It adds the new entry and
reports the older `/blog/**` one as redundant rather than deleting it.
