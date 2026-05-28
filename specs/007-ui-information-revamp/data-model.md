# Phase 1 — Data model (view model)

The data model here is the **view model** — the projection on the UI side of the wire from the schema's raw rows to what the rendering pipeline consumes. The schema (`packages/server/src/jsonl/schema.ts`) is the upstream source of truth; this document is the downstream contract.

---

## Naming summary

| Type | Owner package | Purpose |
|---|---|---|
| `ClaudeRow` | `packages/shared` (re-exported from `packages/server/src/jsonl/schema.ts`) | The discriminated union of every schema row variant; wire-transferred unchanged from server to client. |
| `SessionView` | `packages/ui/src/hooks/useSessionView.ts` (extended) | Top-level UI projection of a session. |
| `SessionTurn` | same | One outer Turn (per-`promptId`). |
| `Request` | same | One inner Request (per-`requestId` / `message.id`). |
| `Block` | same | One renderable content block within a Request (text, thinking, tool_use, tool_result, etc.). |
| `Attachment` | same | An attachment payload attributed to a Turn. |
| `StickyState` | NEW — `packages/ui/src/hooks/useStickyState.ts` | The carry-forward harness state for one Turn. |
| `RowItem` | NEW — `packages/ui/src/hooks/useFlatRows.ts` | One item in the flat virtualised array. |
| `SessionSummary` | NEW — derived client-side; consumed by `components/summary/SessionSummary.tsx` | Aggregate audit view. |

---

## Top-level: `SessionView`

```ts
interface SessionView {
  id: string                 // sessionId
  title: string              // ai-title or custom-title or filename
  isLive: boolean            // matched against liveTracker
  parentTurnId?: string      // set when this is a subagent view
  parentSessionTitle?: string

  turns: SessionTurn[]       // ordered chronologically
  rows: ClaudeRow[]          // full schema-typed pass-through (Chunk A onward)

  stickyByTurn: Map<string, StickyState>   // turnId → harness state at that turn
  summary: SessionSummary                  // client-side projection
}
```

Validation rules:
- `turns` and `rows` derived from the same source; `turns[].id` corresponds to `promptId` from one or more `rows`.
- `stickyByTurn` is keyed by `turns[].id` and has one entry per Turn.

---

## `SessionTurn`

```ts
interface SessionTurn {
  id: string                  // outer turn ID — derived from promptId
  time: string                // ISO timestamp from the anchoring user row
  userMsgId: string           // uuid of the anchoring user row
  prompt: string              // user.message.content (string form; arrays joined)
  promptIsSlashCommand: boolean
  attachments: Attachment[]   // attribution per §2 rule 2 of plan.md
  requests: Request[]         // one per requestId, chronological
  systemEvents: SystemEvent[] // system rows that fall within this turn's bounds
  stateChanges: InlineStateChange[]  // non-sticky session-state rows within bounds
  cost?: number                // de-duplicated cost across requests
  status: 'success' | 'error' | 'mixed' | 'in-progress'  // derived
}
```

Derivation:
- `status` derives from `requests[].blocks` final state — error if any tool result is an error, in-progress if isLive and no terminating assistant text, success otherwise.
- `cost` sums Request costs after de-duplicating by `message.id` (FR-015).

---

## `Request`

```ts
interface Request {
  id: string                  // requestId or message.id fallback
  model: string               // from assistant.message.model
  duration?: number           // from system.turn_duration if matched
  ttft?: number               // time-to-first-token; derived from timestamps
  cost?: number
  tokens?: UsageBlock         // de-duplicated to this requestId
  blocks: Block[]             // ordered
}
```

---

## `Block`

```ts
type Block =
  | { kind: 'text';      id: string; text: string }
  | { kind: 'thinking';  id: string; text: string; signature?: string }
  | { kind: 'tool_use';  id: string; toolUseId: string; toolName: string;
                         input: unknown; result?: ToolResultBlock }
  | { kind: 'tool_result'; id: string; toolUseId: string;
                          content: string | ToolResultContentItem[];
                          isError: boolean;
                          structuredSidecar?: ToolUseResult }
  | { kind: 'unknown';   id: string; raw: unknown }

interface ToolResultBlock {
  content: string | ToolResultContentItem[]
  isError: boolean
  structuredSidecar?: ToolUseResult   // Z-typed from schema.ts:273-577
}
```

The schema-typed `ToolUseResult` from `schema.ts:273-577` is re-exported as-is; no UI projection is needed inside the sidecar — it's rendered directly by specialised Block components (`BlockStructuredPatch`, `BlockAgentRollup`, `BlockAskUserQuestion`).

Validation rules:
- `tool_use.result` is null until the matching `tool_result` block is observed (live-tail case).
- For `tool_use` whose tool name is `Agent`, `structuredSidecar` MUST type-narrow to `AgentRollupResult` when present (FR-012).

---

## `Attachment`

```ts
type Attachment =
  | { kind: 'task_reminder';        id: string; ts: string; payload: TaskReminderPayload }
  | { kind: 'skill_listing';        id: string; ts: string; payload: SkillListingPayload }
  | { kind: 'deferred_tools_delta'; id: string; ts: string; payload: DeferredToolsDeltaPayload }
  | { kind: 'mcp_instructions_delta'; id: string; ts: string; payload: McpInstructionsDeltaPayload }
  | { kind: 'command_permissions';  id: string; ts: string; payload: CommandPermissionsPayload }
  | { kind: 'goal_status';          id: string; ts: string; payload: GoalStatusPayload }
  | { kind: 'nested_memory';        id: string; ts: string; payload: NestedMemoryPayload }
  | { kind: 'edited_text_file';     id: string; ts: string; payload: EditedTextFilePayload }
  | { kind: 'directory';            id: string; ts: string; payload: DirectoryPayload }
  | { kind: 'file';                 id: string; ts: string; payload: FilePayload }
  | { kind: 'hook_success';         id: string; ts: string; payload: HookSuccessPayload }
  | { kind: 'hook_blocking_error';  id: string; ts: string; payload: HookBlockingErrorPayload }
  | { kind: 'hook_non_blocking_error'; id: string; ts: string; payload: HookNonBlockingErrorPayload }
  | { kind: 'hook_cancelled';       id: string; ts: string; payload: HookCancelledPayload }
  | { kind: 'queued_command';       id: string; ts: string; payload: QueuedCommandPayload }
  | { kind: 'date_change';          id: string; ts: string; payload: DateChangePayload }
  | { kind: 'ultrathink_effort';    id: string; ts: string; payload: UltrathinkEffortPayload }
  // The next 5 below ALSO feed StickyState (see below), but still render as inline attachments:
  | { kind: 'auto_mode';            id: string; ts: string; payload: AutoModePayload }
  | { kind: 'auto_mode_exit';       id: string; ts: string; payload: AutoModeExitPayload }
  | { kind: 'plan_mode';            id: string; ts: string; payload: PlanModePayload }
  | { kind: 'plan_mode_exit';       id: string; ts: string; payload: PlanModeExitPayload }
  | { kind: 'plan_mode_reentry';    id: string; ts: string; payload: PlanModeReentryPayload }
```

Each `payload*` type is the schema's payload (e.g., `SkillListingAttachmentSchema` from `schema.ts:644`). Re-exported, not re-defined.

---

## `SystemEvent`

```ts
type SystemEvent =
  | { kind: 'turn_duration';     id: string; ts: string; durationMs: number; turnId: string }
  | { kind: 'api_error';         id: string; ts: string; message: string;
                                  retryChainId?: string;     // groups consecutive api_errors into one chain
                                  retryIndex?: number;
                                  finalOutcome?: 'success' | 'final_failure' }
  | { kind: 'stop_hook_summary'; id: string; ts: string; payload: unknown }
  | { kind: 'away_summary';      id: string; ts: string; payload: unknown }
  | { kind: 'local_command';     id: string; ts: string; payload: unknown }
  | { kind: 'informational';     id: string; ts: string; message: string }
```

`api_error` retry-chain assembly (FR-017): consecutive `api_error` rows sharing semantic equivalence (same message pattern, occurring within a short window, or terminated by a successful assistant row) are grouped into a chain. Implementation lives in a server-side normaliser helper so the wire payload carries the chain ID.

---

## `StickyState`

```ts
interface StickyState {
  permissionMode: 'auto' | 'plan' | 'acceptEdits' | 'default'
  model: string
  worktreeState: WorktreeStateSnapshot | null
  planMode: boolean
  autoMode: boolean
}

interface WorktreeStateSnapshot {
  originalBranch: string
  originalCwd: string
  originalHeadCommit: string
  sessionId: string
  worktreeBranch: string
  worktreeName: string
  worktreePath: string
}
```

Computed by `useStickyState.ts`:

```ts
function projectStickyState(rows: ClaudeRow[]): Map<string, StickyState> {
  let tail: StickyState = { /* defaults */ }
  const out = new Map<string, StickyState>()
  for (const row of rows) {
    tail = applyStickyDelta(tail, row)      // pure update
    if (isTurnAnchor(row)) {
      out.set(extractTurnId(row), tail)
    }
  }
  return out
}
```

Live-tail uses an incremental version that retains `tail` across batches (R7 in research.md).

---

## `InlineStateChange`

```ts
type InlineStateChange =
  | { kind: 'queue_operation';      id: string; ts: string; operation: 'enqueue' | 'dequeue' | 'remove' | 'popAll'; content?: string }
  | { kind: 'pr_link';              id: string; ts: string; prNumber: number; prRepository: string; prUrl: string }
  | { kind: 'file_history_snapshot';id: string; ts: string; snapshot: FileHistorySnapshot }
```

`FileHistorySnapshot` is the schema's snapshot shape (`schema.ts:1051`).

---

## `RowItem` (flat virtual array)

Defined in plan.md §5. Re-stated here for completeness:

```ts
type RowId = string

type RowItem =
  | { id: RowId; kind: 'turn-header';          turnId: string; sticky: StickyState }
  | { id: RowId; kind: 'attachment-summary';   turnId: string; attachmentId: string }
  | { id: RowId; kind: 'request';              turnId: string; requestId: string; collapsed: boolean }
  | { id: RowId; kind: 'block';                turnId: string; requestId: string; blockId: string }
  | { id: RowId; kind: 'tool-detail-expanded'; turnId: string; requestId: string; toolUseId: string }
  | { id: RowId; kind: 'system-event';         turnId: string; eventId: string }
  | { id: RowId; kind: 'inline-state-change';  turnId: string; stateChangeId: string }
  | { id: RowId; kind: 'unknown-row';          rowUuid: string }
  | { id: RowId; kind: 'subagent-rollup';      turnId: string; requestId: string; toolUseId: string; rollup: AgentRollupResult }
```

RowId derivation rules: see plan.md §5.

---

## `SessionSummary`

```ts
interface SessionSummary {
  tokens: {
    inputTotal: number
    outputTotal: number
    cacheCreationTotal: number
    cacheReadTotal: number
    cacheHitRate: number          // cacheRead / (cacheCreation + cacheRead + input), 0 if denom is 0
    countedMessageIds: Set<string>   // for verification — message.ids that contributed
  }
  filesTouched: Array<{
    path: string
    firstTurnId: string
    lastTurnId: string
    backups: Array<{ backupFileName: string; backupTime: string; version: number }>
  }>
  prLinks: Array<{ prNumber: number; prRepository: string; prUrl: string; turnId: string }>
  queueOperations: Array<{ operation: string; ts: string; turnId: string; content?: string }>
  apiErrorChains: Array<{ chainId: string; turnId: string; retries: number; finalOutcome: 'success' | 'final_failure' | 'in_progress' }>
  harnessStateTransitions: Array<{
    ts: string
    turnId: string
    field: keyof StickyState
    from: unknown
    to: unknown
  }>
}
```

Validation rules:
- `tokens.countedMessageIds` MUST equal the set of unique `message.id`s observed in the session's `assistant` rows. The summary is computed by folding each unique `message.id` once into the totals (FR-015 / SC-004).
- `cacheHitRate` is 0 when the denominator is zero, not NaN.
- `harnessStateTransitions` records the moment a sticky field's value changed, not every Turn it was active for — i.e., a session with 10k Turns but stable permission-mode produces one transition.

---

## Relationships diagram

```
ClaudeRow[] (wire from server, schema-typed)
  │
  ├── projectTurns()           → SessionTurn[]
  ├── projectStickyState()     → Map<turnId, StickyState>
  ├── projectSessionSummary()  → SessionSummary
  │
  └── (consumed by) useFlatRows() → RowItem[]   ◀──── filters (showAttachments etc.) + expansionSet
                                                          │
                                                          ▼
                                              react-virtuoso renders one RowItem per row
```

All projections are pure functions of `(rows, filters, expansionSet)`. Memoise with `useMemo` keyed on identities of those inputs.
