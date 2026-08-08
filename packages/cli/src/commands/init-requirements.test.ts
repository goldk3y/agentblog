/**
 * The gate `agentblog init` puts in front of every write, driven against the
 * project shapes people actually have.
 *
 * The first case is a byte for byte reconstruction of a bug report: `npx
 * create-next-app`, then `npx shadcn init`, then `npx agentblog init`, which
 * answered
 *
 *     ERROR  Tailwind CSS is not installed. AgentBlog requires Tailwind v4.
 *
 * against a project whose `devDependencies` held `"tailwindcss": "^4"`. The
 * refusal was total, and the fix it suggested was a migration off a version the
 * user was not on.
 *
 * Both repository fixtures pin `"tailwindcss": "^4.3.3"` and both have an
 * installed `node_modules`, so neither one could see it. These cases use no
 * `node_modules` on purpose: that is the path where a declared range is the
 * only evidence there is, and it is the path that was broken.
 *
 * Run: node --test packages/cli/src/commands/init-requirements.test.ts
 */
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { detectProject } from '../detect/project.ts'
import { setSilent } from '../util/log.ts'
import { checkRequirements } from './init-requirements.ts'

/** Exactly what `create-next-app` writes for a Next.js 16 TypeScript app. */
const CREATE_NEXT_APP = {
  name: 'test-site',
  version: '0.1.0',
  private: true,
  dependencies: {
    next: '16.3.0',
    react: '19.2.8',
    'react-dom': '19.2.8',
  },
  devDependencies: {
    '@tailwindcss/postcss': '^4',
    '@types/node': '^20',
    '@types/react': '^19',
    tailwindcss: '^4',
    typescript: '^5',
  },
}

/** What `shadcn init` writes for a Tailwind v4 project. `config` is empty. */
const SHADCN_COMPONENTS = {
  $schema: 'https://ui.shadcn.com/schema.json',
  style: 'new-york',
  rsc: true,
  tsx: true,
  tailwind: { config: '', css: 'app/globals.css', baseColor: 'neutral', cssVariables: true },
  aliases: { components: '@/components', utils: '@/lib/utils' },
}

interface Fixture {
  readonly packageJson?: Record<string, unknown>
  readonly componentsJson?: Record<string, unknown> | null
}

function scaffold(fixture: Fixture = {}) {
  const root = mkdtempSync(join(tmpdir(), 'agentblog-requirements-'))
  writeFileSync(
    join(root, 'package.json'),
    JSON.stringify(fixture.packageJson ?? CREATE_NEXT_APP, null, 2),
  )
  const components =
    fixture.componentsJson === undefined ? SHADCN_COMPONENTS : fixture.componentsJson
  if (components !== null) {
    writeFileSync(join(root, 'components.json'), JSON.stringify(components, null, 2))
  }
  mkdirSync(join(root, 'app'), { recursive: true })
  writeFileSync(join(root, 'app', 'layout.tsx'), 'export default function Layout() {}\n')
  return detectProject(root)
}

/** Run the gate and capture what the user would have seen. */
function run(project: ReturnType<typeof detectProject>) {
  const written: string[] = []
  const original = process.stdout.write.bind(process.stdout)
  process.stdout.write = ((chunk: string | Uint8Array) => {
    written.push(String(chunk))
    return true
  }) as typeof process.stdout.write
  setSilent(false)
  try {
    const result = checkRequirements(project, { force: false })
    return { ...result, output: written.join('') }
  } finally {
    process.stdout.write = original
  }
}

test('accepts a create-next-app project with shadcn and no node_modules', () => {
  const result = run(scaffold())

  assert.equal(
    result.ok,
    true,
    `init refused a create-next-app project. Output was:\n${result.output}`,
  )
  assert.doesNotMatch(result.output, /Tailwind/i)
})

test('accepts a partial range for Next.js and React too', () => {
  const result = run(
    scaffold({
      packageJson: {
        dependencies: { next: '^16', react: '^19', 'react-dom': '^19' },
        devDependencies: { tailwindcss: '^4' },
      },
    }),
  )

  assert.equal(result.ok, true, `init refused ^16 and ^19. Output was:\n${result.output}`)
})

test('still refuses Tailwind v3, and quotes the spec it read', () => {
  const result = run(
    scaffold({
      packageJson: {
        dependencies: { next: '16.3.0', react: '19.2.8' },
        devDependencies: { tailwindcss: '^3.4.1' },
      },
    }),
  )

  assert.equal(result.ok, false)
  assert.match(result.output, /v3 is not supported/)
  assert.match(result.output, /\^3\.4\.1/)
})

/**
 * The correction the first fix needed. `create-next-app` writes
 * `"typescript": "^5"`, and comparing a range's minimum against a 5.1 floor
 * refuses it, because the minimum is 5.0.0. `^5` installs 5.9.
 */
test('a major only TypeScript range does not trip the 5.1 floor', () => {
  const result = run(scaffold())

  assert.equal(result.ok, true)
  assert.doesNotMatch(result.output, /TypeScript/i)
})

test('still refuses Next.js 15', () => {
  const result = run(
    scaffold({
      packageJson: {
        dependencies: { next: '^15.5.0', react: '19.2.8' },
        devDependencies: { tailwindcss: '^4' },
      },
    }),
  )

  assert.equal(result.ok, false)
  assert.match(result.output, /requires Next\.js 16/)
})

test('a genuinely absent Tailwind is refused as absent, not as v3', () => {
  const result = run(
    scaffold({
      packageJson: { dependencies: { next: '16.3.0', react: '19.2.8' } },
    }),
  )

  assert.equal(result.ok, false)
  assert.match(result.output, /not a dependency of this project/)
})

/**
 * pnpm catalogs and `workspace:*` name no version. The old code read that as
 * "not installed" and sent the user to a v3 migration guide, which is the same
 * wrong answer the create-next-app case got. shadcn's own empty
 * `tailwind.config` settles it.
 */
test('falls back to the components.json v4 marker when the spec names no version', () => {
  const result = run(
    scaffold({
      packageJson: {
        dependencies: { next: '16.3.0', react: '19.2.8' },
        devDependencies: { tailwindcss: 'catalog:' },
      },
    }),
  )

  assert.equal(result.ok, true, `init refused a catalog: entry. Output was:\n${result.output}`)
})

test('an unreadable Tailwind version with no marker asks for an install, not a migration', () => {
  const result = run(
    scaffold({
      packageJson: {
        dependencies: { next: '16.3.0', react: '19.2.8' },
        devDependencies: { tailwindcss: 'workspace:*' },
      },
      componentsJson: { tailwind: { css: 'app/globals.css' }, aliases: {} },
    }),
  )

  assert.equal(result.ok, false)
  assert.match(result.output, /could not determine the Tailwind CSS version/)
  assert.match(result.output, /install/i)
  // The v3 migration guide is not the fix for a version we could not read.
  assert.doesNotMatch(result.output, /tailwind-v4/)
})

test('the missing components.json refusal still names shadcn init', () => {
  const result = run(scaffold({ componentsJson: null }))

  assert.equal(result.ok, false)
  assert.match(result.output, /shadcn@latest init/)
})
