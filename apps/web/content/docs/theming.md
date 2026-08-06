---
title: Theming
description: How the blog inherits your design system, the six rules that keep it that way, and what to change when you want it to look different.
group: Reference
order: 5
---

A blog bolted onto your product should look like your product. If `/blog` arrives with its own colours, radii, and fonts, your first task after installing is undoing our design, and most people uninstall instead. That is a product requirement, and it decides several things that would otherwise be open questions.

## Rule 1: primitives are declared by bare name

```json
{ "registryDependencies": ["card", "badge", "separator", "avatar", "button"] }
```

A bare name resolves against **your** configuration: your component base (Base UI, Radix, or React Aria), your `components.json` aliases, your base colour. And because `shadcn add` will not overwrite an existing file without `--overwrite`, if you have already customized your `Card`, you keep it, and our `PostCard` composes on top of yours.

That is the inheritance mechanism, and it is free as long as nothing fights it. Namespace syntax like `@shadcn/button` means something different and is reserved for third-party registries.

## Rule 2: semantic tokens only

Permitted throughout the block: `bg-background`, `text-foreground`, `text-muted-foreground`, `bg-card`, `text-card-foreground`, `bg-muted`, `bg-primary`, `text-primary-foreground`, `bg-secondary`, `bg-accent`, `text-destructive`, `border-border`, `ring-ring`, and the `--radius` derived `rounded-*` scale.

Banned in the block: any `text-zinc-*`, `bg-gray-*`, or `border-slate-*` palette utility, any `#hex`, `rgb()`, `oklch()`, or `hsl()` literal, and any `dark:` colour variant.

The last one catches people. The tokens already flip under `.dark`. Writing `dark:text-white` re-hardcodes exactly what the token was there to abstract, and it breaks the moment your dark theme is not near-black. A component that seems to need a `dark:` colour is using the wrong token.

A CI lint runs this over the block's source. That lint is what keeps rule 2 true in month six.

## Rule 3: adding a blog installs no base, no theme, and no font

A `registry:base` item carries a style, an icon library, a base colour, and CSS variables. Applying one to an app that already has a visual identity is a request to replace that identity.

| Item                                     | Adding `/blog` to your app | Scaffolding a standalone blog |
| ---------------------------------------- | -------------------------- | ----------------------------- |
| `@agentblog/theme` (`registry:base`)     | Never installed            | Intended, not yet applied     |
| `registry:font`                          | Never                      | Intended, not yet applied     |
| Core token `cssVars` such as `--primary` | Never shipped by any item  | Only via the base             |

`@agentblog/blog` therefore has no dependency on `@agentblog/theme` at all.

Read the middle column as a design decision that the CLI has not caught up with yet. `agentblog create` scaffolds a new project and installs the blog into it, and its own `--help` says what it does not do: it does not apply `@agentblog/theme` and it does not add the standalone site items. So a freshly created blog wears the default shadcn base until you run `npx shadcn@latest add @agentblog/theme` yourself. That is a one-command gap on a new project with nothing to overwrite, which is why it is a gap rather than a bug.

One thing we cannot do and will not claim: a registry item cannot pin your primitive library. `init --base <base|radix|aria>` is a CLI flag, and `base` is not a valid `components.json` key. Whichever base your project was initialized with is the one our components compose against.

## Rule 4: our own tokens are namespaced and derived

Long-form reading genuinely needs a measure and a prose scale that shadcn does not define. Those ship as `--agentblog-` prefixed variables, each defined in terms of a token you already have:

```css
@theme inline {
  --agentblog-measure: 68ch;
  --color-agentblog-prose-body: var(--foreground);
  --color-agentblog-prose-muted: var(--muted-foreground);
  --color-agentblog-prose-rule: var(--border);
}
```

No new colours. Change your `--foreground` and the prose follows.

## Rule 5: the typography plugin is bridged, not fought

`@tailwindcss/typography` ships its own greys, which is precisely what rule 2 forbids. In Tailwind v4 the plugin is loaded with `@plugin` and customized through `--tw-prose-*` variables, so `styles/agentblog.css` is the single place long-form styling binds to your theme:

```css
@plugin '@tailwindcss/typography';

@utility prose {
  --tw-prose-body: var(--foreground);
  --tw-prose-headings: var(--foreground);
  --tw-prose-links: var(--primary);
  --tw-prose-bullets: var(--border);
  --tw-prose-hr: var(--border);
  --tw-prose-quote-borders: var(--border);
  --tw-prose-captions: var(--muted-foreground);
  --tw-prose-pre-bg: var(--muted);
  --tw-prose-th-borders: var(--border);
  --tw-prose-td-borders: var(--border);
}
```

Two consequences. `dark:prose-invert` becomes unnecessary, because the tokens already flip and the inverted palette would fight them. And there is a version trap worth stating explicitly: Tailwind v3 era shadcn stored colours as bare HSL channel triplets, so the idiom was `hsl(var(--foreground))`. Tailwind v4 shadcn stores complete `oklch()` values, so the correct form is `var(--foreground)` with no wrapper. Most blog posts and answers online still show the v3 form. It fails silently by producing an invalid colour that inherits.

## Rule 6: icons go through one file

`components/blog/icons.tsx` re-exports every icon used anywhere in the block. Swapping icon libraries costs one file rather than a grep across twelve components, and `shadcn migrate icons` handles the rest.

## Changing how it looks

Everything below is your file to edit. Nothing here is overwritten by an update unless you ask for it with `--overwrite`.

- **Colours and radii:** change your existing tokens in `globals.css`. The blog follows automatically. There is nothing blog-specific to change.
- **Reading width:** `--agentblog-measure` in `styles/agentblog.css`.
- **Prose scale:** the `@utility prose` block in the same file.
- **Card layout:** `components/blog/post-card.tsx`.
- **Article layout:** `app/blog/[slug]/page.tsx`. It is a normal Server Component.

## How we prove inheritance works

`scripts/assert-theme-conformance.mjs` runs on every CI run. It is a static source lint over `apps/web/registry/blog/**`, and it fails the build on four things:

| Rejected                                                 | Because                                                                                                            |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Any palette utility (`text-zinc-500`, `bg-gray-100`)     | Renders correctly in a neutral fixture and wrong in the one app that matters                                       |
| Any colour literal (`#hex`, `rgb()`, `hsl()`, `oklch()`) | Same, with no fixture excuse                                                                                       |
| Any `dark:` colour variant                               | The tokens already flip under `.dark`, so this re-hardcodes what the token abstracts                               |
| `hsl(var(--token))` in the CSS                           | The Tailwind v3 idiom. Under v4 it produces an invalid colour, so the property is dropped and the element inherits |

The one documented exception is `opengraph-image.tsx`, because `ImageResponse` cannot read CSS variables. The exception is encoded in the script rather than as an inline pragma.

This is a lint on the cause. Planned, not yet wired: a second fixture with a custom base colour, a large `--radius`, and a serif font, built alongside the default one, so the two snapshots can be asserted to differ. That would catch the effect. Until it exists, the lint is what we have, and it is the half that catches the mistake at the moment it is written.
