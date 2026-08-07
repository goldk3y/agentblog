/**
 * Search.
 *
 * The index is built from the structured data Fumadocs extracts from every
 * page at compile time, so it stays in step with the content without a build
 * step of its own and without a third-party service holding a copy of the docs.
 */
import { createFromSource } from 'fumadocs-core/search/server'

import { source } from '@/lib/source'

export const { GET } = createFromSource(source, {
  language: 'english',
})
