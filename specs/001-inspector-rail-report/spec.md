# Feature Specification: Inspector-Only Right Rail, Session Report Modal, and Sidebar Alignment

**Feature Branch**: `001-inspector-rail-report`

**Created**: 2026-05-13

**Status**: Draft

**Input**: User description: "Refactor the workspace right rail to be Inspector-only and add a Session Report modal that restores the token-consumption breakdown (Duration / Tool calls / Cache hit rate / Total units + per-agent/per-model weighted table) plus usage-over-time and files-touched sections. Open via a header Report button or `r` keyboard shortcut. Additionally, align the current left sidebar (which differs significantly from the v2 design) with the v2 Workspace prototype's sidebar so the workspace presents a coherent visual language."

## Clarifications

### Session 2026-05-13

- Q: When a session has no token-report data or all-zero values, what should the Session Report do? → A: Open the modal and render an empty/zero state inline (stat cards show "—", table shows a single "No usage recorded yet" row, usage-over-time and files-touched sections show their own empty captions).
- Q: When other overlays are open, should the `r` shortcut still open the Session Report? → A: No. `r` is suppressed while the search palette OR a bottom sheet is open; it only fires when the workspace shell is the foreground surface. An active Inspector selection is not an overlay and does not block `r`.
- Q: How should keyboard focus be managed when the Session Report opens and closes? → A: Standard accessible-modal pattern. On open, focus the close (X) button and trap Tab/Shift+Tab within the modal. On close, restore focus to the trigger (header Report button, or the workspace shell when opened via `r`).
- Q: How should rows in the "Files touched" section be ordered? → A: Sort by total activity (reads + writes) descending; ties broken by first-touched timestamp ascending.
- Q: How many spike-turn cards should render when the session has fewer than 3 turns with non-zero unit usage? → A: Render min(turns_with_non_zero_usage, 3) cards. If zero qualifying turns, fall back to the empty caption defined for the zero-data state.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Inspect a tool call without mode confusion (Priority: P1)

As a user reading a Claude Code transcript, when I click a tool capsule or diff in the middle pane, I want the right rail to immediately show the Inspector for that selection — without having to think about which tab I'm on. When nothing is selected, the rail should clearly invite me to click a tool or diff.

**Why this priority**: This is the core fix for the prior mode-inconsistency problem. The Inspector is the contextual, navigation-driven surface; conflating it with session-wide tabs (Tokens/Files) made the rail unpredictable. Restoring a single-purpose rail is the foundation for everything else in this refactor.

**Independent Test**: Open any session, click a tool capsule, and verify the rail shows Inspector content for that capsule. Click a diff, verify Inspector content updates. With no selection, verify the rail shows the quiet "click any tool capsule or diff" empty state — with no mention of removed tabs or where session data lives now.

**Acceptance Scenarios**:

1. **Given** a session is open and no tool or diff is selected, **When** the user looks at the right rail, **Then** the rail shows a quiet Inspector empty state (icon + "Click any tool capsule or diff…") and no tab strip is present.
2. **Given** the user is viewing the transcript, **When** they click a tool capsule, **Then** the rail renders Inspector contents for that capsule immediately, without any tab-switching step.
3. **Given** the Inspector is already showing a tool, **When** the user clicks a diff in the transcript, **Then** the Inspector updates to show the diff's content (the rail is never "stuck on" the wrong context).
4. **Given** the user is on a narrow viewport, **When** they tap the "Inspector" floating action button, **Then** the bottom sheet opens showing the Inspector (or the empty state if nothing is selected) — never a tab strip.

---

### User Story 2 - Compare session effectiveness via the Session Report (Priority: P1)

As a user evaluating how a session went, I want a single dedicated view that shows session duration, total tool-call count (with main vs. sub split), cache hit rate, total weighted units, and a per-agent/per-model token-consumption breakdown — so I can quickly judge the session's cost and behavior without doing math in my head.

**Why this priority**: The token-consumption report was removed in the previous redesign and users rely on it. Without this view, users have no way to compare sessions or understand where weighted units were spent. It restores parity with the previous design and is the second pillar of this refactor.

**Independent Test**: Open the Session Report (header button or `r`). Verify the four headline stat cards appear with the required sub-labels and the per-agent/per-model table shows columns Input (1.0×), Cache 5m (1.25×), Cache 1h (2.0×), Cache rd (0.1×), Output, Cache hit, Units — with raw counts on top of weighted unit values for each numeric cell. Exporting CSV produces a file containing the same rows.

**Acceptance Scenarios**:

1. **Given** a session is open, **When** the user opens the Session Report, **Then** they see a modal whose header shows the session title and the subtitle "Tokens grouped by agent and model. Units are model-relative weights (not USD) — stable across price changes."
2. **Given** the Session Report is open, **When** the user looks at the stat-card row, **Then** four cards are visible in this order with these sub-labels: Duration · "first → last turn"; Tool calls · "main N · sub N"; Cache hit rate · "read / (read + create + input)"; Total units · "weighted, all agents".
3. **Given** the Session Report is open, **When** the user inspects the breakdown table, **Then** every numeric cell shows raw count above weighted unit cost, the column multipliers match exactly (Input 1.0×, Cache 5m 1.25×, Cache 1h 2.0×, Cache rd 0.1×), and a multiplier legend caption appears below the table.
4. **Given** the Session Report is open, **When** the user clicks "Export CSV", **Then** a CSV file is produced containing the same per-agent/per-model rows shown in the table.
5. **Given** the Session Report is open, **When** the user scrolls below the table, **Then** they see a "Usage over time" section with a units-per-turn sparkline and three spike-turn cards, followed by a "Files touched" section with one row per file showing read/write timeline pips and a CHANGED tag where applicable.

---

### User Story 3 - Open and dismiss the report quickly (Priority: P2)

As a keyboard-oriented user, I want exactly two predictable entry points to the Session Report (a header button and the `r` shortcut) and three predictable ways to dismiss it (backdrop click, X button, Escape). I do not want multiple competing entry points or surprise behaviors when Escape is already doing something else.

**Why this priority**: The report has to feel deliberate and lightweight — easy to flick open and away. Predictable shortcuts and Escape priority make the workspace feel coherent. This is a P2 because the report still works without these refinements, but they significantly affect daily-use feel.

**Independent Test**: Press `r` — the report opens. Press `r` again — it closes. Open the report and press Escape — it closes. Open the report with a search palette also open — Escape closes the report first (since it is the top-most modal), then a second Escape closes search. Click outside the modal — it closes. Click the X button — it closes. Verify the keyboard hint strip at the bottom of the workspace shows "r report".

**Acceptance Scenarios**:

1. **Given** the workspace is focused (no input element), **When** the user presses `r`, **Then** the Session Report opens; pressing `r` again closes it.
2. **Given** the user is in the workspace header, **When** they click the "Report" icon-button (between the metric chips and the theme toggle), **Then** the Session Report opens.
3. **Given** the Session Report is open, **When** the user clicks the backdrop outside the modal, presses the X button, or presses Escape, **Then** the modal closes.
4. **Given** the Session Report is open AND the search palette is also open AND a bottom sheet is also open AND an Inspector selection is active, **When** the user presses Escape, **Then** only the Session Report closes (Escape priority: report → search → sheet → clear Inspector selection).
5. **Given** the workspace is rendered, **When** the user looks at the status / keyboard-hint strip at the bottom, **Then** "r report" is listed alongside the existing hints.

---

### User Story 4 - Sidebar matches the v2 design (Priority: P2)

As a user opening the app, I want the left sidebar to look and feel like the rest of the redesigned workspace — same visual language, same density, same affordances — so the app feels like one coherent product instead of an old screen bolted onto a new one. Today the sidebar shows a generic "Sessions" title and a "Newest first" sort toggle, with 52px boxed rows; the v2 design instead leads with a small product brand, a prominent search button, small-caps project group headers, and compact indented session rows with a subtle accent-soft active state.

**Why this priority**: The functional behavior of the sidebar (loading sessions, grouping by project, picking a session, pinning) is already working — this is a coherence/polish problem, not a missing-feature problem. It's P2 because the workspace is usable without it, but the visual mismatch undermines the credibility of the rest of the redesign and is the most obvious "this doesn't match" item users will notice when they open the app.

**Independent Test**: Open the workspace and compare the left sidebar side-by-side with the v2 prototype's Workspace.html sidebar. Verify that the header treatment, project-group treatment, session-row treatment, and the active/hover/pinned visual states match the prototype. Confirm that the search affordance is reachable from the sidebar header (clicking it opens the existing search palette) and that the existing functional features (selection, grouping, pinning, live indicator, token breakdown on hover) all still work after the visual refactor.

**Acceptance Scenarios**:

1. **Given** the workspace is rendered, **When** the user looks at the top of the sidebar, **Then** the sidebar header shows: a small square brand badge (with the letter "C"), the label "Transcripts", an overflow icon-button, and — below those — a full-width search button containing a search icon, the placeholder "Search sessions, tools, files…", and a "⌘K" keyboard hint pill on the right. There is no separate "Sessions" title row.
2. **Given** the user clicks the search button in the sidebar header, **When** the click resolves, **Then** the existing global search palette opens (the same one that opens via `⌘K` and `/`).
3. **Given** the sidebar lists multiple projects, **When** the user inspects a project-group header, **Then** the header renders as a small-caps row (uppercase, tight letter-spacing, smaller font weight comparable to a section label) with a chevron, a folder icon, the project name, and a right-aligned session count — visually subordinate to session rows, not louder than them.
4. **Given** a project group is rendered, **When** the user looks at individual session rows, **Then** rows are compact (substantially shorter than the current 52px boxes), indented under the project header, and use an accent-soft background plus a 2px accent left-border for the active row (no bordered card-like box around each row).
5. **Given** a session is pinned, **When** the user views its row, **Then** a star icon prefixes the title (no separate hover-revealed star button is required to indicate pinned state — the pinned star itself is the indicator); the title remains truncated with ellipsis when too long.
6. **Given** the user hovers a session row's token count, **When** the tooltip appears, **Then** it still shows the four-way breakdown (input / output / cache create / cache read), unchanged in behavior.
7. **Given** a session is actively live-tailing, **When** the user views its row, **Then** a live indicator is still present on the row (the indicator may be repositioned to fit the new compact row, but the affordance is preserved).
8. **Given** the existing sort-order control needs a home, **When** the user looks for it, **Then** it is reachable from the sidebar (e.g., via the overflow icon-button in the header) — it does not disappear, but it is not promoted to a primary header element either.
9. **Given** the sidebar is empty, in a loading state, or in an error state, **When** the user looks at the body of the sidebar, **Then** the existing empty / loading / error copy and recovery actions still render — restyled to match the new visual language, not removed.
10. **Given** the user opens the app on a narrow viewport, **When** they open the sidebar drawer, **Then** the drawer renders the same redesigned sidebar (header, project sections, rows) — not the old layout.

---

### Edge Cases

- **Narrow viewport**: On screens below the narrow breakpoint, the report still opens as a centered modal (its width is capped at `min(960px, 100%)`, so it visually behaves like a full-screen view without a separate code path).
- **Empty Inspector + no selection**: The Inspector empty state must NOT reference the removed Tokens/Files tabs or explain where session data moved. Copy describes the Inspector's own purpose only.
- **Focus traps**: Pressing `r` while typing in an input (search box, etc.) must NOT open the report; it must type the letter `r` normally.
- **Report opens while Inspector is showing a selection**: Selection state in the rail is preserved; closing the report returns the user to the same Inspector view they had before.
- **Modal scroll vs. transcript scroll**: While the report modal is open, scrolling inside the modal must not scroll the transcript behind it.
- **No data available for some agents/models**: Rows in the breakdown table render with whatever raw/weighted values the existing token-report data provides; no per-row fallback or "no data" placeholder is required.
- **Session has no token-report data or all-zero values**: The modal still opens (entry points remain predictable). Stat cards display "—" in place of values, the breakdown table renders a single "No usage recorded yet" row in place of agent/model rows, and the "Usage over time" and "Files touched" sections each render their own empty caption in place of the sparkline/cards/file rows.
- **Very long project paths in the sidebar**: Project-group headers must truncate with ellipsis (matching the v2 prototype) — they must not wrap to multiple lines, expand the sidebar, or push the session count off-screen.
- **Very long session titles in the sidebar**: Session row titles must truncate with ellipsis on a single line; the pinned star prefix (when present) must remain visible and not be truncated.
- **Sort control discoverability**: Because the sort toggle is no longer a primary header element, the overflow menu in the sidebar header must clearly surface it (label like "Sort: Newest first / Oldest first") so the feature remains discoverable.

## Requirements *(mandatory)*

### Functional Requirements

#### Right rail (Inspector-only)

- **FR-001**: The right rail MUST be a single, always-Inspector surface; it MUST NOT render a tab strip or any tab-switching control.
- **FR-002**: When a tool capsule or diff is selected in the transcript, the rail MUST render the Inspector for that selection.
- **FR-003**: When no tool capsule or diff is selected, the rail MUST render a quiet empty state describing the Inspector's purpose only (icon + "Click any tool capsule or diff…").
- **FR-004**: The Inspector empty state MUST NOT reference the removed Tokens or Files tabs or explain where session-wide data has moved.
- **FR-005**: Clicking a tool capsule or diff MUST NOT trigger any tab-forcing behavior — there are no tabs to force.
- **FR-006**: The bottom-sheet variant of the rail (narrow viewports) MUST behave identically: Inspector or empty state only, no tab strip.

#### Session Report modal

- **FR-007**: A Session Report modal MUST be openable from the workspace; it MUST render as a centered modal with width capped at `min(960px, 100%)`.
- **FR-008**: The modal MUST contain, in order: (a) a header with the session title and the fixed subtitle "Tokens grouped by agent and model. Units are model-relative weights (not USD) — stable across price changes." plus a close button; (b) a 4-column row of stat cards; (c) a "By agent & model" breakdown table; (d) a "Usage over time" section; (e) a "Files touched" section.
- **FR-009**: The four stat cards MUST display these labels and sub-labels exactly: Duration / "first → last turn"; Tool calls / "main N · sub N"; Cache hit rate / "read / (read + create + input)"; Total units / "weighted, all agents".
- **FR-010**: The "By agent & model" table MUST have these columns in this order: Agent, Model, Input (1.0×), Cache 5m (1.25×), Cache 1h (2.0×), Cache rd (0.1×), Output, Cache hit, Units.
- **FR-011**: Each numeric cell in the table MUST display the raw token count visually above the corresponding weighted unit cost.
- **FR-012**: The table section MUST include an "Export CSV" action that produces a CSV of the rows shown in the table.
- **FR-013**: A short caption MUST appear below the table explaining the multipliers (input ×1.0 · cache 5m ×1.25 · cache 1h ×2.0 · cache read ×0.1).
- **FR-014**: The "Usage over time" section MUST render a sparkline of units per turn plus up to three "spike turn" cards highlighting the largest single-turn unit costs. The number of spike cards rendered MUST equal `min(turns_with_non_zero_usage, 3)`. If zero turns have non-zero usage, the spike-cards row MUST be replaced by the empty caption defined in FR-015a.
- **FR-015**: The "Files touched" section MUST render one row per file in the session's file list, each with read/write timeline pips and a CHANGED tag where the file was modified. Rows MUST be ordered by total activity (reads + writes) descending; ties MUST be broken by first-touched timestamp ascending.
- **FR-015a**: When the session has no token-report data or all-zero values, the modal MUST still open. Stat cards MUST display "—" instead of values, the breakdown table MUST render a single "No usage recorded yet" row instead of agent/model rows, and the "Usage over time" and "Files touched" sections MUST each render an empty caption instead of their sparkline/cards/file rows.

#### Entry points and dismissal

- **FR-016**: The workspace header MUST include exactly one "Report" icon-button (using the chart icon), placed between the metric chips and the theme toggle.
- **FR-017**: Pressing `r` MUST toggle the Session Report open/closed only when (a) the user is not typing in an input element, AND (b) no other overlay is in front of the workspace shell — specifically, the search palette is not open and no bottom sheet is open. An active Inspector selection does NOT count as a blocking overlay (Inspector is part of the shell). When `r` is suppressed by an overlay, the key MUST fall through to its default behavior (typing the letter, or no-op).
- **FR-018**: The Session Report MUST close on backdrop click, on clicking its X button, and on pressing Escape.
- **FR-019**: When multiple dismissible layers are open, Escape priority MUST be: close the Session Report first, then the search palette, then the bottom sheet, then clear the Inspector selection.
- **FR-020**: The workspace keyboard-hint strip MUST include "r report" alongside the existing hints (j/k message, /, ⌘K search, t theme, Esc close).
- **FR-021**: There MUST be no other entry points to the Session Report beyond the header button and the `r` shortcut.
- **FR-021a**: When the Session Report opens, keyboard focus MUST move to the modal's close (X) button, and Tab/Shift+Tab MUST cycle only among focusable elements within the modal (focus trap). When the modal closes, focus MUST return to the element that triggered it — the header Report button when opened via click, or the workspace shell when opened via the `r` shortcut.

#### State and data

- **FR-022**: The Session Report MUST source its data from the existing session token-report data and session files data; no new transcript-level data shapes are required.
- **FR-023**: The Workspace shell MUST NOT retain any "force inspector tab" state — that state is removed entirely.
- **FR-024**: The Workspace shell MUST maintain a single boolean state for whether the Session Report is open.

#### Sidebar (visual alignment with v2 design)

- **FR-025**: The sidebar header MUST display a small product brand badge containing the letter "C", followed by the label "Transcripts", followed by an overflow icon-button — replacing the current "Sessions" heading.
- **FR-026**: The sidebar header MUST include a prominent, full-width search button immediately below the brand row, containing a search icon, the placeholder text "Search sessions, tools, files…", and a right-aligned "⌘K" keyboard-hint pill.
- **FR-027**: Clicking the sidebar's search button MUST open the existing global search palette (the same surface reached via `⌘K` and `/`).
- **FR-028**: Project-group headers MUST render in the small-caps treatment used by the v2 design: uppercase label, tight letter-spacing, small font size, with a chevron expand/collapse affordance, a folder icon, the project name, and a right-aligned session count — visually subordinate to session rows.
- **FR-029**: Session rows MUST be compact (substantially shorter than the current 52px row), indented under the project-group header, and MUST NOT render as bordered card-like boxes.
- **FR-030**: The active session row MUST be indicated by an accent-soft background and a 2px accent-color left border — replacing the current border/box treatment.
- **FR-031**: Each session row MUST display the session title on one line (truncated with ellipsis when too long) and a single meta line showing relative time, message count, and a token count — in the mono typographic style used elsewhere in the v2 design.
- **FR-032**: When a session is pinned, the star icon MUST be visible as a prefix on the title (the star itself indicates pinned state; the hover-revealed unpinned-state star button MAY remain for unpinned rows to allow pinning, but pinned rows MUST always show the star).
- **FR-033**: The existing token-breakdown tooltip on the row's token count MUST be preserved (same four-way input / output / cache create / cache read content).
- **FR-034**: The existing live indicator for actively-tailing sessions MUST be preserved (positioned to fit the new compact row).
- **FR-035**: The existing sort-order control MUST remain reachable from the sidebar — relocated into the header overflow menu (the icon-button at the top right of the header), NOT removed.
- **FR-036**: Existing loading, empty, and error states (including the "No sessions found" copy referencing `~/.claude/projects/` and the "Could not load sessions" / "Try again" recovery flow) MUST be preserved and restyled to match the new visual language — not removed.
- **FR-037**: The narrow-viewport sidebar drawer MUST render the same redesigned sidebar layout — not the previous layout.
- **FR-038**: All existing functional behaviors of the sidebar (session selection updates the active session, pinning toggles pinned state, sort affects ordering, project-section collapse state persists in-memory, grouping by `projectSlug`) MUST remain unchanged in behavior; only their visual presentation changes.

### Key Entities *(include if feature involves data)*

- **Session Token Report**: Per-session aggregate of token usage. Includes session duration, tool-call counts split by main vs. sub agent, cache hit rate, total weighted units, per-agent/per-model rows (each with raw and weighted values for input, cache 5m, cache 1h, cache read, and output), and column totals.
- **Session File**: One file the session read or modified. Includes path, read count, write count, optional line count, and a "changed" flag indicating whether the file was modified.
- **Active Tool/Diff Selection**: The currently-selected interaction in the transcript (one tool capsule OR one diff at a time, or none). Drives Inspector content.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user navigating the transcript can change their Inspector context (click a different tool or diff) in a single click — no intermediate tab interaction is ever required.
- **SC-002**: The right rail UI exposes zero tab controls; both automated UI checks and visual inspection confirm the tab strip is gone in both desktop and bottom-sheet variants.
- **SC-003**: A user can open the Session Report in one action from either the header button or `r`, and dismiss it in one action via backdrop, X, or Escape — measured: 100% of these six paths work on every supported viewport.
- **SC-004**: The Session Report shows all four headline stat cards, all nine table columns with the exact required multipliers and labels, the usage-over-time section, and the files-touched section — verified by the acceptance checklist in the change brief reaching 100%.
- **SC-005**: When asked to find a session's weighted-unit total, cache hit rate, or per-model breakdown, a user reaches the correct value in under 10 seconds from the workspace's default state, without needing to navigate away from the active session.
- **SC-006**: The Inspector empty state contains no reference to "Tokens", "Files", "tabs", or "moved" — confirmed by a string scan of the empty-state copy.
- **SC-007**: Escape pressed with all overlays open closes them in the required priority order (Report → search → sheet → Inspector selection) without skipping or batching.
- **SC-008**: A reviewer comparing the production sidebar side-by-side with the v2 prototype's Workspace.html sidebar can match every structural element (header brand row, search button, project-group treatment, row layout, active state, pinned star prefix) with no obvious mismatches — verified by visual review against the prototype.
- **SC-009**: All existing functional sidebar features (session selection, pinning, sort, project collapse, live indicator, token tooltip, empty/error/loading copy) continue to work after the refactor — verified by the existing sidebar test suite passing unchanged in behavior (visual snapshots may legitimately change).
- **SC-010**: Opening the global search palette from the sidebar header's search button reaches the exact same surface as `⌘K` and `/` — verified by user observation that all three entry points produce identical UI.

## Assumptions

- The existing session token-report data shape (duration, toolCalls, cacheHit, totalUnits, rows with agent/model/input/c5/c1h/cRd/out/hit/units, totals) is sufficient to render the modal as specified. No new server-side aggregations are needed for this feature.
- The existing session file list (path, reads, writes, optional lines, changed flag) is sufficient for the Files-touched section. No new file-metadata fields are required.
- "Export CSV" produces a client-side file download containing the rows currently displayed in the table; it does not require a server endpoint.
- The chart icon used for the Report button already exists in the project's icon set (no new icon asset needs to be commissioned).
- The previously-existing `TokensPanel` and `FilesPanel` components are no longer reachable through the UI but may remain in the codebase temporarily; removing them is a follow-up cleanup, not a blocker for this feature.
- The `r` shortcut does not conflict with any existing single-key shortcut in the workspace (existing single-key shortcuts cover j, k, t, /, Escape).
- Narrow-viewport handling for the modal works via its CSS width cap (`min(960px, 100%)`); no separate full-screen mobile sheet for the report is needed.
- The token-unit weighting scheme (input ×1.0, cache 5m ×1.25, cache 1h ×2.0, cache read ×0.1) is fixed and not user-configurable in this feature.
- The v2 prototype at `.design/v2/project/Workspace.html` (and `workspace-app.jsx`'s `Sidebar` component) is the canonical reference for sidebar visual structure and treatment.
- The sidebar's data sources (session list, project grouping, pin set, sort order, active session id, live-tail flag) remain unchanged — only the visual layer is refactored.
- The brand badge label "C" and the workspace title "Transcripts" shown in the v2 prototype are intentional and do not require further branding review for this feature.
- The sort-order toggle, while not visually prominent in the v2 prototype, is a feature users rely on (the design omits it likely because it lives in an overflow menu); placing it in the header overflow icon-button is a reasonable interpretation. If a future design pass removes the sort feature entirely, that is a separate decision.
- The live indicator and token-breakdown tooltip, while not visually shown in the v2 prototype sidebar, are existing behaviors that must be preserved (they did not exist in the older design and so are not represented in the prototype).
