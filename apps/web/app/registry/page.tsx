/**
 * A human-browsable list of the registry items.
 *
 * Read from `registry.json` at build time rather than maintained by hand, so a
 * new item appears here the moment it appears in the catalog. The descriptions
 * are the ones an LLM reads during `shadcn search`, which is a good reason for
 * them to be legible to a person too.
 */
import type { Metadata } from 'next'

import { CopyCommand } from '@/components/site/copy-command'
import { Badge } from '@/components/ui/badge'
import { getRegistryItems } from '@/lib/registry-catalog'

export const metadata: Metadata = {
  title: 'Registry',
  description:
    'Every item in the AgentBlog shadcn registry, with its type, its dependencies, and the command to install it on its own.',
  alternates: { canonical: '/registry' },
}

export default function RegistryPage() {
  const items = getRegistryItems()

  return (
    <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
      <p className="text-muted-foreground font-mono text-xs tracking-wider uppercase">Registry</p>
      <h1 className="mt-4 max-w-3xl font-serif text-4xl leading-[1.1] font-semibold tracking-tight text-balance sm:text-5xl">
        Every item, installable on its own
      </h1>
      <p className="text-muted-foreground mt-5 max-w-2xl text-lg leading-relaxed">
        <code className="font-mono text-base">@agentblog/blog</code> is an umbrella that pulls in
        everything below. Each piece is also addressable by itself, so you can take the JSON-LD
        builders without the routes, or the components without the content adapter.
      </p>

      <div className="mt-10 max-w-xl space-y-3">
        <CopyCommand command="npx shadcn@latest add @agentblog/blog" />
        <p className="text-muted-foreground text-sm">
          Add the namespace to <code className="font-mono">components.json</code> first:{' '}
          <code className="font-mono">
            {'"registries": { "@agentblog": "https://agentblog.dev/r/{name}.json" }'}
          </code>
        </p>
      </div>

      {items.length === 0 ? (
        <p className="border-border text-muted-foreground mt-16 rounded-lg border p-6 text-sm">
          The catalog has not been built yet. Run{' '}
          <code className="font-mono">pnpm registry:build</code> and reload.
        </p>
      ) : (
        <ul className="mt-16 space-y-4">
          {items.map((item) => (
            <li
              key={item.name}
              className="border-border hover:bg-accent/40 rounded-xl border p-6 transition-colors"
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <h2 className="text-foreground font-mono text-base font-semibold">
                  @agentblog/{item.name}
                </h2>
                <Badge variant="secondary" className="font-mono text-[0.7rem]">
                  {item.type.replace('registry:', '')}
                </Badge>
                {item.fileCount > 0 && (
                  <span className="text-muted-foreground text-xs">
                    {item.fileCount} {item.fileCount === 1 ? 'file' : 'files'}
                  </span>
                )}
              </div>

              {item.description !== '' && (
                <p className="text-muted-foreground mt-3 max-w-3xl text-sm leading-relaxed">
                  {item.description}
                </p>
              )}

              {item.registryDependencies.length > 0 && (
                <p className="text-muted-foreground mt-4 font-mono text-xs">
                  <span className="text-foreground">depends on</span>{' '}
                  {item.registryDependencies.join(', ')}
                </p>
              )}

              {item.dependencies.length > 0 && (
                <p className="text-muted-foreground mt-1.5 font-mono text-xs">
                  <span className="text-foreground">npm</span> {item.dependencies.join(', ')}
                </p>
              )}

              <p className="text-muted-foreground mt-4 font-mono text-xs">
                npx shadcn@latest add @agentblog/{item.name}
              </p>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-20 font-serif text-2xl font-semibold tracking-tight">
        What the item types mean
      </h2>
      <dl className="mt-6 grid max-w-3xl gap-x-8 gap-y-4 text-sm sm:grid-cols-[auto_1fr]">
        <dt className="text-foreground font-mono">block</dt>
        <dd className="text-muted-foreground">
          A group of files that ships together, usually routes or a component set.
        </dd>
        <dt className="text-foreground font-mono">lib</dt>
        <dd className="text-muted-foreground">
          Modules under your <code className="font-mono">lib</code> alias. No UI.
        </dd>
        <dt className="text-foreground font-mono">component</dt>
        <dd className="text-muted-foreground">Components under your components alias.</dd>
        <dt className="text-foreground font-mono">base</dt>
        <dd className="text-muted-foreground">
          A style, an icon library, and a base colour. Never installed into an app that already has
          a design system.
        </dd>
      </dl>

      <p className="text-muted-foreground mt-10 max-w-2xl text-sm leading-relaxed">
        Dependencies written as bare names (<code className="font-mono">card</code>,{' '}
        <code className="font-mono">button</code>) resolve to the built-in shadcn items against your
        own configuration, which is how the blog inherits your theme rather than importing ours.
      </p>
    </div>
  )
}
