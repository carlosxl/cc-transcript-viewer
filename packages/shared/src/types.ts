/**
 * cc-transcript-viewer — shared types
 *
 * Authoritative contract between @cc-viewer/server and @cc-viewer/ui.
 *
 * Do NOT add runtime logic to this file. It is consumed by TypeScript-only
 * imports; no code compiles from here. Every module downstream of the JSONL
 * parser consumes `ClaudeEvent[]` rather than raw JSON; the `ClaudeEvent`
 * union includes an `unknown` arm for forward compatibility.
 */

// ────────────────────────────────────────────────────────────────────────────
// Domain types — the minimal internal data model (ARCHITECTURE.md)
// ────────────────────────────────────────────────────────────────────────────

export interface UsageBlock {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
  cache_creation?: {
    ephemeral_1h_input_tokens: number;
    ephemeral_5m_input_tokens: number;
  };
  service_tier?: string;
  server_tool_use?: {
    web_search_requests: number;
    web_fetch_requests: number;
  };
}

export interface UsageSummary {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
}

export interface AggregatedUsage extends UsageSummary {
  /** agentId → usage; '' key = main agent */
  byAgent: Record<string, UsageSummary>;
}

export interface ToolUse {
  id: string;
  name: string;
  input: Record<string, unknown>;
  /** Set if `name === 'Agent'` and a subagent file was resolved. */
  childAgentId?: string;
}

export interface ToolResult {
  tool_use_id: string;
  /** Plain string or structured content blocks. */
  content: string | unknown[];
  is_error?: boolean;
}

export interface Turn {
  uuid: string;
  parentUuid: string | null;
  timestamp: string;
  role: 'user' | 'assistant' | 'system';
  /** All text content assembled from message.content blocks. */
  textBlocks: string[];
  /** Extended thinking blocks (collapsed by default in UI — Phase 2). */
  thinkingBlocks: string[];
  toolUses: ToolUse[];
  toolResults: ToolResult[];
  /** Only populated on assistant turns. */
  usage?: UsageBlock;
  /** Assistant turn's `message.model` (e.g. "claude-opus-4-7"). Absent on user/system turns. */
  model?: string;
  /** true for /clear, system commands, etc. — omit from default rendering. */
  isMeta: boolean;
  /** null = main agent; non-null = this turn belongs to a subagent file. */
  agentId: string | null;
}

export interface SubagentRef {
  agentId: string;
  /** From meta.json. */
  agentType: string;
  /** From meta.json. */
  description: string;
  /** The parent tool_use block id that spawned this subagent. */
  toolUseId: string;
  status: 'completed' | 'killed' | 'failed' | 'running';
  turns: Turn[];
  /** agentIds this subagent in turn spawned. */
  childAgentIds: string[];
}

/**
 * SessionMeta is the row shape returned by GET /api/sessions (D-23).
 * It is the lightweight summary — no turns, no subagents, no per-message data.
 */
export interface SessionMeta {
  sessionId: string;
  projectSlug: string;
  projectPath: string;
  title: string;
  firstTimestamp: string;
  lastTimestamp: string;
  messageCount: number;
  /**
   * True when companion subagents/ directory exists.
   * Phase 1: static check at list-build time. Phase 3 may refresh.
   */
  hasSubagents: boolean;
  /**
   * Total usage aggregated across main JSONL + all subagent JSONLs.
   * For Phase 1 this may be a cheap best-effort read; Phase 3 guarantees accuracy.
   */
  totalUsage: AggregatedUsage;
  /**
   * Present in Phase 2+ (live indicator). Optional in Phase 1 — reader MAY include.
   * True when JSONL mtime is recent AND last event has no terminal stop_reason.
   */
  isLive?: boolean;
  /** Number of malformed/truncated JSONL lines skipped during parse (D-16). */
  parseWarnings?: number;
  /**
   * Most-recent JSONL event's ClaudeEventBase.version. Undefined when no event
   * carried it. Added by amended D-34 (plan 02-02) to support VIEW-09 metadata
   * popover in plan 02-09.
   */
  claudeCodeVersion?: string;
  /**
   * Most-recent JSONL event's ClaudeEventBase.gitBranch. Undefined when no
   * event carried it. Added by amended D-34 (plan 02-02) to support VIEW-09.
   */
  gitBranch?: string;
}

/**
 * Full session view returned by GET /api/sessions/:id (D-24).
 * In Phase 1 this is a single-shot JSON response; Phase 2+ may stream.
 */
export interface Session {
  sessionId: string;
  projectSlug: string;
  projectPath: string;
  title: string;
  firstTimestamp: string;
  lastTimestamp: string;
  messageCount: number;
  isLive: boolean;
  hasSubagents: boolean;
  totalUsage: AggregatedUsage;
  turns: Turn[];
  subagents: SubagentRef[];
  parseWarnings: number;
}

// ────────────────────────────────────────────────────────────────────────────
// Parser contract — ClaudeEvent discriminated union (D-15, SYS-06)
// ────────────────────────────────────────────────────────────────────────────
//
// These TypeScript types describe the shape emitted by the Zod parser in
// packages/server/src/reader/parser.ts (created in plan 03). The Zod schemas
// are the runtime source of truth; these interfaces mirror them for consumers
// that only need the static types.
//
// Per D-15, the union includes an explicit `{ type: 'unknown', raw: unknown }`
// arm. Per RESEARCH.md §10 the runtime parser uses
// `z.union([KnownEventsSchema, UnknownEventSchema])` — the union pattern here
// reflects that wrapper. Unknown events are PRESERVED, never dropped.

export interface ClaudeEventBase {
  uuid?: string;
  parentUuid?: string | null;
  sessionId?: string;
  timestamp?: string;
  agentId?: string;
  isSidechain?: boolean;
  version?: string;
  cwd?: string;
  gitBranch?: string;
  slug?: string;
}

export interface UserEvent extends ClaudeEventBase {
  type: 'user';
  message: {
    role: 'user';
    content: string | unknown[];
  };
  promptId?: string;
  isMeta?: boolean;
}

export interface AssistantEvent extends ClaudeEventBase {
  type: 'assistant';
  requestId?: string;
  message?: {
    id?: string;
    model?: string;
    role?: 'assistant';
    content?: unknown[];
    stop_reason?: string;
    usage?: UsageBlock;
  };
}

export interface SystemEvent extends ClaudeEventBase {
  type: 'system';
  subtype?: string;
  content?: string;
  level?: string;
}

export interface QueueOperationEvent extends ClaudeEventBase {
  type: 'queue-operation';
  operation: 'enqueue' | 'dequeue' | 'remove' | 'popAll';
  content?: string;
}

export interface CustomTitleEvent extends ClaudeEventBase {
  type: 'custom-title';
  customTitle: string;
}

export interface AiTitleEvent extends ClaudeEventBase {
  type: 'ai-title';
  aiTitle: string;
}

export interface AgentNameEvent extends ClaudeEventBase {
  type: 'agent-name';
  agentName: string;
}

export interface LastPromptEvent extends ClaudeEventBase {
  type: 'last-prompt';
  lastPrompt: string;
}

/**
 * Fallback arm for any JSONL line whose `type` field is not one of the known
 * values above. Per D-15 the raw object is preserved so a future Claude Code
 * version's new event type can still be rendered as "unknown event (type: X)".
 */
export interface UnknownEvent {
  type: 'unknown';
  raw: unknown;
}

export type ClaudeEvent =
  | UserEvent
  | AssistantEvent
  | SystemEvent
  | QueueOperationEvent
  | CustomTitleEvent
  | AiTitleEvent
  | AgentNameEvent
  | LastPromptEvent
  | UnknownEvent;

// ────────────────────────────────────────────────────────────────────────────
// API response shapes (D-23, D-24, D-25)
// ────────────────────────────────────────────────────────────────────────────

export interface SessionsListResponse {
  sessions: SessionMeta[];
}

export interface SessionDetailResponse {
  turns: Turn[];
  subagents: SubagentRef[];
  usage: AggregatedUsage;
  parseWarnings: number;
}

/**
 * Response shape for GET /api/sessions/:id/subagents/:agentId (Phase 3 W1.2).
 * Returns the subagent's own conversation as a navigable session view, plus
 * the parent linkage (toolUseId, childAgentIds) needed for breadcrumb + nested
 * drill-in (AGENT-01..04).
 */
export interface SubagentDetailResponse {
  agentId: string;
  agentType: string;
  description: string;
  /** Parent tool_use block id; empty string when linkage could not be resolved. */
  parentToolUseId: string;
  status: SubagentRef['status'];
  turns: Turn[];
  childAgentIds: string[];
  /** Token usage for THIS subagent only (not summed across children). */
  usage: UsageSummary;
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
  };
}

export interface HealthResponse {
  status: 'ok';
  version: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Search (Phase 4 — cross-session FTS5)
// ────────────────────────────────────────────────────────────────────────────

export type SearchContentKind = 'text' | 'thinking' | 'tool_use' | 'tool_result';

export interface SearchHit {
  sessionId: string;
  /** null = top-level session message; non-null = subagent JSONL */
  agentId: string | null;
  turnUuid: string;
  timestamp: string;
  role: 'user' | 'assistant';
  contentKind: SearchContentKind;
  /** Pre-rendered HTML with <mark>…</mark> markers; UI sanitizes via gfmSchema. */
  snippetHtml: string;
  /** Denormalized so the palette doesn't need a second fetch. */
  sessionTitle: string;
  projectSlug: string;
}

export interface SearchResponse {
  results: SearchHit[];
  query: string;
  /** True when more hits exist beyond the returned limit. */
  truncated: boolean;
}

export interface SearchStatusResponse {
  totalSessions: number;
  pendingSessions: number;
  isReconciling: boolean;
}

// ────────────────────────────────────────────────────────────────────────────
// Session Token Report (GET /api/sessions/:id/report)
// ────────────────────────────────────────────────────────────────────────────

/** Raw token counts in the five categories the report breaks usage into. */
export interface ReportTokenBreakdown {
  input: number;
  cacheCreate5m: number;
  cacheCreate1h: number;
  cacheRead: number;
  output: number;
}

/** One row in the breakdown table — grouped by (agent group, model). */
export interface ReportRow {
  /** 'main' for the parent session; agentType (e.g. "Explore") for subagents. */
  agentGroup: 'main' | string;
  /** How many distinct subagent invocations contribute. Always 1 for main. */
  invocationCount: number;
  /** message.model value (e.g. "claude-opus-4-7"); '' when no assistant turn carried one. */
  model: string;
  tokens: ReportTokenBreakdown;
  /** cache_read / (cache_read + cache_create_5m + cache_create_1h + input). null when denominator is 0. */
  cacheHitRate: number | null;
  /** Weighted units for this row; null when model weights are missing. */
  units: number | null;
  /** Per-category units (token × weight × cache multiplier). null when model weights are missing. */
  unitsByCategory: ReportTokenBreakdown | null;
  /** Resolved per-token weights for this row's model. null when model weights are missing. */
  weights: { input: number; output: number } | null;
}

/** Cost-by-usage-type row, in units (the table footer). */
export interface ReportUnitsByUsageType extends ReportTokenBreakdown {}

export interface SessionReport {
  sessionId: string;
  /** ms between first and last main-session turn timestamps. 0 if not computable. */
  durationMs: number;
  toolCalls: { main: number; sub: number; total: number };
  /** Overall cache hit rate across all rows. null when denominator is 0. */
  cacheHitRate: number | null;
  /** Sum of all row.units (excluding rows where units === null). */
  totalUnits: number;
  /** True when any row has units === null (unknown model). UI annotates total as "≥ X". */
  weightsMissing: boolean;
  /** List of model strings whose weights couldn't be resolved (for the warning footnote). */
  missingModels: string[];
  rows: ReportRow[];
  /** Sum of units per usage type across all rows. Drives the table footer. */
  unitsByUsageType: ReportUnitsByUsageType;
}

