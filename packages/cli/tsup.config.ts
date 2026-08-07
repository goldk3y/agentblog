/**
 * Bundle config for the `agentblog` npm package.
 *
 * Three decisions here are load bearing.
 *
 * 1. `noExternal` inlines `@agentblog/checks` and `@agentblog/schema`. They are
 *    `workspace:*` dependencies, which npm cannot resolve for a published
 *    package (`npm install agentblog` fails outright with `Unsupported URL
 *    Type "workspace:"`), so they are bundled here and declared as
 *    devDependencies, never as dependencies. `checks` in
 *    particular is dependency free by design (see its header), which makes it
 *    free to inline. `zod` is inlined for the same reason and not by choice:
 *    `@agentblog/schema` imports it, so leaving it external would produce a
 *    bundle that imports a package the published `agentblog` does not declare.
 *
 * 2. `ts-morph` and `yaml` stay external and ship as real dependencies.
 *    ts-morph carries its own compiler build, and bundling a compiler through
 *    esbuild buys nothing but a slower publish and a larger install. Nothing
 *    imports `typescript` directly, so it is not declared at all. `yaml` is a declared dependency with no dependencies of its own,
 *    so npm resolves it for a published package and inlining it would only make
 *    the bundle harder to audit. The rule is: bundle what npm cannot resolve
 *    (`workspace:*` and anything they drag in), externalise what it can.
 *
 * 3. The banner is the shebang. `bin` points at `dist/index.js` directly, so if
 *    this line disappears the published binary stops being executable.
 *
 * 4. `src/patchers/next-config.ts` is a second entry, so
 *    `scripts/assert-patcher-parity.mjs` can import the patch function on its
 *    own. Importing `dist/index.js` instead would run commander and exit, and
 *    driving the patcher through `doctor --fix` in a scratch project makes the
 *    test depend on that project already being unpatched. A pure function with a
 *    string in and a string out is the thing we actually want to compare across
 *    two TypeScript majors.
 *
 * @see https://docs.agentblog.dev/reference/cli
 */
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/patchers/next-config.ts'],
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  dts: false,
  splitting: false,
  shims: true,
  treeshake: true,
  noExternal: ['@agentblog/checks', '@agentblog/schema', 'zod'],
  // The shebang lands on both entries. That is intentional and harmless: Node
  // strips a leading `#!` line from any module it loads, so the importable
  // patcher entry is unaffected, and `bin` keeps the line it needs.
  banner: { js: '#!/usr/bin/env node' },
})
