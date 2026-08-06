---
title: Configuration reference
description: Every field in agentblog.config.ts, its default, its type, and what breaks when it is wrong.
group: Reference
order: 1
---

`agentblog.config.ts` sits at your project root, next to `package.json` and `next.config.ts`, including in a `src/` layout. Next.js documents that config files stay at the root, and the registry writes this one with a `~/` target, which means project root by definition.

Exactly one module reads it: `lib/config.ts`. `agentblog doctor` enforces that, because `@/` maps to the root in a flat layout and to `src/` in a `src/` layout, so one import specifier cannot be correct in both. With one importer, fixing a `src/` project is a one-line change instead of a grep across forty files.

## Shape

```ts
import { defineConfig } from '@/lib/define-config'
import { mdxSource } from '@/lib/sources/mdx'

export default defineConfig({
  siteUrl: 'https://yourdomain.com',
  brand: {
    name: 'Your Brand',
    logo: { url: '/logo.png', width: 512, height: 512 },
    sameAs: ['https://github.com/yourbrand'],
  },
  source: mdxSource({ dir: 'content/blog' }),
})
```

Everything except `siteUrl`, `brand`, and `source` has a default.

## Why defineConfig and not satisfies

`defineConfig` is an identity function that exists for its type signature. It gives contextual inference, so the `deployHook` requirement can depend on which content source you passed. `satisfies` checks an object against a fixed type and cannot do that.

Concretely: swap `mdxSource` for a source whose `prerenderStrategy` is `'deploy-hook'` and the file stops type checking until you supply a `deployHook`. That turns a runtime surprise (publishing a post that was never prerendered, then pinging a crawler to come look at it) into a compile error. It is the highest-value thing the type layer does.

## Fields

| Field              | Type                                   | Default              | Notes                                                                              |
| ------------------ | -------------------------------------- | -------------------- | ---------------------------------------------------------------------------------- |
| `siteUrl`          | `string`                               | required             | https, no trailing slash, no path. Trailing slashes are stripped before validation |
| `locale`           | `string`                               | `'en_US'`            | BCP-47. Emitted as `og:locale` and schema.org `inLanguage`                         |
| `brand.name`       | `string`                               | required             | `og:site_name` and `Organization.name`                                             |
| `brand.logo`       | `{ url, width, height }`               | required             | `width` and `height` are required, not optional                                    |
| `brand.sameAs`     | `string[]`                             | `[]`                 | Absolute URLs only. Bare handles are rejected at build time                        |
| `source`           | `ContentSource`                        | required             | See [Content sources](/docs/content-sources)                                       |
| `deployHook`       | `string`                               | none                 | Required, at compile time, when the source needs a rebuild to publish              |
| `revalidate`       | `number`                               | `3600`               | ISR window in seconds for blog routes                                              |
| `postsPerPage`     | `number`                               | `12`                 | Index pagination                                                                   |
| `noindexTagsBelow` | `number`                               | `5`                  | Tag pages under this post count get `robots: { index: false }`                     |
| `indexnow`         | `{ enabled, key? }`                    | `{ enabled: false }` | Key is 8 to 128 characters                                                         |
| `verification`     | `{ google?, yandex?, yahoo?, other? }` | `{}`                 | Maps straight to Next.js `metadata.verification`                                   |
| `aiAccess`         | `{ train?, search?, agent? }`          | all `true`           | Emitted into `robots.txt`                                                          |
| `preflight`        | `boolean`                              | `true`               | Build-time config linting                                                          |
| `trailingSlash`    | `boolean`                              | `false`              | Must match `next.config.ts`                                                        |
| `defaultAuthor`    | `string`                               | none                 | Author slug used when a post omits one                                             |

Unknown keys are ignored rather than rejected, so an invented field is silently dead. Change values, not structure.

### siteUrl

Every canonical link, sitemap entry, RSS `<link>`, and schema.org `@id` is composed from this string, so a wrong value is wrong in about forty places at once. Point it at the domain readers actually visit, not at a preview deployment.

A trailing slash produces `https://site.dev//blog/post` in every canonical, so it is stripped and the value is re-validated before use. Never build a URL by concatenating onto `config.siteUrl`. Use `absoluteUrl`, `postUrl`, `categoryUrl`, `tagUrl`, and `authorUrl` from `lib/config.ts` instead. They are the only place that knows the trailing-slash policy and the rule that paths ending in a file extension never take one.

### brand.logo

`width` and `height` are required because Google's Organization markup needs both, and a logo without dimensions is one of the most common structured data errors on the web. A relative `url` resolves against `siteUrl`.

### brand.sameAs

The single most valuable property in the file. It maps to `Organization.sameAs`, which is how a search engine or an AI assistant resolves "the company that published this" to a real entity rather than a string that happens to look like a company name. Entity resolution is what lets a model cite you by name and attribute the claim correctly.

List profiles a third party can verify. LinkedIn, Crunchbase, GitHub, YouTube, and Wikidata carry the most weight. `@yourbrand` is rejected, because a handle disambiguates nothing.

### deployHook

Required when your content source declares `prerenderStrategy: 'deploy-hook'`. Set it to a rebuild trigger URL so the publish webhook can rebuild before pinging IndexNow. Publishing in the other order tells a crawler to fetch a URL that was never prerendered.

### noindexTagsBelow

Thin tag pages are the classic way a blog generates hundreds of near-empty indexable URLs and spends its own crawl budget on them. Categories are always indexable; tags have to earn it. Set it to `0` to index every tag.

### indexnow

```ts
indexnow: { enabled: true, key: process.env.INDEXNOW_KEY }
```

`lib/indexnow.ts` reads the config key first and falls back to `process.env.INDEXNOW_KEY`, so the secret never has to live in this committed file. The matching `<key>.txt` must be served from your domain root, UTF-8, containing the key and nothing else, or every submission comes back 403. A key hosted at a subpath only authorizes URLs under that subpath.

The limit is 10,000 URLs per request, not per day.

### aiAccess

```ts
aiAccess: { train: true, search: true, agent: true }
```

A forward-looking seam. Three standards are converging on machine-readable AI usage preferences (Cloudflare's Content Signals Policy, RSL, and the IETF AIPREF draft) and all three attach to `robots.txt` or to HTTP headers. None is implemented in v1. When one lands, this same object emits it with no change to your config file.

Setting `train: false` is a real tradeoff and not a free one. Several crawlers are multi-purpose, so opting out of training can also opt you out of the search index that would have cited you.

### preflight

On by default. It reads `next.config.*` off disk once per process at build and dev time, and warns when required settings are missing or narrowed. It never throws, and it is a no-op at request time.

Set it to `false` only once you know your config is correct and you want the warning gone. That is the sanctioned opt-out. Deleting the `preflight` import from `app/blog/layout.tsx` is not, because then nothing tells you when a later edit breaks the config again.

### trailingSlash

Must match `trailingSlash` in `next.config.ts`. The URL helpers compose canonicals from this value, so two different answers means every canonical points at a URL that immediately redirects to its other form. Search engines treat that as a self-referential redirect chain and AI crawlers frequently do not follow it at all.

## Validation

`resolveConfig` runs once, at module scope in `lib/config.ts`. A bad value fails the build with a message naming the key, rather than producing `undefined` inside a JSON-LD graph three files later.

There are two config types and the distinction is load-bearing. `AgentBlogConfig` is what you write: plain strings, most keys optional. `ResolvedAgentBlogConfig` is what the blog reads: validated, branded, fully defaulted. Branding exists only on the resolved side, because a branded `siteUrl` on the input side would mean you could not write `siteUrl: 'https://x.dev'` in your own config file.
