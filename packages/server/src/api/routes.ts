// packages/server/src/api/routes.ts
import type { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { existsSync, readdirSync, statSync, createReadStream, readFileSync } from 'node:fs'
import { join, isAbsolute, normalize, resolve, sep } from 'node:path'
import { homedir } from 'node:os'
import { Readable } from 'node:stream'
import type {
  SessionsListResponse,
  SessionDetailResponse,
  SubagentDetailResponse,
  HealthResponse,
  SearchResponse,
  SearchStatusResponse,
  SessionReport,
  UsageSummary,
  Turn,
  UsageBlock,
} from '@cc-viewer/shared'
import {
  buildSessionReport,
  buildToolInteractions,
  buildTokenSeries,
  buildFileTouchIndex,
} from '@cc-viewer/shared'
import { SessionMap } from '../reader/session-map.js'
import { loadSessionFromDisk } from '../reader/session-loader.js'
import { SessionCache } from '../reader/session-cache.js'
import { IncrementalReader } from '../reader/incremental-reader.js'
import { errorResponse } from '../util/error-response.js'
import { logError } from '../util/logger.js'
import type { LiveTracker } from '../reader/watcher.js'
import type { SearchIndex } from '../search/search-index.js'
import type { SearchReconciler } from '../search/reconciler.js'

/** SSE heartbeat interval (Pitfall 7 — defeats silent TCP drop after laptop sleep). */
const SSE_HEARTBEAT_MS = 15_000

export interface RouteDeps {
  /** Shared session-list cache used across all /api/sessions requests. */
  sessionMap: SessionMap
  /** Root dir to scan for JSONL sessions (e.g. ~/.claude/projects). */
  projectsDir: string
  /** Server version string, surfaced in /api/health response. */
  version: string
  /** Optional injected SessionCache (for tests); default constructs capacity 3. */
  sessionCache?: SessionCache<{ response: SessionDetailResponse }>
  /** Phase 2 D-34: per-session live-append tracker; absent in tests / when watcher disabled. */
  liveTracker?: LiveTracker
  /** Phase 4: FTS5 index for /api/search. Routes return 503 when absent. */
  searchIndex?: SearchIndex
  /** Phase 4: reconciler exposing index-progress for /api/search/status and SSE. */
  searchReconciler?: SearchReconciler
  /**
   * 007: Root directory holding Claude Code's file-history backups. Each session
   * has a subdirectory at `<fileHistoryRoot>/<sessionId>/<backupFileName>` per
   * `packages/shared/src/jsonl/schema.ts:1062`. Defaults to `<homedir>/.claude/file-history`.
   */
  fileHistoryRoot?: string
  /**
   * Root directory holding markdown plan files Claude Code writes during
   * plan mode. The `plan_mode` attachment carries absolute paths under this
   * root; the /api/plans endpoint sandbox-checks them against this value.
   * Defaults to `<homedir>/.claude/plans`.
   */
  plansRoot?: string
}

/** Maximum length of an /api/search?q= query — bounds DB cost + protects against pathological input. */
const SEARCH_QUERY_MAX_LEN = 200
const SEARCH_LIMIT_MAX = 200

/**
 * Validate that a sessionId is a safe single filename component.
 * Rejects path traversal, absolute paths, and separators.
 * Claude Code session IDs are UUIDs (36 chars with hyphens); we allow any
 * URL-safe string that does NOT contain `/`, `\`, or `..`.
 */
function isSafeSessionId(id: string): boolean {
  if (id.length === 0 || id.length > 128) return false
  if (id.includes('/') || id.includes('\\') || id.includes('..') || id.startsWith('.')) return false
  if (isAbsolute(id)) return false
  // URL-safe subset
  return /^[A-Za-z0-9_\-.]+$/.test(id)
}

/**
 * Find the JSONL path for a given sessionId by searching each project slug.
 * Returns null when not found. Defense-in-depth: confirm the resolved path
 * stays inside `projectsDir` after `normalize()`.
 */
function findSessionJsonl(projectsDir: string, sessionId: string): string | null {
  if (!existsSync(projectsDir)) return null
  const root = normalize(projectsDir)
  try {
    const slugs = readdirSync(projectsDir, { withFileTypes: true }).filter(d => d.isDirectory())
    for (const slug of slugs) {
      const candidate = normalize(join(projectsDir, slug.name, `${sessionId}.jsonl`))
      if (!candidate.startsWith(root)) continue
      if (existsSync(candidate)) return candidate
    }
  } catch {
    return null
  }
  return null
}

export function registerRoutes(app: Hono, deps: RouteDeps): void {
  const { sessionMap, projectsDir, version, liveTracker, searchIndex, searchReconciler } = deps
  const sessionCache = deps.sessionCache ?? new SessionCache<{ response: SessionDetailResponse }>(3)
  const fileHistoryRoot = deps.fileHistoryRoot ?? join(homedir(), '.claude', 'file-history')
  const imageCacheRoot = join(homedir(), '.claude', 'image-cache')
  const plansRoot = deps.plansRoot ?? join(homedir(), '.claude', 'plans')

  // GET /api/health
  app.get('/api/health', (c) => {
    const body: HealthResponse = { status: 'ok', version }
    return c.json(body)
  })

  // GET /api/sessions
  app.get('/api/sessions', async (c) => {
    try {
      const sessions = await sessionMap.get(projectsDir)
      const decorated = sessions.map((s) => ({
        ...s,
        isLive: liveTracker ? liveTracker.isLive(s.sessionId) : false,
      }))
      const body: SessionsListResponse = { sessions: decorated }
      return c.json(body)
    } catch (err) {
      logError('GET /api/sessions failed', err, { projectsDir })
      return c.json(errorResponse('LIST_SESSIONS_FAILED', 'Failed to list sessions'), 500)
    }
  })

  // GET /api/sessions/:id
  app.get('/api/sessions/:id', async (c) => {
    const id = c.req.param('id')
    if (!isSafeSessionId(id)) {
      return c.json(errorResponse('SESSION_NOT_FOUND', `Session ${id} not found`), 404)
    }

    const jsonlPath = findSessionJsonl(projectsDir, id)
    if (!jsonlPath) {
      return c.json(errorResponse('SESSION_NOT_FOUND', `Session ${id} not found`), 404)
    }

    let mtimeMs: number
    try {
      mtimeMs = statSync(jsonlPath).mtimeMs
    } catch (err) {
      logError('GET /api/sessions/:id stat failed', err, { id, jsonlPath })
      return c.json(errorResponse('LOAD_SESSION_FAILED', 'Failed to load session'), 500)
    }

    // SessionCache hit?
    const cached = sessionCache.get(id, mtimeMs)
    if (cached) {
      return c.json(cached.response)
    }

    try {
      const { session } = await loadSessionFromDisk(jsonlPath)
      const body: SessionDetailResponse = {
        turns: session.turns,
        rows: session.rows,
        subagents: session.subagents,
        usage: session.totalUsage,
        parseWarnings: session.parseWarnings,
        toolInteractions: buildToolInteractions(session.turns),
        tokenSeries: buildTokenSeries(session.turns),
        fileTouchIndex: buildFileTouchIndex(session.turns),
      }
      sessionCache.set(id, { response: body }, mtimeMs)
      return c.json(body)
    } catch (err) {
      logError('GET /api/sessions/:id load failed', err, { id, jsonlPath })
      return c.json(errorResponse('LOAD_SESSION_FAILED', 'Failed to load session'), 500)
    }
  })

  // GET /api/sessions/:id/report
  //
  // Returns a SessionReport (token consumption broken down by agent × model ×
  // usage type, plus header KPIs). Computation is pure (buildSessionReport in
  // @cc-viewer/shared) so this endpoint is just I/O glue around the existing
  // session loader + cache. Subagent tokens are included — unlike Claude Code's
  // own `/usage` command, which only sees the main JSONL.
  app.get('/api/sessions/:id/report', async (c) => {
    const id = c.req.param('id')
    if (!isSafeSessionId(id)) {
      return c.json(errorResponse('SESSION_NOT_FOUND', `Session ${id} not found`), 404)
    }
    const jsonlPath = findSessionJsonl(projectsDir, id)
    if (!jsonlPath) {
      return c.json(errorResponse('SESSION_NOT_FOUND', `Session ${id} not found`), 404)
    }
    try {
      const { session } = await loadSessionFromDisk(jsonlPath)
      const report: SessionReport = buildSessionReport(session)
      return c.json(report)
    } catch (err) {
      logError('GET /api/sessions/:id/report failed', err, { id, jsonlPath })
      return c.json(errorResponse('LOAD_SESSION_FAILED', 'Failed to build session report'), 500)
    }
  })

  // GET /api/sessions/:id/subagents/:agentId  (Phase 3 W1.2 — AGENT-01..04)
  app.get('/api/sessions/:id/subagents/:agentId', async (c) => {
    const id = c.req.param('id')
    const agentId = c.req.param('agentId')
    if (!isSafeSessionId(id) || !isSafeSessionId(agentId)) {
      return c.json(errorResponse('SUBAGENT_NOT_FOUND', `Subagent ${agentId} not found`), 404)
    }

    const jsonlPath = findSessionJsonl(projectsDir, id)
    if (!jsonlPath) {
      return c.json(errorResponse('SUBAGENT_NOT_FOUND', `Subagent ${agentId} not found`), 404)
    }

    try {
      // Re-uses the parent SessionCache via the /api/sessions/:id path; warm
      // cache → instant response. Cold cache loads parent + all subagents.
      const { session } = await loadSessionFromDisk(jsonlPath)
      const sa = session.subagents.find((s) => s.agentId === agentId)
      if (!sa) {
        return c.json(errorResponse('SUBAGENT_NOT_FOUND', `Subagent ${agentId} not found`), 404)
      }
      const body: SubagentDetailResponse = {
        agentId: sa.agentId,
        agentType: sa.agentType,
        description: sa.description,
        parentToolUseId: sa.toolUseId,
        status: sa.status,
        turns: sa.turns,
        rows: sa.rows ?? [],
        childAgentIds: sa.childAgentIds,
        usage: sumTurnUsage(sa.turns),
        toolInteractions: buildToolInteractions(sa.turns),
        tokenSeries: buildTokenSeries(sa.turns),
        fileTouchIndex: buildFileTouchIndex(sa.turns),
      }
      return c.json(body)
    } catch (err) {
      logError('GET /api/sessions/:id/subagents/:agentId load failed', err, { id, agentId, jsonlPath })
      return c.json(errorResponse('LOAD_SUBAGENT_FAILED', 'Failed to load subagent'), 500)
    }
  })

  // GET /api/sessions/:id/tool-results/:filename  (007 — FR-013, contract §2)
  //
  // Streams an off-loaded BashResult.persistedOutputPath blob from
  // <sessionDir>/tool-results/<filename>. Filename must be UUID + .txt.
  app.get('/api/sessions/:id/tool-results/:filename', async (c) => {
    const id = c.req.param('id')
    const filename = c.req.param('filename')
    if (!isSafeSessionId(id)) {
      return c.json({ error: 'not-found' }, 404)
    }
    if (!/^[0-9a-fA-F-]{36}\.txt$/.test(filename)) {
      return c.json({ error: 'invalid-filename' }, 400)
    }
    const jsonlPath = findSessionJsonl(projectsDir, id)
    if (!jsonlPath) {
      return c.json({ error: 'not-found' }, 404)
    }
    const sessionDir = jsonlPath.slice(0, jsonlPath.length - '.jsonl'.length)
    const baseDir = resolve(sessionDir, 'tool-results')
    const resolved = resolve(baseDir, filename)
    if (resolved !== baseDir && !resolved.startsWith(baseDir + sep)) {
      return c.json({ error: 'invalid-filename' }, 400)
    }
    if (!existsSync(resolved)) {
      return c.json({ error: 'missing-blob' }, 404)
    }
    try {
      const fileStream = createReadStream(resolved)
      const webStream = Readable.toWeb(fileStream) as ReadableStream<Uint8Array>
      c.header('Content-Type', 'text/plain; charset=utf-8')
      c.header('Cache-Control', 'private, max-age=86400')
      return c.body(webStream)
    } catch (err) {
      logError('GET /api/sessions/:id/tool-results/:filename failed', err, { id, filename })
      return c.json(errorResponse('INTERNAL_ERROR', 'Failed to stream blob'), 500)
    }
  })

  // GET /api/sessions/:id/file-history/:backupFileName  (007 — FR-014, contract §3)
  //
  // Streams a tracked-file backup from <fileHistoryRoot>/<sessionId>/<backupFileName>.
  // Backup filenames are alphanumeric + hyphens, underscores, dots, @, max 256 chars.
  // Path source: schema.ts:1062 — Claude Code writes these under ~/.claude/file-history.
  app.get('/api/sessions/:id/file-history/:backupFileName', async (c) => {
    const id = c.req.param('id')
    const backupFileName = c.req.param('backupFileName')
    if (!isSafeSessionId(id)) {
      return c.json({ error: 'not-found' }, 404)
    }
    if (
      backupFileName.length === 0 ||
      backupFileName.length > 256 ||
      !/^[A-Za-z0-9._@-]+$/.test(backupFileName)
    ) {
      return c.json({ error: 'invalid-filename' }, 400)
    }
    const baseDir = resolve(fileHistoryRoot, id)
    const resolved = resolve(baseDir, backupFileName)
    if (resolved !== baseDir && !resolved.startsWith(baseDir + sep)) {
      return c.json({ error: 'invalid-filename' }, 400)
    }
    if (!existsSync(resolved)) {
      return c.json({ error: 'missing-backup' }, 404)
    }
    try {
      const fileStream = createReadStream(resolved)
      const webStream = Readable.toWeb(fileStream) as ReadableStream<Uint8Array>
      c.header('Content-Type', 'application/octet-stream')
      c.header('Cache-Control', 'private, max-age=86400')
      return c.body(webStream)
    } catch (err) {
      logError('GET /api/sessions/:id/file-history/:backupFileName failed', err, {
        id,
        backupFileName,
      })
      return c.json(errorResponse('INTERNAL_ERROR', 'Failed to stream backup'), 500)
    }
  })

  // GET /api/sessions/:id/images/:n  — serves images Claude Code caches at
  // ~/.claude/image-cache/<sessionId>/<n>.png whenever the user pastes/drops
  // an image. Filenames are 1-indexed and match `[Image #N]` placeholders in
  // the user prompt text.
  app.get('/api/sessions/:id/images/:n', (c) => {
    const id = c.req.param('id')
    const nRaw = c.req.param('n')
    if (!isSafeSessionId(id)) {
      return c.json({ error: 'not-found' }, 404)
    }
    if (!/^[1-9]\d{0,4}$/.test(nRaw)) {
      return c.json({ error: 'invalid-image-number' }, 400)
    }
    const baseDir = resolve(imageCacheRoot, id)
    const fileName = `${nRaw}.png`
    const resolved = resolve(baseDir, fileName)
    if (resolved !== baseDir && !resolved.startsWith(baseDir + sep)) {
      return c.json({ error: 'invalid-path' }, 400)
    }
    if (!existsSync(resolved)) {
      return c.json({ error: 'missing-image' }, 404)
    }
    try {
      const fileStream = createReadStream(resolved)
      const webStream = Readable.toWeb(fileStream) as ReadableStream<Uint8Array>
      c.header('Content-Type', 'image/png')
      c.header('Cache-Control', 'private, max-age=86400')
      return c.body(webStream)
    } catch (err) {
      logError('GET /api/sessions/:id/images/:n failed', err, { id, n: nRaw })
      return c.json(errorResponse('INTERNAL_ERROR', 'Failed to stream image'), 500)
    }
  })

  // GET /api/plans?path=<absolute-path>
  // Serves the markdown plan files Claude Code writes under ~/.claude/plans/
  // when the user enters plan mode. The `plan_mode` attachment row carries an
  // absolute path; the UI passes it back through this endpoint so we can
  // sandbox-check it server-side and stream the content without leaking other
  // files on disk. Response shape mirrors other JSON endpoints for consumer
  // simplicity.
  app.get('/api/plans', (c) => {
    const path = c.req.query('path')
    if (!path || !isAbsolute(path)) {
      return c.json(errorResponse('INVALID_PATH', 'Absolute path required'), 400)
    }
    const resolved = resolve(normalize(path))
    // Plan files only live under ~/.claude/plans/. Any path outside that root
    // — even one that legitimately exists — is rejected so this endpoint
    // can't double as an arbitrary-file reader.
    if (resolved !== plansRoot && !resolved.startsWith(plansRoot + sep)) {
      return c.json(errorResponse('INVALID_PATH', 'Path outside plans root'), 400)
    }
    if (!resolved.endsWith('.md')) {
      return c.json(errorResponse('INVALID_PATH', 'Only .md files supported'), 400)
    }
    if (!existsSync(resolved)) {
      return c.json(errorResponse('NOT_FOUND', 'Plan file not found'), 404)
    }
    try {
      const content = readFileSync(resolved, 'utf8')
      return c.json({ path: resolved, content })
    } catch (err) {
      logError('GET /api/plans failed', err, { path: resolved })
      return c.json(errorResponse('INTERNAL_ERROR', 'Failed to read plan file'), 500)
    }
  })

  // GET /api/live/:sessionId  (Phase 3 W3.2 — LIVE-01..04)
  // SSE endpoint streaming new Turn[] batches as JSONL lines are appended.
  // Events:
  //   event: snapshot   data: { sessionId }                — connection established
  //   event: turns      data: { turns: Turn[] }            — new turns appended (id increments)
  //   event: ping       data: ''                           — 15s heartbeat (Pitfall 7)
  app.get('/api/live/:sessionId', (c) => {
    const sessionId = c.req.param('sessionId')
    if (!isSafeSessionId(sessionId)) {
      return c.json(errorResponse('SESSION_NOT_FOUND', `Session ${sessionId} not found`), 404)
    }
    const jsonlPath = findSessionJsonl(projectsDir, sessionId)
    if (!jsonlPath) {
      return c.json(errorResponse('SESSION_NOT_FOUND', `Session ${sessionId} not found`), 404)
    }
    if (!liveTracker) {
      return c.json(errorResponse('INTERNAL_ERROR', 'Live tailing unavailable in this environment'), 503)
    }
    const tracker = liveTracker
    return streamSSE(c, async (stream) => {
      const reader = new IncrementalReader()
      try {
        await reader.init(sessionId, jsonlPath)
      } catch (err) {
        logError('SSE init failed', err, { sessionId, jsonlPath })
        await stream.writeSSE({ event: 'error', data: JSON.stringify({ message: 'init failed' }) }).catch(() => {})
        return
      }

      await stream.writeSSE({ event: 'snapshot', data: JSON.stringify({ sessionId }) })

      let eventId = 0
      const heartbeat = setInterval(() => {
        if (stream.aborted || stream.closed) return
        stream.writeSSE({ event: 'ping', data: '' }).catch(() => {})
      }, SSE_HEARTBEAT_MS)

      const unsubscribeAppend = tracker.onAppend((e) => {
        if (e.sessionId !== sessionId) return
        void (async () => {
          try {
            const { turns, rows } = await reader.readNew(sessionId, e.jsonlPath)
            if (turns.length === 0 && rows.length === 0) return
            eventId++
            // 007: payload extended with `rows` alongside `turns`. Event name unchanged;
            // SSE wire is JSON so the wider payload is backwards-compatible.
            await stream.writeSSE({ id: String(eventId), event: 'turns', data: JSON.stringify({ turns, rows }) })
            sessionCache.delete(sessionId)
          } catch (err) {
            logError('SSE turns dispatch failed', err, { sessionId })
          }
        })()
      })

      // Subagent appends also invalidate the parent session cache + bump the
      // live indicator. They DO NOT push turns to this stream — the client
      // subscribes to /api/live/:id/subagents/:agentId for that.
      const unsubscribeSubagentAppend = tracker.onSubagentAppend((e) => {
        if (e.sessionId !== sessionId) return
        sessionCache.delete(sessionId)
      })

      await new Promise<void>((resolve) => {
        stream.onAbort(() => {
          clearInterval(heartbeat)
          unsubscribeAppend()
          unsubscribeSubagentAppend()
          void reader.closeAll()
          resolve()
        })
      })
    })
  })

  // GET /api/live/:sessionId/subagents/:agentId  (Phase 3 W3.3)
  app.get('/api/live/:sessionId/subagents/:agentId', (c) => {
    const sessionId = c.req.param('sessionId')
    const agentId = c.req.param('agentId')
    if (!isSafeSessionId(sessionId) || !isSafeSessionId(agentId)) {
      return c.json(errorResponse('SUBAGENT_NOT_FOUND', `Subagent ${agentId} not found`), 404)
    }
    const sessionJsonlPath = findSessionJsonl(projectsDir, sessionId)
    if (!sessionJsonlPath) {
      return c.json(errorResponse('SUBAGENT_NOT_FOUND', `Subagent ${agentId} not found`), 404)
    }
    const subagentJsonlPath = join(
      sessionJsonlPath.slice(0, sessionJsonlPath.length - '.jsonl'.length),
      'subagents',
      `agent-${agentId}.jsonl`,
    )
    if (!liveTracker) {
      return c.json(errorResponse('INTERNAL_ERROR', 'Live tailing unavailable in this environment'), 503)
    }
    const tracker = liveTracker
    return streamSSE(c, async (stream) => {
      const reader = new IncrementalReader()
      const readerKey = `${sessionId}:${agentId}`
      try {
        await reader.init(readerKey, subagentJsonlPath)
      } catch (err) {
        logError('SSE subagent init failed', err, { sessionId, agentId })
        await stream.writeSSE({ event: 'error', data: JSON.stringify({ message: 'init failed' }) }).catch(() => {})
        return
      }

      await stream.writeSSE({ event: 'snapshot', data: JSON.stringify({ sessionId, agentId }) })

      let eventId = 0
      const heartbeat = setInterval(() => {
        if (stream.aborted || stream.closed) return
        stream.writeSSE({ event: 'ping', data: '' }).catch(() => {})
      }, SSE_HEARTBEAT_MS)

      const unsubscribe = tracker.onSubagentAppend((e) => {
        if (e.sessionId !== sessionId || e.agentId !== agentId) return
        void (async () => {
          try {
            const { turns, rows } = await reader.readNew(readerKey, e.jsonlPath)
            if (turns.length === 0 && rows.length === 0) return
            eventId++
            await stream.writeSSE({ id: String(eventId), event: 'turns', data: JSON.stringify({ turns, rows }) })
            sessionCache.delete(sessionId) // parent cache stale; byAgent totals changed
          } catch (err) {
            logError('SSE subagent turns dispatch failed', err, { sessionId, agentId })
          }
        })()
      })

      await new Promise<void>((resolve) => {
        stream.onAbort(() => {
          clearInterval(heartbeat)
          unsubscribe()
          void reader.closeAll()
          resolve()
        })
      })
    })
  })

  // GET /api/search?q=…&limit=…  (Phase 4 — SEARCH-01..05)
  app.get('/api/search', (c) => {
    if (!searchIndex) {
      return c.json(errorResponse('INTERNAL_ERROR', 'Search unavailable in this environment'), 503)
    }
    const q = (c.req.query('q') ?? '').trim()
    if (!q) {
      return c.json(errorResponse('INVALID_QUERY', 'Query parameter q is required'), 400)
    }
    if (q.length > SEARCH_QUERY_MAX_LEN) {
      return c.json(errorResponse('INVALID_QUERY', `Query exceeds ${SEARCH_QUERY_MAX_LEN} characters`), 400)
    }
    const limitRaw = c.req.query('limit')
    let limit: number | undefined
    if (limitRaw !== undefined) {
      const parsed = Number.parseInt(limitRaw, 10)
      if (!Number.isFinite(parsed) || parsed < 1 || parsed > SEARCH_LIMIT_MAX) {
        return c.json(errorResponse('INVALID_QUERY', `limit must be between 1 and ${SEARCH_LIMIT_MAX}`), 400)
      }
      limit = parsed
    }
    try {
      const { hits, truncated } = searchIndex.search(q, { limit })
      const body: SearchResponse = { results: hits, query: q, truncated }
      return c.json(body)
    } catch (err) {
      logError('GET /api/search failed', err, { q })
      return c.json(errorResponse('INTERNAL_ERROR', 'Search failed'), 500)
    }
  })

  // GET /api/search/status — cheap polling endpoint for the indexing progress footer.
  app.get('/api/search/status', (c) => {
    if (!searchReconciler || !searchIndex) {
      const body: SearchStatusResponse = { totalSessions: 0, pendingSessions: 0, isReconciling: false }
      return c.json(body)
    }
    const status = searchReconciler.status()
    const body: SearchStatusResponse = {
      totalSessions: status.totalSessions,
      pendingSessions: status.pendingSessions,
      isReconciling: status.isReconciling,
    }
    return c.json(body)
  })

  // GET /api/search/progress — SSE stream for live progress updates during reconcile.
  // Auto-closes when reconciler.isReconciling flips to false.
  app.get('/api/search/progress', (c) => {
    if (!searchReconciler) {
      return c.json(errorResponse('INTERNAL_ERROR', 'Search unavailable in this environment'), 503)
    }
    const reconciler = searchReconciler
    return streamSSE(c, async (stream) => {
      let lastSent = -1
      // Send the current snapshot immediately so the client doesn't wait
      // for the next progress emission.
      const snapshot = reconciler.status()
      await stream.writeSSE({ event: 'status', data: JSON.stringify(snapshot) })
      if (!snapshot.isReconciling) return

      const heartbeat = setInterval(() => {
        if (stream.aborted || stream.closed) return
        stream.writeSSE({ event: 'ping', data: '' }).catch(() => {})
      }, SSE_HEARTBEAT_MS)

      const unsubProgress = reconciler.onProgress((p) => {
        if (p.done === lastSent) return
        lastSent = p.done
        void stream
          .writeSSE({ event: 'progress', data: JSON.stringify(p) })
          .catch(() => {})
      })

      await new Promise<void>((resolve) => {
        const unsubDone = reconciler.onDone(() => {
          void stream
            .writeSSE({ event: 'done', data: JSON.stringify(reconciler.status()) })
            .catch(() => {})
          unsubDone()
          unsubProgress()
          clearInterval(heartbeat)
          resolve()
        })
        stream.onAbort(() => {
          unsubDone()
          unsubProgress()
          clearInterval(heartbeat)
          resolve()
        })
      })
    })
  })
}

/** Sum `usage` blocks across an agent's turns into a flat UsageSummary. */
function sumTurnUsage(turns: Turn[]): UsageSummary {
  const sum: UsageSummary = {
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
  }
  for (const t of turns) {
    if (!t.usage) continue
    const u: UsageBlock = t.usage
    sum.inputTokens         += u.input_tokens                ?? 0
    sum.outputTokens        += u.output_tokens               ?? 0
    sum.cacheCreationTokens += u.cache_creation_input_tokens ?? 0
    sum.cacheReadTokens     += u.cache_read_input_tokens     ?? 0
  }
  return sum
}
