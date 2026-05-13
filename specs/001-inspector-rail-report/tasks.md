# Tasks: Inspector-Only Right Rail, Session Report Modal, and Sidebar Alignment

**Input**: Design documents from `/specs/001-inspector-rail-report/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ui-contracts.md, quickstart.md

**Tests**: Included. The contracts document (`contracts/ui-contracts.md` §C5) maps every functional requirement to a specific test file. These are required deliverables, not optional, because the existing test suite is the gate that defends FR-038 ("only the visual layer changes").

**Organization**: Tasks are grouped by user story. The four user stories map directly to the four concerns in the spec: (US1) Inspector-only rail, (US2) Session Report content, (US3) Open/dismiss UX, (US4) Sidebar visual alignment. US1/US2 are P1; US3/US4 are P2.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- File paths are absolute from the repo root unless noted

## Path Conventions

This is an npm-workspaces web monorepo. All affected source lives under `packages/ui/src/`. `packages/shared/` and `packages/server/` are not touched.

---

## Phase 1: Setup

**Purpose**: This is an in-flight feature branch (`001-inspector-rail-report`). No project init is required — workspaces, deps, and tooling are already installed. The only setup step is verifying the dev environment runs.

- [X] T001 Verify dev environment boots: run `npm install` at repo root (idempotent), then `npm run dev:server` and `npm run dev:ui` in parallel; load `http://localhost:5173/` and confirm the existing app loads against `~/.claude/projects/`. Stop both processes after verification.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shell-level state and shortcut wiring required by US2, US3, and (indirectly) US1.

**⚠️ CRITICAL**: T002 unblocks US2 and US3. T003 is a sanity check for US4. No user-story work may merge until this phase is green.

- [X] T002 Add `sessionReportOpen: boolean` plus `setSessionReportOpen(v: boolean)` and `toggleSessionReportOpen()` actions to `packages/ui/src/stores/useUIStore.ts`. Default `false`. Do NOT persist to localStorage (per data-model §2.1). Update `packages/ui/src/stores/useUIStore.test.ts` to cover the new flag and both actions.
- [X] T003 [P] Confirm `toggleSort()` already exists on `useUIStore` (per research D7 — sort move into overflow popover). If absent, add a `toggleSort()` action that flips an existing sort field and cover it in `packages/ui/src/stores/useUIStore.test.ts`. If present, leave it untouched and note that in the commit message.

**Checkpoint**: Foundation ready — user stories can proceed.

---

## Phase 3: User Story 1 — Inspector-only right rail (Priority: P1) 🎯 MVP

**Goal**: The right rail is a single, always-Inspector surface in both desktop and bottom-sheet variants. The tab strip and force-Inspector logic are deleted. The Inspector empty state copy is verified not to reference the removed tabs.

**Independent Test**: Quickstart §1. Open a session with nothing selected → rail shows Inspector empty state, no tab strip. Click a tool capsule → Inspector body for that capsule (still no outer tab strip). Click a diff → Inspector updates in one click. Resize narrow → bottom sheet shows same Inspector / empty state, no tabs.

### Tests for User Story 1

- [X] T004 [P] [US1] Update `packages/ui/src/components/inspector/RightRail.test.tsx` to assert C1 invariants: (a) `queryByRole('tablist')` returns `null` with and without a selection; (b) empty-state status element has `aria-label="Tool inspector — no selection"`; (c) body text of `InspectorEmpty` contains none of the substrings `'Tokens'`, `'Files'`, `'tabs'`, `'tab'`, `'moved'`. Delete any pre-existing test that asserts "force Inspector tab on selection".
- [X] T005 [P] [US1] Update or add a test in `packages/ui/src/components/inspector/InspectorEmpty.test.tsx` to lock in the SC-006 copy invariant (no `'Tokens' | 'Files' | 'tabs' | 'tab' | 'moved'` substrings).

### Implementation for User Story 1

- [X] T006 [US1] Strip the tab strip from `packages/ui/src/components/inspector/RightRail.tsx`: delete the `Tab` type, `TABS` constant, `tab` `useState`, and the `useEffect` that forces tab='inspector' on `selectedInteractionId`. Reduce the component to `<aside aria-label="Inspector rail">` rendering `<Inspector />` directly (which already renders `<InspectorEmpty />` when no interaction is selected). Remove now-unused imports.
- [X] T007 [US1] Verify `packages/ui/src/components/inspector/InspectorEmpty.tsx` copy already satisfies FR-004 / SC-006. If any of `'Tokens' | 'Files' | 'tabs' | 'moved'` appears in the rendered body, edit to remove. No new copy is required — only delete offending phrases.
- [X] T008 [US1] Verify the bottom-sheet variant in `packages/ui/src/components/layout/AppShell.tsx` mounts `<RightRail />` (and therefore inherits T006 automatically). No change should be required; if any narrow-only tab markup exists, delete it. Re-run `packages/ui/src/components/layout/AppShell.test.tsx` to confirm.

**Checkpoint**: US1 is fully functional and testable independently. The rail is Inspector-only in both viewports.

---

## Phase 4: User Story 2 — Session Report content (Priority: P1)

**Goal**: The Session Report modal renders, in order: header → 4 stat cards → 9-column breakdown table → multiplier caption → CSV export → "Usage over time" section (sparkline + spike cards) → "Files touched" section. The modal opens in a `min(960px, 100%)` centered dialog. When the session has zero data, the modal still opens with `—` cards, a single "No usage recorded yet" row, and empty captions in both new sections.

**Independent Test**: Quickstart §3 and §5. Open the modal on a non-empty session: every section renders with the exact strings from `contracts/ui-contracts.md` §C2, the CSV exports correctly, file rows are sorted reads+writes desc with first-touched asc tiebreak, spike cards count = `min(turns_with_non_zero_usage, 3)`. Open on an empty session: modal still opens with all `—` and empty captions.

**Dependency**: T002 (foundational store flag).

### Tests for User Story 2

- [X] T009 [P] [US2] Create `packages/ui/src/components/transcript/SessionReportDrawer.test.tsx` with test cases asserting C2 invariants on a non-empty fixture: (a) four stat cards in spec order with exact `label`/`sublabel` strings; (b) breakdown table has exactly 9 columns in spec order with exact multiplier strings (`Input (1.0×)`, `Cache 5m (1.25×)`, `Cache 1h (2.0×)`, `Cache rd (0.1×)`); (c) numeric cells render raw count above weighted unit value; (d) multiplier caption contains `input ×1.0 · cache 5m ×1.25 · cache 1h ×2.0 · cache read ×0.1`; (e) Export CSV button has `aria-label="Export session report as CSV"` and triggers a download whose filename is `session-{sessionId}-report.csv`; (f) close button has `aria-label="Close"` and dismisses on click; (g) Escape and backdrop click also dismiss; (h) on open, focus lands on the close button; (i) `userEvent.tab()` cycles within the dialog. Use existing test-utils for store hydration.
- [X] T010 [P] [US2] Add a "Usage over time" section group of tests to `SessionReportDrawer.test.tsx`: (a) sparkline `<svg>` has `role="img"` and `aria-label="Sparkline of units per turn"`; (b) caption is `Units per turn · {N} turns`; (c) spike-card count equals `min(turns_with_non_zero_usage, 3)` across three fixtures: `series.spikes.length=3`, `series.spikes.length=0 with 2 non-zero points`, `series.spikes.length=0 with 0 non-zero points` (last case → empty caption `No usage to chart yet.`).
- [X] T011 [P] [US2] Add a "Files touched" section group of tests to `SessionReportDrawer.test.tsx`: (a) section heading is `Files touched · {N}` where N is total files; (b) given a fixture with three files of differing reads+writes counts AND two tied on activity with different first-touched timestamps, assert that the rendered row order matches reads+writes desc then first-touched asc; (c) `CHANGED` tag appears only when `file.changed === true`; (d) row footer text is `{reads}r · {writes}w · L {lineCount?}`; (e) empty-index fixture renders caption `No files were read or written in this session.`.
- [X] T012 [P] [US2] Add an empty-state group of tests to `SessionReportDrawer.test.tsx` for FR-015a: fixture with `totalUnits===0`, `toolCalls.total===0`, `durationMs===0`, `rows.length===0`. Assert: modal still opens; all four stat-card values render `—`; table body renders a single `<tr>` with `colSpan={9}` and text "No usage recorded yet"; CSV button is hidden; Usage section renders the `No usage to chart yet.` caption; Files section renders the `No files were read or written in this session.` caption.
- [X] T013 [P] [US2] Update `packages/ui/src/components/transcript/TranscriptHeader.test.tsx` to cover FR-016: the chart-icon button (`aria-label="Session token report"`) appears between the metric chips group and the theme toggle, and clicking it calls `useUIStore.getState().setSessionReportOpen(true)`. Remove any test asserting that `TranscriptHeader` owns local `reportOpen` state.

### Implementation for User Story 2

- [X] T014 [P] [US2] Create `packages/ui/src/components/transcript/SessionReportUsageOverTime.tsx`. Exported component takes the `TokenSeries` projection plus the empty-state flag and renders: caption `Units per turn · {N} turns`, an inline SVG sparkline (`role="img"`, `aria-label="Sparkline of units per turn"`) over `points[]`, and a row of spike cards using the helper `spikeCards(series)` from `data-model.md` §3.2 (top of `series.spikes`, fall back to non-zero `points` sorted by `input+output+cacheCreate` desc, capped at 3). When zero non-zero points, render only the muted caption `No usage to chart yet.`.
- [X] T015 [P] [US2] Create `packages/ui/src/components/transcript/SessionReportFilesTouched.tsx`. Exported component takes the `FileTouchIndex` and renders: heading `Files touched · {N}` (N = total files), then one row per file ordered by the `orderFilesForReport(files)` helper from `data-model.md` §3.3 (reads+writes desc, ties broken by min(read/write timestamp) asc). Each row shows basename bold + dir muted, `CHANGED` tag when `file.changed === true`, a horizontal timeline of read pips (user-rail tint) + write pips (accent), and footer `{reads}r · {writes}w · L {lineCount?}`. When `files.length === 0`, render only the caption `No files were read or written in this session.`.
- [X] T016 [US2] Update `packages/ui/src/components/transcript/SessionReportDrawer.tsx`: (a) replace `open`/`onOpenChange` local-prop wiring with reads/writes of `useUIStore.sessionReportOpen` and `setSessionReportOpen`; (b) change `<DialogContent>` max-width class from `!max-w-5xl` to `!max-w-[960px]` and keep `w-[calc(100%-2rem)]` (FR-007); (c) add an `isReportEmpty(report)` predicate (per data-model §3.1) and, when true, force all four stat-card values to `—`, render a single `<tr><td colSpan={9}>No usage recorded yet</td></tr>` in place of agent/model rows, and hide the Export CSV button; (d) add the new `<SessionReportUsageOverTime />` and `<SessionReportFilesTouched />` sections after the multiplier caption, sourcing `tokenSeries` and `fileTouchIndex` via a colocated `useActiveDetailProjections()` selector that reads from the existing `useSession(activeSessionId)` cache; (e) set initial focus to the close button via a `ref` + `requestAnimationFrame` after open (FR-021a); (f) pass `onEscapeKeyDown={(e) => e.preventDefault()}` to `<DialogContent>` so the central `useKeyboardShortcuts` arbiter is the only path that closes the modal (research D5).
- [X] T017 [US2] Update `packages/ui/src/components/transcript/TranscriptHeader.tsx`: delete the local `reportOpen` `useState`; wire the chart-icon Report button's `onClick` to `useUIStore.getState().setSessionReportOpen(true)`. Keep the button's `aria-label`, icon (`BarChart3`), and placement (between metric chips and theme toggle). Do not render `<SessionReportDrawer />` from here — mounting moves to `AppShell` in US3.

**Checkpoint**: US2 is fully functional. The report renders correctly from any current entry point — even before US3's centralized open/close UX lands, the existing trigger keeps working.

---

## Phase 5: User Story 3 — Open and dismiss the report quickly (Priority: P2)

**Goal**: Exactly two entry points (header button — already wired in T017 — and the `r` shortcut). Exactly three dismissals (backdrop, X, Escape). The `r` shortcut is suppressed in inputs, when the search palette is open, or when the bottom sheet is open. Escape obeys the strict priority chain: report → search → sheet → clear Inspector selection. The status bar shows the `r report` hint. The modal is mounted once at the shell level. Focus returns to the trigger on close.

**Independent Test**: Quickstart §2 and §4. Press `r` → opens; `r` again → closes; backdrop / X / Escape → close. With search palette + bottom sheet + Inspector selection all active, press Escape four times — modal closes first, then search, then sheet, then selection clears. Type `r` into the search input — letter `r` is typed, modal does NOT open. Look at the status bar — `r report` is listed.

**Dependency**: T002 (store flag), T016 (modal listens to store flag).

### Tests for User Story 3

- [X] T018 [P] [US3] Update `packages/ui/src/hooks/useKeyboardShortcuts.test.ts` with: (a) "r toggles sessionReportOpen when no overlay is in front and focus is not in an input"; (b) "r is suppressed when search palette is open" (no state change); (c) "r is suppressed when narrowSheetOpen is true"; (d) "r is suppressed when the active element is an input/textarea/contentEditable"; (e) "r is suppressed when any modifier key is held"; (f) "r is NOT suppressed by an active Inspector selection".
- [X] T019 [P] [US3] Add to `packages/ui/src/hooks/useKeyboardShortcuts.test.ts` an Escape priority test that drives the chain step by step: report → search → sheet → selection → focusedMsgIndex fallback. Verify only the first matching layer is consumed per keystroke (no batching).
- [X] T020 [P] [US3] Update `packages/ui/src/components/layout/StatusBar.test.tsx` to assert the keyboard hint strip contains a `<kbd>r</kbd> report` segment alongside the existing `j/k`, `/`, `⌘K`, `t`, `Esc` hints (FR-020).

### Implementation for User Story 3

- [X] T021 [US3] Mount `<SessionReportDrawer />` once at shell level inside `packages/ui/src/components/layout/AppShell.tsx`. Remove any prior mount from `TranscriptHeader.tsx` (already loosened in T017). The modal reads `sessionReportOpen` from `useUIStore` and renders regardless of which trigger opened it.
- [X] T022 [US3] Extend `packages/ui/src/hooks/useKeyboardShortcuts.ts`: add a case for `'r'` (lowercase, no modifiers) that toggles `useUIStore.getState().sessionReportOpen` via `toggleSessionReportOpen()`. Suppression rules (per contract C3 / research D5): bail early when target is an input/textarea/contentEditable, when any modifier is held, when `useSearchStore.getState().open === true`, or when `useUIStore.getState().narrowSheetOpen === true`. Do NOT call `preventDefault()` when suppressed.
- [X] T023 [US3] In `packages/ui/src/hooks/useKeyboardShortcuts.ts`, rewrite the Escape case to honor the ordered priority chain: (1) if `sessionReportOpen` → `setSessionReportOpen(false)`; (2) else if `useSearchStore.getState().open` → close search; (3) else if `narrowSheetOpen` → `setNarrowSheetOpen(false)`; (4) else if `selectedInteractionId !== null` → clear selection; (5) else → existing `focusedMsgIndex` fallback. Only the first matching branch executes per keystroke. Keep the existing "don't preventDefault on Escape" comment.
- [X] T024 [US3] Add the `r report` hint to `packages/ui/src/components/layout/StatusBar.tsx` keyboard-hint strip. Match the existing markup pattern for adjacent hints (e.g., `<kbd>r</kbd> report`).
- [X] T025 [US3] Static guard (FR-021 — entry-point cardinality): grep the `packages/ui/src/` tree for callers of `setSessionReportOpen(true)` and `toggleSessionReportOpen()`. Confirm only two call sites exist: the header Report button in `TranscriptHeader.tsx` (open) and the `r` case in `useKeyboardShortcuts.ts` (toggle). Document the audit in the commit message.

**Checkpoint**: US3 ships predictable open/close UX. Combined with US2, the report is fully usable end-to-end via keyboard and pointer.

---

## Phase 6: User Story 4 — Sidebar visual alignment with v2 (Priority: P2)

**Goal**: The sidebar header is brand badge (`C`) + `Transcripts` label + overflow icon-button + full-width search button. Project headers are small-caps. Session rows are compact, indented, accent-soft on active, with the pinned-star prefix. The sort toggle moves into the overflow popover. All existing functional behaviors (selection, pinning, sort, project collapse, live indicator, token tooltip, empty/loading/error copy) survive unchanged.

**Independent Test**: Quickstart §6 and §7. Side-by-side against `.design/v2/project/Workspace.html` Sidebar: header treatment, project-group treatment, row template, and active state match. Clicking the search button opens the same palette as `⌘K` / `/`. Sort toggle reachable from the overflow popover. Pin/unpin, live indicator, token tooltip, narrow drawer, empty/error/loading states all still work.

**Dependency**: T003 (sort action availability).

### Tests for User Story 4

- [ ] T026 [P] [US4] Update `packages/ui/src/components/sidebar/SessionBrowser.test.tsx` to cover the new header (FR-025..FR-027): brand badge present with letter `C`, `Transcripts` label visible, overflow icon-button rendered, full-width search button has placeholder `Search sessions, tools, files…` and shows a `⌘K` keyboard-hint `<kbd>`. Clicking the search button calls `useSearchStore.getState().open()`. Remove the obsolete tests asserting the `Sessions` title row and the `Newest first` toggle.
- [ ] T027 [P] [US4] Extend `packages/ui/src/components/sidebar/SessionBrowser.test.tsx` (or add) to cover the overflow popover (FR-035): clicking the overflow icon-button opens a popover with a single item whose label is `Sort: Newest first` or `Sort: Oldest first` depending on current sort, and clicking it calls `useUIStore.getState().toggleSort()`.
- [ ] T028 [P] [US4] Add `packages/ui/src/components/sidebar/ProjectSection.test.tsx` (new) covering FR-028: header renders as a button with chevron + folder icon + project name + right-aligned session count; classes apply the small-caps treatment (uppercase / tracking-wide / muted color); project name truncates with ellipsis on a single line.
- [ ] T029 [P] [US4] Update `packages/ui/src/components/sidebar/SessionRow.test.tsx` to cover FR-029..FR-034: row total height is substantially under 52px (assert via rendered class or computed padding); active row has `bg-accent-soft` (or equivalent token-driven class) and a 2px accent left-border, no box border; pinned row renders a `Star` icon prefixed before the title text; live row still shows the pulsing live indicator; the token-count span retains the four-way breakdown tooltip; title truncates with ellipsis on a single line.
- [ ] T030 [P] [US4] Confirm `packages/ui/src/components/layout/SidebarDrawer.test.tsx` still passes after the visual refactor; if it asserts old layout markup, update those assertions to match the new layout (FR-037 — drawer renders the same `<SessionBrowser />`).

### Implementation for User Story 4

- [ ] T031 [US4] Refactor `packages/ui/src/components/sidebar/SessionBrowser.tsx` header: replace the existing `Sessions` heading + `Newest first` toggle with two rows. Row 1: 22×22 accent-tinted square brand badge containing `C`, then `Transcripts` semibold label, then a `MoreHorizontal` icon-button (`lucide-react`). Row 2: a full-width `<button>` containing a `Search` icon (left), placeholder text `Search sessions, tools, files…`, and a right-aligned `<kbd>⌘K</kbd>`. Wire the button's `onClick` to `useSearchStore.getState().open()`. Preserve all body markup (project list, empty / loading / error states) and only change the header region.
- [ ] T032 [US4] In the same `SessionBrowser.tsx`, wire the overflow icon-button to a Radix `<Popover>` (reuse the primitive already in `packages/ui/src/components/ui/popover.tsx`) that hosts a single item labeled `Sort: Newest first` / `Sort: Oldest first` based on current sort state and dispatches `useUIStore.getState().toggleSort()` on click.
- [ ] T033 [US4] Restyle `packages/ui/src/components/sidebar/ProjectSection.tsx` header to render with the small-caps treatment per C4: uppercase, `tracking-wide`, font-size ≈10.5px, weight 600, color `var(--text-3)`. Layout: chevron (9–10px) + folder icon (11px) + project name + right-aligned session count. Project name MUST truncate with ellipsis on a single line (apply `truncate min-w-0`). Body item rendering unchanged.
- [ ] T034 [US4] Restyle `packages/ui/src/components/sidebar/SessionRow.tsx` to the compact v2 row per C4: total height ≈32–36px, padding-left ≈28px (indented), no card border/shadow. Active state: `bg-accent-soft` + `border-l-2 border-accent`. Title (line 1) 12–13px, single-line, ellipsized; when `pinnedSessions.has(session.sessionId)`, prefix the title with an accent-filled `Star` icon inline. Meta (line 2) mono, 10.5px, muted: `{ago} · {messageCount} msg · {compactNumber(totalUsage.total)}`. Preserve the token-count tooltip (four-way breakdown — FR-033) and the live indicator pulsing dot (FR-034 — may be repositioned to fit the new row). For unpinned rows, keep the existing hover-revealed star button.
- [ ] T035 [US4] Preserve the existing empty / loading / error copy and structure in `SessionBrowser.tsx` (FR-036) — restyle visually if needed to match the new language, but do NOT change strings or recovery actions. Confirm the existing copy `No Claude Code sessions found in ~/.claude/projects/. Run \`claude\` to start a session.` and the `Could not load sessions` / `Try again` flow render correctly after the refactor.

**Checkpoint**: US4 is independently shippable. The sidebar matches v2 visually; all behavior is preserved.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Verification of the spec's success criteria across all four user stories, plus the documented quickstart walkthrough.

- [X] T036 [P] Run `npm test` from the repo root and confirm the full Vitest suite is green. Investigate any newly-failing test not introduced by this feature. — 218 server + 284 UI tests pass.
- [ ] T037 [P] Execute the quickstart walkthrough at `specs/001-inspector-rail-report/quickstart.md` end-to-end against a freshly-loaded dev session. Check every item in the §"Sign-off checklist" at the bottom. Note any deviation in this task's commit message. — **Pending human**: requires running dev servers + a real Claude Code session in the browser.
- [X] T038 [P] String scan (SC-006): grep `packages/ui/src/components/inspector/InspectorEmpty.tsx` and any other empty-state surface for the substrings `'Tokens'`, `'Files'`, `'tabs'`, `'tab'`, `'moved'`. Confirm none of these appear in user-visible copy. — InspectorEmpty.tsx clean; only matches are in the unreachable orphan `TokensPanel`/`FilesPanel` components which spec.md:198 explicitly marks as out-of-scope follow-up cleanup.
- [ ] T039 [P] Visual review (SC-008): open `.design/v2/project/Workspace.html` and the running dev app side-by-side. Confirm the sidebar's header brand row, search button, project-group treatment, row layout, active state, and pinned-star prefix all match the prototype. Capture any mismatch as a follow-up note (out of scope for this feature unless trivial). — **Pending human**: requires browser-side visual diff.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup. T002 BLOCKS US2 and US3. T003 BLOCKS US4 (specifically T032).
- **US1 (Phase 3)**: Depends on Foundational only structurally (it has no real foundational dep — could start in parallel with Phase 2 if needed).
- **US2 (Phase 4)**: Depends on T002. Independent of US1.
- **US3 (Phase 5)**: Depends on T002 and T016 (US2's drawer must read from the store). Otherwise independent of US1 and US4.
- **US4 (Phase 6)**: Depends on T003. Independent of US1, US2, US3.
- **Polish (Phase 7)**: Depends on all desired user stories being complete.

### User Story Dependencies

- **US1 (P1)**: No cross-story dependencies. Pure deletion of rail tab strip.
- **US2 (P1)**: Depends only on the store flag (T002). Independent of US1, US3, US4.
- **US3 (P2)**: Depends on US2's modal listening to the store flag (T016 inside US2). Independent of US1 and US4.
- **US4 (P2)**: Independent of all other stories. Pure visual refactor of the sidebar.

### Within Each User Story

- Tests are written first where new (T009–T013, T018–T020, T026–T030); failing tests then drive the implementation.
- For US2: helpers and section components (T014, T015) can be written in parallel; the drawer integration (T016) consumes both.
- For US4: header refactor (T031, T032) can land independently of row/section restyling (T033, T034).

### Parallel Opportunities

- All [P] tasks within the same phase can run in parallel (different files, no inter-dependencies on incomplete tasks).
- After T002 + T003 land, US1, US2 (test scaffolding), and US4 can all proceed simultaneously by different developers.
- All four polish tasks (T036–T039) are [P] and can run concurrently.

---

## Parallel Example: User Story 2

```bash
# After T002 lands, kick off the test scaffolding in parallel:
Task: "T009 [P] [US2] Create SessionReportDrawer.test.tsx with C2 invariants"
Task: "T010 [P] [US2] Add Usage over time tests"
Task: "T011 [P] [US2] Add Files touched tests"
Task: "T012 [P] [US2] Add empty-state tests"
Task: "T013 [P] [US2] Update TranscriptHeader.test.tsx"

# In parallel, build the two new section components:
Task: "T014 [P] [US2] Create SessionReportUsageOverTime.tsx"
Task: "T015 [P] [US2] Create SessionReportFilesTouched.tsx"

# Then sequentially integrate:
Task: "T016 [US2] Update SessionReportDrawer.tsx"
Task: "T017 [US2] Update TranscriptHeader.tsx"
```

---

## Implementation Strategy

### MVP First (US1 + US2)

Both user stories at P1 — together they restore the previously-removed token-consumption report and fix the rail's mode confusion. Ship US1 first (it's a one-component deletion), then US2.

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: US1 → **STOP and VALIDATE** with Quickstart §1
4. Complete Phase 4: US2 → **STOP and VALIDATE** with Quickstart §3 and §5
5. Demo / merge to master if ready

### Incremental Delivery

1. US1 + foundational store flag → demo Inspector-only rail
2. US2 → demo Session Report content
3. US3 → demo predictable shortcuts + Escape priority
4. US4 → demo sidebar visual alignment with v2

Each phase delivers visible user value and can be reviewed independently.

### Parallel Team Strategy

After T002 + T003:

- Developer A: US1 (smallest scope; can ship same day)
- Developer B: US2 (largest scope; sections + tests + integration)
- Developer C: US4 (visual; independent of A and B)
- US3 picked up after US2 lands (depends on T016)

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks.
- [Story] label maps tasks to specific user stories for traceability.
- Each user story is independently testable per its Independent Test section.
- Existing tests for sidebar (SessionBrowser, SessionRow, SidebarDrawer) and inspector (RightRail, InspectorEmpty) carry the FR-038 / FR-006 / SC-009 contract that behavior cannot regress — update them in lockstep with implementation, do not delete coverage.
- Removing `TokensPanel.tsx` and `FilesPanel.tsx` from the codebase is explicitly out-of-scope (spec Assumptions); they remain unreachable but present.
- The `r` shortcut conflicts must be re-checked if other single-key shortcuts are added in adjacent branches (spec Assumptions list j, k, t, /, Escape as the existing set).
