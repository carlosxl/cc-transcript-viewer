# Implementation Plan: UI Information Revamp

**Branch**: `007-ui-information-revamp` *(not yet created — current branch `006-ui-rewrite-v4` has in-flight work; user manages the transition)*

**Date**: 2026-05-26

**Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-ui-information-revamp/spec.md`

## Summary

Make every row variant in the freshly landed JSONL schema (`packages/server/src/jsonl/schema.ts`, 1214 lines) reachable in the UI without redesigning the shell. The corpus-validated schema exposes ~37 MB of structured `toolUseResult` sidecar data, 22 attachment variants, 9 session-state row types, 6 system-row subtypes, per-row usage with cache split, subagent transcripts, off-loaded outputs, and image attachments — almost none of which the current UI surfaces.

The technical approach is **extension, not rewrite**:

1. **Server stays parsed-object-first.** The contract today (`packages/server/src/api/routes.ts:120-162`) already returns parsed `Turn[]` to the UI via `SessionDetailResponse`. Re-thread the new schema's typed rows through the existing normalizer so the wire format gains fields without breaking shape. Add three small endpoints (off-loaded tool-result blob, file-history backup blob, optional pagination cursor) — no protocol upgrade.
2. **UI keeps the two-level grouping it already has.** The current `useSessionView` hook (`packages/ui/src/hooks/useSessionView.ts:353`) projects `SessionView → SessionTurn[] → Request[] → Block[]`. Map schema `promptId` → outer Turn, schema `requestId` / `message.id` → inner Request. This is the FR-008 grouping decision.
3. **Sticky harness state becomes a single client-side projection pass.** A linear scan over rows produces a `Map<turnId, StickyState>` carrying the last preceding `permission-mode`, model identifier, plan/auto-mode flag, and worktree state. Each Turn renders its sticky badge set from this map.
4. **Single virtualised flat-array stays the rendering model.** New row kinds (attachment-summary, system-event, inline-state-change, expanded-tool-detail, unknown-card) become first-class `RowItem` variants spliced into the same react-virtuoso list. No nested scroll.
5. **Session-summary surface is computed client-side** from the same parsed rows. No new aggregation endpoint; just a different projection.
6. **Live-tail parity is structural.** Because the SSE stream already delivers parsed `Turn[]` (`routes.ts:237-301`), the richer projection runs the same way on incrementally-arrived turns as on initial-load turns. No special live-tail code path.

Six chunks ship in order from P1 Recall non-regression through P3 Audit, with the structured-sidecar surfacing in Chunk B providing the single biggest user-visible step.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode enabled)

**Primary Dependencies**: React 19, Vite 8, Tailwind CSS 4, react-virtuoso 4.18.x, Hono 4.12.x with `@hono/node-server` 1.x, better-sqlite3 12.x, Zustand 5.x, chokidar 5.x. **No new heavyweight dependencies.** Possible small additions (justified in research.md): a diff renderer for `EditResult.structuredPatch` if no existing utility suffices.

**Storage**: JSONL files (read-only) under `~/.claude/projects/`; SQLite FTS5 at `~/.cache/cc-transcript-viewer/` for cross-session search. Off-loaded tool outputs at `<sessionDir>/tool-results/<uuid>.txt`; file-history backups at `<sessionDir>/file-history-snapshots/<backupFileName>`; subagent transcripts at `<sessionDir>/subagents/agent-<id>.jsonl` with sibling `.meta.json`.

**Testing**: Vitest in `packages/server` and `packages/ui`. Existing fixtures: `packages/ui/scripts/gen-fixture-10k.ts`. Add corpus-validation fixtures derived from the schema validation set referenced in `packages/shared/src/jsonl/README.md` §13.

**Target Platform**: macOS / Linux / Windows where Node ≥20 LTS runs; browser is the user's default modern browser pointed at localhost.

**Project Type**: Monorepo with three packages — `packages/server`, `packages/ui`, `packages/shared`.

**Performance Goals** (per spec FR-021, SC-006, SC-006a):
- Cold-start: no worse than current v4 viewer on the same hardware + same session file.
- Steady-state: no dropped frames during scroll; expand/collapse feedback ≤100 ms; mode/disclosure switch ≤200 ms.
- Constitution baseline: open a 10k-message session to interactive within 2 s after warm index.

**Constraints**:
- Single virtualised scroll container; no nested independent scroll regions (FR-022).
- Server never makes outbound calls with transcript content (FR-023, Constitution Principle I).
- Read-only access to `~/.claude/projects/` (Constitution Principle IV).
- All UI must continue to load on 10k+ row, ~145 MB sessions (FR-021, FR-024).

**Scale/Scope**:
- Largest validated session: ~145 MB JSONL.
- Schema variants to cover: 22 attachment payloads (`schema.ts:579-845`), 17 `toolUseResult` shapes (`schema.ts:273-577`), 9 session-state row types (`schema.ts:957-1079`), 6 `system` subtypes (`schema.ts:910-917`), 1 `UnknownRow` fallback (`schema.ts:1107`).

## Constitution Check

*Gate evaluation against `.specify/memory/constitution.md` v1.0.0.*

| Principle | Status | Evidence |
|---|---|---|
| **I. Local-First Privacy** | PASS | FR-023 forbids outbound calls. New endpoints (tool-result blob, file-history blob) read local files only. Search additions use existing local SQLite FTS5 index. No new telemetry. |
| **II. Scale by Default** | PASS | FR-021/FR-022/FR-024 lock in single-virtualised scroll, 10k+ baseline, react-virtuoso (already in stack). Flat-row scheme detailed in §5 below. Streaming live-tail preserved. |
| **III. Single-Command Distribution** | PASS | No new runtime deps that block `npx`. All new endpoints are added to the existing Hono app. Possible additions are TS/JS-only. |
| **IV. Source-File Read-Only** | PASS | New endpoints (tool-result blob, file-history blob) are GETs of pre-existing on-disk artifacts written by Claude Code itself. UI never writes back. Subagent transcripts already read-only via existing endpoint. |
| **V. Simplicity & Surgical Changes** | PASS | Plan extends existing normalizer / API contract / hook rather than rewriting. New code traces 1:1 to FRs (see §3 Information surface inventory). No speculative abstraction. |

**Compliance with Performance & Compatibility Standards**: Hybrid budget (FR-021) is stricter than the constitution's relative-only "2 s after warm index" on the cold-start side and adds an absolute floor for steady-state interaction. Live-tail 1-second budget (constitution) is preserved — the new projection layer runs the same per-row regardless of arrival path.

No violations → **Complexity Tracking table is empty.**

## Project Structure

### Documentation (this feature)

```text
specs/007-ui-information-revamp/
├── plan.md              # This file
├── research.md          # Phase 0 — open-question resolutions
├── data-model.md        # Phase 1 — view-model types (Turn / Request / RowItem / SessionSummary / StickyState)
├── contracts/
│   └── ui-backend.md    # Phase 1 — updated UI↔server contract (delta from 006)
├── quickstart.md        # Phase 1 — verification recipe
├── checklists/
│   └── requirements.md  # Already exists from /speckit-specify
└── tasks.md             # Phase 2 — produced later by /speckit-tasks
```

### Source code (concrete paths in the existing monorepo)

```text
packages/server/src/
├── jsonl/schema.ts                 # SOURCE OF TRUTH — no edits in this feature
├── reader/
│   ├── normalizer.ts               # Extended to pass through full schema fidelity
│   ├── parser.ts                   # Already schema-aware (see git status)
│   ├── session-loader.ts           # Wires new fields into SessionDetailResponse
│   └── subagent-linker.ts          # Already wires AgentRollupResult — verify completeness
├── api/routes.ts                   # +3 endpoints (tool-results blob, file-history blob, optional rows pagination)
└── search/search-index.ts          # Extended FTS5 coverage (per §8 below)

packages/shared/src/
└── jsonl/README.md                 # SOURCE OF TRUTH — no edits

packages/ui/src/
├── hooks/
│   ├── useSessionView.ts           # Extended: schema-aware Turn/Request, sticky-state projection, flat-row builder
│   └── useStickyState.ts           # NEW — single-pass carry-forward projection
│   └── useFlatRows.ts              # NEW — flat-array builder + splice helpers for expansions
├── components/transcript/
│   ├── Transcript.tsx              # Continues to host the single react-virtuoso list
│   ├── TurnHeader.tsx              # NEW or extended — collapsed summary with sticky badges
│   ├── AttachmentRow.tsx           # NEW — 22 variants
│   ├── SystemEventRow.tsx          # NEW — api_error retry chains, turn_duration, away_summary
│   ├── InlineStateChange.tsx       # NEW — non-sticky state events (queue-op, pr-link, file-history-snapshot)
│   ├── UnknownRow.tsx              # NEW — degraded card (FR-007)
│   └── blocks/
│       ├── BlockToolCall.tsx       # Already exists — extend with sidecar tab
│       ├── BlockToolResult.tsx     # Already exists — render LLM-visible + structured-sidecar tabs
│       ├── BlockAgentRollup.tsx    # NEW — AgentRollupResultSchema (schema.ts:400-424)
│       ├── BlockStructuredPatch.tsx# NEW — EditResult/MultiFileResult diffs (schema.ts:320-358)
│       ├── BlockAskUserQuestion.tsx# NEW — Q&A (schema.ts:451-470)
│       └── BlockImage.tsx          # NEW — lazy image rendering across 3 paths
├── components/summary/
│   └── SessionSummary.tsx          # NEW — session-summary surface (FR-026)
├── components/nav/
│   └── PromptAnchorList.tsx        # NEW — within-session table of contents (FR-018)
├── state/
│   └── sessionViewStore.ts         # NEW or extended — Zustand slice for disclosure / mode toggles (see §4)
└── lib/
    └── splitRequest.ts             # Already present (see git status) — review for compatibility
```

**Structure Decision**: Monorepo layout already established in 006. No structural change; new files slot into existing directories.

---

## §1. Data-flow audit

For every top-level row type in `schema.ts`, what the server returns today vs. what the UI renders today vs. the gap.

| Schema row | `schema.ts` line | Server returns today | UI renders today | Gap |
|---|---|---|---|---|
| `user` | 850 | Yes — projected into `SessionTurn.prompt` (`useSessionView.ts:280-303`) | Yes — `UserPrompt.tsx` | Attachment rows with matching `promptId` are not consistently joined as attachments of that submission (FR-009). `toolUseResult` on user rows ignored when present. |
| `assistant` | 877 | Yes — projected into `Request.blocks` | Yes — `BlockText`, `BlockThinking`, `BlockDiff`, plus new `BlockToolCall`/`BlockToolResult` (see git status) | Block coverage limited to 4 kinds; sidecar from `toolUseResult` (schema.ts:273-577) is dropped during projection (`normalizer.ts`). |
| `system` | 920 | Partial — only `turn_duration` and `api_error` partially feed `tokenSeries` projection (`packages/shared/src/projections/token-series.ts`) | Not surfaced as inline timeline events | All 6 subtypes (`stop_hook_summary`, `turn_duration`, `away_summary`, `local_command`, `api_error`, `informational` — `schema.ts:910-917`) need inline rendering; api_error retry chain assembly (FR-017) is missing. |
| `attachment` | 952 | Partially projected as `SessionTurn.attachments: Attachment[]` but only as `kind: 'tool_result'` shim (`useSessionView.ts:288`) | Not rendered as their actual subtype | All 22 payload variants (`schema.ts:585-820`) need first-class rendering (FR-003). |
| `ai-title`, `custom-title`, `agent-name` | 962-978 | Yes — sidebar reads these for title (out of scope per Assumptions) | Yes — sidebar (out of scope) | No new work; verify the new schema-aware loader doesn't break sidebar. |
| `permission-mode` | 993 | **Not** in `SessionDetailResponse` today | Not rendered | **STICKY** per FR-027 — need carry-forward projection + per-turn badge + session-summary entry. |
| `last-prompt` | 1001 | No | Not rendered | Low-value; can render in session-summary as "last known prompt" or skip entirely. |
| `pr-link` | 1010 | No | Not rendered | Inline event + session-summary entry (FR-005, FR-026). |
| `worktree-state` | 1021 | No | Not rendered | **STICKY** per FR-027 — per-turn badge + session-summary entry. |
| `queue-operation` | 1041 | No | Not rendered | Non-sticky inline event. |
| `file-history-snapshot` | 1051 | Partially — `fileTouchIndex` projection (`packages/shared/src/projections/file-touch.ts`) aggregates touched-files list | Session sidebar / overlay only | Inline visibility at the row's point in time + new endpoint for fetching specific backup blob (FR-014). |
| `unknown` (UnknownRow fallback) | 1107 | Not produced today; legacy parser would discard | Would currently crash or be invisible | Render as degraded card (FR-007). |

**Tool-result sidecars** (cross-cutting, applies to every `tool_use` → `tool_result` pair):

| Tool result type | `schema.ts` line | Today | Gap |
|---|---|---|---|
| `BashResult` | 284 | LLM-visible string only | Surface `interrupted`, `isImage`, `sandbox`, `persistedOutputPath` (off-loaded blob fetch) |
| `ReadFileResult` | 304 | LLM-visible only | Surface `filePath`, `numLines`, `startLine`, `totalLines`, `imagePreviewSize`, `type` |
| `EditResult` | 320 | LLM-visible only | Surface `structuredPatch` hunks, `oldString`/`newString` — the big learning win |
| `WriteResult` | 333 | LLM-visible only | Surface `filePath`, `content`, `structuredPatch` |
| `MultiFileResult` | 346 | LLM-visible only | Surface per-file patches |
| `TaskCreate/Update/List` | 361-397 | LLM-visible only | Surface task lifecycle |
| `AgentRollupResult` | 400 | Partially — subagent endpoint exists (`routes.ts:191-229`) but rollup fields not all rendered on parent's Agent tool_use | Surface `totalDurationMs`, `totalTokens`, `toolStats` next to the parent's Agent invocation (FR-012) |
| `AgentLaunchResult` | 427 | LLM-visible only | Surface `outputFile` (async output streaming path) |
| `AskUserQuestionResult` | 451 | LLM-visible only | Surface questions + answers structurally |
| `WebSearchResult`, `WebFetchResult` | 483-510 | LLM-visible only | Surface structured fields |
| Others (ExitPlan, ToolSearch, SlashCommand, CommandPermission, ExitWorktree) | 473-543 | LLM-visible only | Surface fields per spec rule "exposure beats visual quiet" |

**Images** (FR-006, per `README.md` §10 line 713): three locations — inline in prompt, inside `tool_result` content arrays, base64 in Bash stdout when `isImage: true` (schema.ts:298). UI today renders none as images.

**Off-loaded outputs** (FR-013): `BashResult.persistedOutputPath` (schema.ts:298). No current endpoint to fetch the file; no UI control to request it.

**File-history backup blobs** (FR-014): `FileHistorySnapshotRow.snapshot.trackedFileBackups[path].backupFileName` (schema.ts:1051). Index is sent today via the file-touch projection but no endpoint serves individual backup blobs.

**Live-tail parity** (FR-025): the SSE pipe (`routes.ts:237-301`) sends `Turn[]` — i.e., already parsed. The new schema-aware projection runs over incoming rows the same way as over batch-loaded rows. **No live-tail-specific code path required**; verified during implementation by replaying a captured live session into the pipe.

---

## §2. Grouping model

**Decision**: Two-level grouping. Outer = **per user submission** keyed by `promptId`. Inner = **per LLM call** keyed by `requestId` (or `message.id` for older rows that pre-date `requestId`).

**Why**: The current UI already uses this two-level shape (`SessionTurn` containing `Request[]` in `useSessionView.ts:280-303`). It serves both user jobs: an outer Turn matches the user's mental model of "what I asked for and what happened"; the inner Request decomposes the response into LLM calls so usage de-duplication (FR-015) lands naturally on the inner key. README §2.3 (line 116) explicitly endorses this split.

**Assembly rules** (canonical, see data-model.md for type signatures):

1. **Anchor**. Each `user` row whose `promptId` is non-null begins a new outer Turn. User rows whose only role is to carry `tool_result` content (no new prompt text) attach to the most recent open Request as tool-result blocks, not as a new Turn.
2. **Attachments**. `attachment` rows are attributed to the Turn whose `promptId` matches the attachment's `promptId` (or, if absent, to the Turn anchored by the closest preceding user row in the same conversation). They render as attachment-summary rows immediately after the user prompt and before the first Request.
3. **Requests**. `assistant` rows are grouped by `requestId` (or `message.id`); each group is one Request and belongs to the open Turn (matched via `parentUuid` chain or the lexically nearest open Turn).
4. **Tool-call/result pairing**. Each `tool_use` content block in an assistant row pairs with its `tool_result` block (in a later user-role row with matching `tool_use_id`) within the same Request. The result's `toolUseResult` sidecar (when present) attaches to the same Block.
5. **System rows**. `system` rows are placed at their timestamp position within the timeline — typically inside the Turn they fall under (between Requests or after the last Request).
6. **Session-state rows**. Non-sticky ones (`queue-operation`, `pr-link`, `file-history-snapshot`) render as inline-state-change rows at their timestamp. Sticky ones (`permission-mode`, `worktree-state`, plus `attachment` subtypes `auto_mode`, `plan_mode`, etc., and the `model` field on assistant rows) feed the sticky-state projection — they DO NOT render their own inline row by default (they are visible as per-Turn badges); a session-summary entry captures their transitions.
7. **Unknown rows**. Render as a degraded card at their timestamp position; do not abort assembly.

The canonical sticky set (per FR-027): `permission-mode`, model identifier (read from `assistant.message.model`), `auto_mode` / `plan_mode` attachments, `worktree-state`. Researched in detail in research.md.

---

## §3. Information surface inventory

Table maps every surfaced element to its schema source, primary user job (R=Recall, L=Learning, A=Audit), and disclosure level (V=always visible, E=expandable, M=behind mode toggle/filter).

| Surface element | Schema source | Job | Disclosure |
|---|---|---|---|
| Prompt text on collapsed turn | `user.message.content` | R | V |
| Turn timestamp | `user.timestamp` | R | V |
| Tool count + summary status on collapsed turn | derived from `assistant.message.content` tool_use blocks | R | V |
| Final assistant message snippet on collapsed turn | last text block in last Request | R | V |
| Sticky-state badges (permission-mode, model) | sticky-state projection | R/L/A | V |
| Per-Turn expand → all blocks | full Request[] | R | E (default collapsed) |
| Tool inputs | `tool_use.input` | L | E |
| Tool result LLM-visible payload | `tool_result.content` | L | E |
| Tool result structured sidecar (Edit patch, Agent rollup, Bash flags, etc.) | `toolUseResult` (`schema.ts:273-577`) | L | E |
| Off-loaded output blob | `BashResult.persistedOutputPath`; new endpoint | L | E (lazy fetch) |
| Subagent rollup summary (durations, tokens, toolStats) | `AgentRollupResult` (`schema.ts:400-424`) on parent's Agent tool_use | L/A | V (on parent's tool_use line) |
| Drill-in to subagent transcript | existing `/api/sessions/:id/subagents/:agentId` | L | E (separate view; back-button preserves parent scroll) |
| Attachment payloads (22 variants) | `attachment.attachment` (`schema.ts:585-820`) | L | E (filterable in mode M) |
| System events — api_error retry chain | sequence of `system` rows with `subtype:'api_error'` | A | V (chained inline) |
| System events — turn_duration / stop_hook_summary / away_summary | `system` subtypes | L/A | V |
| Inline state changes — queue-operation, pr-link, file-history-snapshot | `schema.ts:1041-1079` | L/A | V |
| File-history backup blob | `FileHistorySnapshotRow.snapshot.trackedFileBackups[].backupFileName`; new endpoint | A | E (lazy fetch) |
| Images (3 paths) | `README.md:713` enumerates | R/L | E (thumbnail by default; full-size on click) |
| Per-Request usage block (cache split) | `UsageBlock` (`schema.ts:97-128`) | A | E (numeric chip; expand for breakdown) |
| Session-summary: token totals (de-duplicated) | fold over rows by `message.id` | A | V (on summary surface) |
| Session-summary: cache hit rate | from de-duplicated usage | A | V |
| Session-summary: files-touched list | `fileTouchIndex` projection | A | V |
| Session-summary: PR links | `pr-link` rows | A | V |
| Session-summary: queue ops | `queue-operation` rows | A | V |
| Session-summary: error-retry-chain count | folded api_error sequences | A | V |
| Session-summary: harness-state transitions | sticky-state projection (transitions only) | L/A | V |
| Unknown-row degraded card | `UnknownRowSchema` (`schema.ts:1107`) | — | V |

"Mode toggle / filter" surface (M): see research.md for the default-disclosure-level decision. Initial default is `recall` — most expandable content is collapsed; sticky badges, prompt text, summary status, and final-message snippet are always visible.

---

## §4. State and view modes

**Zustand slice** (new file `packages/ui/src/state/sessionViewStore.ts`, or extension of any existing slice):

```ts
type DisclosureLevel = 'recall' | 'learn' | 'audit'

interface SessionViewState {
  // Per-session (resets when session re-opens)
  expandedTurnIds: Set<string>
  expandedRequestIds: Set<string>
  expandedBlockIds: Set<string>          // tool_use / attachment / system-event expansion
  focusedTurnId: string | null           // for scroll-restore + URL fragment sync
  sessionSummaryOpen: boolean

  // Global (persist across reloads via localStorage)
  defaultDisclosureLevel: DisclosureLevel  // controls initial collapsed-ness on session open
  showAttachments: boolean                  // filter — hides attachment rows when false
  showSystemEvents: boolean                 // filter — hides system event rows when false
  showInlineStateChanges: boolean           // filter — hides queue-op / pr-link / file-history inline rows

  // Cross-cutting
  searchQuery: string                       // navigation affordance (FR-018)
}
```

**Persistence rules**:
- Per-session state: NOT persisted. Reopening a 10k-row session with half-expanded turns is more confusing than starting fresh.
- Global toggles (`defaultDisclosureLevel`, three `show*` filters): persisted in `localStorage` under `cc-tx-viewer:session-view:v1`. Versioned key so schema changes invalidate cleanly.
- `focusedTurnId`: NOT persisted in localStorage; serialised to URL fragment `#turn=<turnId>` for deep links.
- `searchQuery`: NOT persisted.

**Scroll preservation** (FR-020, SC-007): every state mutation that changes the flat-row array must run through the splice helper in `useFlatRows`, which uses stable `RowId`s. react-virtuoso's `computeItemKey` keeps scroll position automatically across splices.

**Mode toggle UI**: out of scope for this plan — design brief owns it. The store shape supports any UI: a three-position segmented control, a slash-command palette, a keyboard shortcut, or a side inspector that toggles `defaultDisclosureLevel`. Implementation note: when `defaultDisclosureLevel` changes, do NOT mass-mutate `expandedTurnIds` — the per-row visibility check consults both inputs.

---

## §5. Virtualization plan

**Single flat-row array, stable IDs, splice-based mutation.** Confirms react-virtuoso pattern from `CLAUDE.md`.

```ts
type RowId = string

type RowItem =
  | { id: RowId; kind: 'turn-header';            turnId: string; sticky: StickyState }
  | { id: RowId; kind: 'attachment-summary';     turnId: string; attachmentId: string }
  | { id: RowId; kind: 'request';                turnId: string; requestId: string; collapsed: boolean }
  | { id: RowId; kind: 'block';                  turnId: string; requestId: string; blockId: string }
  | { id: RowId; kind: 'tool-detail-expanded';   turnId: string; requestId: string; toolUseId: string }
  | { id: RowId; kind: 'system-event';           turnId: string; eventId: string }
  | { id: RowId; kind: 'inline-state-change';    turnId: string; stateChangeId: string }
  | { id: RowId; kind: 'unknown-row';            rowUuid: string }
  | { id: RowId; kind: 'subagent-rollup';        turnId: string; requestId: string; toolUseId: string; rollup: AgentRollupResult }
```

**RowId derivation** is deterministic from underlying UUIDs in the schema so that re-renders preserve identity:

```ts
`turn:${turnId}:header`
`turn:${turnId}:attach:${attachmentId}`
`turn:${turnId}:req:${requestId}:header`
`turn:${turnId}:req:${requestId}:block:${blockId}`
`turn:${turnId}:req:${requestId}:tool:${toolUseId}:detail`
`turn:${turnId}:system:${eventId}`
`turn:${turnId}:state:${stateChangeId}`
`unknown:${rowUuid}`
`turn:${turnId}:req:${requestId}:tool:${toolUseId}:rollup`
```

**Splice operations**:
- Expand Turn: insert `{request}` and (recursively, if Request is auto-expanded) `{block}` rows after the `{turn-header}`.
- Collapse Turn: remove rows whose `id` starts with `turn:${turnId}:` except the header.
- Expand tool_use: insert one `{tool-detail-expanded}` row after the matching `{block}`.
- Toggle a filter (`showAttachments` etc.): re-fold from base row stream; reuse the same RowIds for unchanged rows.

**The builder is pure**: `(rows, expansionSet, filters, sticky) → RowItem[]`. Memoise with `useMemo` keyed on those four. react-virtuoso's `computeItemKey={item => item.id}` keeps scroll position whenever IDs are unchanged.

**Scroll position guarantee** under live-tail: new rows append at the end. Existing IDs unchanged → react-virtuoso preserves user's scroll position. Bottom-auto-follow is opt-in (existing behavior; preserved).

---

## §6. Server contract changes

The full contract delta lives in `contracts/ui-backend.md`. Summary of changes from the 006 contract (`specs/006-ui-rewrite-v4/contracts/ui-backend.md`):

**(a) Wire format for rows**: parsed objects, not raw lines. Already the case (`routes.ts:120-162`, `routes.ts:237-301`). Keep it; the UI must not parse JSONL.

**(b) `SessionDetailResponse` shape extends, does not change**: add fields `rows: ClaudeRow[]` (full schema-typed rows pass-through), keeping the existing `turns` field for backwards-compatibility during chunk-by-chunk migration. Once UI fully migrates to `rows`, `turns` may be removed (later feature).

**(c) Subagent endpoint**: unchanged externally (`/api/sessions/:id/subagents/:agentId`, `routes.ts:191-229`). Internally extended same way as `SessionDetailResponse`.

**(d) NEW endpoint — off-loaded tool-result blob** (FR-013):
```
GET /api/sessions/:id/tool-results/:filename
  → 200 text/plain (stream)
  → 404 { error } if missing
```
`:filename` MUST match `^[0-9a-fA-F-]{36}\.txt$` (UUID + .txt). Resolved path MUST live under `<sessionDir>/tool-results/`. Reuse `isSafeSessionId` (`routes.ts:64-70`) as defense template.

**(e) NEW endpoint — file-history backup blob** (FR-014):
```
GET /api/sessions/:id/file-history/:backupFileName
  → 200 application/octet-stream (stream)
  → 404 { error } if missing
```
`:backupFileName` MUST match the schema's emitted name pattern. Resolved path MUST live under `<sessionDir>/file-history-snapshots/`.

**(f) Live-tail endpoints unchanged externally** (`/api/live/:sessionId`, `/api/live/:sessionId/subagents/:agentId`). Internal projection now produces richer rows; SSE event payload (`turns: Turn[]`) accommodates the wider Turn shape automatically since wire is JSON.

**(g) Search endpoints unchanged externally** (`/api/search`). Internal FTS5 index extended — see §8.

**(h) Optional NEW endpoint — pagination** (DEFER unless validation shows necessity):
```
GET /api/sessions/:id/rows?offset=N&limit=M
```
Only ship if a session detail response exceeds ~10 MB JSON. Validation in Chunk A measures this.

**(i) `SessionSummary` is NOT a new endpoint.** Built client-side from the rows already in `SessionDetailResponse`. Justification: avoids server-side duplication of fold logic; keeps the wire-format invariant ("rows are the truth, everything else is a projection"). If summary computation cost on client becomes a measurable problem (>50 ms for 10k rows), move to server; defer until measured.

---

## §7. Performance and cost budget

**Wire budget** per session detail response:

| Component | Size estimate (worst case in corpus) | Status |
|---|---|---|
| Parsed rows (all schema fields except large blobs) | ~50 MB JSON for 145 MB JSONL | Acceptable for single response; revisit if measured slow. |
| Inline images (base64) | Variable; up to several MB per image | **Excluded from initial response.** Replaced with fetchable path; `BlockImage` lazy-fetches. |
| Off-loaded tool-result content | None inline (already on disk) | Lazy via new endpoint. |
| File-history backup blob contents | None inline | Lazy via new endpoint. |
| `toolUseResult` structured sidecars | ~37 MB across the corpus, much less per individual session | Inline — small per row, fits memory budget. |

**Eager vs lazy**:
- EAGER: row metadata, attachment payloads (small), structured sidecars (small per row), usage blocks, session-state rows.
- LAZY: image bytes (base64 stripped from inline; fetched via path), off-loaded tool outputs, file-history backup blobs, subagent transcripts (already lazy via separate endpoint).

**Server-side pagination** (FR-021 cold-start): defer unless measurement on Chunk A shows the 10 MB threshold breached on the corpus's largest session. If breached, ship `/api/sessions/:id/rows?offset&limit` and convert the UI loader to streaming chunks.

**Client-side budget**:
- Flat-row array size on biggest session: ~10k user turns × small expansion footprint. Below react-virtuoso's documented comfort zone (50k+).
- Sticky-state projection: single linear pass, O(rows). One-shot at load; incremental update during live-tail (carry-forward state lives in the Zustand store as a Map<turnId, StickyState>).
- Session-summary projection: also single pass; ~30 ms target on 10k rows.

**Memory**: constitution requires <500 MB RSS for one 10k-message session. Parsed rows in memory ~50 MB; UI flat array ~5 MB. Comfortable headroom.

---

## §8. Search and navigation

**FTS5 index scope**:
- TODAY (`packages/server/src/search/search-index.ts`): prompt text + assistant text only.
- THIS FEATURE: **add** tool inputs (JSON serialised to a flat text blob, just for indexing), attachment payload text, and structured sidecar headline fields (e.g., file paths from `EditResult`, error messages from `api_error`). DO NOT index full sidecar bodies — they're large and add little findability.
- Tokenizer remains trigram (per `CLAUDE.md`); enables partial-match search.

**Search hit shape**: continue returning `{ sessionId, rowUuid, snippet }`. Client maps `rowUuid` → `turnId` via the loaded session's row index, then jumps to that Turn via the existing focused-turn mechanism.

**Navigation affordance** (FR-018):
- **Search palette** (existing `/api/search`): primary affordance.
- **Prompt-anchor list** (NEW `PromptAnchorList.tsx`): a slim column or modal listing every Turn's prompt first-line + timestamp. Click jumps to the Turn. Implementation: derive from the same `RowItem[]` filtered to `kind: 'turn-header'`. Renders virtualised too, since 10k turns is the realistic upper bound.
- **URL fragment** `#turn=<turnId>`: deep-link / share support. Already feasible — react-virtuoso supports `scrollToIndex`.

**Cross-session search** is unchanged from 006 — that's the session sidebar's concern, out of scope here.

---

## §9. Scope ladder

Each chunk delivers a user-visible improvement and leaves the build green. Ship in order; later chunks build on earlier.

### Chunk A — Schema parsing parity (P1 Recall non-regression; minimum viable cut)
**User-visible delta**: Sessions that today partially load now load with no row types silently dropped. Unknown row types appear as degraded cards instead of vanishing. Live-tail behavior unchanged.

**Work**:
- Server `normalizer.ts`: replace ad-hoc parsing with `schema.ts` validators; emit `ClaudeRow[]` on the wire alongside existing `Turn[]`.
- Server `routes.ts`: thread `rows` field through `/api/sessions/:id`, subagent endpoint, and live-tail SSE event payloads.
- UI `useSessionView.ts`: continue to project the existing `SessionTurn[]` from rows; add the new `RowItem` flat-array builder as the primary render path; render unknown row types via `UnknownRow.tsx`.
- Tests: every corpus session loads; unknown-row synthetic test passes (SC-009).

**Done when**: SC-001, SC-008, SC-009 pass; cold-start time on the largest corpus session is measured (baseline for SC-006).

### Chunk B — Tool sidecar surfacing (P2 Learning; the big win)
**User-visible delta**: Expand any tool result and see the structured sidecar — Edit hunks, Agent rollup stats, Bash off-loaded link, Q&A, etc. The previously-discarded ~37 MB of structured data becomes reachable (SC-002).

**Work**:
- UI `BlockToolResult.tsx`: dual-pane (LLM-visible | structured sidecar tabs).
- UI `BlockStructuredPatch.tsx`: render Edit/Write/MultiFile patches.
- UI `BlockAgentRollup.tsx`: render `AgentRollupResult` summary on parent's tool_use (FR-012).
- UI `BlockAskUserQuestion.tsx`: Q&A.
- Server NEW endpoint `/api/sessions/:id/tool-results/:filename` (FR-013).
- UI BashResult expansion lazy-fetches off-loaded blobs.

**Done when**: SC-002, SC-010 pass.

### Chunk C — Attachments + system events + images (P2 Learning)
**User-visible delta**: Attachment payloads (skill listings, deferred-tool deltas, hook events, etc.) render with type-specific UI. System events (api_error retry chains, turn_duration, away_summary) appear inline. Images render across all three paths.

**Work**:
- UI `AttachmentRow.tsx`: dispatch on attachment subtype to 22 variant renderers (most are small label+payload cards; a few merit specialised UI — task_reminder, skill_listing, hook events).
- UI `SystemEventRow.tsx`: retry-chain assembler + per-subtype renderer.
- UI `BlockImage.tsx`: lazy image rendering with thumbnail-by-default.

**Done when**: SC-011, FR-003, FR-004, FR-006 pass.

### Chunk D — Sticky state + non-sticky inline events (P3 Audit + L)
**User-visible delta**: Every Turn shows the harness configuration in effect at that moment (permission mode, model, plan/auto, worktree state). Queue ops, PR links, file-history snapshots appear inline where they occurred.

**Work**:
- UI `useStickyState.ts`: single linear pass producing `Map<turnId, StickyState>`.
- UI `TurnHeader.tsx`: render sticky badges.
- UI `InlineStateChange.tsx`: render non-sticky events.

**Done when**: SC-012 passes.

### Chunk E — Session-summary surface + file-history blobs (P3 Audit)
**User-visible delta**: A reachable session-summary view shows token totals (de-duplicated), cache split, files-touched list, PR links, error count, harness-state transition timeline. Backup blobs are fetchable from the file-history list.

**Work**:
- UI `components/summary/SessionSummary.tsx`: pure projection over `ClaudeRow[]`.
- Server NEW endpoint `/api/sessions/:id/file-history/:backupFileName` (FR-014).
- Token de-duplication helper (FR-015) — shared util in `packages/shared/`.

**Done when**: SC-004, SC-005, SC-013, FR-014, FR-015, FR-016, FR-017 pass.

### Chunk F — Search expansion + within-session navigation (cross-cutting)
**User-visible delta**: Search finds matches in tool inputs, attachment payloads, error messages. The prompt-anchor list provides a table-of-contents navigation column.

**Work**:
- Server `search-index.ts`: extend FTS5 indexing scope per §8.
- Server search-index reconciler: reindex on schema-aware row stream.
- UI `PromptAnchorList.tsx`: virtualised TOC.
- UI search-result jump: rowUuid → turnId mapping.

**Done when**: SC-003 passes (locate a specific submission in <10 s).

**Minimum viable cut**: Chunks A + B. After these two, P1 Recall is non-regressed AND the biggest learning win (sidecar surfacing) has landed.

**"Done" stopping point**: through Chunk F. Anything beyond — cross-session totals, export, advanced analytics — is a future feature.

---

## §10. Open questions

Resolved in research.md unless explicitly deferred to design.

1. **Default disclosure level on session open**: spec says "recall by default" — research.md confirms `recall` value. Design owns the toggle UI.
2. **Mode toggle UI affordance**: deferred to design brief (`.design/v6-brief.md`).
3. **Image rendering default**: thumbnail-by-default for images >256 KB; inline-by-default for smaller ones. Final pixel choice deferred to design.
4. **Pagination threshold**: defer to measurement (Chunk A baselining produces the data).
5. **AskUserQuestion sidecar fidelity**: render Q&A inline structurally; truncate per-answer to ~3 lines with expansion. Final visual deferred to design.
6. **Forward-compat for new sticky-state event types**: research.md captures the rule for adding to the canonical sticky set.

---

## Complexity Tracking

*Empty — no Constitution violations.*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| — | — | — |
