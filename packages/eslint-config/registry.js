import nextConfig from './next.js'

/**
 * Extra rules that apply only to `apps/web/registry/**`, the source of truth for
 * every file AgentBlog writes into a consumer's repository.
 *
 * The mechanical theme-conformance check (no palette utilities, no colour
 * literals, no `dark:` colour variants) lives in
 * `scripts/assert-theme-conformance.mjs` because it scans className strings,
 * which is cheaper and more reliable outside the type-aware linter. These rules
 * cover the things ESLint sees better than a regex does.
 */
export default [
  ...nextConfig,
  {
    rules: {
      // The shipped block runs in a consumer's repository and may only depend on
      // packages declared on its registry item. Importing from our workspace
      // would produce a module the consumer does not have.
      // See https://agentblog.dev/docs/content-sources.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@agentblog/*'],
              message:
                'Files shipped into a consumer repository cannot import workspace packages. Shared code is copied in by scripts/codegen.mjs instead. See https://agentblog.dev/docs/content-sources.',
            },
          ],
        },
      ],
    },
  },
]
