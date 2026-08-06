/**
 * Dogfood shim. Re-exports the registry source so the demo blog and the shipped
 * block are the same modules. The full explanation is in
 * `app/blog/[slug]/page.tsx`, which is the representative shim.
 *
 * @see https://agentblog.dev/docs/cli-reference
 */
export { default, generateMetadata } from '@/app/blog/page'

/*
 * Route segment config cannot be re-exported: Next.js parses these statically
 * at build time and rejects a re-export with "It mustn't be reexported". So
 * the values below are the only thing in this file that is copied rather than
 * referenced, and they have to match registry/blog/app/blog/page.tsx.
 */
export const revalidate = 3600
