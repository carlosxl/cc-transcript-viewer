/**
 * Sticky-state projection (007-ui-information-revamp, T012 + T039).
 *
 * Per-Turn carry-forward of harness state — the values a user looking at any
 * one Turn needs to understand "what configuration was the harness in when
 * this turn ran?" Source rows + carry-forward rule are documented in
 * specs/007-ui-information-revamp/research.md §R2.
 *
 * Pure linear scan: O(rows). Output is keyed by Turn anchor `promptId` so each
 * Turn renders its sticky badges from a single Map lookup.
 */
import type { ClaudeRowOrUnknown, WorktreeStateRow } from '../jsonl/schema.js'

export type PermissionMode = 'auto' | 'plan' | 'acceptEdits' | 'default'

export interface WorktreeStateSnapshot {
  originalBranch: string
  originalCwd: string
  originalHeadCommit: string
  sessionId: string
  worktreeBranch: string
  worktreeName: string
  worktreePath: string
}

export interface StickyState {
  permissionMode: PermissionMode
  model: string
  worktreeState: WorktreeStateSnapshot | null
  planMode: boolean
  autoMode: boolean
}

export const DEFAULT_STICKY_STATE: StickyState = {
  permissionMode: 'default',
  model: '',
  worktreeState: null,
  planMode: false,
  autoMode: false,
}

interface RowShape {
  type: string
  uuid?: string
  promptId?: string
  [k: string]: unknown
}

function shape(r: ClaudeRowOrUnknown): RowShape {
  return r as unknown as RowShape
}

export function projectStickyState(rows: readonly ClaudeRowOrUnknown[]): Map<string, StickyState> {
  const out = new Map<string, StickyState>()
  let tail: StickyState = { ...DEFAULT_STICKY_STATE }
  for (const row of rows) {
    const r = shape(row)
    tail = applyStickyDelta(tail, r)
    if (isTurnAnchor(r)) {
      const turnId = r.promptId
      if (typeof turnId === 'string') out.set(turnId, tail)
    }
  }
  return out
}

export function applyStickyDelta(prev: StickyState, r: RowShape): StickyState {
  if (r.type === 'permission-mode') {
    const pm = r.permissionMode
    if (pm === 'auto' || pm === 'plan' || pm === 'acceptEdits' || pm === 'default') {
      return { ...prev, permissionMode: pm }
    }
    return prev
  }
  if (r.type === 'assistant') {
    const message = (r.message as { model?: unknown } | undefined) ?? undefined
    if (message && typeof message.model === 'string' && message.model.length > 0) {
      return { ...prev, model: message.model }
    }
    return prev
  }
  if (r.type === 'worktree-state') {
    const ws = (r as unknown as WorktreeStateRow).worktreeSession ?? null
    return { ...prev, worktreeState: ws as WorktreeStateSnapshot | null }
  }
  if (r.type === 'attachment') {
    const a = (r as { attachment?: { type?: unknown } }).attachment
    const t = a?.type
    if (t === 'auto_mode') return { ...prev, autoMode: true }
    if (t === 'auto_mode_exit') return { ...prev, autoMode: false }
    if (t === 'plan_mode' || t === 'plan_mode_reentry') return { ...prev, planMode: true }
    if (t === 'plan_mode_exit') return { ...prev, planMode: false }
    return prev
  }
  return prev
}

export function isTurnAnchor(r: RowShape): boolean {
  if (r.type !== 'user') return false
  if (typeof r.promptId !== 'string' || r.promptId.length === 0) return false
  const msg = (r.message as { content?: unknown } | undefined)?.content
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
