/**
 * Build time configuration lint. Warns. Never throws. Never runs per request.
 *
 * ===========================================================================
 * WHY A FILE IN YOUR REPO LINTS YOUR CONFIG
 * ===========================================================================
 * A shadcn registry can write files. It cannot patch them. The single highest
 * value setting AgentBlog needs (`htmlLimitedBots` in `next.config.ts`) is a
 * modification to a file you already own, so installing the block through the
 * registry alone leaves it unset. The result is a blog that looks perfect and
 * hands AI crawlers `<title>` and `<meta>` inside `<body>` on any page with
 * deferred metadata.
 *
 * That failure is completely silent. This module is what makes it loud. It reads
 * `next.config.*` off disk at build and dev time and prints what is missing,
 * using the same predicates `agentblog doctor` uses, so the two tools cannot
 * drift and contradict each other in front of you.
 *
 * `app/blog/layout.tsx` imports and calls it. Do not delete that call to silence
 * the warning; set `preflight: false` in `agentblog.config.ts` instead. The
 * difference matters: the config flag keeps working when a future edit breaks
 * something new, and deleting the import means nothing ever tells you again.
 *
 * ===========================================================================
 * CONSTRAINTS, ALL BINDING
 * ===========================================================================
 * 1. **Warn, never throw.** Failing a production build over a config lint is
 *    hostile and gets the import deleted, which costs more than the lint is
 *    worth. Every path here is wrapped so a filesystem surprise cannot become a
 *    failed deploy.
 * 2. **Once per process.** A module scope flag, not a per render check. This
 *    runs inside a layout, and a layout renders once per route.
 * 3. **No cost at request time.** See the phase detection below.
 * 4. **No dependencies.** `lib/preflight-checks.ts` is dependency free by
 *    contract and is generated from `packages/checks`; this file adds only
 *    `node:fs` and `node:path`, which is why it carries `server-only`.
 * 5. **A missing `next.config.*` is a warning, not a crash.**
 *
 * @see https://agentblog.dev/docs/installation
 */
import 'server-only'

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { config } from '@/lib/config'
import { bySeverity, checkNextConfig } from '@/lib/preflight-checks'
import type { Finding } from '@/lib/preflight-checks'

/** In the order Next.js itself resolves them. */
const CONFIG_FILENAMES = [
  'next.config.ts',
  'next.config.mts',
  'next.config.mjs',
  'next.config.js',
] as const

/** Constraint 2: module scope, so repeated renders cost nothing. */
let hasRun = false

/**
 * Run the config lint once and print any findings.
 *
 * Safe to call from anywhere on the server. Calling it twice is a no op.
 */
export function preflight(): void {
  if (hasRun) return
  hasRun = true

  try {
    if (!shouldRun()) return
    report([...checkConfigResolution(), ...checkNextConfigOnDisk()])
  } catch {
    // Constraint 1. A lint that can fail a build is a lint people delete.
  }
}

/**
 * Whether this process is a build or a dev server rather than a live request.
 *
 * Being honest about what is actually detected here: `NEXT_PHASE` is set by
 * Next.js and is not a documented public API, so this is a best effort signal
 * rather than a guarantee. The fallback is `NODE_ENV`, which is `'production'`
 * both during `next build` and while serving production traffic, so on its own
 * it cannot tell those two apart.
 *
 * The combination gives: run during a production build (phase matches), run in
 * development (NODE_ENV is not production), stay silent while serving production
 * traffic. If `NEXT_PHASE` ever disappears the check degrades to development
 * only, which is the safe direction to fail in.
 */
function shouldRun(): boolean {
  if (!config.preflight) return false
  if (process.env.NEXT_PHASE === 'phase-production-build') return true
  return process.env.NODE_ENV !== 'production'
}

/**
 * Confirm `lib/config.ts` actually resolved the user's config file.
 *
 * `agentblog.config.ts` lives at the project root while `@/` maps to `src/` in a
 * `src/` layout, so `import userConfig from '@/agentblog.config'` can resolve to
 * nothing in a project nobody ran `agentblog init` on. The types say this is
 * unreachable, which is precisely why it needs a runtime check: the type system
 * is describing what the import is supposed to produce, not what a broken alias
 * actually produced.
 */
function checkConfigResolution(): Finding[] {
  const resolved: Partial<typeof config> | undefined = config

  if (!resolved || !resolved.siteUrl) {
    return [
      {
        id: 'config-unresolved',
        severity: 'error',
        message:
          'lib/config.ts resolved no `siteUrl`. `@/agentblog.config` most likely did not ' +
          'resolve, which happens in a `src/` layout because the config file belongs at the ' +
          'project root while `@/` points at `src/`. Every canonical URL, sitemap entry, and ' +
          'JSON-LD id is composed from `siteUrl`, so nothing downstream is correct until ' +
          'this is fixed.',
        remedy:
          'npx agentblog@latest doctor --fix, or add an `"@/agentblog.config"` path to ' +
          'tsconfig.json pointing at the root file.',
        fixable: true,
      },
    ]
  }

  return []
}

/** Read the first `next.config.*` that exists and run the shared predicates. */
function checkNextConfigOnDisk(): Finding[] {
  const root = process.cwd()

  for (const filename of CONFIG_FILENAMES) {
    /*
     * `turbopackIgnore` on all three calls, and it is not a workaround.
     *
     * Turbopack traces filesystem access statically. It cannot prove which file
     * a computed path resolves to, so it assumes the worst and traces the whole
     * project, which copies your source tree and `public/` next to the server
     * bundle. That inflates every deployment and can trip a platform size limit.
     *
     * These three calls genuinely need a computed path: this function exists to
     * read whichever `next.config.*` you happen to have, at your project root.
     * There is nothing to declare statically. The annotation tells Turbopack
     * that we take responsibility for the dependency, and the honest statement
     * of that responsibility is: this runs at build and dev time only, it reads
     * exactly one file that is already part of your project, and it never runs
     * at request time (see `shouldRun`). Nothing here needs to be bundled.
     */
    const path = join(/* turbopackIgnore: true */ root, filename)
    if (!existsSync(/* turbopackIgnore: true */ path)) continue

    try {
      return checkNextConfig({
        source: readFileSync(/* turbopackIgnore: true */ path, 'utf8'),
        path: filename,
      })
    } catch {
      // Unreadable is not the same as absent, and neither is worth a build failure.
      return []
    }
  }

  return [
    {
      id: 'next-config-missing',
      severity: 'warning',
      message:
        'No next.config.ts, .mts, .mjs, or .js was found in the working directory, so ' +
        'AgentBlog cannot confirm that `htmlLimitedBots` and `images.qualities` are set. In a ' +
        'monorepo this usually means the process is running from the workspace root rather ' +
        'than the app directory.',
      remedy: 'npx agentblog@latest doctor --fix, run from the Next.js app directory.',
      fixable: false,
    },
  ]
}

/** One grouped `console.warn`, most severe first, so build logs stay readable. */
function report(findings: readonly Finding[]): void {
  if (findings.length === 0) return

  /*
   * One line per finding, deliberately.
   *
   * `next build` forks worker processes and each one runs this module, so an
   * unfixed config prints this block several times per build. The module-scope
   * memo cannot dedupe across processes and neither can an environment marker,
   * because the workers are forked before the first report runs.
   *
   * That leaves controlling the volume rather than the count. A four line entry
   * repeated five times is forty lines of build output, and the plan's own risk
   * table names "users delete the preflight import to silence the warning" as a
   * real failure mode. The full explanation lives in `agentblog doctor`, which
   * runs once and can also fix what it finds, so the job here is to be
   * unmissable and short, then hand off.
   */
  const sorted = [...findings].sort(bySeverity)
  const lines = sorted.map(
    (finding) => `  AgentBlog [${finding.severity}] ${finding.id}: ${finding.message}`,
  )
  lines.push('  AgentBlog: run `npx agentblog@latest doctor --fix` to repair these.')

  console.warn(lines.join('\n'))
}
