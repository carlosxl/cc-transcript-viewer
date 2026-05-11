// packages/server/src/reader/watcher.ts
import chokidar, { type FSWatcher } from 'chokidar'
import { EventEmitter } from 'node:events'
import { basename, dirname, extname, sep } from 'node:path'
import { logError } from '../util/logger.js'

/**
 * Per-session live-append tracker. Decorates the chokidar watcher with a
 * 5s "liveness" window keyed by sessionId (D-24 / D-34) AND a Phase 3
 * EventEmitter that fans append events out to SSE subscribers (W3.2).
 *
 * The watcher subscribes to chokidar 'change' events on .jsonl files. Two
 * path shapes are recognized:
 *   <projectsDir>/<slug>/<sessionId>.jsonl                       → 'append'
 *   <projectsDir>/<slug>/<sessionId>/subagents/agent-<id>.jsonl  → 'subagent-append'
 *
 * 'change' events DO NOT invalidate the SessionMap — only the per-session
 * `isLive` flag changes; the list shape is unaffected. 'add' / 'unlink'
 * still invalidate the list per Phase 1.
 */
export interface AppendEvent {
  sessionId: string
  jsonlPath: string
}
export interface SubagentAppendEvent {
  sessionId: string
  agentId: string
  jsonlPath: string
}

export interface LiveTracker {
  /** Returns true when the session's .jsonl was appended within `windowMs`. */
  isLive(sessionId: string, windowMs?: number): boolean
  /** Test-only / shutdown — clears the tracking map. */
  clear(): void
  /** Subscribe to main-session JSONL appends. Returns the unsubscribe function. */
  onAppend(handler: (e: AppendEvent) => void): () => void
  /** Subscribe to subagent JSONL appends. */
  onSubagentAppend(handler: (e: SubagentAppendEvent) => void): () => void
  /** Test helper: synthesize an append event without touching the FS. */
  emitAppendForTest(e: AppendEvent): void
  /** Test helper: synthesize a subagent append event. */
  emitSubagentAppendForTest(e: SubagentAppendEvent): void
}

export function watchProjectsDir(
  projectsDir: string,
  onListInvalidated: () => void,
): FSWatcher & LiveTracker {
  const lastAppend = new Map<string, number>()  // sessionId → epoch ms
  const emitter = new EventEmitter()
  // SSE subscribers can hold many listeners; defaults to 10 which is too few
  // for a viewer with multiple tabs. Keep it bounded but generous.
  emitter.setMaxListeners(100)

  /**
   * chokidar 'change' event semantics with awaitWriteFinish (verified by watcher.test.ts):
   *
   *  - Real content writes (appendFileSync, write streams) DO fire 'change' within ~250ms
   *    (see test "appending real content flips isLive within 500ms (F-5 regression anchor)").
   *
   *  - Metadata-only mtime updates (e.g. `fs.utimesSync` without a write) ALSO fire 'change'
   *    in the standard test environment (Node 20+ / chokidar v5 / macOS / mkdtemp under /tmp),
   *    within ~1s (see test "metadata-only utimesSync (touch-equivalent) — documented behavior").
   *
   *  - HOWEVER: F-5 walkthrough (02-10-HUMAN-VERIFY.md, 2026-04-27) reported that POSIX
   *    `touch` on a SYMLINKED .jsonl under ~/.claude/projects/ did NOT flip the live dot
   *    within 5s. Likely cause: macOS FSEvents semantics on symlinks combined with
   *    chokidar's awaitWriteFinish stability poll behave differently from the in-tmp
   *    real-file case. Real-content appends (`echo … >> file`) sidestep this entirely
   *    because they change file SIZE, which awaitWriteFinish detects unambiguously.
   *
   * BROWSER-03 product semantics: "session is being actively appended" → real content writes
   * from a live `claude` process. Verify protocols MUST use `echo … >> file`, not
   * `touch file`, when exercising the live-indicator gate (see 02-10-HUMAN-VERIFY.md
   * D-40.1 live-dot step, hardened by plan 02-13).
   */
  const watcher = chokidar.watch(projectsDir, {
    awaitWriteFinish: { stabilityThreshold: 50, pollInterval: 50 },  // R3: tighter for liveness
    depth: 3,
    ignoreInitial: true,
    persistent: true,
    ignorePermissionErrors: true,
  })

  watcher.on('add',    (p) => { if (p.endsWith('.jsonl')) onListInvalidated() })
  watcher.on('unlink', (p) => { if (p.endsWith('.jsonl')) onListInvalidated() })
  watcher.on('change', (p) => {
    if (!p.endsWith('.jsonl')) return
    // Distinguish subagent JSONL appends from main session appends by path:
    //   .../<slug>/<sessionId>/subagents/agent-<agentId>.jsonl  → subagent
    //   .../<slug>/<sessionId>.jsonl                            → main session
    const fileBase = basename(p, extname(p))
    const parentDir = dirname(p)
    const grandparentName = basename(parentDir)
    if (grandparentName === 'subagents' && fileBase.startsWith('agent-')) {
      const agentId = fileBase.slice('agent-'.length)
      // The session id is the directory name two levels up:
      //   .../<sessionId>/subagents/agent-X.jsonl → dirname(parentDir) basename
      const sessionId = basename(dirname(parentDir))
      lastAppend.set(sessionId, Date.now())   // a subagent append marks the parent live too
      emitter.emit('subagent-append', { sessionId, agentId, jsonlPath: p } satisfies SubagentAppendEvent)
      return
    }
    // Main session append.
    const sessionId = fileBase
    lastAppend.set(sessionId, Date.now())
    emitter.emit('append', { sessionId, jsonlPath: p } satisfies AppendEvent)
    // Do NOT invalidate the SessionMap — list shape didn't change.
  })
  // sep is imported above to keep the path-shape comments syntactically valid;
  // not used at runtime since basename/dirname handle separators correctly.
  void sep

  watcher.on('error', (err) => {
    logError('chokidar watcher error', err, { projectsDir })
  })

  // Attach LiveTracker methods to the watcher object
  const tracker: LiveTracker = {
    isLive(sessionId: string, windowMs = 5_000): boolean {
      const t = lastAppend.get(sessionId)
      return t !== undefined && (Date.now() - t) < windowMs
    },
    clear(): void {
      lastAppend.clear()
    },
    onAppend(handler) {
      emitter.on('append', handler)
      return () => { emitter.off('append', handler) }
    },
    onSubagentAppend(handler) {
      emitter.on('subagent-append', handler)
      return () => { emitter.off('subagent-append', handler) }
    },
    emitAppendForTest(e) { emitter.emit('append', e) },
    emitSubagentAppendForTest(e) { emitter.emit('subagent-append', e) },
  }
  Object.assign(watcher, tracker)

  return watcher as FSWatcher & LiveTracker
}
