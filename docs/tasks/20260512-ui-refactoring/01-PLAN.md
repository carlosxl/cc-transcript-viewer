# Phase 1 — Design-system foundation: Implementation Plan

## TL;DR

- Replace the current zinc shadcn palette in `packages/ui/src/index.css` with the warm-neutral tokens from `.design/project/tokens.css` (copy-merged, not @import'd). Keep shadcn variable names; layer the design's role/diff/code tokens on top as new first-class vars.
- Switch the dark-mode mechanism from `.dark` class to `[data-theme="dark"]` on `<html>` (Tailwind v4 `@custom-variant`). Stop writing `.dark` class. Stop seeding from `prefers-color-scheme` without persistence.
- Self-host fonts via **Fontsource** (`@fontsource/geist-sans`, `@fontsource/geist-mono`, `@fontsource/instrument-serif`) — narrow weights only: Geist 400/500/600, Mono 400/500, Serif 400. Imported in `main.tsx`. No runtime requests to Google Fonts.
- `useUIStore` gains `density` and `serifTitles` slices, and `theme` becomes persistent (localStorage-first, system-prefs fallback). Three keys: `cc-viewer:theme`, `cc-viewer:density`, `cc-viewer:serifTitles`.
- Move the existing theme syncer out of `main.tsx` into AppShell, add `data-density` / `data-serif-titles` on `<body>`, register a `t` keyboard shortcut in TranscriptPane's existing keydown handler, and add a single theme-toggle button to TranscriptHeader.

---

## Decisions

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| D1 | shadcn names vs design names | Keep shadcn names (`--background`, `--foreground`, `--primary`, …) and re-point them to the warm palette; add design-only tokens (`--claude-tint`, `--user-rail`, `--diff-add-bg`, etc.) as first-class siblings. | Avoids re-skinning every primitive that already uses `bg-background` / `text-foreground`. Design names that have no shadcn analog are net-new tokens anyway. |
| D2 | Source of truth for tokens | Copy `.design/project/tokens.css` contents into `packages/ui/src/index.css`. `.design/` stays a reference. | The design file ships `.cc-mock`-scoped overrides we don't want at runtime. Copy-merge lets us trim to what the app uses. |
| D3 | Expose new tokens as Tailwind utilities? | Yes for the role/diff/code families (`bg-claude-tint`, `text-claude-text`, `bg-diff-add-bg`, etc.) by extending the `@theme inline` block. Leave shadow/radius/font vars as raw `var(--shadow-md)` references. | Components in Phase 3+ will lean heavily on `bg-claude-tint`-style classes; we already pay the cost once in `@theme`. Shadows/radii are one-off enough to use raw. |
| D4 | Dark-mode mechanism | `[data-theme="dark"]` on `<html>`. Add `@custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *));` in `index.css` so `dark:` Tailwind variants keep working. Stop writing `.dark` class. | Matches `tokens.css` selector verbatim; one source of truth. Tailwind v4 reads `@custom-variant` from CSS, no JS config. |
| D5 | Font loading | Fontsource packages, cherry-picked weights, imported once in `main.tsx`. | Zero outbound requests, no manual woff2 management, tree-shakable per-weight imports, ~80–120KB total at chosen weights. Local woff2 checkout requires committing binaries and writing `@font-face` by hand. |
| D6 | Required font weights | Geist 400, 500, 600; Geist Mono 400, 500; Instrument Serif 400 only. | Grepped `.design/project/*.jsx`: only those weights are used. 700 appears once for a corner avatar — substitute 600 (negligible visual difference) to keep bundle small. |
| D7 | Persistence storage shape | Three separate localStorage keys (`cc-viewer:theme`, `cc-viewer:density`, `cc-viewer:serifTitles`), matching the existing `cc-viewer:viewMode` convention already in `useUIStore`. | Single-object would require a migration if any slice is added later. The existing slice already uses one-key-per-pref; consistency. |
| D8 | Theme syncer mount point | Move from `ThemeAttribute` in `main.tsx` to a `useEffect` block in `AppShell.tsx`, alongside new density + serif syncers. Stop writing the `.dark` class. | Phase brief explicitly puts syncers in AppShell. Centralizing keeps the three side effects discoverable. |
| D9 | `t` shortcut location | Extend the existing `keydown` handler in `TranscriptPane.tsx` (already handles `c`/`d`) to also handle `t`. Same input-blur guard. | One handler, one place to reason about conflicts. Don't introduce a new global handler. |
| D10 | Theme button host | Add a small icon-only `<button>` to `TranscriptHeader.tsx`'s right cluster (next to `ViewModeToggle`). No new global header. | Minimum churn; header already exists. Phase brief says "header button" — TranscriptHeader is the only header. |
| D11 | shadcn primitive re-skin scope | Re-skin only `dialog.tsx` (overlay `bg-black/50`) and `resizable.tsx` (grip icon background). Leave button/badge/tooltip/etc. — they already use semantic vars. `dark:` variants on button/badge stay (they reference `destructive`, which we re-point). | Brief says "re-skin where defaults clash". A `bg-black/50` overlay on a warm-neutral background is the only visible clash. |

---

## Step-by-step plan

### Step 1 — Confirm token-file path and pre-flight read

- Verify `.design/project/tokens.css` exists (it does — phase brief's path `.design/cc-transcript-viewer/project/tokens.css` is wrong).
- Read `.design/project/tokens.css` end-to-end and identify the four token families we will lift:
  1. Surfaces / text / borders / accent (these will re-point shadcn names).
  2. Role tints (`--user-*`, `--claude-*`, `--tool-*`, `--think-*`) — new first-class tokens.
  3. Semantic + code + diff (`--success`, `--code-bg`, `--diff-add-bg`, etc.) — new first-class tokens.
  4. Shadows, radii, fonts.
- Drop the `.cc-mock`-scoped block (lines 145–168 in tokens.css) — that's design-canvas-only.
- **Verify:** make a side-by-side mental diff between tokens.css `:root` and `index.css` `:root`; confirm every shadcn var has a target value below.

### Step 2 — Rewrite `packages/ui/src/index.css` token layer

In one editor pass:

1. Replace `:root { … }` with a merged block re-pointing shadcn names to design values and adding the design-native role/diff/code tokens. Specifically:
   - `--background` ← `#FAF9F6`
   - `--foreground` ← `#1F1E1C`
   - `--card`, `--popover` ← `#FFFFFF`; `*-foreground` ← `--foreground`
   - `--primary` ← `#C96442` (design accent/rust); `--primary-foreground` ← `#FFFFFF`
   - `--secondary`, `--muted` ← `#F4F2EC` (surface-2)
   - `--secondary-foreground` ← `--foreground`
   - `--muted-foreground` ← `#58544D` (text-2)
   - `--accent` (shadcn = hover surface) ← `#F4F2EC`
   - `--accent-foreground` ← `--foreground`
   - `--destructive` ← `#B5392F`; `--destructive-foreground` ← `#FFFFFF`
   - `--border` ← `#E8E4DC`; `--input` ← `--border`; `--ring` ← `#C96442`
   - `--radius` ← `0.625rem` (10px, design's `--r-2`)
   - Add all role/diff/code/semantic/shadow/radius/font tokens verbatim from `tokens.css` so components can reference `var(--claude-tint)`, `var(--diff-add-bg)`, `var(--font-serif)`, etc.

2. Replace `.dark { … }` with `[data-theme="dark"] { … }` containing dark values from tokens.css with shadcn names re-pointed similarly.

3. Above `:root`, add Tailwind v4 dark variant:
   ```css
   @custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *));
   ```

4. Extend `@theme inline` to expose new utilities:
   - `--color-surface`, `--color-surface-2`, `--color-surface-3`, `--color-surface-inset`
   - `--color-text-2`, `--color-text-3`, `--color-text-4`
   - `--color-border-strong`, `--color-border-subtle`
   - `--color-brand`, `--color-brand-hover`, `--color-brand-soft`, `--color-brand-text` (from design `--accent*`)
   - `--color-user-tint`, `--color-user-text`, `--color-user-rail`
   - `--color-claude-tint`, `--color-claude-text`, `--color-claude-rail`
   - `--color-tool-tint`, `--color-tool-text`, `--color-tool-rail`
   - `--color-think-tint`, `--color-think-text`
   - `--color-success`, `--color-success-soft`, `--color-warn`, `--color-warn-soft`, `--color-danger`, `--color-danger-soft`, `--color-info`, `--color-info-soft`
   - `--color-code-bg`, `--color-code-border`, `--color-code-text`
   - `--color-diff-add-bg`, `--color-diff-add-text`, `--color-diff-add-gutter`
   - `--color-diff-rm-bg`, `--color-diff-rm-text`, `--color-diff-rm-gutter`
   - Font families: `--font-sans`, `--font-mono`, `--font-serif`

5. Add body-level density + serif overrides:
   ```css
   body[data-density="compact"] { font-size: 13px; line-height: 1.35; }
   body[data-serif-titles="y"] h1, body[data-serif-titles="y"] h2 { font-family: var(--font-serif); }
   ```

6. Keep `@layer base` and Virtuoso scrollbar styles unchanged.

**Verify:** dev build compiles, computed `--background` on `<html>` is `#FAF9F6`.

### Step 3 — Add Fontsource dependencies

- Add to `packages/ui/package.json` dependencies: `@fontsource/geist-sans`, `@fontsource/geist-mono`, `@fontsource/instrument-serif`.
- Run `npm install`.

**Verify:** `node -e "require.resolve('@fontsource/geist-sans/400.css')"` resolves.

### Step 4 — Import font CSS in `main.tsx`

Add above `import './index.css'`:
```ts
import '@fontsource/geist-sans/400.css'
import '@fontsource/geist-sans/500.css'
import '@fontsource/geist-sans/600.css'
import '@fontsource/geist-mono/400.css'
import '@fontsource/geist-mono/500.css'
import '@fontsource/instrument-serif/400.css'
```

**Verify:** DevTools → Network → font filter → zero outbound to Google.

### Step 5 — Extend `useUIStore.ts`

- Add `Density = 'compact'|'regular'` type.
- Extend state: `density`, `setDensity`, `toggleDensity`, `serifTitles`, `setSerifTitles`, `toggleSerifTitles`, `toggleTheme`.
- Replace `initialTheme()` to read `localStorage.getItem('cc-viewer:theme')` first, fall back to `prefers-color-scheme`, fall back to `'dark'`.
- Add `persistTheme`, `persistDensity`, `persistSerifTitles` helpers mirroring `persistViewMode`.
- Default density `'regular'`; default serif `true`.
- Wire all setters to persist.

**Verify:** typecheck clean; `useUIStore.getState().toggleDensity()` survives reload.

### Step 6 — Replace `ThemeAttribute` with AppShell syncers

- Remove `ThemeAttribute` component and `.dark` class write in `main.tsx`.
- In `AppShell.tsx`, add three `useEffect` syncers:
  1. `document.documentElement.dataset.theme = theme`
  2. `document.body.dataset.density = density`
  3. `document.body.dataset.serifTitles = serifTitles ? 'y' : 'n'`

**Verify:** Elements panel shows `<html data-theme=...>` and `<body data-density=... data-serif-titles=...>` on first paint.

### Step 7 — Add `t` keyboard shortcut

- In `TranscriptPane.tsx`'s existing keydown effect, add `if (k === 't') { e.preventDefault(); toggleTheme(); return; }`.
- Add `toggleTheme` to dep array.
- Preserve existing input-blur guard and `e.metaKey` exclusion (Cmd+T should remain browser-native).

**Verify:** `t` flips theme; focused input doesn't trigger; Cmd+T unchanged.

### Step 8 — Theme button in `TranscriptHeader`

- Import `Moon`, `Sun` from `lucide-react`.
- Add icon button next to `ViewModeToggle`:
  - Reads `theme`, calls `toggleTheme`.
  - `<Sun />` when dark, `<Moon />` when light.
  - Tooltip "Toggle theme (t)"; `aria-label="Toggle theme"`; `aria-pressed={theme === 'dark'}`.
  - Classes: `inline-flex items-center justify-center w-7 h-7 rounded-sm text-muted-foreground hover:bg-accent`.

**Verify:** click flips theme, matches `t`.

### Step 9 — Re-skin clashing shadcn primitives

| File | Issue | Fix |
|------|-------|-----|
| `components/ui/dialog.tsx` | `bg-black/50` overlay | `bg-foreground/40` |
| `components/ui/resizable.tsx` | `bg-zinc-100 dark:bg-zinc-800` grip bg | `bg-border` |

Leave button, badge, tooltip, input, popover, separator, skeleton, command — already semantic.

**Verify:** Cmd-K dialog overlay tints warm; sidebar drag-grip blends.

### Step 10 — Visual smoke + typecheck

- `npm run typecheck`, `npm run test`.
- Dev server, real session:
  - Light: cream bg, rust accents, no leftover zinc/blue.
  - Dark: warm dark bg, no pure black.
  - Diff blocks tint correctly.
- DevTools → Network filter "Font" → no Google requests.

---

## Risks / things to watch

1. **`dark:` variants in shadcn.** New variant triggers on `data-theme=dark` not `.dark`. Grep first — confirmed only `index.css:53` and `main.tsx:141` use `.dark`.
2. **First-time-user theme.** Keep three-tier fallback: localStorage → prefers-color-scheme → `'dark'`, matching current behavior.
3. **Bundle size from Fontsource.** ~120KB for six woff2 files. Acceptable.
4. **`--radius` 0.5rem → 0.625rem.** All rounded corners slightly larger; visible but minor.
5. **`--primary` is rust.** Default buttons become rust. If too loud, defer a `--brand` split to Phase 3.
6. **Fontsource package name.** Verify `@fontsource/geist-sans` resolves (may be `@fontsource/geist`).
7. **`data-density="regular"`** is intentionally a no-op selector.
8. **TranscriptPane keydown effect** mounts above the empty-state early return, so `t` works on empty state too. Good.
9. **Dialog overlay opacity.** `bg-foreground/40` may need bumping to `/50` if light-mode contrast feels weak.

---

## Open follow-ups (later phases)

- Settings popover (Phase 3/7) — currently only `t` has a UI.
- Status-dot a11y (Phase 8, Q10).
- Empty-thinking message (Phase 4, Q1).
- `--primary` vs `--brand` semantic split (Phase 3 if default button is too loud).

---

### Critical Files for Implementation

- `packages/ui/src/index.css`
- `packages/ui/src/stores/useUIStore.ts`
- `packages/ui/src/components/layout/AppShell.tsx`
- `packages/ui/src/main.tsx`
- `packages/ui/src/components/transcript/TranscriptPane.tsx`
- `packages/ui/src/components/transcript/TranscriptHeader.tsx`
- `packages/ui/src/components/ui/dialog.tsx`
- `packages/ui/src/components/ui/resizable.tsx`
- `packages/ui/package.json`
