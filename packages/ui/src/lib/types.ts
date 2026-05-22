/**
 * UI-projection types per specs/006-ui-rewrite-v4/data-model.md §2.
 *
 * Wire types are re-exported from @cc-viewer/shared so consumers in this
 * package have a single import surface (`@/lib/types`). The UI does not
 * mutate or shadow those wire shapes.
 */

import type {
  Turn,
  ToolUse,
  ToolResult,
  SubagentRef,
  ToolInteraction,
  SessionMeta,
  Session,
  SessionsListResponse,
  SessionDetailResponse,
  SubagentDetailResponse,
  SearchHit,
  SearchResponse,
  SearchStatusResponse,
  SessionReport,
  ReportRow,
  TokenSeries,
  TokenPoint,
  TokenSpike,
  FileTouchIndex,
  FileTouch,
  UsageBlock,
  UsageSummary,
  AggregatedUsage,
  HealthResponse,
  ErrorResponse,
} from '@cc-viewer/shared'

export type {
  Turn,
  ToolUse,
  ToolResult,
  SubagentRef,
  ToolInteraction,
  SessionMeta,
  Session,
  SessionsListResponse,
  SessionDetailResponse,
  SubagentDetailResponse,
  SearchHit,
  SearchResponse,
  SearchStatusResponse,
  SessionReport,
  ReportRow,
  TokenSeries,
  TokenPoint,
  TokenSpike,
  FileTouchIndex,
  FileTouch,
  UsageBlock,
  UsageSummary,
  AggregatedUsage,
  HealthResponse,
  ErrorResponse,
}

// ─── Workspace primitives ──────────────────────────────────────────────────

export type Theme = 'dark' | 'light'
export type Density = 'comfortable' | 'compact'

// ─── Design-level Blocks ───────────────────────────────────────────────────

export interface TextBlock {
  kind: 'text'
  body: string
}

export interface ThinkingBlock {
  kind: 'thinking'
  body: string
}

export type ToolStatus = 'ok' | 'err' | 'run'

/** Aggregated counts for the in-capsule "Open subagent transcript" CTA. */
export interface SubagentMetrics {
  agentType: string
  /** Number of user-prompt turns in the subagent transcript. */
  turnCount: number
  /** Total tool_use blocks across the subagent's assistant turns. */
  toolCallCount: number
  /** Sum of per-request cost across the subagent's assistant turns. */
  cost: number
}

export interface ToolBlock {
  kind: 'tool_use'
  /** stable id used by useFlatTools/useFocus */
  toolUseId: string
  name: string
  input: Record<string, unknown>
  /** joined from matching ToolResult.content when present */
  output?: string
  /** ToolInteraction.preview / diff summary; one-line snippet */
  preview?: string
  status: ToolStatus
  /** ms; null while running or when timestamps unavailable */
  durationMs: number | null
  /** true when ToolUse.childAgentId is present */
  isSubagent: boolean
  /** == ToolUse.childAgentId */
  subagentRef?: string
  /** Populated when isSubagent is true and SubagentRef is available. */
  subagentMetrics?: SubagentMetrics
}

export interface DiffHunkLine {
  type: 'add' | 'del' | 'ctx'
  n?: number
  text: string
}

export type DiffHunk = { type: 'hunk'; text: string } | DiffHunkLine

export interface DiffBlock {
  kind: 'diff'
  toolUseId: string
  path: string
  lang: string
  adds: number
  dels: number
  hunks: DiffHunk[]
}

export type Block = TextBlock | ThinkingBlock | ToolBlock | DiffBlock

// ─── Request, Attachment, SessionTurn, SessionView ─────────────────────────

export interface Request {
  /** assistant turn uuid */
  id: string
  /** ms, sum of block durations or wall-clock */
  duration: number
  /** ms, first-token-time. null when missing. */
  ttft: number | null
  /** dollars; derived from assistant turn usage */
  cost: number
  blocks: Block[]
  tokens: {
    in: number
    out: number
    cc: number
    cr: number
  }
  model: string
}

export interface Attachment {
  kind: string
  desc: string
  ts: string
  /** estimated input-token count */
  tokens: number
}

export interface SessionTurn {
  id: string
  time: string
  prompt: string
  userMsgId: string
  attachments: Attachment[]
  requests: Request[]
  /** aggregated cost across requests; derived */
  cost: number
}

export interface SessionView {
  id: string
  title: string
  /** most recent assistant turn's model */
  model: string
  isLive: boolean
  /** present when viewing a subagent */
  parentTurnId?: string
  parentSessionTitle?: string
  turns: SessionTurn[]
}

// ─── Focus + flat projections ──────────────────────────────────────────────

export interface FocusedNodeMeta {
  kind: 'user' | 'request'
  turn: SessionTurn
  request?: Request
  /** 1-based idx within the turn (requests only) */
  idx?: number
  total?: number
}

export interface FocusedBlockMeta {
  bid: string
  block: Block
  request: Request
  turn: SessionTurn
}

export interface FlatNode {
  id: string
  meta: FocusedNodeMeta
}

export interface FlatToolItem {
  bid: string
  block: ToolBlock | DiffBlock
  request: Request
  turn: SessionTurn
}
