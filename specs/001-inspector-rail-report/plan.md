# Implementation Plan: Inspector-Only Right Rail, Session Report Modal, and Sidebar Alignment

**Branch**: `001-inspector-rail-report` | **Date**: 2026-05-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-inspector-rail-report/spec.md`

## Summary

Refactor the workspace UI on three axes that already share underlying data — none of which require new server work:

1. **Right rail becomes Inspector-only.** Strip the three-tab strip (`Inspector / Tokens / Files`) from `RightRail.tsx`; render `<Inspector />` directly with its existing empty state. The session-wide Tokens and Files surfaces move into the new Session Report modal. `TokensPanel` and `FilesPanel` stay in the codebase but become unreachable.
2. **Session Report modal expanded and re-entry-pointed.** The existing `SessionReportDrawer.tsx` already renders the four stat cards + `By agent & model` table from the `/api/sessions/:id/report` payload. Add two new sections — `Usage over time` (sparkline + spike cards from `tokenSeries`) and `Files touched` (one row per file from `fileTouchIndex`, ordered by reads+writes desc) — that source from the existing `SessionDetailResponse.tokenSeries` and `fileTouchIndex` projections. Move the modal trigger out of `TranscriptHeader`'s local state into a single shell-level `sessionReportOpen` flag in `useUIStore`; add the `r` keyboard shortcut with the documented suppression rules (search palette open / bottom sheet open / typing in input) and the Escape priority chain (report → search → sheet → clear Inspector selection). Add focus trap + focus restoration as specified.
3. **Sidebar visual alignment with the v2 prototype.** Replace `SessionBrowser` header (`Sessions` title + `Newest first` toggle) with v2's brand badge (`C`) + `Transcripts` label + overflow icon-button + full-width search button (opens the existing search palette). Compact `SessionRow` (≈32–36px tall, indented under project header, no card border; accent-soft background + 2px left accent border for active). Project headers become small-caps. The overflow icon-button hosts the sort toggle. All existing functional sidebar behavior (selection, pinning, sort, project collapse, live indicator, token tooltip, empty/loading/error copy) is preserved — only the visual layer changes.

All three changes are frontend-only. No new server endpoints, no new shared types, no new file watchers. The `SessionReport`, `TokenSeries`, and `FileTouchIndex` shapes in `packages/shared/src/types.ts` already carry everything required.

## Technical Context

**Language/Version**: TypeScript 5.8 (strict). React 19, Node.js ≥ 20 (engines field).

**Primary Dependencies**: React 19, Tailwind CSS 4 + shadcn/ui copy-paste (existing Dialog, Tooltip, Popover, Button primitives), Zustand 5 (existing `useUIStore` / `useNavigationStore` / `useSearchStore`), react-virtuoso 4 (transcript pane, untouched), lucide-react icons. Backend (Hono 4 / better-sqlite3 / chokidar) is untouched.

**Storage**: Existing `localStorage` keys (`cc-viewer:theme`, `cc-viewer:rightRailOpen`, `cc-viewer:pinned-sessions`, etc.). No new persistent state. The expanded/collapsed state of project sections stays in-memory (`useUIStore.expandedProjectSections`). `sessionReportOpen` is intentionally **not** persisted (per spec: report is "lightweight, flick open and away").

**Testing**: Vitest 4 + jsdom + @testing-library/react. Existing test patterns live next to source (`*.test.tsx`). Acceptance scenarios drive new tests; the existing `RightRail.test.tsx`, `TranscriptHeader`-affected tests, `SessionRow.test.tsx`, `SessionBrowser.test.tsx`, `useKeyboardShortcuts.test.ts` are updated to match the new contracts.

**Target Platform**: Browser SPA served by the Hono dev server (`npm run dev:ui` + `npm run dev:server`). Same supported browsers as the rest of the app (modern evergreen).

**Project Type**: Web-application monorepo. UI changes live entirely under `packages/ui/`; `packages/shared/` and `packages/server/` are not modified.

**Performance Goals**: Modal must open within one frame of the trigger (no network call — `/api/sessions/:id/report` is fetched on open but the UI shell renders the modal shell + skeleton immediately; report data is already cached on the open session in normal flow). Sidebar refactor must not introduce per-keystroke or per-scroll re-renders beyond the current baseline; the v2 grouping algorithm is the same code path, so this is verified by keeping existing memoization (`useMemo(() => groupAndSort(...))`).

**Constraints**: 10k+ message sessions must remain interactive; the modal must not block the transcript virtualizer (Radix Dialog already portals + uses overflow:hidden on body while open). Width cap on the modal: `min(960px, 100%)` per FR-007. Empty/zero-data state still opens the modal (FR-015a). Privacy is unaffected — all data already on the client.

**Scale/Scope**: Single feature delivery against an in-flight branch. Affects ≈8–12 components in `packages/ui/src/components/{layout,sidebar,inspector,transcript}/` and one store (`useUIStore`) and one hook (`useKeyboardShortcuts`). No new packages, no new public types, no new server routes.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Principle I — Local-First Privacy (NON-NEGOTIABLE)

**Compliance**: PASS. All three sub-features are client-side only. The modal reads `/api/sessions/:id/report` and the in-memory `SessionDetailResponse` already cached for the open session. No new outbound calls, no new disk reads, no telemetry. CSV export uses `URL.createObjectURL` + an anchor click — fully local, identical to current behavior.

### Principle II — Scale by Default

**Compliance**: PASS.

- Transcript virtualization (`react-virtuoso`) is untouched.
- The modal renders a bounded view: ≤ ~20 report rows in practice, exactly 4 stat cards, a sparkline of ≤ N points (one per assistant turn, capped naturally), and ≤ ~50 file rows in practice. No virtualization required.
- Sidebar continues to render one row per session via existing flat `<SessionRow />` mapping; no perf regression.
- The `r` shortcut, focus trap, and Escape priority chain are O(1) per keypress.

### Principle III — Single-Command Distribution

**Compliance**: PASS. No new runtime dependencies. All needed primitives (Dialog, Tooltip, Popover, focus trap via Radix) already vendored in shadcn/ui copy-paste under `packages/ui/src/components/ui/`. No new icons.

### Principle IV — Source-File Read-Only

**Compliance**: PASS. Feature touches only UI source files and one client store. `~/.claude/projects/` is not accessed at all.

### Principle V — Simplicity & Surgical Changes

**Compliance**: PASS.

- **Surgical**: every changed line traces to an FR. `RightRail` loses its tab strip and three buttons (FR-001..FR-006). `SessionReportDrawer` gains two sections (FR-008, FR-014, FR-015) and an empty-state branch (FR-015a). `TranscriptHeader` hands off the open-state to the shell. `SessionBrowser`/`ProjectSection`/`SessionRow` change visual classes (FR-025..FR-034); their data flow is unchanged (FR-038).
- **No speculative abstractions**: The `Usage over time` sparkline reuses `tokenSeries.points`/`tokenSeries.spikes`. The `Files touched` rows reuse `fileTouchIndex.files`. The CSV exporter, KPI card, and table cells already exist; only the section wrapper and ordering helper are new.
- **No follow-on cleanup baked in**: removing `TokensPanel.tsx` / `FilesPanel.tsx` is explicitly listed in the spec's Assumptions as a follow-up — out of scope for this plan.
- **No new configurability**: shortcut key, modal width, weighting multipliers, and the v2 brand label are all fixed by spec.

### Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| _none_    | _n/a_      | _n/a_                                |

## Project Structure

### Documentation (this feature)

```text
specs/001-inspector-rail-report/
├── plan.md              # This file (/speckit-plan command output)
├── spec.md              # Feature specification (already created)
├── research.md          # Phase 0 — decisions and rationale (this run)
├── data-model.md        # Phase 1 — entities consumed by the feature
├── quickstart.md        # Phase 1 — manual verification walkthrough
├── contracts/
│   └── ui-contracts.md  # Phase 1 — UI surfaces this feature exposes
└── tasks.md             # Phase 2 output (NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
packages/ui/src/
├── components/
│   ├── layout/
│   │   └── AppShell.tsx                       # Mounts <SessionReportModal/> at shell level (was triggered from header)
│   ├── inspector/
│   │   ├── RightRail.tsx                      # Tab strip removed; renders <Inspector /> directly
│   │   └── InspectorEmpty.tsx                 # Copy stays; verify SC-006 (no "Tokens"/"Files"/"tabs"/"moved")
│   ├── transcript/
│   │   ├── TranscriptHeader.tsx               # Report button reads/writes useUIStore.sessionReportOpen
│   │   ├── SessionReportDrawer.tsx            # +UsageOverTimeSection, +FilesTouchedSection, +empty-state branch, +focus trap
│   │   └── (new) SessionReportUsageOverTime.tsx   # Sparkline + min(N,3) spike cards (extracted for readability)
│   │   └── (new) SessionReportFilesTouched.tsx    # File rows w/ read/write pips + CHANGED tag, sorted reads+writes desc
│   └── sidebar/
│       ├── SessionBrowser.tsx                 # New header: brand badge + Transcripts + overflow + search button
│       ├── ProjectSection.tsx                 # Small-caps treatment for the project header
│       └── SessionRow.tsx                     # Compact (≈32–36px), indented, accent-soft active state
├── stores/
│   └── useUIStore.ts                          # +sessionReportOpen, +setSessionReportOpen, +toggleSessionReportOpen
└── hooks/
    └── useKeyboardShortcuts.ts                # +'r' with suppression (search/sheet) and Escape priority chain
```

**Structure Decision**: The codebase is an npm workspaces monorepo with three packages (`packages/server`, `packages/shared`, `packages/ui`). This feature is **UI-only** and stays inside `packages/ui/`. Server and shared types are not touched. The "Option 2 (Web application)" template variant is the loose analogue, but the concrete layout above replaces the template's placeholder tree.

## Complexity Tracking

> No constitution violations. Section intentionally empty.
