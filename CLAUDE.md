## Project

**cc-transcript-viewer**

A local web-UI viewer for Claude Code conversation transcripts. It reads the JSONL files Claude Code writes under `~/.claude/projects/` and presents them through a reliable, interactive interface — fixing the scrolling, expansion, and subagent-drill-down problems of the built-in viewer. It is launched from the terminal with a CLI command that spawns a local server and opens the browser.

**Core Value:** **I can actually read and navigate any Claude Code session — no matter how long — and drill into every subagent's internals.** If only one thing works, it must be this: open a 10k+ message session and move around it without the UI breaking.

### Constraints

- **Tech stack**: Optimize for speed of delivery and quality of UX — pick the stack in the research phase. Default hypothesis: Vite + React + TypeScript + Tailwind + shadcn/ui for the frontend, with a small Node server for file watching, search, and streaming. Locked decision to be made in research.
- **Performance**: Must stay smooth at 10k+ messages per session. Assume worst case from day one — plan for virtualization, streaming, and incremental rendering.
- **Distribution**: Must be runnable as a single CLI command with minimal setup (e.g. `npx` or `npm i -g`). No Docker, no cloud, no login.
- **Privacy**: Everything stays local. Transcripts can contain code, file paths, and potentially secrets — the server never makes outbound network calls with transcript content.
- **Live-tailing**: Must reflect changes to an active session's JSONL file without the user refreshing. Implies file watching + a push channel to the browser (SSE or WebSocket).
- **Dependencies**: No hard runtime dependency on Claude Code itself — read the JSONL files directly, don't shell out to `claude`.

## Technology Stack

## Recommended Stack
### Core Technologies
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| React | 19.x | UI framework | Largest ecosystem for virtualized chat-like UIs; react-virtuoso is React-only and is the best fit for this use case; React 19 concurrent features help with large list rendering |
| Vite | 8.x | Frontend build tool | Current standard for React SPAs; instant HMR; Rolldown-powered production builds in v8; `npm create vite@latest -- --template react-ts` is a one-command bootstrap |
| TypeScript | 5.x | Type safety | First-class Vite + React support; essential for parsing typed JSONL event shapes safely |
| Hono | 4.12.x | Local Node server | Zero-dependency, Web-Standards-native; built-in `streamSSE` helper makes SSE trivial; 4x faster than Express; runs on `@hono/node-server` for Node.js; TypeScript-first |
| better-sqlite3 | 12.9.x | Persistent FTS index + session metadata store | Ships its own SQLite compiled with FTS5 enabled — the Node built-in `node:sqlite` does NOT include FTS5 by default; synchronous API is ideal for a local single-user tool |
### Supporting Libraries
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-virtuoso | 4.18.x | Virtualized message list + nested tool-call trees | Use for ALL long lists; has a dedicated `VirtuosoMessageList` component for chat; handles dynamic heights automatically; pattern for nested expand/collapse is flat-array injection (not nested Virtuoso) |
| shadcn/ui | latest (copy-paste) | UI component primitives | Copy components directly into repo; built on Radix UI + Tailwind; gives Linear/Raycast aesthetic out of the box; no version lock-in since you own the code |
| Tailwind CSS | 4.x | Styling | Required peer of shadcn/ui; utility-first keeps chat bubble / sidebar / panel layouts fast to build; v4 uses CSS-native cascade layers, no config file needed |
| chokidar | 5.x | File watching for live tailing | v5 is ESM-only, Node 20+ required; correctly normalizes `change` events for JSONL appends on macOS; use `awaitWriteFinish: { stabilityThreshold: 50 }` to avoid partial-line reads |
| Zustand | 5.x | Client-side state | Lightweight store for session selection, expand/collapse state (must live outside virtual rows), search query, live-tail toggle; avoids prop-drilling through deeply nested transcript trees |
| `@hono/node-server` | 1.x | Adapter to run Hono on Node.js HTTP | Required shim — Hono itself is runtime-agnostic; this adapter exposes it as a standard Node.js server |
### Development Tools
| Tool | Purpose | Notes |
|------|---------|-------|
| `npm create vite@latest` | Scaffold frontend | Use `--template react-ts`; outputs Vite 8 + React 19 + TypeScript 5 |
| `@vitejs/plugin-react` | React Fast Refresh in Vite | v6 uses Oxc-based transform — ships with Vite 8 automatically |
| `vite-plugin-static-copy` or `cp` in build script | Embed built UI into server package | Copy `dist/` into server's `public/` at build time so the single CLI serves both static assets and API |
| tsx or ts-node | Dev-run the Node server | `tsx` is faster (esbuild-based); use for `npm run dev:server` |
| TypeScript strict mode | Type safety | Enable `"strict": true` in tsconfig; catch JSONL shape errors at compile time |
## Architecture Note: Monorepo Layout
## Installation
# Frontend
# shadcn/ui (components are copy-pasted, but needs these peers)
# Server
# Server dev types
# Tailwind v4 (no postcss config needed)
## Decision Rationale by Dimension
### Frontend Framework: React (not SolidJS, not Next.js, not Preact)
### Virtualization: react-virtuoso (not TanStack Virtual, not react-window)
- `VirtuosoMessageList` is purpose-built for conversation UIs with dynamic heights per message (tool calls expand to multi-hundred-line JSON, then collapse to one line).
- TanStack Virtual is headless and more powerful for grid/table cases, but requires significantly more boilerplate to handle dynamic heights correctly. At 10k+ rows with variable heights and nested expand/collapse, react-virtuoso's ResizeObserver integration handles this automatically; TanStack Virtual requires manual measurement.
- react-window does not support variable-height rows without react-window-infinite-loader hacks.
- **Pattern for nested tool-call trees:** Do NOT nest a Virtuoso inside a Virtuoso row. Instead, maintain a flat array of all currently-visible nodes (including expanded children) in Zustand. When a user expands a tool call, splice child items into the flat array after the parent. react-virtuoso re-renders only the affected rows. This is the documented pattern from the react-virtuoso maintainer.
- Current version: **4.18.5** (healthy release cadence as of April 2026).
### UI Components: shadcn/ui (not Mantine, not MUI)
- Components are copied into your repo — no dependency to break, no upstream version conflicts.
- Aesthetic is exactly "Linear/Raycast feel" out of the box: neutral palette, sharp corners, subtle shadows.
- Built on Radix UI (headless, accessible) + Tailwind (composable, dark-mode-ready).
- Mantine is excellent for dashboards but its CSS-Modules-based styling is harder to blend with a Tailwind project; it also ships a larger bundle.
- No lock-in: if shadcn's defaults don't fit, you edit the component file directly.
### Styling: Tailwind CSS v4 (not CSS Modules)
### Node Server: Hono + @hono/node-server (not Express, not Fastify)
- `streamSSE` from `hono/streaming` provides first-class SSE with zero boilerplate — headers, stream management, and error handling in ~10 lines.
- Zero dependencies. Express's middleware ecosystem is large but unnecessary for a local tool with 4 endpoints.
- Fastify is excellent for high-throughput APIs but its plugin/schema architecture is overkill for a 4-route local server. The validation overhead adds complexity without benefit.
- Hono is TypeScript-first with native type inference on route handlers.
- Current version: **4.12.14** (very active: 421 versions, 15M weekly downloads).
### File Watching: chokidar v5 (not @parcel/watcher, not fs.watch)
- v5 (November 2025): ESM-only, Node 20+, 1 dependency. Mature and battle-tested on macOS FSEvents.
- `@parcel/watcher` is faster for large directory trees (thousands of files) and better on Windows, but it ships a native binary that complicates `npx` distribution — the binary must be pre-compiled per platform. chokidar is pure JS.
- Raw `fs.watch` on macOS reports event types inconsistently (emits `rename` instead of `change` for JSONL appends) and lacks debouncing.
- Use `chokidar.watch(path, { awaitWriteFinish: { stabilityThreshold: 50, pollInterval: 50 } })` to avoid reading a JSONL line that was written in two OS-level write calls.
### Push Channel: SSE (not WebSocket)
- Live tailing is purely server → client (new JSONL lines arrive, client displays them). No client-to-server data during the stream.
- SSE uses plain HTTP — no protocol upgrade, no ws:// URL scheme, no `ws` npm package needed.
- Built-in auto-reconnect via the `EventSource` browser API. If the server restarts, the client reconnects automatically without any client-side code.
- Hono's `streamSSE` makes it a 10-line implementation.
- WebSocket would be needed if the client needed to send data mid-stream (e.g., interactive filtering while tailing). That is not a v1 requirement.
### Full-Text Search: better-sqlite3 FTS5 (not MiniSearch, not FlexSearch, not ripgrep subprocess)
- Sessions are persistent on disk; an in-memory index (MiniSearch, FlexSearch) must be rebuilt on every server start — impractical when transcripts total GBs.
- SQLite FTS5 with better-sqlite3 persists the index between restarts. Index once, update incrementally as new sessions are appended.
- better-sqlite3 ships its own SQLite compiled **with** FTS5. The Node built-in `node:sqlite` (Node 22+) does NOT include FTS5 by default — this is a confirmed bug in production systems and must be avoided.
- FlexSearch v0.8 now supports SQLite as a persistent backend, but that means depending on FlexSearch AND SQLite — two layers for the same problem. Cut FlexSearch; use FTS5 directly.
- MiniSearch is excellent for browser-side search over small datasets. Not the right tool for GBs of transcript content on a server.
- ripgrep as a subprocess works but gives no ranking, no persistence, and requires ripgrep installed. Not zero-config.
- FTS5 limitation: no built-in fuzzy search. Mitigate with the `trigram` tokenizer (`USING fts5(content, tokenize="trigram")`) which supports partial-match queries at the cost of a larger index.
### Packaging / Distribution: npm publish with `bin` field + `npx` (not pkg, not Node SEA, not Bun)
- Zero install friction: `npx cc-viewer` downloads and runs on first use; no global install required.
- The `vercel/pkg` project is archived (2024). `@yao-pkg/pkg` is the active fork with Node SEA support, but producing pre-compiled binaries for macOS/Linux/Windows requires a CI matrix and complicates the publish pipeline significantly.
- Node SEA (Node 22+) is promising for zero-dependency binaries but requires bundling the Node runtime, producing ~90MB artifacts — more than needed for a local dev tool.
- Bun single-binary requires users to have Bun installed, or you ship Bun's runtime — same artifact size problem.
- The npm `bin` field + `npx` is the standard pattern for local dev tools (Vite, Prettier, ESLint all use it) and is universally understood.
- For global install: `npm install -g cc-viewer` → `cc-viewer` from anywhere.
#!/usr/bin/env node
## Alternatives Considered
| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| react-virtuoso | @tanstack/react-virtual | If building a data grid/table rather than a chat-style list; TanStack Virtual excels at grid virtualization and is framework-agnostic |
| react-virtuoso | react-window | Never for this project — no dynamic height support without heavy workarounds |
| Hono + @hono/node-server | Fastify | If the server grows to a production API with complex schema validation, plugins, and high concurrency |
| better-sqlite3 FTS5 | MiniSearch | If the transcript corpus is small (< 100MB total) and you want zero native dependencies; rebuild index on startup |
| chokidar v5 | @parcel/watcher | If targeting Windows primarily or watching very large directory trees (thousands of directories); accept the native binary distribution complexity |
| SSE | WebSocket | If v2 adds bidirectional features (e.g., send a search query mid-session from browser without an HTTP round trip) |
| shadcn/ui | Mantine | If you want a fully-managed component library with 120+ components and you're not building on Tailwind |
| npx distribution | Node SEA / @yao-pkg/pkg | If users need a truly zero-Node binary (e.g., distributing to non-Node developers); accept 90MB+ artifact size |
## What NOT to Use
| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Next.js | App Router overhead (RSC, file-based routing, server components) buys nothing for a localhost single-page tool; cold-start and hydration complexity for no benefit | Vite + React SPA |
| `node:sqlite` (built-in) | Not compiled with FTS5 on Node 22 LTS; FTS5 queries silently fail | `better-sqlite3` which ships FTS5-enabled SQLite |
| `vercel/pkg` | Archived in 2024; unmaintained | `@yao-pkg/pkg` (active fork) if you need binaries, or just use `npx` |
| Nested Virtuoso components | Inner Virtuoso's height is not detected by outer Virtuoso; causes scroll jumps and broken layouts | Flatten tree into a single array; inject/remove expanded children from the flat array |
| `fs.watch` directly | On macOS, JSONL appends emit `rename` instead of `change`; no debouncing; drops events under rapid writes | `chokidar` v5 |
| Redux / Redux Toolkit | Massive boilerplate for a local tool with 4 pieces of global state | `zustand` — 1KB, no boilerplate |
| WebSocket for live tailing | Bidirectional protocol overhead for a one-way data flow | SSE via `streamSSE` in Hono |
| MiniSearch for cross-session search | In-memory only; must rebuild on every server start; impractical at GBs of transcript data | SQLite FTS5 with better-sqlite3 |
| Express | Middleware-centric, no Web Standards support, slowest of the three options, no built-in SSE helper | Hono |
## Stack Patterns by Variant
- SQLite FTS5 index still recommended — startup indexing of 50 files is < 1 second
- Could simplify to MiniSearch if avoiding native dependencies is a hard constraint
- Consider `@yao-pkg/pkg --sea` to bundle a Node binary
- Accept: 90MB artifact, CI matrix for macOS-arm64 / macOS-x64 / Linux-x64
- SSE scales poorly beyond ~100 concurrent connections per Node process
- Switch push channel to WebSocket with a library like `ws`
- SQLite FTS5 will need WAL mode for concurrent readers: `PRAGMA journal_mode=WAL`
## Version Compatibility
| Package | Compatible With | Notes |
|---------|-----------------|-------|
| chokidar@5.x | Node.js >= 20 | ESM-only; use `import` not `require` |
| chokidar@4.x | Node.js >= 14 | If you must support Node 18, use v4 |
| better-sqlite3@12.x | Node.js 18, 20, 22 | Prebuilt binaries for LTS versions; requires rebuild after Node upgrade |
| react-virtuoso@4.x | React 18+ | React 19 supported |
| Hono@4.x | Node.js 18+ via @hono/node-server | Do not use Hono without the Node adapter on Node.js |
| Vite@8.x | Node.js 18+ | Uses Rolldown; requires `@vitejs/plugin-react` v6 |
| shadcn/ui | Tailwind CSS 4.x, React 18+ | Run `npx shadcn@latest init` after setting up Tailwind v4 |
## Sources
- [react-virtuoso npm](https://www.npmjs.com/package/react-virtuoso) — version 4.18.5 confirmed, healthy release cadence
- [react-virtuoso nested expand discussion](https://github.com/petyosi/react-virtuoso/discussions/1167) — flat-array pattern for nested items
- [TanStack Virtual docs](https://tanstack.com/virtual/latest) — framework-agnostic headless API
- [NPM trends: virtual-core vs react-virtuoso vs react-window](https://npmtrends.com/@tanstack/virtual-core-vs-react-virtualized-vs-react-virtuoso-vs-react-window) — download numbers
- [Hono npm](https://www.npmjs.com/package/hono) — version 4.12.14, 15M weekly downloads
- [Hono SSE streaming docs](https://hono.dev/docs/helpers/streaming) — `streamSSE` API
- [Hono Node.js adapter](https://hono.dev/docs/getting-started/nodejs) — `@hono/node-server` required
- [better-sqlite3 npm](https://www.npmjs.com/package/better-sqlite3) — version 12.9.0
- [node:sqlite FTS5 issue](https://github.com/openclaw/openclaw/issues/20987) — confirmed: built-in sqlite lacks FTS5 on Node 22/23
- [SQLite FTS5 blog](https://blog.sqlite.ai/fts5-sqlite-text-search-extension) — FTS5 trigram tokenizer, BM25 ranking
- [chokidar npm](https://www.npmjs.com/package/chokidar) — v5 ESM-only, Node 20+ required
- [chokidar v5 announcement](https://github.com/paulmillr/chokidar) — November 2025 release
- [Vite 8 announcement](https://vite.dev/blog/announcing-vite8) — Rolldown-powered, current as of April 2026
- [shadcn/ui vs Mantine 2025](https://makersden.io/blog/react-ui-libs-2025-comparing-shadcn-radix-mantine-mui-chakra) — aesthetic and philosophy comparison
- [SSE vs WebSocket](https://rxdb.info/articles/websockets-sse-polling-webrtc-webtransport.html) — protocol comparison
- [MiniSearch docs](https://lucaong.github.io/minisearch/) — in-memory only, confirmed
- [pkg archived](https://www.npmjs.com/package/pkg) — vercel/pkg last published 3 years ago, archived 2024

## Conventions

Conventions not yet established. Will populate as patterns emerge during development.

## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.




<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan at
specs/006-ui-rewrite-v4/plan.md
<!-- SPECKIT END -->
