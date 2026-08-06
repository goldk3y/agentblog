/**
 * A backup manifest is untrusted input, and these tests say so in code.
 *
 * ===========================================================================
 * WHAT THIS FILE IS DEFENDING
 * ===========================================================================
 * `.agentblog/backup/<stamp>/backup.json` is an ordinary file in a repository,
 * so it is committable, so it arrives with a `git clone`. Its `label` and
 * `copy` fields used to be passed straight to `join(projectRoot, label)` and
 * then to a write or an `rmSync`. `npx agentblog revert` in a freshly cloned
 * repository therefore wrote and deleted files anywhere the user could reach,
 * and reported "Restored 2 file(s), removed 1." while doing it.
 *
 * The containment test lives in `readBackupPlan`, and a rejected entry stops
 * the whole restore rather than being skipped, because a manifest that tries to
 * escape is either corrupt or hostile and neither is a thing to continue past.
 *
 * Run with `pnpm --filter agentblog test`.
 */
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { readBackupPlan, restoreBackup } from './patch-set.ts'
import { BACKUP_DIR } from '../constants.ts'

const STAMP = '2020-01-01T00-00-00-000Z'

function scratch(): { root: string; project: string; outside: string; backup: string } {
  const root = mkdtempSync(join(tmpdir(), 'agentblog-containment-'))
  const project = join(root, 'project')
  const outside = join(root, 'outside')
  const backup = join(project, BACKUP_DIR, STAMP)
  mkdirSync(backup, { recursive: true })
  mkdirSync(outside, { recursive: true })
  return { root, project, outside, backup }
}

function writeManifest(backup: string, entries: unknown): void {
  writeFileSync(join(backup, 'backup.json'), JSON.stringify({ createdAt: STAMP, entries }), 'utf8')
}

test('a label that escapes the project root is rejected and nothing is written', () => {
  const { root, project, outside, backup } = scratch()
  try {
    writeFileSync(join(outside, 'authorized_keys'), 'ORIGINAL', 'utf8')
    writeFileSync(join(backup, 'pwned.txt'), 'PWNED', 'utf8')
    writeManifest(backup, [{ label: '../outside/authorized_keys', copy: 'pwned.txt' }])

    const plan = readBackupPlan(project, STAMP)
    assert.equal(plan?.entries.length, 0)
    assert.equal(plan?.rejected.length, 1)
    assert.match(plan!.rejected[0]!, /resolves outside the project/)

    const result = restoreBackup(project, STAMP, { dryRun: false })
    assert.equal(result.restored.length, 0)
    assert.equal(result.rejected.length, 1)
    assert.equal(readFileSync(join(outside, 'authorized_keys'), 'utf8'), 'ORIGINAL')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('a deep traversal label is rejected', () => {
  const { root, project, backup } = scratch()
  try {
    writeFileSync(join(backup, 'pwned.txt'), 'PWNED', 'utf8')
    const escape = join(tmpdir(), `agentblog-escape-proof-${process.pid}.txt`)
    rmSync(escape, { force: true })
    writeManifest(backup, [{ label: `../../../../../../..${escape}`, copy: 'pwned.txt' }])
    const result = restoreBackup(project, STAMP, { dryRun: false })
    assert.equal(result.rejected.length, 1)
    assert.equal(existsSync(escape), false)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('a null-copy entry pointing outside does not delete anything', () => {
  const { root, project, outside, backup } = scratch()
  try {
    const victim = join(outside, 'victim.txt')
    writeFileSync(victim, 'i exist', 'utf8')
    writeManifest(backup, [{ label: '../outside/victim.txt', copy: null }])

    const result = restoreBackup(project, STAMP, { dryRun: false })
    assert.equal(result.removed.length, 0)
    assert.equal(result.rejected.length, 1)
    assert.equal(existsSync(victim), true)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('a copy that escapes the backup directory is rejected', () => {
  const { root, project, outside, backup } = scratch()
  try {
    writeFileSync(join(outside, 'secret.txt'), 'SECRET', 'utf8')
    writeManifest(backup, [{ label: 'app/page.tsx', copy: '../../../../outside/secret.txt' }])

    const result = restoreBackup(project, STAMP, { dryRun: false })
    assert.equal(result.restored.length, 0)
    assert.equal(result.rejected.length, 1)
    assert.match(result.rejected[0]!, /outside the backup directory/)
    assert.equal(existsSync(join(project, 'app', 'page.tsx')), false)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('a sibling directory sharing the root prefix is not inside it', () => {
  // `/project` is a string prefix of `/project-backup`, and a containment test
  // without the separator says the second lives inside the first.
  const { root, backup } = scratch()
  try {
    mkdirSync(join(root, 'project-evil'), { recursive: true })
    writeFileSync(join(backup, 'pwned.txt'), 'PWNED', 'utf8')
    writeManifest(backup, [{ label: '../project-evil/file.txt', copy: 'pwned.txt' }])

    const plan = readBackupPlan(join(root, 'project'), STAMP)
    assert.equal(plan?.rejected.length, 1)
    assert.equal(existsSync(join(root, 'project-evil', 'file.txt')), false)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('an ordinary manifest still restores', () => {
  const { root, project, backup } = scratch()
  try {
    writeFileSync(join(project, 'next.config.ts'), 'AFTER', 'utf8')
    writeFileSync(join(backup, 'next.config.ts'), 'BEFORE', 'utf8')
    writeManifest(backup, [{ label: 'next.config.ts', copy: 'next.config.ts' }])

    const result = restoreBackup(project, STAMP, { dryRun: false })
    assert.deepEqual(result.rejected, [])
    assert.deepEqual(result.restored, ['next.config.ts'])
    assert.equal(readFileSync(join(project, 'next.config.ts'), 'utf8'), 'BEFORE')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
