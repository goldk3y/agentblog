/**
 * What `init` requires before it writes anything, and how it refuses.
 *
 * These are requirements, not assumptions. `init` refuses rather than papering
 * over them, and the refusal that matters most is the missing `components.json`.
 *
 * We do not run `shadcn init` on the user's behalf. That command picks a
 * component base, sets a baseColor, and writes CSS variables into their
 * stylesheet, which is choosing a design system for them inside a command they
 * ran to install a blog. A project that already has Tailwind already has a
 * visual identity, and overwriting it to install a blog is the failure that
 * makes people uninstall rather than restyle. Refusing costs three lines of
 * output.
 *
 * Tailwind v3 is an error for a different reason: supporting it would mean a
 * second cssVars format, a second prose bridge, and pinning users to shadcn
 * 2.3.0, which predates registry namespaces, `include`, and `registry:base`.
 *
 * @see https://agentblog.dev/docs/installation
 */
import { NO_COMPONENTS_JSON_MESSAGE, TAILWIND_V4_MIGRATION_URL } from '../constants.ts'
import { collidingBlogFiles } from '../detect/routes.ts'
import { resolvedVersion } from '../detect/versions.ts'
import type { ProjectContext } from '../detect/project.ts'
import { bullet, refusal, report, say } from '../util/log.ts'

export interface RequirementResult {
  readonly ok: boolean
  /** Set when the failure is a route collision, which `--force` overrides. */
  readonly forceable: boolean
}

export function checkRequirements(
  project: ProjectContext,
  options: { readonly force: boolean },
): RequirementResult {
  if (!project.packageJson) {
    report(
      'error',
      `No package.json in ${project.root}.`,
      'Run this from your Next.js project root.',
    )
    return { ok: false, forceable: false }
  }

  const next = resolvedVersion(project, 'next')
  if (!next || next.major < 16) {
    report(
      'error',
      next
        ? `Next.js ${next.raw} is installed. AgentBlog requires Next.js 16 with the App Router.`
        : 'Next.js is not installed in this project.',
      'npx @next/codemod@canary upgrade latest',
    )
    return { ok: false, forceable: false }
  }

  const react = resolvedVersion(project, 'react')
  if (react && react.major < 19) {
    report(
      'error',
      `React ${react.raw} is installed. Next.js 16 and the shipped components require React 19.`,
      'Upgrade react and react-dom to 19.',
    )
    return { ok: false, forceable: false }
  }

  const tailwind = resolvedVersion(project, 'tailwindcss')
  if (!tailwind || tailwind.major < 4) {
    report(
      'error',
      tailwind
        ? `Tailwind CSS ${tailwind.raw} is installed. AgentBlog requires v4, and v3 is not supported.`
        : 'Tailwind CSS is not installed. AgentBlog requires Tailwind v4.',
      `Migrate first: ${TAILWIND_V4_MIGRATION_URL}`,
    )
    return { ok: false, forceable: false }
  }

  if (!project.componentsJson) {
    refusal(NO_COMPONENTS_JSON_MESSAGE.split('\n'))
    return { ok: false, forceable: false }
  }

  const appDirExists = Boolean(project.rootLayoutPath)
  if (!appDirExists) {
    report(
      'error',
      'No App Router root layout found. AgentBlog installs App Router routes only.',
      'Create app/layout.tsx, or run this from the project that has one.',
    )
    return { ok: false, forceable: false }
  }

  const colliding = collidingBlogFiles(project)
  if (colliding.length > 0 && !options.force) {
    report(
      'error',
      `${colliding.length} file(s) already exist under app/blog and AgentBlog did not write them.`,
      'Move them, or re-run with --force if you want AgentBlog to take over these routes.',
    )
    say()
    for (const path of colliding.slice(0, 20)) bullet(path)
    if (colliding.length > 20) bullet(`and ${colliding.length - 20} more`)
    say()
    return { ok: false, forceable: true }
  }

  return { ok: true, forceable: false }
}
