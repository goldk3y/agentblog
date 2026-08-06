/**
 * Reading a route file the way the checks need it.
 *
 * A route file is not always the file that holds the logic: the dogfood shims in
 * this repository and any consumer who wraps our page both re-export it. Every
 * accessor here follows that one hop, so a check reads real code rather than an
 * export line and reports the file that actually holds the problem.
 */
import { Node, createProject, parseFile } from '../patchers/ts-project.ts'
import type { SourceFile } from '../patchers/ts-project.ts'
import { appPath, appPathLabel } from '../detect/project.ts'
import { followDefault } from '../detect/resolve.ts'
import { readFile, toPosixRelative } from '../util/fs.ts'
import type { DoctorContext } from './context.ts'

export function parse(path: string, source: string): SourceFile {
  return parseFile(createProject(), `/${path.replace(/^\.?\//, '')}`, source)
}

/**
 * Read a route file, following a re-export to the module that holds the real
 * implementation. A route that re-exports ours (the dogfood shims here, or a
 * consumer wrapping our page) would otherwise read as an empty file and produce
 * a page of false errors.
 */
export function readRoute(
  ctx: DoctorContext,
  relativePath: string,
  checkName: string,
): { source: string; label: string; parsePath: string } | null {
  const label = appPathLabel(ctx.project, relativePath)
  const path = appPath(ctx.project, relativePath)
  const source = readFile(path)
  if (source === null) {
    ctx.reporter.skip(checkName, `${label} is not installed`)
    return null
  }

  const resolved = followDefault(ctx.project, path, source)
  return {
    source: resolved.source,
    // Messages name the file that actually holds the code, so a reader is not
    // sent to a one line re-export to look for a problem that is not there.
    label: resolved.viaReExport ? toPosixRelative(ctx.project.root, resolved.path) : label,
    parsePath: resolved.path,
  }
}

/** Every JSX attribute name in a file, in source order. */
export function jsxAttributeNames(sourceFile: SourceFile): string[] {
  return sourceFile
    .getDescendants()
    .flatMap((node) => (Node.isJsxAttribute(node) ? [node.getNameNode().getText()] : []))
}

/** The implementation behind a route path, following one level of re-export. */
export function resolvedSource(ctx: DoctorContext, relativePath: string): string | null {
  const path = appPath(ctx.project, relativePath)
  const source = readFile(path)
  if (source === null) return null
  return followDefault(ctx.project, path, source).source
}
