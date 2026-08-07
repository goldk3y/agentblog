/**
 * `/llms-full.txt`: every page of these docs, concatenated as Markdown.
 *
 * Prerendered at build time, because it reads the processed Markdown of every
 * page and there is no reason to do that per request.
 */
import { getLLMText } from '@/lib/get-llm-text'
import { source } from '@/lib/source'

export const revalidate = false

export async function GET(): Promise<Response> {
  const pages = await Promise.all(source.getPages().map(getLLMText))

  return new Response(pages.join('\n\n---\n\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
