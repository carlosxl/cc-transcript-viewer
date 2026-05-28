// packages/server/src/app.ts
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logError } from './util/logger.js'
import { errorResponse } from './util/error-response.js'
import { SessionMap } from './reader/session-map.js'
import { registerRoutes } from './api/routes.js'
import { registerStatic } from './static.js'
import type { LiveTracker } from './reader/watcher.js'
import type { SearchIndex } from './search/search-index.js'
import type { SearchReconciler } from './search/reconciler.js'

export interface AppOptions {
  port: number
  projectsDir: string
  /** Defaults to process.env.NODE_ENV. Override in tests. */
  env?: 'development' | 'production' | 'test' | string
  /** Server version string, surfaced via GET /api/health. Defaults to '0.1.0'. */
  version?: string
  /**
   * Optional override for the static publicDir. Used by tests to point at a
   * tmpdir so the precedence-vs-API tests do not pollute (or depend on) the
   * real packages/server/public/. In production, leave undefined and
   * registerStatic resolves the default path next to the compiled module.
   */
  publicDir?: string
  /** Phase 2 D-34: liveTracker forwarded into registerRoutes for isLive decoration. */
  liveTracker?: LiveTracker
  /** Phase 2: pre-constructed SessionMap so callers can wire chokidar BEFORE createApp. */
  sessionMap?: SessionMap
  /** Phase 4: cross-session FTS5 index. Optional in tests. */
  searchIndex?: SearchIndex
  /** Phase 4: background reconciler used by /api/search/status + /api/search/progress. */
  searchReconciler?: SearchReconciler
  /** 007: root for Claude Code file-history backups; defaults to ~/.claude/file-history. */
  fileHistoryRoot?: string
  /** Root for plan markdown files; defaults to ~/.claude/plans. */
  plansRoot?: string
}

/** Returned by createApp — the assembled Hono app plus its SessionMap so the
 *  caller (startServer) can attach a chokidar watcher that invalidates it. */
export interface AppContext {
  app: Hono
  sessionMap: SessionMap
}

/**
 * Build the allowlist for CORS + Origin validation.
 * - Always includes 127.0.0.1:<port> and localhost:<port> (D-10).
 * - In development, adds Vite's default dev port so `npm run dev:ui` works
 *   without Vite proxy `changeOrigin` tricks (RESEARCH.md Pitfall 5 + Q3).
 */
export function buildAllowedOrigins(port: number, env?: string): string[] {
  const list = [
    `http://127.0.0.1:${port}`,
    `http://localhost:${port}`,
  ]
  if (env === 'development') {
    list.push('http://localhost:5173')
    list.push('http://127.0.0.1:5173')
  }
  return list
}

/**
 * Create the Hono application.
 *
 * Security invariants enforced here (BEFORE any route is registered):
 *   - CORS allowlist (D-10, SYS-02): only allowlisted origins receive
 *     Access-Control-Allow-Origin; no wildcard; no credentials header.
 *   - Origin validation (D-11): requests whose Origin header is present but
 *     not in the allowlist are rejected with 403 (blocks DNS rebinding).
 *   - Error handler (D-25): unhandled errors return safe shape, no stack in
 *     response, full error logged locally via logger.
 *
 * After security middleware, plan-05 routes are mounted via registerRoutes:
 *   GET /api/health, GET /api/sessions, GET /api/sessions/:id.
 *
 * Returns { app, sessionMap } — the SessionMap is exposed so the caller
 * (startServer) can attach a chokidar watcher that invalidates it on JSONL
 * add/unlink.
 */
export function createApp(options: AppOptions): AppContext {
  const { port, env = process.env['NODE_ENV'], version = '0.1.0' } = options
  const allowedOrigins = buildAllowedOrigins(port, env)
  const app = new Hono()

  // Hono CORS — allowlist only, no wildcard, no credentials (D-10)
  app.use('/api/*', cors({
    origin: (origin) => {
      if (!origin) return null  // return null → no Access-Control-Allow-Origin header
      return allowedOrigins.includes(origin) ? origin : null
    },
    allowMethods: ['GET', 'OPTIONS'],
    allowHeaders: ['Content-Type'],
    credentials: false,
  }))

  // Origin validation — runs AFTER cors() so preflight is handled first (D-11)
  app.use('/api/*', async (c, next) => {
    const origin = c.req.header('Origin')
    // Allow requests with NO Origin header (curl, server-to-server tests).
    // Browsers always send Origin for cross-origin and most same-origin fetches.
    if (origin !== undefined && !allowedOrigins.includes(origin)) {
      return c.json(
        errorResponse('FORBIDDEN_ORIGIN', 'Origin not allowed'),
        403,
      )
    }
    await next()
  })

  const sessionMap = options.sessionMap ?? new SessionMap()
  registerRoutes(app, {
    sessionMap,
    projectsDir: options.projectsDir,
    version,
    liveTracker: options.liveTracker,
    searchIndex: options.searchIndex,
    searchReconciler: options.searchReconciler,
    fileHistoryRoot: options.fileHistoryRoot,
    plansRoot: options.plansRoot,
  })

  // Test-only ping route — leftover from plan 04, kept harmless.
  app.get('/api/ping', (c) => c.json({ status: 'ok' }))

  // Static file handler — registered AFTER all /api/* routes so the SPA
  // never shadows API endpoints. Serves the built UI from packages/server/public/
  // (populated by `npm run copy:ui` during the production build pipeline).
  // In dev (no public/), registers a friendly placeholder at / instead.
  // Tests pass options.publicDir to point at a tmpdir.
  registerStatic(app, options.publicDir)

  // Central 404 handler (fires for any unmatched path)
  app.notFound((c) => c.json(errorResponse('NOT_FOUND', 'Not Found'), 404))

  // Central error handler — log details, return safe shape (D-25)
  app.onError((err, c) => {
    logError('Unhandled request error', err, {
      method: c.req.method,
      path: c.req.path,
    })
    return c.json(errorResponse('INTERNAL_ERROR', 'Internal server error'), 500)
  })

  return { app, sessionMap }
}
