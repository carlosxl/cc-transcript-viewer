# Progress

**Task:** UI refactoring to match `.design/cc-transcript-viewer/`.
**Created:** 2026-05-12.
**Owner:** carlosxl (l.xiang@aftership.com).

## Current state

**Status:** All eight phases complete.

**2026-05-13 — Phase 8 narrow layout, minimap, a11y & polish landed.**
Below 1100px the shell collapses to a single column: `useResponsive()`
flips on `(max-width: 1099.98px)` and `AppShell` swaps `ResizablePanelGroup`
for a flat flex-col with a left `SidebarDrawer` and a bottom-pinned
`BottomSheet` (both Radix-Dialog wrappers, sharing the existing focus-trap
+ Escape behavior). `TranscriptHeader` grows a hamburger button, drops the
breadcrumb top row, and hides the `Messages` + `Model` MetricChips —
`Tokens` stays. A FAB labeled "Inspector" opens the bottom sheet; the
sheet auto-opens when a tool capsule is clicked on narrow. New
`narrowSidebarOpen` / `narrowSheetOpen` slices live on `useUIStore`
(not persisted); switching back to wide auto-closes both. Right-edge
`Minimap` (14px column inside `TranscriptPane`) paints one bar per
`VirtualNode` tinted by role/kind (capsules inset-shadowed in tool-rail,
diffs in brand), focused bar outlined in primary, click → seek via
`focusedMsgIndex` (reuses the existing j/k scroll pathway).
`nodes.length > 2000` downsamples to 2000 buckets — verified at 4000 in
unit tests. Minimap hidden on narrow. A11y: `ToolCapsule`'s status dot
gets `role="status"` + `aria-label` + visually-hidden text fixing the
color-only signal (Open Q #10). New `useReducedMotion` hook gates
Virtuoso `behavior: 'smooth'` → `'auto'` on `scrollToIndex`; the
`cc-flash-ring` keyframe is wrapped in
`@media (prefers-reduced-motion: no-preference)`. New files:
`useResponsive`, `useReducedMotion`, `SidebarDrawer`, `BottomSheet`,
`Minimap`. All 464 tests (218 server + 246 UI) + workspace typecheck +
production build green.

**2026-05-13 — Phase 7 search redesign + session pinning landed.**
`SearchPalette` rewritten on top of `Dialog` (640px modal at 10vh from top):
header input + `Esc` kbd, filter-chip row (All / Sessions / Tool calls /
Files), empty-state shows clickable suggestion chips (`security review`,
`static.ts`, `Bash`, `token report`), footer with `↑↓` / `↵` / `Esc` kbd
hints + result count + index-progress spinner. Filter logic is purely
client-side over the existing `/api/search` results: **Sessions** matches
session-list titles, **Tools** narrows to `contentKind ∈ {tool_use,
tool_result}`, **Files** keeps `tool_use` hits whose snippet looks
file-pathy (path char or known file-tool prefix). No server changes —
extending the FTS schema for file-tool filtering was deemed out of scope
for this UI-heavy phase. Per-result kind labels (`SESSION`/`TOOL`/`FILE`/
`MESSAGE`/`THINKING`) shown right-aligned. Arrow-key + Enter navigation;
suggestion-chip click fills the input. Session pinning: `pinnedSessions`
now persists to localStorage under `cc-viewer:pinned-sessions` (JSON array
of session IDs). `SessionRow` gets a star prefix button (visible when
pinned; hover-only when not). `SessionBrowser` floats pinned sessions to
the top of their project group via a two-tier `pinFirst` comparator;
bucket ordering ignores the pin tier so an old project doesn't jump to
top because one session in it is pinned. Header `StarButton` (Phase 3
stub) stays in sync via the same store slice. New tests: `SessionRow`
star toggle, `SessionBrowser` pin-first ordering, `useUIStore` pin
persistence, `SearchPalette` chips + Sessions/Tools filter + arrow-key
nav. All 442 tests (218 server + 224 UI) + workspace typecheck +
production build green.

**Last activity:** 2026-05-13 — Phase 6 right rail v2 (Tokens + Files) landed.
`RightRail`'s Tokens / Files tabs swap from `ComingSoon` placeholders to live
panels. Both consume Phase 2 projections through `useActiveQuery`, which
now also exposes `tokenSeries`, `fileTouchIndex`, plus the resolved
`sessionId` + `agentId` so the rail honours the current drill scope (same
session-vs-subagent branching the Inspector uses). Two pure-SVG charts —
`TokensChart` (stacked input + output + cache-create bars, native `<title>`
tooltips per bar, primary spike outlined in `--brand`) and `FileTimeline`
(read/write markers absolute-positioned along a shared 0-100% axis derived
from the active entry's first/last turn timestamps). `TokensPanel` renders
chart + 4-up stat grid (Total / Output / Cache hit % / Avg per turn) +
by-model bars + clickable spike list. `FilesPanel` renders a sorted file
list (server-side order: most-recent-first then most-writes) with basename
emphasized, optional "Changed only" filter, timeline, and `N reads · M
writes · L lines` footer. Both panels dispatch `requestJump` for jump-to-
turn — reusing the same `pendingJumpTarget` plumbing the search palette and
Inspector "Jump back" use. `ComingSoon` removed as orphaned. New
components: `TokensChart`, `LegendDot`, `FileTimeline`, `TokensPanel`,
`FilesPanel`. New tests: `TokensPanel.test.tsx`, `FilesPanel.test.tsx`,
plus tab-routing assertions updated in `RightRail.test.tsx`. All 434 tests
(218 server + 216 UI) + workspace typecheck + production build green.

**2026-05-12 — Phase 5 right rail v1 (Inspector) landed.**
`RightRail` now mounts in `AppShell` with three tabs: Inspector (live),
Tokens + Files (Phase 6 `<ComingSoon/>` placeholders). The Inspector tab
binds to `selectedInteractionId` via `useSelectedInteraction` —
auto-resolves through subagent drill (uses `useActiveQuery` which mirrors
`TranscriptPane`'s session/subagent branching). New components:
`Inspector`, `InspectorEmpty`, `ToolHeader`, `ComingSoon`, plus
`CallTab` / `ResultTab` / `PreviewTab` / `DiffTab` / `RawTab`. Default
tab on selection = `diff` for diffs, `preview` for `Read` w/ result,
else `result`. `Copy command` (renamed from "Copy as curl") uses
`formatCommand` (Bash / Read w-or-w/o offset / Glob / Grep / WebFetch +
JSON fallback). `Jump back` extends `JumpTarget` with `interactionId?`
so `TranscriptPane` scrolls to the matching capsule + flashes it via a
new `cc-flash-ring` keyframe + `[data-flash="true"]` rule on the row
wrapper. Preview tab guards against large Read outputs (>256 KB) with
a "Preview suppressed → Switch to Raw" card. `DiffBlock` split into a
presentational `DiffView` + selection-aware wrapper so the inspector's
DiffTab reuses the same renderer. Tool-icon mapping extracted to a
shared `lib/toolIcons.ts`. All 424 tests + workspace typecheck +
production build green.
Tool calls are now clickable **capsules** (`ToolCapsule`) — icon-by-tool,
mono name, truncated arg summary, duration, status dot, chevron. Click
writes `useNavigationStore.selectedInteractionId` (consumed by Phase 5).
Tool results moved out of the transcript flat-node array (they live in
the rail). New components: `DiffBlock` (Edit/Write line-by-line preview
beneath the capsule), `CommandBlock` (`/clear`-style mono row),
`StderrBlock` (danger-tinted block). `ThinkingRow` redesigned — italic
body, dashed border, "Thinking" eyebrow label. `AssistantTurn` /
`UserTurn` redesigned with 28px round avatar (role-tinted), name + model
+ mono timestamp baseline. User-text classifier (`classifyUserText`)
recognizes `<command-name>` / `<local-command-stderr>` XML-style tags
in JSONL content and routes UserTurn to the new blocks. `useFlatNodes`
simplified: kinds are now `turn | capsule | diff | thinking`; view mode
controls only thinking visibility — capsules / diffs / commands / stderr
always emit. Tool-result-only user envelopes dropped entirely. Legacy
`ToolCallRow` removed; `ToolResultRow` kept for Phase 5 to repurpose
inside the rail. All 389 tests + workspace typecheck + production build
green.

## Phase status

| # | Phase | Status | Depends on | Blocks |
|---|-------|--------|------------|--------|
| 1 | [Design-system foundation](./01-design-system.md) | ✅ Done | — | 3, 4, 7 |
| 2 | [Projection layer](./02-projection-layer.md) | ✅ Done | — | 5, 6 |
| 3 | [Three-pane shell + nav](./03-shell-and-navigation.md) | ✅ Done | 1 | 5, 8 |
| 4 | [Transcript content redesign](./04-transcript-content.md) | ✅ Done | 1, 2 | 5 |
| 5 | [Right rail v1 — Inspector](./05-inspector-rail.md) | ✅ Done | 2, 3, 4 | 8 |
| 6 | [Right rail v2 — Tokens & Files](./06-tokens-and-files-panels.md) | ✅ Done | 2, 3 | — |
| 7 | [Search + pinning](./07-search-and-pinning.md) | ✅ Done | 1 | — |
| 8 | [Narrow + minimap + polish](./08-narrow-and-polish.md) | ✅ Done | 3, 5 | — |

Legend: ⬜ not started · 🟨 in progress · ✅ done · ⛔ blocked

## Parallelism opportunities

- **Phases 1 and 2 are independent** — design system is pure styling, projection
  layer is pure data. Can run as two parallel workstreams.
- After 1 lands: **3, 4, 7 can start in parallel** (3 and 4 both depend on 1;
  4 also wants 2 for diff/preview projections).
- After 4: **5 and 6 can run in parallel**.

## How to update this file

When you start a phase: change ⬜ → 🟨, add date + your handle under "Current
state". When you finish: change 🟨 → ✅, note the merge commit / PR. When you
pause mid-phase: leave at 🟨 and write a "Handoff notes" subsection below
describing where you stopped.

## Handoff notes

_(empty — fill in when pausing mid-phase)_
