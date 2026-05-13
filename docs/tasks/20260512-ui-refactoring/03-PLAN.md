# Phase 3 — Three-pane shell + nav: Implementation Plan

## TL;DR

- Add a third `ResizablePanel` to `AppShell` for the right rail (initial size
  ~32%, min 20%, collapsible). Render an **empty placeholder** rail — Phase
  5/6 fills it. Persist all three pane sizes (`sidebar`, `main`, `rail`)
  under the existing `cc-viewer:layout` key (extend the schema; tolerate the
  old 2-key shape on read).
- Redesign `TranscriptHeader` to the two-line layout from `workspace-app.jsx`:
  top row = breadcrumb `folder · projectSlug · sessionId` (mono, uppercase);
  bottom row = title + star button + spacer + three `MetricChip`s (Messages,
  Tokens, Model) + theme toggle + right-rail toggle + view-mode toggle +
  info popover. Keep parse-warnings badge and the SessionReport drawer
  trigger from the current header.
- New `StatusBar` pinned to the bottom of the center column: kbd hints
  (`j/k`, `/`, `⌘K`, `t`, `Esc`) and `msg N / total` driven by
  `useNavigationStore.focusedMsgIndex`.
- New `useKeyboardShortcuts` hook (single source of truth). Migrate the
  existing `c` / `d` / `t` handler from `TranscriptPane` into it, add
  `j` / `k`, `/`, and the cascading `Esc`. `⌘K` toggle continues to live
  in `SearchPalette` (already centralized; don't move it).
- Add `focusedMsgIndex: number` slice to `useNavigationStore` (per phase
  brief's key decision). Add `rightRailOpen: boolean` to `useUIStore` so
  the toggle persists across reloads.
- Star button in the header is wired to a temporary in-memory map on
  `useUIStore` (`pinnedSessions: Set<string>`); Phase 7 will persist it.

---

## Decisions

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| D1 | Rail mounting | Zero-size collapse via `collapsible + collapsedSize={0}` on the third `ResizablePanel`. Keep mounted. | Brief's recommendation. Phase 5 stores selection state in the rail; unmounting would drop selection on toggle. |
| D2 | Default rail size | `defaultSize=32` (matches ~440px @ 1366px viewport, design's `rightW=440`). Min `20`. | Three-pane balance for typical 14"–16" laptops; user resize persists thereafter. |
| D3 | Layout schema migration | New shape `{ sidebar, main, rail }`. Loader accepts the old `{ sidebar, main }` and drops it — let panel `defaultSize` defaults supply `rail` on first open. Saver writes the 3-key form. | Backward-compatible. No need to invent a migration utility for one user-local key. |
| D4 | Where focused-message index lives | `useNavigationStore.focusedMsgIndex` (alongside `drillStack`). Resets to 0 on entry change via the existing snapshot reconciler. | Brief explicitly suggests this. Per-entry state, but ephemeral — no localStorage. |
| D5 | Right-rail open persistence | `useUIStore.rightRailOpen`, default `true`, persisted to `cc-viewer:rightRailOpen`. | Matches design (`rightOpen` defaults `true`). User preference; persistence is expected per the existing `theme`/`density`/`serif` pattern. |
| D6 | `Model` chip data source | When session detail is loaded, derive from `tokenSeries.byModel[0]?.model` (top model by tokens). When loading or empty, render the chip with `—`. | Avoids adding a field to `SessionMeta` (which the list endpoint computes). The header already lives below the detail query in `TranscriptPane`, so we plumb the detail down beside `meta`. |
| D7 | `Tokens` chip value | Sum of all five categories from `meta.totalUsage`, abbreviated (`abbreviateInt`). | Single number per design. Matches the existing badge formulas in TranscriptHeader (`u.inputTokens` etc.). |
| D8 | Keyboard hook lives where | New `packages/ui/src/hooks/useKeyboardShortcuts.ts`. Single window-level `keydown` listener with input-blur guard. Mounted once in `AppShell`. | One handler removes duplicate guards across components. Brief asks for centralization. |
| D9 | `c`/`d` shortcut migration | Move from `TranscriptPane`'s effect into the new hook. Delete the old effect. | Don't ship two handlers. Existing test `TranscriptPane.test.tsx` does not exercise the keyboard path. |
| D10 | `j`/`k` scroll mechanics | Hook updates `focusedMsgIndex` in the store. A small effect in `VirtualList` watches the index and calls `virtuosoRef.current?.scrollToIndex({ align: 'center', behavior: 'smooth' })`. | Keeps Virtuoso ref scoped to `VirtualList`. The store is the bus between the global hook and the local ref. |
| D11 | `j`/`k` index bounds | `useNavigationStore.focusedMsgIndex` is an index into the *flat node array*, not into `turns`. Hook receives `nodeCount` from a thin context (or reads via a `useFlatNodes` length-only selector). | Simpler than mapping back to turns; the design treats every visible row as a "message" for navigation. |
| D12 | `Esc` cascade | Order: (1) search palette open → close palette (handled inside `SearchPalette`'s existing `onOpenChange`). (2) if a Phase-5-future "selected interaction" exists → no-op for now (rail empty). (3) else clear `focusedMsgIndex` (set to `-1`). | Brief lists palette > inspector > focus. Stage gracefully: today, only (1) and (3) wire up. |
| D13 | `/` target | Sidebar search trigger. Today the sidebar has no inline search field — only a search button (via `SessionBrowser`). Until Phase 7 lands, `/` opens the existing `SearchPalette` (same as `⌘K`). | Phase brief explicitly says `/` focuses sidebar search, but that field doesn't exist yet. Routing both to the palette keeps muscle memory consistent; revisit in Phase 7. |
| D14 | Status bar uses `total` for what? | `total = useFlatNodes(turns).length` (visible row count). Index in store is 1-based for display (`focusedMsgIndex + 1`). | Matches the design's "msg N / total" semantics for the *visible* transcript surface. |
| D15 | Star button persistence | `useUIStore.pinnedSessions: Set<string>` (in-memory only this phase). Two helpers: `togglePin(id)`, `isPinned(id)`. Phase 7 will swap in localStorage + the sidebar surface. | Brief: "wire it to a temporary in-memory store if Phase 7 hasn't shipped yet." |
| D16 | Where status bar lives | New `packages/ui/src/components/layout/StatusBar.tsx`, rendered as a `flex-shrink-0` sibling at the bottom of `TranscriptPane`'s outer `h-full flex flex-col`. | Centerline of the design (`workspace-app.jsx:385`). Pane scrolling stays inside the `flex-1 min-h-0` Virtuoso wrapper above it. |
| D17 | Right-rail placeholder content | Empty `<aside>` with `aria-label="Inspector (coming soon)"`. Solid `bg-card border-l border-border h-full`. No copy yet. | Avoids prescribing copy that Phase 5 will overwrite. The visible split alone tells the user "there is a rail". |
| D18 | View-mode toggle position | Stays in `TranscriptHeader`. Will move/remove in Phase 4 when capsules unify the modes; no churn needed now. | Surgical: don't refactor what isn't broken. |
| D19 | `Cmd+T` exclusion | Keep the existing `metaKey || ctrlKey` early-return for ALL shortcuts in the new hook (preserves Cmd+T browser tab). `⌘K` is the deliberate exception — handled inside `SearchPalette`, not this hook. | Mirrors the existing behavior. No regressions. |

---

## Step-by-step plan

### Step 1 — Store slices

**`packages/ui/src/stores/useUIStore.ts`**

Add to state:
- `rightRailOpen: boolean` — `initialRightRailOpen()` reads
  `cc-viewer:rightRailOpen`, default `true`.
- `setRightRailOpen(v)` and `toggleRightRailOpen()` — both persist.
- `pinnedSessions: Set<string>` — initial empty Set, no persistence.
- `togglePinnedSession(id: string)` — Set add/remove.

Persistence key constant: `RIGHT_RAIL_OPEN_KEY = 'cc-viewer:rightRailOpen'`.

**`packages/ui/src/stores/useNavigationStore.ts`**

Add `focusedMsgIndex: number` (default 0), `setFocusedMsgIndex(i: number)`.
Reset to 0 inside the snapshot reconciler in `main.tsx` whenever the
current entry id changes (alongside the existing scroll reset).

**Verify:** `npm run typecheck` clean.

### Step 2 — `useKeyboardShortcuts` hook

`packages/ui/src/hooks/useKeyboardShortcuts.ts`:

```ts
export function useKeyboardShortcuts(nodeCount: number): void
```

One `useEffect` with a `window.addEventListener('keydown', …)` body that:
- Returns early if the target is an `<input>`, `<textarea>`, or
  `contentEditable` element.
- Returns early when `e.metaKey || e.ctrlKey || e.altKey` is true (so `⌘K`,
  `Cmd+T`, etc. are not intercepted).
- Otherwise dispatches by `e.key.toLowerCase()`:
  - `c` → `setViewMode('compact')`
  - `d` → `setViewMode('details')`
  - `t` → `toggleTheme()`
  - `j` → bump `focusedMsgIndex` toward `min(nodeCount - 1, current + 1)`
  - `k` → drop toward `max(0, current - 1)`
  - `/` → open `SearchPalette` via `useSearchStore.open()` (D13)
  - `escape` → `setFocusedMsgIndex(-1)` (palette close is its own handler)
- `preventDefault()` for every handled key.

The hook reads `nodeCount` as an argument (passed from `TranscriptPane` via
the same `useFlatNodes` result it already uses for Virtuoso).

**Verify:** unit test in `useKeyboardShortcuts.test.ts`:
- `j` increments and clamps at `nodeCount - 1`.
- `k` decrements and clamps at 0.
- Keys ignored when target is an `<input>`.
- `Cmd+K` is NOT intercepted (palette's own handler runs).

### Step 3 — Three-pane `AppShell`

**`packages/ui/src/components/layout/AppShell.tsx`**

- Extend `Layout` typing locally to include `rail`. Loader returns
  `{ sidebar, main, rail? }` and tolerates the old 2-key form. Saver
  writes the 3-key form.
- Mount the new hook once: `useKeyboardShortcuts(0)` at the top (nodeCount
  becomes meaningful only after a session loads — the hook tolerates 0).
  Actually: scoping nodeCount through the shell is awkward; **better
  placement**: keep the hook call inside `TranscriptPane` where
  `useFlatNodes` already runs. Move the AppShell call to JUST the
  `Esc` handler if needed. Keep this simple: **mount in TranscriptPane**
  alongside the existing keydown effect (which the hook replaces).
- Panels:
  ```tsx
  <ResizablePanelGroup ...>
    <ResizablePanel id="sidebar" defaultSize={22} minSize={16}>…</ResizablePanel>
    <ResizableHandle />
    <ResizablePanel id="main" defaultSize={48} minSize={36}>…</ResizablePanel>
    <ResizableHandle />
    <ResizablePanel id="rail" defaultSize={30} minSize={20}
      collapsible collapsedSize={0}
      ref={railRef}>
      <InspectorRailPlaceholder />
    </ResizablePanel>
  </ResizablePanelGroup>
  ```
- Sync rail open/closed: a `useEffect` reads `useUIStore.rightRailOpen` and
  calls `railRef.current?.expand()` or `collapse()`. The toggle button
  (in `TranscriptHeader`) updates the store; the effect drives the panel.
- New `InspectorRailPlaceholder` component (file
  `packages/ui/src/components/inspector/InspectorRailPlaceholder.tsx` — new
  folder seeded for Phase 5).

**Verify:** `npm run dev` — three panels visible; toggle hides/shows the
rail; sidebar resize still works; reload preserves all three widths.

### Step 4 — Redesigned `TranscriptHeader`

**`packages/ui/src/components/transcript/MetricChip.tsx`** (new):

```tsx
interface Props {
  label: string
  value: React.ReactNode
  tone?: 'default' | 'accent'
  mono?: boolean
  title?: string  // tooltip
}
```

Render: `<div role="group" class="inline-flex items-center h-7 rounded-sm
border border-border bg-card px-2 gap-1.5 text-xs">label (muted) value
(strong)</div>`. Accent tone swaps the value color to `text-primary`.

**`TranscriptHeader.tsx`** refactor:

Take an extended prop set:
```ts
interface TranscriptHeaderProps {
  meta: SessionMeta | undefined
  topModel?: string  // from detail response's tokenSeries.byModel[0]?.model
  showModeToggle?: boolean
}
```

Layout — two rows in one 64px banner (h-16):
1. Top row (h-5, mono, uppercase, text-[11px]): folder icon + projectSlug ·
   sessionId. Truncate as needed.
2. Bottom row (h-7, items-center, gap-2): title (font-semibold, truncate,
   flex-1 min-w-0) → star button (toggles `pinnedSessions`, icon `Star`
   fills when pinned) → parse-warnings badge (existing) → MetricChip
   `Messages` (`messageCount`) → MetricChip `Tokens` (sum of five) →
   MetricChip `Model` (`topModel || '—'`) → SessionReport drawer trigger
   (existing) → ThemeToggleButton (existing) → RightRailToggleButton
   (new, `PanelRight` icon, `aria-pressed={rightRailOpen}`) →
   ViewModeToggle (existing, gated on `showModeToggle`) → Info popover
   (existing).

Keep the `meta === undefined` skeleton banner — bump its height from
`h-12` to `h-16` for consistency.

Drop the four `In / Out / C+ / C-` token badges and the `Hit X%` badge
from this surface; they're being replaced by the compact MetricChip
trio. **The full breakdown still lives in the Token Report drawer**
(button kept).

Wire star button to `useUIStore.togglePinnedSession(meta.sessionId)` and
`useUIStore.pinnedSessions.has(meta.sessionId)`.

**Verify:** `TranscriptHeader.test.tsx` updated:
- Test 2 (4 token badges) becomes Test 2 (3 metric chips: Messages, Tokens,
  Model).
- Add Test 9: clicking the star button toggles the in-memory pinned set.
- Add Test 10: clicking right-rail toggle flips `rightRailOpen` in the
  store.
- Existing skeleton + parseWarnings + info popover + drawer tests still pass.

### Step 5 — `StatusBar`

`packages/ui/src/components/layout/StatusBar.tsx` (new):

```tsx
export function StatusBar(props: { current: number; total: number }) {…}
```

Renders a single row (`h-7`, `border-t`, `bg-muted`, `font-mono`,
`text-[11px]`, `text-muted-foreground`, padding `px-4`) with the four
kbd hints from the design and `msg {current} / {total}` right-aligned.

Each hint uses a tiny `<kbd>` element styled like the design
(`bg-card border border-border rounded-[4px] px-[5px] text-[10px]`).

`current` is `focusedMsgIndex + 1` (clamped to ≥ 1; when index is `-1`
display "—" instead). `total` is `nodeCount`.

### Step 6 — `TranscriptPane` wiring

In `TranscriptPane.tsx`:

1. Delete the existing `useEffect` keyboard handler for `c`/`d`/`t`.
2. Call `useKeyboardShortcuts(nodes.length)` — but `nodes` is created
   inside `VirtualList`, not the outer pane. Two options:
   - **(a)** Hoist `useFlatNodes(turns)` out of `VirtualList` and pass
     nodes down (cleanest).
   - **(b)** Lift just the length: `useFlatNodes(turns).length` in the
     outer pane.
   Pick **(a)** — `nodes` becomes a single source of truth and the
   StatusBar at the pane level needs the length too.
3. Render `<StatusBar current={…} total={nodes.length} />` as a sibling
   below the `flex-1 min-h-0` Virtuoso wrapper.
4. Pass `topModel` to `TranscriptHeader`:
   `activeQuery.data?.tokenSeries.byModel[0]?.model`.
5. Move the focused-message scroll effect into `VirtualList`:
   ```ts
   useEffect(() => {
     if (focusedIdx < 0) return
     virtuosoRef.current?.scrollToIndex({
       index: focusedIdx, align: 'center', behavior: 'smooth'
     })
   }, [focusedIdx])
   ```
6. Add focused-row outline: in `VirtualNodeRow`, accept (or read via store)
   `isFocused: boolean` derived from comparing the virtuoso row index to
   `focusedMsgIndex`. **Lightest implementation**: wrap the existing
   `itemContent` callback in `Virtuoso` to compare index — apply
   `data-focused="true"` + a `ring-1 ring-primary/40 rounded-md` outline
   on the wrapper div.

**Verify:** `npm run test packages/ui` — existing `TranscriptPane.test.tsx`
still passes with the lifted `useFlatNodes`.

### Step 7 — `main.tsx` reconciler addition

In the snapshot-reconciler block, when the entry id changes, also call
`useNavigationStore.getState().setFocusedMsgIndex(0)`. (Mirrors the
scroll reset.)

### Step 8 — Tests

New / updated tests:

| File | New tests |
|------|-----------|
| `useKeyboardShortcuts.test.ts` (new) | j/k bounds, input-blur guard, Cmd+K passthrough, t toggles theme, / opens palette |
| `TranscriptHeader.test.tsx` | star toggle, right-rail toggle, MetricChip rendering, topModel `—` fallback |
| `AppShell.test.tsx` | three resizable panels, rail toggle effect |
| `StatusBar.test.tsx` (new) | current/total rendering, em-dash when index === -1 |

### Step 9 — Final pass

```
npm run typecheck
npm run test
npm run build
```

Open a real session in the dev server, exercise:
- Drag each handle; reload; widths preserved.
- Toggle rail via header button; reload; remembered.
- Press `j` repeatedly: focus border traces down the transcript and
  smooth-scrolls.
- `k` walks back up.
- `/` opens palette; typing doesn't flip view modes.
- `Esc` (when palette closed) clears focus.
- `t` flips theme; `c`/`d` switch view modes.
- Status bar shows `msg N / total` and updates as you navigate.

Update `00-PROGRESS.md`: row 3 from ⬜ → ✅, "Last activity" note.

---

## Files touched

**New:**
- `packages/ui/src/hooks/useKeyboardShortcuts.ts`
- `packages/ui/src/hooks/useKeyboardShortcuts.test.ts`
- `packages/ui/src/components/transcript/MetricChip.tsx`
- `packages/ui/src/components/layout/StatusBar.tsx`
- `packages/ui/src/components/layout/StatusBar.test.tsx`
- `packages/ui/src/components/inspector/InspectorRailPlaceholder.tsx`

**Edited:**
- `packages/ui/src/components/layout/AppShell.tsx`
- `packages/ui/src/components/layout/AppShell.test.tsx`
- `packages/ui/src/components/transcript/TranscriptHeader.tsx`
- `packages/ui/src/components/transcript/TranscriptHeader.test.tsx`
- `packages/ui/src/components/transcript/TranscriptPane.tsx`
- `packages/ui/src/stores/useUIStore.ts`
- `packages/ui/src/stores/useNavigationStore.ts`
- `packages/ui/src/main.tsx`

---

## Risks / things to watch

1. **`Cmd+T` browser shortcut.** Strict early-return when `metaKey || ctrlKey`
   keeps it native; verified by manually pressing Cmd+T in the dev build.
2. **`/` and `⌘K` mapping the same thing.** Temporary; users may notice the
   key is "wasted". Worth one line in the status bar caption clarifying both
   open search. Revisit in Phase 7.
3. **`focusedMsgIndex = -1` semantics.** Treat as "no focus". StatusBar must
   handle it (`msg —`). Scroll effect early-returns. Outline absent.
4. **Hoisting `useFlatNodes` to outer pane.** Doubles the input shape into
   `VirtualList` (turns → nodes). Verify no perf regression — flat-node
   construction was already memoized via `useMemo`.
5. **`rail` panel `collapsedSize={0}`.** Verify `react-resizable-panels`
   actually animates the collapse (or set `defaultSize` proportionally and
   live without animation). Acceptance criterion is "rail collapses to
   zero," not "smoothly."
6. **TranscriptHeader height bump h-12 → h-16.** The skeleton banner in the
   pane shows during loading; the size change must be replicated in
   `TranscriptHeader.tsx`'s `meta === undefined` branch AND in
   `AppShell.test.tsx:62` (selector `.h-12.flex-shrink-0` becomes
   `.h-16.flex-shrink-0`).
7. **`topModel` on subagent view.** Subagent detail also has
   `tokenSeries.byModel` (Phase 2). Same plumbing works; verify selection
   pulls from `subagentQuery.data` when on a subagent.
8. **Pinned set in dev tools.** A `Set<string>` in Zustand state is mutated
   only via new-set construction; double-check tests that may inspect the
   state shape directly.

---

## Open follow-ups (later phases)

- Persist `pinnedSessions` to localStorage + sync to the sidebar (Phase 7).
- Wire `/` to a real inline sidebar search field (Phase 7).
- Cascading `Esc` step 2 (close inspector) gains meaning when Phase 5 adds
  a selected interaction.
- Status-bar a11y polish: ensure `aria-live="polite"` for the index counter
  (Phase 8).
- Focused-row outline visual treatment may be replaced by the
  "ring + flash" helper Phase 5 generalizes; the current `ring-1
  ring-primary/40` is intentionally cheap.

---

## Critical files for implementation

- `packages/ui/src/components/layout/AppShell.tsx` — three-pane shell
- `packages/ui/src/components/transcript/TranscriptHeader.tsx` — redesign
- `packages/ui/src/components/transcript/TranscriptPane.tsx` — hook + StatusBar
- `packages/ui/src/hooks/useKeyboardShortcuts.ts` — new central hook
- `packages/ui/src/stores/useUIStore.ts` — rail + pinned slices
- `packages/ui/src/stores/useNavigationStore.ts` — focused-message slice
