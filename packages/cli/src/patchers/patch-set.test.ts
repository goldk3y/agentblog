/**
 * The composition contract for `PatchSet`.
 *
 * ===========================================================================
 * WHAT THIS FILE IS DEFENDING
 * ===========================================================================
 * `doctor --fix` builds its repairs independently, and two of them write
 * `.env.local`: one generates `AGENTBLOG_REVALIDATE_SECRET`, the other moves
 * `INDEXNOW_KEY` out of a git tracked `.env`. Each computed its result from the
 * same pre-write disk contents, so applying them in order meant the second
 * overwrote the first. The CLI announced a generated secret that never reached
 * disk, the user pasted it into a deployment, and the next run generated a
 * different one.
 *
 * The fix is in `PatchSet`, not in those two callers, so that every future
 * same-file pair is safe by construction rather than by somebody remembering.
 * The three-edit cases below are the ones that prove it: a pair is easy to get
 * right by accident, a triple is not.
 *
 * Run with `pnpm --filter agentblog test`.
 */
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { PatchSet } from './patch-set.ts'
import { upsertEnv } from './env.ts'

function scratch(): string {
  return mkdtempSync(join(tmpdir(), 'agentblog-patch-set-'))
}

test('three callback edits to one file compose in order', () => {
  const root = scratch()
  try {
    const path = join(root, '.env.local')
    const patches = new PatchSet()

    for (const key of ['INDEXNOW_KEY', 'AGENTBLOG_REVALIDATE_SECRET', 'THIRD_KEY']) {
      patches.add({
        path,
        label: '.env.local',
        // Every caller reads the same pre-write disk state, which is the whole
        // hazard: `before` is `null` for all three.
        before: null,
        after: (current) =>
          upsertEnv(current, [{ key, value: `${key.toLowerCase()}-value` }]).source,
        reason: `add ${key}`,
      })
    }

    assert.equal(patches.changed.length, 1, 'one entry per file')
    patches.apply(root)

    const written = readFileSync(path, 'utf8')
    for (const key of ['INDEXNOW_KEY', 'AGENTBLOG_REVALIDATE_SECRET', 'THIRD_KEY']) {
      assert.match(written, new RegExp(`^${key}=${key.toLowerCase()}-value$`, 'm'), key)
    }
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('a callback edit never duplicates a key an earlier edit added', () => {
  const root = scratch()
  try {
    const path = join(root, '.env.local')
    const patches = new PatchSet()
    const entry = [{ key: 'INDEXNOW_KEY', value: 'first' }]

    patches.add({
      path,
      label: '.env.local',
      before: null,
      after: (current) => upsertEnv(current, entry).source,
      reason: 'generate',
    })
    patches.add({
      path,
      label: '.env.local',
      before: null,
      after: (current) => upsertEnv(current, [{ key: 'INDEXNOW_KEY', value: 'second' }]).source,
      reason: 'move',
    })

    patches.apply(root)
    const written = readFileSync(path, 'utf8')
    assert.equal(written.match(/^INDEXNOW_KEY=/gm)?.length, 1, 'exactly one INDEXNOW_KEY line')
    assert.match(written, /^INDEXNOW_KEY=first$/m, 'the first value survives')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('three string edits to one file union-merge instead of clobbering', () => {
  const root = scratch()
  try {
    const path = join(root, 'notes.txt')
    const before = 'alpha\nbeta\ngamma\n'
    const patches = new PatchSet()

    // Three callers, each computing its answer from the same `before`.
    patches.add({
      path,
      label: 'notes.txt',
      before,
      after: 'alpha\nbeta\ngamma\nfrom-first\n',
      reason: 'first',
    })
    patches.add({
      path,
      label: 'notes.txt',
      before,
      after: 'alpha\nbeta\ngamma\nfrom-second\n',
      reason: 'second',
    })
    patches.add({
      path,
      label: 'notes.txt',
      before,
      after: 'alpha\nfrom-third\nbeta\ngamma\n',
      reason: 'third',
    })

    assert.equal(patches.changed.length, 1, 'one entry per file')
    patches.apply(root)

    const written = readFileSync(path, 'utf8')
    for (const line of ['from-first', 'from-second', 'from-third']) {
      assert.ok(written.includes(line), `${line} survived`)
    }
    assert.equal(written, 'alpha\nfrom-third\nbeta\ngamma\nfrom-first\nfrom-second\n')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('the backup records the real pre-write contents, not an intermediate one', () => {
  const root = scratch()
  try {
    const path = join(root, '.env.local')
    const patches = new PatchSet()

    patches.add({
      path,
      label: '.env.local',
      before: 'EXISTING=1\n',
      after: (current) => `${current ?? ''}ONE=1\n`,
      reason: 'one',
    })
    patches.add({
      path,
      label: '.env.local',
      before: 'EXISTING=1\n',
      after: (current) => `${current ?? ''}TWO=2\n`,
      reason: 'two',
    })

    const [edit] = patches.changed
    assert.equal(edit?.before, 'EXISTING=1\n')
    assert.equal(edit?.after, 'EXISTING=1\nONE=1\nTWO=2\n')
    assert.match(edit?.reason ?? '', /one; two/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
