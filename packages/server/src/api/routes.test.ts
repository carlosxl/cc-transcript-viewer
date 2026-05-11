import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, mkdtempSync, writeFileSync, rmSync, appendFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createApp } from '../app.js'
import type { LiveTracker } from '../reader/watcher.js'
import { SearchIndex } from '../search/search-index.js'
import { SearchReconciler } from '../search/reconciler.js'
import { SessionMap } from '../reader/session-map.js'

const ORIGIN = 'http://127.0.0.1:7823'

function setupProjects(): string {
  const projectsDir = join(tmpdir(), `cc-viewer-plan-05-routes-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  rmSync(projectsDir, { recursive: true, force: true })
  mkdirSync(join(projectsDir, '-Users-test-p'), { recursive: true })
  writeFileSync(join(projectsDir, '-Users-test-p', 'real-session.jsonl'), [
    '{"type":"last-prompt","sessionId":"real-session","lastPrompt":"hi"}',
    '{"type":"custom-title","sessionId":"real-session","customTitle":"Test Session"}',
    '{"type":"user","uuid":"u1","sessionId":"real-session","timestamp":"2026-04-24T00:00:00Z","message":{"role":"user","content":"hello"}}',
    '{"type":"assistant","uuid":"a1","sessionId":"real-session","timestamp":"2026-04-24T00:00:01Z","message":{"role":"assistant","content":[{"type":"text","text":"hi"}],"usage":{"input_tokens":5,"output_tokens":2,"cache_creation_input_tokens":0,"cache_read_input_tokens":0}}}',
  ].join('\n'), 'utf8')
  return projectsDir
}

describe('API routes', () => {
  let projectsDir: string
  let app: import('hono').Hono

  beforeEach(() => {
    projectsDir = setupProjects()
    const ctx = createApp({ port: 7823, projectsDir, env: 'test', version: '0.1.0' })
    app = ctx.app
  })

  it('GET /api/health returns { status: "ok", version }', async () => {
    const res = await app.fetch(new Request(`${ORIGIN}/api/health`, {
      headers: { Origin: ORIGIN },
    }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'ok', version: '0.1.0' })
  })

  it('GET /api/sessions returns { sessions: SessionMeta[] } (D-23)', async () => {
    const res = await app.fetch(new Request(`${ORIGIN}/api/sessions`, {
      headers: { Origin: ORIGIN },
    }))
    expect(res.status).toBe(200)
    const body = await res.json() as { sessions: Array<{ sessionId: string; title: string }> }
    expect(body.sessions.length).toBe(1)
    expect(body.sessions[0]!.sessionId).toBe('real-session')
    expect(body.sessions[0]!.title).toBe('Test Session')
  })

  it('GET /api/sessions/:id returns { turns, subagents, usage, parseWarnings } (D-24)', async () => {
    const res = await app.fetch(new Request(`${ORIGIN}/api/sessions/real-session`, {
      headers: { Origin: ORIGIN },
    }))
    expect(res.status).toBe(200)
    const body = await res.json() as { turns: unknown[]; subagents: unknown[]; usage: { inputTokens: number }; parseWarnings: number }
    expect(Array.isArray(body.turns)).toBe(true)
    expect(body.turns.length).toBe(2)       // user + assistant
    expect(Array.isArray(body.subagents)).toBe(true)
    expect(body.usage.inputTokens).toBe(5)
    expect(body.parseWarnings).toBe(0)
  })

  it('GET /api/sessions/:id returns 404 for unknown session with SESSION_NOT_FOUND code (D-25)', async () => {
    const res = await app.fetch(new Request(`${ORIGIN}/api/sessions/does-not-exist`, {
      headers: { Origin: ORIGIN },
    }))
    expect(res.status).toBe(404)
    const body = await res.json() as { error: { code: string } }
    expect(body.error.code).toBe('SESSION_NOT_FOUND')
    // Defense-in-depth: response body should not contain a stack field anywhere.
    expect(JSON.stringify(body)).not.toContain('stack')
  })

  it('GET /api/sessions/:id rejects path traversal attempt', async () => {
    // URL-encoded ../ attempts still won't match isSafeSessionId
    const res = await app.fetch(new Request(`${ORIGIN}/api/sessions/%2E%2E%2Fetc%2Fpasswd`, {
      headers: { Origin: ORIGIN },
    }))
    expect(res.status).toBe(404)
    const body = await res.json() as { error: { code: string } }
    expect(body.error.code).toBe('SESSION_NOT_FOUND')
  })

  it('caches session detail across repeated calls (SessionCache)', async () => {
    const r1 = await app.fetch(new Request(`${ORIGIN}/api/sessions/real-session`, { headers: { Origin: ORIGIN } }))
    expect(r1.status).toBe(200)
    const r2 = await app.fetch(new Request(`${ORIGIN}/api/sessions/real-session`, { headers: { Origin: ORIGIN } }))
    expect(r2.status).toBe(200)
    const body1 = await r1.json() as { turns: unknown[] }
    const body2 = await r2.json() as { turns: unknown[] }
    expect(body1).toEqual(body2)
  })

  it('forbidden origin returns 403 on /api/sessions too (D-11)', async () => {
    const res = await app.fetch(new Request(`${ORIGIN}/api/sessions`, {
      headers: { Origin: 'http://evil.example' },
    }))
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: { code: 'FORBIDDEN_ORIGIN', message: 'Origin not allowed' } })
  })
})

describe('GET /api/sessions/:id/subagents/:agentId (Phase 3 W1.2)', () => {
  let projectsDir: string
  let app: import('hono').Hono

  beforeEach(() => {
    projectsDir = join(tmpdir(), `cc-viewer-w12-routes-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    rmSync(projectsDir, { recursive: true, force: true })
    const projectDir = join(projectsDir, '-Users-test-p')
    const sessionId = 'agent-session'
    mkdirSync(join(projectDir, sessionId, 'subagents'), { recursive: true })

    writeFileSync(join(projectDir, `${sessionId}.jsonl`), [
      '{"type":"assistant","uuid":"a1","sessionId":"agent-session","timestamp":"2026-05-09T00:00:00Z","message":{"role":"assistant","content":[{"type":"tool_use","id":"toolu_QQQ","name":"Task","input":{}}]}}',
      '{"type":"queue-operation","uuid":"qo1","sessionId":"agent-session","timestamp":"2026-05-09T00:00:01Z","operation":"enqueue","content":"<task-id>helper7</task-id><tool-use-id>toolu_QQQ</tool-use-id>"}',
    ].join('\n'), 'utf8')

    writeFileSync(join(projectDir, sessionId, 'subagents', 'agent-helper7.jsonl'),
      '{"type":"assistant","uuid":"sa1","agentId":"helper7","sessionId":"agent-session","timestamp":"2026-05-09T00:00:02Z","message":{"role":"assistant","content":[{"type":"text","text":"working"}],"usage":{"input_tokens":11,"output_tokens":7,"cache_creation_input_tokens":0,"cache_read_input_tokens":0}}}\n',
      'utf8',
    )
    writeFileSync(join(projectDir, sessionId, 'subagents', 'agent-helper7.meta.json'),
      JSON.stringify({ agentType: 'researcher', description: 'finds things' }), 'utf8')

    const ctx = createApp({ port: 7823, projectsDir, env: 'test', version: '0.1.0' })
    app = ctx.app
  })

  it('returns subagent detail with parent linkage and usage', async () => {
    const res = await app.fetch(new Request(`${ORIGIN}/api/sessions/agent-session/subagents/helper7`, {
      headers: { Origin: ORIGIN },
    }))
    expect(res.status).toBe(200)
    const body = await res.json() as {
      agentId: string
      agentType: string
      parentToolUseId: string
      status: string
      turns: unknown[]
      childAgentIds: string[]
      usage: { inputTokens: number; outputTokens: number }
    }
    expect(body.agentId).toBe('helper7')
    expect(body.agentType).toBe('researcher')
    expect(body.parentToolUseId).toBe('toolu_QQQ')
    expect(body.status).toBe('completed')
    expect(body.turns.length).toBe(1)
    expect(body.childAgentIds).toEqual([])
    expect(body.usage.inputTokens).toBe(11)
    expect(body.usage.outputTokens).toBe(7)
  })

  it('returns 404 SUBAGENT_NOT_FOUND for unknown agentId', async () => {
    const res = await app.fetch(new Request(`${ORIGIN}/api/sessions/agent-session/subagents/ghost`, {
      headers: { Origin: ORIGIN },
    }))
    expect(res.status).toBe(404)
    const body = await res.json() as { error: { code: string } }
    expect(body.error.code).toBe('SUBAGENT_NOT_FOUND')
  })

  it('returns 404 for unsafe agentId (path traversal)', async () => {
    const res = await app.fetch(new Request(`${ORIGIN}/api/sessions/agent-session/subagents/%2E%2E%2Fpasswd`, {
      headers: { Origin: ORIGIN },
    }))
    expect(res.status).toBe(404)
    const body = await res.json() as { error: { code: string } }
    expect(body.error.code).toBe('SUBAGENT_NOT_FOUND')
  })

  it('returns 404 when parent session does not exist', async () => {
    const res = await app.fetch(new Request(`${ORIGIN}/api/sessions/no-such/subagents/helper7`, {
      headers: { Origin: ORIGIN },
    }))
    expect(res.status).toBe(404)
    const body = await res.json() as { error: { code: string } }
    expect(body.error.code).toBe('SUBAGENT_NOT_FOUND')
  })
})

describe('GET /api/live/:sessionId (Phase 3 W3.2 — SSE)', () => {
  function makeFakeTracker(): LiveTracker & {
    fireAppend: (e: { sessionId: string; jsonlPath: string }) => void
    fireSubagentAppend: (e: { sessionId: string; agentId: string; jsonlPath: string }) => void
  } {
    const appendListeners = new Set<(e: { sessionId: string; jsonlPath: string }) => void>()
    const subagentListeners = new Set<(e: { sessionId: string; agentId: string; jsonlPath: string }) => void>()
    return {
      isLive: () => false,
      clear: () => {},
      onAppend: (h) => { appendListeners.add(h); return () => appendListeners.delete(h) },
      onSubagentAppend: (h) => { subagentListeners.add(h); return () => subagentListeners.delete(h) },
      emitAppendForTest: (e) => { for (const h of appendListeners) h(e) },
      emitSubagentAppendForTest: (e) => { for (const h of subagentListeners) h(e) },
      fireAppend: (e) => { for (const h of appendListeners) h(e) },
      fireSubagentAppend: (e) => { for (const h of subagentListeners) h(e) },
    }
  }

  async function readNextEvent(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<string> {
    const decoder = new TextDecoder()
    let buf = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) return buf
      buf += decoder.decode(value, { stream: true })
      // SSE messages end with a blank line (\n\n).
      if (buf.includes('\n\n')) return buf
    }
  }

  it('returns 404 for unknown session', async () => {
    const projectsDir = join(tmpdir(), `sse-404-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    mkdirSync(projectsDir, { recursive: true })
    const tracker = makeFakeTracker()
    const ctx = createApp({ port: 7823, projectsDir, env: 'test', version: '0.1.0', liveTracker: tracker })
    const res = await ctx.app.fetch(new Request(`${ORIGIN}/api/live/no-such`, { headers: { Origin: ORIGIN } }))
    expect(res.status).toBe(404)
    const body = await res.json() as { error: { code: string } }
    expect(body.error.code).toBe('SESSION_NOT_FOUND')
    rmSync(projectsDir, { recursive: true, force: true })
  })

  it('returns 503 when liveTracker absent', async () => {
    const projectsDir = join(tmpdir(), `sse-503-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    mkdirSync(join(projectsDir, '-p'), { recursive: true })
    writeFileSync(join(projectsDir, '-p', 'live-noop.jsonl'), '{"type":"user","uuid":"u","sessionId":"live-noop","timestamp":"2026-05-09T00:00:00Z","message":{"role":"user","content":"hi"}}\n', 'utf8')
    const ctx = createApp({ port: 7823, projectsDir, env: 'test', version: '0.1.0' /* no liveTracker */ })
    const res = await ctx.app.fetch(new Request(`${ORIGIN}/api/live/live-noop`, { headers: { Origin: ORIGIN } }))
    expect(res.status).toBe(503)
    rmSync(projectsDir, { recursive: true, force: true })
  })

  // Note: end-to-end streaming happy-path is covered by manual smoke against a
  // real claude session (W3.5) — vitest's Web Streams + Hono SSE timing in the
  // jsdom-free Node environment is flaky without a real network. The
  // IncrementalReader unit tests cover the parse/byte-offset/rotation logic
  // already; the integration glue is small and exercised in dev.
})


describe('GET /api/sessions isLive decoration (D-34)', () => {
  it('every session has isLive: false when no liveTracker provided', async () => {
    const projectsDir = join(tmpdir(), `cc-viewer-islive-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    rmSync(projectsDir, { recursive: true, force: true })
    mkdirSync(join(projectsDir, '-Users-test-p'), { recursive: true })
    writeFileSync(join(projectsDir, '-Users-test-p', 'sess-a.jsonl'), [
      '{"type":"user","uuid":"u1","sessionId":"sess-a","timestamp":"2026-04-26T00:00:00Z","message":{"role":"user","content":"hi"}}',
    ].join('\n'), 'utf8')

    const ctx = createApp({ port: 7823, projectsDir, env: 'test', version: '0.1.0' })
    const res = await ctx.app.fetch(new Request(`${ORIGIN}/api/sessions`, {
      headers: { Origin: ORIGIN },
    }))
    expect(res.status).toBe(200)
    const body = await res.json() as { sessions: Array<{ sessionId: string; isLive: boolean }> }
    expect(body.sessions.length).toBe(1)
    // Without a liveTracker, every entry must have isLive: false (never undefined/null)
    expect(body.sessions[0]!.isLive).toBe(false)
    rmSync(projectsDir, { recursive: true, force: true })
  })

  it('every session has isLive: true when liveTracker.isLive() returns true', async () => {
    const projectsDir = join(tmpdir(), `cc-viewer-islive-test2-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    rmSync(projectsDir, { recursive: true, force: true })
    mkdirSync(join(projectsDir, '-Users-test-p'), { recursive: true })
    writeFileSync(join(projectsDir, '-Users-test-p', 'sess-b.jsonl'), [
      '{"type":"user","uuid":"u1","sessionId":"sess-b","timestamp":"2026-04-26T00:00:00Z","message":{"role":"user","content":"hi"}}',
    ].join('\n'), 'utf8')

    const alwaysLive: LiveTracker = {
      isLive: () => true,
      clear: () => {},
      onAppend: () => () => {},
      onSubagentAppend: () => () => {},
      emitAppendForTest: () => {},
      emitSubagentAppendForTest: () => {},
    }
    const ctx = createApp({ port: 7823, projectsDir, env: 'test', version: '0.1.0', liveTracker: alwaysLive })
    const res = await ctx.app.fetch(new Request(`${ORIGIN}/api/sessions`, {
      headers: { Origin: ORIGIN },
    }))
    expect(res.status).toBe(200)
    const body = await res.json() as { sessions: Array<{ sessionId: string; isLive: boolean }> }
    expect(body.sessions.length).toBe(1)
    expect(body.sessions[0]!.isLive).toBe(true)
    rmSync(projectsDir, { recursive: true, force: true })
  })
})

describe('Search API routes (Phase 4)', () => {
  let projectsDir: string
  let dbDir: string
  let index: SearchIndex
  let reconciler: SearchReconciler
  let app: import('hono').Hono

  beforeEach(async () => {
    projectsDir = setupProjects()
    dbDir = mkdtempSync(join(tmpdir(), 'cc-viewer-search-routes-'))
    index = new SearchIndex(join(dbDir, 'search.db'))
    const sessionMap = new SessionMap()
    reconciler = new SearchReconciler(index, sessionMap, projectsDir)
    await reconciler.start()
    const ctx = createApp({
      port: 7823,
      projectsDir,
      env: 'test',
      version: '0.1.0',
      sessionMap,
      searchIndex: index,
      searchReconciler: reconciler,
    })
    app = ctx.app
  })

  afterEach(() => {
    index.close()
    rmSync(projectsDir, { recursive: true, force: true })
    rmSync(dbDir, { recursive: true, force: true })
  })

  it('GET /api/search returns hits with snippet markers', async () => {
    const res = await app.fetch(new Request(`${ORIGIN}/api/search?q=hello`, { headers: { Origin: ORIGIN } }))
    expect(res.status).toBe(200)
    const body = await res.json() as { results: Array<{ snippetHtml: string; sessionTitle: string }>; query: string; truncated: boolean }
    expect(body.query).toBe('hello')
    expect(body.results.length).toBeGreaterThan(0)
    // Server emits sentinel markers; UI sanitizer converts to <mark>.
    expect(body.results[0]!.snippetHtml).toContain('hello')
    expect(body.results[0]!.snippetHtml).toMatch(/CCV_MARK_OPEN/)
    expect(body.results[0]!.sessionTitle).toBe('Test Session')
  })

  it('GET /api/search rejects empty queries with 400', async () => {
    const res = await app.fetch(new Request(`${ORIGIN}/api/search?q=`, { headers: { Origin: ORIGIN } }))
    expect(res.status).toBe(400)
    const body = await res.json() as { error: { code: string } }
    expect(body.error.code).toBe('INVALID_QUERY')
  })

  it('GET /api/search rejects oversized queries', async () => {
    const q = 'x'.repeat(201)
    const res = await app.fetch(new Request(`${ORIGIN}/api/search?q=${q}`, { headers: { Origin: ORIGIN } }))
    expect(res.status).toBe(400)
  })

  it('GET /api/search/status returns reconciler status', async () => {
    const res = await app.fetch(new Request(`${ORIGIN}/api/search/status`, { headers: { Origin: ORIGIN } }))
    expect(res.status).toBe(200)
    const body = await res.json() as { totalSessions: number; pendingSessions: number; isReconciling: boolean }
    expect(body.totalSessions).toBe(1)
    expect(body.pendingSessions).toBe(0)
    expect(body.isReconciling).toBe(false)
  })

  it('GET /api/search returns 503 when search is disabled', async () => {
    const ctxNoSearch = createApp({ port: 7823, projectsDir, env: 'test', version: '0.1.0' })
    const res = await ctxNoSearch.app.fetch(new Request(`${ORIGIN}/api/search?q=hi`, { headers: { Origin: ORIGIN } }))
    expect(res.status).toBe(503)
  })
})
