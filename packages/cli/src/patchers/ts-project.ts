/**
 * Shared ts-morph plumbing for the config patchers.
 *
 * ===========================================================================
 * WHY THE CLI CARRIES ITS OWN TYPESCRIPT
 * ===========================================================================
 * The CLI must never resolve TypeScript from the project it is patching. It
 * rewrites `next.config.ts` in repositories whose TypeScript version we do not
 * control, and an AST tool running against a compiler it was not built for can
 * emit subtly wrong output without throwing. That is not a theoretical worry:
 * TypeScript 7.0 shipped as the native port with no public compiler API at all,
 * so a tool that reached for the consumer's `typescript` would find, on an
 * increasing share of projects, something it cannot drive.
 *
 * Verified rather than assumed: `ts-morph@28` depends on `@ts-morph/common@0.29`,
 * which **vendors its own TypeScript build** at `dist/typescript.js` (a 9 MB
 * bundle reporting `ts.version === '6.0.2'`) and does not declare `typescript`
 * as a runtime dependency at all. So ts-morph already cannot pick up the
 * consumer's compiler, and nothing here depends on module resolution luck.
 *
 * The CLI therefore does **not** declare `typescript` as a runtime dependency.
 * It used to, on the reasoning that pinning the compiler made it visible in
 * `package.json`. It did not: nothing in `src/` imports `typescript`, so the
 * declared version had no effect on what ts-morph actually ran, and it made
 * every `npm install agentblog` pull a compiler the package never loads.
 * `ts-morph` stays external and declared, because it carries the real one.
 *
 * The in-memory filesystem below matters for the same reason: `createProject`
 * never reads the consumer's `tsconfig.json`, never resolves their imports, and
 * never type checks. It parses one file, edits its syntax tree, and prints it.
 *
 * @see https://agentblog.dev/docs/cli-reference
 */
import { IndentationText, Node, Project, QuoteKind, SyntaxKind } from 'ts-morph'
import type { ArrayLiteralExpression, ObjectLiteralExpression, SourceFile } from 'ts-morph'

/**
 * A parser only project. No tsconfig, no lib files, no type checking, no disk.
 */
export function createProject(): Project {
  return new Project({
    useInMemoryFileSystem: true,
    skipFileDependencyResolution: true,
    skipLoadingLibFiles: true,
    // Single quotes, trailing commas, two space indentation. These match the
    // Prettier config the shipped block is formatted with, so a patched file
    // does not turn into a reformatting diff the next time Prettier runs.
    manipulationSettings: {
      quoteKind: QuoteKind.Single,
      useTrailingCommas: true,
      indentationText: IndentationText.TwoSpaces,
    },
    compilerOptions: { allowJs: true },
  })
}

export function parseFile(project: Project, path: string, source: string): SourceFile {
  return project.createSourceFile(path, source, { overwrite: true })
}

/**
 * Follow `export default X` to the object literal it ultimately refers to.
 *
 * Handles the four shapes a real `next.config.*` takes: a literal exported
 * directly, a `const` exported by name, a literal wrapped in `withPlugin(...)`,
 * and `module.exports = {}` in a `.js` config. Returns `null` when the config is
 * shaped in a way we cannot edit safely, and the caller reports that rather than
 * guessing.
 */
export function findExportedObject(sourceFile: SourceFile): ObjectLiteralExpression | null {
  return findExportedConfig(sourceFile).object
}

/** The object to edit, or the reason there is not one we can edit safely. */
export interface ExportedConfig {
  readonly object: ObjectLiteralExpression | null
  /** Set when the shape is recognisable but unsafe. Printed by the caller. */
  readonly declined: string | null
}

export function findExportedConfig(sourceFile: SourceFile): ExportedConfig {
  for (const assignment of sourceFile.getExportAssignments()) {
    const resolved = resolveObject(assignment.getExpression(), sourceFile)
    if (resolved.object || resolved.declined) return resolved
  }

  // `module.exports = { ... }`
  for (const statement of sourceFile.getStatements()) {
    if (!Node.isExpressionStatement(statement)) continue
    const expression = statement.getExpression()
    if (!Node.isBinaryExpression(expression)) continue
    if (expression.getOperatorToken().getKind() !== SyntaxKind.EqualsToken) continue
    if (!/^module\.exports$/.test(expression.getLeft().getText())) continue
    const resolved = resolveObject(expression.getRight(), sourceFile)
    if (resolved.object || resolved.declined) return resolved
  }

  return { object: null, declined: null }
}

/** Unwrap casts, parentheses, plugin wrappers, and identifiers. */
function resolveObject(node: Node, sourceFile: SourceFile, depth = 0): ExportedConfig {
  if (depth > 6) return { object: null, declined: null }

  if (Node.isObjectLiteralExpression(node)) return { object: node, declined: null }
  if (Node.isParenthesizedExpression(node) || Node.isAsExpression(node)) {
    return resolveObject(node.getExpression(), sourceFile, depth + 1)
  }
  if (Node.isSatisfiesExpression(node)) {
    return resolveObject(node.getExpression(), sourceFile, depth + 1)
  }
  if (Node.isCallExpression(node)) {
    if (isObjectAssignCall(node)) return resolveObjectAssign(node, sourceFile, depth)
    // `export default withMDX(nextConfig)`: the config is an argument.
    for (const argument of node.getArguments()) {
      const resolved = resolveObject(argument, sourceFile, depth + 1)
      if (resolved.object || resolved.declined) return resolved
    }
    return { object: null, declined: null }
  }
  if (Node.isIdentifier(node)) {
    const declaration = sourceFile.getVariableDeclaration(node.getText())
    const initializer = declaration?.getInitializer()
    return initializer
      ? resolveObject(initializer, sourceFile, depth + 1)
      : { object: null, declined: null }
  }
  return { object: null, declined: null }
}

function isObjectAssignCall(node: Node): boolean {
  if (!Node.isCallExpression(node)) return false
  return /^Object\s*\.\s*assign$/.test(node.getExpression().getText().replace(/\s+/g, ' ').trim())
}

/**
 * `Object.assign(target, ...sources)`: which argument, if any, provably wins.
 *
 * ---------------------------------------------------------------------------
 * THE SAME HAZARD AS A SPREAD, ARRIVING THROUGH A DIFFERENT SYNTAX
 * ---------------------------------------------------------------------------
 * The generic call handling above walks arguments in order and takes the first
 * object literal it finds. For `Object.assign({}, real)` that is the empty
 * first argument, so the patch landed in the argument every later source
 * overrides, and the run reported "added htmlLimitedBots" while the effective
 * runtime value was untouched. `spreadRiskFor` already documents exactly this
 * failure for `{ ...base }`; `Object.assign` simply was not covered.
 *
 * Later sources win, so the only argument that provably wins is the last one,
 * and only when it is a literal we can read. Anything else (a last argument
 * that is an identifier, a call, a spread of arguments) is unreadable from
 * here, so we decline and say which call we declined on.
 */
function resolveObjectAssign(node: Node, sourceFile: SourceFile, depth: number): ExportedConfig {
  if (!Node.isCallExpression(node)) return { object: null, declined: null }
  const args = node.getArguments()
  const last = args.at(-1)

  if (last && !Node.isSpreadElement(last)) {
    const resolved = resolveObject(last, sourceFile, depth + 1)
    // Only a literal written in place wins. An identifier that resolves to a
    // literal declared elsewhere is shared, and editing it changes every other
    // use of that object too.
    if (resolved.object && resolved.object.getSourceFile() === sourceFile) {
      const inLastArgument = last.getStart() <= resolved.object.getStart()
      if (inLastArgument && resolved.object.getEnd() <= last.getEnd()) return resolved
    }
  }

  return {
    object: null,
    declined:
      'the config is built with `Object.assign(...)`, where a later argument silently overrides an earlier one. The last argument is not an object literal we can write into, so writing anywhere would produce a file that reads as if the setting is in force while the runtime value comes from somewhere else. Add the settings to the last argument by hand, or export a plain object literal and re-run.',
  }
}

/**
 * A duplicate `name` in this literal, described for a decline message.
 *
 * ---------------------------------------------------------------------------
 * WHY A DUPLICATE KEY IS A DECLINE AND NOT A MERGE
 * ---------------------------------------------------------------------------
 * `getProperty` returns the first match; JavaScript keeps the last. So a config
 * holding
 *
 *     htmlLimitedBots: /Googlebot/i,
 *     htmlLimitedBots: /AcmeCorpBot|InternalCrawler/i,
 *
 * had its FIRST occurrence rewritten with the full union, the second left
 * exactly as it was, and the run reported "widened htmlLimitedBots to a
 * superset". The effective runtime value still matched zero AI crawlers and
 * zero Next.js defaults. With `htmlLimitedBots: MY_BOTS` as the second entry it
 * is worse still: the unreadable-identifier decline never fires, because the
 * reader only ever saw the readable first one.
 *
 * There is no correct merge here. Which occurrence the author meant is not
 * recoverable from the file, so both are named and nothing is written.
 */
export function duplicateKeyRisk(object: ObjectLiteralExpression, name: string): string | null {
  const matches = object.getProperties().filter((property) => {
    if (
      Node.isPropertyAssignment(property) ||
      Node.isShorthandPropertyAssignment(property) ||
      Node.isMethodDeclaration(property) ||
      Node.isGetAccessorDeclaration(property) ||
      Node.isSetAccessorDeclaration(property)
    ) {
      return property.getName() === name
    }
    return false
  })
  if (matches.length < 2) return null

  const where = matches
    .map((property) => `line ${property.getStartLineNumber()} (${summarizeProperty(property)})`)
    .join(' and ')
  return `\`${name}\` is set ${matches.length} times, at ${where}. JavaScript keeps the last one, so editing any of them leaves the effective value somewhere else`
}

function summarizeProperty(property: Node): string {
  const text = property.getText().replace(/\s+/g, ' ').trim()
  return text.length > 48 ? `${text.slice(0, 45)}...` : text
}

/** The property assignment for `name`, or `null`. Shorthand is not resolved. */
export function getProperty(object: ObjectLiteralExpression, name: string) {
  const property = object.getProperty(name)
  return property && Node.isPropertyAssignment(property) ? property : null
}

/** Read a property's initializer text, comments and all. */
export function getPropertyText(object: ObjectLiteralExpression, name: string): string | null {
  return getProperty(object, name)?.getInitializer()?.getText() ?? null
}

/**
 * Set a property, adding it when absent. Returns `true` when the file changed.
 *
 * `initializerText` is emitted verbatim, which is how a `RegExp` literal stays a
 * `RegExp` literal. Next.js 16's config schema for `htmlLimitedBots` is
 * `z.instanceof(RegExp)`, so writing the pattern as a string fails config
 * validation outright.
 */
export function setProperty(
  object: ObjectLiteralExpression,
  name: string,
  initializerText: string,
): boolean {
  const existing = getProperty(object, name)
  if (existing) {
    if (existing.getInitializer()?.getText() === initializerText) return false
    existing.setInitializer(initializerText)
    return true
  }
  object.addPropertyAssignment({ name, initializer: initializerText })
  return true
}

/**
 * The spread element that could be supplying `name`, or `null` when none can.
 *
 * ---------------------------------------------------------------------------
 * WHY A SPREAD IS A WRITE HAZARD AND NOT A DETAIL
 * ---------------------------------------------------------------------------
 * `{ ...base }` merges at runtime, and a key written after the spread wins. So
 * appending `htmlLimitedBots` to an object that spreads something carrying the
 * same key does not widen anything: it replaces the value, while the spread
 * stays on screen above it looking like the authoritative source. The user
 * reads a file that says one thing and runs an application that does another,
 * and nothing reports it.
 *
 * The one case that is safe to write through is a spread of an object literal
 * declared in the same file, because then we can read it and see whether the
 * key is there. Everything else (an import, a call, a nested spread) is
 * unreadable from here, so the caller declines and says so.
 *
 * Returns a short description of the offending spread, for the decline message.
 */
export function spreadRiskFor(object: ObjectLiteralExpression, name: string): string | null {
  const properties = object.getProperties()
  const lastSpread = properties.reduce<number>(
    (found, property, index) => (Node.isSpreadAssignment(property) ? index : found),
    -1,
  )
  if (lastSpread === -1) return null

  // An explicit property after the last spread wins at runtime, so editing it is
  // safe no matter what the spread carries.
  const explicit = properties.findIndex(
    (property) => Node.isPropertyAssignment(property) && property.getName() === name,
  )
  if (explicit > lastSpread) return null

  for (const property of properties) {
    if (!Node.isSpreadAssignment(property)) continue
    const expression = property.getExpression()
    const resolved = Node.isIdentifier(expression)
      ? resolveLocalObjectLiteral(expression)
      : Node.isObjectLiteralExpression(expression)
        ? expression
        : null
    if (resolved && !hasKeyOrSpread(resolved, name)) continue
    return `the spread \`...${expression.getText().slice(0, 40)}\``
  }
  return null
}

/** An identifier declared in this file whose initializer is an object literal. */
function resolveLocalObjectLiteral(identifier: Node): ObjectLiteralExpression | null {
  const sourceFile = identifier.getSourceFile()
  const initializer = sourceFile.getVariableDeclaration(identifier.getText())?.getInitializer()
  return initializer && Node.isObjectLiteralExpression(initializer) ? initializer : null
}

/** `true` when the literal sets `name`, or spreads anything that might. */
function hasKeyOrSpread(object: ObjectLiteralExpression, name: string): boolean {
  return object.getProperties().some((property) => {
    if (Node.isSpreadAssignment(property)) return true
    if (Node.isPropertyAssignment(property) || Node.isShorthandPropertyAssignment(property)) {
      return property.getName() === name
    }
    return false
  })
}

/** The nested object literal at `name`, created empty when absent. */
export function getOrCreateObject(
  object: ObjectLiteralExpression,
  name: string,
): ObjectLiteralExpression | null {
  const existing = getProperty(object, name)
  if (existing) {
    const initializer = existing.getInitializer()
    return initializer && Node.isObjectLiteralExpression(initializer) ? initializer : null
  }
  const added = object.addPropertyAssignment({ name, initializer: '{}' })
  const initializer = added.getInitializer()
  return initializer && Node.isObjectLiteralExpression(initializer) ? initializer : null
}

export function getArray(
  object: ObjectLiteralExpression,
  name: string,
): ArrayLiteralExpression | null {
  const initializer = getProperty(object, name)?.getInitializer()
  return initializer && Node.isArrayLiteralExpression(initializer) ? initializer : null
}

/**
 * A value as a single quoted TypeScript string literal, escaped properly.
 *
 * ---------------------------------------------------------------------------
 * WHY NOT `'${value}'`
 * ---------------------------------------------------------------------------
 * Every value this CLI writes into a user's source file comes from somewhere
 * outside it: a flag, `agentblog.config.ts`, or a repository that was cloned.
 * The layout patcher used to build `new URL('${siteUrl}')` and
 * `'%s | ${brandName}'` by concatenation, so a value carrying a quote closed
 * the literal and everything after it was emitted as code. Nothing stopped
 * that except the character class of an unrelated regular expression in
 * `doctor/fix.ts`, which happened to exclude quotes. That is a coincidence, not
 * a design.
 *
 * Single quotes rather than `JSON.stringify` only because the shipped block is
 * Prettier formatted with `singleQuote: true`, and a patched file that turns
 * into a reformatting diff is its own small betrayal. The escaping is the
 * complete set: backslash, the quote itself, the C0 range, and the two line
 * terminators that are legal raw inside a JavaScript string but not inside a
 * source line.
 */
export function tsStringLiteral(value: string): string {
  // eslint-disable-next-line no-control-regex
  const escaped = value.replace(/[\\'\u0000-\u001f\u2028\u2029]/g, (char) => {
    if (char === '\\') return '\\\\'
    if (char === "'") return "\\'"
    if (char === '\n') return '\\n'
    if (char === '\r') return '\\r'
    if (char === '\t') return '\\t'
    return `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`
  })
  return `'${escaped}'`
}

/** Whitespace normalized source text, for structural comparison of literals. */
export function normalizeText(text: string): string {
  return text.replace(/\s+/g, '').replace(/,}/g, '}').replace(/,\]/g, ']')
}

export { Node, SyntaxKind }
export type { ObjectLiteralExpression, SourceFile }
