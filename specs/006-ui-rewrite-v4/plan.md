# Implementation Plan: UI Rewrite v4 — Three-Pane Transcript Workspace

**Branch**: `006-ui-rewrite-v4` | **Date**: 2026-05-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-ui-rewrite-v4/spec.md`

## Summary

Tear down all existing frontend code under `packages/ui/src/` and rebuild the UI from a clean slate to match the v4 design in `.design/v4/project/cc-transcript-viewer.html` (and its sibling `.jsx` / `.css` files). The new workspace is a three-pane shell — Sidebar / Transcript / Inspector — with a sticky nav bar, focus model, keyboard-first navigation (j/k, J/K, n/N, [ ], gg/G, T, r, ⌘K, /, t, Esc, space), live-tail toast, subagent stack drill, search palette, turn jumper, and session report overlay. Backend (Hono server, JSONL reader, FTS5 search, watcher, projections, shared types) is preserved as-is — the UI integrates with the existing `/api/*` surface and SSE streams. The first task in the implementation plan is the destructive cleanup of `packages/ui/src/` so the rebuild starts from a defined zero state, with `packages/ui/package.json`, `vite.config.ts`, `tsconfig.json`, `components.json`, and `index.html` retained (those define the package shape and ship the stack the rewrite uses).

## Technical Context

**Language/Version**: TypeScript 5.8 (strict mode) on Node.js 20 LTS for build/dev tooling; the production artifact is a static SPA + Hono server.

**Primary Dependencies**:
- Already present in `packages/ui/package.json` and being kept: React 19, Vite 8, `@vitejs/plugin-react` 6, Tailwind CSS 4 (`@tailwindcss/vite`), `radix-ui` (shadcn primitives), `react-virtuoso` 4, Zustand 5, TanStack Query 5, `cmdk`, `clsx` / `tailwind-merge` / `class-variance-authority`, `react-resizable-panels`, `react-markdown` + `remark-gfm` + `rehype-sanitize`, `shiki`, `@fontsource/geist-sans` / `geist-mono` / `instrument-serif`, `lucide-react`.
- The icon vocabulary the design uses is the same custom SVG set in `.design/v4/project/icons.jsx` (~30 icons, stroke 1.5, currentColor). The rebuild owns this set as `packages/ui/src/components/ui/icons.tsx` rather than pulling lucide for every one of them.
- No new top-level dependencies are required for this rewrite.

**Storage**: None on the UI side. The server owns the SQLite FTS5 index and the in-memory `SessionMap`; the UI only reads via HTTP/SSE.

**Testing**: Vitest 4 + @testing-library/react for component / hook tests; jsdom environment is already configured. Existing backend tests under `packages/server/test/`, `packages/server/src/**/*.test.ts`, and `packages/shared/src/**/*.test.ts` MUST continue to pass with zero changes — they are the contract the new UI consumes.

**Target Platform**: Modern Chromium / WebKit / Firefox on macOS, Linux, and Windows. Single-binary distribution is `npx cc-transcript-viewer` (already wired via `bin/`); the rewrite ships through the same `copy:ui → packages/server/public` step that's in `scripts/`.

**Project Type**: Local web application — Hono server (`packages/server`) + React SPA (`packages/ui`) + shared types (`packages/shared`), already a workspaces monorepo.

**Performance Goals**:
- 10k+ message session reaches interactive state within 2 s warm / streams progress on cold start (Constitution Performance & Compatibility).
- Continuous scroll through a 10k-message session: no frame longer than 150 ms on an M-series Mac (SC-001).
- Theme/density toggle reflowed within 100 ms (SC-007).
- Search palette returns ranked results within 500 ms (SC-005).
- Session report opens within 750 ms for sessions up to 1,000 turns (SC-006).
- Live-tail toast surfaces within 1 s of OS-level write completion (SC-004, Constitution).

**Constraints**:
- **Local-First Privacy (Principle I, NON-NEGOTIABLE)**: No outbound network calls with transcript content. The UI fetches the local Hono server only. Font assets are already bundled via `@fontsource/*`. No analytics, no error-reporting beacons.
- **Source-File Read-Only (Principle IV)**: UI never invokes write/edit endpoints (there are none on the server, and none will be added).
- **Single-Command Distribution (Principle III)**: Bundle size must stay reasonable (npm artifact target <10 MB). No new native deps. SPA is statically served from `packages/server/public/`.
- **Simplicity (Principle V)**: No new abstractions beyond what the design requires. No backwards-compatibility shims to the old UI (it's being deleted in task 1).

**Scale/Scope**:
- ~50 components across sidebar/transcript/inspector/overlays.
- 1 SPA, 1 server, 1 shared package — already the monorepo layout.
- Target session size: 10k+ messages per session; ~100 sessions in the local index.
- Keyboard surface: ~15 shortcuts (FR-080).
- Backend endpoints consumed: 9 (already exposed — see Contracts section).

## Constitution Check

Gates evaluated against `.specify/memory/constitution.md` v1.0.0:

| Principle | Status | Evidence |
|-----------|--------|----------|
| **I — Local-First Privacy** | PASS | UI fetches only the local server (`/api/*`, SSE on `/api/live/*`). No telemetry; font subsetting via bundled `@fontsource/*`. Spec FR-151 explicitly forbids external transcript bytes. |
| **II — Scale by Default** | PASS | `react-virtuoso` already in the dependency list and chosen in the stack section of CLAUDE.md. The transcript list and the search results list MUST be virtualized. The plan's data shape (flat array of injected children for expand/collapse) follows the documented react-virtuoso pattern from CLAUDE.md. No feature in the spec works only at small scale. |
| **III — Single-Command Distribution** | PASS | No new native deps; rewrite stays within the existing stack; bundle path is the unchanged `copy:ui → packages/server/public/` step. No Docker, no login. |
| **IV — Source-File Read-Only** | PASS | UI is read-only on the server (all consumed endpoints are GET). Cache lives in TanStack Query memory + Zustand stores — nothing in `~/.claude/projects/`. |
| **V — Simplicity & Surgical Changes** | PASS with note | The cleanup task in FR-001 / FR-002 / FR-003 is *itself* surgical: every deleted line traces to "the user explicitly asked to remove the old UI." Within the rebuild, components are added only where the design requires them. The plan does **not** preserve old logic "just in case." See Complexity Tracking note. |

**Stack adherence**: Matches the recommended stack in CLAUDE.md (React 19 + Vite + Hono + better-sqlite3 + react-virtuoso + chokidar + SSE). No deviation; no `research.md` justification needed for stack choice.

**No violations**: Constitution Check passes pre-Phase-0 and is re-checked after Phase 1 (see end of file).

## Project Structure

### Documentation (this feature)

```text
specs/006-ui-rewrite-v4/
├── plan.md              # This file (/speckit-plan output)
├── research.md          # Phase 0 — design ↔ backend mapping, fixed decisions
├── data-model.md        # Phase 1 — UI-visible types & state shapes
├── quickstart.md        # Phase 1 — developer run/build/test instructions
├── contracts/
│   └── ui-backend.md    # Phase 1 — backend endpoints the UI consumes
├── checklists/
│   └── requirements.md  # /speckit-specify checklist (already created)
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

This is a `web-application` layout already realized as a workspaces monorepo. The rewrite touches only `packages/ui/`; `packages/server/` and `packages/shared/` are preserved verbatim.

```text
packages/
├── server/                          # PRESERVED — no edits in this rewrite
│   ├── src/
│   │   ├── api/routes.ts            # 9 endpoints — the UI's contract surface
│   │   ├── reader/                  # JSONL parser, session map, watcher
│   │   ├── search/                  # SQLite FTS5 index, reconciler
│   │   ├── app.ts, cli.ts, dev.ts, static.ts, util/
│   │   └── *.test.ts                # Must continue to pass unchanged
│   └── public/                      # SPA build artifact lands here
│
├── shared/                          # PRESERVED — types are the wire format
│   └── src/
│       ├── types.ts                 # Session, Turn, ToolUse, SearchHit, …
│       ├── report.ts                # SessionReport, ReportRow, …
│       ├── weights.ts               # cache-write Δ math (per-turn)
│       └── projections/
│           ├── tool-interactions.ts # capsule arg/preview/status derivation
│           ├── token-series.ts      # per-turn cost series + spikes
│           └── file-touch.ts        # files-touched timeline
│
└── ui/                              # REWRITE TARGET
    ├── package.json                 # KEEP (deps unchanged)
    ├── vite.config.ts               # KEEP
    ├── vitest.config.ts             # KEEP
    ├── tsconfig.json                # KEEP
    ├── components.json              # KEEP (shadcn config)
    ├── index.html                   # KEEP shell; reset body class only
    ├── scripts/                     # KEEP build helpers
    ├── dist/                        # build output
    └── src/                         # REBUILT FROM ZERO
        ├── main.tsx                 # entry — mounts <App/>
        ├── App.tsx                  # workspace shell, providers
        ├── index.css                # Tailwind v4 layer + design tokens (port of app.css)
        ├── api/
        │   ├── client.ts            # fetch wrapper for /api/*
        │   ├── sessions.ts          # GET /api/sessions, /api/sessions/:id
        │   ├── subagents.ts         # GET /api/sessions/:id/subagents/:agentId
        │   ├── report.ts            # GET /api/sessions/:id/report
        │   ├── search.ts            # GET /api/search, /search/status, /search/progress
        │   └── live.ts              # EventSource wrappers for /api/live/*
        ├── stores/
        │   ├── useSessionStack.ts   # subagent push/pop stack
        │   ├── useFocus.ts          # node focus + block focus (decoupled)
        │   ├── useWorkspace.ts      # theme, density, inspector open
        │   └── useOverlays.ts       # search / report / jumper open state + anchor
        ├── hooks/
        │   ├── useFlatNodes.ts      # flat doc-order list of nodes for j/k stepping
        │   ├── useFlatTools.ts      # flat list of tool/diff blocks for [ ]
        │   ├── useFlatPrompts.ts    # user-prompt list (filters stderr) for n/N
        │   ├── useKeyboard.ts       # single global keydown handler
        │   ├── useLiveTail.ts       # SSE subscription, pending-turn buffer
        │   ├── useScrollIntoView.ts # smooth scroll + initial-jump dance
        │   └── useSessionView.ts    # current session + extra live turns
        ├── lib/
        │   ├── format.ts            # fmtCost, fmtK, fmtDuration
        │   ├── markdown.tsx         # bold/code/break inline renderer
        │   ├── toolArgs.ts          # tool-name-aware argument summary
        │   ├── shortcuts.ts         # key spec table for status bar + handler
        │   └── classnames.ts        # cn() helper (clsx + tailwind-merge)
        ├── components/
        │   ├── ui/                  # shadcn primitives (button, tooltip, popover) + icons.tsx
        │   ├── layout/
        │   │   ├── Workspace.tsx    # 3-pane grid
        │   │   └── StatusBar.tsx
        │   ├── sidebar/
        │   │   ├── Sidebar.tsx
        │   │   ├── Brand.tsx
        │   │   ├── SearchButton.tsx
        │   │   ├── ProjectGroup.tsx
        │   │   ├── SessionRow.tsx
        │   │   └── CostTooltip.tsx
        │   ├── transcript/
        │   │   ├── Transcript.tsx           # the virtualized body
        │   │   ├── TranscriptHeader.tsx     # title, chips, actions, breadcrumb
        │   │   ├── TranscriptNavBar.tsx     # 4 steppers + prompt preview
        │   │   ├── TurnDivider.tsx
        │   │   ├── UserPrompt.tsx
        │   │   ├── RequestNode.tsx
        │   │   ├── blocks/
        │   │   │   ├── BlockText.tsx
        │   │   │   ├── BlockThinking.tsx
        │   │   │   ├── BlockToolCapsule.tsx
        │   │   │   ├── BlockDiff.tsx
        │   │   │   └── SubagentCta.tsx
        │   │   └── LiveTailToast.tsx
        │   ├── inspector/
        │   │   ├── Inspector.tsx            # router by focused kind
        │   │   ├── InspectorEmpty.tsx
        │   │   ├── InspectorRequest.tsx
        │   │   ├── InspectorUser.tsx
        │   │   ├── InspectorTool.tsx
        │   │   ├── InspectorDiff.tsx
        │   │   ├── CrumbStrip.tsx
        │   │   └── MetricsRow.tsx
        │   └── overlays/
        │       ├── SearchPalette.tsx
        │       ├── TurnJumper.tsx
        │       ├── SessionReport.tsx
        │       └── Sparkline.tsx
        └── test/
            ├── setup.ts
            ├── lib/*.test.ts                # unit tests for format, toolArgs, etc.
            ├── hooks/*.test.ts              # flatNodes, flatTools, flatPrompts, keyboard
            └── components/*.test.tsx        # smoke tests for the larger components
```

**Structure Decision**: Web application (Option 2) realized as the existing workspaces monorepo. Only `packages/ui/src/**` is rewritten; `packages/ui/package.json` + tool configs are preserved; `packages/server/**` and `packages/shared/**` are untouched. The layout above is grouped by visual surface (sidebar / transcript / inspector / overlays) to mirror the design's mental model, with cross-cutting state in `stores/`, derived data in `hooks/`, and shared helpers in `lib/`.

## Phase 0 — Outline & Research

Phase 0 deliverable: `research.md` in this directory.

The Technical Context above has **no `NEEDS CLARIFICATION` markers**. The remaining unknowns are mapping questions between the design's prototype shape and the existing backend, which are pure code-reading exercises. Phase 0 research consolidates the following decisions:

1. **Design → backend mapping**. For each conceptual entity in the design's `data.js` (sidebar projects, session, turn, request, blocks, tool capsule arg summaries, subagent ref, search result, session report, files-touched timeline, per-turn cost series, attachments), identify the existing type in `@cc-viewer/shared` and the existing endpoint that produces it.
2. **Per-turn cost & spikes**. Confirm that `projections/token-series.ts` (`TokenSeries`, `TokenSpike`) covers FR-133 without backend changes.
3. **Files-touched timeline**. Confirm that `projections/file-touch.ts` covers FR-134.
4. **Tool capsule argument summary**. Confirm `projections/tool-interactions.ts` already derives the per-tool summaries the design uses (`Bash` → command, `Read/Write/Edit` → path, `Grep` → pattern, `Glob` → pattern, `Agent` → description) — and decide whether to consume it from the projection or to re-derive in `lib/toolArgs.ts` from raw `ToolUse.input`.
5. **Live tail mechanics**. Confirm the SSE event names emitted by `/api/live/:sessionId` and how the UI integrates pending turns with `useSessionView` (matching the prototype's `livePending` chip + `extraTurns` flat-array splice).
6. **Subagent drill**. Confirm `GET /api/sessions/:id/subagents/:agentId` returns a full subagent transcript that can be pushed onto the session stack with the same `Session` shape (so all transcript components are reusable).
7. **Search palette and progress**. Confirm `/api/search`, `/api/search/status`, and `/api/search/progress` cover everything the prototype shows (grouping by project, kind badge, snippet highlighting, indexing status with percentage).
8. **Stderr envelope detection**. Decide where the "stderr envelope" classification lives so the `n`/`N` shortcut can filter it. The current frontend has `lib/classifyUserText.ts` (being deleted); per research R-08 the rewrite re-introduces a minimal classifier at `packages/ui/src/lib/classifyUserText.ts` exporting `isStderrEnvelope(text: string): boolean` and `useFlatPrompts` filters by it.
9. **Theme/density persistence**. Per Assumptions in the spec, session-scoped only in v1 — Zustand store without localStorage. Recorded so we don't accidentally add persistence.
10. **Pixel-perfect strategy**. Document the approach: port `.design/v4/project/app.css` design tokens (`--text-0/1/2/3`, `--accent`, etc.) into `index.css` as Tailwind v4 `@theme` layers, then use shadcn / Tailwind utilities for everything else. The `data-theme` / `data-density` attributes on `<html>` switch the active token set.

Each item lands in `research.md` with **Decision / Rationale / Alternatives considered**.

**Output**: `research.md` with the mapping table and the 10 fixed decisions above. No remaining `NEEDS CLARIFICATION`.

## Phase 1 — Design & Contracts

**Prerequisites**: `research.md` complete.

### 1. data-model.md

Capture the UI-visible types and state shapes. Because `@cc-viewer/shared` already defines the wire types, `data-model.md` records:

- **Wire types consumed (read-only references to `@cc-viewer/shared`)**: `Session`, `Turn`, `ToolUse`, `ToolResult`, `SubagentRef`, `SearchHit`, `SearchResponse`, `SearchStatusResponse`, `SessionReport`, `ReportRow`, `ToolInteraction`, `TokenSeries`, `TokenPoint`, `TokenSpike`, `SessionsListResponse`, `SessionDetailResponse`, `SubagentDetailResponse`, `ErrorResponse`, `HealthResponse`.
- **UI-derived types** (defined in `packages/ui/src/lib/types.ts`):
  - `FocusedNodeMeta = { kind: 'user' | 'request'; turn: Turn; request?: Request; idx?: number; total?: number }`
  - `FocusedBlockMeta = { block: Block; request: Request; turn: Turn; bid: string }`
  - `FlatNode = { id: string; meta: FocusedNodeMeta }`
  - `FlatToolItem = { bid: string; block: ToolBlock; request: Request; turn: Turn }`
  - `SessionStackFrame = { session: Session; parentLabel: string | null; focusSnapshot?: { nodeId: string; blockId?: string; scrollTop: number } }`
  - `Density = 'comfortable' | 'compact'`; `Theme = 'dark' | 'light'`
- **Zustand store shapes**:
  - `useSessionStack` — `stack: SessionStackFrame[]; push(session, parentLabel); pop(); replaceRoot(session)`
  - `useFocus` — `nodeId; nodeMeta; blockId; blockMeta; setNode(id, meta); setBlock(bid, meta); clearBlock()`
  - `useWorkspace` — `theme; density; inspectorOpen; setTheme; setDensity; toggleInspector`
  - `useOverlays` — `search: { open; query }; report: { open }; jumper: { open; anchor }; openSearch / openReport / openJumper / closeAll`
  - `useLiveTail` — `pendingTurns: Turn[]; livePending: boolean; tailToast: boolean; consumePending(); dismissToast()`
- **Validation rules** (carried from spec):
  - A turn whose prompt matches `/^\[stderr\]/` is skipped by prompt navigation (`n`/`N`) but still appears in the transcript and turn jumper.
  - Block focus implies node focus on the owning request (FR-060).
  - Initial-load scroll MUST use instant behavior; user-initiated focus moves MUST use smooth scroll (FR-061).
- **State transitions**:
  - `push(subagent)` snapshots the current frame's focus + `scrollTop`; `pop()` restores the previous frame.
  - Theme: `dark ↔ light` toggles; sets `data-theme` on `<html>`.
  - Density: `comfortable ↔ compact` toggles; sets `data-density` on `<html>`.
  - LiveTail: `livePending = true` after the SSE handshake yields the first `live` event; `tailToast = true` when a new turn arrives **and** the user is not scrolled to the bottom and is not inside a subagent.

### 2. contracts/ui-backend.md

Document the backend HTTP/SSE surface the UI binds to. The Hono server is the contract; the UI does not negotiate or extend it. For each endpoint, record method/path, query parameters, response shape (referencing `@cc-viewer/shared`), and which spec FRs depend on it.

| Endpoint | Method | Response type | Spec FRs |
|----------|--------|---------------|----------|
| `/api/health` | GET | `HealthResponse` | infra only |
| `/api/sessions` | GET | `SessionsListResponse` | FR-020, FR-021, FR-022, FR-024 |
| `/api/sessions/:id` | GET | `SessionDetailResponse` (full `Session`) | FR-011, FR-050–FR-055 |
| `/api/sessions/:id/report` | GET | `SessionReport` | FR-130–FR-134 |
| `/api/sessions/:id/subagents/:agentId` | GET | `SubagentDetailResponse` | FR-090–FR-092 |
| `/api/live/:sessionId` | SSE (GET) | event stream of new turns / live status | FR-100–FR-102 |
| `/api/live/:sessionId/subagents/:agentId` | SSE (GET) | event stream for a live subagent | FR-092 (live case) |
| `/api/search?q=` | GET | `SearchResponse` | FR-110–FR-113 |
| `/api/search/status` | GET | `SearchStatusResponse` | FR-111 |
| `/api/search/progress` | SSE (GET) | event stream of indexing progress | FR-111 |

**Contract invariants** (recorded in `contracts/ui-backend.md`):
1. The UI does not need a new endpoint to deliver any spec FR. If `research.md` discovers a missing field, the gap is recorded and surfaced as a **post-rewrite backend follow-up**, not a v1 blocker — the design feature degrades gracefully (e.g., shows an empty stat card) until the backend ships.
2. The UI never POSTs / PUTs / DELETEs anywhere. Read-only client.
3. Origin: same-origin in production (SPA served from the Hono server's `public/`); in dev, Vite proxies `/api/*` and `/api/live/*` to `http://localhost:<server-port>`. CORS allowlist already includes `localhost:5173` in dev (`packages/server/src/app.ts`).

### 3. quickstart.md

Developer-facing run sheet for the rewrite branch:

1. `npm install` (workspaces).
2. **Terminal A — server in dev:** `npm run dev:server` (from repo root). The CLI flag set is unchanged from current behavior.
3. **Terminal B — UI in dev:** `npm run dev:ui` (Vite dev server on :5173, proxying `/api/*` and `/api/live/*` to the Hono server's port).
4. Open `http://localhost:5173/`.
5. **Tests:** `npm test` from the repo root runs the server + UI suites (the shared package has no test runner); or `npm run test -w @cc-viewer/ui` for the UI-only re-build tests.
6. **Production build:** `npm run build` (build:ui → copy:ui → build:server → inline:shared) lifts `packages/ui/dist/` into `packages/server/public/` and prepares the server bundle.
7. **CLI smoke:** `node bin/cc-viewer.js` (or `npx -y .` from repo root) opens the SPA at `http://127.0.0.1:<auto-port>/`. End-to-end smoke must include opening a 10k-message session and verifying the keyboard shortcuts in FR-080.

### 4. Agent context update

Update the plan reference inside the `<!-- SPECKIT START --> … <!-- SPECKIT END -->` markers in `/Users/l.xiang/sandbox/cc-transcript-viewer/CLAUDE.md` to point at this plan file (`specs/006-ui-rewrite-v4/plan.md`). The previous reference (specs/001-inspector-rail-report/plan.md) is superseded by this rewrite. No other CLAUDE.md content is edited — the stack section is still authoritative for technology choices.

**Output**: `data-model.md`, `contracts/ui-backend.md`, `quickstart.md`, updated `CLAUDE.md` SPECKIT marker.

### Post-design Constitution re-check

Re-evaluated after the Phase 1 outputs are drafted:

| Principle | Status | Notes |
|-----------|--------|-------|
| I — Local-First Privacy | PASS | Contracts table confirms only local endpoints are consumed. No outbound. |
| II — Scale by Default | PASS | data-model defines flat-array projection for virtuoso; transcript and palette lists virtualized; nested expand/collapse uses splice pattern, not nested Virtuoso. |
| III — Single-Command Distribution | PASS | quickstart preserves the existing `bin/` entry; SPA still served from `packages/server/public/`; no new native dep introduced. |
| IV — Source-File Read-Only | PASS | All endpoints in the contracts table are GET / SSE. |
| V — Simplicity & Surgical Changes | PASS | Phase 1 layout has exactly the components the spec requires; no speculative abstractions. Cleanup task is bounded to `packages/ui/src/**`. |

No violations → no entries required in Complexity Tracking.

## Complexity Tracking

No constitutional violations. Table intentionally empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| _(none)_ | — | — |

## Smoke-Test Milestones

Implementation is paced around seven hand-off points where the user runs a short manual smoke test before the next phase begins. Each milestone maps to a "🛑 MILESTONE" marker task in `tasks.md` and to a defined slice of behaviour the user can exercise from a real `~/.claude/projects/` directory. Implementation MUST stop at each milestone, report what shipped, and wait for the user to confirm before resuming. The smoke tests are intentionally lightweight — they are not the full acceptance scenarios from the spec; they are the minimum signal that the slice works end-to-end on real data.

| # | Pause after | What just shipped | What the user smoke-tests | Expected duration |
|---|-------------|-------------------|---------------------------|-------------------|
| **M1** | T004 (end of Phase 1 Setup) | Old UI deleted; minimal `main.tsx` + `index.css` with design tokens in place. | `npm run build:ui` exits 0. `npm test` (server + UI) is green. Dev server boots, loads the placeholder div, and DevTools shows `<html data-theme="dark">` with the design-token CSS variables resolved. | ~2 minutes |
| **M2** | T032 (end of Phase 2 Foundational) | App shell, providers, stores, hooks, and keyboard wiring exist; no panes yet. | App boots to an empty three-region grid. Pressing `t` toggles `data-theme` on `<html>` between dark and light. `npm --workspace @cc-viewer/ui run typecheck` is clean. | ~2 minutes |
| **M3** | T058 (end of Phase 3 — User Story 1) | Read flow: sidebar lists sessions, transcript renders, inspector reflects focus. | Pick a non-empty session in the sidebar. Verify three panes render, scroll a 10k+ message session bottom→top without visible hitch, click a tool capsule → inspector switches to Tool view, toggle inspector via header button. | ~5 minutes |
| **M4** | T064 (end of Phase 4 — User Story 2) | Subagent drill + return. This is the P1 MVP. | Find a session with a subagent tool call. Click the inline "Open subagent transcript" CTA → header shows "Back to [parent]". Click back → parent transcript restored at the previously focused node and scroll position. | ~3 minutes |
| **M5** | T079 (end of Phase 7 — User Story 5) | All P2 stories: keyboard navigation, live tail, search palette. | Exercise each shortcut in FR-080 once. Trigger a new turn on an active session — verify "Live" chip and toast surface and `Shift+G` follows. Press `⌘K`, type a query that hits multiple sessions, hit `↑`/`↓`/`Enter` to navigate and open. | ~7 minutes |
| **M6** | T087 (end of Phase 10 — User Story 8) | All P3 stories: session report, inspector subagent CTA, theme/density polish. | Press `r` on a multi-turn session → all report sections populate (no NaN). Focus a subagent-spawning tool in the inspector → drill CTA visible. Toggle theme + density from header — all three panes reflow cleanly. | ~4 minutes |
| **M7** | T105 (end of Phase 11 build verification) | Production build + CLI smoke against the packaged artifact. | `npm run build` succeeds and produces `packages/server/public/`. `node bin/cc-viewer.js` opens the SPA at the printed URL. Re-do the M3 + M4 smoke against the prod bundle. | ~5 minutes |

**Implementation contract at each milestone:**
1. Mark the milestone marker task in `tasks.md` complete.
2. Print a short status report: "🛑 Milestone {N} reached — {what shipped}. Please run the smoke test in plan.md §Smoke-Test Milestones row {N} and reply ok / blocker."
3. Wait for the user's signal before starting the next phase. Do not pre-emptively start the next user story.
4. If the user reports a blocker, fix-in-place before resuming.

**Skip rule:** Milestones may be skipped only with explicit user permission (e.g., "skip M6, do them together"). Don't conflate two milestones silently.
