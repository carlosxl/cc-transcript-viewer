# Phase 1 — Design-system foundation

## Goal

Replace the current Tailwind/shadcn default palette with the design's warm-neutral
token system, introduce the three font families, and add user-visible tweaks
(theme, density, serif titles). Everything in later phases inherits this.

## Scope (deliverables)

1. **Token mapping.** Port `.design/cc-transcript-viewer/project/tokens.css`
   into the UI's CSS layer. Decide whether to keep shadcn's variable names
   (`--background`, `--foreground`, …) and re-point them, or rename to the
   design's names (`--bg`, `--text`, …). Tailwind v4 `@theme` block is the
   right place for the semantic tokens.
2. **Fonts.** Geist (sans), Geist Mono, Instrument Serif. Self-host or use
   Fontsource — **do not** load from Google Fonts at runtime (privacy
   constraint: no outbound network calls).
3. **Theme toggle.** `t` keyboard shortcut + a header button. Persist to
   `localStorage` under `cc-viewer:theme`. Apply via
   `<html data-theme="dark|light">`.
4. **Density toggle.** `data-density="compact|regular"` on `<body>`. Persisted.
5. **Serif titles toggle.** `data-serif-titles="y|n"` on `<body>`. Persisted.
6. **Store slices.** Add `theme`, `density`, `serifTitles` to `useUIStore`.
   Wire `useEffect` syncers in `AppShell`.
7. **Re-skin shadcn primitives** in `components/ui/` that have hardcoded
   colors. Buttons, badges, dialog overlays, command palette — verify against
   both themes.

## Out of scope

- Layout changes (Phase 3).
- New components (Phase 3+).
- The "Tweaks panel" from `tweaks-panel.jsx` — that's a dev-only design tool;
  do **not** ship it.

## Files likely to touch

- `packages/ui/src/index.css` — tokens, font-face declarations.
- `packages/ui/src/stores/useUIStore.ts` — add three slices.
- `packages/ui/src/components/layout/AppShell.tsx` — mount the syncers.
- `packages/ui/src/components/ui/*.tsx` — re-skin where defaults clash.
- `packages/ui/vite.config.ts` and/or `package.json` — Fontsource deps.

## Key decisions to settle in planning

- **Variable naming**: keep shadcn names (less churn in primitives) vs.
  design names (matches reference). Recommendation: keep shadcn names,
  re-point values; add design-name aliases only if a downstream component
  explicitly needs them.
- **Tailwind v4 specifics**: confirm `@theme` syntax + dark-mode behavior with
  `[data-theme="dark"]` selector (not `media`).
- **Font loading strategy**: Fontsource vs. local `.woff2` checkout under
  `packages/ui/src/assets/fonts/`. Either works; pick the one that doesn't
  add measurable build time.

## Acceptance criteria

- Switching `data-theme` flips every screen with no visible "old" colors.
- `t` toggles theme; `localStorage` survives reload.
- Compact density visibly tightens line-height / font-size as in the design.
- `npm run typecheck` clean. Visual diff on a real session shows the new
  palette end-to-end.
- No outbound font request in DevTools Network tab on cold load.
