/**
 * Protecting the user's content from `shadcn add --overwrite`.
 *
 * ===========================================================================
 * THE FAILURE THIS FILE EXISTS TO PREVENT
 * ===========================================================================
 * `init` runs `shadcn add @agentblog/blog @agentblog/source-mdx --yes
 * --overwrite`. `--overwrite` is not optional: without it, `add` blocks on an
 * interactive prompt the moment a target file exists, which turns a CI install
 * into a hung job. But `@agentblog/source-mdx` ships seed content, so the flag
 * that keeps the install non-interactive also replaced a tester's author
 * record, their category, and an inbound link they had added to a seed post,
 * and reported it as `Updated 5 files`.
 *
 * Worse, none of it was recoverable. `shadcn add` writes outside our
 * `PatchSet`, so those four files were never in `.agentblog/backup/<stamp>/`
 * and `agentblog revert` could not bring them back. Three written promises say
 * otherwise: "running `init` twice is a no-op", "back up every file they
 * modify", and "a blog you already wrote is a refusal, not an overwrite".
 *
 * The rule is therefore: **code and route files are ours to overwrite, content
 * files are not, ever.** Content is snapshotted before `shadcn add` runs and
 * restored byte for byte afterwards, so the registry's seed content only ever
 * lands where there was nothing. The snapshot is also handed to the patch set,
 * so a file that was replaced and restored still appears in the backup and in
 * the diff, rather than being invisible because it happened to end up the same.
 *
 * @see https://agentblog.dev/docs/installation
 */
import { appPath, appPathLabel, type ProjectContext } from '../detect/project.ts'
import { exists, readFile, toPosixRelative, walk, writeFileEnsuringDir } from '../util/fs.ts'

export interface ContentSnapshot {
  readonly path: string
  readonly label: string
  readonly contents: string
}

/**
 * Every content file that already exists, with its exact bytes.
 *
 * The roots are the ones `@agentblog/source-mdx` writes into. A file the user
 * added under `content/blog/` that the registry never ships is included too:
 * `--overwrite` cannot touch it, but including it costs nothing and means the
 * restore does not have to know which files are ours.
 */
export function snapshotContent(project: ProjectContext): ContentSnapshot[] {
  const out: ContentSnapshot[] = []

  for (const relative of ['content/authors.json', 'content/categories.json']) {
    const path = appPath(project, relative)
    const contents = readFile(path)
    if (contents !== null) out.push({ path, label: appPathLabel(project, relative), contents })
  }

  const blogDir = appPath(project, 'content/blog')
  if (exists(blogDir)) {
    for (const path of walk(blogDir, { extensions: ['.mdx', '.md'] })) {
      const contents = readFile(path)
      if (contents !== null) {
        out.push({ path, label: toPosixRelative(project.root, path), contents })
      }
    }
  }

  return out
}

/**
 * Put back every snapshotted file whose bytes changed.
 *
 * Returns the labels that were restored, which the caller prints. Saying
 * nothing here would be its own quiet failure: the user needs to know that the
 * registry shipped a newer seed post and that we kept theirs.
 */
export function restoreContent(snapshots: readonly ContentSnapshot[]): string[] {
  const kept: string[] = []
  for (const snapshot of snapshots) {
    if (readFile(snapshot.path) === snapshot.contents) continue
    writeFileEnsuringDir(snapshot.path, snapshot.contents)
    kept.push(snapshot.label)
  }
  return kept
}
