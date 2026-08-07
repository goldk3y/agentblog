/**
 * The install manifest, as a tree you can read the source in.
 *
 * The section it sits in makes one claim: a single command writes a whole blog
 * into your repository and you own every file of it. A flat list of paths states
 * that claim. Letting a reader open any of those paths and see the real code
 * demonstrates it, which is the difference between being told a number and
 * believing it.
 *
 * The tree and the excerpts both come from `lib/installed-files.ts`, which reads
 * the registry at build time, so nothing here is transcribed and nothing can
 * drift from what an install actually writes.
 *
 * `FileTree` and `CodeBlock` are the AI Elements components, installed into
 * `components/ai-elements/`. Both ship their own border and radius because they
 * are built to stand alone. Here they are two halves of one panel, so each is
 * flattened and `Panel` owns the frame, which keeps this looking like the rest
 * of the site rather than like two widgets parked next to each other.
 *
 * The highlighted half loads lazily, behind a mount gate. The server and the
 * first client render both produce `SourceFallback`, so the excerpt reaches the
 * HTML as text, which on this site is not optional, and Shiki is requested only
 * once the page is interactive. See `file-source.tsx` for why the split has to
 * be a module rather than a lazy import of `CodeBlock` itself.
 */
'use client'

import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react'

import { FileTree, FileTreeFile, FileTreeFolder } from '@/components/ai-elements/file-tree'
import { Panel } from '@/components/site/panel'
import type { InstalledFile } from '@/lib/installed-files'

const FileSource = lazy(() => import('@/components/site/file-source'))

interface FileBrowserProps {
  readonly files: readonly InstalledFile[]
  /** The file shown before the reader picks one. Falls back to the first file. */
  readonly initialPath: string
}

/** A directory has `children`; a file does not. That is the only difference. */
interface TreeNode {
  readonly name: string
  readonly path: string
  readonly children?: TreeNode[]
}

/* -------------------------------------------------------------------------- */
/*  Flat paths to a tree                                                      */
/* -------------------------------------------------------------------------- */

/** Directories before files, then alphabetically, at every depth. */
function sortNodes(nodes: TreeNode[]): TreeNode[] {
  nodes.sort((a, b) => {
    const aIsDirectory = a.children !== undefined
    const bIsDirectory = b.children !== undefined
    if (aIsDirectory !== bIsDirectory) return aIsDirectory ? -1 : 1
    return a.name.localeCompare(b.name)
  })

  for (const node of nodes) {
    if (node.children !== undefined) sortNodes(node.children)
  }

  return nodes
}

function buildTree(files: readonly InstalledFile[]): TreeNode[] {
  const root: TreeNode[] = []
  // Keyed by directory path, so a directory named by two files is created once.
  const directories = new Map<string, TreeNode[]>()

  for (const file of files) {
    const segments = file.path.split('/')
    const name = segments.pop()
    if (name === undefined) continue

    let prefix = ''
    let siblings = root

    for (const segment of segments) {
      prefix = prefix === '' ? segment : `${prefix}/${segment}`

      let children = directories.get(prefix)
      if (children === undefined) {
        children = []
        directories.set(prefix, children)
        siblings.push({ name: segment, path: prefix, children })
      }

      siblings = children
    }

    siblings.push({ name, path: file.path })
  }

  return sortNodes(root)
}

/** `app/blog/[slug]/page.tsx` becomes `app`, `app/blog`, `app/blog/[slug]`. */
function ancestorsOf(filePath: string): string[] {
  const segments = filePath.split('/').slice(0, -1)
  return segments.map((_, index) => segments.slice(0, index + 1).join('/'))
}

/**
 * Every top level directory, plus the path down to the opening selection.
 *
 * Open at the top level and closed below it. The reader sees the shape of the
 * install without scrolling past seventy rows to reach the end of it.
 */
function initialExpanded(tree: readonly TreeNode[], initialPath: string): Set<string> {
  const roots = tree.filter((node) => node.children !== undefined).map((node) => node.path)
  return new Set([...roots, ...ancestorsOf(initialPath)])
}

/* -------------------------------------------------------------------------- */
/*  The source pane, before the highlighter lands                             */
/* -------------------------------------------------------------------------- */

/**
 * What the server renders, and what a reader sees for the moment before Shiki
 * loads. The chrome mirrors `CodeBlockHeader` so the swap is invisible: same
 * height, same padding, same type, so nothing shifts under the cursor.
 */
function SourceFallback({ path, code }: { readonly path: string; readonly code: string }) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-border text-muted-foreground bg-muted/80 flex items-center border-b px-3 py-2 text-xs">
        <span className="truncate font-mono">{path}</span>
      </div>
      <pre className="min-h-0 flex-1 overflow-auto p-4 font-mono text-sm">{code}</pre>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Layout                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * The panel is capped rather than sized by its contents. Seventy three rows of
 * tree would otherwise push everything after this section off the fold, and a
 * reader who opened a long file would lose their place in the page.
 *
 * Below `lg` the two halves stack and split the cap between them. From `lg` they
 * are columns of one fixed row, which is what keeps their bottom edges level
 * whichever file is open.
 */
const BODY =
  'grid max-h-[34rem] grid-cols-1 lg:h-[34rem] lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]'

/**
 * `min-h-0` is the load-bearing class in both panes.
 *
 * A grid item defaults to `min-height: auto`, which refuses to shrink below its
 * content. Without it the row grows past the cap above and the whole page
 * scrolls instead of the pane, which looks like the cap simply does not work.
 */
const TREE_PANE =
  'border-border max-h-64 min-h-0 min-w-0 overflow-y-auto border-b p-1 lg:max-h-none lg:border-r lg:border-b-0'

/**
 * The source half scrolls one level down rather than here: `CodeBlock` and
 * `SourceFallback` both put `overflow-auto` on the element holding the `<pre>`,
 * so the file scrolls under a header that stays put. This pane only has to stop
 * refusing to shrink.
 */
const SOURCE_PANE = 'flex min-h-0 min-w-0 flex-col'

/* -------------------------------------------------------------------------- */
/*  Component                                                                 */
/* -------------------------------------------------------------------------- */

function renderNodes(nodes: readonly TreeNode[]): React.ReactNode {
  return nodes.map((node) =>
    node.children === undefined ? (
      <FileTreeFile key={node.path} name={node.name} path={node.path} />
    ) : (
      <FileTreeFolder key={node.path} name={node.name} path={node.path}>
        {renderNodes(node.children)}
      </FileTreeFolder>
    ),
  )
}

export function FileBrowser({ files, initialPath }: FileBrowserProps) {
  const tree = useMemo(() => buildTree(files), [files])
  const byPath = useMemo(() => new Map(files.map((file) => [file.path, file])), [files])

  const openingPath = byPath.has(initialPath) ? initialPath : (files[0]?.path ?? '')
  const [selectedPath, setSelectedPath] = useState(openingPath)
  const [expanded, setExpanded] = useState(() => initialExpanded(tree, openingPath))

  /**
   * False through the server render and the first client render, so hydration
   * matches and `lazy` is never reached on the server. Requesting the
   * highlighter is the last thing this component does, not the first.
   */
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => setHydrated(true), [])

  /**
   * `onSelect` fires for directories as well as files. A directory has no source
   * to show, and a row that looks clickable and does nothing reads as broken, so
   * clicking one opens it. That matches what the chevron beside it already does.
   */
  const handleSelect = useCallback(
    (path: string) => {
      if (byPath.has(path)) {
        setSelectedPath(path)
        return
      }

      setExpanded((current) => {
        const next = new Set(current)
        if (!next.delete(path)) next.add(path)
        return next
      })
    },
    [byPath],
  )

  const selected = byPath.get(selectedPath)
  if (selected === undefined) return null

  return (
    <Panel label="your-app/" trailing={`${files.length} files`} bodyClassName={BODY}>
      <div className={TREE_PANE}>
        <FileTree
          className="text-mono-12 rounded-none border-0 bg-transparent"
          expanded={expanded}
          onExpandedChange={setExpanded}
          onSelect={handleSelect}
          selectedPath={selectedPath}
        >
          {renderNodes(tree)}
        </FileTree>
      </div>

      <div className={SOURCE_PANE}>
        {hydrated ? (
          <Suspense fallback={<SourceFallback code={selected.excerpt} path={selected.path} />}>
            <FileSource code={selected.excerpt} language={selected.language} path={selected.path} />
          </Suspense>
        ) : (
          <SourceFallback code={selected.excerpt} path={selected.path} />
        )}
      </div>
    </Panel>
  )
}
