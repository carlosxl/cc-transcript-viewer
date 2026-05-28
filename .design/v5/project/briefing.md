# Transcript pane — re-skin briefing (Direction A, refined)

**What this is:** specs to re-skin the transcript pane's request / block / tool_result
presentation. The conceptual model is staying the same — this is purely a
visual rebuild of `transcript.jsx` + the relevant `app.css` rules.

**Source of truth for the look:** `transcript-direction-a.html`
(+ `transcript-direction-a.jsx`, `transcript-direction-a.css`).
Open that file alongside this briefing.

---

## Conceptual model (do not regress)

- **Turn** = one user → final-assistant cycle.
- **Request** = ONE HTTP call. Renders as a vertical group anchored by an accent spine.
- **Block** = a unit inside the assistant response. Three kinds, all sit *under the request spine*:
  - `thinking` — internal reasoning
  - `text` — assistant prose
  - `tool_use` — the assistant's **call only** (tool name + input). No output here.
- **tool_result** = harness output after running a `tool_use`. Renders in the
  **HARNESS step** between requests. Edit / Write / MultiEdit `tool_result`s
  carry their diff as the result body — diffs are **never** peer blocks.

## The three visual roles (the whole point of this change)

The previous design gave YOU, REQUEST, and HARNESS the same visual grammar
(thin gray rail + tiny mono-caps caption + body). They blurred together.
Each role now has its own shape:

| Role | Shape | Rationale |
|---|---|---|
| **YOU** | Boxed quote — filled container (`var(--bg-1)`), rounded, with an accent corner mark (3×14px bar) + "You" label + right-aligned timestamp. | "External input crossing into the system." Distinct silhouette from anything below. |
| **REQUEST** | Accent spine — solid 2px `var(--accent)` rail in an 18px gutter. Holds the cap line, thinking, text, and `tool_use` lines. | The vertical "backbone" of model activity. The only continuous rail in the layout. |
| **HARNESS** | Indented step block — **no rail**, body indented `36px` from the request gutter, each result prefixed with a `↳` glyph. Closes with a quiet 18px rule + footer text. | "Side-step between requests" — visually steps out of the request spine and steps back in for the next request. |

Three different silhouettes. Even glancing at a thumbnail, you can tell what's what.

## Tokens (already in `app.css`)

Use existing vars; don't introduce new ones:

- Surfaces: `--bg-0` (page), `--bg-1` (YOU box + diff bg), `--bg-2` (diff head)
- Borders: `--border`, `--border-1`, `--border-2`
- Text: `--text-0` `--text-1` `--text-2` `--text-3` `--text-disabled`
- Accent: `--accent` (spine, YOU corner mark), `--accent-2` (call arrow), `--accent-border` + `--accent-soft` + `--accent-softer` (focus states)
- Status pills: `--green` / `--green-soft`, `--red` / `--red-soft`
- Diff: `--diff-add-bg/fg`, `--diff-del-bg/fg`
- Type: `--font-sans` (Inter) for prose, `--font-mono` (JetBrains Mono) for protocol + code

## Component-by-component spec

### Turn divider
- `font-family: var(--font-sans); font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.12em; color: var(--text-1);`
- Layout: `"Turn N" + flex hairline rule + "HH:MM:SS · N requests · $cost"` (mono, `--text-3`, 10.5px).
- Hairline rule: `flex: 1; height: 1px; background: var(--border-1);`.

### YOU — user prompt
- Container: `padding: 11px 14px 13px; background: var(--bg-1); border: 1px solid var(--border-1); border-radius: 8px;`
- Header row: 8px gap, baseline-aligned. Children:
  - **Corner mark:** `3px × 14px` block, `background: var(--accent); border-radius: 2px;`
  - **Label:** "You" in `--font-sans`, `11px`, `font-weight: 600`, `--text-0`.
  - **Timestamp:** `margin-left: auto;` mono, `10.5px`, `--text-3`.
- Body: `font-size: 14.5px; line-height: 1.55; color: var(--text-0); white-space: pre-wrap; text-wrap: pretty;`
- **Focused state (CRITICAL): layout-stable.** Only swap `border-color`, `background`, and add a `box-shadow` ring. Do not change padding, border-radius, margin, or border-width.
  - Focused: `border-color: var(--accent-border); background: var(--accent-softer); box-shadow: 0 0 0 1px var(--accent-border);`
- Hover (unfocused): `border-color: var(--border-2);`

### REQUEST envelope
- Outer: `display: grid; grid-template-columns: 18px 1fr;` — left col is the spine gutter, right col is the body.
- **Spine:** `width: 2px; background: var(--accent); border-radius: 1px; margin: 8px 0; align-self: stretch;` (vertical bar that runs the height of the request).
- **No outer border, no card background, no full-width header bar.** The spine is the only chrome.
- Body min-width: 0 (so mono captions can truncate).

#### Request cap (replaces the old chip row)
- Single wrapping mono line, `font-size: 10.5px; color: var(--text-3);`
- Order: `REQ k/n` (text-0, weight 600) `·` `req_id` (text-2) `·` `412ms TTFT` `·` `2.1s` `·` `3.2K in · 184 out` … then `$cost` pushed right via `margin-left: auto;` on the cost span, in `--text-1`, weight 500.
- Each segment span gets `white-space: nowrap` so segments break cleanly between dots, never mid-segment.
- Separator dots: `--text-disabled`.

#### Blocks inside the request body (no kind tags)

- **`thinking`** — two-col grid: tiny `"thinking"` mono label at 10px `--text-disabled` UPPERCASE letter-spacing 0.1em, 10px gap, then italic body in `--text-2` at 13px / 1.65.
- **`text`** — plain prose. `font-size: 14px; line-height: 1.6; color: var(--text-0); white-space: pre-wrap; text-wrap: pretty;`. Inline `code` keeps the existing `--bg-2` pill chip.
- **`tool_use`** — single mono line. `→` (accent-2, bold) + tool name (text-0, weight 600) + arg (text-2, ellipsis on overflow). 12px, 5px vertical padding. No box, no border.

### HARNESS step
- Container: `margin: 6px 0 0 36px;` (lives outside the request grid — same indent as request body, plus a step-in offset). No rail, no border, no background.

#### Each tool_result
- Header row: `↳` glyph (text-1, 13px, 14px wide centered) + tool name (text-0, weight 600) + arg (text-2, ellipsis) + duration (text-3, 11px) + status pill.
- Status pill: `font-size: 9.5px; padding: 1px 6px; border-radius: 99px;` — `ok` uses `--green` / `--green-soft`, `err` uses `--red` / `--red-soft`.
- **Diff body** (for Edit / Write / MultiEdit) sits *under* the header, indented `margin-left: 22px;` so it aligns under the tool name. Container: `background: var(--bg-1); border: 1px solid var(--border); border-radius: 5px;`.
  - Diff meta strip: path + `+adds` (green) + `−dels` (red), 10.5px, `--text-3`, `--bg-1`, bottom border.
  - Body uses the existing `.shared-diff-body` grid (36px line-no col, 18px marker col, 1fr source). Add/del rows tint via `--diff-add-bg/fg` and `--diff-del-bg/fg`. Hunk headers in `--bg-2` at 10px.
- **Preview body** (non-diff tools with `preview`) — `font-mono` 11px in a 7em-clipped pre with a bottom fade mask.

#### Step boundary (closes the harness band)
- A row at the bottom of the harness block: `18px × 1px` rule in `--text-disabled` + 10px gap + mono 10px caption `harness · N tools · 4.3s · fed into next request` in `--text-3`, letter-spacing 0.04em.
- That's it — no big chip, no second arrow header. Just a quiet step-out marker.

### What is GONE (removed compared to the current implementation)

- ❌ The bordered/filled `.request-envelope` card (`border + bg-1 + rounded`). Replace with bare spine.
- ❌ The `.re-head` bar with chevron + `REQUEST` label + id + pos pill + TTFT + duration + tokens + cost as separate chips. Replace with single wrapping mono cap line under the spine.
- ❌ The `"ASSISTANT RESPONSE · N blocks"` sub-label. Just don't render it.
- ❌ The kind tags on each block (`"THINKING BLOCK"`, `"TEXT BLOCK"`). Removed; type is conveyed by typography (italic = thinking, regular prose = text, mono = tool_use).
- ❌ The harness band's header chip row (`← HARNESS · ran N tool calls · 4.3s → fed into next request as input`). Replace with the bottom step-boundary footer.
- ❌ The dashed border + bg-2 chrome on `.tool-use-block`. Replace with the bare `→ Name arg` line.
- ❌ The "kind tag" / capsule chrome around each `tool_result` head. Replace with bare `↳ Name arg dur status` line.

### What is KEPT

- ✅ Existing focus/hover behavior on the user prompt (border color + background swap + box-shadow ring; layout-stable).
- ✅ Diff line renderer grid (`.shared-diff-body` in the explorations file mirrors the existing `.diff-body` grid).
- ✅ Edit/Write/MultiEdit pairing: the `tool_use` block in the request body advertises the call; the diff stays inside its paired `tool_result` body in the harness step. Never render a diff as a peer block.
- ✅ Light theme via `data-theme="light"` on `<html>`. All tokens already have light values — verify YOU box, spine, and diff still read correctly there before shipping.
- ✅ `data-comment-anchor="user-prompt"` on the user prompt node.

## Implementation notes

- File to edit: `transcript.jsx` (component structure) + `app.css` lines ~480–1020 (rules to delete or replace).
- Suggested CSS class prefix when porting: keep the existing class names (`.user-prompt`, `.request-envelope`, `.harness-step`, etc.) — just rewrite their rules. Don't introduce `.da-*` names in the production file; those are local to the spec mock.
- Markup changes:
  - Drop the `.re-head` div and `.re-body-label` div from the request envelope.
  - The "envelope" becomes the 2-col grid (spine | body). The body is essentially the old `.re-body` content minus the kind tags.
  - The harness step container loses its header row; only the result list + footer remain.

## Acceptance checks

- [ ] YOU, REQUEST, and HARNESS are visually distinct at a glance (different silhouette, not just different border colors).
- [ ] No regressions to the conceptual model: `tool_use` is in the request body, `tool_result` is in the harness step, diffs paired into Edit/Write `tool_result` bodies.
- [ ] User-prompt focus toggle does NOT shift layout (test with focused/unfocused side-by-side — same outer rect).
- [ ] Light theme renders cleanly (YOU box still reads as a quote, spine still legible).
- [ ] Vertical rhythm: blocks inside a request have ~10px between them, not the choppy 14–18px the old chrome forced.
- [ ] Long tool args truncate (ellipsis) instead of pushing the cap row wider.
- [ ] Request cap wraps gracefully on narrow widths (each `· segment ·` is `white-space: nowrap`).

---

**Reference files in this project**

- `transcript-direction-a.html` — fully rendered preview (open this first).
- `transcript-direction-a.jsx` — the React components for the refined view.
- `transcript-direction-a.css` — all the rules. Port these into `app.css`, renaming `.da-*` → the existing class names where applicable.
- `explorations-shared.jsx` — helper utilities (`fmtCost`, `fmtDur`, `toolArg`, `splitRequest`, `DiffLines`, `renderInline`, `isWriteTool`). Already overlap heavily with what's in `transcript.jsx`.
- `transcript-explorations.html` — original three-way canvas (A / B / C) for context on what was rejected.
