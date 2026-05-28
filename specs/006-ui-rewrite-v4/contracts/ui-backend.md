# UI → Backend Contract

**Feature**: 006-ui-rewrite-v4
**Phase**: 1 — Design & Contracts
**Scope**: The local Hono server exposed by `@cc-viewer/server`. The UI consumes this surface; it does not negotiate or extend it. No outbound network calls to anything else.

This document records *which existing endpoints the new UI binds to* for each functional requirement. The endpoints themselves are defined in `packages/server/src/api/routes.ts` and their response types in `@cc-viewer/shared/src/types.ts`. **No new endpoints are added by this rewrite.**

---

## Endpoint inventory

| # | Method | Path | Response type | Implementing fn (server) | Spec FRs satisfied |
|---|--------|------|---------------|--------------------------|--------------------|
| 1 | GET | `/api/health` | `HealthResponse` | `routes.ts: app.get('/api/health')` | — (infra) |
| 2 | GET | `/api/sessions` | `SessionsListResponse` | `routes.ts: app.get('/api/sessions')` | FR-020, FR-021, FR-022, FR-024 |
| 3 | GET | `/api/sessions/:id` | `SessionDetailResponse` | `routes.ts: app.get('/api/sessions/:id')` | FR-011, FR-030, FR-040–FR-055, FR-070–FR-072, FR-130–FR-134 |
| 4 | GET | `/api/sessions/:id/report` | `SessionReport` | `routes.ts: app.get('/api/sessions/:id/report')` | FR-130–FR-135 |
| 5 | GET | `/api/sessions/:id/subagents/:agentId` | `SubagentDetailResponse` | `routes.ts: app.get('/api/sessions/:id/subagents/:agentId')` | FR-032, FR-090–FR-092 |
| 6 | GET (SSE) | `/api/live/:sessionId` | event stream | `routes.ts: app.get('/api/live/:sessionId')` | FR-100, FR-101, FR-102 |
| 7 | GET (SSE) | `/api/live/:sessionId/subagents/:agentId` | event stream | `routes.ts: app.get('/api/live/...subagents...')` | FR-092 (live subagent case — opt-in for v1) |
| 8 | GET | `/api/search?q={query}` | `SearchResponse` | `routes.ts: app.get('/api/search')` | FR-110, FR-111, FR-112, FR-113 |
| 9 | GET | `/api/search/status` | `SearchStatusResponse` | `routes.ts: app.get('/api/search/status')` | FR-111 |
| 10 | GET (SSE) | `/api/search/progress` | event stream | `routes.ts: app.get('/api/search/progress')` | FR-111 (live indexing %) |

All endpoints are **GET-only**. Reaffirms Constitution Principle IV (Source-File Read-Only) and FR-151.

---

## Response shape mapping (UI consumers ↔ wire fields)

### `/api/sessions` → Sidebar

The sidebar uses these `SessionMeta` fields:

| Sidebar / Design field | Source field | Notes |
|------------------------|--------------|-------|
| `session.title` | `meta.title` | UI truncates with ellipsis |
| `session.time` | `meta.lastTimestamp` (relative) | UI formats as "17m ago", "yesterday" |
| `session.messages` | `meta.messageCount` | |
| `session.cost` | derived from `meta.totalUsage` × `weights.ts` | UI helper `lib/cost.ts` |
| `session.tokens.{in,out,cc,cr}` | `meta.totalUsage.inputTokens / outputTokens / cacheCreationTokens / cacheReadTokens` | Drives the cost tooltip (FR-022) |
| `session.pinned` | not yet on wire | **Backend gap** — see "Backend follow-ups" below |
| `session.live` | `meta.isLive` | Already wired |
| `project.name` / `project.path` | `meta.projectSlug` / `meta.projectPath` | Grouped in UI by `worktreeOf ?? projectPath` |

### `/api/sessions/:id` → Transcript + Inspector

Consumed fields:

- `turns: Turn[]` → projected into `SessionTurn[]` (see data-model.md §2).
- `subagents: SubagentRef[]` → drives capsule's `isSubagent` annotation by joining `toolUse.childAgentId` against `subagents[].agentId`.
- `usage: AggregatedUsage` → header chips, status bar totals.
- `toolInteractions: ToolInteraction[]` → preview text, status, diff summary for tool capsules.
- `tokenSeries: TokenSeries` → header per-turn cost; also used by report sparkline if `/report` is unavailable (defensive fallback only — report endpoint is authoritative).
- `fileTouchIndex: FileTouchIndex` → not used in the transcript view directly; only used if the report endpoint fails (same defensive note).

### `/api/sessions/:id/report` → Session Report overlay

Consumed fields on `SessionReport`:

| Report card / table | Source |
|---------------------|--------|
| Stat card: Duration | `report.durationMs` (UI formats) |
| Stat card: Turns | `report.turnCount` |
| Stat card: Tool calls | `report.toolCallsMain + report.toolCallsSub` |
| Stat card: Cache hit | `report.cacheHit` (decimal 0–1; UI formats `%`) |
| Stat card: Total cost | `report.totalCost` (dollars) |
| "By agent & model" table rows | `report.rows: ReportRow[]` |
| "By turn" table | `report.byTurn: TurnRef[]` |
| Usage-over-time sparkline | `report.tokenSeries.points` |
| Spike cards | `report.tokenSeries.spikes` |
| Files-touched timeline | `report.fileTouchIndex.files` |

### `/api/sessions/:id/subagents/:agentId` → Drill-in transcript

Returns a `SubagentDetailResponse` that the UI wraps into a `SessionView` with `parentTurnId` set to the spawning turn's id (derived from `parentToolUseId`). All transcript / inspector components are reused unchanged on the wrapped view.

### `/api/live/:sessionId` → Live tail

Server-Sent Events:

| `event:` | `data:` payload | UI reaction |
|----------|-----------------|-------------|
| `snapshot` | `{ sessionId }` | `useLiveTail.setLivePending(true)` → header chip appears |
| `turns` | `{ turns: Turn[] }` | `useLiveTail.appendTurns(turns, { userAtBottom, inSubagent })`. If `userAtBottom`, body auto-follows. Else if not in subagent, raise toast (FR-101 / FR-102) |
| `ping` | `''` (heartbeat, every 15 s) | ignore |
| `error` | `{ message }` | UI logs and lets EventSource auto-reconnect |

EventSource auto-reconnect handles transient server restarts (Constitution Principle II resilience). The UI tears down the EventSource on session change.

### `/api/search` → Search palette

`SearchResponse.hits: SearchHit[]` is grouped client-side by `hit.projectSlug` to mirror the prototype's "group by project" layout. Each row uses:

| Palette row field | Source field |
|-------------------|--------------|
| Badge | `hit.kind` (`text` / `thinking` / `tool_use` / `tool_result`) |
| Session title | `hit.sessionTitle` |
| Snippet (highlighted HTML) | `hit.snippetHtml` (sanitized via `rehype-sanitize` before render) |
| Target turn id / time | `hit.turnUuid`, `hit.timestamp` |

### `/api/search/status` + `/api/search/progress` → Indexing strip

- `/api/search/status` is hit once when the palette opens. The UI shows "Indexing N sessions · M messages · X%".
- `/api/search/progress` (SSE) updates the progress bar as the reconciler advances. Closed when the palette closes.

---

## Contract invariants

1. **Read-only**: The UI issues only `GET` requests. No `POST` / `PUT` / `DELETE` is added in this rewrite. (FR-151, Principle IV.)
2. **Same-origin in production**: SPA is served from `packages/server/public/`, so all `/api/*` and `/api/live/*` requests are same-origin. No CORS headaches.
3. **Dev origin**: Vite dev server runs on `:5173` and the Hono server on its CLI-assigned port. Hono's CORS allowlist already includes `localhost:5173` and `127.0.0.1:5173` (`packages/server/src/app.ts: buildAllowedOrigins`). The Vite config proxies `/api/*` and `/api/live/*` to the server's port to avoid the cross-origin path entirely in dev.
4. **No new shared types**: This rewrite does not add new exports to `@cc-viewer/shared`. UI-only derived types live in `packages/ui/src/lib/types.ts`.
5. **Snippet HTML is sanitized client-side** even though it originates from the local server (defense-in-depth per Constitution Principle I).
6. **Errors return `ErrorResponse`** (`{ error: { code, message } }`); the UI surfaces them as inline non-blocking notices in the affected pane, not as full-screen failures.

---

## Backend follow-ups (intentionally deferred)

The UI degrades gracefully where the backend does not yet expose a field. Each gap is captured here so it can be picked up later **without** being absorbed as a UI workaround.

| Gap | Where the UI degrades | Suggested backend change |
|-----|----------------------|--------------------------|
| **Pinned sessions** — sidebar shows a star indicator in the design | UI hides the star unconditionally in v1 | Add `pinned?: boolean` to `SessionMeta`, persisted in a new local config file (e.g., `~/.cache/cc-transcript-viewer/pinned.json`) |
| **CSV export of "By agent & model"** — design has an Export CSV button | Button is a visible no-op in v1 (spec Assumptions) | Add `GET /api/sessions/:id/report.csv` or compute client-side from `report.rows` |
| **Subagent live tail** | Endpoint `#7` exists; the v1 UI does not subscribe to it (only the root) | None — backend is ready; UI subscription is a v2 follow-up |
| **Pre-existing search snippet highlighting format** — confirm the exact HTML the server emits | If the format differs, the UI sanitizer / renderer adapts | None — the snippet field is already on the wire |

None of these gaps block any P1 user story. They map to spec FR-021 (pinned), FR-135 (export stub), FR-092 (subagent live), FR-112 (snippet) respectively, and the spec already calls them out as v1 limitations where applicable.

**Resolved**: FR-052 (TTFT per assistant turn) — derived UI-side from `Turn.timestamp` deltas in `useSessionView.ts` (the `Request.ttft` field is no longer always null).
