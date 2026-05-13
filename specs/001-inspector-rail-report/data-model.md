# Phase 1 Data Model: Inspector-Only Right Rail, Session Report Modal, and Sidebar Alignment

This feature introduces **no new persistent data shapes** and **no new server fields**. It consumes existing shapes already returned by the server API. This document inventories which existing entities the feature reads, which derived state it adds to the client UI store, and the small in-component derivations introduced by the new sections.

## 1. Existing entities consumed (no schema changes)

### 1.1 `SessionReport` (from `GET /api/sessions/:id/report`)

Defined in `packages/shared/src/types.ts:381` — already populated and rendered by the current `SessionReportDrawer`. Used unchanged by:

- The four headline stat cards (FR-009): `durationMs`, `toolCalls.{main,sub,total}`, `cacheHitRate`, `totalUnits` (+ `weightsMissing` for the "≥" annotation).
- The `By agent & model` table (FR-010 / FR-011): `rows[]` — `agentGroup`, `model`, `tokens.*`, `unitsByCategory.*`, `cacheHitRate`, `units`, `weights`.
- The table footer (`Units by usage type`): `unitsByUsageType.*`, `cacheHitRate`.
- The multiplier legend caption (FR-013): rendered from fixed strings, not from data.
- CSV export (FR-012): `rows[]` mapped through the existing `reportToCsv` helper.

**Validation rules referenced**:

- `cacheHitRate === null` → render `—` (matches the spec's "denominator is 0" behavior).
- `weightsMissing === true` → render `≥` before the total (already implemented).
- `rows.length === 0` → render the existing "No assistant turns with token usage recorded." row. **Replaced by FR-015a** to the spec's mandated copy "No usage recorded yet" when the entire report is empty/zero (see §3.1 below).

### 1.2 `TokenSeries` (embedded in `SessionDetailResponse`)

Defined in `packages/shared/src/types.ts:474`. Already fetched per session via `useSession(activeSessionId)`. Read by the new `Usage over time` section:

- `points[]` — one entry per assistant turn. Used for the sparkline and for deriving spike-card candidates (see §3.2).
- `spikes[]` — top-3 detected outliers (or empty when N < 4 / no spike >2σ). Used as the first candidate set for spike cards.
- `cacheHitPct` and `avgPerTurn` — not needed in the modal; the header stat cards use the report payload's overall `cacheHitRate` instead. **No data-model change.**

### 1.3 `FileTouchIndex` (embedded in `SessionDetailResponse`)

Defined in `packages/shared/src/types.ts:502`. Read by the new `Files touched` section:

- `files[]: FileTouch` — `path`, `reads[]`, `writes[]`, `changed`, `lineCount`.
- Each `FileTouch.reads[]` / `writes[]` carries `TurnRef = { turnUuid, timestamp }`.

The section re-sorts `files[]` in-component (see §3.3); the server's recency-desc sort is overridden. No shared-builder change.

### 1.4 `SessionMeta` (from `GET /api/sessions`)

Defined in `packages/shared/src/types.ts:98`. Used by the sidebar refactor exactly as it is today: `sessionId`, `title`, `lastTimestamp`, `messageCount`, `totalUsage`, `isLive`, `projectSlug`, `projectPath`. No new fields read.

## 2. New client-only state

All additions live in `packages/ui/src/stores/useUIStore.ts`. Persisted state is unchanged from today's `useUIStore`; the new flag is intentionally session-scoped.

### 2.1 `sessionReportOpen: boolean`

| Field | Type | Default | Persistence | Mutation |
|-------|------|---------|-------------|----------|
| `sessionReportOpen` | `boolean` | `false` | not persisted | `setSessionReportOpen(v: boolean)`, `toggleSessionReportOpen()` |

**State transitions**:

```text
                ┌── header Report button click ──┐
                │                                ▼
       (closed) ◄── close (Escape/X/backdrop) ── (open)
                │                                ▲
                └─── `r` shortcut (suppressed   │
                     when search palette OR     │
                     bottom-sheet is open) ─────┘
```

**Invariants**:

- The flag does NOT interact with `useUIStore.rightRailOpen`, `useUIStore.narrowSheetOpen`, or `useSearchStore.open` — both modal layers can be open simultaneously; the Escape priority chain (FR-019) orders their dismissal.
- Switching active session does NOT auto-close the modal; the open modal re-fetches `/api/sessions/:id/report` for the new session and re-renders. (This is incidental — the current `SessionReportDrawer` already handles `sessionId` changes via its `useEffect` on `[open, sessionId]`.)

### 2.2 Removed state (clean-up explicit in FR-023)

- `RightRail.tsx` local `tab: Tab` (`useState<Tab>('inspector')`) — deleted.
- The `useEffect(() => { if (selectedInteractionId) setTab('inspector') }, [selectedInteractionId])` — deleted (FR-005).
- `TranscriptHeader.tsx` local `reportOpen` `useState` — deleted (moved to store, §2.1).

## 3. In-component derivations (no shared module)

These are pure functions colocated with the consumers; they have no separate types or files in `@cc-viewer/shared`.

### 3.1 Empty/zero-data detection (FR-015a)

```ts
function isReportEmpty(report: SessionReport): boolean {
  return (
    report.totalUnits === 0 &&
    report.toolCalls.total === 0 &&
    report.durationMs === 0 &&
    report.rows.length === 0
  )
}
```

When `true`:

- All four stat-card values render `—`.
- Table replaces `<tbody>` rows with a single `<tr>` carrying `colSpan={9}` and the literal copy "No usage recorded yet" (per spec text — replacing the current "No assistant turns with token usage recorded.").
- `Usage over time` renders its empty caption ("No usage to chart yet.") instead of the sparkline + spike cards.
- `Files touched` renders its empty caption ("No files were read or written in this session.") instead of file rows.

### 3.2 Spike-card candidates when `tokenSeries.spikes` is empty (FR-014 + Clarification answer)

```ts
function spikeCards(series: TokenSeries): { turnUuid: string; turnIndex: number; tokens: number; reason: string }[] {
  // 1. If the projection produced spikes (N >= 4 + outliers exist), trust it.
  if (series.spikes.length > 0) {
    return series.spikes.slice(0, 3).map(/* …attach turnIndex from series.points… */)
  }
  // 2. Otherwise derive from points: only non-zero turns, ranked by total tokens desc.
  const candidates = series.points
    .filter((p) => (p.input + p.output + p.cacheCreate) > 0)
    .map((p) => ({
      turnUuid: p.turnUuid,
      turnIndex: p.turnIndex,
      tokens: p.input + p.output + p.cacheCreate,
      reason: 'high-output' as const,    // synthesized reason — no projector input to pick a better label
    }))
    .sort((a, b) => b.tokens - a.tokens)
    .slice(0, 3)
  return candidates
}
```

**Resulting count rules**:

- `series.spikes.length >= 3` → 3 cards.
- `series.spikes.length` in `1..2` → exactly that many cards (the projection vouched for them as real outliers).
- `series.spikes.length === 0` AND `≥3` non-zero turns → 3 cards (synthesized).
- `series.spikes.length === 0` AND `1..2` non-zero turns → that many synthesized cards.
- `0` non-zero turns → empty caption (FR-015a path).

### 3.3 File-row ordering (FR-015 Clarification answer)

```ts
function orderFilesForReport(files: FileTouch[]): FileTouch[] {
  return [...files].sort((a, b) => {
    const aAct = a.reads.length + a.writes.length
    const bAct = b.reads.length + b.writes.length
    if (aAct !== bAct) return bAct - aAct           // primary: activity desc
    const aFirst = firstTouchTs(a)
    const bFirst = firstTouchTs(b)
    return aFirst.localeCompare(bFirst)             // tiebreaker: first-touched asc (string sort works for ISO-8601)
  })
}

function firstTouchTs(f: FileTouch): string {
  let earliest: string | null = null
  for (const r of f.reads)  if (!earliest || r.timestamp < earliest) earliest = r.timestamp
  for (const w of f.writes) if (!earliest || w.timestamp < earliest) earliest = w.timestamp
  return earliest ?? ''
}
```

### 3.4 Stat-card display formatters

All four already exist in `SessionReportDrawer.tsx`:

- `formatDuration(ms)` — already returns `'—'` when `ms <= 0`. **Reused, no change.** Satisfies FR-015a's "stat cards display `—`" when the session has zero duration.
- `formatRate(r)` — already returns `'—'` when `r === null`. **Reused.**
- `formatUnits(u)` — already returns `'—'` when `u === null`. **Reused.**
- Tool-call total: a plain `String(report.toolCalls.total)`; under FR-015a the entire stat card's value is forced to `—` regardless of the underlying integer (because the empty-state predicate applies at the modal level, not per-card).

## 4. Schema diff summary

| Layer | Before | After | Change |
|-------|--------|-------|--------|
| `@cc-viewer/shared` types | `SessionReport`, `TokenSeries`, `FileTouchIndex`, `SessionMeta` | _identical_ | **none** |
| Server API contracts | `/api/sessions`, `/api/sessions/:id`, `/api/sessions/:id/report` | _identical_ | **none** |
| `useUIStore` | (no report flag) | `+ sessionReportOpen`, `+ setSessionReportOpen`, `+ toggleSessionReportOpen` | additive |
| `useKeyboardShortcuts` | `c d t j k / Escape` | `+ r` + ordered Escape chain | additive |
| `RightRail` local state | `tab: Tab` | _removed_ | breaking-internal, not exported |
| `TranscriptHeader` local state | `reportOpen` | _removed_ (read from store) | breaking-internal, not exported |
