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
import { NEXT_FLOOR, REACT_FLOOR, TAILWIND_FLOOR, TAILWIND_V4_MIGRATION_URL } from '../constants.ts'
import { componentsJsonTargetsTailwindV4, dependenciesInstalled } from '../detect/project.ts'
import {
  compareSemVer,
  describeStatus,
  fetchVersions,
  meetsFloor,
  newestPatchOnLine,
  resolveDependency,
} from '../detect/versions.ts'
import { installCommand } from '../util/exec.ts'
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

/**
 * The remedy for a spec that names no version, matching what `init` prints.
 *
 * `pnpm install` when the tree is not there, and a pointer at the spec itself
 * when it is. A `catalog:` entry and an uninstalled project are the same
 * missing version with two different fixes.
 */
function unresolvedRemedy(ctx: DoctorContext, name: string, spec: string): string {
  return dependenciesInstalled(ctx.project)
    ? `package.json declares ${name} as "${spec}", which names no version. Pin it to a version range, or install it so AgentBlog can read the installed one.`
    : `Run ${installCommand(ctx.project.packageManager)} first, so AgentBlog can read the installed ${name} version.`
}

function checkFramework(ctx: DoctorContext): void {
  const next = resolveDependency(ctx.project, 'next')
  if (next.state === 'absent') {
    ctx.reporter.fail('Next.js present', {
      id: 'next-missing',
      severity: 'error',
      message: 'Next.js is not a dependency of this project.',
      remedy:
        'AgentBlog targets Next.js 16 App Router. Install it, or run this in the right directory.',
    })
  } else if (next.state === 'unresolved') {
    ctx.reporter.fail('Next.js 16', {
      id: 'next-version-unknown',
      severity: 'warning',
      message: `The Next.js version could not be determined, so the 16 floor was not checked. package.json declares "${next.spec}".`,
      remedy: unresolvedRemedy(ctx, 'next', next.spec),
    })
  } else if (meetsFloor(next, NEXT_FLOOR) === false) {
    ctx.reporter.fail('Next.js 16', {
      id: 'next-too-old',
      severity: 'error',
      message: `${describeStatus('Next.js', next)} cannot satisfy ${NEXT_FLOOR}, which is where htmlLimitedBots, the new metadata behaviour, and the agent rules file all live.`,
      remedy: 'npx @next/codemod@canary upgrade latest',
    })
  } else {
    ctx.reporter.pass(describeStatus('Next.js', next))
  }

  const react = resolveDependency(ctx.project, 'react')
  if (meetsFloor(react, REACT_FLOOR) === false) {
    ctx.reporter.fail('React 19', {
      id: 'react-too-old',
      severity: 'error',
      message: `${describeStatus('React', react)} cannot satisfy ${REACT_FLOOR}, which Next.js 16 and the shipped components require.`,
      remedy: 'Upgrade react and react-dom to 19.',
    })
  } else if (react.state === 'installed' || react.state === 'declared') {
    ctx.reporter.pass(describeStatus('React', react))
  }
}

function checkTailwind(ctx: DoctorContext): void {
  const tailwind = resolveDependency(ctx.project, 'tailwindcss')
  if (tailwind.state === 'absent') {
    ctx.reporter.fail('10 Tailwind v4', {
      id: 'tailwind-missing',
      severity: 'error',
      message: 'Tailwind CSS is not a dependency of this project. AgentBlog requires Tailwind v4.',
      remedy: `Install tailwindcss and @tailwindcss/postcss, or migrate from v3: ${TAILWIND_V4_MIGRATION_URL}`,
    })
    return
  }
  if (tailwind.state === 'unresolved') {
    // shadcn writes `"config": ""` for a v4 project and reads it back as the
    // version, so it answers what a `catalog:` entry cannot.
    if (componentsJsonTargetsTailwindV4(ctx.project)) {
      ctx.reporter.pass('10 Tailwind v4, per the empty tailwind.config in components.json')
    } else {
      ctx.reporter.fail('10 Tailwind v4', {
        id: 'tailwind-version-unknown',
        severity: 'warning',
        message: `The Tailwind CSS version could not be determined, so the v4 floor was not checked. package.json declares "${tailwind.spec}".`,
        remedy: unresolvedRemedy(ctx, 'tailwindcss', tailwind.spec),
      })
    }
  } else if (meetsFloor(tailwind, TAILWIND_FLOOR) === false) {
    ctx.reporter.fail('10 Tailwind v4', {
      id: 'tailwind-v3',
      severity: 'error',
      message: `${describeStatus('Tailwind', tailwind)} cannot satisfy ${TAILWIND_FLOOR}. v3 needs a different cssVars format, a different prose bridge, and shadcn 2.3.0, which predates registry namespaces and half of the install path.`,
      remedy: `Migrate to Tailwind v4: ${TAILWIND_V4_MIGRATION_URL}`,
    })
    return
  } else {
    ctx.reporter.pass(`10 ${describeStatus('Tailwind', tailwind)}`)
  }

  const typography = resolveDependency(ctx.project, '@tailwindcss/typography')
  if (typography.state === 'absent' || typography.state === 'unresolved') {
    ctx.reporter.fail('10 prose styles', {
      id: 'typography-missing',
      severity: 'warning',
      message:
        '@tailwindcss/typography is not installed, so the article body falls back to the AgentBlog prose bridge alone.',
      remedy: 'Install @tailwindcss/typography, or confirm styles/agentblog.css is imported.',
    })
  } else {
    ctx.reporter.pass(`10 ${describeStatus('@tailwindcss/typography', typography)}`)
  }
}

async function checkNextIsPatched(ctx: DoctorContext, offline: boolean): Promise<void> {
  /*
   * `node_modules` only, and this is the one check where the distinction is
   * load bearing. The claim is "a newer patch exists on the line you are
   * running", and a declared `^16.3.0` does not say which patch is running. It
   * would have this check report an upgrade for a project that already
   * installed the newest one.
   */
  const next = resolveDependency(ctx.project, 'next')
  if (next.state !== 'installed') {
    if (next.state !== 'absent') {
      ctx.reporter.skip(
        '9 Next.js is on a patched release',
        'the installed version could not be read from node_modules, and a declared range does not say which patch is running',
      )
    }
    return
  }
  const installed = next.version

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
