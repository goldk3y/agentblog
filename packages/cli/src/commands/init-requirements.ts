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
 * ===========================================================================
 * A REFUSAL HAS TO BE TRUE
 * ===========================================================================
 * Every message here names a version, and for a while none of them could read
 * one. `create-next-app` writes `"tailwindcss": "^4"`, the range parser only
 * matched a full `x.y.z`, and so the most common project shape in existence was
 * refused with "Tailwind CSS is not installed" and sent to a v3 migration
 * guide. The refusal was absolute, unactionable, and wrong.
 *
 * So a version now arrives as a `DependencyStatus` with four cases, and each
 * one gets its own sentence. The two that are easy to collapse and must not be:
 * a package that is not there, and a package whose version this CLI cannot
 * determine (a pnpm `catalog:`, a `workspace:*`, a `node_modules` that was
 * never installed). The first is the user's problem to fix. The second is ours
 * to state plainly.
 *
 * @see https://docs.agentblog.dev/installation
 */
import {
  NEXT_FLOOR,
  NO_COMPONENTS_JSON_MESSAGE,
  REACT_FLOOR,
  TAILWIND_FLOOR,
  TAILWIND_V4_MIGRATION_URL,
} from '../constants.ts'
import { componentsJsonTargetsTailwindV4, dependenciesInstalled } from '../detect/project.ts'
import { collidingBlogFiles } from '../detect/routes.ts'
import { describeStatus, meetsFloor, resolveDependency } from '../detect/versions.ts'
import type { ProjectContext } from '../detect/project.ts'
import { installCommand } from '../util/exec.ts'
import { bullet, note, refusal, report, say } from '../util/log.ts'

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

  if (!checkFramework(project)) return { ok: false, forceable: false }
  if (!checkTailwind(project)) return { ok: false, forceable: false }

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

/**
 * The remedy for a spec that names no version.
 *
 * `pnpm install` when the tree is simply not there, and a pointer at the spec
 * itself when it is. Telling someone with a populated `node_modules` to install
 * again wastes their time, and telling someone with an empty project that their
 * `catalog:` entry is exotic explains nothing.
 */
function unresolvedRemedy(project: ProjectContext, name: string, spec: string): string {
  return dependenciesInstalled(project)
    ? `package.json declares ${name} as "${spec}", which names no version. Pin it to a version range, or install it so AgentBlog can read the installed one.`
    : `Run ${installCommand(project.packageManager)} first, so AgentBlog can read the installed ${name} version.`
}

function checkFramework(project: ProjectContext): boolean {
  const next = resolveDependency(project, 'next')

  if (next.state === 'absent') {
    report(
      'error',
      'Next.js is not a dependency of this project.',
      'AgentBlog targets Next.js 16 with the App Router. Install it, or run this from the right directory.',
    )
    return false
  }

  if (next.state === 'unresolved') {
    report(
      'error',
      'AgentBlog could not determine the Next.js version, and it requires 16.',
      unresolvedRemedy(project, 'next', next.spec),
    )
    return false
  }

  if (meetsFloor(next, NEXT_FLOOR) === false) {
    report(
      'error',
      `${describeStatus('Next.js', next)} cannot satisfy ${NEXT_FLOOR}. AgentBlog requires Next.js 16 with the App Router.`,
      'npx @next/codemod@canary upgrade latest',
    )
    return false
  }

  const react = resolveDependency(project, 'react')
  // Compared against `false` rather than falsy: `null` is "no evidence", and no
  // evidence is not a failure. React has no requirement of its own to state, so
  // an unreadable react version is passed over in silence.
  if (meetsFloor(react, REACT_FLOOR) === false) {
    report(
      'error',
      `${describeStatus('React', react)} cannot satisfy ${REACT_FLOOR}, which Next.js 16 and the shipped components require.`,
      'Upgrade react and react-dom to 19.',
    )
    return false
  }

  return true
}

function checkTailwind(project: ProjectContext): boolean {
  const tailwind = resolveDependency(project, 'tailwindcss')

  if (tailwind.state === 'absent') {
    report(
      'error',
      'Tailwind CSS is not a dependency of this project. AgentBlog requires Tailwind v4.',
      `Install tailwindcss and @tailwindcss/postcss, or migrate from v3: ${TAILWIND_V4_MIGRATION_URL}`,
    )
    return false
  }

  if (tailwind.state === 'unresolved') {
    // shadcn writes `"config": ""` into components.json for a v4 project and
    // reads it back as the version, so it answers the case a `catalog:` entry
    // cannot.
    if (componentsJsonTargetsTailwindV4(project)) {
      note('Tailwind version read from components.json, which records a v4 project.')
      return true
    }
    report(
      'error',
      'AgentBlog could not determine the Tailwind CSS version, and it requires v4.',
      unresolvedRemedy(project, 'tailwindcss', tailwind.spec),
    )
    return false
  }

  if (meetsFloor(tailwind, TAILWIND_FLOOR) === false) {
    report(
      'error',
      `${describeStatus('Tailwind CSS', tailwind)} cannot satisfy ${TAILWIND_FLOOR}. AgentBlog requires v4, and v3 is not supported.`,
      `Migrate first: ${TAILWIND_V4_MIGRATION_URL}`,
    )
    return false
  }

  return true
}
