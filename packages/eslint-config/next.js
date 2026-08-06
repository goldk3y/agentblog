import next from '@next/eslint-plugin-next'

import base from './base.js'

/**
 * Flat config for Next.js apps. `@next/eslint-plugin-next` defaults to flat
 * config as of Next.js 16.
 */
export default [
  ...base,
  {
    plugins: { '@next/next': next },
    rules: {
      ...next.configs.recommended.rules,
      ...next.configs['core-web-vitals'].rules,
    },
  },
]
