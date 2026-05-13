# UI Contracts: Inspector-Only Right Rail, Session Report Modal, Sidebar Alignment

This project's external interface is the browser UI delivered by the Hono server's static-serving layer. There is no public API or library surface for this feature — the server's REST API is consumed only by this same UI. The contracts below capture the **UI-level invariants** other parts of the codebase (and the tests that gate them) rely on.

## C1. Right rail surface — `RightRail.tsx`

**Public DOM contract**:

- The root element MUST be an `<aside>` with `aria-label="Inspector rail"`.
- The root element MUST NOT contain any element with `role="tablist"`, `role="tab"`, or `role="tabpanel"` (FR-001).
- The root element MUST contain exactly one of:
  - The `<InspectorEmpty />` empty state (when `useNavigationStore.selectedInteractionId === null`), OR
  - The tool/diff Inspector body (when a selection exists).
- Both desktop and bottom-sheet variants (`AppShell.tsx` narrow branch) render the same `<RightRail />` — there is no narrow-specific tab variant (FR-006).

**Test invariants** (covered by `RightRail.test.tsx`):

1. With no selection, `queryByRole('tablist')` returns `null`.
2. With no selection, the empty-state status element is present (`getByRole('status', { name: 'Tool inspector — no selection' })`).
3. After dispatching a tool-capsule click that sets `selectedInteractionId`, the rail contains the Inspector body and `queryByRole('tablist', { name: 'Inspector rail tabs' })` still returns `null`.
4. The empty-state body text MUST NOT contain any of the substrings `'Tokens'`, `'Files'`, `'tabs'`, `'tab'`, `'moved'` (SC-006).

## C2. Session Report modal — `SessionReportDrawer.tsx`

**Public DOM contract**:

- Rendered via shadcn `<Dialog>`; `<DialogContent>` MUST be portalled and MUST trap focus while open (Radix default behavior; verified via `userEvent.tab()` cycling stays within the dialog).
- Initial focus MUST land on the close (X) button when the dialog opens (FR-021a).
- On close, focus MUST return to the trigger that opened it (Radix default), or to the document body when opened via `r` (FR-021a).
- Max width MUST be `min(960px, 100%)` (FR-007) — implemented as `!max-w-[960px] w-[calc(100%-2rem)]`.
- Section order MUST be: header → 4 stat cards row → `By agent & model` table → multiplier caption → `Usage over time` → `Files touched` (FR-008).

**Header**:

- Eyebrow label "Session report" (small uppercase mono, optional — preserves the v2 prototype's pattern).
- Title: the session's `title` (truncated with ellipsis on a single line).
- Subtitle: the literal string "Tokens grouped by agent and model. Units are model-relative weights (not USD) — stable across price changes." (FR-008).
- Close button: `aria-label="Close"`, dismisses the modal (FR-018).

**Four stat cards** (FR-009 — exact strings):

| Card | `label` | `sublabel` |
|------|---------|------------|
| 1 | `Duration` | `first → last turn` |
| 2 | `Tool calls` | `main {N} · sub {N}` |
| 3 | `Cache hit rate` | `read / (read + create + input)` |
| 4 | `Total units` | `weighted, all agents` (or `some models unknown` when `weightsMissing`) |

When the report is empty (FR-015a), all four `value` slots render `—` regardless of underlying integers.

**Breakdown table columns** (FR-010 — exact order, exact multipliers):

```
Agent | Model | Input (1.0×) | Cache 5m (1.25×) | Cache 1h (2.0×) | Cache rd (0.1×) | Output | Cache hit | Units
```

Numeric cells (FR-011): raw count on top, weighted unit cost below in muted mono. Renders `—` for the unit line when `weights === null`.

**Multiplier caption** (FR-013, exact text fragment): `input ×1.0 · cache 5m ×1.25 · cache 1h ×2.0 · cache read ×0.1`.

**Export CSV** (FR-012): a button with `aria-label="Export session report as CSV"` produces a download named `session-{sessionId}-report.csv` containing one row per (agent, model). Hidden when the report is empty.

**Usage over time** (FR-014):

- Caption above the sparkline: `Units per turn · {N} turns` where N = `tokenSeries.points.length`.
- Sparkline element: an `<svg>` with `role="img"` and `aria-label="Sparkline of units per turn"`.
- Spike cards row: `min(turns_with_non_zero_usage, 3)` cards. Each card shows `m{turnIndex+1}` (mono), a tokens value (abbreviated), and a short reason ("High input" / "High output" / "High cache create" — falls back to `High output` when synthesized).
- When zero non-zero turns: section renders a single muted caption `No usage to chart yet.`.

**Files touched** (FR-015):

- Heading: `Files touched · {N}` where N = total files (not the filtered count).
- One row per file in `fileTouchIndex.files`, ordered by `reads + writes` desc; ties broken by first-touched timestamp asc.
- Each row shows: filename (basename bold, dir muted), `CHANGED` tag when `file.changed === true`, a horizontal timeline of read pips (user-rail tint) + write pips (accent), and a footer `{reads}r · {writes}w · L {lineCount?}`.
- When the index is empty: section renders a single muted caption `No files were read or written in this session.`.

## C3. Entry points — `TranscriptHeader.tsx` + `useKeyboardShortcuts.ts`

**Header Report button** (FR-016):

- An icon-button (chart icon, `lucide-react`'s `BarChart3`) MUST appear between the metric chips group and the theme toggle.
- `aria-label="Session token report"` (existing) is preserved.
- `onClick` calls `useUIStore.setSessionReportOpen(true)`.

**Keyboard shortcut `r`** (FR-017):

- Single-keystroke `r` (lowercase, no modifiers) toggles `sessionReportOpen` when ALL of the following are true:
  1. The event target is not a form control (`<input>`, `<textarea>`, `contentEditable`).
  2. No modifier key is held (`metaKey || ctrlKey || altKey` ⇒ skip).
  3. `useSearchStore.getState().open === false`.
  4. `useUIStore.getState().narrowSheetOpen === false`.
- The `selectedInteractionId` value MUST NOT block `r` (an active Inspector selection is not an "overlay" — Clarifications).
- When suppressed, the handler MUST fall through (no `preventDefault()`), allowing the browser default to occur.

**Escape priority chain** (FR-019, ordered):

```
1. sessionReportOpen           → close report
2. searchStore.open            → close search palette
3. narrowSheetOpen             → close bottom sheet
4. selectedInteractionId !== null → clear Inspector selection
5. (fallback)                  → clear focusedMsgIndex
```

Only the first matching layer is consumed per keystroke (FR-019 "without skipping or batching").

**Status bar hint** (FR-020): The keyboard hint strip MUST contain a `<kbd>r</kbd> report` segment alongside the existing `j/k`, `/`, `⌘K`, `t`, `Esc` hints.

**Entry-point cardinality** (FR-021): Exactly two entry points exist — the header button and the `r` shortcut. No other DOM element in the workspace shell may dispatch `setSessionReportOpen(true)`.

## C4. Sidebar — `SessionBrowser.tsx` / `ProjectSection.tsx` / `SessionRow.tsx`

**Header row** (FR-025 / FR-026):

- Row 1 contains, left-to-right: a 22×22 square accent-tinted brand badge with the letter `C`, the label `Transcripts` (semibold), a spacer, and an overflow icon-button (`MoreHorizontal` / `lucide-react`).
- Row 2 contains a single full-width `<button>` with:
  - Search icon (left),
  - Placeholder text `Search sessions, tools, files…` (visually muted),
  - Right-aligned `<kbd>` element rendering `⌘K`.
- Row 2's `onClick` MUST call `useSearchStore.getState().open()` (FR-027).
- The previous "Sessions" title + "Newest first" toggle in the header are REMOVED.

**Overflow menu** (FR-035):

- Clicking the overflow icon-button opens a Radix `<Popover>` containing exactly one item: a sort-order toggle labeled `Sort: Newest first` / `Sort: Oldest first` that dispatches `useUIStore.toggleSort()`.

**Project-group header** (FR-028):

- Renders as `<button>` (full-width, hover-tinted): chevron (9–10px) + folder icon (11px) + project name + right-aligned session count.
- Text: uppercase, tracking-wide, font-size ≈10.5px, weight 600, color `var(--text-3)`.
- Project name MUST truncate with ellipsis on a single line — no wrap (Edge Case).

**Session row** (FR-029..FR-034):

- Total height substantially less than 52px (target ≈32–36px including padding).
- Padding-left ≈ 28px (indented under project header) — NOT a bordered card.
- Active state: `bg-accent-soft` + `border-l-2 border-accent`. No box border or shadow.
- Title (line 1): 12–13px, single line, ellipsized when overflowing. When `pinnedSessions.has(session.sessionId)`, a `Star` (accent fill) is prefixed inline before the title text.
- Meta (line 2): mono, 10.5px, muted: `{ago} · {messageCount} msg · {compactNumber(totalUsage.total)}`. The token-count span retains the existing Tooltip with the four-way breakdown (FR-033).
- Live indicator (FR-034): when `session.isLive === true`, a pulsing green dot at the row's top-right. Position may differ from the previous 12px-top/12px-right to fit the new compact row, but the affordance MUST remain.

**Unpin affordance**:

- For an UNpinned row: keep the existing hover-revealed star button so users can pin from the sidebar.
- For a PINNED row: the visible star prefix on the title IS the indicator; the inline button is still clickable to unpin (FR-032 — "the star itself indicates pinned state").

**Empty / loading / error states** (FR-036):

- Strings unchanged:
  - Loading: existing `<SidebarSkeleton />`.
  - Empty: heading "No sessions found", body "No Claude Code sessions found in `~/.claude/projects/`. Run `claude` to start a session."
  - Error: heading "Could not load sessions", body = `error.message`, recovery button "Try again".
- Restyled to match the new visual language but the copy and DOM landmarks (role=alert, etc.) are preserved.

**Narrow-viewport drawer** (FR-037):

- The same `<SessionBrowser />` is mounted inside `<SidebarDrawer />` — no separate component, no separate styling.

## C5. Acceptance-test mapping

| FR | Test file | Test (existing or new) |
|----|-----------|------------------------|
| FR-001..FR-006 | `RightRail.test.tsx` | "renders no tab strip with or without selection" (new), update existing "force-Inspector on selection" test to ensure it asserts NO tab transition |
| FR-007..FR-013 | `SessionReportDrawer.test.tsx` (new) | "renders 4 stat cards in spec order", "table has 9 columns in spec order", "CSV export downloads correctly named file" |
| FR-014 | `SessionReportDrawer.test.tsx` | "renders sparkline + min(N,3) spike cards", "empty when no non-zero turns" |
| FR-015 | `SessionReportDrawer.test.tsx` | "files sorted by reads+writes desc; ties by first-touched asc" |
| FR-015a | `SessionReportDrawer.test.tsx` | "modal opens with all-zero data — stat cards show —, table shows No usage recorded yet" |
| FR-016 | `TranscriptHeader.test.tsx` | "Report button placement and click dispatches store action" |
| FR-017 | `useKeyboardShortcuts.test.ts` | "r toggles sessionReportOpen; suppressed when search/sheet open; suppressed in inputs" |
| FR-018 | `SessionReportDrawer.test.tsx` | "closes on backdrop click / X / Escape" |
| FR-019 | `useKeyboardShortcuts.test.ts` | "Escape priority — report → search → sheet → selection → focus" |
| FR-020 | `StatusBar.test.tsx` | "renders `r report` hint" |
| FR-021 | static grep (in plan tasks) | only the header button + the `r` shortcut call `setSessionReportOpen(true)` |
| FR-021a | `SessionReportDrawer.test.tsx` | "close button has initial focus; tab cycles within dialog; restores focus on close" |
| FR-025..FR-027 | `SessionBrowser.test.tsx` | "header has brand badge + Transcripts + overflow + search button; search button opens palette" |
| FR-028 | `ProjectSection.test.tsx` (new) | "small-caps header with chevron + folder + name + count" |
| FR-029..FR-034 | `SessionRow.test.tsx` | "compact row; active state; pinned star prefix; live indicator preserved" |
| FR-035 | `SessionBrowser.test.tsx` | "overflow menu hosts sort toggle that dispatches toggleSort" |
| FR-036 | `SessionBrowser.test.tsx` | existing copy/recovery tests pass unchanged |
| FR-037 | `SidebarDrawer.test.tsx` | "narrow drawer renders <SessionBrowser /> with new layout" |
| FR-038 | existing tests pass | covered by leaving `groupAndSort` + handlers untouched |
