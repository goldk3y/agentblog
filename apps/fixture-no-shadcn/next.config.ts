import type { NextConfig } from 'next'

/**
 * Empty on purpose. `agentblog init` must never reach the point of patching this
 * file: it refuses at the missing `components.json` check, before writing
 * anything. `scripts/assert-init-refuses.mjs` proves that by diffing a file
 * listing taken before and after the run.
 */
const nextConfig: NextConfig = {}

export default nextConfig
