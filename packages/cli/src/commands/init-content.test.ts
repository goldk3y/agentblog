/**
 * Content survives `shadcn add --overwrite`.
 *
 * ===========================================================================
 * WHAT THIS FILE IS DEFENDING
 * ===========================================================================
 * `init` ran `shadcn add --overwrite` unconditionally and replaced a tester's
 * `content/authors.json`, their `content/categories.json`, and two seed posts
 * they had edited, reporting `Updated 5 files`. None of it was recoverable:
 * `shadcn add` writes outside the `PatchSet`, so the backup for that run held
 * one file. Three written promises say otherwise, including "a blog you already
 * wrote is a refusal, not an overwrite".
 *
 * The snapshot and restore pair below is what makes content write-if-absent
 * without dropping `--overwrite`, which cannot be dropped: without it, `add`
 * blocks on an interactive prompt the moment any target file exists.
 *
 * Run with `pnpm --filter agentblog test`.
 */
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { restoreContent, snapshotContent } from './init-content.ts'
import { detectProject } from '../detect/project.ts'

function scratch(): string {
  const root = mkdtempSync(join(tmpdir(), 'agentblog-content-'))
  mkdirSync(join(root, 'content', 'blog'), { recursive: true })
  return root
}

test('an edited roster and an edited seed post both survive an overwrite', () => {
  const root = scratch()
  try {
    const authors = join(root, 'content', 'authors.json')
    const post = join(root, 'content', 'blog', 'seed.mdx')
    writeFileSync(authors, '[{"slug":"jane","name":"Jane"}]', 'utf8')
    writeFileSync(post, '# mine\n\nSee [the other post](/blog/other).\n', 'utf8')

    const snapshots = snapshotContent(detectProject(root))
    assert.equal(snapshots.length, 2)

    // What `shadcn add --overwrite` does.
    writeFileSync(authors, '[{"slug":"editorial","name":"The Editorial Team"}]', 'utf8')
    writeFileSync(post, '# the shipped seed\n', 'utf8')

    const kept = restoreContent(snapshots)
    assert.deepEqual(kept.sort(), ['content/authors.json', 'content/blog/seed.mdx'])
    assert.equal(readFileSync(authors, 'utf8'), '[{"slug":"jane","name":"Jane"}]')
    assert.match(readFileSync(post, 'utf8'), /See \[the other post]\(\/blog\/other\)/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('a content file the registry did not touch is not rewritten', () => {
  const root = scratch()
  try {
    const post = join(root, 'content', 'blog', 'seed.mdx')
    writeFileSync(post, '# unchanged\n', 'utf8')
    const snapshots = snapshotContent(detectProject(root))
    assert.deepEqual(restoreContent(snapshots), [])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('content the project does not have yet is left to the registry', () => {
  const root = scratch()
  try {
    // Nothing on disk, so nothing is snapshotted, so the seed content the
    // registry ships lands untouched. Write-if-absent, in one sentence.
    assert.deepEqual(snapshotContent(detectProject(root)), [])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('a src/ layout project snapshots src/content', () => {
  const root = scratch()
  try {
    mkdirSync(join(root, 'src', 'app'), { recursive: true })
    mkdirSync(join(root, 'src', 'content', 'blog'), { recursive: true })
    writeFileSync(join(root, 'src', 'content', 'categories.json'), '[{"slug":"mine"}]', 'utf8')

    const snapshots = snapshotContent(detectProject(root))
    assert.deepEqual(
      snapshots.map((snapshot) => snapshot.label),
      ['src/content/categories.json'],
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
