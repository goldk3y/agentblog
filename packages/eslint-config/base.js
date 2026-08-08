import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import tseslint from 'typescript-eslint'

/**
 * Shared flat config for every TypeScript package in the monorepo.
 *
 * `next lint` was removed in Next.js 16 and `next build` no longer lints, so
 * every app and package has to run ESLint explicitly, including the installed
 * files in the fixture.
 */
export default tseslint.config(
  { ignores: ['dist/**', '.next/**', '.turbo/**', 'node_modules/**', 'coverage/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Domain types are inferred from Zod schemas and never hand-authored.
      // See https://docs.agentblog.dev/reference/content-sources: a hand-written interface and a
      // validator always drift, and here they would drift between what we
      // validate and what we type.
      'no-restricted-syntax': [
        'error',
        {
          selector: 'TSInterfaceDeclaration[id.name=/^(Post|Author|Category|Citation|FaqEntry)$/]',
          message:
            'Domain types are inferred from Zod schemas with z.infer, never declared as interfaces. See https://docs.agentblog.dev/reference/content-sources.',
        },
      ],
    },
  },
  prettier,
)
