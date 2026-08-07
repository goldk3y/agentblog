# agentblog

## 0.2.0

### Minor Changes

- [`86a3f11`](https://github.com/goldk3y/agentblog/commit/86a3f11e2280d05788a8b1b573f963d657c8fae8) Thanks [@goldk3y](https://github.com/goldk3y)! - Rebuild the design system of the installed blog: one spacing rule, three layout
  rails, and a reading measure that is actually 66 characters.

  The block looked fine in a browser and measured badly. Four composition points
  had no spacing at all, so the category pills sat flush against the post grid and
  the byline sat flush against the table of contents, both at zero pixels, on
  every install. Every route also shared one 768px column, which gave the index a
  three-column grid of 224px cards.

  **Spacing is now compositional.** No component in the block sets its own outer
  margin. Pages stack their children in a flex column with a gap, so a component
  that is missing from a layout is visibly missing rather than silently flush
  against its neighbour. The roles and the two gap constants live in the new
  `components/blog/type-scale.ts`, which is the file to open to restyle the whole
  blog at once.

  **Three rails replace the single column.** `--agentblog-measure` for reading,
  `--agentblog-rail` for card grids, and `--agentblog-article` for an article page
  at `xl`, where the contents list moves out of the flow into a sticky margin rail
  and stops eating the first screen. Every container is written
  `mx-auto w-full max-w-(--rail) px-6`, the ordinary Tailwind container, so the
  blog lines up with a host header and footer written the same way.

  **The measure was wrong and is now measured.** `68ch` produced 84 characters per
  line, because `ch` is the width of the digit zero rather than of an average
  character. The reading column is 39rem at a 17px reading size, which measures 66.

  Three latent bugs went with it:

  - `--agentblog-*` were declared in `@theme inline`, which never emits the
    variable, so every `max-w-(--agentblog-measure)` in the block resolved to
    nothing and fell back to full width. It was invisible because `prose` sets its
    own max-width from the same value, inlined at build time.
  - The typography plugin's table margin rendered as a 28px strip inside the
    border of every table, because the scroll wrapper traps it.
  - The typography plugin's `::before` and `::after` put literal backticks around
    every inline code span, inside a chip that already said "code".

  Also: post cards are a whole-card click target with a hover state and a
  single-line meta row, category pills read as filter controls rather than as
  labels, the answer capsule is a standfirst rather than the fifth identical grey
  panel on the page, and exactly one in-article surface is filled so the rest can
  form a hierarchy.

  Nothing about the schema, the JSON-LD, the metadata, or the route config
  changed. `agentblog init` writes 71 files rather than 70.

### Patch Changes

- [#9](https://github.com/goldk3y/agentblog/pull/9) [`7a55d62`](https://github.com/goldk3y/agentblog/commit/7a55d621570147460c07da0f0b0517b2969b3eaf) Thanks [@goldk3y](https://github.com/goldk3y)! - Point every documentation link at docs.agentblog.dev.

  The documentation moved to its own site, so the URLs the CLI prints and the
  `@see` references in the files it installs now name the page they mean rather
  than a path that redirects. `agentblog.dev/docs/*` still resolves: every old
  page has a permanent redirect to its new URL.

- [`e82b2e3`](https://github.com/goldk3y/agentblog/commit/e82b2e3982f872932b40c2dc140ccc8b2f8708e2) Thanks [@goldk3y](https://github.com/goldk3y)! - Declare every file the content source reads in `outputFileTracingIncludes`, not
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
