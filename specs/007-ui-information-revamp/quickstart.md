# Quickstart — verifying the UI information revamp

A reviewer-friendly recipe for confirming each Chunk has landed correctly. Each section maps to a chunk in plan.md §9.

## Prereqs

- Dev environment running per `CLAUDE.md` ("Recommended Stack" section).
- A representative session in `~/.claude/projects/` containing: a subagent invocation, an Edit tool call, a Bash tool call with off-loaded output (`persistedOutputPath`), at least one attachment with each major payload subtype available, an `api_error` retry chain, a permission-mode transition, a worktree-state change.
- A 10k+-row session for scale tests.
- A 145 MB-class session for cold-start baseline.

## Chunk A — Schema parsing parity

```
npm run dev
# open the largest corpus session in the browser
```

**Check**:
- Sidebar lists the session; opens without error.
- Every previously-loading session still loads. No row type produces a crash.
- Synthetic unknown-row test fixture renders as a degraded card with raw structure visible.
- Network tab: `/api/sessions/:id` response includes a `rows` field (full `ClaudeRow[]`).
- Live-tail still streams; existing rendering paths unchanged.

**SCs verified**: SC-001, SC-008, SC-009.

**Baseline metric**: record first-viewport-render time on the largest session via DevTools Performance. This becomes the v4 baseline for SC-006.

## Chunk B — Tool sidecar surfacing

**Check**:
- Open a session with an Edit tool. Expand the tool result. A sidecar tab/section exposes the `structuredPatch` (hunks rendered as a diff).
- Open a session with an Agent tool. The parent's tool_use row shows a small chip with totalDurationMs / totalTokens / toolStats from `AgentRollupResult` BEFORE drilling in. Drilling in opens the subagent transcript; back returns to the same scroll position.
- Open a Bash tool result whose row carries `persistedOutputPath`. Expanding it triggers a lazy fetch to `/api/sessions/:id/tool-results/:filename`; the off-loaded content renders.
- Open an AskUserQuestion tool. The structured Q&A pairs render.
- Synthetic test: delete the off-loaded file from disk; UI shows "missing-blob" message clearly.

**SCs verified**: SC-002, SC-010.

## Chunk C — Attachments + system events + images

**Check**:
- For each of the 22 attachment subtypes (per `schema.ts:585-820`) present in the test corpus, verify a type-specific rendering appears inline with the user submission that carried it.
- An `api_error` retry chain renders as a connected sequence, not isolated blips. Final outcome (success/failure) is visible.
- `turn_duration` / `stop_hook_summary` / `away_summary` rows render as inline system event rows.
- A session with images:
  - User-pasted image in prompt: thumbnail renders, click expands to full.
  - Tool-returned image (inside tool_result content array): renders.
  - Bash with `isImage: true`: renders.
- Large image (>256 KB) renders as a placeholder card; click triggers lazy fetch.

**SCs verified**: SC-011 (live-tail parity with these new surfaces — test on an active session).

## Chunk D — Sticky state + non-sticky inline events

**Check**:
- Every Turn shows badges for the current sticky harness state: permission mode + model identifier at minimum (FR-027).
- Pick a Turn well after a `permission-mode` transition row. Confirm its badge reflects the post-transition value, not the default.
- Pick a Turn before any `permission-mode` row was emitted. Confirm its badge reflects the default.
- `queue-operation` / `pr-link` / `file-history-snapshot` rows render inline as state-change cards.
- Toggling the model identifier mid-session (a session with both Opus and Sonnet calls): per-Turn badge updates correctly across the boundary.

**SCs verified**: SC-012.

## Chunk E — Session-summary surface

**Check**:
- A session-summary surface is reachable (mode toggle / panel / button per design).
- Token totals match a hand-computed total after de-duplicating by `message.id` (FR-015 / SC-004). Sanity check: pick a session, sum `assistant.message.usage` once per unique `message.id`, compare with the summary's value.
- Cache-creation and cache-read figures are reported separately (FR-016 / SC-005).
- Files-touched list matches the union of `FileHistorySnapshotRow.snapshot.trackedFileBackups` paths.
- A file-history backup blob is fetchable: click → `/api/sessions/:id/file-history/:backupFileName` → file contents render in a viewer.
- Each summary entry links back to the inline location where the event originated (SC-013).
- API-error retry chain count matches the number of distinct chains in the session.
- Harness-state transitions are in chronological order with from/to values.

**SCs verified**: SC-004, SC-005, SC-013, FR-014, FR-015, FR-016, FR-017.

## Chunk F — Search + within-session navigation

**Check**:
- Search for a string that appears only in a tool input (e.g., a filename in a Bash command). The result appears.
- Search for a string that appears only in an attachment payload (e.g., a skill name). The result appears.
- Clicking a search result jumps to the originating Turn in the loaded session.
- Prompt-anchor list shows every Turn's first-line prompt + timestamp.
- Clicking an anchor jumps to the Turn (scrolls into view; sets `focusedTurnId`).
- A 10k-row session: locating a specific prompt via search or the anchor list takes <10 s (SC-003).

**SCs verified**: SC-003, FR-018.

## Cross-chunk: performance verification

**Cold-start** (SC-006): re-measure first-viewport-render time on the largest corpus session. MUST be ≤ the Chunk A baseline.

**Steady-state** (SC-006a):
- Scroll through a 10k-row session at full speed. DevTools Performance flame chart: no frames longer than 16.6 ms during steady-state scroll.
- Expand/collapse a Turn: visible feedback within 100 ms.
- Toggle disclosure mode (recall → learn): completes within 200 ms.

## Cross-chunk: scroll preservation (SC-007)

- Scroll to mid-session. Toggle `showAttachments` off. Scroll position does not jump.
- Toggle disclosure mode. Scroll position does not jump.
- Expand a Turn. Scroll position does not jump.

## Live-tail parity (FR-025 / SC-011)

- Open a live session. Make Claude Code emit a new tool call that has a structured sidecar (e.g., an Edit).
- The new tool result row renders with its sidecar reachable from the same UI interaction used on post-loaded sessions. No reload required.
- Sticky-state badges update if the new row contains a sticky transition.

## Constitution gates (quarterly spot-check)

- **I. Local-First Privacy**: DevTools Network tab during a full session view: zero requests to non-localhost origins carrying transcript data.
- **II. Scale by Default**: 145 MB session scrollable without UI hang.
- **III. Single-Command**: `npx cc-transcript-viewer` (or current invocation) still starts the tool.
- **IV. Source-File Read-Only**: `lsof` / `fs.watch` confirms no write to `~/.claude/projects/`.
- **V. Simplicity**: PR diff for each chunk traces every changed line to an FR.

## Legacy Turn[] consumers (T056 audit — 2026-05-26)

These UI surfaces still depend on `SessionView.turns` (the post-projected
two-level shape) rather than the schema-typed `SessionView.rows`. Per plan
§9 Chunk F, cleanup of the legacy `turns` field is deferred until every
listed consumer migrates to a `rows`-driven projection.

- `packages/ui/src/components/transcript/Transcript.tsx` — `buildRows(view)`
  walks `view.turns`; the new RowItem-based flat-row builder
  (`useFlatRows`) is shipped but not yet integrated (T015 deferred).
- `packages/ui/src/components/transcript/TurnDivider.tsx`,
  `UserPrompt.tsx`, `RequestNode.tsx` — render directly from `SessionTurn`.
- `packages/ui/src/components/transcript/TranscriptHeader.tsx`,
  `TranscriptNavBar.tsx` — surface turn counts / stepping.
- `packages/ui/src/components/inspector/Inspector.tsx` and
  `packages/ui/src/components/overlays/{SessionReport, TurnJumper}.tsx` —
  consume `SessionTurn` for focus + jump.
- `packages/ui/src/hooks/{useFlatNodes,useFlatPrompts,useFlatTools,useKeyboard}.ts`
  — flat projections derived from `view.turns`.

New `rows`-driven consumers landed in this batch:

- `App.tsx::resolveSearchHit` — Search-hit jump now resolves a `rowUuid`
  against the matching SessionTurn through `view.rows` (T052).
- `useSessionView.ts::projectSessionView` — populates per-turn `promptId`
  and `sticky` from `view.rows` via `projectStickyState` (T018/T040).
- `TranscriptSessionContext` + `BlockBashSidecar` — session-scoped
  off-loaded-blob fetch wired through React context (T031).

The legacy `turns` field cannot be removed until the Transcript render
loop migrates to the RowItem-based path (T015).
