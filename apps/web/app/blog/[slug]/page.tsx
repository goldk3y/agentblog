/**
 * ===========================================================================
 * DOGFOOD SHIM. THIS IS THE REPRESENTATIVE ONE. READ IT ONCE.
 * ===========================================================================
 * Every file under `apps/web/app/blog/**`, `apps/web/app/authors/**`, and the
 * SEO routes beside them is a re-export exactly like this one, and each of those
 * files points back here rather than repeating the explanation.
 *
 * `apps/web/tsconfig.json` maps `"@/*"` to `["./registry/blog/*", "./*"]`, so
 * `@/app/blog/[slug]/page` resolves into the registry source: the same file the
 * registry ships to a consumer. The blog running on agentblog.dev is therefore
 * literally the same modules a consumer installs, not a copy that resembles
 * them. Drift between the demo and the product is impossible rather than merely
 * unlikely.
 *
 * Three things to know before editing any shim.
 *
 * 1. **Never add logic to a shim.** The moment one of these files does something
 *    the shipped file does not, the guarantee above is gone and the demo starts
 *    lying about the product. If agentblog.dev needs behaviour the block does
 *    not have, that belongs in a route the block does not own.
 *
 * 2. **Re-export every function export, not just the default.** Next.js reads
 *    `generateStaticParams` and `generateMetadata` off the module it loads for
 *    the route. A missing name is not an error, it is a route that silently
 *    loses its static params or its metadata.
 *
 * 3. **Route segment config is the one exception, and it has to be copied.**
 *    `revalidate`, `dynamicParams`, `dynamic`, `runtime`, and `maxDuration` are
 *    parsed statically from the route file at build time, and Next.js rejects a
 *    re-export outright: "Next.js can't recognize the exported `revalidate`
 *    field in page. It mustn't be reexported." So those literals are restated
 *    below and have to match the source file. It is the one place drift is
 *    possible, so keep the copied block short and keep the comment pointing at
 *    the file it mirrors.
 *
 * @see https://docs.agentblog.dev/reference/cli
 */
export { default, generateMetadata, generateStaticParams } from '@/app/blog/[slug]/page'

/* Mirrors the segment config in `registry/blog/app/blog/[slug]/page.tsx`. */
export const revalidate = 3600
export const dynamicParams = true
