/**
 * The components an MDX page can use without importing anything.
 *
 * Fumadocs supplies the defaults: headings with anchors, tables, code blocks,
 * `Callout`, and the rest. This map adds the four that carry structure a
 * documentation page here actually needs, and nothing else. A component nobody
 * uses is a component the next writer has to read past.
 */
import defaultMdxComponents from 'fumadocs-ui/mdx'
import type { MDXComponents } from 'mdx/types'

import { Accordion, Accordions } from 'fumadocs-ui/components/accordion'
import { Card, Cards } from 'fumadocs-ui/components/card'
import { File, Files, Folder } from 'fumadocs-ui/components/files'
import { Step, Steps } from 'fumadocs-ui/components/steps'
import { Tab, Tabs } from 'fumadocs-ui/components/tabs'

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    Accordion,
    Accordions,
    Card,
    Cards,
    File,
    Files,
    Folder,
    Step,
    Steps,
    Tab,
    Tabs,
    ...components,
  }
}

export const useMDXComponents = getMDXComponents

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>
}
