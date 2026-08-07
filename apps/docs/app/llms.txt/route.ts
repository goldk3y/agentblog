/**
 * `/llms.txt`: the index of this site, as Markdown.
 *
 * A docs site is the one carve-out where `llms.txt` earns its place. It is a
 * navigation aid for an agent that has been pointed at a URL and has to decide
 * which page answers the question, and it costs one route. The blog block ships
 * none, for reasons the docs state plainly.
 *
 * @see /concepts/why-no-llms-txt
 */
import { llms } from 'fumadocs-core/source'

import { siteOrigin } from '@/lib/site'
import { source } from '@/lib/source'

export const revalidate = false

export function GET(): Response {
  /*
   * `llms()` writes site-relative links, because it does not know the origin.
   * A relative link is useless in a file whose entire purpose is to be read
   * somewhere else, so the origin is put back here.
   */
  const index = llms(source).index().replaceAll('](/', `](${siteOrigin()}/`)

  return new Response(index, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
