# Workspace.html — Change brief for code agent

Hand-off summary of changes made to the Workspace prototype since the previous version. Implement these in the production codebase.

---

## Why

Two issues with the previous right-rail design:

1. **Mode inconsistency.** The right rail had three tabs — Inspector, Tokens, Files. Inspector follows whatever the user clicks in the middle panel (contextual). Tokens and Files describe the entire session and never change while the user navigates. Putting all three behind the same tab strip implied they behaved the same way; they did not.
2. **Missing data.** The token consumption report (Duration / Tool calls / Cache hit rate / Total units + per-agent/per-model weighted breakdown table) that existed in the previous design was not present in the new one. Users rely on it to compare session effectiveness.

---

## What changed

### 1. Right rail is now Inspector-only

- Removed the tab strip (`Inspector` / `Tokens` / `Files`) at the top of the rail.
- The rail is now a single, always-Inspector surface. It renders:
  - The Inspector view when a tool capsule or diff is selected in the transcript.
  - A quiet empty state (icon + "Click any tool capsule or diff…") otherwise.
- Deleted props from `RightRail`: `session`, `onJumpToTurn`, `forceTab`, `onTabChange`, `onOpenReport`. New signature: `RightRail({ activePart, activeDiff, onJumpBack, onClose })`.
- The empty state no longer references "Tokens" or "Files" or explains where they went. It only describes the Inspector itself.
- `TokensPanel` and `FilesPanel` components are now unused (kept exported on `window` for now; safe to delete once nothing else references them).

### 2. Session report — new modal

A new component `SessionReport` lives in `workspace-report.jsx`. It is a centered modal containing all session-scoped information. Contents, in order:

1. **Header** — title of the session + subtitle ("Tokens grouped by agent and model. Units are model-relative weights (not USD) — stable across price changes.") + close button.
2. **Four stat cards** in a 4-column grid:
   - Duration · sub: "first → last turn"
   - Tool calls · sub: "main N · sub N"
   - Cache hit rate · sub: "read / (read + create + input)"
   - Total units · sub: "weighted, all agents"
3. **By agent & model** table — columns: Agent, Model, Input (1.0×), Cache 5m (1.25×), Cache 1h (2.0×), Cache rd (0.1×), Output, Cache hit, Units. Each numeric cell shows raw count on top and weighted unit cost beneath. Includes an "Export CSV" action and a short multiplier-legend caption.
4. **Usage over time** — sparkline of units per turn + three "spike turn" cards.
5. **Files touched** — one row per file with read/write timeline pips and a CHANGED tag where applicable.

Data sources are the existing `TOKEN_REPORT` (in `data.jsx`) and `WS_ACTIVE.files` (in `workspace-data.jsx`). No new data shapes were introduced.

### 3. Entry points — kept intentionally small

There are **two** ways to open the report. Do not add more:

- A **"Report"** icon-button in the workspace header (right side, between the metric chips and the theme toggle). Uses the `chart` icon.
- The **`r`** keyboard shortcut (toggle).

The report closes on backdrop click, on its own X button, and on `Escape`.

### 4. Workspace header

- Added the **Report** button described above.
- Added `r` to the keyboard-hint strip at the bottom of the workspace ("r report").
- The existing in/out/cache/hit `MetricChip` row in the header is unchanged.

### 5. Workspace shell state

In `workspace-app.jsx` (`Workspace` component):

- Removed `forceRailTab` / `setForceRailTab` state and all references. The rail no longer has tabs.
- Added `reportOpen` / `setReportOpen` state.
- `onPickTool` and `onPickDiff` no longer call `setForceRailTab("inspector")` — the rail is always the inspector.
- Keyboard handler:
  - Added `r` → toggle `reportOpen`.
  - `Escape` priority is now: close `reportOpen` first, then `searchOpen`, then `sheetOpen`, then `onCloseInspector()`.
- Renders `<SessionReport open={reportOpen} onClose={...} />` once, at the end of the shell.

### 6. Mobile / narrow bottom sheet

The bottom-sheet variant of the rail is also Inspector-only now. The "Inspector" floating action button still opens it. The report opens as a full-screen modal on narrow viewports (no special mobile handling needed — `width: min(960px, 100%)` already caps it).

---

## Files touched

| File | Change |
| --- | --- |
| `workspace-report.jsx` | **New.** `SessionReport` modal + sub-components (`ReportStatCard`, `ReportTokenTable`, `ReportSection`, `ReportFileRow`, `ReportSparkline`, `SpikeMini`). |
| `workspace-rail.jsx` | Removed the tab strip + tab state. `RightRail` is now thin: header-less, renders `Inspector` or `InspectorEmpty`. Simplified `InspectorEmpty` to a quiet placeholder. |
| `workspace-app.jsx` | Added Report button in header + `reportOpen` state + `r` shortcut + Escape priority. Removed `forceRailTab` plumbing. Updated `RightRail` call sites. Added `<SessionReport>` render at the bottom of the shell. |
| `Workspace.html` | Added `<script type="text/babel" src="workspace-report.jsx">` between `workspace-inspector.jsx` and `workspace-rail.jsx`. |

No data files, tokens.css, or icons were modified.

---

## Acceptance checklist

- [ ] Right rail has no tab strip — just the Inspector or its empty state.
- [ ] Header has a single "Report" button; pressing `r` opens/closes the same modal.
- [ ] Modal shows the four stat cards (Duration / Tool calls / Cache hit rate / Total units) with the correct sub-labels.
- [ ] Modal table columns and multipliers match exactly: Input (1.0×), Cache 5m (1.25×), Cache 1h (2.0×), Cache rd (0.1×), Output, Cache hit, Units.
- [ ] Modal includes Usage-over-time and Files-touched sections.
- [ ] Backdrop click, X button, and Escape all close the modal.
- [ ] No reference in any empty state or copy to "the old Tokens/Files tabs" or what moved where.
