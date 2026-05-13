# Phase 8 — Narrow layout, minimap, a11y & polish: Implementation Plan

## TL;DR

- **Narrow (< 1100px)**: a single-column shell with the sidebar in a left
  drawer (`SidebarDrawer`) and the inspector rail in a bottom sheet
  (`BottomSheet`) opened by a FAB. A hamburger button in `TranscriptHeader`
  opens the drawer; on narrow the breadcrumb top-row collapses and only the
  `Tokens` metric chip stays visible. Detection lives in `useResponsive()`,
  one matchMedia listener for `(max-width: 1099.98px)`.
- **Minimap**: a 14px right-edge column inside `TranscriptPane` that paints
  one bar per `VirtualNode` (role + kind color), highlights the focused
  index, and seeks via `useNavigationStore.setFocusedMsgIndex` on click.
  When `nodes.length > 2000` (Open Q #5) the bars are downsampled into 2000
  buckets keyed by a representative node. Hidden on narrow.
- **A11y**: ARIA labels on status dots in `ToolCapsule` (color-only signal
  fix per Open Q #10), gate the flash-ring animation + Virtuoso smooth
  scroll behind `prefers-reduced-motion: no-preference` via a shared
  `useReducedMotion` hook + a CSS media query. Verify no other animation
  ignores reduced motion (transcript focus outline, dialog/popover open).
- Drawer + sheet are built on the existing Radix Dialog primitive — same
  focus-trap, Escape handling, and overlay click-to-close behavior the
  `SearchPalette` already uses. No new Radix dependency.
- Out of scope (per phase brief): touch gestures beyond drag-dismiss,
  internationalization, print stylesheet.

---

## Decisions

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| D1 | Breakpoint | `(max-width: 1099.98px)` per design — narrow when matched. Single breakpoint, no in-between tier. | Design uses 1100px. The `-0.02px` avoids the off-by-one at exactly 1100px width. |
| D2 | Responsive hook shape | `useResponsive(): { narrow: boolean }` (room to grow without renames). Internally `useSyncExternalStore` against the `matchMedia` list so the value is stable across renders and SSR-friendly. | Matches `useReducedMotion` shape. Single source of truth for the breakpoint — never read `window.innerWidth` ad-hoc. |
| D3 | Reduced-motion hook | `useReducedMotion(): boolean` paired hook, same `useSyncExternalStore` wrapper. CSS guards animations at the stylesheet level (`@media (prefers-reduced-motion: no-preference)`); the hook is for JS-side smooth-scroll decisions (`Virtuoso.scrollToIndex({ behavior })`). | CSS gate is the lowest-cost & most-reliable. JS hook needed only where behavior literally cannot be expressed in CSS. |
| D4 | Drawer primitive | Radix Dialog wrapper: `SidebarDrawer` is a `<Dialog>` with an overlay + a left-aligned content container (`fixed left-0 top-0 bottom-0 w-[min(320px,85vw)]`). Content slides via Tailwind `data-[state=open]:slide-in-from-left` utilities. | Radix Dialog already in repo (used by `SearchPalette`); focus trap + Escape + click-outside handled for free. No `vaul` / `react-spring` dep. |
| D5 | Bottom sheet primitive | `BottomSheet` is a `<Dialog>` with an overlay + a bottom-aligned content container (`fixed left-0 right-0 bottom-0 h-[78vh]`), drag-handle visual at top, `data-[state=open]:slide-in-from-bottom`. | Same library as drawer; geometry differs by Tailwind utilities only. |
| D6 | Drawer / sheet state shape | Two new `useUIStore` slices: `narrowSidebarOpen` + `narrowSheetOpen` (booleans), plus their toggles. Auto-close drawer on `activeSessionId` change (the user just navigated). Sheet opens automatically when `selectedInteractionId` flips from null → set on narrow (mirrors design's `if (effectiveNarrow) setSheetOpen(true)`). | Centralising in the store keeps `useUIStore` the single source of truth (already houses pinnedSessions, theme, etc.). Auto-open mirrors design intent without parameter drilling. |
| D7 | Hamburger button | Add a `<MenuButton>` slot at the very left of `TranscriptHeader`'s bottom row, rendered only on narrow. Calls `setNarrowSidebarOpen(true)`. Keyboard reachable via Tab; default focus-visible ring inherited. | Header is the only stable surface on narrow (BreadcrumbBar is part of TranscriptPane; we don't want to relocate it). |
| D8 | Header trimming on narrow | Hide the breadcrumb top row, hide `Messages` + `Model` metric chips, keep the `Tokens` chip (the headline metric per design), keep all icon-only actions (theme, rail, info, report, mode toggle). Star button stays. | Matches `workspace-app.jsx:354-356` — only Tokens is `!effectiveNarrow=false`. Star stays per design's title-row treatment. |
| D9 | FAB | Bottom-right `Inspector` button on narrow. Visible only when `narrowSheetOpen=false` (so it doesn't paint over the sheet). Calls `setNarrowSheetOpen(true)`. | Matches design. Hiding while sheet open avoids z-index churn. |
| D10 | Right rail content reuse | Both desktop pane and narrow sheet mount the same `<RightRail/>` component. The bottom-sheet body provides scroll/height; `RightRail` already lays out flex-column at `h-full`. | Zero new code for the inspector tab — drawer is pure shell. |
| D11 | Selecting an interaction on narrow | `useNavigationStore.setSelectedInteractionId` callers (capsule click, diff click, jump-back) — extend the store's setter to also flip `narrowSheetOpen=true` when `useResponsive().narrow` AND a new id is set. Implementation: the store stays pure (no hooks); the cross-store wiring lives in a small `useEffect` inside `AppShell` that watches `selectedInteractionId + narrow` and toggles the sheet. | Keeps stores decoupled. Wiring is one effect in AppShell — easy to find & test. |
| D12 | Minimap data source | The minimap reads the same `nodes: VirtualNode[]` as the Virtuoso list. Each bar takes a color derived from `node.kind` + (for `turn`) `turn.role`. Capsules tint a `--tool-rail` overlay; diffs use `--brand`. Focused index outlined in `--primary`. | Reuses what the transcript already computes. No second projection layer. |
| D13 | Minimap click → seek | Sets `useNavigationStore.focusedMsgIndex` to the bucket's representative index. The existing `TranscriptPane` effect (`scrollToIndex` keyed on `focusedMsgIndex`) handles the scroll. | Reuses the j/k pathway. One scroll mechanism. |
| D14 | Minimap downsampling | When `nodes.length > 2000`, paint `2000` buckets via `Math.floor(i * nodes.length / 2000)` index sampling. Each bucket maps to the representative node at that midpoint; click seeks to that index. Tooltip shows "msg ~N / total". | Open Q #5. 2000 DOM buttons render fast even on a 10k session; further refinement (canvas) is YAGNI. |
| D15 | Minimap hidden on narrow | When `narrow`, render nothing — width budget is tight and the sheet/drawer would conflict visually. The minimap toggle (future settings) is out of scope for this phase. | Phase brief: "hide on narrow widths". |
| D16 | Minimap a11y | The minimap is `role="navigation" aria-label="Transcript minimap"` with each bar a `<button>` with `aria-label="Jump to message N"` and `aria-current="true"` when focused. Screen readers can already navigate via j/k; this is a redundant pathway, not the primary one. | Color-only fix per Open Q #10. |
| D17 | A11y — ToolCapsule status dots | The colored dot (success/fail/running) gets an `aria-label` + `<span class="sr-only">` text describing the status. Color stays as the visual signal; the dot itself is `role="status"`. | Open Q #10. Minimal surface change. |
| D18 | Reduced-motion CSS gate | The `cc-flash-ring` keyframe is wrapped in `@media (prefers-reduced-motion: no-preference)`. Without that media query, the rule sets `animation: none`. Same for any other custom animation we own. Tailwind's `transition-*` utilities respect `prefers-reduced-motion` automatically via the user agent. | Cheapest fix. CSS reacts to OS-level setting in real time without React re-renders. |
| D19 | Reduced-motion JS gate | `Virtuoso.scrollToIndex({ behavior: reducedMotion ? 'auto' : 'smooth' })` in `TranscriptPane`'s focused-scroll + pending-jump effects. The `behavior: 'smooth'` literal is the only motion JS produces today. | Smooth scroll cannot be expressed via CSS for Virtuoso; the hook handles it. |
| D20 | Polish — animation timings | The existing tokens / shadcn `transition-*` use the design's 180–260ms range. No audit changes required this phase; spot-check after wiring. | Brief lists this as a "review" item, not a redesign. |
| D21 | Dark-mode contrast spot-check | Done by manual eyeballing at 1440 / 1100 / 768 / 390 in dev. No code change unless something jumps out. | Brief lists it as a "spot check". |
| D22 | Lighthouse / Axe score ≥ 95 | Verified manually post-implementation by running Lighthouse in dev. If a regression appears, fix in this phase. | Acceptance criterion; not a code change unless something breaks. |

---

## Step-by-step plan

### Step 1 — Hooks (`useResponsive`, `useReducedMotion`)

**`packages/ui/src/hooks/useResponsive.ts`** (new):

```ts
import { useSyncExternalStore } from 'react'

const NARROW_QUERY = '(max-width: 1099.98px)'

function subscribe(cb: () => void): () => void {
  const mql = window.matchMedia(NARROW_QUERY)
  mql.addEventListener('change', cb)
  return () => mql.removeEventListener('change', cb)
}
function getSnapshot(): boolean { return window.matchMedia(NARROW_QUERY).matches }
function getServerSnapshot(): boolean { return false }

export function useResponsive(): { narrow: boolean } {
  const narrow = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  return { narrow }
}
```

**`packages/ui/src/hooks/useReducedMotion.ts`** (new): same shape with
`(prefers-reduced-motion: reduce)`.

**Tests:** `useResponsive.test.ts` + `useReducedMotion.test.ts` — verify
the hook returns `false` with the existing matchMedia mock and toggles
when the mock's `matches` flips and `change` listener fires.

### Step 2 — Drawer / sheet primitives

**`packages/ui/src/components/layout/SidebarDrawer.tsx`** (new):

```tsx
interface SidebarDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}
export function SidebarDrawer(props: SidebarDrawerProps): JSX.Element
```

Uses `Dialog.Root` / `Dialog.Portal` / `Dialog.Overlay` / `Dialog.Content`.
Content className: `fixed left-0 top-0 bottom-0 w-[min(320px,85vw)] bg-card border-r border-border shadow-lg z-50 data-[state=open]:animate-in data-[state=open]:slide-in-from-left data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left`.

**`packages/ui/src/components/layout/BottomSheet.tsx`** (new): same shape
but `fixed left-0 right-0 bottom-0 h-[78vh] rounded-t-xl border-t shadow-lg` plus a drag-handle div at the top.

### Step 3 — UI store slices for drawer / sheet

**`packages/ui/src/stores/useUIStore.ts`** (edit): add

```ts
narrowSidebarOpen: boolean
narrowSheetOpen: boolean
setNarrowSidebarOpen: (open: boolean) => void
setNarrowSheetOpen: (open: boolean) => void
```

Both default to `false`. No persistence.

### Step 4 — AppShell narrow branch

**`packages/ui/src/components/layout/AppShell.tsx`** (edit):

1. `const { narrow } = useResponsive()`.
2. When `narrow`: render a flat flex-col (no `ResizablePanelGroup`):
   ```
   <SidebarDrawer open={narrowSidebarOpen} onOpenChange={setNarrowSidebarOpen}>
     <SessionBrowser />
   </SidebarDrawer>
   <main className="flex-1 min-w-0">
     <TranscriptPane />
   </main>
   <BottomSheet open={narrowSheetOpen} onOpenChange={setNarrowSheetOpen}>
     <RightRail />
   </BottomSheet>
   {!narrowSheetOpen && <button ...FAB />}
   ```
3. When `!narrow`: existing 3-pane layout unchanged.
4. New effect: on narrow, when `selectedInteractionId` becomes non-null,
   call `setNarrowSheetOpen(true)`.
5. New effect: on narrow, when `activeSessionId` changes, close the drawer.

### Step 5 — Header changes

**`packages/ui/src/components/transcript/TranscriptHeader.tsx`** (edit):

1. `const { narrow } = useResponsive()`.
2. On narrow: hide top breadcrumb row (`hidden md:flex` is wrong tier;
   gate via `narrow` in TSX so we don't depend on Tailwind breakpoints
   matching the JS one).
3. Insert a `<HamburgerButton/>` at the left of the bottom row, narrow-only.
   `setNarrowSidebarOpen(true)` on click; aria-label "Open sidebar".
4. Hide `Messages` + `Model` MetricChips when `narrow`; keep `Tokens`.

### Step 6 — Minimap

**`packages/ui/src/components/transcript/Minimap.tsx`** (new):

```tsx
interface MinimapProps {
  nodes: VirtualNode[]
  focusedIndex: number
  onSeek: (index: number) => void
}
export function Minimap(props): JSX.Element
```

- Computes bar count = `Math.min(nodes.length, 2000)`.
- For each bar `i`: `nodeIdx = nodes.length <= 2000 ? i : Math.floor(i * nodes.length / 2000)`. Color by role/kind. Focused if `nodeIdx === focusedIndex` (or in the bucket containing it).
- Renders as a `<nav>` of `<button>`s in a 14px-wide column with flex-col + flex-1 children.
- The minimap is `pointer-events-auto` over the right edge; its parent in `TranscriptPane` is positioned `relative` already.

**`TranscriptPane.tsx`** (edit): inside `<VirtualList>`'s outer
`<div className="relative h-full">`, add `<Minimap nodes={nodes}
focusedIndex={focusedIdx} onSeek={setFocusedMsgIndex}/>` to the right.
Hidden when `narrow`.

### Step 7 — A11y polish

1. **`ToolCapsule.tsx`** (edit): the existing status dot gets
   `role="status" aria-label={statusLabel}` plus a visually-hidden
   `<span className="sr-only">{statusLabel}</span>`. `statusLabel` is
   `'Succeeded' | 'Failed' | 'Running' | 'Pending'`.
2. **`index.css`** (edit): wrap the `cc-flash-ring` rule in
   `@media (prefers-reduced-motion: no-preference)`. Confirm no other
   custom animations exist that need the same guard.
3. **`TranscriptPane.tsx`** (edit): replace `behavior: 'smooth'` literals
   in `scrollToIndex` calls with `behavior: reduced ? 'auto' : 'smooth'`
   where `reduced = useReducedMotion()`.

### Step 8 — Tests

New:
- `useResponsive.test.ts`
- `useReducedMotion.test.ts`
- `Minimap.test.tsx` — renders bar count, fires onSeek with index, marks focused bar.
- `SidebarDrawer.test.tsx` — open / close / Escape.
- `BottomSheet.test.tsx` — same.

Updated:
- `AppShell.test.tsx` — does not regress on the 3-pane assertion (still applies at default mock width where matchMedia returns false → not narrow).
- `TranscriptHeader.test.tsx` — verify the chips are visible at default (narrow=false in tests).
- `ToolCapsule.test.tsx` — assert the aria-label on the status dot.

### Step 9 — Verify

```
npm run typecheck
npm run test
npm run build
```

Update `00-PROGRESS.md`: row 8 from ⬜ → ✅. Note the new files in
"Current state" / "Last activity".

---

## Files touched

**New:**

- `packages/ui/src/hooks/useResponsive.ts`
- `packages/ui/src/hooks/useResponsive.test.ts`
- `packages/ui/src/hooks/useReducedMotion.ts`
- `packages/ui/src/hooks/useReducedMotion.test.ts`
- `packages/ui/src/components/layout/SidebarDrawer.tsx`
- `packages/ui/src/components/layout/SidebarDrawer.test.tsx`
- `packages/ui/src/components/layout/BottomSheet.tsx`
- `packages/ui/src/components/layout/BottomSheet.test.tsx`
- `packages/ui/src/components/transcript/Minimap.tsx`
- `packages/ui/src/components/transcript/Minimap.test.tsx`

**Edited:**

- `packages/ui/src/stores/useUIStore.ts` — drawer / sheet slices.
- `packages/ui/src/components/layout/AppShell.tsx` — narrow branch + FAB.
- `packages/ui/src/components/layout/AppShell.test.tsx` — narrow scenario.
- `packages/ui/src/components/transcript/TranscriptHeader.tsx` — hamburger + chip trim.
- `packages/ui/src/components/transcript/TranscriptHeader.test.tsx` — narrow trim assertion.
- `packages/ui/src/components/transcript/TranscriptPane.tsx` — minimap mount + reduced-motion behavior.
- `packages/ui/src/components/transcript/ToolCapsule.tsx` — aria-label on dot.
- `packages/ui/src/components/transcript/ToolCapsule.test.tsx` — assertion.
- `packages/ui/src/index.css` — reduced-motion gate on flash keyframe.

---

## Risks / things to watch

1. **AppShell narrow tree differs structurally.** Existing AppShell tests
   assert "three resizable panels exist". Default matchMedia mock returns
   `matches: false`, so `narrow = false` and the 3-pane path renders.
   But we'll add a narrow-mode test that overrides the mock — easy to
   regress if someone forgets to reset state between tests. Tests cleanup
   already calls `useUIStore.setState`, so add the new slice keys there.
2. **Minimap performance at 10k.** 2000 `<button>` elements ≈ a few ms to
   mount; verify by mounting the long-fixture session and checking
   scroll-jank in DevTools. Canvas fallback is YAGNI for now.
3. **Drawer pulling focus on session-switch auto-close.** Closing a Radix
   Dialog returns focus to its trigger. If the trigger has unmounted
   (we changed page width), Radix falls back to `document.body`. Verify.
4. **Bottom sheet drag-dismiss.** Phase brief mentions touch
   drag-handle dismiss. Out of scope per "no touch gestures beyond
   bottom-sheet drag-dismiss" — so we keep the visual drag-handle but
   wire only the click-handle (tap to close). Mention in handoff.
5. **prefers-reduced-motion test coverage.** Existing matchMedia mock
   always returns `matches: false` — fine for the default-path tests.
   Verify by running with the mock returning `true` in one test and
   asserting smooth-scroll is `'auto'`.
6. **shadcn primitive `transition` utilities.** Tailwind transitions
   honor `prefers-reduced-motion` automatically in v4 (the `transition-*`
   utilities compile to `transition-property` only — duration is `150ms`
   default but UA respects reduced motion). No CSS changes needed.
