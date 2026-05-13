# Phase 8 — Narrow layout, minimap, accessibility, polish

## Goal

Last layer: make the workspace work below ~1100px (sidebar drawer, bottom-sheet
inspector), add the transcript minimap on the right edge, run an accessibility
pass, and address any deferred polish.

## Scope (deliverables)

### Narrow layout (< 1100px)

1. **Responsive hook** — `useResponsive()` returning `narrow: boolean`.
2. **Sidebar drawer** — replaces the sidebar pane with a slide-out drawer
   plus hamburger button in the header.
3. **Bottom-sheet inspector** — replaces the right rail with a bottom sheet
   that holds the same `RightRail` content; FAB to open, drag-handle to
   dismiss.
4. **Header trimming** — hide metric chips except Tokens; collapse breadcrumb.

### Minimap

1. **Right-edge minimap** — 14px wide, one bar per message (height proportional,
   color by role / `kind`). Indicates focused-message and tool-heavy rows.
2. **Click to seek.** Hover preview optional.
3. **Visibility** — hide on narrow widths; toggle in settings (or just an
   opacity hover).

### Accessibility pass

1. **Keyboard-only nav** — every interactive element reachable via Tab; no
   color-only state.
2. **Focus-visible** styles consistent across all primitives.
3. **`prefers-reduced-motion`** — disable smooth scroll and animations.
4. **ARIA** — `role`, `aria-label`, `aria-live` (for live-tail), `aria-current`
   on active session.
5. **Screen-reader smoke test** — VoiceOver runs through opening a session,
   navigating messages, opening the inspector.

### Polish backlog

- Animation timings audit (180–260ms cubic-bezier per design).
- Empty-state copy review.
- Error-state copy review.
- Dark-mode contrast spot-check across all surfaces.

## Out of scope

- Touch gestures beyond bottom-sheet drag-dismiss.
- Internationalization.
- Print stylesheet.

## Files likely to touch

- new `packages/ui/src/hooks/useResponsive.ts`
- new `packages/ui/src/components/layout/SidebarDrawer.tsx`
- new `packages/ui/src/components/layout/BottomSheet.tsx`
- new `packages/ui/src/components/transcript/Minimap.tsx`
- `AppShell.tsx` — branch on `narrow`.
- shadcn primitives — focus-visible audit.

## Key decisions to settle in planning

- **Breakpoint.** Design uses 1100px. Confirm against testing devices the user
  cares about.
- **Minimap density for 10k+ messages.** One bar per message is fine up to
  ~2000; beyond that, downsample (group adjacent messages). Decide threshold.
- **Bottom-sheet height defaults.** Design uses 78vh; verify on real phones.

## Acceptance criteria

- Resize the window below 1100px — sidebar/right rail switch to drawer/sheet
  without layout breaks.
- Minimap renders on a 10k-message fixture without measurable scroll jank.
- Axe / Lighthouse a11y score ≥ 95 on the main workspace.
- `prefers-reduced-motion: reduce` disables smooth scroll.
- Visual diff against design at 1440px, 1100px, 768px, 390px.
