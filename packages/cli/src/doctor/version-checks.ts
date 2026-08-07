/**
 * Dependency floors: Next.js, React, Tailwind, and the prose styles.
 *
 * Covers doctor checks 9 and 10, plus the Next.js 16 and React 19 requirements
 * `init` refuses without.
 *
 * Check 9 resolves the patched Next.js floor **at runtime** from the npm
 * registry's published version list rather than comparing against a literal. The
 * May 2026 security release (16.2.6 and 15.5.18, thirteen advisories, none of
 * them mitigable at the WAF layer) was superseded within eight weeks. Any version
 * we hardcode is stale before the CLI's next minor, and a security check that is
 * quietly out of date is worse than no check at all.
 *
 * The version list is all it reads. No advisory feed is consulted, so the claim
 * it makes is "a newer patch exists on your line", never "your version is
 * vulnerable". Overstating that would make the one check people act on the one
 * they stop trusting.
 *
 * Check 10 makes Tailwind v3 an error rather than a warning. Supporting it would
 * mean a second cssVars format, a second prose bridge, and pinning users to
 * shadcn 2.3.0, a CLI that predates registry namespaces, `include`, and
 * `registry:base`. Half the install path does not function there.
 *
 * @see https://docs.agentblog.dev/reference/cli
 */
import { TAILWIND_V4_MIGRATION_URL } from '../constants.ts'
import {
  compareSemVer,
  fetchVersions,
  newestPatchOnLine,
  resolvedVersion,
} from '../detect/versions.ts'
import type { DoctorContext } from './context.ts'

export async function runVersionChecks(
  ctx: DoctorContext,
  options: { offline: boolean },
): Promise<void> {
  ctx.reporter.group('Dependencies')

  checkFramework(ctx)
  checkTailwind(ctx)
  await checkNextIsPatched(ctx, options.offline)
}

function checkFramework(ctx: DoctorContext): void {
  const next = resolvedVersion(ctx.project, 'next')
  if (!next) {
    ctx.reporter.fail('Next.js present', {
      id: 'next-missing',
      severity: 'error',
      message: 'Next.js is not a dependency of this project.',
      remedy:
        'AgentBlog targets Next.js 16 App Router. Install it, or run this in the right directory.',
    })
  } else if (next.major < 16) {
    ctx.reporter.fail('Next.js 16', {
      id: 'next-too-old',
      severity: 'error',
      message: `Next.js ${next.raw} is installed. AgentBlog requires 16, which is where htmlLimitedBots, the new metadata behaviour, and the agent rules file all live.`,
      remedy: 'npx @next/codemod@canary upgrade latest',
    })
  } else {
    ctx.reporter.pass(`Next.js ${next.raw}`)
  }

  const react = resolvedVersion(ctx.project, 'react')
  if (react && react.major < 19) {
    ctx.reporter.fail('React 19', {
      id: 'react-too-old',
      severity: 'error',
      message: `React ${react.raw} is installed. Next.js 16 and the shipped components require React 19.`,
      remedy: 'Upgrade react and react-dom to 19.',
    })
  } else if (react) {
    ctx.reporter.pass(`React ${react.raw}`)
  }
}

function checkTailwind(ctx: DoctorContext): void {
  const tailwind = resolvedVersion(ctx.project, 'tailwindcss')
  if (!tailwind) {
    ctx.reporter.fail('10 Tailwind v4', {
      id: 'tailwind-missing',
      severity: 'error',
      message: 'Tailwind CSS is not installed. AgentBlog requires Tailwind v4.',
      remedy: TAILWIND_V4_MIGRATION_URL,
    })
    return
  }
  if (tailwind.major < 4) {
    ctx.reporter.fail('10 Tailwind v4', {
      id: 'tailwind-v3',
      severity: 'error',
      message: `Tailwind ${tailwind.raw} is installed. v3 is not supported: it needs a different cssVars format, a different prose bridge, and shadcn 2.3.0, which predates registry namespaces and half of the install path.`,
      remedy: `Migrate to Tailwind v4: ${TAILWIND_V4_MIGRATION_URL}`,
    })
    return
  }
  ctx.reporter.pass(`10 Tailwind ${tailwind.raw}`)

  const typography = resolvedVersion(ctx.project, '@tailwindcss/typography')
  if (!typography) {
    ctx.reporter.fail('10 prose styles', {
      id: 'typography-missing',
      severity: 'warning',
      message:
        '@tailwindcss/typography is not installed, so the article body falls back to the AgentBlog prose bridge alone.',
      remedy: 'Install @tailwindcss/typography, or confirm styles/agentblog.css is imported.',
    })
  } else {
    ctx.reporter.pass(`10 @tailwindcss/typography ${typography.raw}`)
  }
}

async function checkNextIsPatched(ctx: DoctorContext, offline: boolean): Promise<void> {
  const installed = resolvedVersion(ctx.project, 'next')
  if (!installed) return

  if (offline) {
    ctx.reporter.skip('9 Next.js is on a patched release', '--offline was passed')
    return
  }

  const versions = await fetchVersions('next')
  if (!versions) {
    ctx.reporter.skip(
      '9 Next.js is on a patched release',
      'the npm registry was unreachable, and the floor is read from its version list at runtime rather than hardcoded',
    )
    return
  }

  const newest = newestPatchOnLine(versions, installed)
  if (!newest || compareSemVer(installed, newest) >= 0) {
    ctx.reporter.pass(
      `9 Next.js ${installed.raw} is the newest patch on the ${installed.major}.${installed.minor} line`,
    )
    return
  }

  ctx.reporter.fail('9 Next.js is on a patched release', {
    id: 'next-unpatched',
    severity: 'error',
    message: `Next.js ${installed.raw} is installed and ${newest.raw} is the newest patch on the same line, per the npm version list. Whether that gap contains a security fix is not something this check reads, and Next.js patch releases have carried issues that cannot be mitigated at the WAF layer.`,
    remedy: `Upgrade to next@${newest.raw}.`,
  })
}
