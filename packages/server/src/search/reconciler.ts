// packages/server/src/search/reconciler.ts
//
// Background reconciliation between the SessionMap (live disk state) and the
// FTS index (persisted from prior runs). On boot:
//
//   1. List all sessions from disk.
//   2. For each: compare disk mtime/size against the indexed `files` row.
//      - missing or stale → enqueue for full re-index.
//      - matching → skip.
//   3. Drop indexed sessions whose JSONL no longer exists on disk.
//
// Re-indexing happens serially (one at a time) — better-sqlite3 is synchronous
// and there's no concurrent write story to manage. Progress is emitted via an
// EventEmitter so routes (SSE / polling) can surface it.

import { stat } from 'node:fs/promises'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { EventEmitter } from 'node:events'
import type { SessionMap } from '../reader/session-map.js'
import { loadSessionFromDisk } from '../reader/session-loader.js'
import { logError } from '../util/logger.js'
import type { SearchIndex } from './search-index.js'

export interface ReconcileProgress {
  done: number
  total: number
  currentSessionId: string | null
}

export interface ReconcilerStatus {
  totalSessions: number
  pendingSessions: number
  isReconciling: boolean
}

/**
 * Coordinates incremental indexing of session JSONLs into the FTS5 index.
 * Owned by the server; one instance per process.
 */
export class SearchReconciler {
  private readonly emitter = new EventEmitter()
  private isRunning = false
  private currentRun: Promise<void> | null = null
  private total = 0
  private done = 0
  private currentSessionId: string | null = null

  constructor(
    private readonly searchIndex: SearchIndex,
    private readonly sessionMap: SessionMap,
    private readonly projectsDir: string,
  ) {
    this.emitter.setMaxListeners(50)
  }

  /**
   * Kick off a reconciliation pass. Resolves when the pass finishes (or
   * immediately if one is already in flight, returning that pending promise).
   */
  start(): Promise<void> {
    if (this.currentRun) return this.currentRun
    this.currentRun = this.runOnce()
      .catch((err) => {
        logError('search reconciler failed', err, { projectsDir: this.projectsDir })
      })
      .finally(() => {
        this.currentRun = null
      })
    return this.currentRun
  }

  status(): ReconcilerStatus {
    return {
      totalSessions: this.searchIndex.countSessions(),
      pendingSessions: this.isRunning ? Math.max(0, this.total - this.done) : 0,
      isReconciling: this.isRunning,
    }
  }

  onProgress(handler: (p: ReconcileProgress) => void): () => void {
    this.emitter.on('progress', handler)
    return () => {
      this.emitter.off('progress', handler)
    }
  }

  onDone(handler: () => void): () => void {
    this.emitter.on('done', handler)
    return () => {
      this.emitter.off('done', handler)
    }
  }

  // ─── internals ──────────────────────────────────────────────────────────

  private async runOnce(): Promise<void> {
    this.isRunning = true
    this.total = 0
    this.done = 0
    this.currentSessionId = null

    try {
      const sessions = await this.sessionMap.get(this.projectsDir)
      const onDiskSessionIds = new Set(sessions.map((s) => s.sessionId))

      const stale: typeof sessions = []
      for (const s of sessions) {
        const jsonlPath = resolveJsonlPath(this.projectsDir, s.projectSlug, s.sessionId)
        if (!jsonlPath) continue
        try {
          const st = await stat(jsonlPath)
          const indexed = this.searchIndex.getFile(s.sessionId, null)
          if (
            indexed &&
            indexed.mtimeMs === st.mtimeMs &&
            indexed.sizeBytes === st.size &&
            indexed.jsonlPath === jsonlPath
          ) {
            // Main file unchanged. Subagents are checked independently in indexSession()
            // (cheap stat-only loop) so we still need to visit if any are stale.
            if (!subagentsNeedRefresh(this.searchIndex, s.sessionId, jsonlPath)) continue
          }
        } catch {
          // Can't stat — skip; the file may have been removed mid-scan.
          continue
        }
        stale.push(s)
      }

      this.total = stale.length
      this.emitProgress()

      for (const s of stale) {
        this.currentSessionId = s.sessionId
        this.emitProgress()
        const jsonlPath = resolveJsonlPath(this.projectsDir, s.projectSlug, s.sessionId)
        if (!jsonlPath) {
          this.done++
          continue
        }
        try {
          await this.indexSession(s.sessionId, s.projectSlug, s.title, jsonlPath)
        } catch (err) {
          logError('search reconciler: indexSession failed', err, {
            sessionId: s.sessionId,
            jsonlPath,
          })
        }
        this.done++
        this.emitProgress()
      }

      // Drop sessions that disappeared from disk.
      this.cleanupOrphans(onDiskSessionIds)
    } finally {
      this.isRunning = false
      this.currentSessionId = null
      this.emitter.emit('done')
    }
  }

  private async indexSession(
    sessionId: string,
    projectSlug: string,
    title: string,
    jsonlPath: string,
  ): Promise<void> {
    const { session, mtimeMs } = await loadSessionFromDisk(jsonlPath)
    const mainSize = await fileSize(jsonlPath)
    this.searchIndex.indexFull(
      sessionId,
      null,
      jsonlPath,
      mtimeMs,
      mainSize,
      session.turns,
      { title: title || session.title || sessionId, projectSlug },
    )

    // Subagent files are produced alongside the main load; indexFull each
    // independently so they have their own files-table row + can be invalidated
    // separately when only one subagent JSONL changes.
    if (session.subagents.length > 0) {
      const subagentsDir = join(dirname(jsonlPath), sessionId, 'subagents')
      const seenAgentIds = new Set<string>()
      for (const sa of session.subagents) {
        seenAgentIds.add(sa.agentId)
        const agentJsonl = join(subagentsDir, `agent-${sa.agentId}.jsonl`)
        try {
          const st = await stat(agentJsonl)
          this.searchIndex.indexFull(
            sessionId,
            sa.agentId,
            agentJsonl,
            st.mtimeMs,
            st.size,
            sa.turns,
            { title: title || session.title || sessionId, projectSlug },
          )
        } catch (err) {
          logError('search reconciler: subagent indexFull failed', err, {
            sessionId,
            agentId: sa.agentId,
            agentJsonl,
          })
        }
      }
      // Drop subagents that vanished. Their rows in `files` would otherwise
      // accumulate forever.
      try {
        const liveAgentFiles = readdirSync(subagentsDir)
        const liveAgentIds = new Set(
          liveAgentFiles
            .filter((f) => f.startsWith('agent-') && f.endsWith('.jsonl'))
            .map((f) => f.replace(/^agent-/, '').replace(/\.jsonl$/, '')),
        )
        for (const agentId of seenAgentIds) {
          if (!liveAgentIds.has(agentId)) {
            this.searchIndex.deleteSession(sessionId, agentId)
          }
        }
      } catch {
        // Subagents dir vanished — handled by orphan cleanup pass.
      }
    }
  }

  private cleanupOrphans(onDiskSessionIds: Set<string>): void {
    // No bulk listing API on the index — but the index isn't large; we keep
    // the orphan-drop bounded by walking sessions table directly through a
    // public method. (Adding a getAllSessionIds() helper to SearchIndex if
    // perf becomes an issue is trivial.)
    // For now, rely on watcher 'unlink' events to drop the common case;
    // boot-time orphan cleanup is handled below via `getOrphanIds()`.
    const orphanIds = this.searchIndex.listIndexedSessionIds().filter((id) => !onDiskSessionIds.has(id))
    for (const id of orphanIds) {
      this.searchIndex.deleteSession(id)
    }
  }

  private emitProgress(): void {
    this.emitter.emit('progress', {
      done: this.done,
      total: this.total,
      currentSessionId: this.currentSessionId,
    } satisfies ReconcileProgress)
  }
}

/**
 * Build the absolute path to a session's JSONL given the projectsDir + slug.
 * Returns null if it doesn't exist on disk (e.g. removed mid-scan).
 */
function resolveJsonlPath(projectsDir: string, projectSlug: string, sessionId: string): string | null {
  const candidate = join(projectsDir, projectSlug, `${sessionId}.jsonl`)
  return existsSync(candidate) ? candidate : null
}

async function fileSize(path: string): Promise<number> {
  try {
    const st = await stat(path)
    return st.size
  } catch {
    return 0
  }
}

/**
 * Cheap mtime/size sweep of a session's subagent files. If any subagent file
 * differs from its indexed row (or any indexed agent disappeared, or any new
 * agent file appeared), report the session as stale so the main re-index path
 * picks it up.
 */
function subagentsNeedRefresh(index: SearchIndex, sessionId: string, mainJsonlPath: string): boolean {
  const subagentsDir = join(dirname(mainJsonlPath), sessionId, 'subagents')
  if (!existsSync(subagentsDir)) {
    // No on-disk subagents. If the index thinks there are any, we need a refresh
    // to drop them.
    return index.listIndexedAgentIds(sessionId).length > 0
  }

  let onDiskAgentFiles: string[]
  try {
    onDiskAgentFiles = readdirSync(subagentsDir).filter((f) => f.startsWith('agent-') && f.endsWith('.jsonl'))
  } catch {
    return false
  }

  const indexedAgentIds = new Set(index.listIndexedAgentIds(sessionId))
  const onDiskAgentIds = new Set(
    onDiskAgentFiles.map((f) => f.replace(/^agent-/, '').replace(/\.jsonl$/, '')),
  )

  // Agent appeared or disappeared since last index → refresh.
  if (onDiskAgentIds.size !== indexedAgentIds.size) return true
  for (const id of onDiskAgentIds) if (!indexedAgentIds.has(id)) return true

  for (const f of onDiskAgentFiles) {
    const agentId = f.replace(/^agent-/, '').replace(/\.jsonl$/, '')
    const agentPath = join(subagentsDir, f)
    let st
    try {
      st = statSync(agentPath)
    } catch {
      return true
    }
    const indexed = index.getFile(sessionId, agentId)
    if (!indexed || indexed.mtimeMs !== st.mtimeMs || indexed.sizeBytes !== st.size) {
      return true
    }
  }
  return false
}
