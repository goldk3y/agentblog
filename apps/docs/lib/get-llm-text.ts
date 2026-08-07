/**
 * One page, as Markdown, for a reader that is not a browser.
 *
 * Used by `/llms-full.txt` and by the `.md` variant of every page. The heading
 * and the URL line are part of the contract: a model that has been handed forty
 * concatenated documents needs to be able to attribute a sentence back to a
 * page, and a bare body cannot be attributed.
 *
 * `getText('processed')` returns the Markdown after remark has run, which is
 * why `includeProcessedMarkdown` is enabled on the collection in
 * `lib/source.ts`. It is not the raw file: imports and JSX components have
 * already been resolved to text a reader can use.
 */
import { absoluteUrl } from '@/lib/site'
import type { DocsPageEntry } from '@/lib/source'

export async function getLLMText(page: DocsPageEntry): Promise<string> {
  const body = await page.data.getText('processed')

  return [
    `# ${page.data.title}`,
    '',
    `Source: ${absoluteUrl(page.url)}`,
    `Summary: ${page.data.description}`,
    '',
    body,
  ].join('\n')
}
