---
description: "Task list for UI Rewrite v4 — three-pane transcript workspace"
---

# Tasks: UI Rewrite v4 — Three-Pane Transcript Workspace

**Input**: Design documents in `/specs/006-ui-rewrite-v4/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/ui-backend.md`, `quickstart.md`

**Tests**: A minimal set of unit + smoke tests are included in the Polish phase. Per the spec, the existing backend test suite MUST continue to pass unchanged (SC-009); UI tests for the rewrite are scoped to the helpers and hooks that drive correctness, plus component smoke tests — no full TDD pass because the design itself is the spec.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing. MVP = User Story 1 + User Story 2 (both P1).

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Setup, Foundational, and Polish tasks do NOT carry a story label
- Each task lists exact file paths under `packages/ui/`

## Path conventions

- **Web app monorepo** (already in place):
  - UI: `packages/ui/src/`
  - Server: `packages/server/` (PRESERVED — do not edit in this feature)
  - Shared types: `packages/shared/` (PRESERVED — do not edit in this feature)
- All UI paths below are relative to repo root.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Clean the slate per the user's explicit request, then re-establish a known-good zero state for the rebuild.

- [X] T001 Delete all existing UI source files under `packages/ui/src/` — every `.ts`, `.tsx`, `.css` file recursively (including `App.tsx`, `main.tsx`, `index.css`, `api.ts`, all of `components/`, `hooks/`, `lib/`, `stores/`, `test/`). DO NOT touch `packages/ui/package.json`, `vite.config.ts`, `vitest.config.ts`, `tsconfig.json`, `components.json`, `index.html`, `scripts/`, or anything outside `packages/ui/src/`. After this task, `packages/ui/src/` is empty.
- [X] T002 Recreate the minimum bootstrap so `npm --workspace @cc-viewer/ui run typecheck` and `npm run build:ui` still succeed: create `packages/ui/src/main.tsx` that mounts a placeholder `<div>cc-transcript-viewer rebuilding…</div>` into `#root`, and create an empty `packages/ui/src/index.css` (Tailwind v4 directive only: `@import "tailwindcss";`). Confirm `npm run build:ui` exits 0.
- [X] T003 [P] Verify the cleanup did not touch backend or shared: run `npm --workspace @cc-viewer/server run test` and `npm --workspace @cc-viewer/shared run test` (if it has a runner) — both must pass with zero changes. If anything fails, the cleanup overreached — revert and redo T001 more surgically.
- [X] T004 [P] Port design tokens from `.design/v4/project/app.css` into `packages/ui/src/index.css` under Tailwind v4 `@theme` layers. Required token families (named per the design's CSS variables): surface-0/1/2, text-0/1/2/3, text-disabled, border-1/2, accent, accent-2, green, red, font-sans (Geist), font-mono (Geist Mono), font-serif (Instrument Serif). Wrap dark theme variables under `[data-theme="dark"]` selector and light theme under `[data-theme="light"]`. Add `[data-density="compact"]` overrides for the spacing/typography variables the design uses. Import `@fontsource/geist-sans`, `@fontsource/geist-mono`, `@fontsource/instrument-serif` (already in `package.json`).
- [ ] **🛑 MILESTONE M1 — Clean slate (smoke test)**. Stop here. Verify per `plan.md` §Smoke-Test Milestones row M1: `npm run build:ui` exits 0; `npm test` is green; DevTools shows `<html data-theme="dark">` with the design-token CSS variables resolved. Wait for the user's "ok" before starting Phase 2.

**Checkpoint**: `packages/ui/src/` is empty except for `main.tsx` + `index.css` with design tokens. `npm run build:ui` succeeds. `npm test` (server + shared) is green.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the cross-cutting helpers, stores, hooks, and primitives that every user story needs. Nothing in Phase 3+ can start until this phase is done.

⚠️ **CRITICAL**: All five user-story phases consume these foundations. Complete Phase 2 in order; the `[P]` tasks within a sub-group can be parallelized.

### Lib helpers (pure, no React)

- [X] T005 [P] Create `packages/ui/src/lib/types.ts` with the UI projection types from `data-model.md` §2: `Block`, `Request`, `Attachment`, `SessionTurn`, `SessionView`, `FlatNode`, `FocusedNodeMeta`, `FocusedBlockMeta`, `FlatToolItem`, `Theme`, `Density`. Re-export from `@cc-viewer/shared` what the UI consumes directly.
- [X] T006 [P] Create `packages/ui/src/lib/format.ts`: `fmtCost(c: number | null | undefined): string` ("$1.42" / "—"), `fmtK(n: number): string` ("12.4K"), `fmtDuration(ms: number): string` ("450ms" or "1.20s"), `fmtRelativeTime(iso: string): string` ("17m ago" / "yesterday").
- [X] T007 [P] Create `packages/ui/src/lib/classnames.ts` exporting `cn(...inputs: ClassValue[]): string` using `clsx` + `tailwind-merge` (both already in deps).
- [X] T008 [P] Create `packages/ui/src/lib/toolArgs.ts` exporting `getToolArgSummary(name: string, input: Record<string, unknown>): string` with the rules from research.md R-04: `Bash`→`input.command`, `Read`/`Write`/`Edit`/`MultiEdit`→`input.file_path ?? input.path`, `Grep`→`"${pattern}" in ${path?}`, `Glob`→`input.pattern`, `Agent`/`Task`→`input.description`, else first two `Object.keys(input)` joined. Unit-testable.
- [X] T009 [P] Create `packages/ui/src/lib/classifyUserText.ts` exporting `isStderrEnvelope(text: string): boolean` matching `/^\[stderr\]/`.
- [X] T010 [P] Create `packages/ui/src/lib/markdown.tsx` with `renderInline(s: string): React.ReactNode` handling `**bold**`, backtick `code`, and `\n` line breaks — matching the prototype's `transcript.jsx:renderInline`.
- [X] T011 [P] Create `packages/ui/src/lib/shortcuts.ts` exporting a `SHORTCUTS` table (id, label, keys, group) used by both `useKeyboard` and the `StatusBar` hint chips. Sourced from FR-080.

### Icon vocabulary

- [X] T012 [P] Create `packages/ui/src/components/ui/icons.tsx` porting the SVG icon set from `.design/v4/project/icons.jsx`: `search`, `chevronRight`, `chevronLeft`, `chevronDown`, `chevronUp`, `arrowRight`, `folder`, `star`, `pinOutline`, `flask`, `x`, `sun`, `moon`, `density`, `panel`, `panelOff`, `report`, `more`, `brain`, `zap`, `agent`, `terminal`, `enter`, `copy`, `link`, `attach`, `bullet`. Export an object `I` with the same names. Stroke 1.5, currentColor, sized via prop.

### API layer

- [X] T013 Create `packages/ui/src/api/client.ts`: a typed fetch wrapper for JSON `/api/*` endpoints. Handles non-2xx → throws `ApiError(code, message)` parsed from `ErrorResponse`. Always same-origin in prod; dev relies on Vite's proxy from `vite.config.ts`.
- [X] T014 [P] Create `packages/ui/src/api/sessions.ts`: `listSessions(): Promise<SessionsListResponse>`, `getSession(id: string): Promise<SessionDetailResponse>`.
- [X] T015 [P] Create `packages/ui/src/api/subagents.ts`: `getSubagent(sessionId: string, agentId: string): Promise<SubagentDetailResponse>`.
- [X] T016 [P] Create `packages/ui/src/api/report.ts`: `getSessionReport(id: string): Promise<SessionReport>`.
- [X] T017 [P] Create `packages/ui/src/api/search.ts`: `search(q: string): Promise<SearchResponse>`, `getSearchStatus(): Promise<SearchStatusResponse>`, `subscribeSearchProgress(onEvent): () => void` (EventSource wrapper).
- [X] T018 [P] Create `packages/ui/src/api/live.ts`: `subscribeLive(sessionId, { onSnapshot, onTurns, onError }): () => void` wrapping `EventSource('/api/live/:sessionId')` and dispatching `snapshot` / `turns` / `ping` events per the contract in `contracts/ui-backend.md`.

### Zustand stores

- [X] T019 [P] Create `packages/ui/src/stores/useWorkspace.ts` exposing `{ theme, density, inspectorOpen, setTheme, setDensity, toggleTheme, toggleDensity, toggleInspector }` per `data-model.md` §3. Defaults: `'dark'`, `'comfortable'`, `true`. No persistence (R-09).
- [X] T020 [P] Create `packages/ui/src/stores/useFocus.ts` with `{ nodeId, nodeMeta, blockId, blockMeta, setNode, setBlock, clearBlock, reset }` enforcing the invariant "block focus implies node focus on the owning request" (FR-060).
- [X] T021 [P] Create `packages/ui/src/stores/useSessionStack.ts` with `{ stack, push, pop, replaceRoot, current, isSubagent }`. Each frame holds `{ view: SessionView, parentLabel: string | null, focusSnapshot? }`.
- [X] T022 [P] Create `packages/ui/src/stores/useOverlays.ts` with `{ search, report, jumper, openSearch, setQuery, openReport, toggleReport, openJumper(anchor), closeAll, closeTop }`. `closeTop` honors Esc priority: jumper → report → search → false.
- [X] T023 [P] Create `packages/ui/src/stores/useLiveTail.ts` with `{ livePending, pendingTurns, tailToast, setLivePending, appendTurns, consumePending, dismissToast, reset }`.

### Hooks (derived state + behavior)

- [X] T024 Create `packages/ui/src/hooks/useSessionView.ts`: the core projection from `Turn[]` (wire) → `SessionView` (UI). Groups consecutive user/assistant Turns; for each assistant Turn produces a Request with `Block[]` derived from `textBlocks`, `thinkingBlocks`, `toolUses` (joined with `toolResults` by `tool_use_id`). Merges any `pendingTurns` from `useLiveTail`. Consumes `toolInteractions: ToolInteraction[]` for preview/status fields. Depends on T005, T008, T023.
- [X] T025 [P] Create `packages/ui/src/hooks/useFlatNodes.ts`: flattens `SessionView.turns` into `FlatNode[]` in document order (user-msg, then requests for each turn). For `j`/`k` stepping.
- [X] T026 [P] Create `packages/ui/src/hooks/useFlatTools.ts`: walks `SessionView` and emits `FlatToolItem[]` for every `tool_use` and `diff` block. For `[` / `]` stepping.
- [X] T027 [P] Create `packages/ui/src/hooks/useFlatPrompts.ts`: emits user-message ids of turns whose prompt is NOT a stderr envelope (uses `isStderrEnvelope` from T009). For `n` / `N` stepping.
- [X] T028 Create `packages/ui/src/hooks/useScrollIntoView.ts`: takes a `bodyRef` and exposes `scrollNodeIntoView(nodeId, { behavior?: 'smooth' | 'auto' = 'smooth', offsetTop = 110 })`. Implements the initial-load instant-jump dance from `app.jsx:60-71` (setTimeout 0/80/350) under a separate `initialJumpToBottom(bodyRef)` export. Depends on `useFocus` (T020).
- [X] T029 Create `packages/ui/src/hooks/useKeyboard.ts`: a single global `window.addEventListener('keydown')` handler implementing every shortcut in FR-080. Reads `SHORTCUTS` (T011), `useFocus` (T020), `useOverlays` (T022), `useSessionStack` (T021), and the three flat-list hooks (T025–T027). Handles `g g` double-press within 700 ms. Skips when focus is inside `input` / `textarea` / contenteditable. Depends on T011, T020, T021, T022, T025, T026, T027, T028.

### shadcn primitives (copy in only what the design needs)

- [X] T030 [P] Run `npx shadcn@latest add button tooltip popover` (or equivalent — the existing `components.json` is preserved) so `packages/ui/src/components/ui/button.tsx`, `tooltip.tsx`, `popover.tsx` are present. These are the only shadcn primitives actually used by the design (CTA buttons, cost tooltips, jumper popover anchoring). _(Hand-rolled — no network shadcn CLI; built on radix-ui + cva + cn.)_

### App shell

- [X] T031 Create `packages/ui/src/App.tsx`: top-level component. Wires `QueryClientProvider` (TanStack Query), subscribes to `useWorkspace` and writes `data-theme`/`data-density` onto `document.documentElement`, mounts the `Workspace` layout, mounts the three overlay portals (search/jumper/report) and the `StatusBar`. Uses `useKeyboard` (T029). Depends on T019, T029, T032 (Workspace). _(For M2 the three-pane grid + status bar are inline; the `Workspace` component arrives in US1 T033/T058.)_
- [X] T032 Recreate `packages/ui/src/main.tsx` (T002 left a stub): create the React root, import `./index.css`, mount `<App />`. Depends on T031.
- [ ] **🛑 MILESTONE M2 — Foundational shell (smoke test)**. Stop here. Verify per `plan.md` §Smoke-Test Milestones row M2: app boots to an empty three-region grid, pressing `t` toggles `data-theme` on `<html>`, UI typecheck is clean. Wait for the user's "ok" before starting Phase 3.

**Checkpoint**: All foundations in place. `npm --workspace @cc-viewer/ui run typecheck` is green. The app boots to a blank workspace shell (no panes yet) but `data-theme`/`data-density` switch on keystroke. User story phases can now start in parallel.

---

## Phase 3: User Story 1 — Read and navigate any Claude Code session (Priority: P1) 🎯 MVP

**Goal**: A three-pane workspace renders correctly, sessions load and display their full transcript, focus updates on click, the inspector reflects the focused node/block, and reading a 10k+ message session stays smooth (Constitution Principle II).

**Independent Test**: Launch the app, pick any non-empty session from the sidebar, scroll from the last turn to the first using the mouse wheel, click a tool capsule → inspector shows tool view, click a diff → inspector shows diff view, toggle inspector via header button → pane hides/restores. The status bar updates after each focus move.

### Implementation for User Story 1

- [X] T033 [P] [US1] Create `packages/ui/src/components/layout/Workspace.tsx`: the three-pane CSS grid (sidebar fixed ~280px, transcript flex, inspector ~360px, hidden via `data-inspector-hidden`). Consumes `useWorkspace.inspectorOpen` (T019). Mounts `<Sidebar>`, `<Transcript>`, `<Inspector>` slots.
- [X] T034 [P] [US1] Create `packages/ui/src/components/layout/StatusBar.tsx`: bottom-fixed bar showing the position breadcrumb derived from `useFocus.nodeMeta` (T020) plus shortcut hint chips read from `SHORTCUTS` (T011).
- [X] T035 [P] [US1] Create `packages/ui/src/components/sidebar/Brand.tsx`: the `cc` mark + name + `local` tag block from the design.
- [X] T036 [P] [US1] Create `packages/ui/src/components/sidebar/SearchButton.tsx`: the search-shaped button that opens `useOverlays.openSearch()` (T022). Shows `⌘K` kbd indicator.
- [X] T037 [P] [US1] Create `packages/ui/src/components/sidebar/CostTooltip.tsx`: a Radix Tooltip wrapper showing input / output / cache create / cache read tokens (uses `fmtK` from T006).
- [X] T038 [P] [US1] Create `packages/ui/src/components/sidebar/SessionRow.tsx`: one row per `SessionMeta` — title (ellipsis), optional pin star (hidden in v1 — see contracts.md backend gaps), optional live dot, time, message count, cost with `CostTooltip`. Depends on T037.
- [X] T039 [US1] Create `packages/ui/src/components/sidebar/ProjectGroup.tsx`: collapsible group header (chevron, folder icon, name, count badge) wrapping `SessionRow[]`. Depends on T038.
- [X] T040 [US1] Create `packages/ui/src/components/sidebar/Sidebar.tsx`: assembles `Brand` + `SearchButton` + `ProjectGroup[]`. Consumes `listSessions` via TanStack Query (T014); groups by `worktreeOf ?? projectPath`; selecting a row calls `useSessionStack.replaceRoot()` with the fetched detail. Depends on T035, T036, T039.
- [X] T041 [P] [US1] Create `packages/ui/src/components/transcript/TranscriptHeader.tsx`: session title + chips row (Turns / Requests / Cost / Model / optional Live placeholder — Live will be wired in US4). Action buttons (Report stub, Inspector toggle, Density toggle, Theme toggle, more). All buttons fire their respective store actions (T019, T022).
- [X] T042 [P] [US1] Create `packages/ui/src/components/transcript/TranscriptNavBar.tsx`: 4 steppers (Turn / Req / Prompt / Tool) with left/right arrow buttons. Turn label is clickable but the jumper overlay itself is added in US3. Prompt preview text and turn-cost on the right.
- [X] T043 [P] [US1] Create `packages/ui/src/components/transcript/TurnDivider.tsx`: the clickable pill row separator showing turn id + time + aggregate cost.
- [X] T044 [P] [US1] Create `packages/ui/src/components/transcript/UserPrompt.tsx`: focused-state user message node with prompt text and optional attachments summary line.
- [X] T045 [P] [US1] Create `packages/ui/src/components/transcript/blocks/BlockText.tsx`: light markdown via `renderInline` (T010).
- [X] T046 [P] [US1] Create `packages/ui/src/components/transcript/blocks/BlockThinking.tsx`: labelled italic block.
- [X] T047 [P] [US1] Create `packages/ui/src/components/transcript/blocks/BlockToolCapsule.tsx`: the tool capsule (kind, name, arg summary via `getToolArgSummary` from T008, duration, status, preview). Subagent CTA is a slot rendered conditionally — the actual subagent drill behavior is wired in US2.
- [X] T048 [P] [US1] Create `packages/ui/src/components/transcript/blocks/BlockDiff.tsx`: diff header + clipped hunks with gutter (line numbers, add/del markers, +/− symbols).
- [X] T049 [US1] Create `packages/ui/src/components/transcript/RequestNode.tsx`: assembles a request's label row + marker row + ordered `Block` children, picking the right component per `block.kind`. Depends on T045–T048.
- [X] T050 [US1] Create `packages/ui/src/components/transcript/Transcript.tsx`: the virtualized body. Uses `react-virtuoso` with a flat array projection (one row = one of: turn-divider, user-prompt, request-node) injected at render time from `SessionView.turns`. Mounts `TranscriptHeader` + `TranscriptNavBar` above the body; both stay sticky/non-virtualized. Wires click → `useFocus.setNode/setBlock` and `useScrollIntoView` (T028). Depends on T041, T042, T043, T044, T049.
- [X] T051 [P] [US1] Create `packages/ui/src/components/inspector/CrumbStrip.tsx` and `MetricsRow.tsx` — shared inspector header strip and 3-card metrics row.
- [X] T052 [P] [US1] Create `packages/ui/src/components/inspector/InspectorEmpty.tsx`: empty-state copy.
- [X] T053 [P] [US1] Create `packages/ui/src/components/inspector/InspectorRequest.tsx`: crumb + metrics + "Blocks in this request" list with click-to-jump (calls `useFocus.setBlock` via prop). Depends on T051.
- [X] T054 [P] [US1] Create `packages/ui/src/components/inspector/InspectorUser.tsx`: crumb + metrics + full prompt text + attached events list. Depends on T051.
- [X] T055 [P] [US1] Create `packages/ui/src/components/inspector/InspectorTool.tsx`: crumb + tool name/status + Input JSON (pretty-printed) + Output (no clipping). Subagent CTA slot is empty here — wired in US2.
- [X] T056 [P] [US1] Create `packages/ui/src/components/inspector/InspectorDiff.tsx`: crumb + "Copy path" button + full diff (no clipping).
- [X] T057 [US1] Create `packages/ui/src/components/inspector/Inspector.tsx`: router that reads `useFocus` and renders Empty/Request/User/Tool/Diff. Depends on T052–T056.
- [X] T058 [US1] Wire `App.tsx` → `Workspace` → mount `Sidebar` (T040), `Transcript` (T050), `Inspector` (T057), `StatusBar` (T034). Default focus on session load: last request of last turn, instant-scroll into view via `initialJumpToBottom` from T028.
- [ ] **🛑 MILESTONE M3 — Read flow / US1 (smoke test)**. Stop here. Verify per `plan.md` §Smoke-Test Milestones row M3: pick a non-empty session, see three panes render, scroll a 10k+ message session bottom→top without visible hitch, click a tool capsule → inspector switches to Tool view, toggle inspector via header button. Wait for the user's "ok" before starting Phase 4.

**Checkpoint**: A user can launch the app, pick a session from the sidebar, see the full transcript rendered, scroll smoothly through 10k+ messages, click any node/block to focus it, and watch the inspector update. The status bar shows the position breadcrumb. Theme + density toggles work from the header (T031 already wired the `data-theme` / `data-density` effect).

---

## Phase 4: User Story 2 — Drill into every subagent's internals (Priority: P1)

**Goal**: From any tool capsule (or its inspector view) whose `ToolUse.childAgentId` is non-empty, the user can drill into the subagent's transcript and pop back to the parent without losing focus.

**Independent Test**: Find a session with a subagent tool call, click "Open subagent transcript" on the capsule → transcript swaps with a back breadcrumb. Click back → parent restored with prior focus and scroll. Repeat from the inspector's drill button (US7's inspector CTA path) → same result.

### Implementation for User Story 2

- [X] T059 [P] [US2] Create `packages/ui/src/components/transcript/blocks/SubagentCta.tsx`: the in-capsule "Open subagent transcript · N turns · M tool calls · $X · ›" affordance. Reads aggregated metrics from the corresponding `SubagentRef` (joined upstream in `useSessionView`).
- [X] T060 [US2] Update `BlockToolCapsule` (T047) to render `<SubagentCta>` when `block.isSubagent === true`, passing an `onDrill` callback.
- [X] T061 [US2] In `Transcript` (T050), wire the `onDrill(subagentRef)` callback to: (a) snapshot current frame's focus + scrollTop, (b) fetch via `getSubagent(sessionId, agentId)` (T015), (c) `useSessionStack.push(syntheticView, parentLabel, snapshot)` — where the synthetic view wraps the `SubagentDetailResponse` into `SessionView` shape.
- [X] T062 [P] [US2] Update `TranscriptHeader` (T041) to render the subagent breadcrumb when `useSessionStack.isSubagent()` is true: "Back to [parent title]" button + "Subagent transcript › spawned from Turn [parentTurnId]". Back button calls `useSessionStack.pop()`.
- [X] T063 [US2] Wire pop-back focus restoration: after `useSessionStack.pop()` returns the prior frame's `focusSnapshot`, restore `useFocus` to the snapshot's nodeId/blockId and instant-scroll `bodyRef.scrollTop` to the snapshot's scrollTop.
- [X] T064 [US2] Update `Inspector` to also fire `onDrill` when an `InspectorTool` view exposes a subagent — pass the same `useSessionStack.push` path. Inspector-CTA *visual* affordance lives in US7 (T085); the wiring is shared here so the path is ready when US7 lands.
- [ ] **🛑 MILESTONE M4 — P1 MVP (smoke test)**. Stop here. Verify per `plan.md` §Smoke-Test Milestones row M4: drill into a subagent from a capsule (see "Back to [parent]" breadcrumb), click back, parent restored at prior focus + scroll. This is the demoable MVP. Wait for the user's "ok" before starting Phase 5.

**Checkpoint**: Drilling into and out of subagents works from the inline capsule. Parent focus and scroll restore on pop. The two P1 stories together = MVP.

---

## Phase 5: User Story 3 — Keyboard-first navigation (Priority: P2)

**Goal**: All 15 keyboard shortcuts in FR-080 work; the StatusBar advertises them; the Turn Jumper opens via `Shift+T` and the nav bar's Turn label click.

**Independent Test**: Walk through each shortcut from the quickstart's "US3 — Keyboard" checklist. For each one, observe the focused node update and the status bar position breadcrumb reflect the change.

### Implementation for User Story 3

- [X] T065 [US3] Verify `useKeyboard` (T029) covers every shortcut in FR-080. If anything is missing, finish: `j` / `k` (step node), `Shift+J` / `Shift+K` (step turn), `n` / `Shift+N` (step prompt), `[` / `]` (step tool), `gg` (top), `Shift+G` (bottom + dismiss toast), `Cmd+K` / `Ctrl+K` / `/` (open search), `Shift+T` (open jumper), `t` (toggle theme), `r` (toggle report), `Space` / `Shift+Space` (page scroll), `Esc` (close top overlay or clear block focus). All in `packages/ui/src/hooks/useKeyboard.ts`.
- [X] T066 [US3] In `TranscriptNavBar` (T042), make the Turn label clickable: fire `useOverlays.openJumper(rect)` with the label's `getBoundingClientRect()` as anchor.
- [X] T067 [P] [US3] Create `packages/ui/src/components/overlays/TurnJumper.tsx`: portal-rendered popover anchored to the rect supplied via `useOverlays.jumper.anchor`. Renders the current session's turns with id / time / prompt preview / meta (`r` requests, `b` blocks, cost). Arrow keys move active, Enter jumps to active turn (calls `useFocus.setNode` + `scrollNodeIntoView`), Esc closes, hover sets active.
- [X] T068 [US3] Mount `<TurnJumper>` from `App.tsx` (T031). Make sure it sits above the workspace but below `<SearchPalette>` and `<SessionReport>` so the Esc priority (jumper → report → search) maps to z-order.
- [X] T069 [US3] Refresh `StatusBar` (T034) hint chips so they exactly match the design's bottom-bar key list: `j/k step`, `⇧J/⇧K turn`, `n prompt`, `[ ] tool`, `T turns`, `r report`, `⌘K search`, `⇧G tail`, `t theme`.

**Checkpoint**: A user can drive the whole workspace from the keyboard. Turn Jumper opens via both the Turn-label click and `Shift+T`. Esc priority is enforced.

---

## Phase 6: User Story 4 — Live-tailing of an active session (Priority: P2)

**Goal**: The "Live" chip appears on active sessions; new turns arrive over SSE and surface either as auto-follow (when scrolled to bottom) or as a toast (otherwise). The toast is suppressed inside subagents and re-appears on return to the parent.

**Independent Test**: Open a live session, scroll up a few turns, append a new turn (let Claude Code finish a step) → toast surfaces. Press `Shift+G` → new turn revealed; toast cleared. Scroll to bottom; trigger another turn → auto-followed. Drill into subagent; new turns accumulate quietly. Pop back → toast reappears.

### Implementation for User Story 4

- [X] T070 [US4] Create `packages/ui/src/hooks/useLiveTail.ts`: subscribes via `subscribeLive` (T018) when the active session is live and the stack is NOT in a subagent. On `snapshot` → `useLiveTail.setLivePending(true)` + write "Live" chip flag. On `turns` → read `bodyRef` to decide `userAtBottom`, call `useLiveTail.appendTurns(turns, { userAtBottom, inSubagent: false })`. Tears down on session change / subagent drill / unmount. (Note: this is the hook; the store from T023 holds the state.)
- [X] T071 [P] [US4] In `TranscriptHeader` (T041), render the "Live" chip with a pulsing dot whenever `useLiveTail.livePending && !useSessionStack.isSubagent()`.
- [X] T072 [P] [US4] Create `packages/ui/src/components/transcript/LiveTailToast.tsx`: floating toast pinned to the bottom of `tx-body`, "New Turn arrived · Shift+G to follow". Clicking it calls the same action as `Shift+G`.
- [X] T073 [US4] In `Transcript` (T050): mount `<LiveTailToast>` inside the body container; visibility bound to `useLiveTail.tailToast`. When the user scrolls to within ~24px of the bottom, dismiss the toast. When `Shift+G` fires (via `useKeyboard`), call `useLiveTail.consumePending()` to merge pending turns into `useSessionView`, then instant-scroll to the new bottom and `dismissToast()`.
- [X] T074 [US4] Update `useSessionView` (T024) to merge `useLiveTail.pendingTurns` into the projected `SessionView.turns` when they exist. Auto-follow logic (user at bottom) consumes immediately; otherwise pendingTurns accumulate until `consumePending()` is called.

**Checkpoint**: Live tail works end-to-end. Chip + toast surface correctly, the subagent suppression rule (FR-102) holds, and `Shift+G` reveals new content.

---

## Phase 7: User Story 5 — Cross-session search palette (Priority: P2)

**Goal**: Search palette opens via `⌘K`, `/`, or the sidebar button; results group by project with kind badges and highlighted snippets; the indexing strip shows progress live; arrow nav + Enter open a result and focus the matching turn.

**Independent Test**: Open palette, type a query that has hits across multiple sessions → results group by project. Arrow up/down moves active; Enter opens. Open palette while index is reconciling → progress bar updates over SSE. Esc closes.

### Implementation for User Story 5

- [X] T075 [P] [US5] Create `packages/ui/src/components/overlays/SearchPalette.tsx`: backdrop + shell + input row + status row + results list + footer. Reads `useOverlays.search.open / query`, calls `setQuery` on input change. Debounces the query (~150ms) before firing `search(q)` (T017).
- [X] T076 [P] [US5] Inside `SearchPalette`, render the indexing strip: on open, fetch `getSearchStatus()` (T017) once and subscribe to `subscribeSearchProgress()` for live updates. Hide the strip once progress hits 100% or status is `complete`.
- [X] T077 [P] [US5] Result row: badge (`hit.kind`) + session title + sanitized highlighted snippet (via `rehype-sanitize` from `react-markdown` deps) + target turn id + time. Hover/arrow sets active; Enter calls `onPick(hit)`.
- [X] T078 [US5] In `App.tsx` (T031), wire `onPick`: if `hit.sessionId !== current.id`, fetch via `getSession` (T014) and `useSessionStack.replaceRoot()` with the resulting `SessionView`; then `useFocus.setNode` to the hit's target turn and `scrollNodeIntoView`. Always close the palette via `useOverlays.closeAll()`.
- [X] T079 [US5] Mount `<SearchPalette>` from `App.tsx`. Keyboard wiring for `⌘K` / `Ctrl+K` / `/` is already in `useKeyboard` (T029, T065); the sidebar `SearchButton` (T036) also calls `useOverlays.openSearch()`.
- [ ] **🛑 MILESTONE M5 — All P2 stories (smoke test)**. Stop here. Verify per `plan.md` §Smoke-Test Milestones row M5: walk through every FR-080 shortcut, exercise live-tail toast + `Shift+G` follow on an active session, and run a cross-session search via `⌘K` with `↑`/`↓`/`Enter` navigation. Wait for the user's "ok" before starting Phase 8.

**Checkpoint**: Search across sessions works, including the indexing-progress strip, snippet sanitization, and result-pick navigation.

---

## Phase 8: User Story 6 — Per-session report with cost/token attribution (Priority: P3)

**Goal**: `r` (or the Report button) opens a session-level report overlay with 5 stat cards, "By agent & model" + "By turn" tables, sparkline + spike cards, and a files-touched timeline.

**Independent Test**: From any non-empty session, press `r`. The overlay opens within 750 ms. Every section renders with non-blank numbers (no NaN, no empty cells where data exists). Esc closes.

### Implementation for User Story 6

- [X] T080 [P] [US6] Create `packages/ui/src/components/overlays/Sparkline.tsx`: small SVG sparkline (area + line + dots) — port from `overlays.jsx:Sparkline`. Takes `data: number[]` + height + accent color.
- [X] T081 [US6] Create `packages/ui/src/components/overlays/SessionReport.tsx`: backdrop + shell, fetches `getSessionReport(currentSession.id)` via TanStack Query (T016). Sections:
  - **Stat cards**: Duration, Turns, Tool calls (main + sub), Cache hit %, Total cost.
  - **By agent & model table**: rows from `report.rows: ReportRow[]`, totals row at the bottom.
  - **By turn table**: prompt preview (via `shortPreview` helper from T006 — add if missing), requests, blocks, attachments, cache-write Δ, cost.
  - **Usage over time**: `<Sparkline data={report.tokenSeries.points.map(p => p.cost)}>` + top-3 spike cards.
  - **Files touched**: one row per `report.fileTouchIndex.files[i]` with pip timeline normalized across session time + total event count.
  - "Export CSV" button — stub no-op for v1 (Assumptions).
- [X] T082 [US6] Mount `<SessionReport>` from `App.tsx` (T031). `r` already wired in `useKeyboard` (T029, T065); header Report button (T041) already calls `useOverlays.openReport()`. Esc priority handled by `closeTop`.

**Checkpoint**: Session report opens, renders every section from existing backend data, and closes cleanly.

---

## Phase 9: User Story 7 — Subagent navigation via inspector (Priority: P3)

**Goal**: When the inspector's Tool view shows a `tool_use` that spawned a subagent, a "Open subagent transcript" CTA with the subagent's summary metrics is visible; clicking it drills in via the path established in US2.

**Independent Test**: Focus a tool_use that spawned a subagent (e.g., click the capsule). The inspector's Tool view shows a CTA at the bottom with turn count / tool call count / cost / model. Click → same behavior as the inline capsule drill (US2).

### Implementation for User Story 7

- [X] T083 [P] [US7] Create `packages/ui/src/components/inspector/SubagentDrill.tsx`: the inspector-specific drill block — agent icon + title + subagent summary line + arrow-right affordance.
- [X] T084 [US7] Update `InspectorTool` (T055) to render `<SubagentDrill>` at the bottom when `block.isSubagent === true`, with the same `onDrill` path the inline capsule uses (T061, T064).

**Checkpoint**: Inspector path to subagent drill is live alongside the inline capsule path. Both routes share the same `useSessionStack.push` machinery.

---

## Phase 10: User Story 8 — Personalisation: theme and density (Priority: P3)

**Goal**: Theme (dark/light) and density (comfortable/compact) toggles in the header work, the `t` shortcut toggles theme, and all three panes reflow within 100ms with no FOUC.

**Independent Test**: Click each toggle and observe an instant style change across the sidebar, transcript, and inspector. Press `t` → theme flips. Reload the page → state resets to dark/comfortable (no persistence in v1).

### Implementation for User Story 8

- [X] T085 [US8] Verify the header (T041) calls `useWorkspace.toggleTheme()` and `useWorkspace.toggleDensity()`. The `data-theme` / `data-density` effect in `App.tsx` (T031) already syncs the DOM attributes.
- [X] T086 [US8] Verify the `[data-density="compact"]` token overrides in `index.css` (T004) cover everywhere the design's density rule applies: sidebar row height, transcript node padding, inspector metric row padding, status bar font-size.
- [X] T087 [US8] Verify `t` shortcut → `useWorkspace.toggleTheme()` is in `useKeyboard` (already covered by T029/T065).
- [ ] **🛑 MILESTONE M6 — All P3 stories (smoke test)**. Stop here. Verify per `plan.md` §Smoke-Test Milestones row M6: open Session Report (`r`) and see all sections populated; focus a subagent-spawning tool in the inspector to see its drill CTA; toggle theme + density from the header and verify the three panes reflow cleanly. Wait for the user's "ok" before starting Phase 11.

**Checkpoint**: All 8 user stories functional and independently demoable.

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Tests, perf smoke, and final validation against the spec's success criteria.

### Unit tests for pure helpers

- [X] T088 [P] Create `packages/ui/src/lib/format.test.ts` covering `fmtCost`, `fmtK`, `fmtDuration`, `fmtRelativeTime`.
- [X] T089 [P] Create `packages/ui/src/lib/toolArgs.test.ts` covering each tool-name rule from R-04.
- [X] T090 [P] Create `packages/ui/src/lib/classifyUserText.test.ts` covering the `[stderr]` prefix rule.
- [X] T091 [P] Create `packages/ui/src/lib/markdown.test.tsx` covering bold, code, and line breaks via `renderInline`.

### Hook tests

- [X] T092 [P] Create `packages/ui/src/hooks/useFlatNodes.test.ts`: verifies user-message then requests order for a multi-turn fixture; honors stderr turns existing in flatNodes (only `useFlatPrompts` filters them).
- [X] T093 [P] Create `packages/ui/src/hooks/useFlatPrompts.test.ts`: verifies stderr-envelope filtering.
- [X] T094 [P] Create `packages/ui/src/hooks/useFlatTools.test.ts`: verifies tool_use + diff inclusion, request order.
- [X] T095 [P] Create `packages/ui/src/hooks/useSessionView.test.ts`: verifies wire-Turn[] → SessionView projection with a multi-turn fixture including a subagent tool, a stderr prompt, and an attachment.

### Component smoke tests

- [X] T096 [P] Create `packages/ui/src/components/sidebar/Sidebar.test.tsx`: renders project groups + sessions, click triggers selection.
- [X] T097 [P] Create `packages/ui/src/components/transcript/Transcript.test.tsx`: renders user prompt, request, and each block kind; click on a tool capsule sets `useFocus.blockId`.
- [X] T098 [P] Create `packages/ui/src/components/inspector/Inspector.test.tsx`: each branch (Empty / Request / User / Tool / Diff) renders without errors.
- [X] T099 [P] Create `packages/ui/src/components/overlays/SearchPalette.test.tsx`: arrow nav, Enter pick, status row.

### Regression and perf

- [X] T100 Run `npm test` from repo root — both server suite and new UI suite must pass (SC-009).
- [X] T101 Run `npm run typecheck` — full workspace type-check is clean.
- [~] T102 Perf smoke per quickstart §7. Verified against the prod bundle (chrome-devtools-mcp on `node bin/cc-viewer.js`): Session report opens in ~230 ms (budget 750 ms ✓), Search palette returns in ~200 ms (budget 500 ms ✓), theme/density toggle reflows in 1.2 ms (budget 100 ms ✓). The 10k+ message scroll check is deferred — the user's local `~/.claude/projects/` has 163 sessions, the largest being 808 messages, so the long-task-while-scrolling check needs a human pass when a 10k+ session is available.
- [X] T103 Pixel-perfect QA — open the new UI and the prototype's `.design/v4/project/cc-transcript-viewer.html` side by side at 1440 px wide; sweep through sidebar, header, nav bar, transcript body (each block kind), inspector (each kind), and overlays. Signed off by user 2026-05-22; any remaining drift to be captured as follow-ups rather than blockers.

### Build verification

- [X] T104 Run `npm run build` (full pipeline: build:ui → copy:ui → build:server → inline:shared). Verify `packages/server/public/` contains the SPA, the server `dist/` builds, and `npm run pack:dry` reports no missing files.
- [X] T105 CLI smoke per quickstart §6: `node bin/cc-viewer.js` opens the SPA at `http://127.0.0.1:<auto-port>/`. Re-run US1 smoke against the production bundle to confirm SC-010.
- [X] **🛑 MILESTONE M7 — Production smoke (final smoke test)**. Signed off by user (2026-05-22). Build pipeline + CLI launch + prod-bundle three-pane smoke all green; small visual glitches deferred as follow-ups rather than blockers.

### Final docs touch

- [X] T106 [P] Update `docs/` only if any user-facing CLI flag or behavior changed. The rewrite preserves the CLI surface (verified `node bin/cc-viewer.js --help` still prints the same `--port` / `--no-open` / `--dir` flags), so no docs change is needed.

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion — blocks ALL user-story phases.
- **User Stories (Phases 3–10)**: All depend on Foundational. After Phase 2 ships:
  - US1 (Phase 3) and US2 (Phase 4) together form the MVP — implement first, in that order (US2 leans on US1's transcript components).
  - US3, US4, US5 (Phases 5–7) can proceed in parallel after MVP, each touches different files.
  - US6, US7, US8 (Phases 8–10) likewise parallel.
- **Polish (Phase 11)**: Depends on all preceding user-story phases.

### Within-phase order

- **Phase 1**: T001 → T002 → (T003 ∥ T004).
- **Phase 2**:
  - Lib helpers (T005–T011) all `[P]` — start together.
  - Icon set (T012) `[P]` — independent of helpers.
  - API client (T013) before the typed wrappers (T014–T018, all `[P]`).
  - Stores (T019–T023) all `[P]` after lib types (T005).
  - `useSessionView` (T024) depends on T005, T008, T023.
  - `useFlatNodes/Tools/Prompts` (T025–T027) `[P]` after T024.
  - `useScrollIntoView` (T028) after T020.
  - `useKeyboard` (T029) is the merge point — depends on T011, T020–T022, T025–T028.
  - shadcn primitives (T030) `[P]`.
  - `App.tsx` (T031) → `main.tsx` (T032) last in Phase 2.
- **Phase 3 (US1)**: Layout + Sidebar + Transcript primitives + Inspector primitives in parallel (T033–T037 + T041–T048 + T051–T056 all `[P]`). Then composite components (T039, T040, T049, T050, T057). Then `T058` ties everything together.
- **Phase 4 (US2)**: T059 `[P]` → T060 → T061 → T062 `[P]` → T063 → T064.
- **Phase 5 (US3)**: T065 → T066 → T067 `[P]` → T068 → T069.
- **Phase 6 (US4)**: T070 → (T071 `[P]` + T072 `[P]`) → T073 → T074.
- **Phase 7 (US5)**: T075 `[P]` → T076 `[P]` → T077 `[P]` → T078 → T079.
- **Phase 8 (US6)**: T080 `[P]` → T081 → T082.
- **Phase 9 (US7)**: T083 `[P]` → T084.
- **Phase 10 (US8)**: T085 → T086 → T087.
- **Phase 11**: T088–T099 all `[P]` (different files). T100–T105 sequential gates. T106 `[P]` optional.

### Story dependencies

- **US1 (P1)**: Independent — establishes the workspace and the read path.
- **US2 (P1)**: Reuses US1's `Transcript` + `Inspector` components and adds the stack push/pop layer. Cannot ship without US1's transcript surface.
- **US3 (P2)**: Independent of US2; depends only on US1's focus state and overlay scaffolding (US3 introduces Turn Jumper).
- **US4 (P2)**: Independent of US3/US5; depends on US1's transcript header and body.
- **US5 (P2)**: Independent of US3/US4; depends on US1's session-load path.
- **US6 (P3)**: Independent of US3/US4/US5; depends on US1's header (Report button).
- **US7 (P3)**: Depends on US2's drill machinery; very small addition.
- **US8 (P3)**: Largely already wired by Phase 2 (`useWorkspace` + `App.tsx`); only verification tasks.

### Parallel opportunities

- All `[P]` tasks within a phase can run concurrently across multiple developers or one developer using parallel agents.
- After Phase 2 completes, three developers could split: A→US1+US2 (MVP), B→US3+US5, C→US4+US6.
- Phase 11 unit + smoke tests (T088–T099) are entirely parallelizable.

---

## Parallel Example: Phase 2 lib helpers

```bash
# Launch all pure-helper tasks in parallel (different files, no inter-deps):
Task: "Create packages/ui/src/lib/types.ts" (T005)
Task: "Create packages/ui/src/lib/format.ts" (T006)
Task: "Create packages/ui/src/lib/classnames.ts" (T007)
Task: "Create packages/ui/src/lib/toolArgs.ts" (T008)
Task: "Create packages/ui/src/lib/classifyUserText.ts" (T009)
Task: "Create packages/ui/src/lib/markdown.tsx" (T010)
Task: "Create packages/ui/src/lib/shortcuts.ts" (T011)
Task: "Create packages/ui/src/components/ui/icons.tsx" (T012)
```

## Parallel Example: User Story 1 component shells

```bash
# All independent component shells for US1 land in parallel:
Task: "Create components/layout/Workspace.tsx" (T033)
Task: "Create components/layout/StatusBar.tsx" (T034)
Task: "Create components/sidebar/Brand.tsx" (T035)
Task: "Create components/sidebar/SearchButton.tsx" (T036)
Task: "Create components/sidebar/CostTooltip.tsx" (T037)
Task: "Create components/sidebar/SessionRow.tsx" (T038)
Task: "Create components/transcript/TranscriptHeader.tsx" (T041)
Task: "Create components/transcript/TranscriptNavBar.tsx" (T042)
Task: "Create components/transcript/TurnDivider.tsx" (T043)
Task: "Create components/transcript/UserPrompt.tsx" (T044)
Task: "Create components/transcript/blocks/BlockText.tsx" (T045)
Task: "Create components/transcript/blocks/BlockThinking.tsx" (T046)
Task: "Create components/transcript/blocks/BlockToolCapsule.tsx" (T047)
Task: "Create components/transcript/blocks/BlockDiff.tsx" (T048)
Task: "Create components/inspector/CrumbStrip.tsx + MetricsRow.tsx" (T051)
Task: "Create components/inspector/InspectorEmpty.tsx" (T052)
Task: "Create components/inspector/InspectorRequest.tsx" (T053)
Task: "Create components/inspector/InspectorUser.tsx" (T054)
Task: "Create components/inspector/InspectorTool.tsx" (T055)
Task: "Create components/inspector/InspectorDiff.tsx" (T056)
```

---

## Implementation Strategy

### MVP first (P1 = US1 + US2)

1. Phase 1 (Setup, T001–T004) — clean the slate, port design tokens, confirm backend untouched.
2. Phase 2 (Foundational, T005–T032) — every shared helper + store + hook + the App shell.
3. Phase 3 (US1, T033–T058) — three-pane workspace with reading + focus + inspector.
4. Phase 4 (US2, T059–T064) — subagent drill stack.
5. **STOP AND VALIDATE**: walk the US1 + US2 acceptance scenarios from `spec.md` against the working app. This is the MVP — demoable.

### Incremental delivery after MVP

6. US3 (T065–T069) — keyboard navigation. Independent shipping moment.
7. US4 (T070–T074) — live tail. Independent.
8. US5 (T075–T079) — search. Independent.
9. US6 (T080–T082) — session report. Independent.
10. US7 (T083–T084) — inspector subagent CTA. Small addition.
11. US8 (T085–T087) — theme/density verification. Mostly already working.

### Parallel team strategy

With three developers:

- **Dev A**: Phase 1 + Phase 2 lib/api layers; then US1 transcript + inspector.
- **Dev B**: Phase 2 stores + hooks; then US1 sidebar + header; then US3 (keyboard + jumper).
- **Dev C**: Phase 2 App shell + shadcn primitives; then US2 subagent stack; then US5 (search).
- After MVP: US4, US6, US7, US8 split across the team in any combination.
- Phase 11 polish: any dev can pick up any [P] test or perf task.

---

## Notes

- [P] tasks = different files, no incomplete dependencies.
- [Story] label maps a task to a specific user story for traceability; setup/foundational/polish phases have no label.
- Each user story should be independently completable and testable end-to-end.
- Commit after each task or each logical group (lib helpers, stores, etc.).
- The backend (`packages/server/**`) and shared types (`packages/shared/**`) MUST remain unchanged by this feature. SC-009 is the contract — if a UI task tempts you to edit the server, surface it as a deferred backend follow-up per `contracts/ui-backend.md` instead.
- Don't reintroduce old UI code patterns "just in case" — the spec said "start from scratch."
