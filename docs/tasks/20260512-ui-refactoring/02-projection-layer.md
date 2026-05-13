# Phase 2 — Projection layer

## Goal

Introduce a **derived/projected** data layer in `@cc-viewer/shared` so the new
right-rail panels (Inspector, Tokens, Files) consume ready-to-render shapes
instead of re-walking turns on every render. Pure functions, deterministic,
server-built once per session — same pattern as the existing `report.ts`.

The raw event model (`Session`, `Turn`, `ToolUse`, `ToolResult`, `UsageBlock`)
is **not** changed. This is a projection on top of it.

## Scope (deliverables)

### 1. `ToolInteraction[]` — call ↔ result pairing

```ts
interface ToolInteraction {
  id: string;                  // stable, e.g. `${turnUuid}:${toolUseId}`
  turnUuid: string;            // back-pointer for "jump back"
  tool: string;                // 'Bash' | 'Read' | 'Edit' | …
  input: unknown;              // typed per-tool downstream
  result: ToolResult | null;   // null if still streaming / unmatched
  status: 'success' | 'fail' | 'running';
  startedAt: string;
  durationMs: number | null;
  diff: DiffSummary | null;    // present for Edit / Write
  preview: PreviewSummary | null; // present for Read
}
```

`Inspector` consumes a `ToolInteraction` directly — no re-walking turns.

### 2. `TokenSeries` — per-turn token telemetry

```ts
interface TokenPoint {
  turnUuid: string;
  turnIndex: number;
  model: string;
  input: number;
  output: number;
  cacheCreate: number;
  cacheRead: number;
}
interface TokenSeries {
  points: TokenPoint[];
  byModel: { model: string; tokens: number; pct: number }[];
  spikes: { turnUuid: string; tokens: number; reason: string }[];
  cacheHitPct: number;
  avgPerTurn: number;
}
```

`Tokens` panel consumes this. Spike-detection heuristic (e.g. turns >2σ above
mean, top-3) should live here, not in the UI.

### 3. `FileTouchIndex` — files-touched aggregation

```ts
interface FileTouch {
  path: string;
  reads:  TurnRef[];   // { turnUuid, timestamp }
  writes: TurnRef[];
  changed: boolean;    // had any Edit / Write
  lineCount: number | null;
}
interface FileTouchIndex {
  files: FileTouch[];  // sorted by recency or write-count — decide
}
```

Sourced from `Read`, `Edit`, `Write`, `MultiEdit`, `NotebookEdit` tool calls.

### 4. Wiring

- Build all three in `@cc-viewer/shared` as pure functions over `Session`.
- Extend `SessionDetailResponse` to include `toolInteractions`, `tokenSeries`,
  `fileTouchIndex` — OR expose a sibling `/api/sessions/:id/projections` route
  if response-size grows past ~1MB on large sessions. Measure first; default to
  inline.
- Same projections for `SubagentDetailResponse` (subagents have their own
  scope — see OPEN-QUESTIONS).
- Unit tests for each builder, mirroring `report.test.ts`.

## Out of scope

- Any UI changes — this phase is pure data.
- Diff-rendering UI (Phase 4 / 5 will consume `DiffSummary`).
- Server-side caching beyond what `SessionCache` already provides.

## Files likely to touch

- `packages/shared/src/projections/` (new directory):
  - `tool-interactions.ts` + test
  - `token-series.ts` + test
  - `file-touch.ts` + test
- `packages/shared/src/types.ts` — extend `SessionDetailResponse`,
  `SubagentDetailResponse`.
- `packages/server/src/api/routes.ts` — populate the new fields.
- `packages/server/src/reader/session-loader.ts` — call the builders.

## Key decisions to settle in planning

- **Inline vs. sibling route.** Inline is simpler; sibling lets the UI skip
  projections on initial load and fetch lazily. Decide based on payload size
  on a 10k-message session.
- **Diff extraction shape.** `Edit` tool args already carry old/new strings;
  decide whether `DiffSummary` precomputes line-level hunks or stores raw
  strings and lets the UI compute on demand. (Server-side is more cache-friendly
  but ships more bytes.)
- **Spike detection threshold.** What counts as a "spike turn" — fix in this
  phase so the UI doesn't have to reason about it.
- **Stable IDs.** `ToolInteraction.id` must survive across reloads (used for
  selection state). `${turnUuid}:${toolUseId}` is durable.

## Acceptance criteria

- Three new builders with full unit-test coverage; deterministic outputs on a
  fixture session.
- `SessionDetailResponse` payload size on a 10k-message fixture is measured and
  noted in this phase's plan.
- Server route returns projections without measurable latency regression
  (within 10% of current `/api/sessions/:id` p95).
- No UI consumer yet — but the types are exported and importable.
