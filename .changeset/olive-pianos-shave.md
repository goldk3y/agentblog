---
'agentblog': minor
---

Move the Open Graph card from the app root to `app/blog/`, so installing a blog
no longer claims the social card for the whole domain.

**Until now `@agentblog/seo-routes` wrote `app/opengraph-image.tsx`.** In
Next.js that file is the card for every route that does not define its own,
which on a site with a landing page, a pricing page, and a blog means all three
unfurl as the blog. Nothing reported it. The build passed, the card rendered,
and the only symptom was a marketing page that shared as a blog post.

The card is now `app/blog/opengraph-image.tsx` and ships with
`@agentblog/blog-routes`, which is the item that owns the surfaces pointing at
it. Everything the block writes stays under paths it owns, and an
`app/opengraph-image.*` of your own now wins everywhere outside `/blog`.

The layout both cards render moved to `lib/og-card.tsx`. It used to be two
copies of the same JSX with a comment asking you to keep seven constants in
sync, which holds until the first time somebody changes one card and ships.
Recolouring the card is now a four line edit in one file.

The card also stopped warning in your project. Satori has no `next/image`, so
the mark is a plain `img`, and the disable for that rule used to sit in a banner
at the top of the file. `shadcn add` strips the leading comment block from every
file it installs, so the banner was present in our repo and absent in yours: the
warning could only ever appear on your side. The directive is now attached to
the line it governs, inside the JSX, where it is copied along with it.

**Upgrading:** `app/opengraph-image.tsx` is not removed for you, because by now
it may be a card you edited. Delete it to fall back to your own site card, or
keep it and it simply stops being what `/blog` points at.
