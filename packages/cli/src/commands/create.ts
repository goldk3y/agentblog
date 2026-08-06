/**
 * `agentblog create <name>`: Mode B, a standalone blog site.
 *
 * This is a thin command and the help text says so. It runs `shadcn init`,
 * which scaffolds a complete Next.js project with Tailwind and a component base
 * already chosen, and then runs the same `init` that Mode A uses. Mode B is a
 * superset of Mode A rather than a fork, so there is one registry and one set of
 * routes behind both.
 *
 * ===========================================================================
 * THE ARGUMENT SHAPE, MEASURED RATHER THAN GUESSED
 * ===========================================================================
 * This command used to run `shadcn@latest init --template next <name>`. In
 * shadcn 4.x that trailing positional is not a target directory, it is an item
 * to add, so the command failed with:
 *
 *     The item at https://ui.shadcn.com/r/styles/new-york-v4/mysite.json
 *     was not found.
 *
 * The scaffold target is `--name`, and the parent directory is `--cwd`. In
 * shadcn 4.16.1 the project path is literally `join(options.cwd, options.name)`,
 * which is why both are passed explicitly rather than relying on the process
 * working directory.
 *
 * The version is pinned for the same reason BUILD-SPEC section 12 pins it: the
 * flags this command depends on are facts about a version, and `@latest` makes
 * them facts about a date.
 *
 * What it does not yet do, stated plainly rather than implied: it does not apply
 * `@agentblog/theme`, and it does not add the standalone site items
 * (`site-home`, `site-nav`, `site-footer`) or the editorial policy and about
 * pages. Those are the remaining Mode B work.
 *
 * The one thing this command must not do is choose a design system quietly.
 * `shadcn init` asks for the base colour and component library interactively,
 * which is the right place for that question, and the reason `init` refuses to
 * run `shadcn init` itself in an existing project.
 *
 * @see https://agentblog.dev/docs/installation, BUILD-SPEC section 12
 */
import { resolve } from 'node:path'

import { initCommand, type InitOptions } from './init.ts'
import {
  dlxCommand,
  isPackageManager,
  PACKAGE_MANAGERS,
  runInherit,
  SHADCN_PACKAGE,
  type PackageManager,
} from '../util/exec.ts'
import { exists, join } from '../util/fs.ts'
import { bullet, note, report, say, step } from '../util/log.ts'

export interface CreateOptions extends InitOptions {
  readonly packageManager?: string
}

export async function createCommand(name: string, options: CreateOptions): Promise<void> {
  // `--cwd` decides where the new directory is created, not only where the
  // install runs. Anything else would scaffold in one place and configure in
  // another.
  const parent = options.cwd ?? process.cwd()
  const target = resolve(parent, name)
  if (exists(target)) {
    report('error', `${target} already exists.`, 'Pick a different name, or remove the directory.')
    process.exitCode = 1
    return
  }

  const requested = options.packageManager ?? 'npm'
  if (!isPackageManager(requested)) {
    report(
      'error',
      `--package-manager is ${JSON.stringify(requested)}, which is not one I know how to run.`,
      `Pass one of: ${PACKAGE_MANAGERS.join(', ')}.`,
    )
    process.exitCode = 1
    return
  }
  const packageManager: PackageManager = requested

  const { command, args } = dlxCommand(packageManager)
  const scaffold = [...args, SHADCN_PACKAGE, 'init', '--template', 'next', '--name', name]

  /*
   * `--dry-run` writes nothing and reaches nothing.
   *
   * The flag is documented as "print the diff and write nothing" and was never
   * read, so a dry run downloaded a template, wrote a project to disk, and made
   * network calls. A flag whose whole purpose is to let somebody look before
   * they leap has to be the one flag that cannot leap.
   */
  if (options.dryRun) {
    step('Dry run. This is what would happen, and nothing was written or fetched.')
    bullet(`1. ${command} ${[...scaffold, '--cwd', parent].join(' ')}`)
    bullet(`   which scaffolds ${target}`)
    bullet(`2. agentblog init --cwd ${target}`)
    say()
    note('shadcn would ask you to pick a base colour and component library. Those are yours.')
    note('Re-run without --dry-run to do it.')
    return
  }

  step(`Scaffolding a Next.js project with shadcn: ${name}`)
  note('shadcn will ask you to pick a base colour and component library. Those are your choices.')

  const status = runInherit(command, [...scaffold, '--cwd', parent], parent)

  /*
   * Exit status is checked AND the result is verified on disk. shadcn exits 0
   * when an interactive prompt is cancelled, so status alone would let this
   * command print "Installing AgentBlog into the new project" over a directory
   * that does not exist.
   */
  if (status !== 0) {
    report('error', 'shadcn init failed, so nothing else ran.', 'Check the output above.')
    process.exitCode = 1
    return
  }
  if (!exists(join(target, 'package.json'))) {
    report(
      'error',
      `shadcn exited without an error but ${target}/package.json is not there, so the project was not scaffolded.`,
      'This is usually a cancelled prompt. Re-run and answer the questions.',
    )
    process.exitCode = 1
    return
  }

  step('Installing AgentBlog into the new project')
  await initCommand({ ...options, cwd: target })

  note('Mode B extras (theme, home, nav, footer, editorial policy) are not installed yet.')
}
