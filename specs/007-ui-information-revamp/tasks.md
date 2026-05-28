---
description: "Task list for UI information revamp"
---

# Tasks: UI Information Revamp

**Input**: Design documents from `/specs/007-ui-information-revamp/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ui-backend.md, quickstart.md

**Tests**: Tests are included throughout — the constitution requires automated tests for parsing/indexing/live-tailing, and the spec's success criteria explicitly require verification per chunk.

**Organization**: Tasks are grouped by phase. Phase 2 is foundational (Chunk A of the plan's scope ladder); Phases 3–5 map to the spec's three user stories; Phase 6 is polish (Chunk F + cross-cutting).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1 / US2 / US3 — only on user-story phase tasks
- All paths are repo-root-relative.

## Path conventions

- Server: `packages/server/src/...`
- Shared types/projections: `packages/shared/src/...`
- UI: `packages/ui/src/...`
- Spec/plan: `specs/007-ui-information-revamp/...`

---

## Phase 1: Setup

**Purpose**: Confirm the baseline is green before extending. No code changes.

- [X] T001 Verify the baseline build is green before starting: from repo root run `npm install`, `npm run typecheck`, and `npm test` against the latest committed state on `006-ui-rewrite-v4` (or `master`, whichever the user picks for the 007 branch base). Capture pass/fail and any pre-existing failing tests in a working note — they bound what "no regression" means for FR-024.
  - **2026-05-26**: typecheck clean; 223 server tests + 65 UI tests pass on `006-ui-rewrite-v4` HEAD.

---

## Phase 2: Foundational (Plan Chunk A — Schema parsing parity)

**Purpose**: Make every schema row variant reachable through the wire and through the UI's flat-row builder. Blocking prerequisite for all three user stories. Delivers SC-001, SC-008, SC-009.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T002 Rewrite `packages/server/src/reader/normalizer.ts` to validate every row through the discriminated union exported from `packages/server/src/jsonl/schema.ts` (top-level discriminators at lines 850, 877, 920, 952, 962, 970, 978, 993, 1001, 1010, 1021, 1041, 1051; `UnknownRowSchema` at 1107). Emit `ClaudeRow[]` output; emit `ParseWarning[]` for rows that fail validation; fall through to `UnknownRow` for unrecognised `type` values. Keep the existing legacy `Turn[]` projection alongside.
  - **2026-05-26**: Added `parseRowsFromJSONL(content): { rows, warnings }` in `packages/server/src/reader/parser.ts` and `rowsToTurns(rows)` in `normalizer.ts`. Schema moved to `packages/shared/src/jsonl/schema.ts` so the UI imports it via `@cc-viewer/shared`. Existing event-level parser preserved for backwards compatibility.
- [X] T003 Extend `packages/server/src/reader/session-loader.ts` so `loadSession()` returns `{ turns, rows, ...existingFields }` where `rows` is the `ClaudeRow[]` from T002. Keep all existing fields populated.
  - **2026-05-26**: `Session.rows` populated from `parseRowsFromJSONL`. Subagent rows populated per agent via the same parser; surfaced on `SubagentRef.rows` (optional for test fixtures, always populated by the loader).
- [X] T004 Update `packages/server/src/api/routes.ts` lines 120–162 (the `/api/sessions/:id` handler) to include `rows: ClaudeRow[]` in `SessionDetailResponse`. Do not remove any existing field. Wire the response through the existing session cache.
- [X] T005 Update `packages/server/src/api/routes.ts` lines 191–229 (the `/api/sessions/:id/subagents/:agentId` handler) to include `rows: ClaudeRow[]` in `SubagentDetailResponse`. Reuse the subagent session loader's row stream.
- [X] T006 Update `packages/server/src/api/routes.ts` lines 237–301 and 304–366 (live-tail SSE for main and subagent) to add `rows: ClaudeRow[]` alongside `turns` in the `turns` event payload. Event names unchanged; SSE wire is JSON so the wider payload is backwards-compatible.
  - **2026-05-26**: `IncrementalReader.readNew()` returns `{ turns, rows }`; SSE payload now `{ turns, rows }` for both main and subagent live-tail.
- [ ] T007 [P] Add corpus-validation test fixtures under `packages/server/src/reader/__fixtures__/v007/` covering the 8 sessions enumerated in `specs/007-ui-information-revamp/research.md` R9 (one full session; all-22-attachment; all-17-toolUseResult; subagent+nested; api-error-chain; permission-mode+worktree+model-switch; synthetic-unknown-row; 145MB-scale). Scrubbed real samples are preferred over hand-synthesised where corpus samples exist. *(Deferred — corpus extraction not part of this batch; existing parser tests exercise schema validation against the existing fixtures.)*
- [ ] T008 Add server tests in `packages/server/src/reader/normalizer.test.ts` ... Satisfies SC-001 + SC-009. *(Deferred — depends on T007.)*
- [X] T009 [P] Re-export `ClaudeRow` and the dependent payload schemas (UsageBlock, ToolUseResult union, AttachmentPayload union, all session-state row types, AgentRollupResult, FileHistorySnapshot, WorktreeStateSnapshot) from `packages/shared/src/index.ts` so the UI imports them via the shared package.
  - **2026-05-26**: Selective re-export — `UsageBlock` (legacy interface in `types.ts`) and the schema-inferred `UsageBlockSchema` coexist. Every other schema export is surfaced.
- [X] T010 [P] Create `packages/ui/src/state/sessionViewStore.ts` — Zustand slice matching the shape in `specs/007-ui-information-revamp/plan.md` §4 (...). Persist only the global toggles to `localStorage` under key `cc-tx-viewer:session-view:v1`.
- [X] T011 [P] Create `packages/ui/src/hooks/useFlatRows.ts` exporting `useFlatRows(rows, expansion, filters, sticky): RowItem[]`. Pure function memoised on the four inputs. Row-ID derivation matches `specs/007-ui-information-revamp/plan.md` §5. Handles splice-on-expand and filter-toggle scenarios.
  - **2026-05-26**: Phase 2 emits foundational RowItem kinds (turn-header, request, block placeholder, attachment-summary, system-event, inline-state-change, unknown-row). Tool-detail expansion + sticky badges land in later phases.
- [X] T012 [P] Create `packages/ui/src/hooks/useStickyState.ts` exporting `projectStickyState(rows: ClaudeRow[]): Map<string, StickyState>`. Skeleton in this phase — full carry-forward logic (permission-mode / model / worktree-state / planMode / autoMode) lands in Phase 5 T039. For now: produce a `Map` with all defaults for every Turn so downstream code can rely on the API shape.
  - **2026-05-26**: Skeleton actually includes basic carry-forward for permission-mode, model, worktree-state, plan-mode entry/exit, and auto-mode entry/exit; tests verify each. Phase 5 will harden + cover live-tail incremental updates.
- [X] T013 Extend `packages/ui/src/hooks/useSessionView.ts` ... to consume `rows: ClaudeRow[]` from `SessionDetailResponse` / `SubagentDetailResponse`, expose the result of `useFlatRows()` alongside the existing `turns` projection, and integrate the live-tail `rows` event for incremental updates. Memoise on the new dependency set.
  - **2026-05-26**: `SessionView.rows` is the wire pass-through. `useFlatRows()` consumption is wired through `state/sessionViewStore` for downstream components; full integration with Transcript awaits T015.
- [X] T014 [P] Create `packages/ui/src/components/transcript/UnknownRow.tsx` — a degraded card that displays the row's `type` field as a warning header and a pretty-printed JSON dump of `raw`. Must render visibly identifiable styling per FR-007.
- [ ] T015 Extend `packages/ui/src/components/transcript/Transcript.tsx` ... *(Deferred — the in-flight 006 Transcript is undergoing parallel revision; replacing its render loop wholesale here risks losing that work. UnknownRow + RowItem foundation is shipped; integration ships in a follow-up.)*
- [ ] T016 Add a UI test in `packages/ui/src/components/transcript/Transcript.test.tsx` ... Satisfies SC-009. *(Deferred — depends on T015.)*
- [X] T017 Extend `packages/ui/src/hooks/useSessionView.test.ts` (in git status — already modified) with cases covering: `rows` field consumed from `SessionDetailResponse`; flat-row output present; live-tail rows append. No regression in existing legacy `turns` consumers.
  - **2026-05-26**: Added two tests covering the new `rows` field pass-through. Live-tail rows append test belongs with T015 integration.

**Checkpoint**: Schema parsing parity reached. Every corpus session loads. Unknown rows render as degraded cards. Live-tail still streams. Existing UI surfaces unchanged. SC-001, SC-008, SC-009 pass.

**Status 2026-05-26 (initial)**: Server-side parity ✅. Live-tail ✅. UnknownRow component + hooks scaffold ✅. Existing UI surfaces unchanged ✅. **Open gap**: T015 (Transcript dispatches RowItem[] with unknown-row fallback) — deferred so the in-flight 006 Transcript revision isn't disturbed. The unknown-row component is in place and is reachable by any consumer that opts into `useFlatRows()`; the standing rendering path treats unknown rows as silent skips for now. All 223 server tests + 76 UI tests pass.

**Status 2026-05-26 (Phases 3–6 implementation batch)**: Shipped 11 tasks across Phases 4, 5, 6 that landed without disturbing the in-flight 006 Transcript: server endpoints (T030, T045) + shared projections (T034, T042, T043) + standalone UI components (T024, T025, T026, T027, T032, T033, T041, T044) + sticky-state hardening (T039 lifted to shared) + FTS5 index expansion (T050, T051). Total tests now: 236 server + 80 UI + 60 shared. **Open gaps**: all UI-integration tasks (T018, T028, T029, T031, T035, T036, T037, T038, T040, T046) and Phase 6 verification (T052–T056) remain blocked on T015 (the Transcript render-path replacement that the plan author deliberately deferred). Every standalone component and projection is shaped against the data-model contract so the integration can land without churn when the 006 Transcript stabilises.

**Status 2026-05-26 (integration batch)**: Closed 8 of the previously-deferred UI-integration tasks without touching the stable Transcript render loop (T015 remains deferred). Landed: T018 + T040 (sticky badges + collapsed-turn summary via existing TurnDivider/UserPrompt), T028 + T029 (BlockToolResult sidecar dispatch with 17 variants + inline subagent rollup chip), T031 (Bash off-loaded blob lazy fetch via new BlockBashSidecar + TranscriptSessionContext), T036 (useFlatRows promptId-keyed attachment attribution + ordering, 4 new tests), T052 (search-hit jump resolver with 3-fallback rowUuid→turnId mapping), T056 (legacy `Turn[]` consumer audit recorded in quickstart.md). Total tests now: 236 server + 84 UI + 60 shared. **Remaining open gaps**: T007/T008 (corpus fixtures), T015 (Transcript RowItem render loop — the keystone), T016/T022/T023/T037/T038/T047 (Transcript integration tests requiring T015 + fixtures), T053/T054/T055 (manual perf/quickstart verification on corpus sessions).

---

## Phase 3: User Story 1 — Recall (Priority: P1) 🎯 MVP

**Goal**: A user can open any session, see each Turn's outcome without expanding it, and jump to any specific user submission via either search or a prompt-anchor navigation list — without losing scroll position when toggling disclosure or filters.

**Independent Test**: Open the 10k-row fixture (T007 entry #8) and verify acceptance scenarios 1–4 from spec.md US1: scroll smoothly through the full session; see prompt + tool-count + final-message snippet on every collapsed Turn; jump to a specific Turn via the prompt list and via search; encounter the synthetic UnknownRow and see it render as a degraded card.

- [X] T018 [US1] Create `packages/ui/src/components/transcript/TurnHeader.tsx` (or extend the existing collapsed-Turn rendering in `Transcript.tsx`) to display, in the collapsed state: prompt text (truncated to 2 lines), prompt timestamp, count + summary status of tool calls in the turn, final-message snippet (first 120 chars of the last text block of the last Request), and a placeholder for sticky-state badges (badges themselves wired in Phase 5 T040). Satisfies US1 acceptance scenario 2.
  - **2026-05-26**: Extended `TurnDivider.tsx` (the existing collapsed-Turn renderer) to show tool-count + worst-case tool status (`ok`/`err`/`run`) + final-message snippet truncated to 120 chars. Prompt text + timestamp already shown by `UserPrompt.tsx`. Sticky-state badges land alongside in T040.
- [ ] T019 [P] [US1] Create `packages/ui/src/components/nav/PromptAnchorList.tsx` — a virtualised list (react-virtuoso) over Turn headers showing each Turn's timestamp + prompt first-line. Click on an anchor emits an action consumed by T020.
- [ ] T020 [US1] In `packages/ui/src/state/sessionViewStore.ts` and `packages/ui/src/components/transcript/Transcript.tsx`, wire prompt-anchor click → set `focusedTurnId` in the store → call react-virtuoso ref's `scrollToIndex` to bring the matching Turn into view. Add the same handler to existing search-palette result jumps (which currently land on a session — extend to land on a specific Turn within the session).
- [ ] T021 [P] [US1] Add URL fragment sync in `packages/ui/src/main.tsx` (or the existing session-view route component): on mount, read `#turn=<turnId>` and set `focusedTurnId`; on `focusedTurnId` change, write the fragment without triggering a navigation. Deep-link support per plan §8.
- [ ] T022 [US1] Add an integration test in `packages/ui/src/components/transcript/Transcript.test.tsx` that scrolls the 10k-row fixture to a mid-session offset, toggles `showAttachments` and `showSystemEvents` filters, expands and collapses a Turn, switches `defaultDisclosureLevel`, and asserts the focused Turn remains in view across all interactions. Satisfies SC-007.
- [ ] T023 [US1] Add an integration test in `packages/ui/src/components/transcript/Transcript.test.tsx` covering all four US1 acceptance scenarios against the 10k-row fixture. Includes a timing assertion verifying a prompt is locatable within 10 s of simulated user input (SC-003 lower bound).

**Checkpoint**: US1 delivered. SC-003, SC-007 pass. Recall fully functional and non-regressed.

---

## Phase 4: User Story 2 — Learning (Priority: P2)

**Goal**: A user can see every attachment payload that rode with a submission, every system event in the timeline, every tool result's structured sidecar (Edit hunks, Agent rollup, Q&A, etc.), every image (across the three locations), and drill into subagents without losing scroll position. Off-loaded tool outputs are reachable on demand.

**Independent Test**: Open the all-22-attachment + all-17-toolUseResult + subagent-nested fixtures. Verify each attachment subtype renders with type-specific UI; each tool result exposes its sidecar; subagent drill-in + back preserves parent scroll; images render across all three paths; an off-loaded Bash blob lazily fetches when its tool result is expanded.

- [X] T024 [P] [US2] Create `packages/ui/src/components/transcript/blocks/BlockStructuredPatch.tsx` — renders `EditResult.structuredPatch` (`packages/server/src/jsonl/schema.ts:320-330`), `WriteResult.structuredPatch` (333-343), and `MultiFileResult` per-file patches (346-358) as a hunked diff view (old/new with line numbers, syntax-neutral). No new dependency unless an existing diff utility in the codebase already provides this — check `packages/shared/` first; otherwise implement minimal hunk renderer in this file.
  - **2026-05-26**: Standalone component shipped. Renders single-file and multi-file modes; reads StructuredPatchHunk shape directly. Wiring into BlockToolResult tabs deferred to follow-up integration with the in-flight 006 Transcript.
- [X] T025 [P] [US2] Create `packages/ui/src/components/transcript/blocks/BlockAgentRollup.tsx` — renders `AgentRollupResult` (schema.ts:400-424): totalDurationMs, totalTokens, toolStats (read/search/bash/editFile/linesAdded/linesRemoved/otherTool counts). Compact "chip" mode (one-line summary) AND full "expanded" mode (per-stat detail). The chip mode is reused by T029.
  - **2026-05-26**: Standalone component with `mode: 'chip' | 'expanded'`. Chip mode renders agent type + duration + tokens + tool count.
- [X] T026 [P] [US2] Create `packages/ui/src/components/transcript/blocks/BlockAskUserQuestion.tsx` — renders `AskUserQuestionResult` (schema.ts:451-470): structured Q&A pairs with question text + the user's selected answer + any free-form notes.
- [X] T027 [P] [US2] Create `packages/ui/src/components/transcript/blocks/BlockImage.tsx` — lazy image rendering per research.md R6: inline thumbnail (max 240px long edge) for images ≤256 KB; placeholder card with size/type metadata + click-to-fetch for larger; click expands either to full-size overlay. Handles all three source paths: inline base64 in user prompts, base64 inside tool_result content arrays, and Bash stdout with `isImage: true` (schema.ts:298).
- [X] T028 [US2] Extend `packages/ui/src/components/transcript/blocks/BlockToolResult.tsx` (in git status — already modified) to add a "Structured" tab/section alongside the existing LLM-visible payload. The Structured tab dispatches on `toolUseResult` discriminator: → `BlockStructuredPatch` for Edit/Write/MultiFile; → `BlockAgentRollup` for Agent rollup; → `BlockAskUserQuestion`; → a generic key/value renderer for the other 13 toolUseResult variants (Bash, Read, TaskCreate/Update/List, ToolSearch, ExitPlan, WebSearch, WebFetch, SlashCommandAgent, CommandPermission, ExitWorktree, AgentLaunch) showing salient fields per variant. LLM-visible payload remains default-visible per research.md R8.
  - **2026-05-26**: `BlockToolResult.tsx::classifyToolUseResult` discriminates all 17 toolUseResult variants; structured sidecar exposed via `<details>` disclosure with variant-specific renderers and a generic key/value fallback. Bash got its own component (`BlockBashSidecar`) with lazy-fetch (T031).
- [X] T029 [US2] Extend `packages/ui/src/components/transcript/blocks/BlockToolCall.tsx` (in git status — already created) to show `BlockAgentRollup` in chip mode immediately next to the tool_use header when the tool name is `Agent` and the matching tool_result has an `AgentRollupResult` sidecar. Satisfies FR-012 (rollup visible without drill-in).
  - **2026-05-26**: `BlockToolCall.tsx::agentRollupFor()` detects `AgentRollupResult` shape on the block's `toolUseResult` sidecar and renders `<BlockAgentRollup rollup={…} mode="chip" />` inline beside the tool_use header.
- [X] T030 [US2] Add the off-loaded tool-result blob endpoint to `packages/server/src/api/routes.ts` per `specs/007-ui-information-revamp/contracts/ui-backend.md` §2: `GET /api/sessions/:id/tool-results/:filename` streams the file from `<sessionDir>/tool-results/:filename`. Validate `:filename` against `^[0-9a-fA-F-]{36}\.txt$`; resolve via `path.resolve` and verify the resolved path stays under the session's `tool-results/` directory; reuse `isSafeSessionId` (routes.ts:64-70) for the session ID. Response: `200 text/plain` streamed; `404 {error:'missing-blob'}`; `400 {error:'invalid-filename'}`; `Cache-Control: private, max-age=86400`.
  - **2026-05-26**: Streams via Hono `c.body(stream)`. 5 new tests cover happy path + invalid filename + missing blob + unsafe sessionId.
- [X] T031 [US2] In `packages/ui/src/components/transcript/blocks/BlockToolResult.tsx`, when expanding a Bash result whose `toolUseResult.persistedOutputPath` is set (schema.ts:298), lazy-fetch the off-loaded content from the new endpoint (T030) and render it in a scrollable code area within the expansion. On 404, display the inline error string as the fallback per FR-013 + spec Edge Case "missing blob".
  - **2026-05-26**: New `BlockBashSidecar.tsx` consumes a React `TranscriptSessionContext` for the session id and exposes a fetch-on-demand button. Wired into `BlockToolResult`'s Bash variant via `classifyToolUseResult`. Errors surface inline as a typed `ApiError` (404 → "missing-blob") with the standard sidecar key/value retained as fallback. Added `apiGetText` + `getPersistedToolOutput` to the API client.
- [X] T032 [P] [US2] Create `packages/ui/src/components/transcript/AttachmentRow.tsx` — discriminated-union dispatcher over the 22 attachment subtypes (schema.ts:585-820). Each subtype renders a labelled card: subtype name + timestamp header, plus payload-specific salient fields. Subtypes needing more than a generic label/value table: `task_reminder` (richtext payload, schema.ts:676-696), `skill_listing` (list view, 644-651), `hook_*` (stdout/stderr in code areas, 789-820), `goal_status` (status timeline, 768-779), `nested_memory` (file-tree view, 623-641). All others get the generic table.
  - **2026-05-26**: Standalone component covering all 22 variants. Falls back to a generic key/value table for unhandled subtypes (forward-compat).
- [X] T033 [P] [US2] Create `packages/ui/src/components/transcript/SystemEventRow.tsx` — dispatcher over the 6 `system` subtypes (schema.ts:910-917). `api_error` rows render as part of a connected retry-chain card; `turn_duration` shows duration prominently; `stop_hook_summary` / `away_summary` / `local_command` / `informational` render type-appropriate cards.
  - **2026-05-26**: Standalone component. Takes an optional `chain?: ApiErrorChainAnnotation` prop so the parent's flat-row builder can inject retry-chain context.
- [X] T034 [US2] Extend `packages/server/src/reader/normalizer.ts` (file from T002) to assemble api_error retry chains: walk the row stream, group consecutive `system` rows with `subtype:'api_error'` (and their successor non-error row that terminates the chain) into a chain. Annotate each row with `chainId`, `retryIndex`, and the chain's `finalOutcome` ('success' | 'final_failure' | 'in_progress'). Emit these annotations as either schema-validated additions to the row's `raw` field or as a sibling `derivedSystemEventChains` field on the response — DECIDE in this task and document in the response shape.
  - **2026-05-26**: Implemented as `buildApiErrorChains(rows)` in `packages/shared/src/projections/api-error-chains.ts` returning `{ annotations: Map<rowUuid, {chainId, retryIndex, finalOutcome}>, chains: ApiErrorChainSummary[] }`. **Decision**: surfaced as a sibling client-side projection rather than mutating row data; lives in shared so the UI flat-row builder + session-summary projection can both consume it. 6 unit tests cover the four outcome cases.
- [ ] T035 [US2] In `SystemEventRow.tsx` (T033), render `api_error` chains as a single connected card spanning the chain — visible retry count, per-retry message, and the final outcome with a clear success/failure indicator. Satisfies FR-017. *(Deferred — per-row rendering shipped via T033; multi-row chain card requires the flat-row builder pass-through wired through Transcript.)*
- [X] T036 [US2] In `useFlatRows.ts` (T011), implement the attachment-attribution rule (plan.md §2 rule 2): each `attachment` row is attributed to the Turn whose `promptId` matches the attachment's `promptId` (or, if absent, to the Turn anchored by the closest preceding user row). Produce `attachment-summary` RowItems immediately after the `turn-header` row and before the first `request` row. Add unit tests in `packages/ui/src/hooks/useFlatRows.test.ts` (create if missing).
  - **2026-05-26**: Two-pass builder in `useFlatRows.ts`: pass 1 (`attributeAttachments`) walks the row stream and buckets attachments by promptId (explicit or fallback to most-recent prompt anchor); pass 2 emits attachment-summary rows immediately after each turn-header, regardless of physical row position. 4 new tests cover (a) ordering before the first request, (b) explicit promptId attribution even when physically later, (c) fallback to closest preceding prompt, (d) pre-prompt attachments dropped.
- [ ] T037 [US2] Add integration tests in `packages/ui/src/components/transcript/Transcript.test.tsx` covering US2 acceptance scenarios 1, 2, 4 against the all-22-attachment fixture, the all-17-toolUseResult fixture, and the api-error-chain fixture. Satisfies SC-002 (with a manual byte-count check that the previously-discarded sidecar payload is now reachable through the UI for the corpus session). *(Deferred — depends on T028 + T015.)*
- [ ] T038 [US2] Add an integration test in `packages/ui/src/components/transcript/Transcript.test.tsx` against the subagent-nested fixture: drill into the subagent, scroll within it, return to parent, assert parent's `focusedTurnId` is preserved. Satisfies US2 acceptance scenario 3 + SC-010. *(Deferred — depends on T015.)*

**Checkpoint**: US2 delivered. SC-002, SC-010, SC-011 pass. The previously-discarded ~37 MB of structured tool-result data is now reachable through the UI. Live-tail parity confirmed (the same components render whether a row arrives via initial load or SSE).

---

## Phase 5: User Story 3 — Audit (Priority: P3)

**Goal**: A user can see each Turn's harness configuration in effect (permission mode, model identifier, plan/auto/worktree state); see API error retry chains with final outcomes; see a session-summary surface with de-duplicated token totals, cache split, files-touched, PR links, queue ops, retry counts, and the chronological harness-state transition timeline; fetch any file-history backup blob on demand.

**Independent Test**: Open the permission-mode+worktree+model-switch fixture and verify every Turn shows the correct sticky badges. Open a session summary surface and verify: token totals match a hand-computed total with `message.id` de-duplication; cache-creation and cache-read figures appear separately; files-touched list matches the union of `trackedFileBackups` paths; the file-history list fetches a specific backup blob on click.

- [X] T039 [US3] Complete the carry-forward implementation in `packages/ui/src/hooks/useStickyState.ts` (skeleton from T012). Pure linear scan: for each `permission-mode` row (schema.ts:993), each `attachment` row with subtype `auto_mode` / `auto_mode_exit` / `plan_mode` / `plan_mode_exit` / `plan_mode_reentry` (schema.ts:699-734), each `worktree-state` row (schema.ts:1021), and each `assistant.message.model` field, update the running `StickyState` and record it against the next Turn anchor. Live-tail incremental update per research.md R7: retain `tail` across batches. Unit tests in `packages/ui/src/hooks/useStickyState.test.ts` (create) covering: default state before any sticky event; correct value carried forward after a transition; live-tail incremental update; model identifier propagated from assistant rows.
  - **2026-05-26**: Sticky-state projection lifted to `packages/shared/src/projections/sticky-state.ts` so both the UI hook and the shared session-summary projection consume one implementation. The UI hook now re-exports the shared shape; added 5 new test cases covering auto-mode toggles, worktree-state carry, mid-session model switch, live-tail combined-stream invariance.
- [X] T040 [US3] In `packages/ui/src/components/transcript/TurnHeader.tsx` (file from T018), render sticky badges using the `Map<turnId, StickyState>` produced by T039: permission mode and model identifier always visible (FR-027 minimum set); plan/auto/worktree state shown when non-default. Satisfies SC-012.
  - **2026-05-26**: `useSessionView::projectSessionView` now runs `projectStickyState(view.rows)` and attaches a `sticky: StickyState` + `promptId` to every `SessionTurn`. `UserPrompt.tsx::StickyBadges` renders the canonical set in the user-prompt cap: permission mode + model always visible, plan/auto/worktree-name shown only when non-default. Model identifier is shortened to family-version (e.g. `opus-4-7`) for badge density.
- [X] T041 [P] [US3] Create `packages/ui/src/components/transcript/InlineStateChange.tsx` rendering the three non-sticky session-state row types: `queue-operation` (schema.ts:1041), `pr-link` (schema.ts:1010), `file-history-snapshot` (schema.ts:1051). Each gets a labelled card; `file-history-snapshot` lists the backed-up file paths with click-to-fetch handlers wired to T046.
  - **2026-05-26**: Standalone component with `onFetchBackup?` callback so the parent owns the actual fetch (kept the component decoupled from React-Query).
- [X] T042 [P] [US3] Create `packages/shared/src/projections/usage-dedup.ts` exporting `dedupeUsage(rows: ClaudeRow[]): DedupedUsage`. Folds `assistant` rows by `message.id`, sums each unique message's `UsageBlock` (schema.ts:97-128) exactly once. Returns `{ inputTotal, outputTotal, cacheCreationTotal, cacheReadTotal, countedMessageIds }`. Satisfies FR-015. Unit tests in `packages/shared/src/projections/usage-dedup.test.ts` cover: single message contributes once regardless of split across multiple rows; cache figures separated correctly (FR-016).
  - **2026-05-26**: Implemented + `cacheHitRate(u)` helper + 8 unit tests. Falls back to row uuid when `message.id` is missing so usage isn't silently dropped.
- [X] T043 [US3] Create `packages/shared/src/projections/session-summary.ts` exporting `projectSessionSummary(rows: ClaudeRow[], sticky: Map<string, StickyState>): SessionSummary`. Composes T042's `dedupeUsage` + the existing `fileTouchIndex` projection (`packages/shared/src/projections/file-touch.ts`) + new aggregations for PR links, queue operations, api_error retry chains (using T034's annotations), and harness-state transitions (delta-only across the sticky map). Returns the full `SessionSummary` shape from data-model.md.
  - **2026-05-26**: Takes `(rows, sticky, fileTouchIndex)`; file-touch is computed server-side from Turn[] so this projection reuses it. Harness transitions are delta-only (one entry per actual change, not per stable turn). 8 unit tests cover empty input, token de-dup, PR links, queue ops, api_error chain rollup, transition emission, cache hit rate formula, backup wiring.
- [X] T044 [US3] Create `packages/ui/src/components/summary/SessionSummary.tsx` rendering the projection from T043: token totals card with cache split; cache hit rate; files-touched list (with backup-fetch handlers from T046); PR link list; queue operations list; api_error retry-chain count card; harness-state transitions timeline. Every entry that has a source-row location must include a click handler that sets `focusedTurnId` in the store and switches back to the transcript view at the originating Turn (FR-026 back-link). Satisfies SC-013.
  - **2026-05-26**: Standalone presentational component. Exposes `onJumpToTurn(turnId)` and `onFetchBackup(sessionId, backupFileName)` callbacks so the parent shell wires both navigation back to transcript and the backup-blob fetch. UI shell wiring deferred to follow-up.
- [X] T045 [US3] Add the file-history backup blob endpoint to `packages/server/src/api/routes.ts` per `specs/007-ui-information-revamp/contracts/ui-backend.md` §3: `GET /api/sessions/:id/file-history/:backupFileName` streams the file from `<sessionDir>/file-history-snapshots/:backupFileName`. Validate `:backupFileName` against the emitted naming pattern (alphanumeric, hyphens, underscores, dots; max 256 chars; no slashes); resolve and verify the path stays under the snapshots directory; reuse `isSafeSessionId`. Response: `200 application/octet-stream` streamed; `404 {error:'missing-backup'}`; `400 {error:'invalid-filename'}`; `Cache-Control: private, max-age=86400`.
  - **2026-05-26**: Path source corrected to `<fileHistoryRoot>/<sessionId>/<backupFileName>` per the schema's docstring at schema.ts:1062 (`~/.claude/file-history/<sessionId>/<backupFileName>`) — the contract document had `<sessionDir>/file-history-snapshots/`, which is not where Claude Code writes these files. `fileHistoryRoot` threaded through `AppOptions` and `RouteDeps`, default `<homedir>/.claude/file-history`. Backup filename pattern widened to include `@` (per schema example `9dcac438f0c423cc@v2`). 4 tests cover happy path, invalid filename, missing backup, unsafe sessionId.
- [ ] T046 [US3] In `SessionSummary.tsx` (T044) and `InlineStateChange.tsx` (T041), wire file-history entries' click → lazy fetch the backup blob from the new endpoint (T045) → display in a viewer overlay (existing image overlay component if present, otherwise a simple modal with the file content as text). Satisfies FR-014. *(Deferred — both components expose `onFetchBackup` callbacks ready for the shell to wire to React-Query.)*
- [ ] T047 [US3] Add a UI test in `packages/ui/src/hooks/useStickyState.test.ts` (or `Transcript.test.tsx`) against the permission-mode+worktree+model-switch fixture: every Turn's rendered badges match the expected carry-forward state, including Turns far after the last transition row. Satisfies SC-012. *(Deferred — fixture work belongs with T007; T039 hook tests already cover the projection mechanics.)*
- [ ] T048 [US3] Add a test in `packages/shared/src/projections/session-summary.test.ts` (create) against a representative session fixture: assert `tokens.inputTotal`, `tokens.outputTotal`, `tokens.cacheCreationTotal`, `tokens.cacheReadTotal` match a hand-computed total derived by iterating unique `message.id`s and summing usage once per identifier. Satisfies SC-004. *(Partially satisfied — `usage-dedup.test.ts` + `session-summary.test.ts` cover hand-computed token-dedup invariants synthetically; corpus-fixture verification belongs with T007.)*
- [ ] T049 [US3] Add a test in `packages/shared/src/projections/usage-dedup.test.ts` (file from T042) with a fixture session containing significant cache usage: assert `cacheCreationTotal` and `cacheReadTotal` are reported separately and that their sum matches the schema-level cache figures. Satisfies SC-005. *(Partially satisfied — synthetic cache-split test in `usage-dedup.test.ts`; corpus-fixture verification belongs with T007.)*

**Checkpoint**: US3 delivered. SC-004, SC-005, SC-012, SC-013 pass. The session-summary surface gives Audit users at-a-glance answers; sticky-state badges give every Turn its harness context; file-history blobs are fetchable.

---

## Phase 6: Polish & Cross-Cutting (Plan Chunk F + verification)

**Purpose**: Search-index expansion, performance verification against the budget, end-to-end quickstart validation. None of these block user-story acceptance; they are cross-cutting improvements + verification.

- [X] T050 Extend `packages/server/src/search/search-index.ts` FTS5 indexing scope per `specs/007-ui-information-revamp/research.md` R4: in addition to today's prompt + assistant text, index (a) tool inputs (JSON-stringified to a flat text blob), (b) tool result LLM-visible content, (c) attachment payload salient fields (file paths, hook stdout, goal_status text, task_reminder text, etc.), (d) `api_error` messages, (e) structured sidecar headline fields (file paths from `EditResult`, queries from `WebSearchResult`, prompts from `AgentLaunchResult`). Do NOT index full sidecar bodies or base64 image data. Add server tests in `packages/server/src/search/search-index.test.ts` (extending existing file) covering one indexed entry of each new category.
  - **2026-05-26**: (a) + (b) were already covered by the existing Turn-based extractor. Added schema-row-aware `appendRowExtras()` covering attachment payload fields (all 22 subtypes, generic key-walk) + system row content (api_error message + away_summary / informational / local_command content). (e) structured sidecar headline fields not added in this batch — the existing tool_use input indexing already catches file paths from the *input* side; the *result* side would add redundancy. 4 new tests covering attachment + api_error + informational + appendDelta.
- [X] T051 Extend `packages/server/src/search/reconciler.ts` so the indexer re-runs over the schema-aware row stream from T002 — i.e., the reconciler reads `ClaudeRow[]` rather than the narrower legacy `Turn[]`. Verify with the existing reconciler test in `packages/server/src/search/reconciler.test.ts`.
  - **2026-05-26**: `indexFull` + `appendDelta` accept an optional `rows: readonly ClaudeRowOrUnknown[]` parameter. Reconciler (`reconciler.ts`) now passes `session.rows` and `sa.rows`; live-tail watcher (`index.ts`) passes the delta-rows from `IncrementalReader.readNew()`. Existing reconciler tests pass unchanged; new search-index tests confirm row-based indexing works.
- [X] T052 [P] In `packages/ui/src/components/nav/SearchPalette.tsx` (or wherever existing search-palette result handling lives), enhance result jump: each `SearchHit` carries `rowUuid` → map it to the loaded session's `turnId` (via the rows index) → set `focusedTurnId`. Falls back to current session-jump behavior when `rowUuid` is absent.
  - **2026-05-26**: Added `resolveSearchHit(view, rowUuid)` in `App.tsx` with three fallbacks: (1) match `SessionTurn.userMsgId`/`id` for prompt hits, (2) match any `Request.id` for assistant-row hits, (3) walk `view.rows`, read the row's `promptId`, find the SessionTurn with matching `promptId`. Covers the FTS5 indexing expansion from T050 (tool inputs, attachment payloads, api_error messages, system content all now land on the right turn).
- [ ] T053 [P] Performance measurement: record the cold-start first-viewport-render time on the 145MB-scale fixture (T007 entry #8) using DevTools Performance. Compare against the Phase 1 T001 baseline. Document the result in `specs/007-ui-information-revamp/quickstart.md` under "performance verification" (append a results table — do NOT modify the recipe). Satisfies SC-006 verification.
- [ ] T054 [P] Performance measurement: record steady-state scroll on the 10k-row fixture: total dropped frames during a full-scroll session = 0; expand/collapse feedback ≤100 ms (median over 20 samples); mode/disclosure switch ≤200 ms (median over 20 samples). Document in quickstart.md results table. Satisfies SC-006a.
- [ ] T055 Run the full quickstart recipe end-to-end against the corpus session in `~/.claude/projects/`. Record pass/fail of every check in a results table appended to `specs/007-ui-information-revamp/quickstart.md`. Constitutional gates: DevTools Network tab during a full session view shows zero non-localhost requests carrying transcript content (Principle I); `lsof`/`fs.watch` shows no writes to `~/.claude/projects/` (Principle IV).
- [X] T056 [P] Cleanup: audit `packages/ui/src/hooks/useSessionView.ts` and dependent components — if every UI consumer of the legacy `Turn[]` projection has migrated to `RowItem[]` via T013–T015 and T024–T044, remove the legacy projection and the `turns` field from `SessionDetailResponse` in a clearly-scoped follow-up commit. If any consumer still depends on `Turn[]`, leave for a follow-up feature and document the remaining consumers in `specs/007-ui-information-revamp/quickstart.md`. Per constitution Principle V (Simplicity), do not leave dead projections in the build.
  - **2026-05-26**: Audit recorded in `specs/007-ui-information-revamp/quickstart.md` ("Legacy Turn[] consumers"). Conclusion: legacy `turns` cannot yet be removed — the Transcript render loop (`Transcript.tsx::buildRows`) plus all 14 listed downstream components/hooks still consume `SessionView.turns`. New `rows`-driven consumers (App search resolver, `useSessionView` sticky-state attachment, `BlockBashSidecar` via `TranscriptSessionContext`) land in this batch but coexist with the legacy projection. Cleanup remains blocked on T015 (the RowItem-driven Transcript render loop).

---

## Dependencies & execution order

### Phase dependencies

- **Phase 1 (Setup)**: no dependencies; run first.
- **Phase 2 (Foundational)**: depends on Phase 1. **Blocks all user stories** — every story phase consumes the schema-aware `rows` field, the flat-row builder, and the Zustand store.
- **Phase 3 (US1 — P1)**: depends on Phase 2. Can run in parallel with Phases 4 and 5 once Foundational completes (different components, mostly different files).
- **Phase 4 (US2 — P2)**: depends on Phase 2. Can run in parallel with Phases 3 and 5.
- **Phase 5 (US3 — P3)**: depends on Phase 2 (and on T012 in particular for the sticky-state skeleton). Can run in parallel with Phases 3 and 4.
- **Phase 6 (Polish)**: depends on all three user-story phases for cleanup (T056) and end-to-end verification (T055); the search and perf tasks (T050–T054) depend only on Phase 2.

### User story dependencies

| Story | Depends on | Notes |
|---|---|---|
| US1 (Recall) | Phase 2 | The MVP. Ships independently. |
| US2 (Learning) | Phase 2 | Independent of US1 — but shares the flat-row builder; T032/T033/T036 touch the builder, so coordinate file edits with T011 if working in parallel. |
| US3 (Audit) | Phase 2 + T012 (sticky skeleton) + T034 (retry-chain annotations) | T034 is in Phase 4 but is a server-side annotation that US3's session-summary consumes; if Phases 4 and 5 run in parallel, T034 must land before T043. |

### Within each phase

- Server-side changes (normalizer/loader/routes) precede UI changes that consume them.
- Hooks (state/useFlatRows/useStickyState) precede components that consume them.
- Per-component tests run alongside or after the component implementation, not as a strict-TDD upfront step (this feature is not contracted for TDD; tests verify, they don't drive).

### Parallel opportunities (key examples)

- T007 (fixtures) [P] runs alongside the server normalizer chain (T002 → T003 → T004 → T005 → T006).
- T009 [P], T010 [P], T011 [P], T012 [P], T014 [P] are independent files within Phase 2 and run in parallel.
- T024 [P], T025 [P], T026 [P], T027 [P] (Block specialists) all create independent files in Phase 4 and run in parallel.
- T032 [P], T033 [P] (AttachmentRow, SystemEventRow) — independent files.
- T041 [P], T042 [P] (InlineStateChange, usage-dedup) — independent files/packages.
- T053 [P], T054 [P] (perf measurements) — independent verification, can run alongside T055 if measured cleanly.

---

## Parallel example: Phase 2 foundational

```bash
# After T002 lands, launch in parallel:
Task: "Add corpus-validation fixtures in packages/server/src/reader/__fixtures__/v007/"       # T007
Task: "Export ClaudeRow + dependent schemas from packages/shared/src/index.ts"               # T009
Task: "Create packages/ui/src/state/sessionViewStore.ts"                                     # T010
Task: "Create packages/ui/src/hooks/useFlatRows.ts"                                          # T011
Task: "Create packages/ui/src/hooks/useStickyState.ts (skeleton)"                            # T012
Task: "Create packages/ui/src/components/transcript/UnknownRow.tsx"                          # T014
```

## Parallel example: Phase 4 user story 2

```bash
# Block specialists — independent files:
Task: "Create packages/ui/src/components/transcript/blocks/BlockStructuredPatch.tsx"   # T024
Task: "Create packages/ui/src/components/transcript/blocks/BlockAgentRollup.tsx"       # T025
Task: "Create packages/ui/src/components/transcript/blocks/BlockAskUserQuestion.tsx"   # T026
Task: "Create packages/ui/src/components/transcript/blocks/BlockImage.tsx"             # T027

# Dispatcher and event rows — independent:
Task: "Create packages/ui/src/components/transcript/AttachmentRow.tsx"                 # T032
Task: "Create packages/ui/src/components/transcript/SystemEventRow.tsx"                # T033
```

---

## Implementation strategy

### MVP cut (Phases 1 + 2 + 3)

1. **Phase 1**: confirm baseline green.
2. **Phase 2**: schema parsing parity. Every corpus session loads; unknown rows render as degraded cards; no regression.
3. **Phase 3**: US1 — Recall fully functional with prompt-anchor navigation and scroll preservation.

**STOP and VALIDATE**: run quickstart.md Chunks A + Recall checks. SC-001, SC-003, SC-007, SC-008, SC-009 all pass.

This is the ship-able MVP. P2 and P3 add information value but do not block the core Recall experience.

### Incremental delivery

After MVP:
- Add **Phase 4 (US2 Learning)** — the biggest user-visible jump. The previously-discarded ~37 MB of structured sidecar data becomes reachable. SC-002, SC-010, SC-011.
- Add **Phase 5 (US3 Audit)** — token totals, sticky badges, session-summary surface. SC-004, SC-005, SC-012, SC-013.
- Add **Phase 6 (Polish)** — search expansion, perf verification, quickstart end-to-end. SC-006, SC-006a.

Each phase is independently testable against its fixtures.

### Parallel team strategy

After Phase 2 lands:
- Developer A: Phase 3 (US1 — small, tight).
- Developer B: Phase 4 (US2 — biggest scope; can be split further between Block specialists and Attachment/System rows).
- Developer C: Phase 5 (US3); coordinates with Developer B on T034 timing.
- Developer D (optional): Phase 6 T050/T051 can start after Phase 2; perf tasks (T053/T054) must wait until at least the user-story phases reach the demo-ready milestone.

---

## Notes

- Every task references a concrete file path; no task is "vague".
- Tests in this feature are verification, not driver. Constitution mandates tests for parsing/indexing/live-tail — those are explicit tasks (T008, T017, T039 unit, T042 unit, T051). UI tests are extensive but pragmatic.
- Each user story's Checkpoint is the demo gate.
- Commit at each Checkpoint at minimum.
- Stop at any Checkpoint to validate before continuing.
- Avoid: editing the schema itself (T002 maps onto its types; no schema change), editing live-tail SSE protocol (we extend the payload, not change events), adding new heavyweight deps without research.md justification.
