/**
 * The `app/robots.ts` environment guard patcher. Doctor check 5.
 *
 * A `robots.txt` with no environment guard means every preview deployment
 * publishes an indexable robots.txt and competes with production for the same
 * content, which is the most common self-inflicted SEO wound there is and takes
 * weeks to undo once the duplicates are indexed.
 *
 * The file we ship already carries the guard, so this patcher only ever runs
 * against a file somebody has replaced or hand edited. That is exactly why it is
 * conservative: it inserts an early return as the first statement of the default
 * exported function and touches nothing else. If the default export is not a
 * function we can reach, it declines and says so rather than restructuring
 * somebody's route.
 *
 * The guard fails closed, matching the shipped file: `VERCEL_ENV` is set by
 * Vercel and by nothing else, so a non-Vercel deployment opts in with
 * `AGENTBLOG_PUBLIC_SITE=true`. Guessing wrong in the permissive direction gets
 * a staging site indexed. Guessing wrong in the restrictive direction is one
 * environment variable and is visible the moment anyone opens `/robots.txt`.
 *
 * @see https://agentblog.dev/docs/cli-reference check 5
 */
import { createProject, Node, parseFile } from './ts-project.ts'
import type { SourceFile } from './ts-project.ts'
import type { PatchResult } from './next-config.ts'

/** Either identifier proves a guard is already present. */
const GUARD_PATTERN = /VERCEL_ENV|NODE_ENV|AGENTBLOG_PUBLIC_SITE/

const GUARD_STATEMENTS = [
  '// Added by agentblog doctor --fix. Preview and development deployments block',
  '// everything, so a preview URL cannot compete with production for the same',
  '// content. Vercel sets VERCEL_ENV; nothing else does, so a deployment anywhere',
  '// else opts in with AGENTBLOG_PUBLIC_SITE=true.',
  'const isProduction =',
  "  process.env.VERCEL_ENV === 'production' || process.env.AGENTBLOG_PUBLIC_SITE === 'true'",
  'if (!isProduction) {',
  "  return { rules: [{ userAgent: '*', disallow: '/' }] }",
  '}',
].join('\n')

export function patchRobots(source: string, fileName: string): PatchResult {
  const changes: string[] = []
  const declined: string[] = []

  if (GUARD_PATTERN.test(source)) return { source, changes, declined }

  const project = createProject()
  const sourceFile = parseFile(project, `/${fileName}`, source)

  const body = findDefaultExportBody(sourceFile)
  if (!body) {
    declined.push(
      `${fileName}: the default export is not a function body this patcher can edit, so the environment guard was not added. Return { rules: [{ userAgent: '*', disallow: '/' }] } when process.env.VERCEL_ENV is not 'production'.`,
    )
    return { source, changes, declined }
  }

  body.insertStatements(0, `${GUARD_STATEMENTS}\n`)
  changes.push(`${fileName}: added the non-production environment guard`)
  return { source: sourceFile.getFullText(), changes, declined }
}

/**
 * The block statement of the default export, for the three shapes a metadata
 * route takes: a default exported function declaration, a default exported
 * identifier that resolves to a function, and a default exported arrow or
 * function expression with a block body. An arrow with a concise body is
 * declined, because inserting a guard would mean rewriting its return.
 */
function findDefaultExportBody(sourceFile: SourceFile) {
  for (const declaration of sourceFile.getFunctions()) {
    if (declaration.isDefaultExport()) {
      const body = declaration.getBody()
      if (body && Node.isBlock(body)) return body
    }
  }

  for (const assignment of sourceFile.getExportAssignments()) {
    if (assignment.isExportEquals()) continue
    let expression = assignment.getExpression()

    if (Node.isIdentifier(expression)) {
      const initializer = sourceFile.getVariableDeclaration(expression.getText())?.getInitializer()
      if (!initializer) continue
      expression = initializer
    }

    if (Node.isArrowFunction(expression) || Node.isFunctionExpression(expression)) {
      const body = expression.getBody()
      if (Node.isBlock(body)) return body
    }
  }

  return null
}
