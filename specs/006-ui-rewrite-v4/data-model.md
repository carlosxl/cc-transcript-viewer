# Data Model: UI Rewrite v4

**Feature**: 006-ui-rewrite-v4
**Phase**: 1 — Design & Contracts

The data model is split into three layers:

1. **Wire types** — defined in `@cc-viewer/shared`; the UI imports them read-only.
2. **UI projection types** — derived in `useSessionView` to fit the design's `(Turn { user; requests })` mental model.
3. **UI state shapes** — Zustand stores; client-only.

---

## 1. Wire types (consumed from `@cc-viewer/shared`)

Imported as-is. The UI does not extend, mutate, or shadow these.

| Type | Where used in UI | Notes |
|------|------------------|-------|
| `SessionMeta` | Sidebar `SessionRow`, `ProjectGroup` | Lightweight summary returned by `/api/sessions` |
| `SessionsListResponse` | `api/sessions.ts` | `{ sessions: SessionMeta[] }` |
| `Session` | Transcript root state | Returned implicitly (via fields) by `/api/sessions/:id` |
| `SessionDetailResponse` | `api/sessions.ts` | `{ turns, subagents, usage, parseWarnings, toolInteractions, tokenSeries, fileTouchIndex }` |
| `Turn` | `useSessionView` projection | One JSONL event grouped by role (user/assistant/system) |
| `ToolUse`, `ToolResult` | Block rendering, inspector | `ToolUse.input` is `Record<string, unknown>` — never `any` |
| `SubagentRef` | Session stack frame | `agentId` is the key for drill-in |
| `SubagentDetailResponse` | `api/subagents.ts` | Same projections as `SessionDetailResponse` |
| `SearchHit`, `SearchResponse` | Search palette | `kind: 'text' \| 'thinking' \| 'tool_use' \| 'tool_result'` |
| `SearchStatusResponse` | Search palette status row | Indexing snapshot |
| `SessionReport`, `ReportRow` | Session Report overlay | Per agent × model × usage-type breakdown |
| `ToolInteraction` | Block rendering helpers | `previewSummary`, `diffSummary`, derived `status` |
| `TokenSeries`, `TokenPoint`, `TokenSpike` | Session Report sparkline + spikes | One point per turn |
| `FileTouchIndex`, `FileTouch` | Session Report files timeline | Read/write pip rows |
| `UsageBlock`, `UsageSummary`, `AggregatedUsage` | Cost tooltip, header chips | Per-agent + total |
| `HealthResponse` | Connectivity check (optional) | Surfaced if used at all |
| `ErrorResponse` | Generic error rendering | `{ error: { code, message } }` |

---

## 2. UI projection types (derived from `Turn[]`)

Defined in `packages/ui/src/lib/types.ts`. Produced by `useSessionView`.

```ts
// One Block as the design's transcript renders it.
export type Block =
  | { kind: 'text'; body: string }
  | { kind: 'thinking'; body: string }
  | {
      kind: 'tool_use';
      name: string;
      input: Record<string, unknown>;
      // Joined from the matching ToolResult.
      output?: string;
      preview?: string;       // From ToolInteraction.previewSummary, when available.
      status: 'ok' | 'err';
      duration: number;       // ms; derived from timestamps.
      // Subagent drill — set when ToolUse.childAgentId is present.
      isSubagent: boolean;
      subagentRef?: string;   // == ToolUse.childAgentId
    }
  | {
      kind: 'diff';
      path: string;
      lang: string;
      adds: number;
      dels: number;
      hunks: Array<
        | { type: 'hunk'; text: string }
        | { type: 'add' | 'del' | 'ctx'; n?: number; text: string }
      >;
    };

// One assistant Turn (= one API call) becomes a Request.
export interface Request {
  id: string;             // assistantTurn.uuid
  duration: number;       // ms; sum of block durations or wall-clock
  ttft: number;           // ms; first-token-time, when available
  cost: number;           // dollars; derived from assistantTurn.usage
  blocks: Block[];
  tokens: {
    in: number;
    out: number;
    cc: number;           // cache create
    cr: number;           // cache read
  };
}

// Attached events accompanying a user Turn (tool_results, /local-command-stdout, etc.).
export interface Attachment {
  kind: string;           // e.g. "tool_result", "stdout"
  desc: string;
  ts: string;             // ISO timestamp
  tokens: number;         // estimated input-token count
}

// The design's two-level Turn.
export interface SessionTurn {
  id: string;             // userTurn.uuid (deterministic)
  time: string;           // ISO timestamp
  prompt: string;         // userTurn.textBlocks.join('\n')
  userMsgId: string;      // same as id; kept for parallelism with design
  attachments: Attachment[];
  requests: Request[];
}

// What the transcript components consume.
export interface SessionView {
  id: string;             // sessionId
  title: string;
  model: string;          // most recent assistant turn's model
  isLive: boolean;
  parentTurnId?: string;  // present when viewing a subagent
  turns: SessionTurn[];
}

export interface FlatNode {
  id: string;
  meta: FocusedNodeMeta;
}

export interface FocusedNodeMeta {
  kind: 'user' | 'request';
  turn: SessionTurn;
  request?: Request;
  idx?: number;
  total?: number;
}

export interface FocusedBlockMeta {
  bid: string;            // `${request.id}:b${blockIndex}`
  block: Block;
  request: Request;
  turn: SessionTurn;
}

export interface FlatToolItem {
  bid: string;
  block: Extract<Block, { kind: 'tool_use' | 'diff' }>;
  request: Request;
  turn: SessionTurn;
}

export type Theme = 'dark' | 'light';
export type Density = 'comfortable' | 'compact';
```

### Validation rules (carried from spec)

- **Stderr envelope filter** (FR-080 `n`/`N`): a `SessionTurn` whose `prompt` matches `/^\[stderr\]/` is included in `useFlatNodes` and the Turn Jumper but **excluded** from `useFlatPrompts`.
- **Block focus implies node focus** (FR-060): setting `focusedBlockId` must also set `focusedNodeId` / `focusedNodeMeta` on the block's owning Request.
- **Initial scroll is instant, user-driven scroll is smooth** (FR-061): the scroll-into-view hook chooses `'auto'` on first paint and `'smooth'` thereafter. Initial load runs the jump three times (`setTimeout` 0 / 80 / 350 ms) to defer past font-loading reflows — directly mirroring the prototype's `app.jsx` lines 60-71.
- **Density / theme defaults**: `dark`, `comfortable` on first load; no persistence in v1 (R-09).

### State transitions

- **Focus**:
  - `setNode(id, meta)` → updates node focus; clears block focus.
  - `setBlock(bid, meta)` → sets block focus; also writes node focus to the owning request; auto-opens inspector if hidden (FR-070 + FR-055).
  - `clearBlock()` → keeps node focus, drops block focus.
- **Session stack**:
  - `push(subagent, parentLabel)` → snapshots current frame's `{ nodeId, blockId, scrollTop }`; appends new frame.
  - `pop()` → drops the top frame; restores the new top's snapshot with **instant** scroll.
  - `replaceRoot(session)` → resets the stack to one frame; used when the sidebar switches sessions.
- **Theme / density**: toggle handler reads current value, writes the inverse, sets `data-theme` / `data-density` on `document.documentElement`.
- **Live tail**:
  - SSE `snapshot` → `livePending = true`.
  - SSE `turns: T[]` → append to `pendingTurns`. If user is at bottom of body → auto-scroll. Else if user is NOT in a subagent → `tailToast = true`.
  - `Shift+G` → consumes `pendingTurns` into the session view; clears `tailToast`.

---

## 3. UI state shapes (Zustand stores)

All stores live in `packages/ui/src/stores/`.

### `useSessionStack`

```ts
interface SessionStackFrame {
  view: SessionView;                       // The active session (or subagent)
  parentLabel: string | null;              // null for root
  focusSnapshot?: {
    nodeId: string;
    blockId?: string;
    scrollTop: number;
  };
}

interface SessionStackStore {
  stack: SessionStackFrame[];              // length ≥ 1; stack[0] is the root
  push(view: SessionView, parentLabel: string, snapshot: { nodeId: string; blockId?: string; scrollTop: number }): void;
  pop(): SessionStackFrame['focusSnapshot'] | undefined;  // returns the restored snapshot
  replaceRoot(view: SessionView): void;    // sidebar selection — drops any stack depth
  current(): SessionStackFrame;            // top of stack
  isSubagent(): boolean;                   // stack.length > 1
}
```

### `useFocus`

```ts
interface FocusStore {
  nodeId: string | null;
  nodeMeta: FocusedNodeMeta | null;
  blockId: string | null;
  blockMeta: FocusedBlockMeta | null;
  setNode(id: string, meta: FocusedNodeMeta): void;
  setBlock(bid: string, meta: FocusedBlockMeta): void;
  clearBlock(): void;
  reset(): void;                           // for session changes
}
```

### `useWorkspace`

```ts
interface WorkspaceStore {
  theme: Theme;                            // 'dark' | 'light'
  density: Density;                        // 'comfortable' | 'compact'
  inspectorOpen: boolean;
  setTheme(t: Theme): void;
  setDensity(d: Density): void;
  toggleTheme(): void;
  toggleDensity(): void;
  toggleInspector(): void;
}
```

A single `useEffect` in `App.tsx` reflects `theme` / `density` onto `document.documentElement` so CSS variables update in lockstep.

### `useOverlays`

```ts
interface OverlaysStore {
  search: { open: boolean; query: string };
  report: { open: boolean };
  jumper: { open: boolean; anchor: DOMRect | null };
  openSearch(): void;
  setQuery(q: string): void;
  openReport(): void;
  toggleReport(): void;
  openJumper(anchor: DOMRect): void;
  closeAll(): void;
  closeTop(): boolean;                     // returns true if a layer was closed
}
```

`closeTop` honors the design's Esc priority: jumper → report → search.

### `useLiveTail`

```ts
interface LiveTailStore {
  livePending: boolean;                    // chip visible
  pendingTurns: Turn[];                    // not-yet-merged turns from SSE
  tailToast: boolean;                      // toast visible
  appendTurns(turns: Turn[], opts: { userAtBottom: boolean; inSubagent: boolean }): void;
  consumePending(): Turn[];                // empties pendingTurns and returns them
  dismissToast(): void;
  setLivePending(v: boolean): void;
  reset(): void;                           // when session changes
}
```

The SSE subscription itself lives in `hooks/useLiveTail.ts` and calls into the store. The hook decides whether the user is at the bottom (via `bodyRef` + `clientHeight`) and whether the stack is in a subagent (via `useSessionStack.isSubagent()`).

---

## 4. Data flow at a glance

```text
                ┌──────────────────────────────────┐
                │  Hono server (unchanged)         │
                │  /api/* + SSE                    │
                └────┬───────────────────┬─────────┘
                     │                   │
       fetch (JSON)  │     EventSource   │ (SSE turns/snapshot/ping)
                     ▼                   ▼
       ┌─────────────────────┐   ┌──────────────────────┐
       │ TanStack Query      │   │ hooks/useLiveTail    │
       │ caches per session  │   │ writes pendingTurns  │
       └────────┬────────────┘   └─────────┬────────────┘
                ▼                          ▼
       ┌──────────────────────────────────────────────┐
       │ hooks/useSessionView                         │
       │ Turn[] + pendingTurns → SessionView          │
       │  • groups user/assistant into SessionTurns   │
       │  • joins ToolUse with ToolResult             │
       │  • emits Block[] per Request                 │
       └────────┬─────────────────────────────────────┘
                ▼
       ┌──────────────────────────────────────────────┐
       │ hooks/useFlatNodes / useFlatTools /          │
       │ useFlatPrompts — for j/k, [ ], n/N           │
       └────────┬─────────────────────────────────────┘
                ▼
       ┌──────────────────────────────────────────────┐
       │ components/transcript/Transcript.tsx         │
       │  (react-virtuoso, dynamic heights)           │
       └────────┬─────────────────────────────────────┘
                ▼
        Focus changes feed useFocus, which drives Inspector
        Overlays sit above all of this and read SessionView.
```
