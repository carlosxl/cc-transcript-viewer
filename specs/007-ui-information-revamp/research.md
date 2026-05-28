# Phase 0 — Research

Resolves the open questions the spec deferred to the plan. Each entry follows the format: **Decision / Rationale / Alternatives considered**.

---

## R1. Turn grouping key (FR-008)

**Decision**: Two-level grouping. Outer Turn keyed by `promptId`. Inner Request keyed by `requestId` (falling back to `message.id` for older rows pre-dating `requestId`).

**Rationale**:
- The current UI already operates in this two-level shape (`SessionTurn` containing `Request[]` in `packages/ui/src/hooks/useSessionView.ts:280-303`). Re-using it minimises blast radius for Chunk A.
- `packages/shared/src/jsonl/README.md` §2.3 (line 116) explicitly identifies these as the two valid groupings.
- Usage de-duplication (FR-015) lands naturally on the inner key — rows sharing a `message.id` are all in the same Request and contribute their `UsageBlock` exactly once when summed by inner key.
- A single user submission can produce many Requests (e.g., a long agentic loop with multiple LLM calls). Conflating them into one outer level loses the "per-LLM-call" decomposition that Audit (US3) needs for cache-hit accounting.

**Alternatives considered**:
- **Flat list of rows, no grouping.** Rejected: forces every UI element to reconstruct turn boundaries; conflicts with FR-009 (attachments attributed to a submission) and the existing `SessionTurn` shape.
- **Single-level by `promptId` only.** Rejected: hides the per-Request usage split needed for cache-hit display (FR-016, SC-005).
- **Single-level by `requestId` only.** Rejected: an attachment that arrives with a user submission would have no Request to attach to before any assistant row exists; this also loses the user's mental model of "what I asked, what came back."

---

## R2. Canonical sticky-state event set (FR-027)

**Decision**: The canonical sticky set consists of:

| Sticky field | Source | Carry-forward rule |
|---|---|---|
| `permissionMode` | `permission-mode` row (`packages/server/src/jsonl/schema.ts:993`); plus `attachment` subtypes `plan_mode` / `plan_mode_exit` / `plan_mode_reentry` / `auto_mode` / `auto_mode_exit` (`schema.ts:699-734`) | Last preceding value wins |
| `model` | `assistant.message.model` field on each `assistant` row | Last preceding value wins |
| `worktreeState` | `worktree-state` row (`schema.ts:1021`) | Last preceding value wins; `null` is a valid value meaning "not in a worktree" |
| `planMode` | `attachment` subtypes `plan_mode` / `plan_mode_exit` / `plan_mode_reentry` | Boolean derived from the most recent of these |
| `autoMode` | `attachment` subtypes `auto_mode` / `auto_mode_exit` | Boolean derived from the most recent of these |

**Rationale**: These are the values a user looking at any individual Turn needs to understand "what configuration was the harness in when this turn ran?" — the question the spec's Q2 refinement was answering. The set is small (5 fields) and each has a clear "last-write-wins" semantic.

**Forward-compat rule for adding to the set**: a new schema row variant joins the sticky set only if it semantically represents *durable state that affects the interpretation of subsequent rows*. Ephemeral events (queue operations, away summaries, single-prompt task reminders) stay inline-only. When in doubt, leave it inline.

**Alternatives considered**:
- **Treat every session-state row as sticky.** Rejected: `queue-operation`, `pr-link`, `file-history-snapshot` are point-in-time events, not state. Carrying them forward would falsely suggest persistence.
- **Compute stickiness lazily per Turn instead of one upfront pass.** Rejected: requires a backwards walk from each Turn, O(n²). The upfront pass is O(n) and produces a tiny `Map<turnId, StickyState>`.

---

## R3. Default disclosure level on session open

**Decision**: Ship with `recall` as the initial value of `defaultDisclosureLevel`. Three modes defined:

| Mode | Default expansion behavior |
|---|---|
| `recall` | All Turns collapsed. Sticky badges visible. Final-message snippet and tool-summary status visible per FR (US1 acceptance scenario 2). |
| `learn` | All Turns expanded one level (Requests visible, blocks visible, tool details collapsed). Attachments visible. System events visible. |
| `audit` | All Turns collapsed. Sticky badges visible. Session-summary surface auto-opened. Inline state changes and api_error retry chains visible. |

**Rationale**:
- P1 (Recall) is the dominant user job per the spec; the initial view should serve it.
- The other two modes are toggles the user opts into when their task shifts.
- All three modes use the same flat-row builder + filters; no special-casing per mode.

**Alternatives considered**:
- **Single mode, no toggle.** Rejected: forces every user to scroll through detail they don't need (Recall) or to expand every Turn to see what they want (Learn). The spec explicitly endorses progressive disclosure (FR-019).
- **User-selectable default persisted globally.** Already supported by the store shape; user changes the value, it's persisted via localStorage.

---

## R4. Search index scope expansion (FR-018, §8)

**Decision**: Extend FTS5 indexing in `packages/server/src/search/search-index.ts` to cover:

| Source | Indexed text |
|---|---|
| User prompt | Already indexed today; unchanged |
| Assistant text + thinking blocks | Already indexed today; unchanged |
| Tool inputs (`tool_use.input`) | NEW — JSON-stringified for indexing only; rendered separately |
| Tool result LLM-visible content | NEW — text content only |
| Attachment payload text fields | NEW — type-specific salient field per attachment subtype (file paths from `directory`/`file`, hook stdout, goal_status text, task_reminder text, etc.) |
| System event subtype + message | NEW — `api_error` messages especially |
| Structured sidecar headlines | NEW — file paths from `EditResult`, error messages from `BashResult`, query from `WebSearchResult`, prompt from `AgentLaunchResult` |

**Excluded** (intentionally): full sidecar bodies (large, low findability gain), base64 image data, file-history backup blob contents.

**Rationale**: Search is one of the two main navigation affordances (FR-018). The current narrow scope (prompts + assistant text) misses tool-driven activity which is exactly what Learn/Audit users want to find. Indexing tool inputs catches "find every Bash that touched X"; indexing attachment payloads catches "find that hook failure"; indexing sidecar headlines catches file edits without bloating the index.

**Index size estimate**: trigram tokenizer (per `CLAUDE.md`) inflates index size ~5×. Current corpus ~150 MB JSONL → indexed text estimated ~30 MB → trigram index ~150 MB. Acceptable for a local cache.

**Alternatives considered**:
- **Index everything including sidecar bodies.** Rejected: massive index for small findability gain.
- **Skip the expansion, rely on prompt search only.** Rejected: would fail the spec's implicit search-utility for L/A jobs.
- **Switch to a different search engine.** Rejected — locked stack (Constitution Principle III + V).

---

## R5. Subagent presentation pattern (FR-011)

**Decision**: **Inline drill-in (separate route within the SPA, back-button preserves parent scroll).** The subagent transcript replaces the parent transcript view; a breadcrumb / back affordance returns. The parent's `focusedTurnId` is preserved in the Zustand store so returning scrolls back to that Turn.

**Rationale**:
- Current implementation already has a subagent endpoint and a viewer (`/api/sessions/:id/subagents/:agentId` + the SubagentDetailResponse path in `useSessionView`). Reuse.
- A side-panel approach would conflict with FR-022 (single virtualised scroll — a panel would need its own scroll container at scale).
- An inline-tree approach (subagent rows interleaved into the parent transcript) would blow up the flat-row count and break the "subagent has its own usage / cost" accounting.

**Alternatives considered**:
- **Side panel with independent scroll.** Rejected per FR-022.
- **Inline expansion into parent transcript.** Rejected — confuses parent/child accounting and inflates the flat array.
- **Pop-out window.** Rejected — adds platform complexity for negligible gain.

---

## R6. Image rendering policy (FR-006)

**Decision**:
- Inline base64 images ≤256 KB: rendered as a thumbnail (max 240px on long edge) inline in the timeline, with click-to-expand to full size in an overlay.
- Inline base64 images >256 KB: rendered as a clickable card showing the image's metadata (type, size) only; full image fetched on click.
- Tool-result images and Bash-stdout images (`isImage: true` per `schema.ts:298`): same rules.

**Rationale**: First-viewport render time (FR-021 cold-start) must not be dominated by image decode. Most images in tool outputs are screenshots, small. Large pasted images are rare but exist. The 256 KB threshold is a reasonable line between "harmless to inline" and "should be lazy."

**Alternatives considered**:
- **Always lazy.** Rejected: small icons / screenshots add value when visible at-a-glance.
- **Always inline.** Rejected: blows up first-viewport time on prompts with multiple pasted screenshots.

---

## R7. Sticky-state projection — live-tail update strategy

**Decision**: The sticky-state `Map<turnId, StickyState>` is rebuilt incrementally on live-tail. When the live-tail emits new rows, the projection's tail state (the running last-seen values for each sticky field) is reused; new Turns receive the carry-forward Map entry without a full re-pass.

**Rationale**: Constitution Principle II (Scale by Default) + spec FR-025 (live-tail parity) require this projection to update without re-projecting the whole session. Storing the running tail state alongside the Map keeps the live-tail update O(new rows), not O(total rows).

**Implementation note**: the running state lives in the Zustand slice as a private `stickyStateTail` field, mutated only by the projection helper. The `Map<turnId, StickyState>` is the read-only output the UI consumes.

---

## R8. Tool result sidecar rendering — "always vs. expandable"

**Decision**:
- The LLM-visible payload remains the default-visible content when a tool result is expanded.
- The structured sidecar appears as a sibling tab (or accordion section) on the same expanded view — clearly labelled, but the user takes one click to switch.
- For `AgentRollupResult` specifically, the rollup summary (durations, totals, toolStats) renders on the **parent's tool_use line collapsed** as a small chip (because FR-012 mandates it visible without drill-in), and the full rollup detail appears in the expanded view.

**Rationale**:
- The LLM-visible payload is what most users will look at first — it's the chat-like default.
- The structured sidecar is the learning win — surfaced visibly, but doesn't crowd Recall users.
- AgentRollup is special because the user needs the at-a-glance subagent summary before deciding whether to drill in.

**Alternatives considered**:
- **Show sidecar by default, LLM payload behind tab.** Rejected: regresses the chat-style Recall experience.
- **Show both side-by-side always.** Rejected: doubles vertical space per tool result; bad for skim.

---

## R9. Acceptance test fixtures

**Decision**: Build a fixture set under `packages/server/src/reader/__fixtures__/` covering:

1. One full session per major row-shape coverage need (synthetic + scrubbed real corpus samples).
2. One "all 22 attachment subtypes" mini-session.
3. One "all 17 toolUseResult variants" mini-session.
4. One "subagent + nested subagent" session.
5. One "api_error retry chain" session.
6. One "permission-mode transitions + worktree change + model switch" session for sticky-state testing.
7. One "synthetic UnknownRow" session for FR-007 / SC-009.
8. One "145 MB scale" session (truncated from the validation corpus) for performance baselining.

These feed both server tests (parser/normalizer) and UI tests (projection + flat-row builder).

**Rationale**: The spec's success criteria (especially SC-001 schema coverage and SC-009 unknown-row) can only be verified against fixtures that exercise every variant.

---

## R10. CLAUDE.md update

**Decision**: Update the SPECKIT pointer in `CLAUDE.md` lines 172-176 to reference `specs/007-ui-information-revamp/plan.md` so future Claude Code sessions in this repo find the in-flight plan.

**Rationale**: The constitution names `CLAUDE.md` as the runtime guidance file and requires it to stay in sync with the active plan.

---

## Deferred to design brief (`.design/v6-brief.md`)

These are intentionally not researched here — visual decisions:

- Mode-toggle UI affordance (segmented control vs. dropdown vs. shortcut).
- Visual treatment of sticky badges (chips vs. icons vs. inline text).
- Layout of the session-summary surface (modal vs. side rail vs. dedicated page).
- Visual rhythm between Turns (separators, spacing, hover states).
- Color palette for the 6 system event subtypes.
