# Feature Specification: UI Information Revamp

**Feature Branch**: `007-ui-information-revamp` *(branch not yet created — see Assumptions)*

**Created**: 2026-05-26

**Status**: Draft

**Input**: User description: "UI information revamp — surface the structured information that current chat-style transcript views discard, so users can fully recall, learn from, and audit Claude Code sessions. Driven by a freshly landed, corpus-validated schema (`packages/server/src/jsonl/schema.ts`, `packages/shared/src/jsonl/README.md`) that exposes data the previous UI never rendered: structured `toolUseResult` sidecars (37 MB across the validation corpus vs. 23 MB of LLM-visible string content), 22 attachment payload variants, 6 system-row subtypes, 9 session-state row types, per-row usage with cache split, subagent transcripts, off-loaded oversized tool outputs, file-history snapshots, and image attachments in three distinct locations."

## Clarifications

### Session 2026-05-26

- Q: As rows arrive via the existing live-tail channel during an active session, must the new information surfaces (structured sidecars, attachment payloads, system events, usage, file-history, subagent rollups) render at full fidelity in real time, or only on full reload? → A: **Full live-tail parity.** Newly-arrived rows must render with the same information fidelity, expand/collapse affordances, and disclosure model as the same rows on a fresh post-load. No new surface may be deferred until reload.
- Q: Where should aggregate Audit data (file-history, PR links, token totals, retry-chain count, permission-mode transitions, etc.) appear? → A: **Both — inline + session-summary surface.** Events appear inline at the point they happened AND are aggregated in a session-summary surface. *Refinement:* A subset of events represent **sticky harness state** (permission mode, model identifier, plan/auto-mode flags, worktree state, and similar settings-style values) — these are not one-shot blips. Their last-emitted value MUST be carried forward and attributed to every subsequent turn until a new value supersedes it, so that every turn can display the harness configuration in effect at the moment it ran. Non-sticky events (one-shot rows like queue-operation, away_summary) stay attached only to the turn where they occurred. The canonical sticky set is defined in the plan; permission mode and model identifier are required members.
- Q: How should performance be quantified? → A: **Hybrid budget.** Cold-start is relative — opening any session must be no worse than the current v4 viewer on the same hardware and same session file. Steady-state interaction on an already-loaded session is absolute: no dropped frames during scroll, expand/collapse feedback ≤100ms, mode/disclosure-switch ≤200ms. The cold-start budget acknowledges that 145 MB-class sessions are I/O-bound; the steady-state floor protects against regressions introduced by the new richer rendering.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Recall: navigate any session and see what happened (Priority: P1)

A user opens a long Claude Code session (potentially 10k+ rows / hundreds of MB of JSONL) and needs to find a specific prompt they remember asking, then see the outcome of the turn that followed it — what tools ran, whether they succeeded, what the final assistant message said — without having to expand every entry by hand.

**Why this priority**: Recall is the core value of the viewer. Every other user job depends on first being able to load and traverse the session. If recall regresses, the product fails its primary purpose regardless of how much new information is surfaced.

**Independent Test**: Open a representative session (≥10k rows, multiple subagent invocations, mixed tools). The user can (a) scroll the full session without scroll jumps or lost position, (b) jump to a specific prompt by some navigational affordance (table of contents, search, prompt-anchor list), (c) see each turn's outcome at a glance without expanding it, and (d) expand any turn for detail. Delivers a fully usable transcript viewer even if no other story is implemented.

**Acceptance Scenarios**:

1. **Given** a session file with 10k+ rows, **When** the user opens it, **Then** the first viewport renders within a perceptible-instant budget and the user can scroll smoothly to any point in the session without scroll position being lost or visual jumps occurring.
2. **Given** a user submission that produced many tool calls, **When** the user views the corresponding turn collapsed, **Then** they can see the prompt text, the count and type of tools that ran, the success/failure status, and the final assistant message — without expanding individual blocks.
3. **Given** a user remembers a phrase from a prompt earlier in the session, **When** they use the navigation affordance (search or prompt list), **Then** they can jump directly to that turn.
4. **Given** the schema exposes a row type the UI does not specifically style, **When** the row is encountered, **Then** it renders as a clearly-marked degraded card with its raw structure visible rather than crashing the view or being silently dropped.

---

### User Story 2 — Learning: understand how Claude Code actually works (Priority: P2)

A user wants to understand the mechanics of a Claude Code session: what context got injected before the LLM saw the prompt, which hooks fired, what attachment payloads rode with each user submission, what the LLM saw versus what the harness recorded, which system events happened between turns, and what the structured tool-result sidecar contained (not just the string the LLM saw).

**Why this priority**: This is the largest body of currently-hidden information and the primary motivation for the revamp. Current chat-style viewers throw it away. Exposing it turns the viewer into a learning instrument for anyone trying to understand how the agent behaves end-to-end. It depends on Recall being solid first.

**Independent Test**: Open a session that includes attachments (task_reminder, skill_listing, hook events, etc.), tool calls with rich `toolUseResult` sidecars (file edits, diffs, agent rollups), and at least one subagent invocation. The user can see the attachment payloads associated with each user submission, see the structured sidecar alongside (or instead of) the LLM-visible string, and drill into the subagent's own transcript. Delivers value even if Audit (US3) is not yet implemented.

**Acceptance Scenarios**:

1. **Given** a user submission that carried attachment payloads (skill listings, deferred-tool deltas, hook stdout/stderr, etc.), **When** the user views that turn, **Then** the attachment payloads are accessible and clearly attributed to that submission rather than being dropped or scattered.
2. **Given** a tool call has a structured `toolUseResult` sidecar that contains data not present in the LLM-visible string (e.g., a file edit's old/new content, a diff hunk list, an agent rollup with durations and per-tool stats), **When** the user expands the tool result, **Then** the structured sidecar is reachable in addition to (and distinguishable from) the LLM-visible payload.
3. **Given** an `Agent` tool call invoked a subagent that recorded its own transcript file, **When** the user opens that tool call, **Then** they can navigate from the parent's rollup view into the subagent's full transcript and back, preserving where they were in the parent.
4. **Given** a turn included system rows (e.g., `turn_duration`, `stop_hook_summary`, `away_summary`) or session-state rows (e.g., permission-mode transition, queue operation, worktree state change), **When** the user views the turn, **Then** those events are visible in the appropriate place in the timeline rather than being dropped.
5. **Given** an image was attached via any of the three possible paths (inline in a prompt, inside a tool-result content array, or base64-encoded in Bash stdout), **When** the user reaches that point in the transcript, **Then** the image is reachable from the UI (rendered or lazily fetched on demand).

---

### User Story 3 — Audit: see what went wrong and what it cost (Priority: P3)

A user needs to assess a session's health and cost: total tokens used (with cache hit rate), per-turn token spend, the sequence of any API errors and their retry chain, hook failures, permission-mode transitions, every file that was touched, and any PRs that were opened.

**Why this priority**: Audit answers the "should I worry about this session?" question. It builds on Recall (to find the session) and Learning (to interpret the events). It is third in priority because the failure mode of weak audit is "I don't see costs" — annoying but not blocking — while the failure modes of weak Recall (can't open the session) and weak Learning (can't see what happened) are both blocking.

**Independent Test**: Open a session that includes at least one `api_error` with a retry chain, multiple turns with usage data, a permission-mode transition, and a turn that touched several files. The user can see a session-level summary of total tokens (correctly de-duplicated), see the retry chain rendered as a connected sequence, see per-turn token spend, and see the list of files touched. Delivers value independent of any visual polish in US1/US2.

**Acceptance Scenarios**:

1. **Given** a session with multiple LLM calls, **When** the user views session-level totals, **Then** the displayed total token usage is de-duplicated: rows sharing the same LLM message identifier contribute their usage exactly once, not once per row.
2. **Given** a turn had cache hits, **When** the user views the turn's usage, **Then** the cache-creation and cache-read figures are displayed separately rather than collapsed into a single number.
3. **Given** an API call failed and retried, **When** the user views the affected turn, **Then** the retry chain is presented as a connected sequence with the final outcome clearly indicated.
4. **Given** a session included permission-mode transitions, hook failures, or queue operations, **When** the user views the session, **Then** these events are visible in the session timeline with enough context to identify when and why they happened.
5. **Given** a session touched multiple files (per the on-disk file-history snapshots), **When** the user looks for a list of affected files, **Then** the UI exposes that list and can link back to the turn where each file was touched.

---

### Edge Cases

- **Sessions with no structured `toolUseResult` sidecar** (older Claude Code versions or rows where the harness didn't record one) — the UI must fall back gracefully to showing only the LLM-visible payload, without an empty-sidecar placeholder cluttering the view.
- **Subagent transcript file is missing, partially written, or corrupted** — drilling in must surface the failure clearly and allow the user to return to the parent without losing scroll position.
- **An off-loaded oversized tool output is referenced but the on-disk blob is missing** — the UI must surface that the blob is unavailable and offer the inline error string as the closest substitute.
- **Multiple rows share the same `message.id`** — usage must be summed once per message identifier, not once per row, in every place totals are displayed (session-level, turn-level, and any per-message breakdown).
- **An unknown row type appears** (forward-compatibility with future Claude Code versions) — the UI renders it as a degraded but identifiable card; the session continues to load and remain navigable.
- **Very large inline base64 images in Bash stdout or attachments** — must not block initial render of the surrounding rows; lazy-loadable per-image.
- **Sessions with extreme depth of subagent nesting** — drilling in and out must preserve a navigable path back to the originating turn.
- **The user toggles between disclosure levels (e.g., collapse all, expand all, mode switches)** mid-session — scroll position and the identity of the focused turn must be preserved.

## Requirements *(mandatory)*

### Functional Requirements

**Coverage of schema variants**

- **FR-001**: The UI MUST render every row type defined in the corpus-validated schema (user, assistant, system, attachment, every session-state variant) without dropping rows.
- **FR-002**: For every tool call, the UI MUST surface both the LLM-visible payload AND the structured sidecar data when the latter is present, with the two clearly distinguishable.
- **FR-003**: The UI MUST surface every attachment payload variant (including but not limited to task reminders, skill listings, deferred-tool deltas, MCP instruction deltas, command permissions, auto-/plan-mode entries and exits, hook events with stdout/stderr, goal status, nested memory, edited text-file rows) and attribute each to the user submission it rode with.
- **FR-004**: The UI MUST surface every system-row subtype (including API errors with retry chains, turn-duration markers, stop-hook summaries, and away-mode summaries) within the appropriate place in the session timeline.
- **FR-005**: The UI MUST surface every session-state row type (including permission-mode transitions, worktree state, PR links, queue operations, file-history snapshots) in a discoverable location.
- **FR-006**: The UI MUST render images that appear in any of the three locations they can occur (inline in prompts, inside tool-result content arrays, base64-encoded inside Bash stdout when flagged as an image), with large images loadable on demand rather than blocking initial render.
- **FR-007**: When the UI encounters a row type it does not recognise, it MUST render a clearly-marked degraded card and continue loading the rest of the session.

**Grouping and turn assembly**

- **FR-008**: The UI MUST assemble flat rows into renderable turn units using stable identifiers from the schema; the exact grouping key (per-user-submission vs. per-LLM-message) is an implementation decision in the plan, but the chosen rule MUST be consistent across the session.
- **FR-009**: Each user submission's attachment rows MUST be attributed to that submission, not scattered or duplicated.
- **FR-010**: Each tool result MUST be visually connected to the tool call that produced it.

**Subagents**

- **FR-011**: When a tool call invoked a subagent, the UI MUST allow the user to drill into the subagent's own transcript and return to the parent without losing scroll position in the parent.
- **FR-012**: The parent UI MUST display the agent-rollup summary (total duration, total tokens, per-tool counts) recorded on the parent's tool-use row.

**Off-loaded artifacts**

- **FR-013**: For tool outputs off-loaded to disk, the UI MUST allow the user to view the off-loaded content on demand using the on-disk path referenced by the schema; if the on-disk artifact is missing, the UI MUST surface that fact clearly.
- **FR-014**: For file-history snapshots backed up to disk, the UI MUST expose the list of backed-up files and allow fetching a specific backup blob on demand.

**Usage and audit data**

- **FR-015**: When summing token usage across rows, the UI MUST de-duplicate by LLM-message identifier so that one logical LLM message contributes its usage exactly once regardless of how many transcript rows it produced.
- **FR-016**: The UI MUST display cache-creation and cache-read figures separately, not collapsed into a single number.
- **FR-017**: For API-error retry chains, the UI MUST render the chain as a connected sequence with the final outcome (success / final failure) clearly indicated.

**Navigation and density management**

- **FR-018**: The UI MUST provide a navigational affordance that lets the user jump to a specific user submission in a long session (e.g., search, prompt-anchor list, table of contents).
- **FR-019**: The UI MUST manage information density through progressive disclosure (e.g., collapse/expand, view modes, filters, or layered detail) — never by erasing data from what is reachable.
- **FR-020**: The UI MUST preserve scroll position and focused-turn identity when the user toggles disclosure levels or switches modes.

**Performance, privacy, layout**

- **FR-021**: The UI MUST meet a hybrid performance budget on the largest sessions in the validation corpus (representative size: ~145 MB of JSONL): (a) **cold-start (relative):** opening a session must be no worse than the current v4 viewer on the same hardware and same file; (b) **steady-state interaction (absolute) on an already-loaded session:** no dropped frames during scroll, expand/collapse feedback ≤100ms, mode or disclosure-level switch ≤200ms.
- **FR-022**: The session view MUST use a single virtualised scroll container; no nested independent scroll regions.
- **FR-023**: The server MUST NOT make outbound network calls with transcript content; all rendering data stays local.
- **FR-024**: The UI MUST not regress the currently-working "open a long session and scroll it" behaviour at any point during the revamp.
- **FR-025**: Rows arriving via the existing live-tail channel MUST render with the same information fidelity as the same rows on a full reload. No new information surface (structured sidecars, attachment payloads, system events, usage block, file-history snapshots, subagent rollups, image rendering, etc.) may be reachable only after the session closes or the page is reloaded.
- **FR-026**: The UI MUST present a **session-summary surface** reachable from the session view that aggregates: total token usage (de-duplicated per FR-015), cache-creation and cache-read figures (per FR-016), list of files touched (per FR-014), list of PR links and queue operations, count of API-error retry chains (per FR-017), and the chronological sequence of harness-state transitions (permission mode, model identifier, plan/auto-mode entries, worktree state). The session-summary surface MUST link each entry back to the inline timeline location where the event originated.
- **FR-027**: **Sticky harness state attribution.** A subset of event types represent settings-style harness state — at minimum, permission mode and model identifier; the plan defines the full canonical set, expected to include plan/auto-mode flags and worktree state. The UI MUST carry the last-emitted value of each sticky type forward and attribute it to every subsequent turn until a new value supersedes it. Each turn MUST be able to display the harness configuration in effect at the moment it ran, derived from the carry-forward, NOT only from rows emitted within that turn's own row group. Non-sticky events remain attached only to the turn where they occurred.

### Key Entities

- **Session** — one JSONL file under `~/.claude/projects/`. Has a sessionId, a file path, and a sequence of rows. May have an associated `subagents/` directory and `tool-results/` directory of off-loaded artifacts.
- **Row** — one line in a session's JSONL file. Always carries a row-type tag and a timestamp; many carry a stable identifier used for grouping. Variants include user submissions, assistant LLM outputs, system events, attachment payloads, and session-state events.
- **Turn** — a renderable unit assembled from a contiguous group of rows that belong to one user submission and the LLM/tool activity that responded to it. The exact grouping rule is fixed in the plan.
- **Tool call / tool result pair** — a tool invocation row and its matching result row. The result row carries both an LLM-visible payload and (often) a structured sidecar with richer detail.
- **Attachment** — a payload that rode with a user submission but was not part of the user's literal prompt text. Many subtypes.
- **Subagent transcript** — a separate JSONL file (referenced from a parent tool-use row) containing the subagent's own conversation, plus a metadata sidecar.
- **File-history snapshot** — a row that records a file backed up to disk, with an on-disk path that can be fetched on demand.
- **Off-loaded tool output** — a tool result whose payload was too large to inline; the schema points to a `tool-results/*.txt` file on disk.
- **Usage block** — token-accounting data attached to assistant rows, split into input / output / cache-creation / cache-read; multiple rows can share one logical block via a shared message identifier.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of row variants validated against the schema corpus render without falling through to the unknown-row degraded path. (Coverage of schema.)
- **SC-002**: For sessions in the validation corpus, the volume of structured sidecar data reachable through the UI matches the volume present in the underlying JSONL — i.e., the previously-discarded structured tool-result data (~37 MB across the corpus) becomes reachable.
- **SC-003**: A user can locate a specific user submission in a 10k-row session in under 10 seconds using the navigation affordance.
- **SC-004**: Token totals shown anywhere in the UI (session-level, turn-level, message-level) match a hand-computed total that de-duplicates by LLM-message identifier; no double-counting.
- **SC-005**: Cache-creation and cache-read figures are reported separately wherever usage is shown; the user can see cache hit rate at a glance for any session.
- **SC-006**: Opening the largest sessions in the validation corpus (~145 MB JSONL) renders the first viewport in time no greater than the current v4 viewer's first-viewport time on the same hardware and same session file (cold-start non-regression).
- **SC-006a**: On an already-loaded session of any size in the corpus, scrolling produces no dropped frames, expand/collapse interactions provide visible feedback within 100ms of user input, and mode/disclosure-level switches complete within 200ms (steady-state absolute floor).
- **SC-007**: Toggling between disclosure levels or modes never causes the focused turn to scroll off-screen or the scroll position to be lost.
- **SC-008**: No session that loads in the current viewer fails to load in the revamped viewer. (Recall non-regression.)
- **SC-009**: An unknown row type (synthesised for testing) is rendered as a degraded card; the surrounding session continues to load and remain navigable.
- **SC-010**: Drilling into a subagent and returning preserves the user's position in the parent transcript.
- **SC-011**: For an active session with live-tail enabled, a newly-arrived row of any schema variant renders with its information surfaces (sidecars, attachments, system events, usage, file-history, subagent rollup) reachable through the same interactions used post-load — no manual reload required.
- **SC-012**: For any turn in any session, the UI displays the values of sticky harness state (permission mode and model identifier at minimum) in effect at the moment that turn ran, derived by carrying forward the last preceding value of each type — even if the original setting event lies far earlier in the session.
- **SC-013**: A session-summary surface is reachable from the session view and presents token totals (de-duplicated), cache-creation / cache-read figures, files-touched list, PR links and queue operations, error-retry-chain count, and the chronological sequence of harness-state transitions; every entry on the summary links back to its origin location in the inline timeline.

## Assumptions

- **Branching deferred.** A new `007-ui-information-revamp` branch is not created by this spec because uncommitted work is in progress on `006-ui-rewrite-v4`. The user will manage the branch transition before implementation begins.
- **Schema is the source of truth.** `packages/server/src/jsonl/schema.ts` and `packages/shared/src/jsonl/README.md` are treated as the authoritative description of the data; this spec does not redefine them.
- **Locked stack.** Tech stack choices from `CLAUDE.md` (Vite + React 19 + Tailwind 4 + react-virtuoso + Hono + better-sqlite3 + Zustand) are not re-litigated. The plan may add small libraries with explicit justification but does not swap any locked dependency.
- **Out of scope (per the coding prompt's hard constraints).** Session sidebar redesign, CLI changes, and the live-tail SSE pipe are out of scope for this feature — they work and are not touched here.
- **Information exposure beats visual quiet.** Where density and exposure trade off, the spec favours exposing data through progressive disclosure rather than erasing it. Visual-design choices (modes vs. side inspector vs. layered density) are deferred to the design brief (`.design/v6-brief.md`) and the plan.
- **Shippable in chunks.** This feature will be sequenced as a scope ladder where each chunk delivers a user-visible improvement, starting with a chunk that strengthens P1 Recall without regressing anything. The exact ladder is owned by the plan.
- **Performance reference points.** "Smooth" and "perceptible-instant" are interpreted against the existing v4 viewer's behaviour on the same sessions — the revamp must not regress them and should ideally improve them.
- **Single-user, local-only.** No multi-user, no auth, no cloud. Transcripts may contain code, paths, and secrets; everything stays on disk and on localhost.
- **Forward compatibility is permanent.** The unknown-row fallback is not a temporary scaffold — future Claude Code versions are expected to add row variants and the UI must continue to load them as degraded cards.
