// Inlines @cc-viewer/shared into the server dist tree so the published
// tarball doesn't depend on the workspace package at runtime.
//
// Why: npm pack ships only packages/server/dist + public; the workspace
// link to @cc-viewer/shared isn't resolvable for end users. After tsc,
// we copy shared/dist into server/dist/_shared and rewrite every
// `from '@cc-viewer/shared'` import to a relative path.
import { cpSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'

const SERVER_DIST = 'packages/server/dist'
const SHARED_DIST = 'packages/shared/dist'
const INLINE_DIR = `${SERVER_DIST}/_shared`

cpSync(SHARED_DIST, INLINE_DIR, { recursive: true })

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    if (statSync(p).isDirectory()) {
      if (p === INLINE_DIR) continue
      walk(p)
    } else if (p.endsWith('.js') || p.endsWith('.d.ts')) {
      const src = readFileSync(p, 'utf8')
      if (!src.includes('@cc-viewer/shared')) continue
      const rel = relative(dirname(p), `${INLINE_DIR}/index.js`).replace(/\\/g, '/')
      const target = rel.startsWith('.') ? rel : `./${rel}`
      const out = src
        .replaceAll("'@cc-viewer/shared'", `'${target}'`)
        .replaceAll('"@cc-viewer/shared"', `"${target}"`)
      writeFileSync(p, out)
    }
  }
}

walk(SERVER_DIST)
console.log(`inlined @cc-viewer/shared → ${INLINE_DIR}`)
