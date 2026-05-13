# Quickstart: Verifying the Inspector-Rail / Session Report / Sidebar Refactor

This is the manual walkthrough for verifying the feature end-to-end against the running app. Pair it with `npm test` (unit + component tests) for the full sign-off; this doc covers the things only a human in front of a browser can see.

## Prerequisites

```bash
# From repo root
npm install   # if not already installed for this branch
```

Confirm a working transcripts directory at `~/.claude/projects/` containing at least one session with:

- ≥ 1 assistant turn carrying token usage (so the report and KPIs are non-zero), AND
- ≥ 1 Read/Edit tool call (so the Files-touched section has rows).

If you do not have such a session, run `claude` briefly in any project, ask it one question, and close it.

## Run the app

In two terminals:

```bash
# Terminal 1 — backend (Hono on :3001 by default)
npm run dev:server

# Terminal 2 — frontend (Vite on :5173 by default)
npm run dev:ui
```

Open `http://localhost:5173/` and pick a session from the sidebar.

## Walkthrough

### 1. Inspector-only right rail (FR-001..FR-006, SC-001, SC-002, SC-006)

1. With a session loaded and nothing selected, look at the right rail.
   - **Expected**: a quiet "Tool inspector" empty state — a dashed-circle wrench icon, the heading "Tool inspector", the body "Click any tool capsule or diff in the transcript to inspect arguments, results, and changes.", and a row of tool-name chips.
   - **Expected**: **no** tab strip at the top of the rail (no Inspector / Tokens / Files tabs).
   - **Fail signals**: any element rendering "Tokens", "Files", "tab strip", or copy that explains "moved to the report".
2. Click a tool capsule in the transcript (e.g. a Bash or Read call).
   - **Expected**: the rail immediately shows the Inspector body for that tool — Call / Result / (optionally Preview, Diff, Raw) tab strip inside the Inspector. The OUTER rail still has no tabs.
3. Click a diff in the transcript.
   - **Expected**: the Inspector body switches to the diff view in a single click — no intermediate state.
4. Resize the window below the narrow breakpoint (≈1100px).
   - **Expected**: the bottom-sheet variant of the inspector opens via the FAB and shows the same Inspector empty state / body — no tab strip.

### 2. Session Report — opening it (FR-016, FR-017, FR-021, SC-003)

1. With focus anywhere outside an input, press `r`.
   - **Expected**: the Session Report modal opens centered, with a 1rem gutter on each side.
2. Press `r` again.
   - **Expected**: the modal closes.
3. Click the chart-icon button in the header (between the metric chips group and the theme toggle).
   - **Expected**: the modal opens.
4. With the report open, press `r`.
   - **Expected**: it closes (toggle behavior).
5. Click on the search palette (⌘K), keep it open, then press `r`.
   - **Expected**: the `r` is suppressed; the report does NOT open. The letter `r` does not appear in the search input either (the global shortcut returns without preventDefault, but the search palette steals the keystroke as input — verify the report state is unchanged).
6. Type `r` into the search palette input field.
   - **Expected**: the letter `r` is typed; the modal does NOT open. (The handler skips inputs.)
7. Look at the keyboard hint strip at the bottom of the workspace.
   - **Expected**: it contains `r report` alongside `j/k message`, `/ or ⌘K search`, `t theme`, `Esc close`.

### 3. Session Report — content (FR-007..FR-015, SC-004, SC-005)

With the report open on a session that has real usage:

1. Header
   - Title shows the session title (truncated with ellipsis if very long).
   - Subtitle: "Tokens grouped by agent and model. Units are model-relative weights (not USD) — stable across price changes."
2. Stat cards — four cards in this exact order with these sub-labels:

   | # | Label | Sub-label |
   |---|-------|-----------|
   | 1 | Duration | first → last turn |
   | 2 | Tool calls | main N · sub N |
   | 3 | Cache hit rate | read / (read + create + input) |
   | 4 | Total units | weighted, all agents |

3. By agent & model table — nine columns in this exact order: `Agent | Model | Input (1.0×) | Cache 5m (1.25×) | Cache 1h (2.0×) | Cache rd (0.1×) | Output | Cache hit | Units`.
   - Each numeric cell: raw count on top, weighted unit value below in muted mono.
   - Multiplier caption below the table: contains the text `input ×1.0 · cache 5m ×1.25 · cache 1h ×2.0 · cache read ×0.1`.
4. Click `Export CSV`.
   - **Expected**: a file `session-{sessionId}-report.csv` downloads. Open it: the rows match what's on screen, with one row per (agent, model).
5. Scroll down inside the modal.
   - **Expected**: a "Usage over time" section shows a small sparkline (units per turn) and up to three spike-turn cards. Each card has a `m{n}` mono label, a token value, and a short reason.
   - **Expected**: below that, a "Files touched · {N}" section with one row per file. Rows are sorted by total reads + writes desc. Files modified by Edit/Write show a `CHANGED` tag. Each row has a horizontal timeline of read pips (user-rail tint) + write pips (accent).

### 4. Session Report — dismissal (FR-018, FR-019, FR-021a, SC-007)

1. Open the modal. Click outside the modal (on the dark backdrop).
   - **Expected**: closes.
2. Open again. Click the X button.
   - **Expected**: closes.
3. Open again. Press Escape.
   - **Expected**: closes.
4. Open the modal AND the search palette (⌘K) AND simulate a bottom sheet (narrow viewport + the inspector FAB) AND an Inspector selection. Press Escape.
   - **Expected**: ONLY the Session Report closes. Press Escape again → search palette closes. Again → bottom sheet closes. Again → Inspector selection clears.
5. Focus management:
   - Open the report via the header button. Look at where focus lands.
     - **Expected**: the X (close) button is focused.
   - Press Tab repeatedly.
     - **Expected**: focus cycles between focusable elements inside the dialog only — never escapes to elements behind the modal (try Tab/Shift+Tab > 10 times to confirm).
   - Press Escape to close.
     - **Expected**: focus returns to the header Report button.
   - Open the report via `r`. Close via Escape.
     - **Expected**: focus returns to the body / workspace shell (no error).

### 5. Empty / zero-data state (FR-015a)

To verify this you need a session whose token-report is empty (no assistant turns with usage), OR you can temporarily edit the API response in DevTools. Steps:

1. Open such a session and trigger the report.
2. Confirm the modal still opens.
   - **Expected**: all four stat cards show `—` in the value slot.
   - **Expected**: the breakdown table shows one row: "No usage recorded yet" spanning all columns.
   - **Expected**: "Usage over time" shows `No usage to chart yet.` instead of the sparkline + cards.
   - **Expected**: "Files touched" shows `No files were read or written in this session.` instead of file rows.

### 6. Sidebar visual alignment (FR-025..FR-038, SC-008, SC-009, SC-010)

Open `.design/v2/project/Workspace.html` in a second browser tab/window for side-by-side comparison.

1. Sidebar header
   - **Expected**: a small accent-tinted square containing the letter `C`, then "Transcripts" (semibold), then an overflow icon-button, then below a full-width search button with the placeholder "Search sessions, tools, files…" and a `⌘K` keyboard hint pill on the right.
   - **Expected**: no "Sessions" title row, no "Newest first" sort toggle in the header.
2. Click the search button.
   - **Expected**: the same global search palette opens as `⌘K` and `/` (SC-010).
3. Project-group headers
   - **Expected**: small-caps row (uppercase, tracking-wide) with chevron + folder icon + project name + right-aligned session count.
4. Session rows
   - **Expected**: compact (≈32–36px tall), indented under the project header, no card box border.
   - Active row: accent-soft background + 2px accent left-border. No bordered card.
   - Title truncates with ellipsis on a single line.
   - Meta line is mono `ago · N msg · tokens`.
5. Pinning
   - Pin the active session (header star, or hover the row's star button in the sidebar).
   - **Expected**: the session row's title is prefixed with a filled star icon. The hover-revealed unpin button still works for clicks.
6. Live indicator
   - If a session is live-tailing, the row shows a pulsing green dot.
7. Token-count tooltip
   - Hover the token count on any row.
   - **Expected**: the four-way breakdown tooltip appears (`In … / Out … / C+ … / C- …`).
8. Sort toggle discoverability (FR-035)
   - Click the overflow icon-button in the sidebar header.
   - **Expected**: a popover appears with a single item "Sort: Newest first" (or "Oldest first"). Click it.
   - **Expected**: the order of sessions inverts.
9. Empty / error / loading
   - Run with `~/.claude/projects/` empty (rename it temporarily): the empty state copy is preserved verbatim.
   - Stop the server while the UI is open and refresh sessions: the "Could not load sessions" / "Try again" path is preserved.
10. Narrow drawer
    - Resize to < 1100px width. Open the sidebar drawer.
    - **Expected**: it shows the same redesigned sidebar layout (brand row, search, projects, compact rows). NOT the old design.

### 7. Behavior preservation sweep (FR-038, SC-009)

These should still work exactly as before:

- Click a row → that session loads.
- Click chevron on a project header → it collapses/expands; selection is unaffected.
- Pin/unpin → pinned sessions float to the top of their group, regardless of sort order.
- Sort toggle in the new overflow menu → flips order.
- Live indicator pulses on the right session.

## Sign-off checklist

- [ ] Right rail has no tab strip in any variant (desktop + bottom sheet).
- [ ] Inspector empty state copy contains none of: "Tokens", "Files", "tabs", "moved".
- [ ] All four stat cards present with exact labels + sublabels.
- [ ] Table has exactly nine columns in spec order with exact multiplier text.
- [ ] CSV export downloads with correct filename and row contents.
- [ ] Usage over time renders with min(N, 3) spike cards (or empty caption when N=0).
- [ ] Files touched sorted by reads+writes desc; ties by first-touched asc.
- [ ] Empty-state modal opens with `—` cards + "No usage recorded yet" row + caption fallbacks.
- [ ] `r` toggles the report; suppressed in inputs / when search OR sheet is open.
- [ ] Escape priority chain works in the required order with no skipping.
- [ ] Focus traps inside dialog; returns to trigger (or body) on close.
- [ ] Sidebar header shows brand badge + Transcripts + overflow + full-width search button.
- [ ] Sort lives in the overflow menu; behavior identical to before.
- [ ] Session rows are compact; pinned rows show star prefix; live dot still present.
- [ ] Token tooltip on row's token count still shows four-way breakdown.
- [ ] Narrow drawer renders the new sidebar layout.
- [ ] Existing empty/loading/error copy preserved.
