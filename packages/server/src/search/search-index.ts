// packages/server/src/search/search-index.ts
//
// Cross-session full-text search backed by SQLite FTS5 (Phase 4).
//
// One row per indexed text block (text / thinking / tool_use / tool_result).
// Block-granularity is intentional: it lets snippets map back to a single
// turnUuid + contentKind, which the UI uses to scroll to the matching turn
// and expand the right child node.
//
// All writes for a single file are wrapped in one transaction — better-sqlite3
// is synchronous, so this is straightforward and ~10x faster than per-row
// autocommit.
//
// The DB lives at <cacheDir>/search.db; persistence across process restarts
// is the whole point of using better-sqlite3 over an in-memory engine.

import Database from 'better-sqlite3'
import type { Database as Db } from 'better-sqlite3'
import type {
  Turn,
  SearchHit,
  SearchContentKind,
  ClaudeRowOrUnknown,
} from '@cc-viewer/shared'

const SCHEMA_VERSION = 1
const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200

/**
 * Sentinel tokens the SearchIndex emits around match highlights. We use
 * Private-Use-Area Unicode codepoints (PUA-A: U+E000) bracketed by a fixed
 * ASCII tag — the combo is vanishingly unlikely to appear in real transcript
 * content but still passes cleanly through SQLite's TEXT bindings (which
 * forbid embedded NUL bytes). The UI's sanitizeSnippet() replaces them with
 * <mark>/</mark> AFTER HTML-escaping the rest of the snippet, which keeps
 * user-content `<mark>` text from being interpreted as a real marker.
 */
export const MARK_OPEN_SENTINEL = '\uE000CCV_MARK_OPEN\uE000'
export const MARK_CLOSE_SENTINEL = '\uE000CCV_MARK_CLOSE\uE000'

export interface SearchOptions {
  limit?: number
}

export interface FileRecord {
  sessionId: string
  agentId: string | null
  jsonlPath: string
  mtimeMs: number
  sizeBytes: number
  byteOffset: number
}

export interface SessionTitleInfo {
  title: string
  projectSlug: string
}

/**
 * Owner of the FTS5 search database. One instance per server process; pass
 * via AppContext so routes and the watcher can both use it.
 */
export class SearchIndex {
  private readonly db: Db

  constructor(dbPath: string) {
    this.db = new Database(dbPath)
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('synchronous = NORMAL')
    this.migrate()
  }

  /**
   * Run a search across all indexed sessions. Returns hits with FTS5 BM25
   * ranking and pre-rendered snippet HTML (markers `<mark>`/`</mark>`).
   *
   * `query` is passed to FTS5 verbatim — callers must validate length and
   * sanitize at the route boundary. We escape to a quoted phrase here only
   * if the query contains no FTS5 operators (for now we always quote it as
   * a phrase to keep behavior predictable; advanced operators can come in v2).
   */
  search(query: string, opts: SearchOptions = {}): { hits: SearchHit[]; truncated: boolean } {
    const limit = clampLimit(opts.limit)
    // Quote as a phrase — defends against bare colons / parens / quotes in
    // user input that would otherwise be parsed as FTS operators.
    const ftsQuery = toPhraseQuery(query)
    if (!ftsQuery) return { hits: [], truncated: false }

    const rows = this.db
      .prepare(
        `SELECT
           m.session_id      AS sessionId,
           m.agent_id        AS agentId,
           m.turn_uuid       AS turnUuid,
           m.timestamp       AS timestamp,
           m.role            AS role,
           m.content_kind    AS contentKind,
           snippet(messages, 0, ?, ?, '…', 16) AS snippetHtml,
           s.title           AS sessionTitle,
           s.project_slug    AS projectSlug
         FROM messages AS m
         LEFT JOIN sessions AS s ON s.session_id = m.session_id
         WHERE messages MATCH ?
         ORDER BY rank
         LIMIT ?`,
      )
      // Param order: open marker, close marker, FTS query, limit+1.
      .all(MARK_OPEN_SENTINEL, MARK_CLOSE_SENTINEL, ftsQuery, limit + 1) as RawHit[]

    const truncated = rows.length > limit
    const hits = rows.slice(0, limit).map(rowToHit)
    return { hits, truncated }
  }

  /**
   * Replace all rows for (sessionId, agentId) with the given turns. Use this
   * for full (re-)index of a file — the reconciler calls it on mtime mismatch.
   *
   * 007: pass `rows` to additionally index attachment payload text + api_error
   * messages that the Turn[] projection drops on the floor.
   */
  indexFull(
    sessionId: string,
    agentId: string | null,
    jsonlPath: string,
    mtimeMs: number,
    sizeBytes: number,
    turns: readonly Turn[],
    sessionInfo: SessionTitleInfo,
    rows?: readonly ClaudeRowOrUnknown[],
  ): void {
    const tx = this.db.transaction(() => {
      this.upsertSession(sessionId, sessionInfo)
      this.deleteFileRows(sessionId, agentId)
      this.appendTurns(sessionId, agentId, turns)
      if (rows && rows.length > 0) {
        this.appendRowExtras(sessionId, agentId, rows)
      }
      this.upsertFile({
        sessionId,
        agentId,
        jsonlPath,
        mtimeMs,
        sizeBytes,
        byteOffset: sizeBytes,
      })
    })
    tx()
  }

  /**
   * Append-only update: index `turns` as new rows for (sessionId, agentId)
   * without deleting prior rows. Used by the watcher on append events.
   */
  appendDelta(
    sessionId: string,
    agentId: string | null,
    turns: readonly Turn[],
    fileMeta: { mtimeMs: number; sizeBytes: number; byteOffset: number; jsonlPath: string },
    sessionInfo?: SessionTitleInfo,
    rows?: readonly ClaudeRowOrUnknown[],
  ): void {
    if (turns.length === 0 && (!rows || rows.length === 0)) {
      // Still update file meta so the next reconcile can skip.
      this.db
        .prepare(
          `UPDATE files SET mtime_ms = ?, size_bytes = ?, byte_offset = ?, indexed_at = ?
           WHERE session_id = ? AND COALESCE(agent_id, '') = COALESCE(?, '')`,
        )
        .run(fileMeta.mtimeMs, fileMeta.sizeBytes, fileMeta.byteOffset, Date.now(), sessionId, agentId)
      return
    }
    const tx = this.db.transaction(() => {
      if (sessionInfo) this.upsertSession(sessionId, sessionInfo)
      this.appendTurns(sessionId, agentId, turns)
      if (rows && rows.length > 0) {
        this.appendRowExtras(sessionId, agentId, rows)
      }
      this.upsertFile({
        sessionId,
        agentId,
        jsonlPath: fileMeta.jsonlPath,
        mtimeMs: fileMeta.mtimeMs,
        sizeBytes: fileMeta.sizeBytes,
        byteOffset: fileMeta.byteOffset,
      })
    })
    tx()
  }

  /** Drop all rows + file record for a session (or a specific subagent). */
  deleteSession(sessionId: string, agentId: string | null = null): void {
    const tx = this.db.transaction(() => {
      this.deleteFileRows(sessionId, agentId)
      this.db
        .prepare(`DELETE FROM files WHERE session_id = ? AND COALESCE(agent_id, '') = COALESCE(?, '')`)
        .run(sessionId, agentId)
      // Only drop the session row when the main agent goes away.
      if (agentId === null) {
        this.db.prepare(`DELETE FROM sessions WHERE session_id = ?`).run(sessionId)
      }
    })
    tx()
  }

  /** Lookup the persisted file record. Used by the reconciler to decide skip vs reindex. */
  getFile(sessionId: string, agentId: string | null): FileRecord | undefined {
    const row = this.db
      .prepare(
        `SELECT session_id AS sessionId, agent_id AS agentId, jsonl_path AS jsonlPath,
                mtime_ms AS mtimeMs, size_bytes AS sizeBytes, byte_offset AS byteOffset
         FROM files WHERE session_id = ? AND COALESCE(agent_id, '') = COALESCE(?, '')`,
      )
      .get(sessionId, agentId) as FileRecord | undefined
    return row
  }

  /** Cheap rollup for /api/search/status. */
  countSessions(): number {
    const r = this.db.prepare(`SELECT COUNT(*) AS n FROM sessions`).get() as { n: number }
    return r.n
  }

  /** Every sessionId that has at least one indexed file (main or subagent). */
  listIndexedSessionIds(): string[] {
    const rows = this.db
      .prepare(`SELECT DISTINCT session_id AS sessionId FROM files`)
      .all() as Array<{ sessionId: string }>
    return rows.map((r) => r.sessionId)
  }

  /** Every agentId indexed under a given sessionId (excludes the main NULL row). */
  listIndexedAgentIds(sessionId: string): string[] {
    const rows = this.db
      .prepare(`SELECT agent_id AS agentId FROM files WHERE session_id = ? AND agent_id IS NOT NULL`)
      .all(sessionId) as Array<{ agentId: string }>
    return rows.map((r) => r.agentId)
  }

  close(): void {
    this.db.close()
  }

  // ─── internals ──────────────────────────────────────────────────────────

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY);
    `)
    const current = (this.db.prepare(`SELECT version FROM schema_version`).get() as { version: number } | undefined)
      ?.version
    if (current === SCHEMA_VERSION) return

    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS messages USING fts5(
        content,
        session_id UNINDEXED,
        agent_id UNINDEXED,
        turn_uuid UNINDEXED,
        timestamp UNINDEXED,
        role UNINDEXED,
        content_kind UNINDEXED,
        tokenize = 'unicode61'
      );

      CREATE TABLE IF NOT EXISTS files (
        session_id TEXT NOT NULL,
        agent_id TEXT,
        jsonl_path TEXT NOT NULL,
        mtime_ms INTEGER NOT NULL,
        size_bytes INTEGER NOT NULL,
        byte_offset INTEGER NOT NULL,
        indexed_at INTEGER NOT NULL,
        PRIMARY KEY (session_id, agent_id)
      );

      CREATE TABLE IF NOT EXISTS sessions (
        session_id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        project_slug TEXT NOT NULL
      );
    `)
    this.db.prepare(`INSERT OR REPLACE INTO schema_version (version) VALUES (?)`).run(SCHEMA_VERSION)
  }

  private upsertSession(sessionId: string, info: SessionTitleInfo): void {
    this.db
      .prepare(
        `INSERT INTO sessions (session_id, title, project_slug) VALUES (?, ?, ?)
         ON CONFLICT(session_id) DO UPDATE SET title = excluded.title, project_slug = excluded.project_slug`,
      )
      .run(sessionId, info.title, info.projectSlug)
  }

  private deleteFileRows(sessionId: string, agentId: string | null): void {
    this.db
      .prepare(
        `DELETE FROM messages
         WHERE session_id = ? AND COALESCE(agent_id, '') = COALESCE(?, '')`,
      )
      .run(sessionId, agentId)
  }

  private appendTurns(sessionId: string, agentId: string | null, turns: readonly Turn[]): void {
    const insert = this.db.prepare(
      `INSERT INTO messages (content, session_id, agent_id, turn_uuid, timestamp, role, content_kind)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    for (const turn of turns) {
      if (turn.role !== 'user' && turn.role !== 'assistant') continue
      if (turn.isMeta) continue
      for (const block of extractBlocks(turn)) {
        if (!block.content) continue
        insert.run(block.content, sessionId, agentId, turn.uuid, turn.timestamp, turn.role, block.kind)
      }
    }
  }

  /**
   * 007 (T050): index schema-typed row fields that the Turn[] projection drops:
   *   - attachment payload text (skill listings, hook stdout/stderr, file paths, …)
   *   - system row content (api_error messages, away_summary, informational)
   * Role is recorded as 'system' for these rows. Indexed against the row uuid
   * so the UI's search-result jump can resolve to the originating row.
   */
  private appendRowExtras(
    sessionId: string,
    agentId: string | null,
    rows: readonly ClaudeRowOrUnknown[],
  ): void {
    const insert = this.db.prepare(
      `INSERT INTO messages (content, session_id, agent_id, turn_uuid, timestamp, role, content_kind)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    for (const row of rows) {
      const blocks = extractRowExtras(row)
      for (const block of blocks) {
        if (!block.content) continue
        insert.run(
          block.content,
          sessionId,
          agentId,
          block.rowUuid,
          block.timestamp ?? '',
          'system',
          block.kind,
        )
      }
    }
  }

  private upsertFile(rec: FileRecord): void {
    this.db
      .prepare(
        `INSERT INTO files (session_id, agent_id, jsonl_path, mtime_ms, size_bytes, byte_offset, indexed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(session_id, agent_id) DO UPDATE SET
           jsonl_path = excluded.jsonl_path,
           mtime_ms = excluded.mtime_ms,
           size_bytes = excluded.size_bytes,
           byte_offset = excluded.byte_offset,
           indexed_at = excluded.indexed_at`,
      )
      .run(
        rec.sessionId,
        rec.agentId,
        rec.jsonlPath,
        rec.mtimeMs,
        rec.sizeBytes,
        rec.byteOffset,
        Date.now(),
      )
  }
}

interface RawHit {
  sessionId: string
  agentId: string | null
  turnUuid: string
  timestamp: string
  role: string
  contentKind: string
  snippetHtml: string
  sessionTitle: string | null
  projectSlug: string | null
}

function rowToHit(r: RawHit): SearchHit {
  // SearchHit's role field is narrowed to 'user' | 'assistant' on the wire;
  // attachments + system rows are exposed as 'assistant' for now (a future
  // change can widen the union; the contentKind already disambiguates).
  return {
    sessionId: r.sessionId,
    agentId: r.agentId,
    turnUuid: r.turnUuid,
    timestamp: r.timestamp,
    role: r.role === 'user' ? 'user' : 'assistant',
    contentKind: r.contentKind as SearchContentKind,
    snippetHtml: r.snippetHtml,
    sessionTitle: r.sessionTitle ?? r.sessionId,
    projectSlug: r.projectSlug ?? '',
  }
}

interface ExtractedBlock {
  kind: SearchContentKind
  content: string
}

function extractBlocks(turn: Turn): ExtractedBlock[] {
  const out: ExtractedBlock[] = []
  for (const text of turn.textBlocks) {
    if (text.trim()) out.push({ kind: 'text', content: text })
  }
  for (const thinking of turn.thinkingBlocks) {
    if (thinking.trim()) out.push({ kind: 'thinking', content: thinking })
  }
  for (const use of turn.toolUses) {
    const stringified = stringifyInput(use.input)
    if (stringified) out.push({ kind: 'tool_use', content: `${use.name} ${stringified}` })
  }
  for (const result of turn.toolResults) {
    const text = stringifyResultContent(result.content)
    if (text) out.push({ kind: 'tool_result', content: text })
  }
  return out
}

function stringifyInput(input: Record<string, unknown>): string {
  try {
    // Skip the wrapping braces/quotes — JSON keys + values both contribute
    // searchable text and we want the words searchable, not "key":"value" syntax.
    return Object.entries(input)
      .map(([k, v]) => `${k} ${valueToText(v)}`)
      .join(' ')
      .trim()
  } catch {
    return ''
  }
}

function stringifyResultContent(content: string | unknown[]): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((block) => {
        if (typeof block === 'string') return block
        if (block && typeof block === 'object' && 'text' in block && typeof (block as { text: unknown }).text === 'string') {
          return (block as { text: string }).text
        }
        return ''
      })
      .filter(Boolean)
      .join('\n')
  }
  return ''
}

function valueToText(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  try {
    return JSON.stringify(v)
  } catch {
    return ''
  }
}

function clampLimit(limit: number | undefined): number {
  if (!limit || limit < 1) return DEFAULT_LIMIT
  return Math.min(limit, MAX_LIMIT)
}

interface RowExtraBlock {
  kind: SearchContentKind
  content: string
  rowUuid: string
  timestamp?: string
}

interface AnyRow {
  type?: unknown
  uuid?: unknown
  timestamp?: unknown
  subtype?: unknown
  content?: unknown
  error?: unknown
  attachment?: unknown
}

/**
 * Extracts text the Turn[] projection doesn't surface: attachment payload text
 * and system row error / informational content. Maps each block to the
 * originating row's uuid so the UI can jump to it (T052 in Phase 6).
 *
 * Schema source: packages/shared/src/jsonl/schema.ts (sections 580-820 for
 * attachments, 910-917 for system subtypes).
 */
function extractRowExtras(row: ClaudeRowOrUnknown): RowExtraBlock[] {
  const r = row as unknown as AnyRow
  const out: RowExtraBlock[] = []
  const rowUuid = typeof r.uuid === 'string' && r.uuid.length > 0 ? r.uuid : '__synth'
  const timestamp = typeof r.timestamp === 'string' ? r.timestamp : undefined

  if (r.type === 'attachment' && r.attachment && typeof r.attachment === 'object') {
    const text = attachmentText(r.attachment as Record<string, unknown>)
    if (text) out.push({ kind: 'tool_use', content: text, rowUuid, timestamp })
    return out
  }

  if (r.type === 'system') {
    const errMsg = systemErrorMessage(r)
    if (errMsg) out.push({ kind: 'tool_result', content: errMsg, rowUuid, timestamp })
    return out
  }

  return out
}

function attachmentText(att: Record<string, unknown>): string {
  const t = att.type
  const parts: string[] = []
  if (typeof t === 'string') parts.push(t)

  const append = (v: unknown): void => {
    if (v == null) return
    if (typeof v === 'string') {
      if (v) parts.push(v)
      return
    }
    if (Array.isArray(v)) {
      for (const item of v) append(item)
      return
    }
    if (typeof v === 'object') {
      try {
        parts.push(JSON.stringify(v))
      } catch {
        // ignore
      }
      return
    }
    parts.push(String(v))
  }

  // Walk all string-valued fields for indexable text. Most attachment subtypes
  // carry a small set of relevant fields (path / displayPath / filename /
  // content / snippet / addedNames / removedNames / readdedNames / commandMode /
  // prompt / allowedTools / condition / reason / hookName / hookEvent / stdout
  // / stderr / blockingError); rather than enumerate 22 subtypes, iterate the
  // keys.
  for (const [k, v] of Object.entries(att)) {
    if (k === 'type') continue
    append(v)
  }
  return parts.join(' ')
}

function systemErrorMessage(r: AnyRow): string {
  if (r.subtype === 'api_error') {
    const errObj = r.error
    if (typeof errObj === 'string') return errObj
    if (errObj && typeof errObj === 'object') {
      const msg = (errObj as { message?: unknown }).message
      if (typeof msg === 'string') return msg
      try {
        return JSON.stringify(errObj)
      } catch {
        return ''
      }
    }
  }
  // For away_summary / informational / local_command etc., `.content` is the
  // human-visible text.
  if (typeof r.content === 'string') return r.content
  return ''
}

/**
 * Quote the user query as an FTS5 phrase. Returns '' if the cleaned query has
 * no usable tokens (avoids running a no-op MATCH).
 */
function toPhraseQuery(raw: string): string {
  const cleaned = raw.trim().replace(/"/g, '')
  if (!cleaned) return ''
  return `"${cleaned}"`
}
