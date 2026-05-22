# Quickstart: UI Rewrite v4

**Feature**: 006-ui-rewrite-v4
**Phase**: 1 — Design & Contracts
**Audience**: Engineers picking up this rewrite mid-stream.

This walks through getting the new UI running locally, verifying the cleanup task didn't break the build, and exercising the keyboard-driven flows that define the rewrite.

---

## Prerequisites

- Node.js 20 LTS or newer (per Constitution v1.0.0).
- A populated `~/.claude/projects/` directory (one real Claude Code session is enough; 10k+ messages preferred for the scale-by-default smoke test).
- A clean checkout of branch `006-ui-rewrite-v4`.

---

## 1. Install workspace deps

```bash
npm install
```

Installs all three workspaces (`@cc-viewer/server`, `@cc-viewer/shared`, `@cc-viewer/ui`). The dependency graph is unchanged by this rewrite.

---

## 2. After the cleanup task (T-001 in tasks.md)

`packages/ui/src/` should be empty (or contain only a placeholder `main.tsx` that mounts a stub `<App>`).

Verify the cleanup didn't accidentally touch shared backend code:

```bash
# Backend tests still pass on the unchanged code.
npm --workspace @cc-viewer/server run test
npm --workspace @cc-viewer/shared run test 2>/dev/null || true  # shared may not expose a test runner standalone
```

If either fails, the cleanup task overreached — revert and re-do it surgically.

---

## 3. Dev loop — server + Vite

Two terminals.

**Terminal A — Hono server in dev:**

```bash
npm run dev:server
```

This boots the server (default port `7823`) with `chokidar` live-watching `~/.claude/projects/` and a warm FTS5 search index. Output includes the chosen port and the projects directory it scanned.

**Terminal B — Vite dev server:**

```bash
npm run dev:ui
```

Vite listens on `http://127.0.0.1:5173` and proxies `/api/*` and `/api/live/*` to `:7823` (the proxy config is in `packages/ui/vite.config.ts` and is preserved unchanged through this rewrite). React Fast Refresh is on.

Open `http://127.0.0.1:5173/`. The workspace shell loads with the most recent session focused on its last request.

---

## 4. End-to-end smoke: the P1 user stories

Walk through each in order. These mirror the spec's primary acceptance scenarios.

### US1 — Three-pane workspace

- [ ] All three panes are visible: sidebar (left), transcript (center), inspector (right).
- [ ] The most recently active session is selected; the transcript is auto-scrolled to the last request of the last turn; no smooth-scroll animation on first load.
- [ ] Click an arbitrary turn divider → focus moves to that turn; status bar updates.
- [ ] Click a tool capsule → block focus; inspector switches to the tool view; if inspector was hidden it auto-opens.
- [ ] Toggle inspector with the header panel button → pane hides; transcript reflows.

### US2 — Subagent drill

- [ ] Find a session containing an `Agent`-tool subagent (look for a capsule with "Open subagent transcript").
- [ ] Click the inline subagent CTA → transcript swaps; "Back to [parent title]" breadcrumb visible.
- [ ] Click back → parent transcript restored at the prior focused node, with scroll close to where it was.
- [ ] Repeat the drill from the inspector's tool view; same result.

### US3 — Keyboard

For each shortcut, observe the focused node and the status bar's position breadcrumb update.

- [ ] `j` / `k` step nodes
- [ ] `Shift+J` / `Shift+K` step turns
- [ ] `n` / `Shift+N` step prompts; verify a turn whose prompt starts with `[stderr]` is skipped
- [ ] `[` / `]` step tool calls across requests/turns
- [ ] `g` `g` (within ~700ms) → top
- [ ] `Shift+G` → bottom (and dismisses any live toast)
- [ ] `⌘K` / `Ctrl+K` / `/` opens search palette; `Esc` closes it
- [ ] `Shift+T` opens Turn Jumper anchored to the Turn stepper
- [ ] `t` toggles theme (root `data-theme` switches)
- [ ] `r` toggles Session Report; `Esc` closes it
- [ ] `Space` / `Shift+Space` page down / page up the transcript body

### US4 — Live tail

This needs a session that is being actively written.

- [ ] Open the live session — "Live" chip appears in the header.
- [ ] Scroll up a few turns; trigger a new turn (e.g., let Claude Code finish a step) — toast surfaces at the bottom of the transcript body.
- [ ] Press `Shift+G` → new turn revealed; toast dismissed.
- [ ] Scroll to the very bottom; trigger another turn → auto-followed, no toast.
- [ ] Drill into a subagent of the live session — toast does NOT surface while inside; new turns accumulate quietly.
- [ ] Pop back to parent — toast reappears (if turns are still pending).

### US5 — Search palette

- [ ] `⌘K`, type a query that has hits across sessions → results group by project; each row shows badge / title / highlighted snippet / target / time.
- [ ] `↑` / `↓` move active; `Enter` opens a result → palette closes, session loads, target turn focused.
- [ ] Open palette before the index is warm → progress strip shows sessions / messages / percentage.

---

## 5. Tests

```bash
# UI-only tests (only meaningful after rebuild has landed).
npm --workspace @cc-viewer/ui run test

# Full workspace test suite — backend tests MUST still pass post-rewrite (SC-009).
npm test
```

UI tests live under `packages/ui/src/test/` and `packages/ui/src/**/*.test.{ts,tsx}`. Backend tests (under `packages/server/`) are unchanged by this rewrite and serve as the contract regression check.

---

## 6. Production build & CLI smoke

```bash
# Bundle the SPA, copy into the server's public/, build the server, inline @cc-viewer/shared.
npm run build

# Sanity-check the packaged artifact (no install).
npm run pack:dry

# Run the published-shape binary against your real ~/.claude/projects.
node bin/cc-viewer.js
```

The CLI should print the URL it's listening on; open it in a browser and re-do the US1 smoke above against the prod bundle. This confirms SC-010 (single-CLI launch flow still works end-to-end).

---

## 7. Performance smoke (SC-001, SC-005, SC-006, SC-007)

Open a 10k+ message session:

- Continuous scroll from bottom to top — no visible hitching. Chrome DevTools Performance tab: no long tasks (>150 ms) during scroll.
- Open Session Report on the same session — under 750 ms to first paint.
- Open search palette and type → results within 500 ms for warm-index queries.
- Toggle theme / density → all three panes reflow within 100 ms; no flash of unstyled content.

If any of these fail, the rebuild has regressed against Constitution Principle II (Scale by Default) — surface it as a P1 in the tasks list, not a v2 follow-up.

---

## Troubleshooting

| Symptom | Likely cause |
|---------|--------------|
| Vite dev page is blank | Server not running on `:7823`; the proxy returns ECONNREFUSED. Start `npm run dev:server` first. |
| CORS error in console | The Vite proxy was bypassed (e.g., wrong port, `changeOrigin: true`). `packages/ui/vite.config.ts` has the working config — don't edit it without re-reading `RESEARCH.md` Pitfall 5. |
| Live tail never fires | `liveTracker` not wired up; check `packages/server/src/dev.ts` boot logs for the chokidar attachment. |
| Search palette percentage stuck at 0% | The reconciler is still building the index. Wait or check `/api/search/status` directly with curl. |
| Theme toggle doesn't visibly change anything | Verify the `@theme` token layers in `src/index.css` are wired and the `data-theme` attribute on `<html>` actually changes (DevTools Elements panel). |
