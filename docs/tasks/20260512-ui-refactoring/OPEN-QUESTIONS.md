# Open questions — cross-cutting

Things the design either doesn't address or pre-assumes capabilities we don't
have. Surface to the user (or settle in the relevant phase's plan) before
implementation.

## 1. Empty thinking blocks

The repo `README.md` documents that sessions from Claude Code 2.1.69+ on
Opus 4.7 store thinking blocks with empty text. The design shows rich
thinking blocks. **Decide:** hide empty thinking entirely, or render the
eyebrow with "(no summary captured — see README)". Land this in Phase 4.

*Answer:* Just show a generic message showing that no thinking summary was captured,
follow the github issue for details: https://github.com/anthropics/claude-code/issues/30958

## 2. "Re-run with edits" button

`workspace-inspector.jsx` has a Re-run button next to Copy-as-curl. We have
no execution sandbox and no plan to add one. **Recommend removing**, not
stubbing. Confirm in Phase 5.

*Answer:* Remove the button. The feature is out of scope.

## 3. Live-tailing semantics for in-flight tool calls

Today's parser emits a `Turn` only when the JSONL row is complete. The design
assumes streaming visibility: a `running` tool capsule with a spinner whose
Result tab tails as bytes arrive. **Decide:**
- Option A — accept the limitation: capsule appears with `status='running'`
  only between the tool_use being written and its result row appearing.
- Option B — extend `IncrementalReader` to emit partial tool state events
  via the SSE channel.
Option A is the minimum and matches "first ship, then polish". Settle in
Phase 2 (status semantics in `ToolInteraction`) and Phase 5 (UI behavior).

*Answer:* Option A. We can iterate on the UX later if needed.

## 4. Subagent scoping for the right rail

When the user drills into a subagent, the Inspector / Tokens / Files
panels should reflect the **subagent's** projection, not the parent
session. This is doable but requires:
- Projections computed for `SubagentDetailResponse` as well (Phase 2).
- `useSelectedInteraction` / `useFileTouchIndex` etc. read from the active
  query (subagent if drilled, session otherwise) — same pattern
  `TranscriptPane` already uses for `activeQuery`.

*Answer:* Yes, this is the right behavior. The right rail should always
 reflect the context of the currently selected interaction, 
 whether it's a parent session or a subagent.

## 5. Performance ceilings

The 10k-message budget bites in three places:
- **Minimap** at one bar per message — 10000 DOM rects. Downsample beyond
  ~2000.
- **Inspector Preview** for large `Read` results (>5MB output). Need a
  size guard + "View raw" fallback.
- **TokensChart sparkline** with 10000 bars — also downsample.
Phase 8 catches the minimap; Phase 5 catches Preview; Phase 6 catches
TokensChart. Note in each plan.

*Answer:* Yes, we should implement these performance optimizations as outlined.

## 6. Pin/star storage tier

`localStorage` is fine for v1 (per-browser). If the same user opens the
viewer in multiple browsers, pins won't sync. The product probably doesn't
care, but flag it before Phase 7 ships.

*Answer:* For v1, we'll use `localStorage` for pin/star state. 
We can consider a more robust storage solution in the future if 
cross-browser sync becomes a requirement.

## 7. Copy-as-curl honesty

The label is a misnomer — for most tools we emit a shell command or a JSON
blob, not a curl invocation. Two options: rename the button to "Copy
command", or keep the label per design and accept the looseness. Settle in
Phase 5.

*Answer:* Let's rename the button to "Copy command" to better reflect its
functionality and avoid confusion.

## 8. Search "Files" filter wiring

The design's Files filter searches over file paths touched by tool calls.
The existing FTS5 index stores `tool_use` content as JSON — depending on
schema, the search may or may not surface file paths directly. **Verify in
Phase 7** whether a server-side extension to index file paths separately
is needed.

*Answer:* We should verify the current schema of the FTS5 index to see if it allows for efficient searching of file paths. If not, we may need to extend the index to include file paths as a separate field for better search performance.

## 9. Star button in two places

Pin/star is shown both in the sidebar row and in the transcript header.
Two surfaces, one state — must stay in sync. `useUIStore` slice resolves
this; trivial to get wrong if anyone introduces a local component state.
Note in Phase 7.

*Answer:* We will ensure that the pin/star state is managed centrally in the `useUIStore` slice to keep it consistent across both the sidebar row and the transcript header. We'll also add comments in the code to warn future developers about this shared state to prevent accidental desynchronization.

## 10. Accessibility for color-only signals

Status dots (success / fail / running) and role rails are color-only in
the design. Add icon or text affordance for screen readers and color-blind
users. Phase 8 a11y pass.

*Answer:* We will add ARIA labels to the status dots and role rails to ensure that screen readers can convey the necessary information. Additionally, we can consider adding icons or patterns to differentiate statuses for color-blind users. This will be part of our Phase 8 accessibility improvements.

## 11. The "Tweaks panel" from `tweaks-panel.jsx`

This is a dev-only Claude Design control surface, NOT a feature to ship.
The actual user-facing controls are theme, density, and serif-titles, and
those go in a small settings popover or stay as keyboard-only toggles.
Phase 1 explicitly excludes it.

*Answer:* Yes, we can remove the "Tweaks panel" entirely.

## 12. Search hit highlight in the transcript

After Cmd-K → pick a result, current code scrolls to the turn but doesn't
highlight the matched span within the message body. Design doesn't address
this explicitly. **Recommend** a transient highlight (same flash treatment
as jump-back) on the originating part. Could land in Phase 5 (when the
scroll-and-flash helper is generalized) or Phase 7 (search redesign).

*Answer:* Implementing a transient highlight for search hits would enhance the user experience by making it easier to locate the relevant information in the transcript. We can plan to add this feature in Phase 5 when we generalize the scroll-and-flash helper, ensuring that it works seamlessly with the existing navigation features.
