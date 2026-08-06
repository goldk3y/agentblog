#!/usr/bin/env node
/**
 * Serve `apps/web/public/r` over HTTP so the fixture can install from it.
 *
 * ===========================================================================
 * WHY THIS EXISTS
 * ===========================================================================
 * The `registries` map in `components.json` takes a URL, and only a URL. A
 * relative filesystem path is joined onto the default registry origin and 404s,
 * and a `file://` URL is rejected outright with "not implemented yet". Neither
 * failure is obvious from the error message.
 *
 * Serving the built output is also closer to what a real consumer does than
 * installing from a path would be: it exercises URL resolution, the namespace
 * substitution in `{name}`, and cross-item `registryDependencies` fetching, all
 * of which a local path install skips.
 *
 * Usage:
 *   node scripts/serve-registry.mjs &          default port 4477
 *   node scripts/serve-registry.mjs --port 5000
 *
 * The port matches `registries` in `apps/fixture-next16/components.json`. Change
 * one and change the other.
 */
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { dirname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PUBLIC_DIR = join(ROOT, 'apps', 'web', 'public')

const portArg = process.argv.indexOf('--port')
const port = Number(portArg === -1 ? 4477 : process.argv[portArg + 1])

const server = createServer((req, res) => {
  const requested = decodeURIComponent((req.url ?? '/').split('?')[0])

  // Contain the served path inside `public/`. This server only ever runs on a
  // developer machine and in CI, but a path traversal here would read the
  // repository, and refusing costs two lines.
  const target = normalize(join(PUBLIC_DIR, requested))
  if (!target.startsWith(PUBLIC_DIR)) {
    res.writeHead(403).end('forbidden')
    return
  }

  readFile(target)
    .then((body) => {
      res.writeHead(200, {
        'content-type': target.endsWith('.json') ? 'application/json' : 'text/plain',
        'cache-control': 'no-store',
      })
      res.end(body)
    })
    .catch(() => {
      res.writeHead(404).end('not found')
    })
})

server.listen(port, '127.0.0.1', () => {
  console.log(`serving ${PUBLIC_DIR} on http://127.0.0.1:${port}`)
})
