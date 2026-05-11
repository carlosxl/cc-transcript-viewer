import { describe, it, expect } from 'vitest'
import { createApp, buildAllowedOrigins } from './app.js'
import { startServer } from './index.js'

describe('buildAllowedOrigins (D-10)', () => {
  it('always includes 127.0.0.1 and localhost at the given port', () => {
    const list = buildAllowedOrigins(7823)
    expect(list).toContain('http://127.0.0.1:7823')
    expect(list).toContain('http://localhost:7823')
  })

  it('in development adds localhost:5173 (Vite default)', () => {
    const list = buildAllowedOrigins(7823, 'development')
    expect(list).toContain('http://localhost:5173')
  })

  it('in production does NOT include localhost:5173', () => {
    const list = buildAllowedOrigins(7823, 'production')
    expect(list).not.toContain('http://localhost:5173')
  })

  it('in test does NOT include localhost:5173', () => {
    const list = buildAllowedOrigins(7823, 'test')
    expect(list).not.toContain('http://localhost:5173')
  })
})

describe('createApp — CORS + Origin middleware (D-10, D-11, SYS-02)', () => {
  const { app } = createApp({ port: 7823, projectsDir: '/tmp/noop', env: 'production' })

  it('allows request with allowlisted Origin header', async () => {
    const res = await app.fetch(new Request('http://127.0.0.1:7823/api/ping', {
      headers: { Origin: 'http://127.0.0.1:7823' },
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ status: 'ok' })
  })

  it('allows request with localhost origin at same port', async () => {
    const res = await app.fetch(new Request('http://127.0.0.1:7823/api/ping', {
      headers: { Origin: 'http://localhost:7823' },
    }))
    expect(res.status).toBe(200)
  })

  it('rejects request with non-allowlisted Origin (403, D-11)', async () => {
    const res = await app.fetch(new Request('http://127.0.0.1:7823/api/ping', {
      headers: { Origin: 'http://evil.example.com' },
    }))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body).toEqual({ error: { code: 'FORBIDDEN_ORIGIN', message: 'Origin not allowed' } })
  })

  it('rejects cross-origin from a non-allowlisted localhost port', async () => {
    // Vite default 5173 NOT allowlisted in production
    const res = await app.fetch(new Request('http://127.0.0.1:7823/api/ping', {
      headers: { Origin: 'http://localhost:5173' },
    }))
    expect(res.status).toBe(403)
  })

  it('allows request with NO Origin header (curl, server tests)', async () => {
    const res = await app.fetch(new Request('http://127.0.0.1:7823/api/ping'))
    expect(res.status).toBe(200)
  })

  it('CORS preflight for allowed origin returns Access-Control-Allow-Origin (D-10)', async () => {
    const res = await app.fetch(new Request('http://127.0.0.1:7823/api/ping', {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://127.0.0.1:7823',
        'Access-Control-Request-Method': 'GET',
      },
    }))
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://127.0.0.1:7823')
  })

  it('CORS preflight for disallowed origin does NOT set Access-Control-Allow-Origin (D-10)', async () => {
    const res = await app.fetch(new Request('http://127.0.0.1:7823/api/ping', {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://evil.example.com',
        'Access-Control-Request-Method': 'GET',
      },
    }))
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull()
  })

  it('does not set Access-Control-Allow-Credentials (D-10 no credentials)', async () => {
    const res = await app.fetch(new Request('http://127.0.0.1:7823/api/ping', {
      headers: { Origin: 'http://127.0.0.1:7823' },
    }))
    expect(res.headers.get('Access-Control-Allow-Credentials')).toBeNull()
  })
})

describe('createApp — error handler (D-25)', () => {
  it('unhandled error returns 500 with safe shape, no stack', async () => {
    const { app } = createApp({ port: 7823, projectsDir: '/tmp/noop', env: 'production' })
    app.get('/api/blow-up', () => { throw new Error('secret-internal-path-leak') })

    const res = await app.fetch(new Request('http://127.0.0.1:7823/api/blow-up', {
      headers: { Origin: 'http://127.0.0.1:7823' },
    }))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body).toEqual({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } })
    // Response must NOT contain the raw error message
    const text = JSON.stringify(body)
    expect(text).not.toContain('secret-internal-path-leak')
    expect(text).not.toContain('stack')
  })

  it('unmatched path returns 404 with canonical shape', async () => {
    const { app } = createApp({ port: 7823, projectsDir: '/tmp/noop', env: 'production' })
    const res = await app.fetch(new Request('http://127.0.0.1:7823/not-a-real-path'))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body).toEqual({ error: { code: 'NOT_FOUND', message: 'Not Found' } })
  })
})

describe('startServer — 127.0.0.1 bind (SYS-01, D-09)', () => {
  it('binds to 127.0.0.1 (not 0.0.0.0)', async () => {
    const handle = await startServer({ port: 0, projectsDir: '/tmp/noop', env: 'test' })
    try {
      expect(handle.address).toBe('127.0.0.1')
      expect(handle.port).toBeGreaterThan(0)

      // Verify it responds on loopback. Send no Origin header (curl-style) —
      // the allowlist was built with port:0 so the actual bound port is not
      // listed; that's fine because we're only verifying bind, not CORS here.
      const res = await fetch(`http://127.0.0.1:${handle.port}/api/ping`)
      expect(res.status).toBe(200)
    } finally {
      await handle.close()
    }
  })

  it('surfaces EADDRINUSE when port is taken (D-07, CLI-02)', async () => {
    const first = await startServer({ port: 0, projectsDir: '/tmp/noop', env: 'test' })
    try {
      const takenPort = first.port
      await expect(
        startServer({ port: takenPort, projectsDir: '/tmp/noop', env: 'test' })
      ).rejects.toMatchObject({ code: 'EADDRINUSE' })
    } finally {
      await first.close()
    }
  })
})
