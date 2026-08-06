/**
 * AGENTS.md placement, house copy style, and the content source contract.
 *
 * Covers doctor checks 18, 20, and 29.
 *
 * Check 20 has three parts and they fail in different ways. Our block inside the
 * Next.js managed markers gets silently deleted on the next `next dev`. A
 * `CLAUDE.md` written by us duplicates our rules into the agent's context, since
 * Next generates that file containing `@AGENTS.md`. And `agentRules: false` in
 * `next.config` means Next writes nothing at all, so our block becomes the only
 * agent instruction in the project, which the user should know rather than
 * assume.
 *
 * @see https://agentblog.dev/docs/agent-layer
 */
import { join } from 'node:path'

import { AGENTBLOG_BLOCK_BEGIN, NEXT_AGENT_RULES_END } from '../constants.ts'
import { locateBlock, stripNextManagedRegion } from '../patchers/agents-md.ts'
import { hasAgentRulesDisabled } from '../patchers/next-config.ts'
import { readFile, walk } from '../util/fs.ts'
import { appPath } from '../detect/project.ts'
import { findCopyStyleIssues } from '../audit/copy-style.ts'
import type { DoctorContext } from './context.ts'

export function runAgentsChecks(ctx: DoctorContext): void {
  checkAgentsMd(ctx)
  checkCopyStyle(ctx)
  checkContentSource(ctx)
}

function checkAgentsMd(ctx: DoctorContext): void {
  ctx.reporter.group('AGENTS.md')

  const path = join(ctx.project.root, 'AGENTS.md')
  const source = readFile(path)

  if (source === null) {
    ctx.reporter.fail('20 AGENTS.md block', {
      id: 'agents-md-missing',
      severity: 'warning',
      message:
        'AGENTS.md does not exist, so no coding agent in this repository knows the blog rules.',
      remedy: 'npx agentblog init, or run doctor --fix.',
      fixable: true,
    })
  } else {
    const position = locateBlock(source)
    if (!position.present) {
      ctx.reporter.fail('20 AGENTS.md block', {
        id: 'agents-block-missing',
        severity: 'warning',
        message: `AGENTS.md exists but has no ${AGENTBLOG_BLOCK_BEGIN} block.`,
        remedy: 'npx agentblog doctor --fix',
        fixable: true,
      })
    } else if (position.insideNextBlock) {
      ctx.reporter.fail('20 AGENTS.md block', {
        id: 'agents-block-inside-next-markers',
        severity: 'error',
        message: `The AgentBlog block sits inside or before ${NEXT_AGENT_RULES_END}. Next.js rewrites that region on every \`next dev\`, so the block will be deleted without warning.`,
        remedy: 'npx agentblog doctor --fix moves it after the END marker.',
        fixable: true,
      })
    } else {
      ctx.reporter.pass('20 the AgentBlog block sits after the Next.js managed region')
    }
  }

  // We never write CLAUDE.md. If one exists and carries our marker, a previous
  // version or a hand edit put it there, and it now duplicates our rules.
  const claude = readFile(join(ctx.project.root, 'CLAUDE.md'))
  if (claude !== null && claude.includes(AGENTBLOG_BLOCK_BEGIN)) {
    ctx.reporter.fail('20 CLAUDE.md', {
      id: 'claude-md-has-our-block',
      severity: 'warning',
      message:
        'CLAUDE.md contains an AgentBlog block. Next.js generates that file containing @AGENTS.md, which already imports our block, so the rules are now in context twice.',
      remedy: 'Delete the AgentBlog block from CLAUDE.md. AGENTS.md is the only file we write.',
    })
  }

  const nextConfigSource = ctx.project.nextConfigPath ? readFile(ctx.project.nextConfigPath) : null
  if (nextConfigSource && hasAgentRulesDisabled(nextConfigSource)) {
    ctx.reporter.fail('20 agentRules', {
      id: 'agent-rules-disabled',
      severity: 'info',
      message:
        'next.config sets agentRules: false, so Next.js writes no agent instructions. The AgentBlog block is the only agent guidance in this project.',
      remedy:
        'Nothing to fix. Keep the AgentBlog block current, since nothing else covers this repo.',
    })
  }
}

/**
 * Check 29. The em dash is the most recognizable tell of machine written prose,
 * and a product that sells AI assisted writing cannot ship copy that reads as AI
 * generated. The same check runs per post in `agentblog audit`.
 *
 * Scope, precisely: `AGENTS.md` and `content/blog/**` in the consumer's project.
 * It does not read registry `docs` strings, because a consumer has no registry.
 * The repo level `scripts/assert-copy-style.mjs` covers those, and it runs where
 * the registry actually lives.
 */
function checkCopyStyle(ctx: DoctorContext): void {
  ctx.reporter.group('Copy style')

  // Posts and AGENTS.md only. Documentation that discusses the banned words is
  // not a violation of the rule about them, and flagging it would teach people
  // to ignore this check.
  const targets = [
    join(ctx.project.root, 'AGENTS.md'),
    ...walk(appPath(ctx.project, 'content/blog'), { extensions: ['.mdx', '.md'] }),
  ]

  const offenders: string[] = []
  let checked = 0
  for (const path of targets) {
    const raw = readFile(path)
    if (raw === null) continue
    checked += 1
    // Next.js owns its own region of AGENTS.md and rewrites it on every
    // `next dev`, so its wording is not the user's to fix.
    const source = path.endsWith('AGENTS.md') ? stripNextManagedRegion(raw) : raw
    const issues = findCopyStyleIssues(source)
    if (issues.length > 0) {
      offenders.push(`${path.split('/').pop() ?? path}: ${issues.map((i) => i.what).join(', ')}`)
    }
  }

  if (checked === 0) {
    ctx.reporter.skip(
      '29 copy style in AGENTS.md and content/blog',
      'no AGENTS.md and no content files to check',
    )
    return
  }
  if (offenders.length > 0) {
    ctx.reporter.fail('29 copy style in AGENTS.md and content/blog', {
      id: 'copy-style',
      severity: 'warning',
      message: `House copy style violations: ${offenders.slice(0, 5).join('; ')}${offenders.length > 5 ? `, and ${offenders.length - 5} more files` : ''}.`,
      remedy: 'npx agentblog audit for the per-post detail, with line numbers.',
    })
    return
  }
  ctx.reporter.pass('29 no em dashes and no banned phrasing in AGENTS.md or the content')
}

/**
 * Check 18, as far as static reading can take it.
 *
 * Executing `agentblog.config.ts` to read `source.prerenderStrategy` would mean
 * running the user's code and resolving their `@/` aliases, which is a large
 * amount of machinery for one field. Instead we recognize the sources we ship
 * and, for anything else, say plainly that we could not determine it rather than
 * pass a check we did not run.
 */
function checkContentSource(ctx: DoctorContext): void {
  ctx.reporter.group('Content source')

  if (!ctx.project.agentblogConfigPath) {
    ctx.reporter.skip('18 prerender strategy', 'agentblog.config.ts is not installed')
    return
  }
  const source = readFile(ctx.project.agentblogConfigPath)
  if (source === null) {
    ctx.reporter.skip('18 prerender strategy', 'agentblog.config.ts could not be read')
    return
  }

  const sourceCall = /source\s*:\s*([A-Za-z_$][\w$]*)\s*\(/.exec(source)?.[1]
  const hasDeployHook = /deployHook\s*:/.test(source)

  if (!sourceCall) {
    ctx.reporter.fail('18 prerender strategy', {
      id: 'content-source-unreadable',
      severity: 'warning',
      message: 'Could not find a content source call in agentblog.config.ts.',
      remedy: 'Set source to an adapter, for example mdxSource({ dir: "content/blog" }).',
    })
    return
  }

  if (sourceCall === 'mdxSource') {
    ctx.reporter.pass(
      '18 mdxSource declares prerenderStrategy "build", so no deploy hook is needed',
    )
    return
  }

  if (hasDeployHook) {
    ctx.reporter.pass(`18 ${sourceCall} is paired with a deployHook`)
    return
  }
  ctx.reporter.fail('18 prerender strategy', {
    id: 'deploy-hook-unverified',
    severity: 'info',
    message: `The content source is ${sourceCall}, which is not one we ship, and no deployHook is set. If that adapter declares prerenderStrategy "deploy-hook", publishing will ping crawlers at URLs that were never prerendered.`,
    remedy: 'Check the adapter, and set deployHook if it needs a rebuild before publish.',
  })
}
