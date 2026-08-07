/**
 * The right half of the file browser: one file's source, highlighted.
 *
 * This is a separate module so that it can be a separate chunk. `CodeBlock`
 * imports Shiki, which is 245 KB of grammars and regex engine, and a static
 * import would put all of it in the landing page's first load for a panel most
 * readers scroll past. `file-browser.tsx` pulls this in with `next/dynamic`
 * instead, so the highlighter arrives after hydration and only once.
 *
 * Everything Shiki touches has to live here. Re-exporting `CodeBlockHeader` from
 * this file would not help: one static import of the module is enough to pull
 * the highlighter back into the parent's graph.
 */
'use client'

import type { BundledLanguage } from 'shiki'

import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockCopyButton,
  CodeBlockFilename,
  CodeBlockHeader,
  CodeBlockTitle,
} from '@/components/ai-elements/code-block'

export interface FileSourceProps {
  /** Project-relative path, shown in the header. */
  readonly path: string
  readonly code: string
  readonly language: BundledLanguage
}

export default function FileSource({ path, code, language }: FileSourceProps) {
  return (
    /*
      `CodeBlock` renders its header and then a scroll container it does not
      expose a class hook for. The two child selectors give that container the
      remaining height and let the highlighted `<pre>` paint to the bottom of it,
      so a short file leaves a code surface rather than a gap.
    */
    <CodeBlock
      className="flex h-full min-h-0 flex-col rounded-none border-0 [&_pre]:min-h-full [&>div:last-child]:min-h-0 [&>div:last-child]:flex-1"
      code={code}
      language={language}
    >
      <CodeBlockHeader>
        <CodeBlockTitle className="min-w-0">
          <CodeBlockFilename className="truncate">{path}</CodeBlockFilename>
        </CodeBlockTitle>
        <CodeBlockActions>
          <CodeBlockCopyButton />
        </CodeBlockActions>
      </CodeBlockHeader>
    </CodeBlock>
  )
}
