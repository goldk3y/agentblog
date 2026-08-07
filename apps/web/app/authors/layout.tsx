/**
 * Dogfood shim. Re-exports the registry source so the demo blog and the shipped
 * block are the same modules. The full explanation is in
 * `app/blog/[slug]/page.tsx`, which is the representative shim.
 *
 * @see https://docs.agentblog.dev/reference/cli
 */
export { default } from '@/app/authors/layout'
