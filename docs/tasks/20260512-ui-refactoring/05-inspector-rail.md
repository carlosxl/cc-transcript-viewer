# Phase 5 — Right rail v1: Inspector tab

## Goal

Wire the right rail (built in Phase 3 as an empty placeholder) to host a
tabbed **Inspector** for the currently-selected tool call or diff. Includes
copy-as-curl and jump-back-to-transcript. The other rail tabs (Tokens, Files)
land in Phase 6 — design the tab strip to accommodate them.

## Scope (deliverables)

1. **Rail tab strip.** Three buttons: Inspector · Tokens · Files. Tokens and
   Files render `<ComingSoon/>` placeholders this phase.
2. **InspectorEmpty state.** When nothing selected, design's empty card
   (icon, hint text, tool-name chips). Sources from `workspace-inspector.jsx`.
3. **ToolHeader.** Status pill, tool icon + name, args description, duration
   + tokens, "Jump back" button.
4. **Tab bodies.** Sourced from `ToolInteraction` (Phase 2):
   - **Call** — formatted arguments (Bash command, or JSON for others)
   - **Result** — stdout/stderr, or streaming placeholder if status=running
   - **Preview** — only for `Read` tool, syntax-highlighted file body
   - **Diff** — side-by-side from `DiffSummary`
   - **Raw** — `JSON.stringify(part, null, 2)`
5. **Copy as curl.** Best-effort formatter:
   - `Bash` → `# Bash via Claude Code\n${command}`
   - `Read` → `cat …` (with offset/limit translated to `sed`)
   - others → `# tool=… ${JSON args}`
   Copies via `navigator.clipboard`.
6. **Jump back.** Scroll the transcript to the originating capsule and flash
   it (animate outline). Reuses the existing `pendingJumpTarget` plumbing
   used by SearchPalette.
7. **Selection wiring.** `selectedInteractionId` (introduced in Phase 4) drives
   the inspector. Switching sessions clears selection.

## Out of scope

- "Re-run with edits" button shown in the design — we have no execution
  sandbox. Remove from this implementation, or stub clearly as disabled with
  a tooltip explaining why. **Recommend removing.**
- Tokens panel (Phase 6).
- Files panel (Phase 6).

## Files likely to touch

- new `packages/ui/src/components/inspector/RightRail.tsx`
- new `packages/ui/src/components/inspector/Inspector.tsx`
- new `packages/ui/src/components/inspector/ToolHeader.tsx`
- new `packages/ui/src/components/inspector/tabs/{Call,Result,Preview,Diff,Raw}Tab.tsx`
- new `packages/ui/src/components/inspector/InspectorEmpty.tsx`
- `packages/ui/src/components/layout/AppShell.tsx` — mount `RightRail` in the
  third pane.
- `packages/ui/src/components/transcript/TranscriptPane.tsx` — expose a
  scroll-to-and-flash helper for jump-back.
- `packages/ui/src/hooks/useSelectedInteraction.ts` (new) — derives
  `ToolInteraction` from `selectedInteractionId` + session data.

## Key decisions to settle in planning

- **Subagent scope.** When user is drilled into a subagent, the inspector
  shows the subagent's interactions. Confirm `useSelectedInteraction` reads
  the projection from the active query (session OR subagent).
- **Diff vs. tool-result-with-diff.** Both can be selected. Single selection
  state with a type tag (`{kind: 'tool', id}` vs `{kind: 'diff', id}`) keeps
  things explicit.
- **Streaming tool calls.** If a tool is still in-flight via live tail, the
  Result tab should show a spinner and tail-append result text. Requires
  `ToolInteraction.status = 'running'` semantics from Phase 2.
- **Default tab on selection.** Design auto-picks: `diff` for diff, `preview`
  for Read, `result` otherwise. Keep that.

## Acceptance criteria

- Clicking any tool capsule opens its details in the rail.
- Clicking a diff block opens the diff tab.
- Switching tabs preserves scroll within the rail body.
- Jump-back scrolls + flashes the source row.
- Copy-as-curl puts the right text on the clipboard.
- Rail width persists across reloads.
