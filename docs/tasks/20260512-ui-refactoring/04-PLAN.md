# Phase 4 — Transcript content redesign: Implementation Plan

## TL;DR

- Re-skin every message and message-part to match `.design/project/workspace-app.jsx`.
- Tool calls become clickable **capsules** (`ToolCapsule`) that select a
  `ToolInteraction` (`useNavigationStore.selectedInteractionId`). Results no
  longer render inline; the row that used to carry them is removed from
  `flatNodes`. Phase 5 binds the right rail to the selected interaction.
- New inline blocks: `DiffBlock` (Edit/Write capsules render as a unified-diff
  block alongside the capsule), `CommandBlock` (`/clear`-style mono row),
  `StderrBlock` (danger-tinted user block).
- `ThinkingRow` redesigned: italic body, dashed border, "Thinking" eyebrow.
- Role headers redesigned: round avatar with role tint, `User`/`Claude` label,
  mono model + timestamp baseline.
- `useFlatNodes` simplified: drop view-mode branching for everything except
  thinking. `viewMode` is preserved as a toggle but only controls whether the
  `thinking` node emits — all other content (text, capsule, diff, command,
  stderr, markdown) is always shown. This is the minimal change consistent
  with the brief's "Remove the view-mode branching once parity is verified."

---

## Decisions

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| D1 | Where selection lives | New slice `selectedInteractionId: string \| null` on `useNavigationStore` (next to `drillStack`, `focusedMsgIndex`). Reset to `null` in the `main.tsx` snapshot reconciler on entry change. | Brief explicitly suggests this location. Per-entry ephemeral state — no persistence. |
| D2 | `viewMode` fate | Keep slice + header toggle, but narrow semantics: `compact` = hide thinking; `details` = show thinking. Capsules / diffs / commands / stderr / text always emit. | Minimal churn. Avoids deleting tests and breaking the `c`/`d` keyboard shortcuts that landed in Phase 3. The brief's "remove view-mode branching" is satisfied because the only remaining branch is over a single node kind. |
| D3 | `ToolCallRow` → `ToolCapsule` | Rename file + component. New visual: rounded surface, tool icon (by name), mono tool name, truncated arg summary, optional duration, status dot (success/fail/running), chevron-right hint. Click sets `selectedInteractionId`. | Phase brief's primary visual. Drops the inline JSON pre — full input goes to the Inspector in Phase 5. |
| D4 | `ToolResultRow` fate | Delete `tool-output` from `flatNodes` and `VirtualNodeRow`. Keep `ToolResultRow.tsx` and its test in place so Phase 5 can repurpose them inside the rail. | Brief: "results no longer render inline; ... clicking shows nothing; that's fine." Keeping the file avoids ripping out the rendering logic only to re-add it next phase. |
| D5 | `ToolInteraction` lookup at the capsule | Build a `Map<toolUseId, ToolInteraction>` once per session detail in a new selector hook `useInteractionByToolId()` reading from `useSession`/`useSubagent` cache. Capsule receives `interaction` (may be `null` when no detail loaded yet). | Avoids re-walking the projection array in every row. `useFlatNodes` already iterates turns; we'd duplicate work otherwise. |
| D6 | Diff visual placement | `DiffBlock` is a SEPARATE flat-node kind: `'diff'`. It appears AFTER the Edit/Write capsule for the same interaction. Click selects the same interaction. `diff` is emitted only when the matching `ToolInteraction.diff` is non-null. | Mirrors design where the diff block is a peer of the capsule, not a child. Sharing the selection key with the capsule keeps the rail logic simple. |
| D7 | Diff content rendering | The plan's projection stores only `{ filePath, added, removed }`. Hunks are rendered client-side by parsing `Edit.old_string` / `Edit.new_string` from `ToolUse.input` into a unified diff. Use a minimal line-by-line splitter (no LCS; old lines = `rm`, new = `add`). | Brief: "Phase 5's diff renderer indexes into turns ... and computes hunks client-side." For Edits with multi-line replacements the cheap splitter produces an acceptable visual; we can swap in a real diff later. |
| D8 | Command detection | New helper `classifyUserText(text)` returns `{ kind: 'command' \| 'stderr' \| 'text', name?, args?, body, stderr? }`. Recognizes `<command-name>X</command-name>` and `<local-command-stderr>X</local-command-stderr>` substrings in the joined `textBlocks`. Emitted as new flat-node kinds `'command'` and `'stderr'`. | Claude Code emits `<command-*>` XML-ish tags inside user-event content. Detection is local + cheap; no server-side projection needed. |
| D9 | Empty-thinking handling | Keep existing redacted/empty handling (the long settings.json hint). Wrap it in the new dashed-border eyebrow shell so it still matches the design. Empty-but-non-redacted thinking blocks are rare; render the eyebrow + "(no summary captured)". | Preserves the educational hint about Opus 4.7 thinking redaction (already there for a reason). |
| D10 | Role header redesign | `AssistantTurn` / `UserTurn` get a 28px round avatar with role tint (`var(--claude-tint)` / `var(--user-tint)`), inline name + mono timestamp (+ `· model` on assistant), and a gap-12 grid layout. Existing indigo/amber stripe is removed in favor of the avatar tint. | Matches `workspace-app.jsx` `UserMessage` / `AssistantMessage`. |
| D11 | Tool-result-only user turns | `UserTurn` already special-cases this (renders "Tool result" label). With capsules now carrying their own status, these turns become noise; drop them entirely from `flatNodes` (already done in compact mode — extend to all modes). | Brief: results live in rail. The "tool-result-only" shell becomes dead weight. |
| D12 | Subagent drill-in affordance | Keep the existing "Open subagent" / "subagent not linked" pattern from `ToolCallRow`. Render it as a small button INSIDE the new `ToolCapsule`, after the duration / status dot. | Preserves existing tests + AGENT-04 graceful-fallback behavior. |
| D13 | Stable interaction id | `id = ${turnUuid}:${toolUseId}` (matches Phase 2 D1). Capsule reads it from its `ToolInteraction`. | One source of truth. |
| D14 | Focused-row outline interaction | Existing `ring-1 ring-primary/40` outline (Phase 3) stays. Selected capsule gets its own `border-primary` + outline, independent of focus. | Two separate selection axes (focused row vs. selected interaction) need separate visual cues. |

---

## Step-by-step plan

### Step 1 — Navigation store: `selectedInteractionId`

`packages/ui/src/stores/useNavigationStore.ts`:

```ts
selectedInteractionId: string | null
setSelectedInteractionId: (id: string | null) => void
clearSelectedInteraction: () => void
```

`packages/ui/src/main.tsx` reconciler: add
`useNavigationStore.getState().setSelectedInteractionId(null)` next to the
existing `setFocusedMsgIndex(0)` reset.

**Verify:** `npm run typecheck`.

### Step 2 — Tool interaction lookup hook

`packages/ui/src/hooks/useInteractionByToolId.ts`:

```ts
export function useInteractionByToolId(): Map<string, ToolInteraction>
```

Reads the current `SessionDetailResponse` / `SubagentDetailResponse` via the
existing `useSession` / `useSubagent` hooks (whichever owns the current
entry — same branching as `TranscriptPane`). Builds a `Map<toolUseId, …>`
once via `useMemo` keyed on `interactions` array reference.

### Step 3 — `ToolCapsule` (renames `ToolCallRow`)

`packages/ui/src/components/transcript/ToolCapsule.tsx` (new file, replaces
`ToolCallRow.tsx`):

- Layout: `button` element, full-width, `flex items-center gap-2.5 px-3 py-2
  rounded-md bg-surface-2 border border-border text-left`.
- Tool icon: switch on `tool` name (`Bash` → `Terminal`, `Read`/`Glob` → `Code2`,
  `Edit`/`Write`/`MultiEdit` → `Pencil`, default → `Wrench`).
- Tool name in mono semibold.
- Arg summary: `Bash` → `input.command`; `Edit`/`Read`/`Write` → `input.file_path`;
  `Task`/`Agent` → `input.description`; fallback → empty. Truncate.
- Duration on right (`Xs` or `Xms`) from `interaction?.durationMs`.
- Status dot (8px circle, `bg-success`/`bg-warn`/`bg-danger`) derived from
  `interaction?.status` (`running`/`success`/`fail`; default success when no
  interaction yet).
- Chevron-right indicator (text-muted-foreground).
- Subagent drill-in: when `tu.name in {Agent, Task}` and `childAgentId` set,
  render a small "Open subagent ↗" inline button (`stopPropagation` on click)
  that pushes the drill. Keep "subagent not linked" hint when missing.
- Click handler: `setSelectedInteractionId(interaction.id)` when interaction
  is non-null; no-op otherwise.
- Selected visual: when `selectedInteractionId === interaction?.id`, add
  `border-primary ring-2 ring-primary/20`.

Move `safeStringify` to `packages/ui/src/lib/safeStringify.ts` so other
components (DiffBlock, Phase 5 inspector) can import it without dragging
in the old capsule file.

### Step 4 — `DiffBlock`

`packages/ui/src/components/transcript/DiffBlock.tsx` (new):

```tsx
interface DiffBlockProps {
  interaction: ToolInteraction    // diff is non-null when this kind emits
  toolUse: ToolUse                // for input.old_string / input.new_string
  selected: boolean
  onSelect: () => void
}
```

Renders:
- Header row (surface-2 bg, border-bottom): file icon + mono `interaction.diff.filePath`
  on the left; `+N / −N` (diff-add-text / diff-rm-text) on the right.
- Body: a list of rows produced by a tiny `splitHunks(input)` helper:
  - `Edit`: rows = `old_string.split('\n')` (type `rm`) followed by
    `new_string.split('\n')` (type `add`).
  - `Write`: rows = `content.split('\n')` (type `add`).
  - `MultiEdit`: flatten each edit using Edit rules.
- Each row uses `var(--diff-add-bg)` / `var(--diff-rm-bg)` / transparent +
  marker `+` / `−` / ` ` + indent.

Click → `onSelect()` (sets `selectedInteractionId` — same as the capsule).

### Step 5 — `CommandBlock`, `StderrBlock`

`packages/ui/src/components/transcript/CommandBlock.tsx`:

Per design: surface-2 bg, border, rounded, command icon, mono name (primary),
mono args (muted), timestamp on right.

`packages/ui/src/components/transcript/StderrBlock.tsx`:

Per design: danger-soft bg, danger border, warn icon + "stderr" eyebrow,
mono body, timestamp.

### Step 6 — User-text classifier

`packages/ui/src/lib/classifyUserText.ts`:

```ts
type Classified =
  | { kind: 'command'; name: string; args: string; body: string; stderr: string | null }
  | { kind: 'stderr'; text: string }
  | { kind: 'text'; text: string }

export function classifyUserText(text: string): Classified
```

Rules:
1. If `<command-name>` tag present → `kind: 'command'`, extract name + args +
   message body + optional `<local-command-stderr>`.
2. Else if `<local-command-stderr>` tag present with non-empty inner content
   → `kind: 'stderr'`.
3. Else → `kind: 'text'`.

Unit-tested with all three branches.

### Step 7 — Thinking row redesign

`packages/ui/src/components/transcript/ThinkingRow.tsx`:

- Outer: `border border-dashed border-border-strong rounded-md bg-think-tint
  px-3.5 py-2.5 text-think-text italic`.
- Eyebrow: non-italic `Sparkles` icon (12px) + uppercase "Thinking" label,
  text-3 + .08em letter-spacing.
- Body: italic when text present; muted-foreground when redacted (existing
  long-form hint preserved verbatim).

### Step 8 — `UserTurn` / `AssistantTurn` redesign

Both turn rows adopt the `flex gap-12` layout with a `28px` rounded avatar:

`AssistantTurn`:
- Avatar: `bg-[var(--claude-tint)] text-[var(--claude-text)]`, `Sparkles` icon.
- Header row: `Claude` (semibold), `· {model}` (mono muted), `· {ts}`.
- Body: rendered through `MarkdownRenderer` and the new user-text classifier
  is NOT applied (assistant text is always markdown).

`UserTurn`:
- Use `classifyUserText(text)` on the assembled text:
  - `command` → render `CommandBlock` only (no avatar, no name row).
  - `stderr` → render `StderrBlock` only.
  - `text` → avatar + `You` + timestamp + markdown body.
- Drop the existing "tool-result-only" branch (filtered at flat-node level
  per D11).

### Step 9 — `flatNodes` simplification

`packages/ui/src/lib/flatNodes.ts`:

Replace the existing `VirtualNode` union with:

```ts
export type VirtualNode =
  | { kind: 'turn';     key: string; turn: Turn }
  | { kind: 'capsule';  key: string; turn: Turn; toolUseId: string }
  | { kind: 'diff';     key: string; turn: Turn; toolUseId: string }
  | { kind: 'thinking'; key: string; turn: Turn; index: number }
```

(Command/stderr nodes are detected INSIDE the `turn` node by `UserTurn` — no
extra flat-node kind needed, since they replace the whole turn body.)

Build rules:
1. Skip `isMeta` turns.
2. For user turns: emit `{kind:'turn'}` only when `classifyUserText(text)`
   yields a non-empty body. Tool-result-only turns are skipped.
3. For assistant turns: emit `{kind:'turn'}` when `textBlocks` are non-empty
   OR there are no children. Then emit thinking + capsule + (optional) diff
   children:
   - Thinking children gated by `mode === 'details'`.
   - Capsules: one per `toolUse`.
   - Diff: one extra row right after the capsule when the matched
     `ToolInteraction.diff` is non-null. (Build a Map<toolUseId, has-diff>
     from `interactions` outside `buildFlatNodes` and pass in.)
4. Drop the old `tool-output` emission entirely. Drop the orphan-tool-result
   pass.

Signature becomes:
```ts
buildFlatNodes(turns: Turn[], interactionsByToolId: Map<string, ToolInteraction>, mode: ViewMode): VirtualNode[]
```

`useFlatNodes` accepts the same interactions map (read from
`useInteractionByToolId()`).

### Step 10 — `VirtualNodeRow` dispatch

`packages/ui/src/components/transcript/VirtualNodeRow.tsx`:

```tsx
switch (node.kind) {
  case 'turn':     return <TurnRow turn={node.turn} />
  case 'capsule':  return <ToolCapsule turn={node.turn} toolUseId={node.toolUseId} />
  case 'diff':     return <DiffBlockRow turn={node.turn} toolUseId={node.toolUseId} />
  case 'thinking': return <ThinkingRow turn={node.turn} index={node.index} />
}
```

`DiffBlockRow` is a tiny wrapper that pulls `ToolUse` + `ToolInteraction`
from the interactions map + turn arrays and passes them to `DiffBlock`.

### Step 11 — TranscriptPane wiring

- Read `interactionsByToolId` via the new hook and pass it to `useFlatNodes`.
- No additional layout changes — the StatusBar / TranscriptHeader split from
  Phase 3 stays.

### Step 12 — Tests

**New:**
- `ToolCapsule.test.tsx` — icon by tool, click sets `selectedInteractionId`,
  status dot color by status, "Open subagent" still works.
- `DiffBlock.test.tsx` — +N/−N header, add/rm rows, click selects interaction.
- `CommandBlock.test.tsx` — name + args + timestamp render.
- `StderrBlock.test.tsx` — danger styling + body render.
- `classifyUserText.test.ts` — three branches.
- `flatNodes.test.ts` — already exists; update for new node kinds. Add tests
  for capsule + diff emission, thinking gating, command/stderr passthrough.

**Updated:**
- `ToolCallRow.test.tsx` → rename to `ToolCapsule.test.tsx`. Preserve
  subagent-drill-in assertions; delete the "renders JSON body" assertion (no
  longer applies).
- `ToolResultRow.test.tsx` — keep (file kept for Phase 5).
- `TurnRow.test.tsx` — update for new avatar layout; the "User" / "Claude" /
  "System" labels remain; the "Show full" preview test stays (still
  rendered through ContentPreview).
- `TranscriptPane.test.tsx` — re-check that scroll + StatusBar still wire up
  (no structural change).
- `routes.test.ts` — unchanged.

### Step 13 — Final pass

```
npm run typecheck
npm run test
npm run build
```

Open a real session, exercise:
- Capsules render with status dots; clicking sets the selection and shows a
  border outline.
- Edit/Write capsules show a diff block beneath.
- `/clear`-style commands render as command blocks, not generic user turns.
- Thinking eyebrow + dashed border.
- Assistant turns show round avatar + model + timestamp baseline.
- `c` hides thinking, `d` shows it. Other content unchanged.
- 10k-message fixture (load any long real session) scrolls smoothly.

Update `00-PROGRESS.md`: row 4 from ⬜ → ✅. Phases 5 + 6 become unblocked.

---

## Files touched

**New:**
- `packages/ui/src/components/transcript/ToolCapsule.tsx`
- `packages/ui/src/components/transcript/ToolCapsule.test.tsx`
- `packages/ui/src/components/transcript/DiffBlock.tsx`
- `packages/ui/src/components/transcript/DiffBlock.test.tsx`
- `packages/ui/src/components/transcript/CommandBlock.tsx`
- `packages/ui/src/components/transcript/CommandBlock.test.tsx`
- `packages/ui/src/components/transcript/StderrBlock.tsx`
- `packages/ui/src/components/transcript/StderrBlock.test.tsx`
- `packages/ui/src/lib/classifyUserText.ts`
- `packages/ui/src/lib/classifyUserText.test.ts`
- `packages/ui/src/lib/safeStringify.ts`
- `packages/ui/src/hooks/useInteractionByToolId.ts`

**Deleted:**
- `packages/ui/src/components/transcript/ToolCallRow.tsx`
- `packages/ui/src/components/transcript/ToolCallRow.test.tsx`

**Edited:**
- `packages/ui/src/components/transcript/AssistantTurn.tsx`
- `packages/ui/src/components/transcript/UserTurn.tsx`
- `packages/ui/src/components/transcript/ThinkingRow.tsx`
- `packages/ui/src/components/transcript/VirtualNodeRow.tsx`
- `packages/ui/src/components/transcript/TurnRow.test.tsx`
- `packages/ui/src/components/transcript/TranscriptPane.tsx`
- `packages/ui/src/lib/flatNodes.ts`
- `packages/ui/src/hooks/useFlatNodes.ts`
- `packages/ui/src/stores/useNavigationStore.ts`
- `packages/ui/src/main.tsx`

---

## Risks / things to watch

1. **Diff hunks are not real diffs.** The cheap rm-then-add splitter is fine
   for small edits and matches the design's visual. Multi-line Edits with
   shared prefix/suffix will look noisier than a real diff. Acceptable for
   v1 of the rail; Phase 5 (or later) can swap in a real LCS diff.
2. **`<command-name>` detection.** Real Claude Code JSONLs vary in exact
   surrounding whitespace and may or may not include `<local-command-stdout>`.
   The classifier matches loose XML-tag form; if a future Claude Code version
   changes the schema, classification falls back to `text` (graceful).
3. **Selected capsule on subagent drill-in.** `selectedInteractionId` resets
   on every entry change (D1). Tested via the reconciler.
4. **Performance.** Each capsule reads `interactionsByToolId` (a Map lookup)
   and `selectedInteractionId` (Zustand selector). Both are O(1) per row.
   Total: ~10 KB more shape on a 10k-row session vs. baseline; verify with
   a real long session.
5. **`viewMode` semantics quiet drift.** `compact` no longer means "user +
   assistant text only" — it means "hide thinking". Header tooltip needs
   updating (Phase 4 deliverable inside `TranscriptHeader.tsx`).
6. **Tests that asserted "tool-result-only" turns render a 'Tool result'
   shell.** None exist in the current suite — but if a future test relied
   on that label, the new `flatNodes` will drop the turn entirely.
