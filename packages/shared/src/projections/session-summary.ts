/**
 * Session-summary projection (007-ui-information-revamp, T043).
 *
 * Pure fold over (rows, sticky map) producing the data shape consumed by
 * `packages/ui/src/components/summary/SessionSummary.tsx` (FR-026). Composes:
 *   - dedupeUsage (T042) — token totals with cache split, de-duplicated by message.id
 *   - buildApiErrorChains (T034) — retry chain rollups
 *   - file-touch (existing) — files-touched list with backup refs
 *   - PR links / queue ops / harness-state transitions — inlined linear walks
 *
 * No server endpoint owns this; the UI runs it client-side from the rows it
 * already has. The shape is documented in
 * specs/007-ui-information-revamp/data-model.md.
 */
import type {
  ClaudeRowOrUnknown,
  FileHistorySnapshotRow,
  PrLinkRow,
  QueueOperationRow,
} from '../jsonl/schema.js'
import type { FileTouchIndex } from '../types.js'
import { dedupeUsage, cacheHitRate, type DedupedUsage } from './usage-dedup.js'
import {
  buildApiErrorChains,
  type ApiErrorChainSummary,
} from './api-error-chains.js'
import type { StickyState } from './sticky-state.js'

export interface SessionSummaryTokens extends Omit<DedupedUsage, 'countedMessageIds'> {
  /** cacheRead / (cacheRead + cacheCreation + input); 0 when denominator is 0. */
  cacheHitRate: number
  /** Unique message.ids that contributed (verification only). */
  countedMessageIds: Set<string>
}

export interface SessionSummaryFile {
  path: string
  firstTurnUuid: string | null
  lastTurnUuid: string | null
  reads: number
  writes: number
  changed: boolean
  /** Backup blob references emitted from file-history-snapshot rows. */
  backups: Array<{ backupFileName: string; backupTime: string; version: number }>
}

export interface SessionSummaryPrLink {
  prNumber: number
  prRepository: string
  prUrl: string
  ts: string | null
  rowUuid: string
}

export interface SessionSummaryQueueOp {
  operation: 'enqueue' | 'dequeue' | 'remove' | 'popAll'
  ts: string | null
  content: string | null
  rowUuid: string
}

export interface HarnessStateTransition {
  ts: string | null
  turnId: string
  field: keyof StickyState
  from: unknown
  to: unknown
}

export interface SessionSummary {
  tokens: SessionSummaryTokens
  files: SessionSummaryFile[]
  prLinks: SessionSummaryPrLink[]
  queueOperations: SessionSummaryQueueOp[]
  apiErrorChains: ApiErrorChainSummary[]
  harnessStateTransitions: HarnessStateTransition[]
}

interface RowShape {
  type?: unknown
  uuid?: unknown
  timestamp?: unknown
  [k: string]: unknown
}

function rowUuidOr(r: RowShape, fallback: string): string {
  return typeof r.uuid === 'string' && r.uuid.length > 0 ? r.uuid : fallback
}

function rowTs(r: RowShape): string | null {
  return typeof r.timestamp === 'string' ? r.timestamp : null
}

/**
 * Compose `SessionSummary` from rows + sticky-state map + a pre-built file-touch
 * index. The file-touch index is passed in so we don't recompute it (the server
 * already builds it from Turn[], and the UI receives it on the wire).
 */
export function projectSessionSummary(
  rows: readonly ClaudeRowOrUnknown[],
  sticky: Map<string, StickyState>,
  fileTouchIndex: FileTouchIndex,
): SessionSummary {
  const usage = dedupeUsage(rows)
  const tokens: SessionSummaryTokens = {
    inputTotal: usage.inputTotal,
    outputTotal: usage.outputTotal,
    cacheCreationTotal: usage.cacheCreationTotal,
    cacheReadTotal: usage.cacheReadTotal,
    cacheHitRate: cacheHitRate(usage),
    countedMessageIds: usage.countedMessageIds,
  }

  const { chains } = buildApiErrorChains(rows)

  // Walk for pr-link, queue-operation, file-history backup refs.
  const prLinks: SessionSummaryPrLink[] = []
  const queueOperations: SessionSummaryQueueOp[] = []
  const backupsByPath = new Map<string, SessionSummaryFile['backups']>()

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]! as unknown as RowShape
    if (row.type === 'pr-link') {
      const pr = row as unknown as PrLinkRow
      prLinks.push({
        prNumber: pr.prNumber,
        prRepository: pr.prRepository,
        prUrl: pr.prUrl,
        ts: rowTs(row),
        rowUuid: rowUuidOr(row, `pr-link-${i}`),
      })
      continue
    }
    if (row.type === 'queue-operation') {
      const qo = row as unknown as QueueOperationRow
      queueOperations.push({
        operation: qo.operation,
        ts: rowTs(row),
        content: typeof qo.content === 'string' ? qo.content : null,
        rowUuid: rowUuidOr(row, `queue-op-${i}`),
      })
      continue
    }
    if (row.type === 'file-history-snapshot') {
      const fh = row as unknown as FileHistorySnapshotRow
      for (const [path, backup] of Object.entries(fh.snapshot.trackedFileBackups)) {
        if (!backup.backupFileName) continue // schema says 52% of rows omit
        const list = backupsByPath.get(path) ?? []
        list.push({
          backupFileName: backup.backupFileName,
          backupTime: backup.backupTime,
          version: backup.version,
        })
        backupsByPath.set(path, list)
      }
    }
  }

  // Compose files: marry the file-touch index (paths, reads, writes) with the
  // backup refs collected above.
  const files: SessionSummaryFile[] = fileTouchIndex.files.map((f) => ({
    path: f.path,
    firstTurnUuid: f.reads[0]?.turnUuid ?? f.writes[0]?.turnUuid ?? null,
    lastTurnUuid:
      f.writes[f.writes.length - 1]?.turnUuid ??
      f.reads[f.reads.length - 1]?.turnUuid ??
      null,
    reads: f.reads.length,
    writes: f.writes.length,
    changed: f.changed,
    backups: backupsByPath.get(f.path) ?? [],
  }))

  // Surface paths that have backups but never appeared in fileTouchIndex (rare —
  // a file was backed up but never read/written by Claude Code in this session).
  for (const [path, backups] of backupsByPath) {
    if (files.find((f) => f.path === path)) continue
    files.push({
      path,
      firstTurnUuid: null,
      lastTurnUuid: null,
      reads: 0,
      writes: 0,
      changed: false,
      backups,
    })
  }

  const harnessStateTransitions = computeHarnessTransitions(rows, sticky)

  return {
    tokens,
    files,
    prLinks,
    queueOperations,
    apiErrorChains: chains,
    harnessStateTransitions,
  }
}

/**
 * Walks the sticky-state map in row order, emitting one transition every time
 * any sticky field changes. Stable sessions (10k Turns but unchanging
 * permission-mode) produce one transition, not 10k.
 */
function computeHarnessTransitions(
  rows: readonly ClaudeRowOrUnknown[],
  sticky: Map<string, StickyState>,
): HarnessStateTransition[] {
  // Collect (turnId, ts) pairs in row order so we can iterate the sticky map
  // chronologically.
  const orderedTurns: Array<{ turnId: string; ts: string | null }> = []
  const seen = new Set<string>()
  for (const row of rows) {
    const r = row as unknown as RowShape
    if (r.type !== 'user') continue
    const promptId = typeof (r as { promptId?: unknown }).promptId === 'string'
      ? ((r as { promptId: string }).promptId)
      : null
    if (!promptId || seen.has(promptId)) continue
    if (!sticky.has(promptId)) continue
    seen.add(promptId)
    orderedTurns.push({ turnId: promptId, ts: rowTs(r) })
  }

  const transitions: HarnessStateTransition[] = []
  let prev: StickyState | null = null
  for (const t of orderedTurns) {
    const cur = sticky.get(t.turnId)!
    if (prev === null) {
      prev = cur
      continue
    }
    for (const key of ['permissionMode', 'model', 'worktreeState', 'planMode', 'autoMode'] as const) {
      if (!equalStickyField(prev[key], cur[key])) {
        transitions.push({
          ts: t.ts,
          turnId: t.turnId,
          field: key,
          from: prev[key],
          to: cur[key],
        })
      }
    }
    prev = cur
  }
  return transitions
}

function equalStickyField(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a === null || b === null) return false
  if (typeof a !== typeof b) return false
  if (typeof a === 'object') return JSON.stringify(a) === JSON.stringify(b)
  return false
}
