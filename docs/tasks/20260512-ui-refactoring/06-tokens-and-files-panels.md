# Phase 6 — Right rail v2: Tokens + Files panels

## Goal

Fill the remaining two right-rail tabs. Both consume Phase 2 projections —
no further server work should be needed unless the projection payload was
gated behind a separate route.

## Scope (deliverables)

### Tokens panel

1. **Sparkline / stacked-bar chart** of `TokenSeries.points` — input, output,
   cache-read stacked. SVG (no chart-library dependency unless one already
   exists). Hover → tooltip with turn index + breakdown.
2. **Stat grid** — Total, Weighted (USD if `report.ts` exposes it), Cache hit %,
   Avg per turn — from `TokenSeries` + existing `SessionReport`.
3. **By-model breakdown** — bar per model with % and tokens, from
   `TokenSeries.byModel`.
4. **Spike turns** — top-N from `TokenSeries.spikes`. Each row is clickable →
   jump to that turn (reuse `pendingJumpTarget` plumbing).

### Files panel

1. **Files list** sourced from `FileTouchIndex.files`. Each card:
   - file path (mono, truncated)
   - "CHANGED" pill when `touch.changed`
   - read/write timeline (small horizontal bar with event markers)
   - footer line: `N reads · M writes · L lines`
2. **Timeline events clickable** → jump to the originating turn.
3. **Sort/filter** — at minimum: changed-only toggle. Sort order is decided
   in Phase 2; respect it.

## Out of scope

- New token-cost weight math (lives in `@cc-viewer/shared/weights`; reuse).
- File preview from the Files panel (the Inspector already covers Read
  previews).
- Cross-session aggregation.

## Files likely to touch

- new `packages/ui/src/components/inspector/tabs/TokensPanel.tsx`
- new `packages/ui/src/components/inspector/tabs/FilesPanel.tsx`
- new `packages/ui/src/components/inspector/charts/TokensChart.tsx` (SVG)
- new `packages/ui/src/components/inspector/charts/FileTimeline.tsx` (SVG)
- `packages/ui/src/components/inspector/RightRail.tsx` — swap placeholders
  for real panels.
- `packages/ui/src/components/transcript/TranscriptPane.tsx` — expose a
  `scrollToTurn(turnUuid)` helper (probably already added in Phase 5 for
  jump-back; reuse).

## Key decisions to settle in planning

- **Chart library.** Recommend pure SVG (matches design's minimal aesthetic
  and avoids a new dependency). Confirm.
- **Spike heuristic** — `TokenSeries.spikes` is precomputed in Phase 2.
  The UI should not redo this work; render only.
- **Subagent scope.** Same question as Phase 5: when drilled into a subagent,
  Tokens/Files reflect the subagent — not the parent. Confirm by reading the
  active query (session vs. subagent) like the Inspector does.
- **Large file counts.** If a session touched 500+ files, render a virtualized
  list inside the panel. Probably uncommon; defer unless a real session hits
  it.

## Acceptance criteria

- Tokens panel renders for any session with non-zero usage; matches
  `SessionReport` totals.
- Files panel lists every file the session touched via Read/Edit/Write;
  jump-to-turn lands on the right row.
- Both panels remain smooth on a 10k-message fixture.
- No new network round-trips per tab switch (data already on hand from
  `SessionDetailResponse`).
