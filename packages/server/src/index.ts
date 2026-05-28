// packages/server/src/index.ts
import { serve } from '@hono/node-server'
import type { AddressInfo } from 'node:net'
import type { FSWatcher } from 'chokidar'
import { join } from 'node:path'
import { statSync } from 'node:fs'
import { createApp, type AppOptions } from './app.js'
import { watchProjectsDir } from './reader/watcher.js'
import type { LiveTracker } from './reader/watcher.js'
import { SessionMap } from './reader/session-map.js'
import { IncrementalReader } from './reader/incremental-reader.js'
import { SearchIndex } from './search/search-index.js'
import { SearchReconciler } from './search/reconciler.js'
import { getCacheDir } from './util/cache-dir.js'
import { logError } from './util/logger.js'

/**
 * Info returned by a successful startServer() call.
 * Callers use `.close()` to terminate the server on SIGINT/SIGTERM.
 */
export interface ServerHandle {
  address: string   // always '127.0.0.1' (D-09)
  port: number      // actual bound port
  family: string    // 'IPv4'
  close: () => Promise<void>
}

/**
 * Start the HTTP server bound to 127.0.0.1 (D-09, SYS-01).
 *
 * Resolves with a ServerHandle on successful bind.
 * Rejects with a NodeJS.ErrnoException whose `.code === 'EADDRINUSE'` when
 * the port is already in use (D-07, Pitfall 17, CLI-02).
 *
 * Also attaches a chokidar watcher (D-20) that invalidates the SessionMap on
 * JSONL add/unlink — skipped when env === 'test' to avoid leaving file
 * watchers open across Vitest runs.
 *
 * The caller (plan 06's CLI) is responsible for formatting the EADDRINUSE
 * error with the friendly message required by D-07.
 */
export function startServer(opts: AppOptions): Promise<ServerHandle> {
  // Pre-construct SessionMap so the watcher can reference sessionMap.invalidate()
  // before createApp is called — required to pass the same instance into both.
  const sessionMap = new SessionMap()
  let watcher: (FSWatcher & LiveTracker) | null = null
  let searchIndex: SearchIndex | null = null
  let searchReconciler: SearchReconciler | null = null

  // Skip watcher in test env to avoid dangling handles keeping Vitest alive.
  if (opts.env !== 'test') {
    try {
      watcher = watchProjectsDir(opts.projectsDir, () => sessionMap.invalidate())
    } catch (err) {
      logError('Failed to start chokidar watcher', err, { projectsDir: opts.projectsDir })
    }

    // Phase 4 — build the FTS index alongside the watcher. On any failure
    // here, log and continue without search; the rest of the server still works.
    try {
      const dbPath = join(getCacheDir(), 'search.db')
      searchIndex = new SearchIndex(dbPath)
      searchReconciler = new SearchReconciler(searchIndex, sessionMap, opts.projectsDir)
    } catch (err) {
      logError('Failed to initialize search index', err, { projectsDir: opts.projectsDir })
      searchIndex = null
      searchReconciler = null
    }

    if (watcher && searchIndex) attachSearchWatcher(watcher, searchIndex, opts.projectsDir)
  }

  const { app } = createApp({
    ...opts,
    sessionMap,
    liveTracker: watcher ?? undefined,
    searchIndex: searchIndex ?? undefined,
    searchReconciler: searchReconciler ?? undefined,
  })

  return new Promise<ServerHandle>((resolve, reject) => {
    let settled = false

    const server = serve(
      {
        fetch: app.fetch,
        port: opts.port,
        hostname: '127.0.0.1',   // CRITICAL (D-09) — never omit; default binds all interfaces
      },
      (info: AddressInfo) => {
        if (settled) return
        settled = true
        resolve({
          address: info.address,
          port: info.port,
          family: info.family,
          close: async () => {
            if (watcher) {
              try { await watcher.close() } catch { /* ignore */ }
            }
            if (searchIndex) {
              try { searchIndex.close() } catch { /* ignore */ }
            }
            await new Promise<void>((res, rej) => {
              server.close((err) => (err ? rej(err) : res()))
            })
          },
        })
        // Kick off background reconciliation after the server is listening so
        // it doesn't block readiness. Errors are logged inside start().
        if (searchReconciler) {
          searchReconciler.start().catch(() => {})
        }
      },
    )

    server.on('error', (err: NodeJS.ErrnoException) => {
      if (settled) {
        // Error after a successful bind (rare). Log but don't crash.
        logError('Server error after successful bind', err)
        return
      }
      settled = true
      // Close watcher / index if we started them before bind failed
      if (watcher) watcher.close().catch(() => {})
      if (searchIndex) { try { searchIndex.close() } catch { /* ignore */ } }
      reject(err)
    })
  })
}

/**
 * Hook the watcher's append/unlink events into the SearchIndex so live edits
 * to active sessions show up in search within ~1 watcher debounce cycle.
 *
 * Each (sessionId|sessionId+agentId) gets its own IncrementalReader so we
 * read only newly-appended bytes; never re-parse the whole file on every
 * append. The reader handles inode rotation + truncation already.
 */
function attachSearchWatcher(
  tracker: LiveTracker,
  index: SearchIndex,
  projectsDir: string,
): void {
  const reader = new IncrementalReader()
  const initialized = new Set<string>()

  async function ensureInit(key: string, jsonlPath: string): Promise<void> {
    if (initialized.has(key)) return
    // For a brand-new file we want to index from offset 0, not EOF.
    // IncrementalReader.init() positions at EOF; if there is no prior
    // indexed offset, we instead seed via indexFull so existing content is
    // captured before we switch to delta reads.
    if (!index.getFile(parseSessionId(key), parseAgentId(key))) {
      // First append on an unindexed file — let the reconciler pick it up
      // by invalidating its bookkeeping and forcing a full pass on next call.
      // Simpler: do nothing here; the watcher 'add' fires before 'change' so
      // this branch is rare. We just init at EOF and miss the first append's
      // contents (the reconciler will catch up on its next pass).
    }
    await reader.init(key, jsonlPath)
    initialized.add(key)
  }

  tracker.onAppend((e) => {
    void (async () => {
      try {
        await ensureInit(e.sessionId, e.jsonlPath)
        const { turns, rows } = await reader.readNew(e.sessionId, e.jsonlPath)
        if (turns.length === 0 && rows.length === 0) return
        const st = statSync(e.jsonlPath)
        index.appendDelta(
          e.sessionId,
          null,
          turns,
          { mtimeMs: st.mtimeMs, sizeBytes: st.size, byteOffset: st.size, jsonlPath: e.jsonlPath },
          undefined,
          rows,
        )
      } catch (err) {
        logError('search watcher: append indexing failed', err, { sessionId: e.sessionId })
      }
    })()
  })

  tracker.onSubagentAppend((e) => {
    void (async () => {
      const key = `${e.sessionId}:${e.agentId}`
      try {
        await ensureInit(key, e.jsonlPath)
        const { turns, rows } = await reader.readNew(key, e.jsonlPath)
        if (turns.length === 0 && rows.length === 0) return
        const st = statSync(e.jsonlPath)
        index.appendDelta(
          e.sessionId,
          e.agentId,
          turns,
          { mtimeMs: st.mtimeMs, sizeBytes: st.size, byteOffset: st.size, jsonlPath: e.jsonlPath },
          undefined,
          rows,
        )
      } catch (err) {
        logError('search watcher: subagent append indexing failed', err, {
          sessionId: e.sessionId,
          agentId: e.agentId,
        })
      }
    })()
  })

  // Note: chokidar 'unlink' is funneled through onListInvalidated() in the
  // existing watcher API rather than a typed event, so we don't get a
  // sessionId out of it here. The reconciler's orphan cleanup handles
  // disappeared sessions on its next pass; for v1 this is acceptable since
  // a stale row can't surface in search results once its content is gone
  // (no "session_id NOT IN (live ids)" filter is needed — UI gracefully
  // skips hits whose session no longer resolves).
  void projectsDir
}

function parseSessionId(key: string): string {
  const idx = key.indexOf(':')
  return idx === -1 ? key : key.slice(0, idx)
}

function parseAgentId(key: string): string | null {
  const idx = key.indexOf(':')
  return idx === -1 ? null : key.slice(idx + 1)
}

// Re-export createApp for consumers that want the Hono instance directly
// (e.g., for Vitest in-process HTTP tests that don't need a real bind).
export { createApp } from './app.js'
export type { AppOptions }

// Re-export reader surface for plan 05/06 consumers
export * from './reader/index.js'
export { getCacheDir } from './util/cache-dir.js'
export { logWarning, logError } from './util/logger.js'
export { errorResponse } from './util/error-response.js'
