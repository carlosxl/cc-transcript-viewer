// packages/server/src/static.test.ts
//
// Tests the static file handler in three modes:
//   1. publicDir does NOT exist → friendly placeholder at /, no other handlers
//   2. publicDir exists → / serves index.html, /assets/* serves files with
//      correct Content-Type, missing files return 404, traversal returns 404
//   3. Precedence: /api/* routes still win over static when public/ is real
//
// Test isolation strategy:
//   - All three modes use a fresh tmpdir for the static publicDir. We NEVER
//     write to packages/server/public/, so a build artifact in that path is
//     never overwritten or deleted by this test file. This previously caused
//     a real bug: an older version of the precedence describe block wrote a
//     "PRECEDENCE-OK" fixture directly into packages/server/public/index.html
//     and only restored it conditionally, silently corrupting the SPA build
//     output when the test ran after `npm run build`. The only safe rule is:
//     never touch the real default publicDir from a test.
//   - createApp accepts an optional `publicDir` override (added for this
//     reason); the precedence describe block passes the test tmpdir to it.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdirSync, writeFileSync, rmSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Hono } from 'hono'
import { registerStatic } from './static.js'
import { createApp } from './app.js'

// Test-scoped tmpdir for tests that don't need the real default publicDir.
const tmpRoot = join(tmpdir(), `cc-viewer-static-test-${process.pid}`)

// Separate tmpdir used as the publicDir override for the precedence describe
// block. Created in that block's beforeAll, deleted in its afterAll.
let precedenceDir = ''

beforeAll(() => {
  mkdirSync(tmpRoot, { recursive: true })
  writeFileSync(
    join(tmpRoot, 'index.html'),
    '<!doctype html><html><body id="test">OK</body></html>',
    'utf8',
  )
  mkdirSync(join(tmpRoot, 'assets'), { recursive: true })
  writeFileSync(join(tmpRoot, 'assets', 'app.js'), 'console.log("hi")', 'utf8')
  writeFileSync(
    join(tmpRoot, 'assets', 'style.css'),
    'body { color: red; }',
    'utf8',
  )
})

afterAll(() => {
  rmSync(tmpRoot, { recursive: true, force: true })
})

/** Build a tiny Hono app with the static handler pointed at the test tmpdir. */
function makeStaticOnly(publicDir: string): Hono {
  const app = new Hono()
  registerStatic(app, publicDir)
  return app
}

describe('registerStatic — publicDir does NOT exist (dev workflow)', () => {
  it('serves a friendly placeholder at GET /', async () => {
    const app = makeStaticOnly('/tmp/cc-viewer-this-path-does-not-exist-87234')
    const res = await app.fetch(new Request('http://127.0.0.1/'))
    expect(res.status).toBe(200)
    const text = await res.text()
    expect(text).toContain('cc-viewer server is running')
    expect(text).toContain('npm run dev:ui')
  })

  it('does NOT register handlers for non-root paths in dev mode', async () => {
    const app = makeStaticOnly('/tmp/cc-viewer-this-path-does-not-exist-87234')
    const res = await app.fetch(new Request('http://127.0.0.1/some-asset.js'))
    // No notFound was registered on this minimal app, so Hono returns its
    // default 404 — the point is the static handler did NOT match.
    expect(res.status).toBe(404)
  })
})

describe('registerStatic — publicDir exists (production / built)', () => {
  it('serves index.html for /', async () => {
    const app = makeStaticOnly(tmpRoot)
    const res = await app.fetch(new Request('http://127.0.0.1/'))
    expect(res.status).toBe(200)
    const text = await res.text()
    expect(text).toContain('OK')
    expect(res.headers.get('Content-Type') ?? '').toContain('text/html')
  })

  it('serves /index.html explicitly with correct content-type', async () => {
    const app = makeStaticOnly(tmpRoot)
    const res = await app.fetch(new Request('http://127.0.0.1/index.html'))
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type') ?? '').toContain('text/html')
  })

  it('serves JS assets with javascript content-type', async () => {
    const app = makeStaticOnly(tmpRoot)
    const res = await app.fetch(new Request('http://127.0.0.1/assets/app.js'))
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type') ?? '').toMatch(/javascript/i)
    const body = await res.text()
    expect(body).toBe('console.log("hi")')
  })

  it('serves CSS assets with css content-type', async () => {
    const app = makeStaticOnly(tmpRoot)
    const res = await app.fetch(new Request('http://127.0.0.1/assets/style.css'))
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type') ?? '').toContain('text/css')
  })

  it('returns 404 for missing static file', async () => {
    const app = makeStaticOnly(tmpRoot)
    const res = await app.fetch(new Request('http://127.0.0.1/does-not-exist.txt'))
    expect(res.status).toBe(404)
  })

  it('rejects path traversal attempts (T-01-08-01)', async () => {
    const app = makeStaticOnly(tmpRoot)
    // The browser would normalize this client-side, but a hostile client
    // can craft any path. Hono passes the raw c.req.path to our handler;
    // the handler's normalize+startsWith check must reject.
    const res = await app.fetch(
      new Request('http://127.0.0.1/../../../../etc/passwd'),
    )
    expect(res.status).toBe(404)
  })

  it('sets Content-Length header on served files', async () => {
    const app = makeStaticOnly(tmpRoot)
    const res = await app.fetch(new Request('http://127.0.0.1/assets/app.js'))
    expect(res.status).toBe(200)
    const cl = res.headers.get('Content-Length')
    expect(cl).not.toBeNull()
    // 'console.log("hi")' is 17 bytes
    expect(Number(cl)).toBe(17)
  })
})

describe('registerStatic — precedence with createApp /api/* routes', () => {
  // We feed createApp a tmpdir publicDir override and write a distinguishing
  // marker into it. This NEVER touches packages/server/public/, so a real
  // build artifact at that path is preserved regardless of test outcome.

  beforeAll(() => {
    precedenceDir = mkdtempSync(join(tmpdir(), 'cc-viewer-static-precedence-'))
    writeFileSync(
      join(precedenceDir, 'index.html'),
      '<!doctype html><html><body id="precedence-test">PRECEDENCE-OK</body></html>',
      'utf8',
    )
  })

  afterAll(() => {
    if (precedenceDir) {
      rmSync(precedenceDir, { recursive: true, force: true })
    }
  })

  it('GET /api/health returns the health JSON, NOT static index.html', async () => {
    const { app } = createApp({
      port: 7823,
      projectsDir: '/tmp/noop',
      env: 'test',
      publicDir: precedenceDir,
    })
    const res = await app.fetch(
      new Request('http://127.0.0.1:7823/api/health'),
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as { status: string; version: string }
    expect(body.status).toBe('ok')
    expect(body.version).toBe('0.1.0')
  })

  it('GET /api/ping returns ping JSON when static handler is mounted', async () => {
    const { app } = createApp({
      port: 7823,
      projectsDir: '/tmp/noop',
      env: 'test',
      publicDir: precedenceDir,
    })
    const res = await app.fetch(
      new Request('http://127.0.0.1:7823/api/ping'),
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as { status: string }
    expect(body.status).toBe('ok')
  })

  it('GET / serves the static SPA index.html (not the canonical API 404)', async () => {
    const { app } = createApp({
      port: 7823,
      projectsDir: '/tmp/noop',
      env: 'test',
      publicDir: precedenceDir,
    })
    const res = await app.fetch(new Request('http://127.0.0.1:7823/'))
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type') ?? '').toContain('text/html')
    const text = await res.text()
    expect(text).toContain('PRECEDENCE-OK')
  })

  it('rejected Origin on /api/* still hits the FORBIDDEN_ORIGIN handler (no static leak)', async () => {
    const { app } = createApp({
      port: 7823,
      projectsDir: '/tmp/noop',
      env: 'test',
      publicDir: precedenceDir,
    })
    const res = await app.fetch(
      new Request('http://127.0.0.1:7823/api/health', {
        headers: { Origin: 'http://evil.example.com' },
      }),
    )
    expect(res.status).toBe(403)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('FORBIDDEN_ORIGIN')
  })
})
