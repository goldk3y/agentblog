/**
 * The documentation content source.
 *
 * Pages are MDX files under `content/docs`. Their URLs, their order, and the
 * sidebar tree all come from the file system: a file at
 * `content/docs/reference/cli.mdx` is `/reference/cli`, and the `meta.json`
 * beside it decides where in the sidebar it sits.
 *
 * `baseUrl` is `/` rather than `/docs` because this site is nothing but docs.
 * On docs.agentblog.dev the installation guide is `/installation`, not
 * `/docs/installation`.
 *
 * The collection is declared with the Macro API, so there is no generated
 * `.source` directory and no codegen step to keep current. The bundler rewrites
 * `defineDocs` into imports of the content files.
 */
import { createElement } from 'react'

import { loader } from 'fumadocs-core/source'
import { pageSchema } from 'fumadocs-core/source/schema'
import { defineDocs } from 'fumadocs-mdx/macro'
import { z } from 'zod'

import { SIDEBAR_ICONS } from '@/lib/icons'

const docs = defineDocs({
  dir: 'content/docs',
  docs: {
    /*
     * `description` is required, and that is deliberate. It is the meta
     * description, the sidebar and card subtitle, and the one line each page
     * contributes to `llms.txt`. A page without one renders perfectly and is
     * invisible in three places at once, so a missing description fails the
     * build instead.
     */
    schema: pageSchema.extend({
      description: z.string().min(1),
    }),

    /*
     * Keeps the processed Markdown of every page in the build output, which is
     * what `/llms-full.txt` and the `.md` variant of each page serve. Without
     * it, `page.data.getText('processed')` throws at request time rather than
     * failing here.
     */
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
})

export const source = loader({
  baseUrl: '/',
  source: docs.toFumadocsSource(),
  icon(name) {
    if (name === undefined) return
    const Icon = SIDEBAR_ICONS[name]
    if (Icon === undefined) {
      // Louder than a missing icon: a typo in `meta.json` is otherwise invisible.
      throw new Error(
        `Unknown sidebar icon "${name}". Add it to SIDEBAR_ICONS in lib/icons.ts first.`,
      )
    }
    return createElement(Icon)
  },
})

/** The type of one page, for functions that take a page and are declared elsewhere. */
export type DocsPageEntry = (typeof source)['$inferPage']
