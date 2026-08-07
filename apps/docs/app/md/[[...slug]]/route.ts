/**
 * The Markdown variant of every page.
 *
 * Reached as `/installation.md`, which `next.config.mjs` rewrites here. The
 * index page is `/index.md`, because `/.md` is not a path, and it rewrites to
 * `/md` rather than to `/md/index`.
 *
 * Every response is prerendered: `generateStaticParams` lists the same slugs
 * the HTML pages use, and `revalidate = false` keeps them cached forever.
 */
import { notFound } from 'next/navigation'

import { getLLMText } from '@/lib/get-llm-text'
import { source } from '@/lib/source'

export const revalidate = false
export const dynamicParams = false

interface RouteParams {
  readonly params: Promise<{ slug?: string[] }>
}

export async function GET(_request: Request, { params }: RouteParams): Promise<Response> {
  const { slug } = await params
  const page = source.getPage(slug)
  if (page === undefined) notFound()

  return new Response(await getLLMText(page), {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  })
}

export function generateStaticParams(): { slug: string[] }[] {
  /*
   * The index page contributes `{ slug: [] }`, which prerenders `/md` itself.
   * It cannot be `/md/index`: Next.js normalises a trailing `index` segment
   * away, so that path resolves back to `/md` and 404s under
   * `dynamicParams = false`. `next.config.mjs` rewrites `/index.md` here.
   */
  return source.getPages().map((page) => ({ slug: [...page.slugs] }))
}
