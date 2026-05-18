// packages/server/src/reader/session-map.ts
import { open, readFile, readdir, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, basename, dirname } from 'node:path'
import type { SessionMeta, AggregatedUsage, UsageSummary, ClaudeEvent, Turn, UsageBlock } from '@cc-viewer/shared'
import { parseJSONL } from './parser.js'
import { eventsToTurns } from './normalizer.js'
import { logWarning, logError } from '../util/logger.js'

/**
 * SessionsIndex JSON schema (observed in ~4% of projects per ARCHITECTURE.md).
 * Only the fields we need; unknown fields are ignored at parse time.
 */
interface SessionsIndexFile {
  version?: number
  sessions?: Array<{
    sessionId?: string
    firstTimestamp?: string
    lastTimestamp?: string
    messageCount?: number
    customTitle?: string
    aiTitle?: string
    lastPrompt?: string
    agentName?: string
    hasSubagents?: boolean
    mtime?: number
  }>
}

export interface SessionMapState {
  projectsDir: string
  sessions: SessionMeta[]
  builtAt: number
}

/**
 * Lazy session-map cache (D-20). The first call to `get(dir)` triggers a scan.
 * `invalidate()` clears the cache — the next `get` re-scans. The chokidar
 * watcher in `watcher.ts` calls `invalidate()` on JSONL add/unlink.
 */
export class SessionMap {
  private cache: SessionMapState | null = null

  /**
   * Returns the cached session list for `projectsDir`, scanning on first
   * access or after an invalidation.
   */
  async get(projectsDir: string): Promise<SessionMeta[]> {
    if (this.cache && this.cache.projectsDir === projectsDir) {
      return this.cache.sessions
    }
    const sessions = await listSessions(projectsDir)
    this.cache = { projectsDir, sessions, builtAt: Date.now() }
    return sessions
  }

  /** Force re-scan on next get(). Called by the chokidar watcher. */
  invalidate(): void {
    this.cache = null
  }

  /** For tests. */
  isCached(): boolean {
    return this.cache !== null
  }
}

/**
 * Scan `projectsDir` for Claude Code sessions.
 *
 * Layout:
 *   <projectsDir>/<slug>/              # project dir
 *     sessions-index.json              # optional fast path (D-21)
 *     <sessionId>.jsonl                # one per session
 *     <sessionId>/                     # companion dir if session has subagents
 *       subagents/                     # present iff session spawned agents
 *
 * Strategy per D-20 + D-21:
 *   For each project dir:
 *     if sessions-index.json exists, validate each entry's mtime against the
 *     real .jsonl mtime; trusted entries skip the full-file parse.
 *     Otherwise, fall back to a full-file parseJSONL pass for metadata.
 */
export async function listSessions(projectsDir: string): Promise<SessionMeta[]> {
  if (!existsSync(projectsDir)) return []

  let projectSlugs: string[]
  try {
    const entries = await readdir(projectsDir, { withFileTypes: true })
    projectSlugs = entries.filter(e => e.isDirectory()).map(e => e.name)
  } catch (err) {
    logError('listSessions: failed to read projectsDir', err, { projectsDir })
    return []
  }

  const all: SessionMeta[] = []

  for (const slug of projectSlugs) {
    const projectDir = join(projectsDir, slug)
    try {
      const sessions = await listSessionsForProject(projectDir, slug)
      all.push(...sessions)
    } catch (err) {
      logError('listSessions: project scan failed', err, { projectDir })
      // Skip this project but continue with others.
    }
  }

  return all
}

async function listSessionsForProject(projectDir: string, slug: string): Promise<SessionMeta[]> {
  // Slug → cwd is lossy (both `/` and `.` are encoded as `-`), so a naive
  // decode mangles real hyphens and collapses distinct projects to identical-
  // looking strings. Recover the true cwd from any JSONL in the dir; also
  // recover worktree info (originatingCwd + name) when present, so sessions
  // from a worktree group under their parent project in the sidebar.
  const resolved = await resolveProject(projectDir, slug)
  const projectPath = resolved.projectPath

  const indexPath = join(projectDir, 'sessions-index.json')
  let index: SessionsIndexFile | null = null
  if (existsSync(indexPath)) {
    try {
      const raw = await readFile(indexPath, 'utf8')
      index = JSON.parse(raw) as SessionsIndexFile
    } catch (err) {
      logWarning('sessions-index.json read/parse failed, falling back', { projectDir, error: String(err) })
      index = null
    }
  }

  // Enumerate .jsonl files at the top level of this project dir.
  let entries
  try {
    entries = await readdir(projectDir, { withFileTypes: true })
  } catch (err) {
    logError('listSessionsForProject: readdir failed', err, { projectDir })
    return []
  }

  // F-4: accept symlinks alongside regular files. Dirent.isFile() returns false
  // for symlinks because readdir reports the LINK's type, not the target's.
  // The stat() call below DOES follow symlinks, so we verify the resolved
  // target is a regular file before treating it as a session.
  const jsonlFiles = entries.filter(
    e => (e.isFile() || e.isSymbolicLink()) && e.name.endsWith('.jsonl'),
  )
  const metas: SessionMeta[] = []

  for (const entry of jsonlFiles) {
    const jsonlPath = join(projectDir, entry.name)
    const sessionId = basename(entry.name, '.jsonl')

    let st
    try {
      st = await stat(jsonlPath)
    } catch {
      continue // file/link target disappeared between readdir and stat — skip
    }
    if (!st.isFile()) continue // F-4: target must resolve to a regular file

    // Validate per-session mtime against the index entry. The index is
    // trustworthy ONLY when its recorded mtime matches the file's real mtime.
    const indexEntry = index?.sessions?.find(s => s.sessionId === sessionId)
    const indexIsFresh = !!indexEntry && indexEntry.mtime !== undefined && indexEntry.mtime === st.mtimeMs

    let meta: SessionMeta
    if (indexEntry && indexIsFresh) {
      meta = fromIndexEntry(indexEntry, sessionId, slug, projectPath, jsonlPath)
    } else {
      meta = await buildMetaFromJsonl(jsonlPath, sessionId, slug, projectPath, st.mtimeMs)
    }
    if (resolved.worktreeOf) meta.worktreeOf = resolved.worktreeOf
    if (resolved.worktreeName) meta.worktreeName = resolved.worktreeName
    metas.push(meta)
  }

  return metas
}

function fromIndexEntry(
  e: NonNullable<SessionsIndexFile['sessions']>[number],
  sessionId: string,
  slug: string,
  projectPath: string,
  jsonlPath: string,
): SessionMeta {
  const title =
    e.customTitle ??
    e.aiTitle ??
    e.agentName ??
    (e.lastPrompt ? e.lastPrompt.slice(0, 80) : sessionId)
    // F-3: full sessionId; CSS .truncate owns visual overflow

  // hasSubagents: check for companion directory.
  const hasSubagents = existsSync(join(dirname(jsonlPath), sessionId, 'subagents'))

  return {
    sessionId,
    projectSlug: slug,
    projectPath,
    title,
    firstTimestamp: e.firstTimestamp ?? '',
    lastTimestamp: e.lastTimestamp ?? e.firstTimestamp ?? '',
    messageCount: e.messageCount ?? 0,
    hasSubagents,
    totalUsage: emptyAggregatedUsage(),  // usage is computed on demand via loadSession
  }
}

/**
 * Fallback path (D-21): read the WHOLE file and extract metadata from events.
 * Per RESEARCH.md Q7: full-file read is correct for Phase 1 (perf acceptable
 * for typical session sizes). Phase 2 may optimize with seek-based reads.
 */
async function buildMetaFromJsonl(
  jsonlPath: string,
  sessionId: string,
  slug: string,
  projectPath: string,
  mtimeMs: number,
): Promise<SessionMeta> {
  let content = ''
  try {
    content = await readFile(jsonlPath, 'utf8')
  } catch (err) {
    logError('buildMetaFromJsonl: readFile failed', err, { jsonlPath })
    return minimalMeta(sessionId, slug, projectPath)
  }

  const { events, parseWarnings } = parseJSONL(content)
  const title = pickTitleFromEvents(events, sessionId)
  const timestamps = events
    .map(e => extractTimestamp(e))
    .filter((t): t is string => typeof t === 'string')

  const messageCount = events.filter(e => e.type === 'user' || e.type === 'assistant').length
  const hasSubagents = existsSync(join(dirname(jsonlPath), sessionId, 'subagents'))

  // Aggregate per-turn assistant usage across main + subagent JSONLs.
  // Phase 2 D-23 carve-out (main JSONL only) is now closed by Phase 3 TOKEN-01:
  // the list-cache fast path also reads each subagent's usage so the per-row
  // total in the sidebar matches the detailed view.
  const mainTurns = eventsToTurns(events)
  const subagentsDir = join(dirname(jsonlPath), sessionId, 'subagents')
  const subagentUsages = existsSync(subagentsDir)
    ? await aggregateSubagentUsages(subagentsDir)
    : new Map<string, UsageSummary>()
  const totalUsage = aggregateUsageWithSubagents(mainTurns, subagentUsages)

  // Amended D-34 (plan 02-02, VIEW-09): capture the LAST event's version + gitBranch.
  // We read the last event only — not "first non-undefined wins" — so the value
  // reflects the session's current state. If the last event lacks the field, undefined.
  // UnknownEvent doesn't extend ClaudeEventBase so we cast through Record to access
  // the fields safely at runtime (typeof guard ensures no spurious undefined leaks).
  const lastEvent = events[events.length - 1] as unknown as Record<string, unknown> | undefined
  const claudeCodeVersion = typeof lastEvent?.['version'] === 'string' ? lastEvent['version'] as string : undefined
  const gitBranch = typeof lastEvent?.['gitBranch'] === 'string' ? lastEvent['gitBranch'] as string : undefined

  return {
    sessionId,
    projectSlug: slug,
    projectPath,
    title,
    firstTimestamp: timestamps[0] ?? '',
    lastTimestamp: timestamps[timestamps.length - 1] ?? timestamps[0] ?? '',
    messageCount,
    hasSubagents,
    totalUsage,
    parseWarnings,
    claudeCodeVersion,
    gitBranch,
    // isLive is no longer set here — routes.ts is the sole source of truth (D-34 Phase 2)
  }
}

function minimalMeta(sessionId: string, slug: string, projectPath: string): SessionMeta {
  return {
    sessionId,
    projectSlug: slug,
    projectPath,
    title: sessionId, // F-3: full sessionId; CSS .truncate owns visual overflow
    firstTimestamp: '',
    lastTimestamp: '',
    messageCount: 0,
    hasSubagents: false,
    totalUsage: emptyAggregatedUsage(),
  }
}

function pickTitleFromEvents(events: ClaudeEvent[], sessionId: string): string {
  const findStr = (type: string, field: string): string | null => {
    for (let i = events.length - 1; i >= 0; i--) {
      const e = events[i]!
      if (e.type === type) {
        const v = (e as unknown as Record<string, unknown>)[field]
        if (typeof v === 'string' && v.length > 0) return v
      }
    }
    return null
  }

  return (
    findStr('custom-title', 'customTitle') ??
    findStr('ai-title', 'aiTitle') ??
    findStr('agent-name', 'agentName') ??
    (findStr('last-prompt', 'lastPrompt')?.slice(0, 80) ?? null) ??
    sessionId // F-3: full sessionId; CSS .truncate owns visual overflow
  )
}

/**
 * Extract a timestamp string from any ClaudeEvent variant.
 * `UnknownEvent` doesn't carry `timestamp` directly — its `raw` payload may.
 */
function extractTimestamp(e: ClaudeEvent): string | undefined {
  if ('timestamp' in e && typeof (e as { timestamp?: unknown }).timestamp === 'string') {
    return (e as { timestamp: string }).timestamp
  }
  if (e.type === 'unknown') {
    const raw = e.raw as Record<string, unknown> | undefined
    if (typeof raw?.timestamp === 'string') return raw.timestamp
  }
  return undefined
}

function emptyAggregatedUsage(): AggregatedUsage {
  const base: UsageSummary = { inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0 }
  return { ...base, byAgent: { '': { ...base } } }
}

/**
 * Aggregate per-turn usage from main turns + per-agent usages into a full
 * AggregatedUsage. byAgent['']: main; byAgent[<agentId>]: each subagent.
 * Tokens are counted exactly once per source (PITFALL 10 — no double-count
 * via parent tool_result summaries).
 */
function aggregateUsageWithSubagents(
  mainTurns: Turn[],
  subagentUsages: Map<string, UsageSummary>,
): AggregatedUsage {
  const empty = (): UsageSummary => ({
    inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0,
  })
  const main = empty()
  for (const t of mainTurns) {
    if (!t.usage) continue
    const u: UsageBlock = t.usage
    main.inputTokens         += u.input_tokens                ?? 0
    main.outputTokens        += u.output_tokens               ?? 0
    main.cacheCreationTokens += u.cache_creation_input_tokens ?? 0
    main.cacheReadTokens     += u.cache_read_input_tokens     ?? 0
  }
  const byAgent: Record<string, UsageSummary> = { '': { ...main } }
  const total = { ...main }
  for (const [agentId, u] of subagentUsages) {
    byAgent[agentId] = { ...u }
    total.inputTokens         += u.inputTokens
    total.outputTokens        += u.outputTokens
    total.cacheCreationTokens += u.cacheCreationTokens
    total.cacheReadTokens     += u.cacheReadTokens
  }
  return { ...total, byAgent }
}

/**
 * Lightweight subagent-usage scan for the list-cache fast path. Walks every
 * `agent-*.jsonl` under `subagentsDir`, parses each, and sums `usage` blocks
 * directly off assistant events. Avoids `eventsToTurns` (no Turn[] needed
 * for the list summary).
 *
 * One unreadable agent file does not fail the whole aggregate — its slot
 * contributes zero usage and the sibling agents still sum correctly.
 */
async function aggregateSubagentUsages(subagentsDir: string): Promise<Map<string, UsageSummary>> {
  const usages = new Map<string, UsageSummary>()
  let entries: string[]
  try {
    entries = await readdir(subagentsDir)
  } catch {
    return usages
  }
  for (const entry of entries) {
    if (!entry.startsWith('agent-') || !entry.endsWith('.jsonl')) continue
    const agentId = entry.replace(/^agent-/, '').replace(/\.jsonl$/, '')
    const usage = await readAgentJsonlUsage(join(subagentsDir, entry))
    usages.set(agentId, usage)
  }
  return usages
}

async function readAgentJsonlUsage(agentJsonlPath: string): Promise<UsageSummary> {
  const sum: UsageSummary = {
    inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0,
  }
  let content: string
  try {
    content = await readFile(agentJsonlPath, 'utf8')
  } catch {
    return sum
  }
  const { events } = parseJSONL(content)
  for (const e of events) {
    if (e.type !== 'assistant') continue
    const u = e.message?.usage
    if (!u) continue
    sum.inputTokens         += u.input_tokens                ?? 0
    sum.outputTokens        += u.output_tokens               ?? 0
    sum.cacheCreationTokens += u.cache_creation_input_tokens ?? 0
    sum.cacheReadTokens     += u.cache_read_input_tokens     ?? 0
  }
  return sum
}

/**
 * Resolve a project's true cwd + worktree fields. The slug encoding (`/` and
 * `.` both → `-`) is lossy, so we recover the real cwd from any JSONL in the
 * dir (cwd is on every "user"/"assistant" event). When a `worktree-state`
 * event is present it tells us the original project + worktree name
 * explicitly; otherwise we fall back to detecting the `.claude/worktrees/<n>`
 * suffix on the cwd itself.
 */
interface ResolvedProject {
  projectPath: string
  worktreeOf?: string
  worktreeName?: string
}

async function resolveProject(projectDir: string, slug: string): Promise<ResolvedProject> {
  const head = await readHeadInfoFromAnyJsonl(projectDir)
  if (!head || !head.cwd) {
    return { projectPath: naiveDecodeSlug(slug) }
  }
  const projectPath = head.cwd
  if (head.worktreeOf && head.worktreeName) {
    return { projectPath, worktreeOf: head.worktreeOf, worktreeName: head.worktreeName }
  }
  const m = projectPath.match(/^(.+)\/\.claude\/worktrees\/([^/]+)$/)
  if (m) {
    return { projectPath, worktreeOf: m[1], worktreeName: m[2] }
  }
  return { projectPath }
}

interface JsonlHeadInfo {
  cwd?: string
  worktreeOf?: string
  worktreeName?: string
}

async function readHeadInfoFromAnyJsonl(projectDir: string): Promise<JsonlHeadInfo | null> {
  let entries
  try {
    entries = await readdir(projectDir, { withFileTypes: true })
  } catch {
    return null
  }
  for (const e of entries) {
    if (!e.name.endsWith('.jsonl')) continue
    if (!(e.isFile() || e.isSymbolicLink())) continue
    const info = await readHeadInfo(join(projectDir, e.name))
    if (info?.cwd) return info
  }
  return null
}

async function readHeadInfo(jsonlPath: string): Promise<JsonlHeadInfo | null> {
  // The first event in a JSONL is often `permission-mode` / `worktree-state`
  // / `file-history-snapshot`, none of which carry `cwd` — the canonical
  // user/assistant events follow. Read enough of the head to span this prelude.
  const buf = Buffer.alloc(64 * 1024)
  let handle
  try {
    handle = await open(jsonlPath, 'r')
    const { bytesRead } = await handle.read(buf, 0, buf.length, 0)
    if (bytesRead === 0) return null
    const text = buf.slice(0, bytesRead).toString('utf8')
    const lines = text.split('\n')
    // The last chunk may be a partial line; drop it. (If the whole file is
    // smaller than the buffer there's no trailing partial — but it's also
    // harmless to skip an empty trailing element.)
    if (bytesRead === buf.length) lines.pop()

    const info: JsonlHeadInfo = {}
    for (const line of lines) {
      if (!line) continue
      let evt: Record<string, unknown>
      try {
        evt = JSON.parse(line) as Record<string, unknown>
      } catch {
        continue
      }
      if (!info.cwd && typeof evt['cwd'] === 'string' && (evt['cwd'] as string).length > 0) {
        info.cwd = evt['cwd'] as string
      }
      if (evt['type'] === 'worktree-state') {
        const ws = evt['worktreeSession'] as Record<string, unknown> | undefined
        if (ws) {
          if (typeof ws['originalCwd'] === 'string') info.worktreeOf = ws['originalCwd'] as string
          if (typeof ws['worktreeName'] === 'string') info.worktreeName = ws['worktreeName'] as string
          // Worktree-state also carries the full worktree path — useful when
          // no event with `cwd` falls inside the head window.
          if (!info.cwd && typeof ws['worktreePath'] === 'string') info.cwd = ws['worktreePath'] as string
        }
      }
      if (info.cwd && info.worktreeOf) break
    }
    return Object.keys(info).length > 0 ? info : null
  } catch {
    return null
  } finally {
    await handle?.close().catch(() => {})
  }
}

function naiveDecodeSlug(slug: string): string {
  if (!slug.startsWith('-')) return slug
  return '/' + slug.slice(1).split('-').join('/')
}
