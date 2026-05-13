# Phase 7 — Search redesign + session pinning

## Goal

Upgrade the existing `SearchPalette` to the design's flyover (filter chips,
suggestions, footer hint row) and add a star/pin feature for sessions. The
FTS5 backend already does most of the work; this is largely a UI phase.

## Scope (deliverables)

### Search

1. **Flyover redesign.** Match `workspace-search.jsx`: 640px modal, header
   with search input + Esc kbd hint, filter chip row, results list, footer
   showing `↑↓ navigate · ↵ open · Esc close · N results`.
2. **Filter chips** — All / Sessions / Tools / Files. Map to existing
   `SearchContentKind`:
   - Sessions → no kind filter (matches title/intent)
   - Tools → `kind in ('tool_use', 'tool_result')`
   - Files → searches `tool_use` filtered to Read/Edit/Write inputs, surfaces
     the file path
   - Confirm filter wiring matches existing server contract; if not, extend.
3. **Empty-state suggestions** — when query is empty, show example chips
   (`security review`, `static.ts`, `Bash`, `token report`) as starting
   points. Click → fills the input.
4. **Match highlighting** in result titles (the `<mark>` from the design).
   `lib/highlight.ts` likely already does this — reuse.
5. **Per-result kind label** in the right-hand column (`SESSION`, `TOOL`,
   `FILE`).

### Pinning

1. **Pin/star toggle** on session rows (sidebar) and in the transcript header
   (added as a stub in Phase 3).
2. **Persistence** — `localStorage` under `cc-viewer:pinned-sessions`,
   value is `Set<sessionId>`. No server changes.
3. **Sidebar ordering** — pinned sessions float to the top of their project
   group, with a star icon prefix.

## Out of scope

- Server-side ranking changes.
- Persisting pins to a sync backend.
- Saved searches.

## Files likely to touch

- `packages/ui/src/components/search/SearchPalette.tsx`
- `packages/ui/src/components/sidebar/SessionRow.tsx`
- `packages/ui/src/components/sidebar/SessionBrowser.tsx`
- `packages/ui/src/components/sidebar/ProjectSection.tsx`
- `packages/ui/src/components/transcript/TranscriptHeader.tsx` — wire the
  Phase-3 star button to real state.
- `packages/ui/src/stores/useUIStore.ts` — `pinnedSessions: Set<string>` slice
  with localStorage hydration.
- `packages/ui/src/hooks/useSearchQuery.ts` — confirm filter shape.

## Key decisions to settle in planning

- **Filter chip vs. server contract.** Verify in `routes.ts` what filter
  parameters `/api/search` accepts. The "Files" filter may need a
  server-side change to project file paths from `tool_use` inputs.
- **Multi-pin per session UX.** Single-tier pin (boolean) is fine; no need
  for ordered pins or folders.
- **Sidebar sort interaction.** Pinned-first overrides the user's sort
  toggle. Confirm.

## Acceptance criteria

- Cmd-K opens the redesigned flyover; filter chips visibly change results.
- Clicking a result navigates to the right session (and turn, for non-session
  hits, via `pendingJumpTarget`).
- Pinning a session moves it to the top of its group and survives reload.
- Pin state stays in sync between sidebar and header.
- Empty-state suggestions work.
