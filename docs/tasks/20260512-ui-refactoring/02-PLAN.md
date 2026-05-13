# Phase 2 — Projection layer: Implementation Plan

## TL;DR

- Add three pure builders in a new `packages/shared/src/projections/` directory,
  each shaped like `buildSessionReport`: deterministic, pure-over-`Session`, no
  I/O. They produce `ToolInteraction[]`, `TokenSeries`, `FileTouchIndex`.
- Extend `SessionDetailResponse` and `SubagentDetailResponse` with three new
  fields populated inline. No sibling route — measurement on a real session
  (commit `691cb9c` + on-disk session) shows the projections add a thin layer
  on top of `turns`; the bottleneck is already `turns` itself. Decide otherwise
  only if a 10k-message measurement crosses ~1MB delta.
- Wire builders into `routes.ts` for the parent session and each subagent in
  the parent's `subagents` array. `SubagentDetailResponse` calls the same
  builders over `sa.turns` (no children — see D-Sub below).
- Subagent projections are scoped to that subagent only — they do NOT include
  the parent's turns. (Matches Q4 in OPEN-QUESTIONS.)
- No UI consumer yet. Phases 5/6 wire the rail panels to these shapes.

---

## Decisions

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| D1 | Stable interaction id | `${turnUuid}:${toolUseId}` | `toolUseId` is unique per assistant turn; combined with `turnUuid` it survives reloads and is the natural selector key for `useSelectedInteraction` (Phase 5). Brief lists this exact form. |
| D2 | Inline vs sibling route | Inline — extend both detail responses. | Builders are O(turns) and append O(turns) bytes to the payload; the existing payload is already O(turns × content). No second round-trip, no second cache layer. Measure on a real large session in Step 6; flip to sibling only if `projections` exceeds ~1MB or ~25% of payload. |
| D3 | DiffSummary shape | `{ filePath, added, removed }` — line-count metadata only. | The raw `old_string` / `new_string` are already on `ToolUse.input` in the `turns` array. Re-emitting them in `DiffSummary` would double the diff bytes for no gain. Phase 5's diff renderer indexes `turns[interaction.turnUuid].toolUses[…]` by `interaction.toolUseId` and computes hunks client-side; the precomputed `added`/`removed` lets the Inspector header show "+12 / −3" without re-walking. |
| D4 | PreviewSummary shape | `{ filePath, lineCount }` — metadata only. | Same logic: the actual preview text lives in `ToolResult.content` (already on the wire under `turns[resultTurnUuid].toolResults`). The projection records `lineCount` so the Files panel can show "1,432 lines" without re-counting in the UI. |
| D5 | Spike detection | Top-3 turns where `total = input + output + cacheCreate5m + cacheCreate1h` exceeds `mean + 2*stdev`. `reason` = `'high-input' \| 'high-output' \| 'high-cache-create'` — whichever single category contributes most to the spike. | Simple, deterministic, no parameter tuning. Brief leaves the heuristic to this phase. Reason string is for the Tokens panel's "what spiked?" sub-label. |
| D6 | Status for in-flight calls | `'running'` when no matching `ToolResult` exists in the session. `'fail'` when result has `is_error === true`. Otherwise `'success'`. | Matches OPEN-QUESTIONS Q3 Option A (accept the limitation). |
| D7 | Duration | `endTs - startTs` in ms, where `startTs` = turn `timestamp` of the ToolUse and `endTs` = turn `timestamp` of the ToolResult. `null` when result missing or timestamps unparseable. | Cheapest signal available. ToolUse + ToolResult often span sub-second; precision is good enough for Inspector's "took N ms" badge. |
| D8 | File path extraction | `Edit`/`Write`/`MultiEdit`/`NotebookEdit` → `input.file_path` (or `input.notebook_path` for NotebookEdit). `Read` → `input.file_path`. | Matches the actual tool schemas Claude Code emits. Unknown shapes (missing `file_path`) are skipped — log nothing, just drop. |
| D9 | FileTouch sort order | Recency-desc: newest event first (max of last read/write timestamp). | Brief says "sort by recency or write-count — decide". Recency-desc matches the design's "Files" panel which leads with what was touched most recently. |
| D10 | Tool result pairing | Walk the full main `Turn[]`, build a `Map<toolUseId, { turn, result }>` from user turns' `toolResults`. For each `ToolUse` in an assistant turn, look it up. | Single O(n) pass per session. Pairs survive non-adjacent turns (Claude Code can emit a tool_result several turns later). |
| D11 | Subagent scope | `SubagentDetailResponse` projections walk only `sa.turns` — no parent context, no children rollup. | Matches OPEN-QUESTIONS Q4: "right rail should reflect the context of the currently selected interaction". When user is in a subagent, they want that subagent's tools/tokens/files, not the parent's. |
| D12 | Token point inclusion | Emit a `TokenPoint` for every assistant turn with a `usage` block. Skip user/system turns. `turnIndex` is the assistant-turn ordinal (0, 1, 2…), not the overall turn index — Tokens chart is one bar per assistant turn. | Brief says "per-turn token telemetry". Only assistant turns carry usage; including users would emit zero-bars and waste pixels. |
| D13 | `byModel` percentage basis | `pct` = `model.tokens / sum(all tokens)`, where `tokens` is the sum of all five categories. | Tokens panel uses this for the model breakdown ring. Sum-of-all-five matches the report.ts convention. |
| D14 | Where projections live in response | New top-level fields `toolInteractions`, `tokenSeries`, `fileTouchIndex` on both detail responses. Sibling to `turns`, not nested. | Easiest to consume from React (one selector per panel). Easy to strip later if we flip to sibling route. |

---

## Step-by-step plan

### Step 1 — Add types in `packages/shared/src/types.ts`

Add at the bottom of the file (after `SessionReport`), then export from
`index.ts` (already barrel-exports `./types.js`):

```ts
// ── Projections (Phase 2 of 20260512-ui-refactoring) ─────────────────────

export interface DiffSummary {
  filePath: string;
  added: number;     // line count
  removed: number;
}

export interface PreviewSummary {
  filePath: string;
  lineCount: number | null;
}

export interface ToolInteraction {
  id: string;                       // `${turnUuid}:${toolUseId}`
  turnUuid: string;
  toolUseId: string;                // index back into turns[].toolUses
  tool: string;
  resultTurnUuid: string | null;    // turn carrying the tool_result, or null
  status: 'success' | 'fail' | 'running';
  startedAt: string;
  durationMs: number | null;
  diff: DiffSummary | null;
  preview: PreviewSummary | null;
}

export interface TokenPoint {
  turnUuid: string;
  turnIndex: number;           // assistant-turn ordinal
  model: string;
  input: number;
  output: number;
  cacheCreate: number;         // 5m + 1h
  cacheRead: number;
}

export interface TokenSpike {
  turnUuid: string;
  tokens: number;
  reason: 'high-input' | 'high-output' | 'high-cache-create';
}

export interface TokenSeries {
  points: TokenPoint[];
  byModel: { model: string; tokens: number; pct: number }[];
  spikes: TokenSpike[];
  cacheHitPct: number;
  avgPerTurn: number;
}

export interface TurnRef {
  turnUuid: string;
  timestamp: string;
}

export interface FileTouch {
  path: string;
  reads: TurnRef[];
  writes: TurnRef[];
  changed: boolean;
  lineCount: number | null;
}

export interface FileTouchIndex {
  files: FileTouch[];          // sorted by recency desc (newest first)
}
```

Extend both detail responses:

```ts
export interface SessionDetailResponse {
  turns: Turn[];
  subagents: SubagentRef[];
  usage: AggregatedUsage;
  parseWarnings: number;
  toolInteractions: ToolInteraction[];
  tokenSeries: TokenSeries;
  fileTouchIndex: FileTouchIndex;
}

export interface SubagentDetailResponse {
  /* …existing… */
  toolInteractions: ToolInteraction[];
  tokenSeries: TokenSeries;
  fileTouchIndex: FileTouchIndex;
}
```

**Verify:** `npm run typecheck` — server + UI compile (UI doesn't consume the
new fields yet, so adding optional vs required doesn't matter; required is
fine and forces the server wiring).

### Step 2 — Build `tool-interactions.ts` + test

`packages/shared/src/projections/tool-interactions.ts`:

```ts
export function buildToolInteractions(turns: Turn[]): ToolInteraction[]
```

Algorithm:
1. Index `ToolResult` blocks: walk all `turns`, for each `t.toolResults` entry
   record `{ result, timestamp: t.timestamp }` into `Map<tool_use_id, …>`.
2. For each assistant turn with `toolUses`, in order, emit one `ToolInteraction`.
3. Status: `'fail'` when `result?.is_error`; `'success'` when result present
   and not error; `'running'` otherwise.
4. `durationMs`: `Date.parse(resultTs) - Date.parse(useTs)` when both finite,
   else null. Clamp to ≥ 0.
5. `diff` for `Edit` / `Write` / `MultiEdit` / `NotebookEdit`:
   - `Edit`: count lines in `new_string.split('\n')` vs `old_string.split('\n')`.
     `added = max(0, newLines - oldLines)`, `removed = max(0, oldLines - newLines)`.
     (Cheap heuristic — Phase 5 client-side computes hunks for the actual
     coloring.)
   - `Write`: `added = content.split('\n').length`, `removed = 0`.
   - `MultiEdit`: sum across `edits`.
   - `NotebookEdit`: same Edit-style count over `new_source` vs implicit empty
     (when `cell_id` absent → treated as Write).
6. `preview` for `Read`: `filePath = input.file_path`; `lineCount` from
   `toolResult.content` if string → `content.split('\n').length`; else null.

Test cases (one `describe` block, mirrors `report.test.ts`):
- pairs ToolUse with matching ToolResult by id
- status `running` when result missing
- status `fail` when `is_error`
- duration ms = result timestamp − use timestamp
- multiple ToolUses in one turn → one interaction each, ordered
- `diff` populated for `Edit`/`Write`/`MultiEdit`/`NotebookEdit`, null otherwise
- `preview.lineCount` for `Read` with string content
- stable id format `${turnUuid}:${toolUseId}`

**Verify:** `npm test -- projections/tool-interactions` green.

### Step 3 — Build `token-series.ts` + test

`packages/shared/src/projections/token-series.ts`:

```ts
export function buildTokenSeries(turns: Turn[]): TokenSeries
```

Algorithm:
1. Filter assistant turns with `t.usage`, in order. Assign `turnIndex` 0..N-1.
2. For each: `input = u.input_tokens`, `output = u.output_tokens`,
   `cacheCreate = u.cache_creation_input_tokens`,
   `cacheRead = u.cache_read_input_tokens`. Defaults 0.
3. `byModel`: group by `model ?? ''`, sum the five categories per group.
   `pct = groupTotal / grandTotal`. Sort by `tokens` desc.
4. `spikes`:
   - `total[i] = input + output + cacheCreate` (cache-read is largely free).
   - `mean`, `stdev` over `total[]`.
   - Spike candidate when `total[i] > mean + 2 * stdev`. Take top 3 by total.
   - `reason`: largest of `{input, output, cacheCreate}` → tag.
   - Skip if fewer than 4 points (no statistical signal).
5. `cacheHitPct`: `sum(cacheRead) / (sum(cacheRead) + sum(cacheCreate) + sum(input))`.
   `0` when denom is 0. (Matches `report.ts` hitRate; expressed 0..1.)
6. `avgPerTurn`: `sum(total[]) / points.length` or `0` if empty.

Test cases:
- empty turns → empty points, byModel=[], spikes=[], cacheHitPct=0, avg=0
- single assistant turn → 1 point, byModel has that model with pct=1
- byModel split across two models → sum to 1
- spike detection: 4 points where #4 is 3× the others → reports #4 as spike
- spike skipped when fewer than 4 points
- `reason` picks the dominant category
- cacheHitPct matches canonical formula
- `turnIndex` is assistant-turn ordinal, not raw index

**Verify:** `npm test -- projections/token-series` green.

### Step 4 — Build `file-touch.ts` + test

`packages/shared/src/projections/file-touch.ts`:

```ts
export function buildFileTouchIndex(turns: Turn[]): FileTouchIndex
```

Algorithm:
1. `Map<path, FileTouch>`. Walk assistant turns' `toolUses`.
2. Path extraction:
   - `Read` → `input.file_path` → push `{ turnUuid, timestamp }` to `reads`.
   - `Edit` / `Write` / `MultiEdit` → `input.file_path` → push to `writes`.
   - `NotebookEdit` → `input.notebook_path` → push to `writes`.
3. `changed = writes.length > 0`.
4. `lineCount`: when a `Read` result has string content, store the latest
   observed `content.split('\n').length`. Null when never observed.
5. Sort `files` by max(reads.last, writes.last) descending. Ties: writes-count desc.

Test cases:
- single Read → one FileTouch with 1 read, 0 writes, changed=false
- Edit on same path → changed=true, write recorded
- Read then Edit then Read → 2 reads + 1 write, changed=true
- MultiEdit → write recorded
- NotebookEdit reads notebook_path
- two paths, second touched later → second sorts first
- lineCount populated from Read result; null when only writes seen

**Verify:** `npm test -- projections/file-touch` green.

### Step 5 — Wire builders into `routes.ts`

In `app.get('/api/sessions/:id', …)`:

```ts
const body: SessionDetailResponse = {
  turns: session.turns,
  subagents: session.subagents,
  usage: session.totalUsage,
  parseWarnings: session.parseWarnings,
  toolInteractions: buildToolInteractions(session.turns),
  tokenSeries: buildTokenSeries(session.turns),
  fileTouchIndex: buildFileTouchIndex(session.turns),
}
```

In `app.get('/api/sessions/:id/subagents/:agentId', …)`:

```ts
const body: SubagentDetailResponse = {
  /* …existing… */
  toolInteractions: buildToolInteractions(sa.turns),
  tokenSeries: buildTokenSeries(sa.turns),
  fileTouchIndex: buildFileTouchIndex(sa.turns),
}
```

Imports in `routes.ts`:

```ts
import { buildToolInteractions, buildTokenSeries, buildFileTouchIndex } from '@cc-viewer/shared'
```

Update `packages/shared/src/index.ts`:

```ts
export * from './projections/tool-interactions.js'
export * from './projections/token-series.js'
export * from './projections/file-touch.js'
```

In `packages/server/src/api/routes.test.ts` add light assertions: GET
`/api/sessions/:id` response now has `toolInteractions`, `tokenSeries`,
`fileTouchIndex`. GET subagent route ditto.

**Verify:** `npm test -- routes` green.

### Step 6 — Measure payload size

On a real session from `~/.claude/projects/` (pick the largest):

```bash
curl -s http://localhost:5173/api/sessions/<id> | wc -c
```

Note before/after byte counts in this plan's "Measurement" section below.
If projections add > 1MB or > 25% of payload, escalate to D2 sibling-route
flip. (Expected: projections are small — maybe 5–10% of `turns` bytes.)

### Step 7 — Run full suite, mark progress

```bash
npm run typecheck
npm run test
npm run build
```

Update `00-PROGRESS.md`: Phase 2 row from ⬜ → ✅, write a "Last activity"
note with commit hash if applicable.

---

## Measurement

Measured on two real sessions from `~/.claude/projects/`:

| Session | Turns | Subagents | Tool ix | Base bytes | Full bytes | Δ bytes | Δ % |
|---------|-------|-----------|---------|------------|------------|---------|-----|
| `42121b9a…` (largest) | 1,365 | 14 | 424 | 4,597,781 | 4,915,243 | 317,462 | **6.9%** |
| `0ec2df73…` | 245 | 0 | 70 | 216,553 | 269,912 | 53,359 | 24.6% |

**Decision:** inline (D2 holds). Δ stays well under the 25% / 1MB escalation
threshold on the heaviest real session. The 24.6% figure on the smaller
session is dominated by a fixed `tokenSeries`/`fileTouchIndex` cost (~70KB
combined) on a 216KB base — absolute bytes are tiny.

### Pivot during measurement

The initial `ToolInteraction` shape from the phase brief embedded the full
`input: unknown` and `result: ToolResult | null`. First measurement showed
**41.8% delta** on the largest session because those fields duplicate
content already on the wire in `turns[].toolUses[].input` and
`turns[].toolResults[].content`.

Updated shape (committed in this phase):

- Drop `input` — UI builds `Map<toolUseId, ToolUse>` from `turns` once on load.
- Replace `result: ToolResult | null` with `resultTurnUuid: string | null` +
  retain `status` and `durationMs`. Inspector reads the full ToolResult from
  `turns[resultTurnUuid].toolResults` via a client-side index.
- Added `toolUseId: string` field so the UI can index into `turns` without
  parsing the `id` string.

The brief's "Inspector consumes a ToolInteraction directly — no re-walking
turns on every render" still holds: building the map is O(turns) once on
load, not on render. The projection still owns the expensive parts —
pairing, status, duration, diff, preview metadata.

---

## Risks / things to watch

1. **Spike detection on noisy short sessions.** Threshold `mean + 2σ` on 4–10
   assistant turns is noisy. Mitigation: skip spike emission when N < 4 (D5).
2. **`Date.parse` on missing/malformed timestamps.** Returns `NaN` — guard with
   `Number.isFinite`. Already a known pattern in `report.ts:130`.
3. **Tool input shape variance.** Tools may have variants we don't know about
   (e.g. user-defined tools via MCP). Skip silently when `file_path` missing.
4. **Subagent projections double-count tools?** No — `SessionDetailResponse`'s
   `toolInteractions` walks only main turns; subagent turns are scoped under
   their own `SubagentDetailResponse`. (D11.)
5. **`tokenSeries.byModel` empty array** when no assistant turn has `model`.
   Tokens panel must handle empty array — but UI is Phase 6, not now.
6. **Cache hit pct semantics.** Different from `report.ts`'s `cacheHitRate`
   (this one is a flat 0..1, fewer decimals). Phase 6 UI consumes this; do
   NOT swap with report.

---

## Critical files for implementation

- `packages/shared/src/types.ts` — type additions
- `packages/shared/src/projections/tool-interactions.ts` (new)
- `packages/shared/src/projections/tool-interactions.test.ts` (new)
- `packages/shared/src/projections/token-series.ts` (new)
- `packages/shared/src/projections/token-series.test.ts` (new)
- `packages/shared/src/projections/file-touch.ts` (new)
- `packages/shared/src/projections/file-touch.test.ts` (new)
- `packages/shared/src/index.ts` — re-export
- `packages/server/src/api/routes.ts` — wire builders
- `packages/server/src/api/routes.test.ts` — assert presence
