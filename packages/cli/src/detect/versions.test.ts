/**
 * The range parser, and the bug it exists to keep dead.
 *
 * `npx agentblog init` refused a fresh `create-next-app` project with:
 *
 *     ERROR  Tailwind CSS is not installed. AgentBlog requires Tailwind v4.
 *            Fix: Migrate first: https://ui.shadcn.com/docs/tailwind-v4
 *
 * Tailwind v4 was right there in `devDependencies`. `create-next-app` writes
 * `"tailwindcss": "^4"`, the parser matched `/(\d+)\.(\d+)\.(\d+)/`, and `^4`
 * has no minor and no patch, so the CLI concluded the package was absent and
 * sent the user to a migration guide for a version they were not on.
 *
 * Both fixtures declared `"tailwindcss": "^4.3.3"`, which the old regex did
 * match, so every gate in the repository passed while the most common project
 * shape in existence could not install. That is the gap these cases close: the
 * partial ranges are first, and they are the reason this file exists.
 *
 * Run: node --test packages/cli/src/detect/versions.test.ts
 */
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { detectProject } from './project.ts'
import {
  compareSemVer,
  describeStatus,
  meetsFloor,
  parseSemVer,
  rangeOfSpec,
  resolveDependency,
} from './versions.ts'

test('reads a partial range, which is what create-next-app writes', () => {
  // The exact spec from the failing report.
  assert.equal(rangeOfSpec('^4'), '>=4.0.0 <5.0.0-0')

  assert.equal(rangeOfSpec('^16'), '>=16.0.0 <17.0.0-0')
  assert.equal(rangeOfSpec('^19'), '>=19.0.0 <20.0.0-0')
  assert.equal(rangeOfSpec('^5'), '>=5.0.0 <6.0.0-0')
  assert.equal(rangeOfSpec('~5.1'), '>=5.1.0 <5.2.0-0')
  assert.equal(rangeOfSpec('4'), '>=4.0.0 <5.0.0-0')
  assert.equal(rangeOfSpec('4.x'), '>=4.0.0 <5.0.0-0')
})

test('reads the other range forms a package.json carries', () => {
  assert.equal(rangeOfSpec('16.3.0'), '16.3.0')
  assert.equal(rangeOfSpec('=4.1.0'), '4.1.0')
  assert.equal(rangeOfSpec('v4.1.0'), '4.1.0')
  assert.equal(rangeOfSpec('^4.3.3'), '>=4.3.3 <5.0.0-0')
  assert.equal(rangeOfSpec('>=16.0.0'), '>=16.0.0')
  assert.equal(rangeOfSpec('1.2.3 - 2.3.4'), '>=1.2.3 <=2.3.4')
  assert.equal(rangeOfSpec('npm:tailwindcss@^4'), '>=4.0.0 <5.0.0-0')
  assert.ok(rangeOfSpec('^3 || ^4'))
})

/**
 * A wildcard is a valid range that everything satisfies. Treating it as an
 * answer would pass a Tailwind v4 check on a project that pinned nothing, and
 * taking its minimum would fail one. Neither is a fact, so neither is reported.
 */
test('a spec that names no version is null', () => {
  for (const spec of ['*', 'x', 'X', '', '   ', 'latest', 'next']) {
    assert.equal(rangeOfSpec(spec), null, `expected ${JSON.stringify(spec)} to resolve to null`)
  }
})

test('non registry protocols name no version', () => {
  for (const spec of [
    'catalog:',
    'catalog:default',
    'workspace:*',
    'workspace:^',
    'file:../tailwind',
    'link:../tailwind',
    'portal:../tailwind',
    'github:tailwindlabs/tailwindcss',
    'git+ssh://git@github.com/tailwindlabs/tailwindcss.git',
    'https://example.com/tailwindcss.tgz',
  ]) {
    assert.equal(rangeOfSpec(spec), null, `expected ${JSON.stringify(spec)} to resolve to null`)
  }
})

test('parseSemVer takes exact versions only, and is anchored', () => {
  assert.deepEqual(parseSemVer('4.3.3'), { major: 4, minor: 3, patch: 3, raw: '4.3.3' })
  assert.deepEqual(parseSemVer('v16.3.0'), { major: 16, minor: 3, patch: 0, raw: '16.3.0' })
  assert.equal(parseSemVer('16.4.0-canary.3')?.raw, '16.4.0')
  // Unanchored, this used to accept a range and report it as an exact version.
  assert.equal(parseSemVer('>=16.0.0'), null)
  assert.equal(parseSemVer('^4'), null)
  assert.equal(parseSemVer(null), null)
})

test('compareSemVer orders by major, then minor, then patch', () => {
  const v = (raw: string) => parseSemVer(raw)!
  assert.ok(compareSemVer(v('16.3.0'), v('16.2.9')) > 0)
  assert.ok(compareSemVer(v('4.0.0'), v('16.0.0')) < 0)
  assert.equal(compareSemVer(v('4.1.2'), v('4.1.2')), 0)
})

/* ========================================================================== */
/* resolveDependency and meetsFloor                                           */
/* ========================================================================== */

/** A project directory with a package.json and an optional node_modules. */
function projectWith(pkg: Record<string, unknown>, installed?: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), 'agentblog-versions-'))
  writeFileSync(join(root, 'package.json'), JSON.stringify(pkg))
  for (const [name, version] of Object.entries(installed ?? {})) {
    const dir = join(root, 'node_modules', name)
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name, version }))
  }
  return detectProject(root)
}

const declaring = (spec: string) =>
  resolveDependency(projectWith({ devDependencies: { tailwindcss: spec } }), 'tailwindcss')

test('a create-next-app project resolves Tailwind from devDependencies', () => {
  const status = declaring('^4')

  assert.equal(status.state, 'declared')
  assert.equal(meetsFloor(status, '>=4.0.0'), true)
})

test('node_modules outranks the declared range', () => {
  const project = projectWith({ devDependencies: { tailwindcss: '^4' } }, { tailwindcss: '4.3.7' })
  const status = resolveDependency(project, 'tailwindcss')

  assert.equal(status.state, 'installed')
  assert.equal(status.state === 'installed' && status.version.raw, '4.3.7')
  assert.equal(meetsFloor(status, '>=4.0.0'), true)
})

/**
 * The correction that the first fix got wrong. Comparing a range's minimum
 * against the floor refuses `"typescript": "^5"` on a 5.1 floor, because 5.0.0
 * is the minimum and 5.1 is the floor. `^5` installs 5.9. A declared range
 * fails only when it cannot overlap the floor at all.
 */
test('a major only range is not refused by a minor level floor', () => {
  const typescript = resolveDependency(
    projectWith({ devDependencies: { typescript: '^5' } }),
    'typescript',
  )

  assert.equal(meetsFloor(typescript, '>=5.1.0'), true)
})

test('a range that cannot reach the floor is still refused', () => {
  assert.equal(meetsFloor(declaring('^3.4.1'), '>=4.0.0'), false)
  assert.equal(meetsFloor(declaring('~3.4'), '>=4.0.0'), false)
  assert.equal(meetsFloor(declaring('3'), '>=4.0.0'), false)
  assert.equal(meetsFloor(declaring('<4'), '>=4.0.0'), false)
})

test('an installed version is compared as the fact it is', () => {
  const v3 = resolveDependency(
    projectWith({ devDependencies: { tailwindcss: '^4' } }, { tailwindcss: '3.4.17' }),
    'tailwindcss',
  )

  // The range says v4 and the tree says v3. The tree is what runs.
  assert.equal(meetsFloor(v3, '>=4.0.0'), false)
})

test('no evidence is never a failure', () => {
  const absent = resolveDependency(projectWith({ dependencies: {} }), 'tailwindcss')
  assert.equal(absent.state, 'absent')
  assert.equal(meetsFloor(absent, '>=4.0.0'), null)

  const unresolved = declaring('catalog:')
  assert.equal(unresolved.state, 'unresolved')
  assert.equal(unresolved.state === 'unresolved' && unresolved.spec, 'catalog:')
  assert.equal(meetsFloor(unresolved, '>=4.0.0'), null)
})

test('describeStatus never calls a declared range an installed version', () => {
  const declared = declaring('^4')
  const installed = resolveDependency(
    projectWith({ devDependencies: { tailwindcss: '^4' } }, { tailwindcss: '4.3.7' }),
    'tailwindcss',
  )

  assert.equal(describeStatus('Tailwind', installed), 'Tailwind 4.3.7')
  assert.match(describeStatus('Tailwind', declared), /not installed/)
  // The spec is quoted back, never a version invented from it.
  assert.doesNotMatch(describeStatus('Tailwind', declared), /4\.0\.0/)
})
