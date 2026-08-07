/**
 * Constants shared across commands: markers, paths, and the AGENTS.md block.
 *
 * The marker strings are the contract between us and Next.js. Next 16.3 writes
 * `AGENTS.md` and `CLAUDE.md` on `next dev` and rewrites everything between its
 * own BEGIN and END markers on every run, preserving what sits outside them. Our
 * block therefore has to sit strictly after `END:nextjs-agent-rules`, and we
 * never write `CLAUDE.md` at all: Next generates it containing `@AGENTS.md`,
 * which already imports our block, so writing there duplicates our rules into
 * the agent's context twice and invites `next dev` to overwrite us.
 *
 * @see https://docs.agentblog.dev/guides/write-with-your-agent
 */

/** Next.js owns everything between these two lines. We never write inside them. */
export const NEXT_AGENT_RULES_BEGIN = '<!-- BEGIN:nextjs-agent-rules -->'
export const NEXT_AGENT_RULES_END = '<!-- END:nextjs-agent-rules -->'

/** Our own block markers. Everything between them is ours to replace. */
export const AGENTBLOG_BLOCK_BEGIN = '<!-- agentblog:start -->'
export const AGENTBLOG_BLOCK_END = '<!-- agentblog:end -->'

/**
 * The rules fragment the `agent` registry item installs at the project root.
 *
 * It is a delivery vehicle, not a file anything reads at runtime: an agent
 * loads `AGENTS.md` (via the `CLAUDE.md` that Next.js generates), never this.
 * `init` and `doctor --fix` merge its block into `AGENTS.md`, which is what its
 * own install note has always told users to do.
 */
export const AGENTS_FRAGMENT_PATH = 'AGENTS.agentblog.md'

/**
 * The author slug the config template ships with.
 *
 * It deliberately matches no record in `content/authors.json`, so a post that
 * omits `author` fails the build by name rather than rendering with a phantom
 * byline. Three readers have to agree on it: the patcher that replaces it at
 * install time, the scaffolder that refuses to write it into new frontmatter,
 * and the doctor check that reports it as an unfired build failure. It lives
 * here so those three cannot drift.
 *
 * Keep in sync with `apps/web/registry/blog/agentblog.config.ts`.
 */
export const PLACEHOLDER_AUTHOR = 'your-name'

/** Where `init` and `doctor --fix` copy a file before touching it. */
export const BACKUP_DIR = '.agentblog/backup'

/** Records which files AgentBlog wrote, so `doctor` can tell ours from theirs. */
export const MANIFEST_PATH = '.agentblog/manifest.json'

/** Registry items `init` installs, in dependency order. */
export const BLOG_REGISTRY_ITEM = '@agentblog/blog'

/** Content source items, keyed by the answer to the source prompt. */
export const SOURCE_REGISTRY_ITEMS: Readonly<Record<string, string>> = {
  mdx: '@agentblog/source-mdx',
}

/** Route files that must exist after an install. See `checkRouteFiles`. */
export const REQUIRED_ROUTE_FILES = [
  'app/blog/page.tsx',
  'app/blog/[slug]/page.tsx',
  'app/sitemap.ts',
  'app/robots.ts',
] as const

/**
 * Every file AgentBlog ships under `app/blog/**`, as project relative paths.
 *
 * This is the fallback for the route collision check when no install manifest
 * exists, which is exactly what a registry-only install produces: `shadcn add`
 * writes the files and never writes a manifest, because it does not know about
 * one. Without this list, every file we just installed reads as somebody else's
 * blog and `doctor` reports a collision with itself.
 *
 * Keep in sync with `apps/web/registry/blog/registry.json`. The e2e install test
 * in CI catches a mismatch, because a stale entry here shows up immediately as a
 * false collision against a clean install.
 */
export const AGENTBLOG_BLOG_FILES = [
  'app/blog/layout.tsx',
  'app/blog/page.tsx',
  'app/blog/[slug]/page.tsx',
  'app/blog/[slug]/opengraph-image.tsx',
  'app/blog/category/[slug]/page.tsx',
  'app/blog/tag/[slug]/page.tsx',
] as const

/** Env keys AgentBlog introduces. Both are secrets and neither belongs in git. */
export const AGENTBLOG_ENV_KEYS = ['INDEXNOW_KEY', 'AGENTBLOG_REVALIDATE_SECRET'] as const

/* -------------------------------------------------------------------------- */
/*  The env comments the CLI writes, as one closed set                         */
/* -------------------------------------------------------------------------- */

/**
 * Every comment this CLI ever writes above an env key.
 *
 * ===========================================================================
 * WHY THIS IS A LIST AND NOT A HEURISTIC
 * ===========================================================================
 * `removeEnvKeys` used to drop whatever comment line sat immediately above a
 * key it was deleting, on the reasoning that it must be one we wrote. It is
 * not. A user's `# my own note about the API base` above `INDEXNOW_KEY` was
 * deleted by `uninstall` and by the `--fix` secret move, and nothing reported
 * it, because from the remover's point of view nothing had gone wrong.
 *
 * The CLI writes its comments from exactly one place, so it can afford to know
 * them by sight. Anything not on this list belongs to the user and stays.
 * Adding a new comment anywhere means adding it here too, and
 * `packages/cli/src/patchers/env.ts` is the only reader.
 */
export const INDEXNOW_KEY_COMMENT =
  'IndexNow. The matching public/<key>.txt must stay deployed or submissions 403.'

export const REVALIDATE_SECRET_COMMENT =
  'Shared secret for POST /api/publish. Set the same value on your deployment.'

/** `doctor --fix` writes this when it relocates a secret out of a tracked file. */
export function movedOutOfComment(file: string): string {
  return `Moved out of ${file} by agentblog doctor --fix. Rotate this if it was ever pushed.`
}

/**
 * `true` when the line is a comment this CLI wrote.
 *
 * The leading `#` and any indentation are ignored, so a reformatted file still
 * matches, and the `Moved out of <file>` variant is matched by shape because
 * the file name in it is not known ahead of time.
 */
export function isAgentBlogEnvComment(line: string): boolean {
  const text = line.trim()
  if (!text.startsWith('#')) return false
  const body = text.replace(/^#+\s*/, '')
  if (body === INDEXNOW_KEY_COMMENT || body === REVALIDATE_SECRET_COMMENT) return true
  return /^Moved out of \S+ by agentblog doctor --fix\. Rotate this if it was ever pushed\.$/.test(
    body,
  )
}

/**
 * The message `init` prints instead of running `shadcn init` for the user.
 *
 * `shadcn init` picks a component base, sets a baseColor, and writes CSS
 * variables into their stylesheet. That is choosing a design system on their
 * behalf inside a command they ran to install a blog. Refusing costs one screen
 * of output and keeps the promise that AgentBlog inherits a theme rather than
 * replacing one.
 *
 * @see https://docs.agentblog.dev/installation
 */
export const NO_COMPONENTS_JSON_MESSAGE = [
  'AgentBlog builds on shadcn/ui, and it inherits your theme rather than replacing it.',
  'Run `npx shadcn@latest init` first, then re-run this command. It will ask you to pick',
  'a base color and component library. Those are your choices, not ours.',
].join('\n')

/** shadcn publishes the migration path; we link it rather than restating it. */
export const TAILWIND_V4_MIGRATION_URL = 'https://ui.shadcn.com/docs/tailwind-v4'

/**
 * The AGENTS.md block, built with the skill invocation that matches how the
 * project was installed.
 *
 * The skill is referred to by name rather than by slash command because the
 * command differs between install paths (`/write-blog-post` for a registry
 * install, `/agentblog:write-blog-post` for the plugin). The CLI is the only
 * thing that knows which path was taken, so it writes the right one.
 */
export function buildAgentsBlock(input: {
  readonly contentDir: string
  readonly skillCommand: string
}): string {
  return [
    AGENTBLOG_BLOCK_BEGIN,
    '## Blog (AgentBlog)',
    '',
    `Posts live in \`${input.contentDir}/*.mdx\`. Config: \`agentblog.config.ts\`.`,
    '',
    `- To write a post, use the AgentBlog write-blog-post skill (${input.skillCommand}). Do not hand-write posts.`,
    '- Never remove or narrow `htmlLimitedBots` in `next.config.ts`. It must remain a superset of',
    "  Next.js's default bot list plus the AI crawlers. Narrowing it breaks Google, Bing, and social",
    '  previews as well as AI citation.',
    "- Never add `'use client'` to anything in the article render path.",
    '- `generateStaticParams` in `app/blog/[slug]/page.tsx` must return every slug, never a slice.',
    '- Do not use em dashes in post copy. Use a comma, a colon, parentheses, or a full stop.',
    '- Run `npx agentblog audit` before committing a post.',
    AGENTBLOG_BLOCK_END,
    '',
  ].join('\n')
}
