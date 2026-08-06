import next from '@agentblog/eslint-config/next'

/**
 * The shared Next.js flat config, unmodified.
 *
 * That is the point. `next build` stopped running ESLint in Next.js 16, so
 * `pnpm --filter fixture-next16 lint` is a separate CI step, and what it lints
 * is the code the registry just installed. Adding a rule override here would
 * make the fixture's lint weaker than the one a consumer runs, which is the only
 * lint result that matters.
 *
 * `.next` is ignored because it is build output. `next-env.d.ts` is not listed:
 * this app has no `registry/` directory, so unlike `apps/web` there is nothing
 * here that needs a second config block.
 */
export default [{ ignores: ['.next/**'] }, ...next]
