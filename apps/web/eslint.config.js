import next from '@agentblog/eslint-config/next'
import registry from '@agentblog/eslint-config/registry'

export default [
  { ignores: ['.next/**', 'public/r/**', 'next-env.d.ts'] },
  ...next,
  { files: ['registry/**/*.{ts,tsx}'], ...registry[registry.length - 1] },
]
