// packages/server/src/reader/incremental-reader.ts
import { open, stat } from 'node:fs/promises'
import type { FileHandle } from 'node:fs/promises'
import type { Turn, ClaudeRowOrUnknown } from '@cc-viewer/shared'
import { parseJSONL, parseRowsFromJSONL } from './parser.js'
import { eventsToTurns } from './normalizer.js'

/**
 * Per-file incremental reader for live tailing. Tracks byte-offset + inode
 * + a UTF-8 partial-line buffer so we never parse a half-written JSONL line
 * (Pitfall 4) and we recover when Claude Code rotates a file (Pitfall 5).
 *
 * Each SSE connection owns its own IncrementalReader instance. State keys
 * are caller-defined strings — typically the sessionId for the parent JSONL
 * and `<sessionId>:<agentId>` for a subagent JSONL.
 *
 * Lifecycle:
 *   1. await reader.init(key, jsonlPath)   — positions at current EOF.
 *   2. on each chokidar 'change': await reader.readNew(key, jsonlPath).
 *   3. on disconnect: reader.close(key) (or closeAll()).
 */
export class IncrementalReader {
  private states = new Map<string, FileState>()

  /**
   * Position the reader at the current end-of-file. Subsequent readNew()
   * calls return only newly-appended bytes (LIVE-01 semantic: "new messages
   * appear as appended", not "the whole transcript replays").
   */
  async init(key: string, jsonlPath: string): Promise<void> {
    // Close any prior state for this key (re-init is idempotent).
    await this.close(key)
    const st = await stat(jsonlPath)
    const fh = await open(jsonlPath, 'r')
    this.states.set(key, {
      fh,
      ino: st.ino,
      offset: st.size,
      buffer: '',
    })
  }

  /**
   * Read all bytes appended since the last call. Returns the parsed delta
   * as `{ turns, rows }`. Empty arrays when there are no complete new lines
   * (a partial line in flight stays in the buffer).
   *
   * Recovers from:
   *   - Inode rotation: file replaced with a different inode → close old fd,
   *     reopen, reset offset to 0 + parse from beginning.
   *   - Truncation: file size shrank below the tracked offset → reset to 0.
   *   - File temporarily unavailable: returns []; the next call retries.
   *
   * 007-ui-information-revamp: returns BOTH the legacy Turn[] projection
   * AND the schema-typed ClaudeRowOrUnknown[] so the SSE handler can fan out
   * to consumers of either shape.
   */
  async readNew(key: string, jsonlPath: string): Promise<{ turns: Turn[]; rows: ClaudeRowOrUnknown[] }> {
    const empty = { turns: [] as Turn[], rows: [] as ClaudeRowOrUnknown[] }
    let state = this.states.get(key)
    if (!state) {
      // Late init guard. SSE handlers always init first; this branch keeps
      // a misuse from silently returning all turns on unknown keys.
      await this.init(key, jsonlPath)
      return empty
    }

    let st: Awaited<ReturnType<typeof stat>>
    try {
      st = await stat(jsonlPath)
    } catch {
      // File momentarily missing (rotation in progress). Caller's chokidar
      // 'unlink' handler is the authoritative signal; we just return [].
      return empty
    }

    // Inode rotation: re-open from the new inode at offset 0.
    if (st.ino !== state.ino) {
      await closeHandle(state.fh)
      const fh = await open(jsonlPath, 'r')
      state = { fh, ino: st.ino, offset: 0, buffer: '' }
      this.states.set(key, state)
    }

    // Truncation: file shrunk below tracked offset (e.g. log rotation).
    if (st.size < state.offset) {
      await closeHandle(state.fh)
      const fh = await open(jsonlPath, 'r')
      state = { fh, ino: st.ino, offset: 0, buffer: '' }
      this.states.set(key, state)
    }

    if (st.size === state.offset && state.buffer.length === 0) return empty

    if (!state.fh) state.fh = await open(jsonlPath, 'r')

    const need = st.size - state.offset
    if (need > 0) {
      const buf = Buffer.alloc(need)
      let read = 0
      while (read < need) {
        const { bytesRead } = await state.fh.read(buf, read, need - read, state.offset + read)
        if (bytesRead === 0) break
        read += bytesRead
      }
      state.offset += read
      // Append to UTF-8 line buffer. NOTE: this can split a multi-byte UTF-8
      // codepoint at the read boundary, leaving an invalid leading sequence.
      // For typical JSONL emitted by Claude Code, an append always finishes
      // before the watcher fires (chokidar's awaitWriteFinish stabilityThreshold
      // 50ms — see watcher.ts). The risk is bounded; if a real corruption
      // appears, parseJSONL throws on the line and parseWarnings increments,
      // which is acceptable degradation.
      state.buffer += buf.subarray(0, read).toString('utf8')
    }

    // Split on \n; keep the last element (partial or empty) in the buffer.
    const newlineIdx = state.buffer.lastIndexOf('\n')
    if (newlineIdx === -1) return empty // no complete line yet

    const completeText = state.buffer.slice(0, newlineIdx + 1)
    state.buffer = state.buffer.slice(newlineIdx + 1)

    const { events } = parseJSONL(completeText)
    const { rows } = parseRowsFromJSONL(completeText)
    return { turns: eventsToTurns(events), rows }
  }

  /** Close the file handle for a single key. */
  async close(key: string): Promise<void> {
    const state = this.states.get(key)
    if (!state) return
    await closeHandle(state.fh)
    this.states.delete(key)
  }

  /** Close every open file handle. Call on server shutdown. */
  async closeAll(): Promise<void> {
    const keys = [...this.states.keys()]
    for (const key of keys) await this.close(key)
  }
}

interface FileState {
  fh?: FileHandle
  ino: number
  offset: number
  buffer: string
}

async function closeHandle(fh: FileHandle | undefined): Promise<void> {
  if (!fh) return
  try {
    await fh.close()
  } catch {
    /* already closed or not opened */
  }
}
