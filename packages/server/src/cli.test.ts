import { describe, it, expect, vi } from 'vitest'
import { Writable } from 'node:stream'
import { mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'node:net'
import { main } from './cli.js'
import type { ServerHandle } from './index.js'

/**
 * Ask the OS for a free port by binding a transient TCP server to port 0,
 * reading the assigned port, then releasing it. The port is technically
 * race-prone (another process could grab it before we re-bind) but in a
 * single-test environment the window is sub-millisecond.
 */
async function getFreePort(): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const probe = createServer()
    probe.unref()
    probe.on('error', reject)
    probe.listen(0, '127.0.0.1', () => {
      const addr = probe.address()
      if (addr && typeof addr === 'object') {
        const port = addr.port
        probe.close(() => resolve(port))
      } else {
        probe.close()
        reject(new Error('no address from probe'))
      }
    })
  })
}

/**
 * Create a fake WriteStream that captures all writes. isTTY defaults to false
 * (browser-open should NOT fire by default in tests). Pass `isTTY: true` to
 * exercise the positive open path.
 */
function makeStream(): { stream: NodeJS.WriteStream; data: () => string } {
  const chunks: Buffer[] = []
  const stream = new Writable({
    write(chunk, _enc, cb) {
      chunks.push(Buffer.from(chunk))
      cb()
    },
  }) as unknown as NodeJS.WriteStream
  ;(stream as unknown as { isTTY: boolean }).isTTY = false
  return { stream, data: () => Buffer.concat(chunks).toString('utf8') }
}

const fakeHandle = (port = 7900): ServerHandle => ({
  address: '127.0.0.1',
  port,
  family: 'IPv4',
  close: async () => {},
})

describe('main()', () => {
  it('--help prints help and returns code 0', async () => {
    const { stream: stdout, data } = makeStream()
    const { stream: stderr } = makeStream()
    const r = await main({
      argv: ['--help'],
      env: {},
      stdout,
      stderr,
      startServerImpl: async () => fakeHandle(),
      openImpl: async () => ({}),
      installSignalHandlers: false,
    })
    expect(r.code).toBe(0)
    expect(data()).toContain('cc-viewer')
    expect(data()).toContain('--port')
    expect(data()).toContain('--no-open')
    expect(data()).toContain('--dir')
  })

  it('--version prints a non-empty version and returns code 0', async () => {
    const { stream: stdout, data } = makeStream()
    const { stream: stderr } = makeStream()
    const r = await main({
      argv: ['--version'],
      env: {},
      stdout,
      stderr,
      startServerImpl: async () => fakeHandle(),
      openImpl: async () => ({}),
      installSignalHandlers: false,
    })
    expect(r.code).toBe(0)
    expect(data().trim().length).toBeGreaterThan(0)
  })

  it('invalid flag prints help text to stderr and returns code 1', async () => {
    const { stream: stderr, data } = makeStream()
    const { stream: stdout } = makeStream()
    const r = await main({
      argv: ['--garbage'],
      env: {},
      stdout,
      stderr,
      startServerImpl: async () => fakeHandle(),
      openImpl: async () => ({}),
      installSignalHandlers: false,
    })
    expect(r.code).toBe(1)
    expect(data()).toContain('Unknown flag')
    expect(data()).toContain('--port')
  })

  it('prints D-07 port-conflict message when startServer rejects with EADDRINUSE (CLI-02)', async () => {
    const { stream: stderr, data: stderrData } = makeStream()
    const { stream: stdout } = makeStream()
    const eaddr: NodeJS.ErrnoException = Object.assign(
      new Error('listen EADDRINUSE'),
      { code: 'EADDRINUSE' },
    )
    const r = await main({
      argv: ['--port', '7900', '--no-open'],
      env: {},
      stdout,
      stderr,
      startServerImpl: async () => {
        throw eaddr
      },
      openImpl: async () => ({}),
      installSignalHandlers: false,
    })
    expect(r.code).toBe(1)
    expect(stderrData()).toContain('Port 7900 is already in use')
    expect(stderrData()).toContain('npx cc-viewer --port 7901')
    expect(stderrData()).toContain('http://127.0.0.1:7900')
  })

  it('non-EADDRINUSE startServer error returns 1 with safe message', async () => {
    const { stream: stderr, data } = makeStream()
    const { stream: stdout } = makeStream()
    const r = await main({
      argv: ['--no-open'],
      env: {},
      stdout,
      stderr,
      startServerImpl: async () => {
        throw new Error('disk on fire')
      },
      openImpl: async () => ({}),
      installSignalHandlers: false,
    })
    expect(r.code).toBe(1)
    expect(data()).toContain('failed to start server')
    expect(data()).toContain('disk on fire')
  })

  it('starts server with flag > env > default for projectsDir (D-05)', async () => {
    const { stream: stdout } = makeStream()
    const { stream: stderr } = makeStream()
    const spy = vi.fn(async (opts: { port: number; projectsDir: string }) =>
      fakeHandle(opts.port),
    )
    const r = await main({
      argv: ['--port', '7950', '--no-open', '--dir', '/flag-dir'],
      env: { CC_PROJECTS_DIR: '/env-dir' },
      stdout,
      stderr,
      startServerImpl: spy,
      openImpl: async () => ({}),
      installSignalHandlers: false,
    })
    expect(r.code).toBe(0)
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ port: 7950, projectsDir: '/flag-dir' }),
    )
  })

  it('uses CC_PROJECTS_DIR when --dir absent', async () => {
    const spy = vi.fn(async (opts: { port: number; projectsDir: string }) =>
      fakeHandle(opts.port),
    )
    const { stream: stdout } = makeStream()
    const { stream: stderr } = makeStream()
    await main({
      argv: ['--no-open'],
      env: { CC_PROJECTS_DIR: '/env-dir' },
      stdout,
      stderr,
      startServerImpl: spy,
      openImpl: async () => ({}),
      installSignalHandlers: false,
    })
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ projectsDir: '/env-dir' }),
    )
  })

  it('skips browser-open when --no-open is set (D-08)', async () => {
    const openSpy = vi.fn(async () => ({}))
    const { stream: stdout } = makeStream()
    const { stream: stderr } = makeStream()
    ;(stdout as unknown as { isTTY: boolean }).isTTY = true
    await main({
      argv: ['--no-open'],
      env: {},
      stdout,
      stderr,
      startServerImpl: async () => fakeHandle(),
      openImpl: openSpy,
      installSignalHandlers: false,
    })
    expect(openSpy).not.toHaveBeenCalled()
  })

  it('skips browser-open when CI env var is truthy (D-08)', async () => {
    const openSpy = vi.fn(async () => ({}))
    const { stream: stdout } = makeStream()
    const { stream: stderr } = makeStream()
    ;(stdout as unknown as { isTTY: boolean }).isTTY = true // would normally open
    await main({
      argv: [],
      env: { CI: '1' },
      stdout,
      stderr,
      startServerImpl: async () => fakeHandle(),
      openImpl: openSpy,
      installSignalHandlers: false,
    })
    expect(openSpy).not.toHaveBeenCalled()
  })

  it('skips browser-open when stdout is not a TTY (D-08)', async () => {
    const openSpy = vi.fn(async () => ({}))
    const { stream: stdout } = makeStream() // isTTY=false by default
    const { stream: stderr } = makeStream()
    await main({
      argv: [],
      env: {},
      stdout,
      stderr,
      startServerImpl: async () => fakeHandle(),
      openImpl: openSpy,
      installSignalHandlers: false,
    })
    expect(openSpy).not.toHaveBeenCalled()
  })

  it('opens the browser when all D-08 conditions pass', async () => {
    const openSpy = vi.fn(async () => ({}))
    const { stream: stdout } = makeStream()
    const { stream: stderr } = makeStream()
    ;(stdout as unknown as { isTTY: boolean }).isTTY = true
    await main({
      argv: [],
      env: {},
      stdout,
      stderr,
      startServerImpl: async () => fakeHandle(),
      openImpl: openSpy,
      installSignalHandlers: false,
    })
    expect(openSpy).toHaveBeenCalledWith('http://127.0.0.1:7900')
  })

  it('prints "running at" line with the bound URL', async () => {
    const { stream: stdout, data } = makeStream()
    const { stream: stderr } = makeStream()
    await main({
      argv: ['--no-open'],
      env: {},
      stdout,
      stderr,
      startServerImpl: async () => fakeHandle(7950),
      openImpl: async () => ({}),
      installSignalHandlers: false,
    })
    expect(data()).toContain('http://127.0.0.1:7950')
  })
})

describe('bin shim integration (real server on port 0)', () => {
  // Uses the REAL startServer; confirms the bin→main→startServer→Hono chain
  // works end-to-end with no injection points except installSignalHandlers
  // (we never want vitest to register a SIGINT listener that survives).

  it('starts a real server bound to 127.0.0.1 and responds on /api/health (CLI-01)', async () => {
    // Use a unique tmpdir so chokidar (if it were running, which it isn't in
    // env=test) wouldn't pollute another test's projectsDir.
    const projectsDir = join(tmpdir(), `cc-viewer-plan-06-${Date.now()}`)
    mkdirSync(projectsDir, { recursive: true })

    const { stream: stdout, data } = makeStream()
    const { stream: stderr, data: stderrData } = makeStream()
    ;(stdout as unknown as { isTTY: boolean }).isTTY = false

    // The CLI rejects --port 0 by design (D-04 says ports 1-65535). Probe
    // for a free port out-of-band so the test doesn't depend on a hardcoded
    // value that may already be in use on the developer's machine.
    const probedPort = await getFreePort()

    try {
      const r = await main({
        argv: ['--port', String(probedPort), '--no-open', '--dir', projectsDir],
        // env=test makes startServer skip the chokidar watcher (no leaked handles)
        env: { NODE_ENV: 'test' },
        stdout,
        stderr,
        installSignalHandlers: false,
      })
      if (r.code !== 0) {
        // surface the failure cause for debugging when the test breaks
        throw new Error(`main() returned code ${r.code}: ${stderrData()}`)
      }
      expect(r.code).toBe(0)
      expect(r.handle).toBeDefined()

      // Parse the running URL from stdout to learn the actual port.
      const m = /http:\/\/127\.0\.0\.1:(\d+)/.exec(data())
      expect(m).not.toBeNull()
      const boundPort = Number(m![1]!)
      expect(boundPort).toBeGreaterThan(0)
      expect(r.handle!.port).toBe(boundPort)
      expect(r.handle!.address).toBe('127.0.0.1')

      const res = await fetch(`http://127.0.0.1:${boundPort}/api/health`)
      expect(res.status).toBe(200)
      const body = (await res.json()) as { status: string }
      expect(body.status).toBe('ok')

      // Clean shutdown — without this Vitest reports a dangling server handle.
      await r.handle!.close()
    } finally {
      try {
        rmSync(projectsDir, { recursive: true, force: true })
      } catch { /* ignore cleanup races */ }
    }
  })
})
