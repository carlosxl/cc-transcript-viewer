# Phase 0 Research: Inspector-Only Right Rail, Session Report Modal, and Sidebar Alignment

The spec was created interactively and contains a `Clarifications` section that already resolved the five ambiguities the planner would otherwise flag as NEEDS CLARIFICATION (empty/zero-data behavior, `r` suppression rules, focus management, file-row sort order, spike-card count when turns < 3). Nothing in the Technical Context introduces new unknowns. The remaining research is therefore implementation-pattern selection across the existing stack — not unknown technology choices.

## Decisions

### D1. State location for `sessionReportOpen`

**Decision**: Add a single boolean `sessionReportOpen` plus actions `setSessionReportOpen(v)` and `toggleSessionReportOpen()` to `packages/ui/src/stores/useUIStore.ts`. Mount `<SessionReportDrawer />` once at the shell level (`AppShell.tsx`) — not inside `TranscriptHeader`.

**Rationale**:

- FR-024 explicitly mandates "a single boolean state for whether the Session Report is open" at the workspace shell.
- The `r` shortcut (FR-017), the Escape priority chain (FR-019), the header Report button (FR-016), and the modal itself all need the same boolean — co-locating it in `useUIStore` is the existing pattern for shell-wide flags (`rightRailOpen`, `narrowSheetOpen`, `narrowSidebarOpen`).
- The current code holds the flag in `TranscriptHeader`'s local `useState`; that locks the keyboard hook out of the value and forces the modal to live inside the header. Lifting it removes both problems.

**Alternatives considered**:

- Keep the flag in `TranscriptHeader` and wire the `r` shortcut via a ref/event bus: rejected — fights the existing store pattern and complicates the Escape priority chain (which must compare with `useSearchStore.open` and `narrowSheetOpen` at handle time).
- Put the flag in a new dedicated store (`useReportStore`): rejected — overkill for one boolean; violates Principle V.

**Persistence**: Intentionally not persisted to localStorage. The spec frames the report as a "deliberate and lightweight" flick-open surface; persisting "open" across page reloads would surprise users.

### D2. Removing the right-rail tab strip

**Decision**: Delete the `Tab` type, the `TABS` constant, the `tab` `useState`, and the `selectedInteractionId` → force-Inspector `useEffect` from `RightRail.tsx`. The component reduces to a single `<aside>` containing `<Inspector />` (which already renders `<InspectorEmpty />` when no interaction is selected — that's the spec's required empty state).

**Rationale**:

- FR-001 / FR-002 / FR-005 / FR-006: no tab strip in any variant, no "force tab" behavior anywhere.
- FR-004 / SC-006: the empty state must not reference the removed Tokens/Files tabs. The current `InspectorEmpty` copy ("Click any tool capsule or diff in the transcript to inspect arguments, results, and changes.") already satisfies this — no edit needed beyond a verification test.
- Bottom-sheet variant (`AppShell.tsx` narrow branch) already mounts `<RightRail />` inside `<BottomSheet />`, so removing the tab strip from `RightRail` automatically satisfies FR-006.

**Alternatives considered**:

- Conditionally hide the tab strip behind a `hasTabs` prop: rejected — leaves dead code for a behavior the spec explicitly forbids.
- Move `TokensPanel` / `FilesPanel` content into the Session Report and delete the files: rejected — the spec's Assumptions explicitly call this a follow-up cleanup ("the previously-existing `TokensPanel` and `FilesPanel` components are no longer reachable through the UI but may remain in the codebase temporarily").

### D3. Sourcing the Session Report's `Usage over time` and `Files touched` sections

**Decision**: Reuse the existing client-side data already in scope when the modal is open:

- `Usage over time` reads `tokenSeries.points` (units per assistant turn), `tokenSeries.spikes` (≤3 spike entries), and ranks the units-per-turn maximum for the sparkline's peak callout. Source: the `SessionDetailResponse` already cached on the open session via `useSession(activeSessionId)`. Where exactly the modal sources it from is hidden behind a new selector hook (`useActiveDetailProjections()` — colocated in `SessionReportDrawer.tsx`).
- `Files touched` reads `fileTouchIndex.files` and re-sorts in-component by `reads.length + writes.length` desc, ties broken by `min(read.timestamp, write.timestamp)` asc (per the Clarifications answer).

**Rationale**:

- FR-022: "The Session Report MUST source its data from the existing session token-report data and session files data; no new transcript-level data shapes are required."
- The `SessionReport` shape returned by `/api/sessions/:id/report` does not carry per-turn time-series data; that lives on `SessionDetailResponse.tokenSeries`. Both are already fetched independently by the running app — the report endpoint feeds the table+KPIs, the detail projection feeds the sparkline+files.
- FR-015 ordering ("reads + writes desc, ties broken by first-touched timestamp asc") is the client-side ranking — `FileTouchIndex.files` is already sorted by recency for the (no-longer-mounted) `FilesPanel`. Re-sorting in-component is a one-line `.toSorted(...)` over ≤ a few dozen entries; no shared-builder change required.

**Alternatives considered**:

- Add a new server projection (e.g. `SessionReportExtended`) that bundles the spark + files: rejected — violates FR-022 and Principle V; adds a server change for no behavior gain.
- Re-walk `Turn[]` in the client to compute units-per-turn: rejected — duplicates the `token-series.ts` projection that already runs server-side.

### D4. Spike-card count when fewer than 3 spikes exist

**Decision**: Render `min(turns_with_non_zero_usage, 3)` spike cards. If zero qualifying turns exist, render the section's empty caption (FR-014 fallback to FR-015a empty caption rule).

**Rationale**:

- Spec Clarification: "Render min(turns_with_non_zero_usage, 3) cards. If zero qualifying turns, fall back to the empty caption defined for the zero-data state."
- `tokenSeries.spikes` is "top-3 outliers; empty when N < 4 or no spike crosses mean + 2σ" (from `types.ts`). For sessions with only 1–3 turns the `spikes` array can be empty even though usage is non-zero. The modal therefore derives spike-eligible turns directly from `tokenSeries.points` filtered by `p.input + p.output + p.cacheCreate > 0`, then sorts by that sum desc and slices `[0, 3)`. This is a self-contained ≤10-line helper inside the new `SessionReportUsageOverTime` component.

**Alternatives considered**:

- Always render exactly 3 cards, padding with placeholder rows: rejected — the spec explicitly says "Render min(N, 3)".
- Trust only `tokenSeries.spikes` and show empty when it's empty even though points exist: rejected — would surprise the user on small sessions where there is real per-turn usage to highlight.

### D5. `r` keyboard shortcut wiring + Escape priority chain

**Decision**: Extend `useKeyboardShortcuts.ts` with one new case (`'r'`) and adjust the existing `'escape'` case to honour the priority chain. Detection of "overlay open" reads `useSearchStore.getState().open` and `useUIStore.getState().narrowSheetOpen` synchronously inside the handler (same pattern as the existing `j`/`k` reading `useNavigationStore.getState().focusedMsgIndex`).

**Suppression rules for `r`** (per FR-017):

- The hook already early-returns when the target element is an `<input>`, `<textarea>`, or `contentEditable` — covers the "typing the letter r" case.
- Add: if `useSearchStore.getState().open === true` OR `useUIStore.getState().narrowSheetOpen === true`, do NOT toggle (allow the key to fall through to the browser, which is a no-op).
- An active Inspector selection (`useNavigationStore.selectedInteractionId !== null`) does NOT block `r` — Inspector is part of the shell (per Clarifications + FR-017).

**Escape priority chain** (per FR-019):

```text
if (sessionReportOpen)     → setSessionReportOpen(false); return;
else if (searchOpen)       → useSearchStore.close(); return;
else if (narrowSheetOpen)  → setNarrowSheetOpen(false); return;
else if (selectedInteractionId !== null) → setSelectedInteractionId(null); return;
else                        → setFocusedMsgIndex(-1);  // existing fallback
```

The hook does **not** call `e.preventDefault()` on Escape (the existing comment "Don't preventDefault — Radix dialogs handle their own escape" still applies). To prevent Radix's `<Dialog />` from also intercepting Escape and closing the report twice / out-of-order, the `<SessionReportDrawer />` is given `onEscapeKeyDown={(e) => e.preventDefault()}` and relies on the centralized hook to close it — the same delegation pattern Radix recommends for nested modals.

**Rationale**: Matches the v2 prototype (`workspace-app.jsx:260-296`) and centralizes shortcut policy in one file rather than spraying handlers across components. The store-getState reads avoid stale-closure issues from listing every dependency in the effect array.

**Alternatives considered**:

- Subscribe to each store in `useKeyboardShortcuts` and recreate the listener on each change: rejected — adds re-bind churn for state that doesn't affect anything outside this handler.
- Let each modal own its own Escape: rejected — the priority chain (report > search > sheet > selection) needs a single arbiter.

### D6. Focus trap + focus restoration on the modal

**Decision**: Use the focus-management already provided by shadcn's `Dialog` (Radix `Dialog.Content`):

- `<DialogContent>` already traps focus by default. No new library needed.
- Set the close (X) button as the initial focus target via `autoFocus` on the `<DialogClose>` (or equivalent ref-based `requestAnimationFrame(() => closeBtnRef.current?.focus())` after open).
- Radix restores focus to the trigger element automatically on close, satisfying FR-021a's "return to header Report button" case. For the `r`-shortcut case (the trigger is implicit — the workspace shell), explicit restoration is unnecessary because the document body retains focus.

**Rationale**: FR-021a wants the standard accessible-modal pattern. Radix's `Dialog` is that pattern. Adding `focus-trap-react` or a custom trap is redundant.

### D7. Sidebar visual refactor — keep behavior, replace classes

**Decision**: Treat the sidebar refactor as a CSS/markup-only change inside `SessionBrowser.tsx`, `ProjectSection.tsx`, `SessionRow.tsx`, using existing design tokens (`--accent`, `--accent-soft`, `--surface-2`, `--text-3`, `--font-mono`). Wire the search button to the existing `useSearchStore.open()`. Move the sort toggle into a Radix `<Popover>` triggered by the overflow icon-button — using the same `Popover` primitive already used by `TranscriptHeader`'s `Session info` button.

**Rationale**:

- FR-038 mandates behavioral preservation. The data flow (`useSessionList()` → `groupAndSort()` → `<ProjectSection />`) is exactly what the spec describes; the v2 prototype's `Sidebar` performs the same mental operation, just with different className/style values.
- Reusing `Popover` for the overflow menu (vs. creating a new `DropdownMenu` component) keeps the bundle and the maintenance surface small.
- Tokens (`--accent-soft`, `--surface-2`) already exist in the app's CSS so the visual change is just class swaps + a new compact row template.

**Alternatives considered**:

- Rewrite the sidebar as a single component matching the v2 prototype line-for-line: rejected — would discard test coverage and reintroduce regressions in pinning/sort/grouping that the current code passes.
- Add a `DropdownMenu` shadcn primitive for the overflow: rejected — `Popover` already covers the one menu item ("Sort: Newest first / Oldest first"); `DropdownMenu` is justified once there are 3+ items.

### D8. Modal width on narrow viewports

**Decision**: Use the existing `<DialogContent className="!max-w-5xl w-[calc(100%-2rem)]">` and rely on FR-007's intent: the cap is `min(960px, 100%)`. Replace the current `!max-w-5xl` (~64rem ≈ 1024px) with `!max-w-[960px]` to match the spec literally. Below the narrow breakpoint the modal naturally fills (minus the 1rem each-side gap), giving the spec's "behaves like a full-screen view without a separate code path" outcome.

**Rationale**: Edge Cases section of the spec ("Narrow viewport: the report still opens as a centered modal (its width is capped at `min(960px, 100%)`)"). No separate mobile sheet variant.

## Open items resolved here, summarized

| Topic | Resolution | Where it lives |
|-------|------------|----------------|
| Where does `sessionReportOpen` live? | `useUIStore` | D1 |
| Tab strip removal | Delete from `RightRail.tsx`; `Inspector` renders directly | D2 |
| Usage-over-time data source | `tokenSeries.points` + `tokenSeries.spikes` from cached detail | D3 |
| Spike-card count rule | `min(turns_with_non_zero_usage, 3)` else empty caption | D4 |
| `r` shortcut + Escape priority | Centralized in `useKeyboardShortcuts.ts`; reads stores synchronously | D5 |
| Focus management | Radix `Dialog` defaults + close-button autoFocus | D6 |
| Sidebar refactor scope | CSS/markup-only; same data flow; sort moves to overflow Popover | D7 |
| Modal width | `!max-w-[960px]` (was `!max-w-5xl`) | D8 |
