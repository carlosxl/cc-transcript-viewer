# Phase 5 — Inspector rail v1: Implementation Plan

## TL;DR

- Replace `InspectorRailPlaceholder` with a real `RightRail` that holds three
  tabs (Inspector · Tokens · Files). Tokens + Files are `<ComingSoon/>` stubs
  this phase; Phase 6 wires them.
- The Inspector body reads `selectedInteractionId` (Phase 4) → resolves the
  matching `ToolInteraction` + originating `ToolUse` + `ToolResult` via a new
  hook `useSelectedInteraction`. The hook reads `useActiveInteractions`
  (already drill-aware) plus the turn list of the same active query — so
  drilling into a subagent automatically re-scopes the rail.
- Inspector header shows status pill, tool icon + name, args summary,
  duration + tokens, "Jump back" + "Copy command" buttons.
- Tab body: **Call · Result · Preview · Diff · Raw**. The active tab defaults
  on selection: `diff` if the interaction has a diff, `preview` if `Read`,
  else `result`. Tab choice is preserved while the user keeps the same
  selection.
- "Jump back" generalizes the existing search jump-target plumbing — the
  `JumpTarget` shape gains an optional `interactionId`, and the transcript
  flashes the matching capsule (`data-flash="true"` for ~900ms).
- "Re-run" button removed (Open Q #2).
- "Copy as curl" renamed → "Copy command" (Open Q #7); function unchanged.
- Right-rail width persists via the existing `LAYOUT_STORAGE_KEY`
  (`packages/ui/src/components/layout/AppShell.tsx`) — already implemented
  in Phase 3, no new work.

---

## Decisions

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| D1 | Selection shape | Keep `selectedInteractionId: string \| null` on `useNavigationStore`. Diff-block selection already shares the same id (Phase 4 D6) — no second selection axis. | Phase 4 already settled this; brief's "single selection state with type tag" is unnecessary because diffs and capsules share the same `ToolInteraction.id`. |
| D2 | Resolution hook | New `useSelectedInteraction()` reads `useActiveInteractions()` for the projection + the active session/subagent query for the raw `turns`. Returns `{interaction, toolUse, toolResult, turn}` or `null`. | Phase 4 already added `useActiveInteractions`. Inspector needs raw `input` + result `content` (not on the projection — see D2 of `tool-interactions.ts`). Walking turns once per selection change is cheap. |
| D3 | Subagent scope | `useActiveInteractions` already branches on `drillStack`. `useSelectedInteraction` uses the same `useSession` / `useSubagent` branch logic (extracted to a shared helper to avoid duplication). Selection clears on entry change (already wired in `main.tsx` reconciler). | Open Q #4 answer: rail follows the active query. |
| D4 | Tabs available | `Call`, `Result`, always shown. `Preview` shown only when tool === `Read` AND a result is present. `Diff` shown only when `interaction.diff !== null`. `Raw` always shown. | Brief spec; matches design's `allTabs.filter(Boolean)` pattern. |
| D5 | Default tab on selection change | `diff` if `interaction.diff`; else `preview` if tool === `Read` AND has result; else `result`. Tab state stored locally in `Inspector` (React `useState`); resets via `useEffect` keyed on `interaction?.id`. | Matches design exactly. Local state — selection cleared via the store reset; no need for tab persistence across sessions. |
| D6 | Streaming tool calls | Open Q #3 answer = Option A. `Result` tab shows a small spinner card when `interaction.status === 'running'` and no result row exists yet. No SSE wiring this phase. | Minimal change. |
| D7 | Read-preview size guard | `Preview` tab renders the result `content` as plain `<pre>` when text. If `content.length > 256 KiB`, render a "Preview suppressed — file too large" card with a "Switch to Raw" button. | Open Q #5 answer. The 256 KiB threshold is high enough to handle typical Read outputs (10k-line files) but cheap enough to avoid layout-thrashing. |
| D8 | Copy command formatter | Pure helper `formatCommand(toolUse)` in `packages/ui/src/lib/formatCommand.ts`. Rules: Bash → `<command>`. Read → `cat "<file>"` (with offset/limit translated to `sed -n 'A,Bp'` when offset present). Glob → `find <path> -name '<pattern>'` (best effort). Grep → `grep <flags> '<pattern>' <path>`. Else → `# tool=<name>\n${JSON.stringify(input, null, 2)}`. | Brief; design uses bash-style. JSON fallback is honest about untranslatable tools. |
| D9 | Clipboard transport | `navigator.clipboard.writeText`. Silently no-ops when clipboard not available (jsdom, Safari private mode). Button shows a 1.5s "Copied!" pill on success; no toast system. | Brief; minimal. |
| D10 | Jump-back plumbing | Extend `useSearchStore.JumpTarget` with optional `interactionId?: string`. `TranscriptPane`'s effect: when `interactionId` is set, prefer the `capsule` node (kind === 'capsule' && toolUseId derived from interactionId). Otherwise fall back to turn match. Flash via a transient `data-flash` attribute on the row wrapper, animated by a new CSS rule in `index.css`. | Brief says "Reuses the existing pendingJumpTarget plumbing." Generalizing the existing store slice is cleaner than introducing a second `useTranscriptScrollStore`. Single source of truth for "scroll to and highlight a transcript row." |
| D11 | Flash animation | CSS keyframe `flash-ring` (1.5 → 0 opacity outline over 900ms). Applied via `[data-flash="true"]` selector. JavaScript removes the attribute via `setTimeout(900ms)` so the animation can re-trigger on a second jump. | Brief. Same treatment OK for search hits (Open Q #12); leave search behavior untouched in this phase — TranscriptPane's effect always sets `data-flash` regardless of source. |
| D12 | Rail tab order + state | Local `useState` in `RightRail` (`'inspector' | 'tokens' | 'files'`). Default: `'inspector'`. When `selectedInteractionId` flips from null → set, force-switch back to `'inspector'`. Tokens / Files clicks render `<ComingSoon/>` cards with a one-line hint. | Brief plus design's `useEffect(() => { if (activePart || activeDiff) setTab("inspector"); }, ...)`. |
| D13 | Empty state | When `selectedInteractionId === null` OR `useSelectedInteraction()` returns null (selection stale across sessions), render `<InspectorEmpty/>` — circle icon + hint + chip strip ("Bash · Read · Edit · Grep"). | Brief; design source `workspace-inspector.jsx:121..140`. |
| D14 | Tool icon set | Reuse the icon switch from `ToolCapsule.tsx`. Extract to `packages/ui/src/lib/toolIcons.ts` so the inspector header doesn't re-implement the mapping. | Keeps icon parity between capsule and rail. One source of truth. |
| D15 | Result `content` rendering | `ToolResult.content` is `string \| unknown[]`. The `Result` tab renders strings as `<pre>`. Array content is `JSON.stringify(content, null, 2)` and rendered same. Already-existing `safeStringify` handles edge cases. | Matches behavior of the existing `ToolResultRow`. Tool-result schema variance is the same problem; same defensive shim. |
| D16 | "Re-run" button | Removed per Open Q #2 — not stubbed. The header right-side action area shows only "Copy command" + "Jump back" + close. | Out of scope. |
| D17 | Header chrome | "Close" button on the header (an `X` icon) sets `selectedInteractionId = null` (returns to InspectorEmpty). Visible only when an interaction is selected. | Matches design's `onClose` on the diff-mode header. Useful UX. |
| D18 | Tokens / Files placeholders | `<ComingSoon tab="Tokens"/>` and `<ComingSoon tab="Files"/>` — single shared component, eyebrow + one-line hint + sparkles icon. | Brief; keep the tab strip's geometry stable so Phase 6 doesn't perturb layout. |

---

## Step-by-step plan

### Step 1 — Generalize jump-target plumbing

**`packages/ui/src/stores/useSearchStore.ts`**

```ts
export interface JumpTarget {
  sessionId: string
  agentId: string | null
  turnUuid: string
  /** Phase 5: when set, scroll to the matching `capsule` row + flash it. */
  interactionId?: string
}
```

No other shape changes; `requestJump` already accepts the full target.

**`packages/ui/src/components/transcript/TranscriptPane.tsx`**

Replace the existing `useEffect` that handles `pendingJump`:

1. If `interactionId` is set: find `idx = nodes.findIndex(n => n.kind === 'capsule' && interactionId === buildInteractionId(n.turn.uuid, n.toolUseId))`. Fall back to turn match if not found.
2. Otherwise: existing turn-uuid match.
3. After scrolling: temporarily set state `flashedNodeKey = nodes[idx].key`; clear it 900ms later via `setTimeout` (cleared on unmount).
4. Pass `flashedNodeKey === node.key ? 'true' : undefined` to the row wrapper's `data-flash` attribute (in addition to existing `data-focused`).

**`packages/ui/src/index.css`**

Add a `@keyframes flash-ring` + a rule `[data-flash="true"] { animation: flash-ring 900ms ease-out; outline: 2px solid var(--accent); outline-offset: 2px; border-radius: var(--radius-md); }`. Animation fades opacity 1 → 0 so the outline disappears smoothly.

**Verify:** existing search palette tests should still pass — only the `interactionId` field is new and unset on search paths.

### Step 2 — `useSelectedInteraction` hook

**`packages/ui/src/hooks/useSelectedInteraction.ts`** (new):

```ts
export interface SelectedInteraction {
  interaction: ToolInteraction
  toolUse: ToolUse
  toolResult: ToolResult | null
  turn: Turn   // the assistant turn carrying the ToolUse
}
export function useSelectedInteraction(): SelectedInteraction | null
```

Implementation:

1. Read `selectedInteractionId` from `useNavigationStore`.
2. Determine active query (session vs subagent) — extract the small branch from `TranscriptPane` into `useActiveQuery()` helper so it's shared:

   **`packages/ui/src/hooks/useActiveQuery.ts`** (new): returns `{ turns, interactions, isLoading }` from whichever query owns the current entry. Mirrors what `TranscriptPane` and `useActiveInteractions` already do.
3. Look up `interaction = interactions.find(i => i.id === selectedInteractionId)`.
4. From `turn = turns.find(t => t.uuid === interaction.turnUuid)`, find `toolUse = turn.toolUses.find(u => u.id === interaction.toolUseId)` and `toolResult = turns.flatMap(t => t.toolResults).find(r => r.tool_use_id === interaction.toolUseId)`.
5. Return `null` if any pointer fails to resolve (stale selection after session switch — recovers next entry-change reset).

Memoize the `flatMap` of all `toolResults` keyed on the `turns` array reference to avoid scanning on every render. Use `useMemo`.

### Step 3 — Tool icon mapping extraction

**`packages/ui/src/lib/toolIcons.ts`** (new):

```ts
import type { LucideIcon } from 'lucide-react'
import { ... } from 'lucide-react'

export const TOOL_ICONS: Record<string, LucideIcon> = { ... }
export function iconFor(tool: string): LucideIcon { return TOOL_ICONS[tool] ?? Wrench }
```

Move the existing map + `iconFor` from `ToolCapsule.tsx` here. Have `ToolCapsule` import it. No behavior change.

### Step 4 — Command formatter

**`packages/ui/src/lib/formatCommand.ts`** (new):

```ts
export function formatCommand(toolUse: ToolUse): string
```

Rules per D8. Unit tests in `formatCommand.test.ts` (5 branches: Bash, Read no offset, Read with offset/limit, Glob, fallback).

### Step 5 — Inspector empty state

**`packages/ui/src/components/inspector/InspectorEmpty.tsx`** (new):

```tsx
export function InspectorEmpty()
```

Visual per design source: dashed circle, Wrench icon (24px), "Tool inspector" heading (text-sm font-semibold text-text-2), one-line hint (text-xs text-muted-foreground, max-w-[260px]), pill row with `Bash · Read · Edit · Grep` (font-mono text-[10.5px] border rounded-full).

### Step 6 — Tool header

**`packages/ui/src/components/inspector/ToolHeader.tsx`** (new):

```tsx
interface ToolHeaderProps {
  interaction: ToolInteraction
  toolUse: ToolUse
  onJumpBack: () => void
  onClose: () => void
}
export function ToolHeader(props): JSX.Element
```

Layout (per `workspace-inspector.jsx` `ToolHeader`):

- Top row: eyebrow "TOOL CALL" (mono, uppercase, .06em letter-spacing) on left; Jump-back button + Close button on right.
- Middle row: 30px tool-icon square + tool name (mono semibold 14px) + args summary (text-3 12px) + status pill (success-soft/warn-soft/danger-soft with matching text). Pill icon: `Check` for success, `AlertTriangle` for fail, `Loader2` (spin) for running.
- Bottom row: mono 11px metadata — duration (with `⏱` glyph) + tokens (with `↯` glyph; null-skipped). No `async` row this phase (no projection field for it).

### Step 7 — Tab body components

**`packages/ui/src/components/inspector/tabs/CallTab.tsx`**:

For `Bash`: render `<pre>` of `input.command`. Else: render `JSON.stringify(input, null, 2)` in `<pre>`. Show optional description block underneath (font 12, muted "DESCRIPTION" eyebrow).

**`packages/ui/src/components/inspector/tabs/ResultTab.tsx`**:

- If `interaction.status === 'running'` AND no `toolResult` → spinner + "Streaming — tail in background task". (No live result text this phase; no spillover from streaming.)
- Else if `toolResult` → render `content` as `<pre>`. `is_error === true` → tint with danger-soft background + danger border.
- Else (interaction has no result and not running — shouldn't happen, defensive) → "(empty)".

**`packages/ui/src/components/inspector/tabs/PreviewTab.tsx`**:

- `toolResult.content` as string (or `safeStringify` for arrays).
- If `content.length > 256 * 1024`: render the "Preview suppressed — file too large (X MB)" card with a "Switch to Raw" button that calls a `onSwitchTab('raw')` callback.
- Else: `<pre>` with monospace, line-wrap off (`overflow-x-auto whitespace-pre`).
- Optional file path eyebrow above (`interaction.preview.filePath` if present).

**`packages/ui/src/components/inspector/tabs/DiffTab.tsx`**:

Reuse `DiffBlock` from `packages/ui/src/components/transcript/DiffBlock.tsx` — extract its visual into a `DiffView` sub-component that takes `(toolName, input, diffSummary)` and DOESN'T own selection state. Wrap with a header showing `+N / −N` (already done in DiffBlock — refactor so both consumers share the rendering).

Concretely:
- Rename current `DiffBlock` body to `DiffView` (presentational, no store reads).
- Keep `DiffBlock` as a thin selection-aware wrapper around `DiffView`.
- `DiffTab` calls `<DiffView toolName={tu.name} input={tu.input} diff={interaction.diff} />`.

**`packages/ui/src/components/inspector/tabs/RawTab.tsx`**:

`<pre>` with `JSON.stringify({ interaction, toolUse, toolResult }, null, 2)`.

### Step 8 — Inspector container

**`packages/ui/src/components/inspector/Inspector.tsx`** (new):

```tsx
export function Inspector() {
  const selected = useSelectedInteraction()
  const [tab, setTab] = useState<TabId>('result')

  useEffect(() => {
    if (!selected) return
    const next = selected.interaction.diff
      ? 'diff'
      : selected.toolUse.name === 'Read' && selected.toolResult
        ? 'preview'
        : 'result'
    setTab(next)
  }, [selected?.interaction.id])

  if (!selected) return <InspectorEmpty />
  return <InspectorContent selected={selected} tab={tab} setTab={setTab} />
}
```

`InspectorContent` renders `<ToolHeader>` + tab strip + tab body per `tab`. The tab strip is a flex row with buttons + a right-aligned action group (Copy command).

**Jump-back handler:**

```ts
const requestJump = useSearchStore((s) => s.requestJump)
const activeSessionId = useUIStore((s) => s.activeSessionId)
const drillTop = useNavigationStore((s) => s.drillStack.at(-1))

function onJumpBack() {
  if (!selected || !activeSessionId) return
  requestJump({
    sessionId: drillTop?.sessionId ?? activeSessionId,
    agentId: drillTop?.agentId ?? null,
    turnUuid: selected.interaction.turnUuid,
    interactionId: selected.interaction.id,
  })
}
```

**Copy handler:**

```ts
const [copied, setCopied] = useState(false)
async function onCopy() {
  if (!selected) return
  const text = formatCommand(selected.toolUse)
  try { await navigator.clipboard.writeText(text) } catch { /* swallow */ }
  setCopied(true)
  setTimeout(() => setCopied(false), 1500)
}
```

**Close handler:**

```ts
const clearSelection = useNavigationStore((s) => s.setSelectedInteractionId)
function onClose() { clearSelection(null) }
```

### Step 9 — RightRail + ComingSoon

**`packages/ui/src/components/inspector/ComingSoon.tsx`** (new):

```tsx
export function ComingSoon({ tab }: { tab: string }) {
  return <div className="...">
    <Sparkles className="w-5 h-5"/>
    <div className="font-semibold">{tab}</div>
    <div className="text-xs muted">Coming in Phase 6.</div>
  </div>
}
```

**`packages/ui/src/components/inspector/RightRail.tsx`** (new):

```tsx
type Tab = 'inspector' | 'tokens' | 'files'

export function RightRail() {
  const [tab, setTab] = useState<Tab>('inspector')
  const selectedId = useNavigationStore((s) => s.selectedInteractionId)
  // Selecting an interaction forces back to the Inspector tab.
  useEffect(() => { if (selectedId) setTab('inspector') }, [selectedId])
  // ...tab strip + body conditional render...
}
```

The tab strip is a 3-button flex row with border-bottom, active button gets `border-bottom-2 border-accent` + `text-foreground font-semibold`.

### Step 10 — AppShell wiring

**`packages/ui/src/components/layout/AppShell.tsx`**

Replace `<InspectorRailPlaceholder />` with `<RightRail />`. Delete `InspectorRailPlaceholder.tsx` + its file. The existing collapsible-panel plumbing (`useUIStore.rightRailOpen` → `panel.collapse()`/`.expand()`) and width persistence stay untouched.

### Step 11 — DiffBlock refactor

**`packages/ui/src/components/transcript/DiffBlock.tsx`**:

- Extract rendering into a presentational `DiffView` (no store reads).
- `DiffBlock` (selection-aware) wraps `DiffView` and adds the click handler + `isSelected` outline.
- `DiffBlockRow` (existing) unchanged.

Pure refactor — no behavior change for the transcript pane. Phase 4 tests of `DiffBlock.test.tsx` continue to pass.

### Step 12 — Tests

**New tests:**

- `formatCommand.test.ts` — 5 branches.
- `useSelectedInteraction.test.ts` — resolves correctly, returns null on stale id, resolves through subagent drill (use a small `QueryClientProvider` wrapper with seeded query data).
- `InspectorEmpty.test.tsx` — renders chip strip + hint.
- `ToolHeader.test.tsx` — status pill color/label by status, jump-back + close buttons clickable.
- `Inspector.test.tsx`:
  - Empty when no selection.
  - Renders header + tab strip when an interaction is selected.
  - Default tab = `diff` for diff interaction, `preview` for Read, `result` otherwise.
  - Copy button writes to clipboard (mock `navigator.clipboard`).
  - Close button clears `selectedInteractionId`.
- `RightRail.test.tsx` — three tabs render, click switches, selecting an interaction forces back to inspector.
- `TranscriptPane.test.tsx` — extend existing test to assert that a `pendingJumpTarget` with `interactionId` set scrolls to the capsule row, not just the turn row (use a fixture with multiple capsules in one turn).

**Updated tests:**

- `DiffBlock.test.tsx` — should still pass after the `DiffView` refactor; assert `DiffView` rendering remains identical.
- `AppShell.test.tsx` — replace assertion about `InspectorRailPlaceholder` with assertion that `RightRail` is mounted.

### Step 13 — Performance smoke

Open a real 10k-event session (`~/.claude/projects/...`) in dev:

- Click 20 different capsules in succession; verify no jank, no growing memory in DevTools.
- Open Result tab on a Read with ~2 MB output — confirm Preview tab guard fires.
- Toggle `compact` ↔ `details` while a selection is open — verify rail stays bound to the same interaction.

### Step 14 — Final pass

```
npm run typecheck
npm run test
npm run build
```

Update `00-PROGRESS.md`: row 5 from ⬜ → ✅. Phase 8 becomes unblocked (Phase 6 was already unblocked after 4).

---

## Files touched

**New:**

- `packages/ui/src/components/inspector/RightRail.tsx`
- `packages/ui/src/components/inspector/Inspector.tsx`
- `packages/ui/src/components/inspector/InspectorEmpty.tsx`
- `packages/ui/src/components/inspector/ToolHeader.tsx`
- `packages/ui/src/components/inspector/ComingSoon.tsx`
- `packages/ui/src/components/inspector/tabs/CallTab.tsx`
- `packages/ui/src/components/inspector/tabs/ResultTab.tsx`
- `packages/ui/src/components/inspector/tabs/PreviewTab.tsx`
- `packages/ui/src/components/inspector/tabs/DiffTab.tsx`
- `packages/ui/src/components/inspector/tabs/RawTab.tsx`
- `packages/ui/src/components/inspector/RightRail.test.tsx`
- `packages/ui/src/components/inspector/Inspector.test.tsx`
- `packages/ui/src/components/inspector/InspectorEmpty.test.tsx`
- `packages/ui/src/components/inspector/ToolHeader.test.tsx`
- `packages/ui/src/hooks/useSelectedInteraction.ts`
- `packages/ui/src/hooks/useSelectedInteraction.test.ts`
- `packages/ui/src/hooks/useActiveQuery.ts`
- `packages/ui/src/lib/formatCommand.ts`
- `packages/ui/src/lib/formatCommand.test.ts`
- `packages/ui/src/lib/toolIcons.ts`

**Deleted:**

- `packages/ui/src/components/inspector/InspectorRailPlaceholder.tsx`

**Edited:**

- `packages/ui/src/components/layout/AppShell.tsx` — swap placeholder for `RightRail`.
- `packages/ui/src/components/layout/AppShell.test.tsx` — assertion update.
- `packages/ui/src/components/transcript/TranscriptPane.tsx` — extend jump-target handler with `interactionId` capsule match + `data-flash` attribute; pull out `useActiveQuery` shared helper.
- `packages/ui/src/components/transcript/TranscriptPane.test.tsx` — add `interactionId`-targeted scroll test.
- `packages/ui/src/components/transcript/ToolCapsule.tsx` — use `toolIcons` lib.
- `packages/ui/src/components/transcript/DiffBlock.tsx` — extract `DiffView` presentational component.
- `packages/ui/src/components/transcript/DiffBlock.test.tsx` — adjust imports.
- `packages/ui/src/stores/useSearchStore.ts` — add `interactionId?` to `JumpTarget`.
- `packages/ui/src/index.css` — add `@keyframes flash-ring` + `[data-flash]` rule.

---

## Risks / things to watch

1. **Stale selection across entry change.** Already mitigated — `main.tsx` reconciler clears `selectedInteractionId` on entry change. `useSelectedInteraction` returns `null` if id doesn't resolve, so the inspector falls back to `<InspectorEmpty/>`.
2. **Inspector re-mounts on every selection change.** Tab strip + body live inside one parent; only the inner tab component changes. React.memo not needed at this scale.
3. **Jump-back when the capsule is collapsed below screen.** Virtuoso's `scrollToIndex({align:'center'})` mounts the row, then `data-flash` triggers — works because the wrapper `<div>` is in `itemContent` and gets remounted on render.
4. **`interactionId` parsing.** I'm decoding it as `${turnUuid}:${toolUseId}` to find the capsule row. Since both UUIDs can contain hyphens but not colons, `split(':', 2)` is unambiguous. Defensive: if split fails, fall back to turn-uuid match.
5. **Copy command on Safari private mode.** `navigator.clipboard` may throw / return undefined. Wrapped in try/catch; UI shows "Copied!" even on failure (no error toast) — acceptable for v1; future polish.
6. **Large Read previews.** The 256 KiB threshold is a heuristic — Read outputs above that range to "very large files". The Raw tab still shows the whole content; if that becomes a problem in practice we'll add a Raw-tab guard too.
7. **Performance under 10k rows + frequent capsule clicks.** `useSelectedInteraction` does `O(turns)` lookups per selection change; with 10k turns that's ~1ms. The flatMap of all `toolResults` is `O(turns + results)` but memoized on `turns` reference — no per-render cost. Safe.
8. **`DiffView` extraction.** Pure refactor — verify the Phase 4 DiffBlock visual snapshot tests still pass.
9. **AppShell test referencing the placeholder.** Update the test to assert `<RightRail>` instead. Don't lose the existing assertion that the rail collapses on `rightRailOpen=false`.
