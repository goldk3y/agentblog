/**
 * Filling in `agentblog.config.ts` after the registry has written the template.
 *
 * The rule that shapes this file: we replace placeholders, never answers. The
 * template ships with `https://yourdomain.com`, `Your Brand`, and `your-name`,
 * and those are the only values `init` is willing to overwrite. Anything else is
 * something the user or a previous run decided, so a second `init` reads its own
 * output, finds no placeholders, and changes nothing.
 *
 * The file is edited with ts-morph rather than string replacement so the long
 * explanatory comments in the template survive. Those comments are the config
 * documentation for both a human and a coding agent, and a patcher that ate them
 * would make the file worse every time it ran.
 *
 * @see https://docs.agentblog.dev/reference/configuration
 */
import {
  createProject,
  getOrCreateObject,
  getProperty,
  Node,
  parseFile,
  setProperty,
} from './ts-project.ts'
import type { ObjectLiteralExpression, SourceFile } from './ts-project.ts'
import type { PatchResult } from './next-config.ts'

/** Values the template ships with. Only these are ever overwritten. */
const PLACEHOLDERS = new Set(['https://yourdomain.com', 'Your Brand', 'your-name', ''])

export interface ConfigValues {
  readonly siteUrl?: string
  readonly brandName?: string
  readonly defaultAuthor?: string
  readonly indexnowKey?: string
}

export function patchAgentblogConfig(
  source: string,
  fileName: string,
  values: ConfigValues,
): PatchResult {
  const project = createProject()
  const sourceFile = parseFile(project, `/${fileName}`, source)
  const config = findConfigObject(sourceFile)

  const changes: string[] = []
  const declined: string[] = []

  if (!config) {
    return {
      source,
      changes,
      declined: [
        `${fileName}: could not find the object passed to defineConfig(...), so nothing was filled in. Edit the file by hand.`,
      ],
    }
  }

  if (values.siteUrl) setStringIfPlaceholder(config, 'siteUrl', values.siteUrl, changes, declined)
  if (values.defaultAuthor) {
    setStringIfPlaceholder(config, 'defaultAuthor', values.defaultAuthor, changes, declined)
  }

  if (values.brandName) {
    const brand = getOrCreateObject(config, 'brand')
    if (brand) setStringIfPlaceholder(brand, 'name', values.brandName, changes, declined, 'brand.')
    else
      declined.push(`${fileName}: \`brand\` is not an object literal, so brand.name was skipped.`)
  }

  if (values.indexnowKey) {
    const indexnow = getOrCreateObject(config, 'indexnow')
    if (!indexnow) {
      declined.push(`${fileName}: \`indexnow\` is not an object literal, so it was skipped.`)
    } else if (getProperty(indexnow, 'key')) {
      declined.push(`${fileName}: indexnow.key is already set. Left alone.`)
    } else {
      // The key itself stays out of the committed file. `lib/indexnow.ts` reads
      // the config first and falls back to process.env.INDEXNOW_KEY.
      setProperty(indexnow, 'enabled', 'true')
      changes.push(`${fileName}: enabled IndexNow (the key is read from INDEXNOW_KEY)`)
    }
  }

  return { source: sourceFile.getFullText(), changes, declined }
}

function setStringIfPlaceholder(
  object: ObjectLiteralExpression,
  name: string,
  value: string,
  changes: string[],
  declined: string[],
  labelPrefix = '',
): void {
  const property = getProperty(object, name)
  const initializer = property?.getInitializer()

  if (initializer && Node.isStringLiteral(initializer)) {
    const current = initializer.getLiteralValue()
    if (!PLACEHOLDERS.has(current)) {
      declined.push(`agentblog.config: ${labelPrefix}${name} is already "${current}". Left alone.`)
      return
    }
  } else if (property) {
    declined.push(`agentblog.config: ${labelPrefix}${name} is not a plain string. Left alone.`)
    return
  }

  if (setProperty(object, name, `'${value.replace(/'/g, "\\'")}'`)) {
    changes.push(`agentblog.config: set ${labelPrefix}${name} to ${value}`)
  }
}

/** The object literal passed to `defineConfig(...)` in the default export. */
function findConfigObject(sourceFile: SourceFile): ObjectLiteralExpression | null {
  for (const assignment of sourceFile.getExportAssignments()) {
    const expression = assignment.getExpression()
    if (Node.isCallExpression(expression)) {
      const first = expression.getArguments()[0]
      if (first && Node.isObjectLiteralExpression(first)) return first
    }
    if (Node.isObjectLiteralExpression(expression)) return expression
  }
  return null
}

/**
 * `true` when the config is wrapped in `defineConfig(...)`.
 *
 * Doctor check 26. Without the wrapper the contextual inference that makes
 * `deployHook` required for a source that cannot publish without a rebuild never
 * runs, and the failure it prevents (pinging a crawler at a URL that was never
 * prerendered) comes back.
 */
export function usesDefineConfig(source: string): boolean {
  const project = createProject()
  const sourceFile = parseFile(project, '/agentblog.config.ts', source)
  for (const assignment of sourceFile.getExportAssignments()) {
    const expression = assignment.getExpression()
    if (Node.isCallExpression(expression)) {
      return expression.getExpression().getText().endsWith('defineConfig')
    }
  }
  return false
}
