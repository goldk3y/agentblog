---
title: Troubleshooting
description: The failures that actually happen, what each one looks like from the outside, and the fix.
group: Operations
order: 1
---

Almost every failure in this system is silent. That is not an accident of implementation, it is the shape of the problem: metadata in the wrong element still renders, a narrowed regex still matches, a stale cache still returns 200. So the symptom is usually "nothing is wrong and nothing is working".

Start here. If the answer is "a CDN is blocking the crawler", that has [its own page](/docs/troubleshooting-cdn), because it is the most common cause and the least visible one.

## The build fails after I edited content

This is the first thing most installs hit, and `doctor` sends you into it: it warns that the seed author roster is unedited, you edit it, `doctor` goes green, and the next `next build` fails. `doctor` reads your config, not your posts, so the two seed posts are outside what it checks.

```
[agentblog] /your-project/content/blog/how-ai-search-engines-read-your-blog.mdx is invalid:
  author: unknown author slug "editorial". Add a record with that slug to /your-project/content/authors.json, or inline the author object in this post's frontmatter.
```

Both shipped seed posts carry `author: editorial` in their frontmatter, and `editorial` is the slug of the first record in `content/authors.json`. Replacing the roster with your own record under a different slug deletes a slug two files still name.

The category version is identical in shape:

```
[agentblog] /your-project/content/blog/what-makes-an-ai-engine-cite-your-post.mdx is invalid:
  category: unknown category slug "content-strategy". Add a record with that slug to /your-project/content/categories.json, or inline the category object in this post's frontmatter.
```

`ai-search` and `content-strategy` are the two categories the seed posts name. `technical-seo` and `engineering` are not named by anything and are safe to delete.

Three ways out, in the order they are usually right:

1. **Keep the `editorial` slug and replace everything else in the record.** The slug is an internal key, never rendered and never in a URL a reader sees except `/authors/editorial`. Edit `name`, `bio`, `jobTitle`, `knowsAbout`, and `sameAs`, and nothing else has to change.
2. **Change the slug and the posts in the same commit.** Edit the `author:` line in every file under `content/blog`, and `defaultAuthor` in `agentblog.config.ts`, alongside the roster.
3. **Delete the seed posts.** They are the format specification, so read them before you do, but nothing depends on them existing.

The same trap has a quieter version. `defaultAuthor` in `agentblog.config.ts` ships as `your-name`, which is a placeholder that matches no record. It only bites the first post you write with no `author` in its frontmatter, which may be weeks later. Set it to a real slug while you are in the file.

## The article text is not in the raw HTML

```bash
curl -s -A "GPTBot" https://yoursite.com/blog/your-post | grep "a distinctive sentence"
```

No match. Causes, in the order they occur:

**Something in the render path is a client component.** Check for `'use client'` anywhere the article body is rendered. Only `TableOfContents` and `ShareButtons` are permitted to be client components, and both render meaningful content server-side first.

**Content is mounted on interaction.** An accordion or a tab set that renders children only after a click. Use `<details>` instead: it is in the HTML whether or not it is open.

**The route was not prerendered.** Check that `generateStaticParams` returns every slug and is not sliced. `agentblog doctor` does this as an AST check for `.slice(`.

**You are looking at the DevTools element inspector.** It shows the DOM after JavaScript has run. Use view source or `curl`.

## The title is inside body instead of head

```bash
curl -s -A "GPTBot" "$URL" | head -c 4000 | grep -q "<title>"
```

Fails. This means the page rendered dynamically and Next.js streamed the metadata, appending it to `<body>` instead of `<head>`.

Two fixes, and you want both.

**Structural:** prerender the post. When `generateMetadata` resolves at build time and introduces no dynamic behaviour, the metadata is in the initial HTML for everyone.

**Belt and braces:** set `htmlLimitedBots` so the AI crawlers get a blocking render. `npx agentblog doctor --fix` writes the union.

Read the value it writes carefully. It repeats the entire Next.js default list after the AI crawlers, and that is not redundancy. Setting the config **replaces** the default rather than extending it. Dropping the tail removes Googlebot, Bingbot, Applebot, Twitterbot, LinkedInBot, Slackbot, Discordbot, and facebookexternalhit from HTML-limited treatment, which trades an AI win for a live SEO and social preview regression. Any tool that writes this value has to union into whatever is already there.

## A new post is not in the sitemap or the feed

`sitemap.js`, `robots.js`, and the OG image routes are cached route handlers unless they use a request-time API. Publishing a post and revalidating only its own path leaves both stale.

The block's publish webhook revalidates `/sitemap.xml` and `/feed.xml` explicitly. If you wrote your own publish path, add them. `agentblog doctor` check 17 asserts it.

## A published post 404s or renders a fallback

Your content source publishes without a rebuild, and `generateStaticParams` has not re-run since the last deploy, so the route was never prerendered.

Check `prerenderStrategy` on your source. If publishing needs a rebuild, it should be `'deploy-hook'`, and `agentblog.config.ts` will then refuse to compile without a `deployHook`. The webhook fires the rebuild before it pings IndexNow, which is the correct order. Pinging first tells a crawler to fetch a URL that does not exist yet.

## The crawler gets stale HTML right after publishing

`revalidateTag` takes a required second argument in Next.js 16. Using `'max'` on the publish path means you invalidated nothing useful. Use `{ expire: 0 }`.

Also worth knowing: `updateTag(tag)` takes a single argument and works only in Server Actions. It throws in a route handler.

## Open Graph cards have no site name

View source on a built post and look for `og:site_name`. Missing means a segment defined `openGraph` without spreading the shared defaults.

Next.js merges metadata shallowly. Defining `openGraph` at all in a child segment discards the parent's entire `openGraph` object. Nothing errors, no validator complains, and the types are correct.

Spread `openGraphDefaults` from `lib/metadata.ts` in every segment that sets `openGraph`. Same for `robots` and `robotsDefaults`, where the loss costs you `max-snippet` and `max-image-preview`.

## The blog does not match the rest of the site

Most likely a `dark:` colour variant or a palette utility crept into a component you edited. The tokens already flip under `.dark`, so `dark:text-white` re-hardcodes the thing the token abstracts.

```bash
npx agentblog doctor
```

Check 28 reports palette utilities, colour literals, and `dark:` colour variants in the installed components. It is a warning rather than an error, because you may have done it deliberately.

If the prose specifically looks wrong, check `styles/agentblog.css` for `hsl(var(--foreground))`. Tailwind v4 shadcn stores complete `oklch()` values, so the correct form is `var(--foreground)` with no wrapper. The v3 form fails silently by producing an invalid colour that inherits.

## Article prose has no typography at all

Not "slightly off". One font size, no visible heading hierarchy, no list markers, no blockquote treatment, while the rest of the site looks right. Cards, badges, and the layout are fine, because those are Tailwind utilities in the components. Only the article body is affected, because only the article body depends on the prose layer.

You did not import the stylesheet. `styles/agentblog.css` is written to your project root by the registry and **nothing imports it for you.** Add it to your global stylesheet after the Tailwind import:

```css
@import 'tailwindcss';
@import '../styles/agentblog.css';
```

From `src/app/globals.css` the path is `../../styles/agentblog.css`, because the file lands at the project root rather than next to `app/`.

Nothing catches this. It is not a `doctor` finding, `lib/preflight.ts` does not look at your stylesheet, the build succeeds, and every crawler check still passes, because the HTML and the structured data are correct and only the presentation is missing. The one place it is mentioned during an install is the `docs` string `shadcn add` prints, which arrives in the middle of ninety lines of file paths.

The file also loads `@tailwindcss/typography`, which was installed as a dependency during `shadcn add`. If that package is missing from `package.json`, the import will fail loudly rather than silently, and reinstalling `@agentblog/blog-core` restores it.

## Turbopack warns about dynamic filesystem access

Every `next build` prints six of these, three from `lib/preflight.ts` and three from `lib/sources/mdx.ts`:

```
./lib/preflight.ts:139:10
Warning: Dynamic filesystem access causes tracing of the whole project

Static analysis determined that this filesystem access causes the whole project to be
traced and included in the output. This is usually unintentional and leads to all
source files (including the public folder) to be deployed as part of the server code.
This can slow down deployments or lead to failures when size limits are exceeded.
```

**These come from AgentBlog, not from your code, and the build succeeds.** Both files read the filesystem on purpose:

- `lib/preflight.ts` reads `next.config.*` off disk to lint it. That is the entire reason the file exists: a shadcn registry cannot patch `next.config.ts`, so something inside your app has to notice when the patch never happened. The path is `join(process.cwd(), filename)`, and the project root is not a subfolder Turbopack can scope the trace to.
- `lib/sources/mdx.ts` calls `path.resolve(process.cwd(), opts.dir)` on the content directory from your config. `opts.dir` is your value, so it cannot be a literal Turbopack can fold.

Turbopack's suggested fixes do not apply cleanly to either. "Scope the path to a subfolder" cannot work for a file that lives at the project root by definition. "Only use them in development" is already half true of `preflight`, which runs at build and dev time and returns immediately when serving production traffic, but the check is static analysis of the module graph rather than of what runs, so `preflight: false` in `agentblog.config.ts` silences the console output and not this warning.

**Is the tracing consequence real?** Yes, and it is a size and deploy-time cost rather than a correctness one. The trace decides which files ship next to your server bundle, so a whole-project trace means source files and `public/` are copied into it. On a blog that is usually a slower deploy and a larger function, not a failure. It matters when you are near a platform function size limit or your `public/` folder is large.

**What to do about it.** Nothing, unless deployment size is a real problem for you. If it is, trim the trace explicitly in `next.config.ts` rather than editing our files:

```ts
outputFileTracingExcludes: {
  '/blog/**': ['./public/**/*'],
}
```

Keys are route globs, values are globs from the project root. Exclude only what you are certain the route does not read, and note that the MDX source genuinely does read `content/blog/**` at runtime when the publish webhook regenerates `sitemap.xml` and `feed.xml`, so that directory must stay in the trace.

**This is a known issue on our side, not a settled design.** The correct fix is ours: narrowing the traced paths in both files, or annotating the calls with `/*turbopackIgnore: true*/` and declaring the real dependencies through `outputFileTracingIncludes`. Until that ships, the warning is noise you can read past.

## Build fails on the Open Graph image

`opengraph-image` has an 8MB limit and `twitter-image` has 5MB. Exceeding either fails the build rather than warning.

Read fonts and logos at module scope with `readFile` from `node:fs/promises`, not per request. A per-request read runs on every generation.

## The image optimizer returns 400

Next.js 16 rejects any `quality` not listed in `images.qualities`, and the default is `[75]`. The block uses 75 for cards and 90 for hero images, so both have to be listed.

```ts
images: {
  qualities: [75, 90]
}
```

## The preflight warning will not go away

It is telling you something. Read the line: it names the missing setting.

If your config is genuinely correct and the check is wrong, set `preflight: false` in `agentblog.config.ts`. That is the sanctioned opt-out. Deleting the import from `app/blog/layout.tsx` is not, because then nothing tells you when a later edit breaks the config again. If you believe the check is wrong, please open an issue, because a false positive here is a bug that will get the import deleted in a lot of repositories.

## IndexNow returns 403 or 422

- **403:** the key is invalid or the key file is missing. `public/<key>.txt` has to be served from your domain root, UTF-8, containing the key and nothing else. A key hosted at a subpath only authorizes URLs under that subpath.
- **422:** the submitted URL does not match the host that owns the key.

Both look identical to success from a caller that only checks whether the request completed, which is why `agentblog ping` prints the code with its meaning attached.

## agentblog init refuses to run

| Message                     | Meaning                                                                                                             |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `components.json` not found | Run `npx shadcn@latest init` first. We will not run it for you, because it picks a component base and a base colour |
| Tailwind v3 detected        | Not supported. See [Roadmap and non-goals](/docs/roadmap)                                                           |
| `app/blog` already exists   | You have a blog. `--force` overwrites it. The conflicting paths are printed                                         |
| Next.js 15 detected         | The product is built on 16-specific APIs                                                                            |

## Undoing an install

```bash
npx agentblog@latest revert              # restore the last patch set from .agentblog/backup/
npx agentblog@latest revert --all        # replay every backup, back to the original state
npx agentblog@latest uninstall           # reverse every patch, remove the AGENTS.md block
npx agentblog@latest uninstall --keep-env  # the same, but leave the two secrets in place
```

`revert` on its own restores only the most recent backup, so a second `doctor --fix` can be undone without also unwinding your `init`.

`uninstall` lists the registry-written files rather than deleting them, because by then some of them are yours.

Neither takes `--yes`, and passing it is an `unknown option` error rather than a no-op. Both are already non-interactive; `--dry-run` is how you preview either one.
