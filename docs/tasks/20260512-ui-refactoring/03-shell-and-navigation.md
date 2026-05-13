# Phase 3 — Three-pane shell + header + status bar + keyboard map

## Goal

Move from the current two-pane shell to the design's three-pane workspace
(sidebar | transcript | right rail), redesign the transcript header, add the
footer status bar, and centralize keyboard navigation. **No new content in the
right rail yet** — render an empty placeholder. Phases 5–6 fill it.

## Scope (deliverables)

1. **Three-pane resizable shell.** Extend `AppShell.tsx` to add a third
   `ResizablePanel` for the right rail with a toggle button. Persist all three
   pane widths under `cc-viewer:layout`. Rail collapses to zero (not removed
   from the tree) when toggled off.
2. **Redesigned transcript header.** Replace current `TranscriptHeader` with:
   - project breadcrumb (`folder icon · projectSlug · sessionId`)
   - title row with star/pin button
   - metric chips: Messages, Tokens, Model (compact mono)
   - right-rail toggle icon button
   - existing theme toggle (added in Phase 1) lives here
3. **Status bar.** New `StatusBar` component pinned to the bottom of the
   center column: keyboard hints (`j/k`, `/`, `⌘K`, `t`, `Esc`) + current
   message index `n / total`.
4. **Keyboard layer.** Centralize shortcuts in a `useKeyboardShortcuts` hook
   or a single effect in `AppShell`:
   - `j` / `k` — move message focus; scroll into view
   - `/` — focus the sidebar search field (NOT the palette)
   - `⌘K` / `Ctrl+K` — open `SearchPalette` (already wired)
   - `t` — toggle theme (already wired in Phase 1)
   - `Esc` — close palette > close inspector > clear focus (cascading)
   - All skip when target is an editable element.
5. **Focused-message highlight.** Outline the focused message row per design;
   smooth-scroll on j/k.

## Out of scope

- Right-rail content (Phase 5/6).
- Mobile/narrow behavior (Phase 8).
- Star/pin persistence + sidebar reordering (Phase 7) — but the star *button*
  in the header lands here; wire it to a temporary in-memory store if Phase 7
  hasn't shipped yet.

## Files likely to touch

- `packages/ui/src/components/layout/AppShell.tsx`
- `packages/ui/src/components/transcript/TranscriptHeader.tsx`
- `packages/ui/src/components/transcript/TranscriptPane.tsx`
- new `packages/ui/src/components/layout/StatusBar.tsx`
- new `packages/ui/src/components/transcript/MetricChip.tsx`
- new `packages/ui/src/hooks/useKeyboardShortcuts.ts`
- `packages/ui/src/stores/useNavigationStore.ts` — add `focusedMsgIndex` if
  not already there.

## Key decisions to settle in planning

- **Where does focused-message state live?** Probably `useNavigationStore`
  alongside `drillStack`. Confirm.
- **Right-rail collapse mechanics.** Zero-size vs. unmount: zero-size keeps
  internal state, unmount is cleaner. Recommendation: zero-size, since the
  rail will hold selection state once Phase 5 lands.
- **Keyboard handler conflicts.** The existing `'c'` / `'d'` view-mode shortcut
  in `TranscriptPane` should move into the central hook. The new j/k must
  not fire while the search palette is open.

## Acceptance criteria

- All three panes resize and persist widths across reloads.
- Header renders breadcrumb + metric chips populated from `SessionMeta`.
- j/k navigates messages and scrolls the focused row into view smoothly.
- Status bar shows `msg N / total` and updates as you navigate.
- No keyboard shortcut fires while typing in inputs / textareas.
- `npm run typecheck` + existing tests green.
