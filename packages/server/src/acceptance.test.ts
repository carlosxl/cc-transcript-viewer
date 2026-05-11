// packages/server/src/acceptance.test.ts
//
// D-34 phase-exit gates 3, 4, 5, 6 — exercised against a real `startServer`
// instance bound to a probed port. Gates 1 and 2 require a child-process
// invocation of bin/cc-viewer.js and are covered by scripts/phase-1-acceptance.sh.
//
// Gate 5 (zero outbound) is enforced at the process level by
// test/setup-network-guard.ts — this suite includes an explicit meta-test that
// confirms the guard is wired (a non-localhost fetch must throw).
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdirSync, cpSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'node:net'
import { startServer, type ServerHandle } from './index.js'

const here = dirname(fileURLToPath(import.meta.url))
const fixturesDir = resolve(here, 'reader', '__fixtures__', 'synthetic')

const tmp = join(tmpdir(), `cc-viewer-accept-${process.pid}-${Date.now()}`)
let handle: ServerHandle | null = null

/**
 * Probe a free TCP port out-of-band so we can pass it to startServer as a real
 * `--port <n>` value. Required because the CORS allowlist is built from the
 * port at construction time; passing port: 0 makes the allowlist say :0 while
 * the actual bind picks a different port — every request would 403. Same
 * pattern used by plan 06's CLI integration test.
 */
function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer()
    probe.unref()
    probe.on('error', reject)
    probe.listen(0, '127.0.0.1', () => {
      const addr = probe.address()
      if (addr && typeof addr === 'object') {
        const port = addr.port
        probe.close(() => resolve(port))
      } else {
        probe.close(() => reject(new Error('probe.address() returned no port')))
      }
    })
  })
}

beforeAll(async () => {
  // Build a fake projectsDir with our synthetic fixtures rehomed as real session files.
  // Routes look up `projectsDir/<slug>/<sessionId>.jsonl`, so the fixture must live
  // inside a slug directory under tmp (we use `-test-project` as the slug).
  const projDir = join(tmp, '-test-project')
  mkdirSync(projDir, { recursive: true })

  // Copy unknown-event-type fixture → session "unknown-evt"
  cpSync(join(fixturesDir, 'unknown-event-type.jsonl'), join(projDir, 'unknown-evt.jsonl'))
  // Copy partial-trailing-line fixture → session "partial-line"
  cpSync(join(fixturesDir, 'partial-trailing-line.jsonl'), join(projDir, 'partial-line.jsonl'))
  // Plain session for sanity
  cpSync(join(fixturesDir, 'plain-session.jsonl'), join(projDir, 'plain.jsonl'))

  // env: 'test' skips chokidar attachment (avoids leaking FS watchers into Vitest)
  // and we probe a free port so the CORS allowlist port matches the bound port.
  const port = await getFreePort()
  handle = await startServer({ port, projectsDir: tmp, env: 'test' })
})

afterAll(async () => {
  if (handle) await handle.close()
  rmSync(tmp, { recursive: true, force: true })
})

describe('D-34 gate 3: DNS rebinding / origin allowlist (SYS-01, SYS-02)', () => {
  it('rejects requests with a non-allowlisted Origin header with 403', async () => {
    const res = await fetch(`http://127.0.0.1:${handle!.port}/api/sessions`, {
      headers: { Origin: 'http://other.example:1234' },
    })
    expect(res.status).toBe(403)
    const body = await res.json() as { error: { code: string } }
    expect(body.error.code).toBe('FORBIDDEN_ORIGIN')
  })

  it('allows requests with the server origin', async () => {
    const origin = `http://127.0.0.1:${handle!.port}`
    const res = await fetch(`${origin}/api/sessions`, {
      headers: { Origin: origin },
    })
    expect(res.status).toBe(200)
  })

  it('binds to 127.0.0.1 only (D-09)', () => {
    // Easier-to-assert proxy for "did not bind 0.0.0.0": startServer's resolved
    // address. The actual TCP-level binding is asserted in app.test.ts's
    // integration test against the real `serve()` returned info.
    expect(handle!.address).toBe('127.0.0.1')
  })
})

describe('D-34 gate 4: unknown event type parses and renders (SYS-06, D-15)', () => {
  it('loads a session containing a future_unknown_type event without crashing', async () => {
    const origin = `http://127.0.0.1:${handle!.port}`
    const res = await fetch(`${origin}/api/sessions/unknown-evt`, { headers: { Origin: origin } })
    expect(res.status).toBe(200)
    const body = await res.json() as {
      turns: Array<{ role: string; textBlocks: string[]; isMeta: boolean }>
      parseWarnings: number
    }
    // Unknown events are NOT parse warnings — they are preserved via D-15 fallback arm.
    expect(body.parseWarnings).toBe(0)

    // Our fixture has 3 events: user (valid), future_unknown_type (unknown), assistant (valid).
    // The unknown event becomes a meta-turn with textBlocks containing the type hint.
    const unknownTurn = body.turns.find(t => t.isMeta && t.textBlocks[0]?.includes('future_unknown_type'))
    expect(unknownTurn).toBeDefined()
  })
})

describe('D-34 gate 6: partial trailing line logs warning, continues parsing (SYS-05)', () => {
  it('loads a session with truncated trailing line, reports parseWarnings, returns valid turns', async () => {
    const origin = `http://127.0.0.1:${handle!.port}`
    const res = await fetch(`${origin}/api/sessions/partial-line`, { headers: { Origin: origin } })
    expect(res.status).toBe(200)
    const body = await res.json() as { turns: unknown[]; parseWarnings: number }
    expect(body.parseWarnings).toBeGreaterThanOrEqual(1)
    expect(body.turns.length).toBeGreaterThanOrEqual(2)   // the two valid lines
  })
})

describe('D-34 gate 5: zero outbound network calls (D-12, SYS-03)', () => {
  it('network-guard blocks a non-localhost fetch from this test context', async () => {
    // Meta-test: if the guard is working, an explicit external fetch throws.
    // The guard is synchronous in our implementation (throws before the Promise is
    // formed), so we wrap in expect(() => ...).toThrow rather than .rejects.
    expect(() => fetch('https://example.com/')).toThrow(/NETWORK_GUARD/)
  })

  it('a full session load produces zero external fetches', async () => {
    // If the server or its dependencies ever attempt external traffic during a
    // /api/sessions or /api/sessions/:id, the guard throws and the test fails.
    const origin = `http://127.0.0.1:${handle!.port}`
    const list = await fetch(`${origin}/api/sessions`, { headers: { Origin: origin } })
    expect(list.status).toBe(200)

    const detail = await fetch(`${origin}/api/sessions/plain`, { headers: { Origin: origin } })
    expect(detail.status).toBe(200)

    // No exception → no outbound call occurred. Implicit assertion by arriving here.
    expect(true).toBe(true)
  })

  it('localhost traffic (127.0.0.1, localhost, ::1) is NOT blocked by guard', async () => {
    // Sanity: confirm the guard isn't over-blocking (would break everything).
    const res = await fetch(`http://127.0.0.1:${handle!.port}/api/health`, {
      headers: { Origin: `http://127.0.0.1:${handle!.port}` },
    })
    expect(res.status).toBe(200)
  })
})
