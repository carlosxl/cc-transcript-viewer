# Phase 4 — Transcript content redesign

## Goal

Re-skin every message and message-part in the transcript to match the design.
Tool calls become clickable **capsules**; results no longer render inline by
default (they move to the Inspector in Phase 5 — until then capsule click
shows nothing; that's fine). Thinking, commands, stderr, and diffs each get
their own treatment.

This is the phase where `useFlatNodes` gets simpler.

## Scope (deliverables)

1. **Role avatars + headers.** Round avatar with role tint (You / Claude),
   model + timestamp in mono.
2. **Tool capsule.** Replaces inline `ToolCallRow` expansion:
   - icon by tool (Bash → terminal, Read → code, Edit → tool, …)
   - tool name (mono bold) + truncated arg summary
   - duration on the right
   - status dot (success / fail / running) sourced from `ToolInteraction.status`
   - clicking sets the selected interaction (state stored in
     `useNavigationStore.selectedInteractionId`); Phase 5 binds the rail to it
3. **Diff block.** New inline block for `Edit`/`Write` actions consumed from
   `ToolInteraction.diff`. Same click → select pattern.
4. **Thinking row redesign.** Italic body, dashed border, "Thinking" eyebrow
   label. Respect Phase 1 `data-show-thinking` body attribute.
5. **`/command` user block.** When `m.kind === 'command'`, render mono row
   with command name + args + timestamp (per design).
6. **Stderr block.** When user-message kind is `'stderr'`, danger-tinted block.
7. **Markdown / RichText polish.** Match design's typography scale.
8. **Flat-node simplification.** With capsules always shown and results in
   the rail, the per-node array becomes one node per
   `text | capsule | diff | thinking | markdown | command | stderr`. Remove
   the view-mode branching once parity is verified.

## Out of scope

- The right-rail inspector itself (Phase 5).
- Capsule selection visual feedback beyond a border outline — the
  "scroll-and-flash on jump-back" lives in Phase 5.

## Files likely to touch

- `packages/ui/src/components/transcript/AssistantTurn.tsx`
- `packages/ui/src/components/transcript/UserTurn.tsx`
- `packages/ui/src/components/transcript/ToolCallRow.tsx` → likely rename to
  `ToolCapsule.tsx`
- `packages/ui/src/components/transcript/ToolResultRow.tsx` → probably
  deleted (results live in rail)
- `packages/ui/src/components/transcript/ThinkingRow.tsx`
- new `packages/ui/src/components/transcript/DiffBlock.tsx`
- new `packages/ui/src/components/transcript/CommandBlock.tsx`
- new `packages/ui/src/components/transcript/StderrBlock.tsx`
- `packages/ui/src/lib/flatNodes.ts` + `useFlatNodes.ts` — simplify
- `packages/ui/src/stores/useNavigationStore.ts` — `selectedInteractionId`

## Key decisions to settle in planning

- **`ToolCallRow` deletion vs. rename.** Keep `ToolCapsule` as the single
  surface; delete `ToolResultRow` only after Phase 5 lands (or stub it
  conditionally during the transition).
- **Empty-thinking handling.** Many sessions (Opus 4.7) have empty thinking
  blocks (see `README.md`). Decide: hide entirely, or render the eyebrow with
  "(no summary captured)". Match what users expect.
- **Where does selection live?** `useNavigationStore` is the natural home next
  to `drillStack`. Confirm so Phase 5 can build on it.
- **Diff payload source.** Pulled from `ToolInteraction.diff` (Phase 2). If
  Phase 2 hasn't landed, gate this deliverable.

## Acceptance criteria

- Visual diff against `workspace-app.jsx` (and the embedded mock data in
  `data.jsx`) shows parity for every part type.
- 10k-message fixture still scrolls smoothly (no measurable regression from
  baseline; record FPS or scroll-jank if you can).
- Existing transcript tests adapted to new components, all green.
- No regression in subagent drill-down rendering.
