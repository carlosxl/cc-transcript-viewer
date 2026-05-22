# Feature Specification: UI Rewrite v4 — Three-Pane Transcript Workspace

**Feature Branch**: `006-ui-rewrite-v4`

**Created**: 2026-05-22

**Status**: Draft

**Input**: User description: "Fetch this design file, read its readme, and implement the relevant aspects of the design. @.design/v4 — implement cc-transcript-viewer.html. This is a MAJOR UI refactoring, we will do it as a full rewrite! Let's make the first step in the project plan explicitly to clean up all the current frontend code. Please disregard the current UI related code and start from scratch. However, the backend data model and infra is still valid, please keep them."

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Read and navigate any Claude Code session through the new three-pane workspace (Priority: P1)

A developer running `cc-transcript-viewer` from their terminal opens the local web UI and sees a three-pane workspace: a session browser on the left, the transcript in the center, and a context-sensitive inspector on the right. They can scan their projects and sessions in the left rail, open any session, and read it end-to-end with stable scrolling, predictable focus, and clear request/turn boundaries — including sessions with 10,000+ messages. This is the core promise of the product: reading and moving through any session must work, no matter how long.

**Why this priority**: This is the product's core value. Every other slice depends on the workspace shell, the session reader rendering, and the focus model being correct. Without P1 the tool is unusable.

**Independent Test**: Open the app from a CLI, pick a session in the sidebar, and read it top to bottom in the transcript pane. Verify the layout is stable, turn dividers and request markers are visible, blocks (text, thinking, tool_use, diff) render correctly, and the right rail shows context when a node is focused. Cost, token, and duration chips reflect the session.

**Acceptance Scenarios**:

1. **Given** the user launches the CLI and the local app opens in a browser, **When** the workspace loads, **Then** the user sees three panes (sidebar, transcript, inspector), the most recently active session is selected, and the transcript is auto-scrolled to the most recent turn with the last request focused.
2. **Given** the user is viewing a 10,000+ message session, **When** they scroll from the bottom to the top using keyboard or pointer, **Then** the UI stays responsive (no jank, no layout shifts, no broken expand/collapse state) and rendering is incremental rather than blocking.
3. **Given** the user clicks any turn divider in the transcript, **When** the click registers, **Then** that turn becomes focused, the inspector reflects the focused node, and the bottom status bar shows the breadcrumb (Turn X › Request N/M or User input).
4. **Given** the user clicks a tool call capsule or diff block inside a request, **When** the click registers, **Then** the block becomes the focused inspector subject and shows its inputs/outputs (for tool_use) or the full diff (for diff blocks), and the inspector pane opens automatically if it was hidden.
5. **Given** an inactive (collapsed) inspector pane, **When** the user toggles the inspector control in the transcript header, **Then** the pane shows/hides and the transcript reflows to use the freed width.

---

### User Story 2 — Drill into every subagent's internals (Priority: P1)

When a tool call spawned a subagent (e.g., an `Agent`-type tool with a child transcript), the user can drill into that subagent's complete transcript from either the inline tool capsule or the inspector, see a clear breadcrumb that they are inside a subagent, and return to the parent transcript without losing their place.

**Why this priority**: The README and product brief identify subagent drill-down as a defining capability that the built-in viewer fails at. Pairing it with P1 navigation makes this the minimum viable product.

**Independent Test**: Open a session that includes a subagent tool call, click "Open subagent transcript" on the capsule, verify the subagent's full transcript loads with a "Back to [parent]" breadcrumb visible, navigate within the subagent, then click back and verify the parent transcript is restored at the prior focus position.

**Acceptance Scenarios**:

1. **Given** a tool call capsule that indicates it spawned a subagent, **When** the user clicks the "Open subagent transcript" affordance on the capsule, **Then** the transcript pane swaps to render the subagent's transcript and a breadcrumb shows "Back to [parent session title]" along with the spawn turn id.
2. **Given** the user is viewing a subagent transcript, **When** they click the back affordance, **Then** the parent transcript is restored with the previously focused node still focused and the scroll position close to where they left it.
3. **Given** an inspector showing a tool_use whose tool spawned a subagent, **When** the user clicks the drill affordance in the inspector, **Then** the transcript swaps to the subagent transcript with the same breadcrumb behaviour as the inline affordance.

---

### User Story 3 — Keyboard-first navigation across turns, requests, prompts, and tool calls (Priority: P2)

The user can move through a session entirely from the keyboard: step through nodes, jump between turns, hop user prompts (skipping stderr envelopes), step tool calls, jump to top/bottom, follow live tail, and open palettes for search and turn-jumper. The bottom status bar lists the available keys at all times so the affordance is self-documenting.

**Why this priority**: Power users will use this constantly; the design treats keyboard navigation as a first-class affordance and the status bar advertises it. Required for parity with the product's central differentiator (read and navigate any session).

**Independent Test**: With a session open, exercise each documented shortcut once and verify the focused node updates and the relevant scroll-into-view animation happens. Then verify the bottom status bar reflects the position breadcrumb after each move.

**Acceptance Scenarios**:

1. **Given** the transcript is open with focus on any node, **When** the user presses `j` / `k`, **Then** focus moves to the next/previous node (user prompt or request) and the view scrolls so the focused node is comfortably visible.
2. **Given** focus on any node, **When** the user presses `Shift+J` / `Shift+K`, **Then** focus moves to the first node of the next/previous turn.
3. **Given** focus on any node, **When** the user presses `n` / `Shift+N`, **Then** focus moves to the next/previous user prompt, skipping prompts that are stderr envelopes.
4. **Given** focus on any node, **When** the user presses `[` / `]`, **Then** focus moves to the previous/next tool call across the session (across requests and turns).
5. **Given** focus anywhere in the session, **When** the user presses `g` twice within ~700ms, **Then** focus jumps to the first turn and the body scrolls to the top.
6. **Given** focus anywhere in the session, **When** the user presses `Shift+G`, **Then** focus jumps to the last turn, the body scrolls to the bottom, and any pending "new turn" toast is dismissed.
7. **Given** the user presses `Cmd+K` (or `Ctrl+K` or `/`) anywhere except inside a text input, **When** the shortcut fires, **Then** the search palette opens with the input focused.
8. **Given** the user presses `Shift+T`, **When** the shortcut fires, **Then** the turn jumper opens anchored to the turn stepper.
9. **Given** the user presses `t`, **When** the shortcut fires, **Then** the theme toggles between dark and light and the change is reflected immediately across all three panes.
10. **Given** the user presses `r`, **When** the shortcut fires, **Then** the session report overlay opens (or closes if already open).
11. **Given** any overlay is open, **When** the user presses `Esc`, **Then** the topmost overlay closes (jumper > report > search), and if no overlay is open but a block is focused, `Esc` clears the block focus.

---

### User Story 4 — Live-tailing of an active session (Priority: P2)

The user can watch a currently-running session update without manually refreshing. A "Live" chip appears in the transcript header when the session is active. When a new turn appears in the underlying transcript file, a toast surfaces at the bottom of the transcript body inviting the user to jump to the new content; they can ignore it or press `Shift+G` to follow.

**Why this priority**: The constraint section of the product brief explicitly calls live-tailing out as required. It is independently valuable but builds on P1.

**Independent Test**: Open a session that is actively being written. Verify the "Live" chip appears in the header. Append a turn to the backing transcript and confirm the toast appears in the body and `Shift+G` jumps to and reveals the new turn.

**Acceptance Scenarios**:

1. **Given** an active session, **When** the workspace identifies it as live, **Then** a "Live" chip is visible in the transcript header.
2. **Given** the user is reading earlier in a live session and a new turn is appended, **When** the new content arrives, **Then** a non-blocking toast appears anchored to the transcript body indicating new content and offering `Shift+G` to follow.
3. **Given** the user is already scrolled to the bottom of a live session, **When** a new turn arrives, **Then** the view auto-follows the tail and no toast is needed.
4. **Given** the user navigates into a subagent transcript, **When** the parent session receives a new turn, **Then** the toast does not interrupt the subagent view but reappears when the user returns to the parent.

---

### User Story 5 — Cross-session search palette (Priority: P2)

The user opens a search palette and queries across all sessions for prompts, text blocks, tool inputs/outputs, diffs, and files. Results are grouped by project and show the matching snippet with the query highlighted. Selecting a result opens the relevant session and focuses the matching turn.

**Why this priority**: Search is essential to finding past work and is called out in the constraints. It is independent of live-tail and inspector flows.

**Independent Test**: Open the search palette, type a query that matches across multiple sessions, navigate results with arrow keys, press Enter on one, and verify the corresponding session and turn become focused.

**Acceptance Scenarios**:

1. **Given** the palette is open, **When** the user types a query, **Then** results update and are grouped by project, each result showing the session title, a highlighted snippet, the target turn id, and the time.
2. **Given** the palette has results, **When** the user uses `↑` / `↓` to navigate, **Then** the active result moves and is visually highlighted, and Enter opens it.
3. **Given** a search result is opened, **When** the palette closes, **Then** the target session is loaded (or restored) and the matching turn is focused and scrolled into view.
4. **Given** the index is still being built, **When** the user opens the palette, **Then** a progress indicator (sessions indexed, messages indexed, percentage) is visible.

---

### User Story 6 — Per-session report with cost/token attribution (Priority: P3)

The user can open a session-level report that summarises duration, turn count, total tool calls (main + subagent), cache hit rate, total cost, a per-model breakdown, a per-turn breakdown including cache-write delta, a per-turn cost sparkline with top spikes, and a per-file timeline of read/write activity.

**Why this priority**: High signal for understanding cost and behaviour but not required for primary navigation. Builds on P1.

**Independent Test**: Open the report from a multi-turn session, verify each section renders, all numbers are present (no NaN / "—" where data exists), the sparkline shows one point per turn, and the top-spikes list is sorted by cost descending.

**Acceptance Scenarios**:

1. **Given** any non-empty session, **When** the user opens the report (`r` or Report button), **Then** the modal renders with five stat cards (Duration, Turns, Tool calls, Cache hit, Total cost) populated from the session.
2. **Given** the report is open, **When** the user reads the "By agent & model" table, **Then** rows aggregate input/cache-5m/cache-1h/cache-rd/output/cache-hit/cost per (agent, model) pair, with a totals row at the bottom.
3. **Given** the report is open, **When** the user reads the "By turn" table, **Then** each row shows turn id, prompt preview, requests, blocks, attachments, cache-write delta, and cost.
4. **Given** the report is open, **When** the user views "Usage over time", **Then** a sparkline of per-turn cost is rendered and the top 3 spike turns are listed beside it.
5. **Given** the report is open, **When** the user views "Files touched", **Then** each file path is listed with a read/write pip timeline normalised across the session and a total event count.

---

### User Story 7 — Subagent navigation via inspector (Priority: P3)

The inspector surfaces a "Open subagent transcript" affordance when the focused tool_use spawned a subagent, with the subagent's summary (turn count, tool call count, cost, model) visible inline. The user can drill in from this single click and the workspace transitions to subagent view (covered in US2 from the inspector side).

**Why this priority**: A redundancy of US2 from the inspector path. Convenient but not blocking.

**Independent Test**: Focus a tool_use block that spawned a subagent, verify the inspector shows the drill affordance with the subagent's summary metrics, click it, and confirm the workspace navigates as in US2.

**Acceptance Scenarios**:

1. **Given** a focused tool_use that spawned a subagent, **When** the inspector renders, **Then** a "Open subagent transcript" CTA is visible with the subagent's turn count, tool call count, cost, and model.
2. **Given** the inspector CTA is visible, **When** the user clicks it, **Then** the same drill behaviour as US2 fires.

---

### User Story 8 — Personalisation: theme and density (Priority: P3)

The user can toggle between dark and light themes and between comfortable and compact density. Preferences are visible immediately and persist within the session window.

**Why this priority**: Quality-of-life. Independent of the core flows.

**Independent Test**: Toggle theme and density from the header controls and via the `t` shortcut for theme; verify all three panes update immediately and the change is visually consistent (typography rhythm and rail spacing for density; surface and text colours for theme).

**Acceptance Scenarios**:

1. **Given** the workspace is open, **When** the user toggles theme via header button or `t`, **Then** the entire UI switches between dark and light with no flash of unstyled content.
2. **Given** the workspace is open, **When** the user toggles density, **Then** row heights, padding, and font sizes reflow consistently across the sidebar, transcript, and inspector.

---

### Edge Cases

- **Session with zero turns**: Workspace shows the empty session header (title, chips zeroed) and an empty transcript body with no focus. Inspector shows the empty state. No errors thrown.
- **Session where every prompt is an stderr envelope**: `n` / `N` prompt navigation does not move focus; status bar reflects no change. No crash.
- **Subagent stack > 1 level deep**: User has drilled into a sub-subagent. Back button pops one level. Breadcrumb reflects only the immediate parent.
- **Live tail when scrolled to bottom**: New turns auto-follow with no toast.
- **Live tail when in a subagent**: Toast does not appear over the subagent view; it reappears once the user returns to the parent.
- **Inspector toggled off while a block is focused**: Pressing a block in the transcript while inspector is hidden auto-opens the inspector.
- **Resizing window very narrow**: Below a minimum width the rails are not the same shape as the design's fixed 1440px target; layout must still be readable and panes must collapse rather than overflow horizontally.
- **Sidebar session whose backing JSONL has not been read yet**: Selecting it triggers a load; until then the transcript pane shows a loading skeleton (no flash of empty content).
- **Search query that returns zero results**: Palette shows an empty state with guidance ("Start typing to search across all sessions" and the searchable types). Arrow keys are no-ops.
- **Session report opened on a session with no tool calls or no cache reads**: Sections render with zeros, not blanks; cache-hit shows `0%` not `NaN%`.
- **Files-touched list with very long paths**: Path is truncated with ellipsis in the middle (preserving filename), full path shown on hover.

---

## Requirements *(mandatory)*

### Functional Requirements

#### Cleanup (precondition for all rebuild work)

- **FR-001**: The project MUST, as the first step of implementation, remove all existing frontend application code under `packages/ui/src/` (components, hooks, stores, lib, styles, app entry, root template, tests for UI-only logic) and any UI-only build configuration that is no longer relevant. The cleanup MUST preserve the workspace shape of `packages/ui/` (its `package.json`, build tooling, and integration points with the server's static-serving step) so the new rewrite can land in the same package.
- **FR-002**: The cleanup step MUST NOT touch backend code in `packages/server/**` (reader, search, app, CLI, static, util), the shared types in `packages/shared/**`, the CLI entry in `bin/`, top-level `scripts/`, or any infrastructure that the server depends on. Existing backend tests and contracts MUST continue to pass after cleanup.
- **FR-003**: After cleanup, the UI package MUST be in a known-empty state with a single placeholder entry (or be re-scaffolded fresh) so a clean build of the rewritten UI starts from a defined zero state, not from a partial mixture of old and new code.

#### Workspace shell

- **FR-010**: The application MUST render a three-pane workspace at launch: a left sidebar for projects and sessions, a centre transcript pane, and a right inspector pane. The inspector MUST be hideable via a header control without unmounting its state.
- **FR-011**: The application MUST persist the focused session's most recent meaningful node on load and auto-scroll to it (typically the last request of the last turn).
- **FR-012**: The application MUST display a bottom status bar that shows (a) the position breadcrumb of the currently focused node ("Turn X › Request N/M" or "Turn X › User input") and (b) a list of available keyboard hints.

#### Sidebar (session browser)

- **FR-020**: The sidebar MUST list projects as collapsible groups; each group MUST show its project name, a count badge, and a chevron that toggles its expanded/collapsed state.
- **FR-021**: Each session row MUST display the session title (truncated with ellipsis on overflow), relative time, message count, total cost, and optional indicators for pinned and live status.
- **FR-022**: Hovering a session's cost MUST reveal a tooltip with the token breakdown (input, output, cache create, cache read) formatted as compact numbers (K thousands).
- **FR-023**: The sidebar MUST include a search button at the top that opens the search palette and visually advertises the `⌘K` shortcut.
- **FR-024**: Selecting a session row MUST load that session into the transcript pane (or restore it from cache if already loaded) and focus its default node (the last request of the last turn).

#### Transcript header & chips

- **FR-030**: The transcript header MUST show the session title and a row of summary chips: Turns count, Requests count, total Cost, Model, and an optional "Live" chip when the session is being tailed.
- **FR-031**: The transcript header MUST expose action buttons for: open Session Report, toggle Inspector, toggle Density, toggle Theme, and a generic "more" affordance.
- **FR-032**: When the user is inside a subagent transcript, the header MUST show a "Back to [parent session title]" breadcrumb, a "Subagent transcript" label, and the spawning turn id.

#### Transcript nav bar (sticky)

- **FR-040**: A sticky nav bar below the header MUST expose four steppers: Turn, Request, Prompt, Tool. Each stepper has left/right arrow buttons and a label.
- **FR-041**: The Turn stepper's label MUST be clickable and MUST open the Turn Jumper overlay anchored to the stepper.
- **FR-042**: The nav bar MUST show a preview of the focused turn's prompt (up to ~90 characters, ellipsis-truncated) and the focused turn's total cost.

#### Transcript body

- **FR-050**: The body MUST render the session as a sequence of Turn sections separated by clickable Turn dividers. A Turn divider MUST show turn id, time, and aggregate cost in a pill.
- **FR-051**: Each Turn MUST render a User prompt node (with attachment indicator if applicable) followed by one or more Request nodes.
- **FR-052**: A Request node MUST show its label (ID, idx/total in the turn, duration, cost), a marker row (idx/total, block count, TTFT, duration, cost), and its blocks rendered in order.
- **FR-053**: Blocks MUST render according to kind:
  - `thinking` — a labelled italic body block.
  - `text` — a paragraph block with light inline markdown (`**bold**`, backtick code, line breaks).
  - `tool_use` — a "tool capsule" showing kind, tool name, argument summary, duration, status (ok/err), an optional preview snippet, and a subagent CTA when applicable.
  - `diff` — a header line (path, language, +adds/−dels) and a clipped hunk preview with gutter (line numbers and add/del markers).
- **FR-054**: Tool capsule argument summary MUST be derived from the input: `Bash` → command; `Read`/`Write`/`Edit` → path; `Grep` → pattern (+ path if present); `Glob` → pattern; `Agent` → description; otherwise the first two input keys joined.
- **FR-055**: Clicking a Turn divider, user prompt, request node, tool capsule, or diff block MUST set focus on that node or block and update the inspector accordingly.

#### Focus model

- **FR-060**: The application MUST maintain two independent focus targets: a node focus (turn / user prompt / request) and an optional block focus (tool_use / diff). Block focus implies node focus on the block's owning request.
- **FR-061**: Setting focus MUST scroll the focused node comfortably into view (smooth scroll, with the node offset below the sticky nav bar). Initial load MUST use an instant (non-smooth) jump to avoid an animated scroll at startup.
- **FR-062**: Clearing block focus (Esc when no overlay is open) MUST keep the node focus and refresh the inspector to the node-level view.

#### Inspector (right rail)

- **FR-070**: The inspector MUST show distinct views depending on what is focused:
  - Empty state — when nothing is focused.
  - Request view — crumb (REQUEST id › TURN id, idx/total), metrics row (Cost, Tokens, Duration), and a list of all blocks in the request with click-to-jump.
  - User view — crumb (USER MESSAGE id › TURN id), metrics (Characters, Estimated tokens, Attachments), the full prompt text, and a list of attached events with a "counts toward next request" caption.
  - Tool view — crumb (TOOL_USE › REQUEST id › TURN id), tool name and status, formatted Input JSON, Output text, and a subagent drill CTA when applicable.
  - Diff view — crumb (DIFF › REQUEST id › TURN id), full diff (no clipping), and a "Copy path" affordance.
- **FR-071**: Clicking a row in the inspector's "Blocks in this request" list MUST navigate to that block in the transcript body and set the block focus.
- **FR-072**: The inspector MUST be safely empty if state is incomplete (no errors / no crashes for missing optional fields).

#### Keyboard

- **FR-080**: The application MUST handle the following keyboard shortcuts globally, except when focus is inside a text input or contenteditable element:
  - `j` / `k`: step focus node forward / backward.
  - `Shift+J` / `Shift+K`: step to first node of next / previous turn.
  - `n` / `Shift+N`: step to next / previous user prompt, skipping prompts whose text begins with `[stderr]`.
  - `[` / `]`: step to previous / next tool_use or diff block across the whole session.
  - `Shift+T`: open Turn Jumper anchored to the Turn stepper.
  - `t`: toggle theme.
  - `r`: toggle Session Report.
  - `Cmd+K` / `Ctrl+K`: open Search Palette.
  - `/`: open Search Palette (when not inside an input).
  - `g g` within ~700ms: jump to first turn and scroll to top.
  - `Shift+G`: jump to last turn, scroll to bottom, dismiss any tail toast.
  - `Space` / `Shift+Space`: scroll the transcript body by ~85% of its height.
  - `Esc`: dismiss top overlay (jumper → report → search) or clear block focus.
- **FR-081**: The status bar MUST display the available shortcuts as hint chips so they are self-documenting.

#### Subagent navigation

- **FR-090**: The application MUST maintain a session stack so the user can drill into a subagent and pop back. Pushing a subagent MUST not destroy the parent's focus state.
- **FR-091**: While inside a subagent, the transcript header MUST show a back button labelled "Back to [parent title]". Clicking it MUST pop the stack and restore the parent's focus and scroll position.
- **FR-092**: The drill-in entry points MUST be available both inline on the tool capsule (when the tool spawned a subagent) and inside the inspector tool view (same affordance, same target).

#### Live tailing

- **FR-100**: When the active session is identified as live, the transcript header MUST show a "Live" chip with a pulsing dot indicator.
- **FR-101**: When new turns arrive during live tail, if the user is not at the bottom, the transcript body MUST show a non-blocking toast offering `Shift+G` to follow. If the user is at the bottom, the body MUST auto-follow the tail.
- **FR-102**: The toast MUST not surface while the user is inside a subagent transcript; it MUST re-surface when they return to the parent if new turns are still pending.

#### Search palette

- **FR-110**: The palette MUST open via `⌘K`, `Ctrl+K`, `/`, or the sidebar search button.
- **FR-111**: The palette MUST show a single input, an indexing status row (sessions indexed, message count, progress bar, percentage) while the index is building, results grouped by project, and a footer with hint chips for `↑↓`, `↵`, `esc`.
- **FR-112**: Each result row MUST show a kind badge (e.g., diff, tool_use, prompt, text), the session title, a snippet with the query highlighted, the target turn id, and the time.
- **FR-113**: Arrow keys MUST move the active result, Enter MUST open the active result, hover MUST set the active result, Esc MUST close the palette.

#### Turn jumper

- **FR-120**: The jumper MUST anchor itself below the Turn stepper when opened from the nav bar. When opened by `Shift+T`, it MUST anchor consistently relative to the same control.
- **FR-121**: The jumper list MUST show every turn in the current session with its id, time, prompt preview, and meta (`r` requests, `b` blocks, total cost).
- **FR-122**: Arrow keys MUST move the active row, Enter MUST jump to the active row's turn, hover MUST set the active row, Esc MUST close.

#### Session report

- **FR-130**: The report overlay MUST present five stat cards: Duration, Turns, Tool calls (main + sub), Cache hit (read / read+create+input), Total cost.
- **FR-131**: The report MUST include a "By agent & model" table aggregating input, cache-5m, cache-1h, cache-read, output, cache-hit %, and cost per (agent, model) pair, with a totals row.
- **FR-132**: The report MUST include a "By turn" table with turn id, prompt preview, requests, blocks, attachments, cache-write delta, and cost.
- **FR-133**: The report MUST include a sparkline of per-turn cost (one point per turn) and a list of the top 3 spike turns with their prompt previews and costs.
- **FR-134**: The report MUST include a "Files touched" timeline: one row per file with read/write pips positioned across the session timeline and a total event count.
- **FR-135**: An export affordance for the "By agent & model" table MUST be visible ("Export CSV"); export behaviour itself is out of scope for v1 (the affordance may be a no-op stub).

#### Personalisation

- **FR-140**: The workspace MUST expose theme (dark / light) and density (comfortable / compact) toggles in the transcript header.
- **FR-141**: Theme and density MUST update all three panes immediately on toggle without a full reload.
- **FR-142**: Theme and density state MUST persist for the duration of the current browser session (page reload may reset them in v1).

#### Backend integration

- **FR-150**: The new UI MUST consume the existing local server's HTTP/SSE endpoints for sessions list, session content, live updates, subagent transcripts, and search; no new backend endpoints SHOULD be added unless a design feature cannot be implemented from the existing surface.
- **FR-151**: The UI MUST never send transcript content to any external network. All transcript reads and search requests MUST stay on the local server.
- **FR-152**: When a design feature cannot be sourced from the existing backend without changes, the gap MUST be documented in the implementation plan as a backend extension rather than worked around in the UI.

---

### Key Entities

- **Session**: A logical Claude Code conversation backed by a JSONL file. Has an id, title, model, project, time metadata, message count, cost, token totals, and ordered turns. May be live (currently being written).
- **Turn**: An ordered grouping inside a session corresponding to one user input plus the model's response. Has an id, time, the user message, attachments, and an ordered list of requests.
- **Request**: One Claude API call inside a turn. Has an id, duration, TTFT, cost, token usage breakdown, and an ordered list of blocks.
- **Block**: A unit within a request — one of `thinking`, `text`, `tool_use`, or `diff`. Tool blocks may spawn a subagent.
- **User Message**: The user-side event at the start of a turn. Carries the prompt text and optional attachment events injected at the same timestamp.
- **Attachment**: An auto-injected event accompanying a user message (e.g., reminders, tool results). Counts toward the next request's input tokens.
- **Subagent Session**: A nested session spawned by a parent's tool call. Has its own turns and metadata and is reachable from the parent via a drill affordance.
- **Project**: A grouping of sessions sharing a working directory or repo. Has a name, path, and an ordered list of sessions.
- **Search Result**: A reference to a hit inside a session, with the project, session id and title, target turn id, a snippet with highlighting, a kind badge, and a timestamp.
- **Session Report**: A precomputed aggregation over a session — totals, per-model breakdown, per-turn breakdown, per-turn cost series, top spikes, files-touched timeline.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can open any session listed in the sidebar and scroll from the most recent turn to the first turn without the UI hitching, even for sessions with 10,000+ messages. "Hitching" means any pause longer than ~150 ms during continuous scrolling on a recent-vintage laptop.
- **SC-002**: All keyboard shortcuts in FR-080 work on first press across at least 95% of sessions tested, with the focused node visibly updating and the status bar's position breadcrumb reflecting the move.
- **SC-003**: Drilling into a subagent and returning to the parent restores the previously focused node in 100% of test scenarios; the user does not have to re-find their place.
- **SC-004**: When a live session receives a new turn while the user is reading earlier content, the toast appears within 1 second of the underlying transcript file being updated and `Shift+G` reveals the new turn within 250 ms of the press.
- **SC-005**: The search palette presents ranked results within 500 ms for queries against an index covering at least the user's most recent 50 sessions.
- **SC-006**: The session report opens within 750 ms for any session with up to 1,000 turns and renders every section with no missing numbers (no NaN or empty cells where data exists).
- **SC-007**: Toggling theme or density updates all three panes within 100 ms with no flash of unstyled content.
- **SC-008**: After cleanup of the old frontend, the new UI is the only frontend in the repo: no lingering imports, references, or dead files from the previous implementation, and the production bundle does not include unused code from the deleted UI.
- **SC-009**: The backend test suite passes unchanged after the UI rewrite is complete, demonstrating that no backend contracts were broken in the process.
- **SC-010**: The single-CLI launch flow still works end-to-end: running the published command opens a browser at the local server URL and the new workspace is fully functional with no manual setup beyond the existing requirements.

---

## Assumptions

- **Pixel-perfect from the design**: The `.design/v4/project/cc-transcript-viewer.html` prototype (with its `app.css`, `app.jsx`, `sidebar.jsx`, `transcript.jsx`, `inspector.jsx`, `overlays.jsx`, `icons.jsx`) is the authoritative visual reference. The new implementation matches the prototype's visual output but is free to choose any implementation structure consistent with the existing codebase's stack and patterns.
- **Sample data in the prototype is illustrative only**: `data.js` shows shapes but the production UI reads real data from the existing local server. Any divergence between prototype shape and server shape is resolved by adapting on the UI side, not by editing the server.
- **Backend already provides what the design needs (or is close enough)**: For features whose backing data already exists (sessions list, session content, live updates, search, subagents), the UI consumes the existing endpoints. For features where the backend is missing data (e.g., the per-turn cost series and files-touched timeline for the Session Report), the gap is captured in the implementation plan as a backend extension, not papered over in the UI.
- **Cleanup is destructive and intentional**: The user has explicitly asked to "disregard the current UI related code and start from scratch." The cleanup step removes existing UI source files and UI-only tests rather than gradually refactoring them. Backend code is preserved as-is.
- **Density toggle scope**: The "comfortable" / "compact" density values change typographic and spacing rhythm but do not change the layout's pane structure or rearrange controls.
- **Persistence of preferences is session-scoped in v1**: Theme and density default on each reload to `dark` and `comfortable` respectively unless the design's `data-theme` / `data-density` defaults change. Cross-session persistence (e.g., localStorage) is a non-goal for v1.
- **Search across multiple sessions includes selecting an inactive session**: Picking a result from the palette loads that session into the transcript pane (today the prototype sometimes leaves the active session in place; the real implementation MUST load the picked session).
- **Export CSV affordance is a stub in v1**: The button is visible in the report's "By agent & model" header to match the design, but actual CSV export is out of scope for this rewrite.
- **Minimum viewport**: The design targets a 1440 px wide viewport. The new UI is usable down to ~1024 px, below which a single-pane fallback is acceptable (out of scope for this rewrite if not already present).
- **No external network calls with transcript content**: Reaffirmed from the project brief — transcript content stays on the local machine. The UI does not call any third-party endpoints for the features above.
