# Research: UI Rewrite v4

**Feature**: 006-ui-rewrite-v4
**Phase**: 0 — Outline & Research
**Status**: Complete; no `NEEDS CLARIFICATION` remaining

This file resolves the design-to-backend mapping decisions and the few cross-cutting choices that the spec deliberately did not pin down. The technology stack itself is already locked by CLAUDE.md and the constitution (React 19 + Vite 8 + Tailwind 4 + shadcn/ui + react-virtuoso + Zustand + TanStack Query) and is not re-evaluated here.

---

## R-01 — Mapping the design's "Turn / Request / Block" mental model onto `@cc-viewer/shared`

**Decision**: The UI projects the wire-level `Session.turns: Turn[]` into the design's two-level structure (a "session turn" = one user prompt + N assistant Requests) at render time. The projection lives in `packages/ui/src/hooks/useSessionView.ts`.

**Mapping**:

| Design concept | Wire type (`@cc-viewer/shared`) | How the UI gets there |
|----------------|--------------------------------|-----------------------|
| Session turn (the prototype's `Turn`) | A group of consecutive `Turn` events that begins with `role === 'user'` and includes all following `role === 'assistant'` events until the next user event | Group reducer in `useSessionView` |
| User message | The leading `role: 'user'` `Turn`; `turn.uuid` → `userMsgId`; `turn.textBlocks.join('\n')` → `prompt`; `turn.timestamp` → `time` | Direct read |
| Request (the prototype's per-API-call node) | A single `role: 'assistant'` `Turn`; one Request per assistant Turn | Direct read |
| Block: `text` | `assistantTurn.textBlocks[i]` | Map → `{ kind: 'text', body }` |
| Block: `thinking` | `assistantTurn.thinkingBlocks[i]` | Map → `{ kind: 'thinking', body }` |
| Block: `tool_use` | `assistantTurn.toolUses[i]` + the matching `ToolResult` from the next user-role Turn's `toolResults` array | Joined in `useSessionView` by `tool_use_id`; produces capsule preview/status/duration |
| Block: `diff` | A `ToolUse` whose `name ∈ {Edit, MultiEdit, Write}` and whose accompanying `ToolResult` carries a structured diff | Derived in `lib/toolArgs.ts` (see R-04) |
| Attachment events | A user Turn's `toolResults` + meta events whose timestamps match the user event | Joined in `useSessionView`; surfaced via `lib/classifyUserText.ts`-style classifier (see R-08) |

**Rationale**: `Session.turns: Turn[]` is the authoritative shape on the wire. The design's nested model is a convenience for rendering, not a backend concern. Doing the projection in the UI avoids touching the server and keeps the JSONL-level types stable for other consumers.

**Alternatives considered**:
- *Project on the server* (e.g., return a "session view" type with nested turns). Rejected: would add a new shape to `@cc-viewer/shared` and a new code path on the server purely to suit one consumer. The constitution's Simplicity principle (V) prefers the surgical change in the UI.
- *Render Turn-by-Turn without grouping* (one user event = one section, one assistant event = one section). Rejected: the design's nav bar shows "Request N/M" within a turn — that count only exists once we group.

---

## R-02 — Per-turn cost series and spikes for the Session Report

**Decision**: Consume `SessionDetailResponse.tokenSeries: TokenSeries` (or the live-fetched equivalent from `GET /api/sessions/:id/report`) directly. The series already exposes `points: TokenPoint[]` and `spikes: TokenSpike[]`.

**Rationale**: `buildTokenSeries(turns)` in `packages/shared/src/projections/token-series.ts` is already wired into both `/api/sessions/:id` (line 153 of `packages/server/src/api/routes.ts`) and `/api/sessions/:id/subagents/:agentId`. The Session Report's sparkline (FR-133) and top-3 spike cards consume `points` and `spikes` directly. No backend change.

**Alternatives considered**:
- *Compute in the UI from raw `Turn[]`*. Rejected: duplicates the projection, risks divergence from the report tables that consume the same numbers, and pulls per-turn arithmetic into render hot paths.

---

## R-03 — Files-touched timeline

**Decision**: Consume `SessionDetailResponse.fileTouchIndex: FileTouchIndex`. The UI renders one row per `FileTouch`, positioning read/write pips by normalizing the touch's timestamp against the session's first/last timestamps.

**Rationale**: `buildFileTouchIndex(turns)` is already exposed (line 154 of `routes.ts`); pips include both `read` and `write` kinds and the count is already aggregated.

**Alternatives considered**:
- *Stream a separate timeline endpoint*. Rejected — the data is small (one row per file) and is already bundled into the session response. No reason to add round-trips.

---

## R-04 — Tool capsule argument summary derivation

**Decision**: Re-derive the per-tool argument summary in the UI in `packages/ui/src/lib/toolArgs.ts`, matching the prototype's rules exactly:

- `Bash` → `input.command`
- `Read` / `Write` / `Edit` / `MultiEdit` → `input.file_path` (the actual JSONL field) — falls back to `input.path` if absent
- `Grep` → `"${input.pattern}"${input.path ? ' in ' + input.path : ''}`
- `Glob` → `input.pattern`
- `Agent` / `Task` → `input.description`
- Otherwise → first two `Object.keys(input)` joined as `key=JSON(value).slice(0, 24)`

`SessionDetailResponse.toolInteractions: ToolInteraction[]` is consumed for the richer fields (`previewSummary`, `diffSummary`, derived `status`) but the argument-summary string is derived in the UI to keep the prototype's exact wording.

**Rationale**: The prototype controls the visual identity; the projection's `previewSummary` covers preview text but not the single-line argument label. Deriving this in the UI is one tiny helper file and avoids a wire-shape change purely for label text. The projection is consumed for everything else.

**Alternatives considered**:
- *Extend `ToolInteraction` with an `argSummary: string` field*. Rejected for simplicity. The helper is ~20 lines.

---

## R-05 — Live tail event channel

**Decision**: Subscribe to `EventSource('/api/live/:sessionId')` for the root (non-subagent) view. Honor the three event names the server emits today (per `packages/server/src/api/routes.ts:233-236`):

- `snapshot` — initial handshake; payload `{ sessionId }`. Triggers `livePending = true` (header chip).
- `turns` — payload `{ turns: Turn[] }`. Appended to `useLiveTail.pendingTurns`; surfaced into the session view via `useSessionView` (splicing into the flat array). If the user is at the bottom, auto-follow; otherwise raise `tailToast = true`.
- `ping` — 15s heartbeat; ignored.

The hook tears down its EventSource when the session changes, when the workspace navigates into a subagent (suppress toast per FR-102), or on `useEffect` cleanup.

**Rationale**: The server contract is already complete; no new event names are needed. SSE auto-reconnects via the browser's `EventSource`, satisfying Constitution Principle II's resilience requirements.

**Alternatives considered**:
- *Use WebSocket instead*. Rejected: explicit non-goal per CLAUDE.md's stack decision (SSE is the chosen push channel for one-way data).
- *Subscribe to both root and subagent SSE simultaneously*. Rejected for v1: while the user is inside a subagent, the parent's tail toast is suppressed (FR-102) but `livePending` may continue to advance from any cached state; opening a second SSE per subagent only matters if the user is actively in the subagent and it's also live, which is a v2 concern.

---

## R-06 — Subagent drill and stack

**Decision**: `GET /api/sessions/:id/subagents/:agentId` returns a `SubagentDetailResponse` that includes `turns: Turn[]` with the same shape as the parent. `useSessionStack` wraps it in a synthesized `Session`-like frame (with `title`, `model`, `firstTimestamp`/`lastTimestamp`, etc., copied from the subagent meta) so the existing transcript / inspector components are entirely reusable.

When the user pops a subagent, the parent's frame restores its prior `focusSnapshot` (nodeId + optional blockId + scrollTop). The scroll restore uses an instant jump (matching FR-061's initial-load behavior) so the parent's scroll-restoration does not feel animated.

**Rationale**: `SubagentDetailResponse` is contract-compatible with the parts of `Session` the transcript needs (`turns`, `title`, `usage`, projections). One stack store, two adapters.

**Alternatives considered**:
- *Render subagents inline (nested expand)*. Rejected: explicitly counter to the design (which uses a stack with breadcrumb) and to CLAUDE.md ("do NOT nest a Virtuoso inside a Virtuoso row").

---

## R-07 — Search palette + indexing progress

**Decision**: Use `GET /api/search?q=` for queries, `GET /api/search/status` for the static indexing status displayed when the palette opens, and `GET /api/search/progress` (SSE) for the progress bar that updates while the index is reconciling. Result rows render `SearchHit` fields directly; the snippet's HTML highlighting is sanitized via `rehype-sanitize` even though it originates from the local server (defense-in-depth per Constitution Principle I).

**Rationale**: The three endpoints already exist (per `routes.ts`); the prototype's "Indexing 9 sessions · 4,302 messages · 72%" status maps directly to the `SearchStatusResponse` fields plus a percentage derived from progress events. Cross-session search at scale is exactly what FTS5 is for.

**Alternatives considered**:
- *Roll a separate, transient palette index in the browser*. Rejected: violates Constitution Principle II (scale by default) — in-memory rebuilds become expensive at multi-GB transcript volumes.

---

## R-08 — Stderr-envelope detection for `n` / `N` prompt navigation

**Decision**: Re-introduce a minimal classifier at `packages/ui/src/lib/classifyUserText.ts` (replaces the deleted one from the old tree) with a single export `isStderrEnvelope(text: string): boolean`. The rule mirrors the prototype: `/^\[stderr\]/` against the prompt text. `useFlatPrompts` filters by this predicate.

**Rationale**: This is a one-rule helper that doesn't deserve a projection on the server. Co-locating it with `useFlatPrompts` makes the relationship between the predicate and the keyboard shortcut obvious in code review.

**Alternatives considered**:
- *Push the classification into `SessionMeta` / `Turn` as a derived field*. Rejected: too small a feature to widen the wire contract.

---

## R-09 — Theme & density persistence

**Decision**: Zustand store `useWorkspace` holds `theme` and `density` in memory only. They reset on full page reload to `dark` / `comfortable` (matching `<html data-theme="dark" data-density="comfortable">` in the design's `cc-transcript-viewer.html`). No `localStorage`, no cookie, no server preference endpoint.

**Rationale**: The spec's Assumptions section makes session-scoped persistence the v1 contract. Cross-tab persistence adds complexity (storage events, SSR mismatch concerns for `data-theme` on first paint) that the spec deferred.

**Alternatives considered**:
- *Persist to `localStorage`*. Rejected for v1. Easy to add later if user testing shows it's missed; trivial 5-line change to the store.

---

## R-10 — Pixel-perfect approach: design tokens and Tailwind v4

**Decision**: Port the design's CSS custom properties (the `--text-0`, `--text-1`, `--text-2`, `--text-3`, `--text-disabled`, `--surface-0/1/2`, `--border-1/2`, `--accent`, `--accent-2`, `--green`, `--red`, `--font-mono`, `--font-sans`, `--font-serif`, etc. from `.design/v4/project/app.css`) into `packages/ui/src/index.css` under Tailwind v4 `@theme` layers, scoped by `[data-theme="dark"]` and `[data-theme="light"]`. Density toggles `[data-density="compact"]` swap a small set of spacing / typography variables.

For everything else, use Tailwind utilities and shadcn primitives. Where the design uses a hand-rolled control whose look does not map to a shadcn primitive (e.g., the tool capsule, the diff block, the turn pill), write a thin component using utilities; do not retrofit a shadcn primitive that doesn't fit.

**Rationale**: Tailwind v4's `@theme` is the cleanest way to expose the design's token vocabulary as both CSS variables (for `data-theme` switching) and Tailwind utilities (`bg-surface-0`, `text-text-1`, etc.). It also satisfies the README's "recreate them pixel-perfectly" mandate without literally pasting `app.css` into the project.

**Alternatives considered**:
- *Use `app.css` verbatim*. Rejected: it's prototype-grade — element selectors (`.tool-capsule`, `.tx-nav`) are tied to the prototype's DOM. Porting tokens but rewriting selectors via Tailwind is cleaner.
- *Adopt shadcn defaults and skin to taste*. Rejected: the design's neutral-cool dark palette is distinctive enough that the default shadcn theme would visibly diverge.

---

## Decisions summary table

| # | Topic | Decision |
|---|-------|----------|
| R-01 | Session shape mapping | Project `Turn[]` → `(SessionTurn { user; requests: Request[] })[]` in `useSessionView` |
| R-02 | Per-turn cost series | Consume `SessionDetailResponse.tokenSeries` (already exposed) |
| R-03 | Files touched timeline | Consume `SessionDetailResponse.fileTouchIndex` (already exposed) |
| R-04 | Tool argument summary | Derive in `lib/toolArgs.ts` to match prototype's exact label rules |
| R-05 | Live tail | EventSource on `/api/live/:sessionId`; honor `snapshot` / `turns` / `ping` |
| R-06 | Subagent stack | One stack store; subagent → synthesized Session-like frame; restore prior focus on pop |
| R-07 | Search & indexing | `/api/search`, `/api/search/status`, `/api/search/progress`; sanitize snippet HTML |
| R-08 | Stderr envelope | `lib/classifyUserText.ts` with `/^\[stderr\]/` rule; filter in `useFlatPrompts` |
| R-09 | Theme/density persistence | In-memory only; reset on reload |
| R-10 | Tokens & Tailwind | Port design tokens into Tailwind v4 `@theme`; `data-theme` / `data-density` on `<html>` |
