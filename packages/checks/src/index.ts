/**
 * `@agentblog/checks`: configuration predicates.
 *
 * Every predicate lives in one dependency-free file, `core.ts`, which
 * `scripts/codegen.mjs` copies verbatim into the shipped block so that
 * `agentblog doctor` and the consumer's build-time `lib/preflight.ts` cannot
 * drift apart and disagree in front of a user.
 *
 * They cannot share code by import: `doctor` runs from this package with a full
 * `node_modules`, and `preflight` runs inside the consumer's app with only the
 * files the registry wrote. A verbatim copy plus a CI drift check gives the same
 * single-source-of-truth guarantee without the impossible import.
 */
export {
  AI_CRAWLER_UAS,
  AI_CRAWLERS,
  type AiCrawler,
  analyzeHtmlLimitedBots,
  blankCommentsAndStrings,
  buildHtmlLimitedBotsPattern,
  bySeverity,
  checkNextConfig,
  checkRootLayout,
  type Finding,
  hasErrors,
  type HtmlLimitedBotsReport,
  missingBranches,
  NEXT_DEFAULT_HTML_LIMITED_BOTS,
  NEXT_DEFAULT_HTML_LIMITED_BOTS_VERSION,
  type NextConfigInput,
  type Severity,
  stripComments,
} from './core.ts'
