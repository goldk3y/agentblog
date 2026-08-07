/**
 * The `agentblog` binary.
 *
 * This file is wiring only: option parsing, help text, and the telemetry
 * disclosure. Every command lives in `src/commands/` so that the surface a user
 * sees and the behaviour behind it can be reviewed separately.
 *
 * Help text is part of the product here. `create` in particular says plainly
 * what it does and does not do, because a command that quietly does less than
 * its name implies is how a tool loses trust it cannot buy back.
 *
 * @see https://docs.agentblog.dev/reference/cli
 */
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { Command } from 'commander'

import { auditCommand } from './commands/audit.ts'
import { createCommand } from './commands/create.ts'
import { doctorCommand } from './commands/doctor.ts'
import { initCommand } from './commands/init.ts'
import { newCommand } from './commands/new.ts'
import { pingCommand } from './commands/ping.ts'
import { revertCommand } from './commands/revert.ts'
import { uninstallCommand } from './commands/uninstall.ts'
import { DEFAULT_REGISTRY_URL } from './patchers/components-json.ts'
import { PACKAGE_MANAGERS, SHADCN_PACKAGE } from './util/exec.ts'
import { readJson } from './util/fs.ts'
import { note, report, say } from './util/log.ts'
import { discloseOnce, setEnabled, status } from './util/telemetry.ts'

const version = readVersion()
process.env['AGENTBLOG_VERSION'] = version

const program = new Command()

program
  .name('agentblog')
  .description(
    'The SEO and GEO layer for a Next.js 16 blog. Installs the blog block, patches the config a shadcn registry cannot reach, and verifies that AI crawlers can actually read the result.',
  )
  .version(version, '-v, --version')
  .option('--no-telemetry', 'disable anonymous usage data for this run')
  .option('--cwd <path>', 'run as if agentblog had started in this directory')
  .hook('preAction', () => {
    discloseOnce()
  })

/**
 * The global `--cwd`, resolved once.
 *
 * Every command already accepted a `cwd` internally; this is the flag that lets
 * a caller reach it. It matters most in a monorepo, where the Next.js app is not
 * the directory the terminal is in, and in CI, where changing directory around a
 * step is more fragile than passing a path.
 */
function globalCwd(): string {
  const value = program.opts()['cwd']
  return typeof value === 'string' ? resolve(value) : process.cwd()
}

program
  .command('init')
  .description('install the blog into an existing Next.js 16 app and wire up the config')
  .option('--dry-run', 'print the unified diff and write nothing')
  .option('--force', 'proceed even when files already exist under app/blog')
  .option('-y, --yes', 'accept defaults and skip the prompts')
  .option('--skip-install', 'skip `shadcn add` and only run the config patches')
  .option('--reinstall', 're-run `shadcn add` on a project that already has AgentBlog')
  .option('--site-url <url>', 'production site URL, https, no trailing slash')
  .option('--brand <name>', 'brand name, used as og:site_name and Organization.name')
  .option('--author <slug>', 'default author slug')
  .option('--source <name>', 'content source (mdx)')
  .option('--registry <url>', 'where @agentblog/* resolves from', DEFAULT_REGISTRY_URL)
  .addHelpText(
    'after',
    [
      '',
      'What it writes before anything else:',
      '  components.json  the @agentblog registry namespace, without which `shadcn add`',
      '                   fails with `Unknown registry "@agentblog"`. Point it elsewhere',
      '                   with --registry, for a local server or a private mirror.',
      '',
      'Your content is never overwritten. content/authors.json, content/categories.json,',
      'and content/blog/** are snapshotted before `shadcn add` runs and restored after it,',
      'so the seed content only ever lands where there was nothing. Block code and route',
      'files ARE overwritten, because they are ours, and they sit outside the AgentBlog',
      'backup, so `agentblog revert` does not undo them.',
      '',
      'A second `init` on a project that already has an install manifest skips `shadcn add`',
      'entirely and only re-runs the config patches, which are idempotent. Use --reinstall',
      'to force the file copy.',
    ].join('\n'),
  )
  .action(async (options: Record<string, unknown>) => {
    await initCommand({
      dryRun: options['dryRun'] === true,
      force: options['force'] === true,
      yes: options['yes'] === true,
      skipInstall: options['skipInstall'] === true,
      reinstall: options['reinstall'] === true,
      telemetry: program.opts()['telemetry'] !== false,
      cwd: globalCwd(),
      ...(typeof options['siteUrl'] === 'string' ? { siteUrl: options['siteUrl'] } : {}),
      ...(typeof options['brand'] === 'string' ? { brand: options['brand'] } : {}),
      ...(typeof options['author'] === 'string' ? { author: options['author'] } : {}),
      ...(typeof options['source'] === 'string' ? { source: options['source'] } : {}),
      ...(typeof options['registry'] === 'string' ? { registry: options['registry'] } : {}),
    })
  })

program
  .command('create')
  .argument('<name>', 'directory to create')
  .description('scaffold a standalone blog site (runs `shadcn init --template next`, then `init`)')
  .addHelpText(
    'after',
    [
      '',
      'What this does, precisely:',
      `  1. runs \`${SHADCN_PACKAGE} init --template next --name <name> --cwd .\`, which`,
      '     scaffolds a Next.js project into <name> and asks you to pick a base colour',
      '     and component library',
      '  2. runs `agentblog init` inside it',
      '',
      '--dry-run prints both commands and runs neither. It writes nothing and fetches',
      'nothing, which is the whole point of it.',
      '',
      'What it does not do yet: apply @agentblog/theme, or add the standalone site items',
      '(home, nav, footer) and the about, contact, and editorial policy pages.',
    ].join('\n'),
  )
  .option('--dry-run', 'print the commands and run neither')
  .option('-y, --yes', 'accept defaults and skip the prompts')
  .option('--package-manager <pm>', PACKAGE_MANAGERS.join(', '), 'npm')
  .option('--site-url <url>', 'production site URL, https, no trailing slash')
  .option('--brand <name>', 'brand name, used as og:site_name and Organization.name')
  .option('--author <slug>', 'default author slug')
  .option('--registry <url>', 'where @agentblog/* resolves from', DEFAULT_REGISTRY_URL)
  .action(async (name: string, options: Record<string, unknown>) => {
    await createCommand(name, {
      dryRun: options['dryRun'] === true,
      yes: options['yes'] === true,
      telemetry: program.opts()['telemetry'] !== false,
      cwd: globalCwd(),
      ...(typeof options['packageManager'] === 'string'
        ? { packageManager: options['packageManager'] }
        : {}),
      ...(typeof options['siteUrl'] === 'string' ? { siteUrl: options['siteUrl'] } : {}),
      ...(typeof options['brand'] === 'string' ? { brand: options['brand'] } : {}),
      ...(typeof options['author'] === 'string' ? { author: options['author'] } : {}),
      ...(typeof options['registry'] === 'string' ? { registry: options['registry'] } : {}),
    })
  })

program
  .command('doctor')
  .description('verify the install. Exits non-zero on any error finding, so it works in CI')
  .option('--fix', 'repair what can be repaired, backing up every file first')
  .option(
    '--url <url>',
    'also check this live site as GPTBot, ClaudeBot, PerplexityBot, OAI-SearchBot, and Googlebot. Pass an origin and a real post is probed; pass a post URL to probe that one',
  )
  .option('--dry-run', 'with --fix, print the unified diff and write nothing')
  .option('--verbose', 'list passing checks as well as failures')
  .option('--offline', 'skip every check that needs the network')
  .option('--json', 'print the whole report as one JSON document and nothing else')
  .addHelpText(
    'after',
    [
      '',
      'What --fix repairs, and nothing else:',
      '  next.config     htmlLimitedBots union, images.qualities',
      '  app/layout      metadataBase, title.template, the RSS alternates.types link',
      '  app/robots.ts   an environment guard, when the file has none',
      '  AGENTS.md       the AgentBlog block, placed after the Next.js managed region',
      '  .env.local      generates INDEXNOW_KEY and AGENTBLOG_REVALIDATE_SECRET when either',
      '                  is missing or empty, and moves both out of any git tracked env file',
      '  public/         writes the IndexNow key file INDEXNOW_KEY names, or rewrites it to',
      '                  match. A public/*.txt counts as a key file only when it contains',
      '                  exactly its own name or INDEXNOW_KEY names it, so llms-full.txt and',
      '                  security.txt are never touched.',
      '',
      'Anything it declines to change is printed with the reason. It never edits a',
      'route beyond the robots guard, and it never edits your content. It leaves',
      'htmlLimitedBots byte for byte alone when it cannot read the current value as a',
      'literal, rather than replacing bots it cannot see.',
      '',
      '--url runs the live crawler checks. Run it from CI or from your own machine,',
      'never from inside the deployment: a request that originates inside the network',
      'can bypass the CDN rule the check exists to find.',
    ].join('\n'),
  )
  .action(async (options: Record<string, unknown>) => {
    await doctorCommand({
      fix: options['fix'] === true,
      dryRun: options['dryRun'] === true,
      verbose: options['verbose'] === true,
      offline: options['offline'] === true,
      json: options['json'] === true,
      telemetry: program.opts()['telemetry'] !== false,
      cwd: globalCwd(),
      ...(typeof options['url'] === 'string' ? { url: options['url'] } : {}),
    })
  })

program
  .command('audit')
  .argument('[slug]', 'audit one post instead of all of them')
  .description('pre-publish checks: answer capsule, headings, dates, citations, links, copy style')
  .option('--dir <path>', 'content directory (default content/blog)')
  .option('--stale', 'list posts by dateModified age, ranked by inbound internal links')
  .option('--days <n>', 'staleness threshold in days', '90')
  .option(
    '--crawlers <logfile>',
    'parse a server or CDN access log and report hits per bot per week',
  )
  .option('--verbose', 'list passing checks as well as failures')
  .option('--json', 'print the whole report as one JSON document and nothing else')
  .addHelpText(
    'after',
    [
      '',
      'Every check runs on every post. There is no flag to run a subset, because the',
      'checks that a writer would switch off are the ones that catch the expensive',
      'mistakes. Narrow the input instead: pass a slug, or pass --dir.',
    ].join('\n'),
  )
  .action((slug: string | undefined, options: Record<string, unknown>) => {
    auditCommand(slug, {
      stale: options['stale'] === true,
      verbose: options['verbose'] === true,
      json: options['json'] === true,
      telemetry: program.opts()['telemetry'] !== false,
      cwd: globalCwd(),
      ...(typeof options['dir'] === 'string' ? { dir: options['dir'] } : {}),
      ...(typeof options['days'] === 'string' ? { days: options['days'] } : {}),
      ...(typeof options['crawlers'] === 'string' ? { crawlers: options['crawlers'] } : {}),
    })
  })

program
  .command('new')
  .argument('<title>', 'post title')
  .description('scaffold a post file with correct frontmatter')
  .option('--slug <slug>', 'override the generated slug')
  .option('--dir <path>', 'content directory (default content/blog)')
  .option('--author <slug>', 'author slug')
  .option('--category <slug>', 'category slug')
  .action((title: string, options: Record<string, unknown>) => {
    newCommand(title, {
      cwd: globalCwd(),
      ...(typeof options['slug'] === 'string' ? { slug: options['slug'] } : {}),
      ...(typeof options['dir'] === 'string' ? { dir: options['dir'] } : {}),
      ...(typeof options['author'] === 'string' ? { author: options['author'] } : {}),
      ...(typeof options['category'] === 'string' ? { category: options['category'] } : {}),
    })
  })

program
  .command('ping')
  .argument('<slug>', 'post slug')
  .description('revalidate the routes and submit them to IndexNow, reporting the real status code')
  .addHelpText(
    'after',
    [
      '',
      'Exit code, because this runs as a publish step:',
      '  0  every step you asked for happened',
      '  1  any step you asked for did not, including a missing credential',
      '',
      'A missing AGENTBLOG_REVALIDATE_SECRET or INDEXNOW_KEY is an error, not a warning.',
      'A publish step that silently submits nothing and reports success is the failure',
      'this command exists to make loud. Pass --skip-revalidate or --skip-indexnow when',
      'you actually mean to skip one, and the skipped half is not reported at all.',
    ].join('\n'),
  )
  .option('--site-url <url>', 'override the site URL from agentblog.config.ts')
  .option('--key <key>', 'override INDEXNOW_KEY')
  .option('--secret <secret>', 'override AGENTBLOG_REVALIDATE_SECRET')
  .option('--skip-revalidate', 'submit to IndexNow only')
  .option('--skip-indexnow', 'revalidate only')
  .action(async (slug: string, options: Record<string, unknown>) => {
    await pingCommand(slug, {
      skipRevalidate: options['skipRevalidate'] === true,
      skipIndexnow: options['skipIndexnow'] === true,
      cwd: globalCwd(),
      ...(typeof options['siteUrl'] === 'string' ? { siteUrl: options['siteUrl'] } : {}),
      ...(typeof options['key'] === 'string' ? { key: options['key'] } : {}),
      ...(typeof options['secret'] === 'string' ? { secret: options['secret'] } : {}),
    })
  })

program
  .command('revert')
  .description('restore the LAST patch set from .agentblog/backup/, or every one with --all')
  .option('--dry-run', 'print the unified diff and write nothing')
  .option('--all', 'restore every backup, newest first, back to the original state')
  .addHelpText(
    'after',
    [
      '',
      'Scope, precisely:',
      '  revert        restores the most recent backup only. This is the undo for the run',
      '                you just did, so a second `doctor --fix` can be undone without also',
      '                unwinding your `init`.',
      '  revert --all  replays every backup newest to oldest, which returns the patched',
      '                files to the state they were in before the first run.',
      '',
      'Files that existed are rewritten with their former contents. Files that did not',
      'exist are deleted, along with any directory that only existed to hold them.',
      'Files the registry wrote are never touched: that is `uninstall`.',
    ].join('\n'),
  )
  .action((options: Record<string, unknown>) => {
    revertCommand({
      dryRun: options['dryRun'] === true,
      all: options['all'] === true,
      cwd: globalCwd(),
    })
  })

program
  .command('uninstall')
  .description('revert EVERY config patch, remove the AGENTS.md block, and list the registry files')
  .option('--dry-run', 'print the unified diff and write nothing')
  .option('--keep-env', 'leave INDEXNOW_KEY and AGENTBLOG_REVALIDATE_SECRET in place')
  .option('--keep-backups', 'leave .agentblog/ in place instead of removing it')
  .addHelpText(
    'after',
    [
      '',
      'What this does, precisely:',
      '  1. removes the AgentBlog block from AGENTS.md, leaving the rest of the file',
      '  2. removes INDEXNOW_KEY and AGENTBLOG_REVALIDATE_SECRET from .env and .env.local,',
      '     along with the comments AgentBlog wrote above them and no others',
      '  3. restores EVERY backup under .agentblog/backup/, newest to oldest, which is what',
      '     `revert --all` does. Restoring only the first backup would leave a key that a',
      '     later run patched for the first time still patched.',
      '  4. removes .agentblog/, so the tree matches the one before the install. The',
      '     backups and the install manifest go with it. Pass --keep-backups to keep them.',
      '  5. lists the files the registry wrote, without deleting any of them: you have',
      '     probably edited some, and deleting edited components is not ours to do.',
      '',
      'The backup list is read before step 1, so uninstall never restores its own work.',
    ].join('\n'),
  )
  .action((options: Record<string, unknown>) => {
    uninstallCommand({
      dryRun: options['dryRun'] === true,
      keepEnv: options['keepEnv'] === true,
      keepBackups: options['keepBackups'] === true,
      cwd: globalCwd(),
    })
  })

program
  .command('telemetry')
  .argument('[setting]', 'on, off, or status')
  .description('anonymous usage data: on, off, or status')
  .action((setting: string | undefined) => {
    if (setting === 'on' || setting === 'off') {
      setEnabled(setting === 'on')
      say(`Telemetry is now ${setting}.`)
      return
    }
    say(`Telemetry is ${status(program.opts()['telemetry'] === false)}.`)
    note('In this release events are written to a local file and never sent anywhere.')
    note('DO_NOT_TRACK=1 and AGENTBLOG_TELEMETRY=0 are both honoured.')
  })

program.parseAsync(process.argv).catch((error: unknown) => {
  report('error', error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})

function readVersion(): string {
  const here = dirname(fileURLToPath(import.meta.url))
  const pkg = readJson<{ version?: string }>(join(here, '..', 'package.json'))
  return pkg?.version ?? '0.0.0'
}
