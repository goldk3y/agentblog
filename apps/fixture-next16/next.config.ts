import type { NextConfig } from 'next'

/**
 * The fixture's Next.js config, deliberately missing two keys.
 *
 * ===========================================================================
 * DO NOT ADD `htmlLimitedBots` OR `images.qualities` HERE
 * ===========================================================================
 * Their absence is the condition under test. This app is the target that proves
 * two things, and adding either key switches both off without failing anything:
 *
 * 1. `lib/preflight.ts` warns. CI installs the block through the registry only,
 *    builds, and greps the build log for `htmlLimitedBots`. A registry can write
 *    files but cannot patch one the user already owns, so preflight is the only
 *    thing that can tell a registry-only installer the setting is missing. With
 *    the key present, preflight has nothing to report, the grep finds nothing,
 *    and the job fails for a reason that reads like a broken test rather than a
 *    disabled one.
 * 2. `agentblog doctor --fix` repairs it. The next CI step runs the CLI against
 *    this directory and `scripts/assert-htmlbots-superset.mjs` then checks the
 *    regex the CLI wrote is a superset of the Next.js default list union the AI
 *    crawlers. With the key already here the patcher has nothing to write, and
 *    the superset assertion passes against a value we hand-authored instead of
 *    against the patcher's output.
 *
 * Both gates go quiet and green. That is the worst failure available to a test
 * suite, so it gets a comment this long.
 *
 * The reference values live in `apps/web/next.config.ts`. Read them there.
 */
const nextConfig: NextConfig = {
  /*
   * Next.js 16.3 writes `AGENTS.md` and `CLAUDE.md` into the project root on
   * `next dev` and rewrites its own managed region on every run. This fixture is
   * what `scripts/assert-agents-md.mjs` inspects to prove the CLI writes its
   * block strictly after Next's END marker and never touches `CLAUDE.md`. If
   * Next.js generated those files here too, the assertion would depend on
   * whether a dev server had happened to run first, so it would pass locally and
   * fail in CI, or the reverse. Turning the feature off makes the only author of
   * those two files the tool under test.
   */
  agentRules: false,
}

export default nextConfig
