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
  AttachmentRow,
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
  ClaudeRow,
  ClaudeRowOrUnknown,
  UnknownRow,
  ToolUseResult,
  StickyState,
} from '@cc-viewer/shared'

export type {
  Turn,
  ToolUse,
  ToolResult,
  SubagentRef,
  ToolInteraction,
  AttachmentRow,
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
  ClaudeRow,
  ClaudeRowOrUnknown,
  UnknownRow,
  ToolUseResult,
  StickyState,
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

export type ToolStatus = 'ok' | 'err' | 'run' | 'cancelled'

/** Aggregated counts for the in-capsule "Open subagent transcript" CTA. */
export interface SubagentMetrics {
  agentType: string
  /** Number of user-prompt turns in the subagent transcript. */
  turnCount: number
  /** Total tool_use blocks across the subagent's assistant turns. */
  toolCallCount: number
  /** Sum of per-request cost across the subagent's assistant turns. */
  cost: number
  /**
   * Free-form description of the subagent's task, sourced from the
   * `.meta.json` sidecar (typically the parent's `Agent` tool input
   * `description`). Surfaced on the capsule so the reader sees what the
   * subagent was asked to do before drilling in.
   */
  description?: string
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
  /**
   * Schema-typed sidecar from the matching user row's `toolUseResult`
   * (007-ui-information-revamp, T028/T029). The discriminator is the field
   * set present on the value; components dispatch on shape.
   */
  toolUseResult?: ToolUseResult
  /**
   * Set when an earlier tool_use within the same Turn used the same tool name
   * and ended with status='err'. Points at that prior `toolUseId`. Lets the UI
   * tag this call as a retry of a previous failure (e.g. Read after a bad path).
   */
  retryOf?: string
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
  /** assistant turn uuid — stable identity used by focus + keyboard nav */
  id: string
  /**
   * Anthropic API request id without the `req_` prefix, when available. Used
   * for the visible "REQ X · <chunk>" chip so the label reflects the upstream
   * API call rather than whichever JSONL row was written first. Falls back to
   * the first 8 chars of `id` for legacy rows without a requestId.
   */
  displayId: string
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
  /**
   * True when the underlying assistant row was tagged `isApiErrorMessage` —
   * a SYNTHETIC error written by the Claude Code CLI itself (e.g. "API Error:
   * 529 Overloaded"). Renders as a distinct error capsule, not normal output.
   */
  isApiError?: boolean
}

export interface Attachment {
  kind: string
  desc: string
  ts: string
  /** estimated input-token count */
  tokens: number
  /** Source tool_use_id when kind === 'tool_result'. */
  toolUseId?: string
  /** True when the tool_result was flagged as an error response. */
  isError?: boolean
  /** Full text body of the attachment (joined from content array if needed). */
  body?: string
  /** Name of the tool that produced this attachment (e.g. "Read", "Bash"). */
  toolName?: string
  /** One-line argument summary for the originating tool_use (per getToolArgSummary). */
  toolArgs?: string
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
  /**
   * Source row's `promptId` (007-ui-information-revamp). Stable across all
   * rows that share this Turn; absent on synthesised orphan turns.
   */
  promptId?: string
  /**
   * Snapshot of harness state in effect at this Turn (permission mode, model,
   * worktree, plan/auto). Populated by projectSessionView via the shared
   * sticky-state projection. Falls back to DEFAULT_STICKY_STATE shape when no
   * preceding row carried a value.
   */
  sticky?: StickyState
  /**
   * Harness-injected context attachments anchored to this turn — the LLM
   * actually receives this payload on the API request that resolves this
   * prompt. Currently surfaces `deferred_tools_delta` (tool catalogue updates)
   * and `skill_listing` (skill descriptions injected into the system prompt).
   * Other attachment subtypes drive harness state through other projections
   * (e.g. auto_mode → sticky badge) and are intentionally not duplicated here.
   */
  contextAttachments?: AttachmentRow[]
  /**
   * True when the underlying user row is the synthetic `/compact` summary
   * (the LLM-generated recap of the pre-compact conversation). UserPrompt
   * renders this as a collapsible disclosure rather than a regular prompt.
   */
  isCompactSummary?: boolean
  /** Total turn duration from the trailing `turn_duration` system event. */
  durationMs?: number
  /** Total message count for this turn from the `turn_duration` system event. */
  messageCount?: number
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
  /**
   * Schema-typed wire rows from `SessionDetailResponse.rows` (007-ui-information-revamp).
   * Primary input for the new RowItem-based renderer; existing v4 (006) consumers
   * read `turns` and ignore this field.
   */
  rows: ClaudeRowOrUnknown[]
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
