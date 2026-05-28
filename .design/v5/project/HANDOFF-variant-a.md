# Transcript Pane — Variant A (Quieter chrome)

**Status:** Finalized direction. Ship this.
**Reference file:** `transcript-explorations.html` → artboard `a-quiet`
**Source of truth:** `variant-a-quiet.jsx` + the `.variant-a` rules in `explorations.css`

---

## 1. Design intent

A single transcript view that lays out user prompts, assistant requests, and harness (tool) traffic as one continuous, typographic document — no nested cards, no per-block kind tags. Hierarchy comes from **rails on the left** and **one small-caps caption per envelope**. The diff and tool calls do the talking.

Three envelope types, all 16px-grid-aligned, all 2px rails:

| Envelope | Rail | Caption color |
|---|---|---|
| **YOU** (user prompt) | 2px solid `#e8b96a` (amber) | `--text-3` |
| **REQ** (assistant request) | 2px solid `--accent` @ 0.85 opacity | `--text-3` |
| **HARNESS** (tool results) | 2px **dashed** `--text-disabled` | `--text-2` |

Color does the differentiation; weight and typography stay identical so the eye reads them as siblings, not as a hierarchy of importance.

---

## 2. What changed from the previous iteration

1. **YOU rail color** — finalized as `#e8b96a` (amber). Distinct from REQ (blue accent) and HARNESS (gray), and doesn't collide with the semantic green/red used elsewhere in the app.
2. **YOU caption** — now matches REQ/HARNESS caption style exactly: mono, 10.5px, normal weight, `letter-spacing: 0.04em`, `--text-3`. Previously was uppercase / 600 / violet — broke the "everything is a sibling" rule.
3. **All three rails are 2px** — earlier YOU was 4px with a node dot. Equal weight reads cleaner.

---

## 3. Tokens used (no new tokens introduced)

From `app.css`:
- `--accent` — REQ rail
- `--text-0` `--text-1` `--text-2` `--text-3` `--text-disabled` — text + harness rail + dots
- `--border-1` — turn divider line
- `--bg-0` `--bg-1` `--bg-2` — surfaces
- `--font-mono` — captions, tool args, durations

**One new literal:** `#e8b96a` for the YOU rail. Promote this to a token (suggested name: `--user-accent`) when wiring into the real app — keep it out of the semantic ramp.

---

## 4. Tweakable controls (in the explorations file)

The Tweaks panel exposes four knobs for Variant A. Defaults below are the shipped values:

| Key | Default | Notes |
|---|---|---|
| `userRailColor` | `#e8b96a` | Curated swatches: amber, violet, blue, green, neutral. **Ship amber.** |
| `harnessRailStyle` | `dashed` | dashed / solid / dotted. **Ship dashed.** |
| `showThinking` | `true` | Toggles `.va-think` blocks. Real app should respect a user preference here. |
| `compact` | `false` | Tightens vertical rhythm ~30%. **Ship the non-compact default**; expose as a user setting. |

Wiring lives in `explorations-main.jsx` (EDITMODE block) and `.variant-a[data-tw-*]` rules in `explorations.css`.

---

## 5. Implementation notes for code

- **Component boundaries:** `VA_UserPrompt`, `VA_Request` (which internally splits into request body + harness body via `splitRequest`), `VA_Block`, `VA_Result`. Keep these names or map 1:1.
- **Grid:** every envelope is `grid-template-columns: 16px 1fr`. The 16px column is the rail gutter. Don't change this — it's load-bearing for vertical alignment between YOU / REQ / HARNESS.
- **Rails stretch via `align-self: stretch` on the rail div** so they grow with the body. Don't switch to `border-left` on the body — it breaks the gutter math.
- **`.va-rail-har` uses `border-left` instead of `background`** because that's how you get the dashed pattern. Keep `width: 0`.
- **Captions are `white-space: nowrap` + `overflow: hidden` + `text-overflow: ellipsis`.** They will get long when request metadata grows; truncation is intentional.
- **No icons in captions.** The dot separators are 2px `border-radius: 99px` divs. Don't replace with `·` characters — alignment will drift across fonts.

---

## 6. Open questions for the code agent

1. **Real telemetry source** — captions currently render from `getSlice()` stub data (TTFT, duration, tokens, cost). Wire to the actual request metadata shape.
2. **`renderInline` + `DiffLines`** are imported from `explorations-shared.jsx`. Check the real app has equivalents or port them.
3. **`--user-accent` token** — propose adding to the design system before this lands, so the YOU color isn't a hardcoded literal in the component.
4. **Long requests** — what's the max plausible request body height? Variant A has no internal scroll; the whole transcript scrolls as one document. Confirm that's still right at scale.
5. **Empty harness** — when a request has zero tool calls, the HARNESS envelope is omitted entirely. Confirm that matches the desired empty state.

---

## 7. Files to read

- `variant-a-quiet.jsx` — component structure
- `explorations.css` lines ~40–250 (`.variant-a` block) — all styling
- `explorations-shared.jsx` — `splitRequest`, `renderInline`, `DiffLines`, `fmtDur`, `fmtCost`, `fmtK`, `getSlice`
- `explorations-main.jsx` — Tweaks wiring + defaults
