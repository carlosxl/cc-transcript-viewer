/**
 * Flat-row builder for the virtualised transcript (007-ui-information-revamp).
 *
 * Pure projection of (rows, expansion, filters, sticky) → RowItem[]. The output
 * is what react-virtuoso renders directly; stable IDs preserve scroll position
 * across re-renders.
 *
 * Phase 2 ships the foundational kinds (turn-header, request, block, unknown-row,
 * attachment-summary, system-event, inline-state-change). Tool-detail expansion
 * and subagent rollups arrive in later phases.
 */
import { useMemo } from 'react'
import type { ClaudeRowOrUnknown } from '@cc-viewer/shared'
import type { StickyState } from './useStickyState'

export type RowId = string

export type RowItem =
  | { id: RowId; kind: 'turn-header'; turnId: string; sticky: StickyState | null }
  | { id: RowId; kind: 'attachment-summary'; turnId: string; attachmentId: string }
  | { id: RowId; kind: 'request'; turnId: string; requestId: string; collapsed: boolean }
  | { id: RowId; kind: 'block'; turnId: string; requestId: string; blockId: string }
  | { id: RowId; kind: 'tool-detail-expanded'; turnId: string; requestId: string; toolUseId: string }
  | { id: RowId; kind: 'system-event'; turnId: string; eventId: string }
  | { id: RowId; kind: 'inline-state-change'; turnId: string; stateChangeId: string }
  | { id: RowId; kind: 'unknown-row'; rowUuid: string }

export interface FlatRowExpansion {
  expandedTurnIds: Set<string>
  expandedRequestIds: Set<string>
  expandedBlockIds: Set<string>
}

export interface FlatRowFilters {
  showAttachments: boolean
  showSystemEvents: boolean
  showInlineStateChanges: boolean
}

interface RowWithIdentity {
  /** From the row envelope; absent on session-state rows. */
  uuid?: string
  /** From the row envelope; absent on session-state rows. */
  timestamp?: string
  type: string
  // Open-ended — we only look at fields by name.
  [key: string]: unknown
}

function asRecord(r: ClaudeRowOrUnknown): RowWithIdentity {
  return r as unknown as RowWithIdentity
}

function rowUuid(r: ClaudeRowOrUnknown, index: number): string {
  const u = asRecord(r).uuid
  if (typeof u === 'string' && u.length > 0) return u
  return `synth-row-${index}`
}

function safeRowType(r: ClaudeRowOrUnknown): string {
  if (r.type === 'unknown') {
    const raw = (r as { raw?: { type?: unknown } }).raw
    if (raw && typeof raw.type === 'string') return raw.type
    return 'unknown'
  }
  return r.type
}

/**
 * Walk the row stream, attributing rows to their owning Turn (per promptId)
 * and emitting RowItems in document order.
 *
 * Attachment attribution (plan §2 rule 2, T036):
 *   - When the attachment row carries a `promptId`, attribute to that Turn even
 *     if it physically appears later in the stream than its owning prompt.
 *   - When `promptId` is absent, attribute to the Turn anchored by the closest
 *     preceding user row that opened a Turn.
 *   - Attachments emit immediately after the `turn-header` row and before the
 *     first `request` row of that Turn, regardless of their physical position.
 */
export function buildFlatRows(
  rows: ClaudeRowOrUnknown[],
  expansion: FlatRowExpansion,
  filters: FlatRowFilters,
  sticky: Map<string, StickyState>,
): RowItem[] {
  // Pass 1 — attribute attachments to their owning turns.
  const attachmentsByTurn = attributeAttachments(rows)

  const out: RowItem[] = []
  const requestsEmitted = new Set<string>()
  let currentTurnId: string | null = null

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!
    const rec = asRecord(row)
    const ruuid = rowUuid(row, i)

    // FR-007: degraded card for schema-fallback rows. Detect via the discriminator,
    // not the inner raw `type` (which carries the future row's original name).
    if (row.type === 'unknown') {
      out.push({ id: `unknown:${ruuid}`, kind: 'unknown-row', rowUuid: ruuid })
      continue
    }
    const type = safeRowType(row)

    if (type === 'user') {
      // A user row anchors a Turn when it carries a promptId AND text content
      // (not a tool_result-only row). Tool-result rows attach to the open Turn.
      const promptId = typeof rec.promptId === 'string' ? rec.promptId : undefined
      const hasText = isHumanPromptRowShape(rec)
      if (promptId && hasText) {
        currentTurnId = promptId
        out.push({
          id: `turn:${currentTurnId}:header`,
          kind: 'turn-header',
          turnId: currentTurnId,
          sticky: sticky.get(currentTurnId) ?? null,
        })
        if (filters.showAttachments) {
          for (const att of attachmentsByTurn.get(currentTurnId) ?? []) {
            out.push({
              id: `turn:${currentTurnId}:attach:${att.attachmentId}`,
              kind: 'attachment-summary',
              turnId: currentTurnId,
              attachmentId: att.attachmentId,
            })
          }
        }
      }
      continue
    }

    if (type === 'assistant' && currentTurnId !== null) {
      const requestId = typeof rec.requestId === 'string' ? rec.requestId : ruuid
      // Only emit one request row per requestId — assistant rows for the same
      // requestId stream multiple content blocks; we coalesce by request id.
      if (!requestsEmitted.has(requestId)) {
        requestsEmitted.add(requestId)
        out.push({
          id: `turn:${currentTurnId}:req:${requestId}:header`,
          kind: 'request',
          turnId: currentTurnId,
          requestId,
          collapsed: !expansion.expandedRequestIds.has(requestId),
        })
      }
      continue
    }

    // Attachments are emitted in pass-1 attribution, not in document order.
    if (type === 'attachment') continue

    if (type === 'system' && currentTurnId !== null) {
      if (!filters.showSystemEvents) continue
      out.push({
        id: `turn:${currentTurnId}:system:${ruuid}`,
        kind: 'system-event',
        turnId: currentTurnId,
        eventId: ruuid,
      })
      continue
    }

    if (
      (type === 'queue-operation' ||
        type === 'pr-link' ||
        type === 'file-history-snapshot') &&
      currentTurnId !== null
    ) {
      if (!filters.showInlineStateChanges) continue
      const stateChangeId = ruuid
      out.push({
        id: `turn:${currentTurnId}:state:${stateChangeId}`,
        kind: 'inline-state-change',
        turnId: currentTurnId,
        stateChangeId,
      })
      continue
    }

    // permission-mode, worktree-state, ai-title, custom-title, agent-name,
    // last-prompt: silent — they feed the sticky-state projection elsewhere.
  }

  return out
}

interface AttachmentAttribution {
  attachmentId: string
  /** Original index, preserved for stable in-turn ordering. */
  origin: number
}

function attributeAttachments(
  rows: ClaudeRowOrUnknown[],
): Map<string, AttachmentAttribution[]> {
  const byTurn = new Map<string, AttachmentAttribution[]>()
  let mostRecentTurnId: string | null = null

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!
    if (row.type === 'unknown') continue
    const type = safeRowType(row)
    const rec = asRecord(row)

    if (type === 'user') {
      const promptId = typeof rec.promptId === 'string' ? rec.promptId : undefined
      if (promptId && isHumanPromptRowShape(rec)) {
        mostRecentTurnId = promptId
      }
      continue
    }

    if (type === 'attachment') {
      const explicitPromptId =
        typeof rec.promptId === 'string' && rec.promptId.length > 0
          ? rec.promptId
          : null
      const turnId = explicitPromptId ?? mostRecentTurnId
      if (!turnId) continue // pre-prompt attachment — drop on the floor
      const attachmentId = rowUuid(row, i)
      const list = byTurn.get(turnId) ?? []
      list.push({ attachmentId, origin: i })
      byTurn.set(turnId, list)
    }
  }

  // Stable order — already produced by the single sequential pass.
  return byTurn
}

/**
 * Crude heuristic for "is this user row a real prompt anchor?" — matches
 * `isHumanPromptRow` from the schema's predicates but tolerates the loose
 * shape we carry through ClaudeRowOrUnknown.
 */
function isHumanPromptRowShape(rec: RowWithIdentity): boolean {
  const msg = (rec.message as { content?: unknown } | undefined)?.content
  if (typeof msg === 'string') {
    return (
      !msg.startsWith('<command-name>') &&
      !msg.startsWith('<local-command-') &&
      !msg.startsWith('<task-notification>') &&
      !msg.startsWith('<bash-input>') &&
      !msg.startsWith('<bash-stdout>')
    )
  }
  if (Array.isArray(msg)) {
    return msg.some((b) => {
      if (!b || typeof b !== 'object') return false
      const t = (b as { type?: unknown }).type
      return t === 'text' || t === 'image'
    })
  }
  return false
}

export function useFlatRows(
  rows: ClaudeRowOrUnknown[],
  expansion: FlatRowExpansion,
  filters: FlatRowFilters,
  sticky: Map<string, StickyState>,
): RowItem[] {
  return useMemo(
    () => buildFlatRows(rows, expansion, filters, sticky),
    [rows, expansion, filters, sticky],
  )
}
