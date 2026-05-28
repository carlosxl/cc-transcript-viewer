# Design brief — cc-transcript-viewer v6

**For:** Claude Design (claude.ai/design)
**From:** cc-transcript-viewer maintainer
**Status:** Open brief — generate concepts; nothing is locked.

> Read this top to bottom. The schema-driven data inventory in §4 is the load-bearing section — most viewers of this kind of data under-render the JSONL because they only show what the LLM saw, not what the harness around the LLM recorded. We now have a fully-typed view of **+60% more data per session** than the LLM-visible surface. Design the UI for that wider surface.

---

## 1. The product in one sentence

A local web viewer for Claude Code session transcripts (JSONL files written under `~/.claude/projects/`) that makes a 10,000-message session **navigable, intelligible, and auditable** — and exposes everything Claude Code recorded, not just the text the LLM saw.

---

## 2. Three user jobs (in priority order)

Design for all three, but resolve conflicts in favor of the earlier one.

### 2.1 Recall — "what happened in that session?"

User opens a past session looking for one specific thing. They remember roughly when it happened, or what they were doing.

> *"Where did we land on the auth rewrite? I had a session yesterday afternoon."*
> *"Did Claude actually run the migration, or did it just say it did?"*
> *"What was that file I asked it to read? The big one."*

**Design implications:**
- Conversation flow must be **scannable**. Skimming a 10k-row session at 60fps needs to be possible.
- User prompts are the anchors — they're where humans navigate from.
- Outcomes (did the edit land? did the bash succeed?) must be visible without expanding.
- Search and "jump to next prompt" matter more than chronological detail.

### 2.2 Learning — "how does Claude Code actually work?"

User is studying Claude Code itself: how prompts get assembled, what the agent sees vs. what the LLM sees, when subagents fire, how hooks intercept tools, what context auto-mode injects.

> *"What did the system inject when I entered plan mode?"*
> *"How big was the prompt when this turn started? What was cached?"*
> *"What did the subagent see as its kickoff prompt?"*

**Design implications:**
- The **meta-mechanism layer** must be discoverable, not hidden. Attachments, hook events, mode transitions, skill catalogues, deferred-tool deltas, MCP instruction changes — these are first-class content, not chrome.
- The "LLM-visible vs. harness-only" distinction must be representable. `tool_result.content` (what the LLM saw as text) and `toolUseResult` (the structured sidecar Claude Code kept) are different things and a learner needs both, side by side.
- Subagent traffic should be drillable from the parent — the parent's `Agent` tool_use carries a rollup; clicking it should open the subagent's own transcript.

### 2.3 Audit — "did anything go wrong here? what did it cost?"

User is reviewing a session for correctness, safety, or cost. They want hard numbers and an exception view.

> *"How many tokens did this session burn? What was the cache hit rate?"*
> *"Did any hooks block? Did any API calls error and retry?"*
> *"Did Claude touch files outside the repo?"*
> *"What permissions got granted? When?"*

**Design implications:**
- Per-turn and per-session **token accounting** (input, output, cache_creation, cache_read, by model) must be surfaceable.
- **Failure modes** (api_error rows, hook_blocking_error attachments, tool_result `is_error: true`, persisted-output offloads) need a "show me only this" affordance.
- **State transitions** (permission-mode changes, worktree enter/exit, plan-mode enter/exit, auto-mode enter/exit, command_permissions grants) form an audit timeline that's worth surfacing as its own view.
- Cost and duration come from `turn_duration` system rows and `UsageBlock` on every assistant row.

---

## 3. What we are NOT redesigning

- **CLI / launch flow** — out of scope.
- **Session list / sidebar** — out of scope unless your concept fundamentally needs to change it. Sidebar exists, lists sessions by recency, supports search.
- **Live tailing UX** — the SSE pipe exists. New rows append; design for the appended state but don't redesign the "active session" indicator unless needed.
- **Visual identity** — propose your own type scale and palette. Constraints: dark-mode-first with a working light variant; neutral surfaces (no strong brand color dominating); monospace for code, durations, and token counts; sans for prose. Use semantic green/red sparingly — reserve them for diff add/remove and success/failure signals.

---

## 4. The data — what we now know is in a JSONL session

Until v6, the UI rendered roughly the same surface a chat client would: user said X, assistant replied Y, tool ran Z. The new schema (`packages/server/src/jsonl/schema.ts`) exposes a vastly wider surface. Below is the **complete inventory** you should consider when designing. Treat each as "something the UI should be able to reveal," not "something that must always be visible."

### 4.1 Five top-level row kinds

| Kind | What it is | Volume (180-session corpus) |
|---|---|---|
| `user` | Human prompt, slash-command meta, OR tool_result reply | 12,492 rows |
| `assistant` | One row per LLM content block (text / thinking / tool_use) | 17,591 rows |
| `attachment` | Context block riding alongside a prompt (22 variants — see §4.4) | 2,069 rows |
| `system` | Claude-Code-emitted event (errors, durations, hook summaries) | 1,538 rows |
| `session-state` | Fold-to-last-value snapshots (title, mode, worktree, PR, last prompt, …) | ~7,000 rows across 9 types |

### 4.2 Grouping rules — what is "a turn"?

Two valid groupings; the UI should let the user think in **prompt-level units** while still being able to see message-level granularity:

- **`promptId`** — every row generated by one user submission. The natural unit for an outline / table-of-contents view.
- **`message.id` / `requestId`** — every row from one LLM call. One LLM message may emit multiple top-level rows (text + thinking + tool_use, etc.) sharing the same `message.id`. Useful for "show me the actual model output as it was emitted."

### 4.3 The big-data-gap reveal: `toolUseResult`

Every tool reply carries TWO parallel views:
- `message.content[0].content` — the **string the LLM saw** as the tool's output.
- `toolUseResult` — a **typed structured sidecar** the LLM did NOT see. Includes:
  - `structuredPatch` (unified-diff hunks for Edit/Write)
  - `BashResult` (stdout/stderr split, exit code interpretation, `isImage` flag, persisted-output paths)
  - `AgentRollupResult` (subagent total duration, total tokens, total tool calls, toolStats: reads/searches/bashes/edits/linesAdded/linesRemoved)
  - `AskUserQuestionResult` (questions AND user's answers — the only place this is recorded)
  - `ExitPlanResult` (the markdown plan + file path)
  - `TaskListResult`, `TaskCreateResult`, `TaskUpdateResult` (TODO transitions)
  - `WebSearchResult`, `WebFetchResult` (queries, URLs, durations, HTTP codes)
  - `ToolSearchResult` (deferred-tool lookups)
  - … 18 typed shapes total.

**Across the corpus: 23 MB of `tool_result.content` strings vs. 37 MB of `toolUseResult` sidecar data.** Most existing viewers show the 23 MB and discard the 37 MB. **This is the single biggest opportunity for v6.**

Design implications:
- A tool-result row should be able to **show both views** — the LLM-visible string AND the structured sidecar. Default to the rich one; let users flip to "what the LLM actually saw" for debugging prompt engineering.
- Edit/Write diffs should render as real diffs (from `structuredPatch.lines` — already prefixed with ` `/`+`/`-`), not as raw strings.
- Subagent dispatches (`Agent` tool_use) should reveal the rollup numbers (totalDurationMs, totalTokens, toolStats) on the result card AND link into the subagent's own JSONL file.

### 4.4 Attachments — 22 typed payload shapes

These ride alongside a user prompt and carry the **meta-context** the LLM saw. They're invisible in chat-style viewers. They are exactly the surface a **Learning** user wants. Variants:

| Group | Variants |
|---|---|
| TODO state | `task_reminder` (full task list snapshot at this point) |
| Skills/tools | `skill_listing`, `deferred_tools_delta` (added/removed/readded), `mcp_instructions_delta`, `command_permissions` (allowedTools list) |
| Modes | `auto_mode`, `auto_mode_exit`, `plan_mode`, `plan_mode_exit`, `plan_mode_reentry`, `ultrathink_effort` |
| File mentions | `directory` (@folder listing), `file` (@file contents), `edited_text_file` (user edited a file mid-session), `nested_memory` (CLAUDE.md pulled in) |
| Background tasks | `queued_command` |
| Calendar | `date_change` (UTC midnight rollover) |
| Hooks | `hook_success`, `hook_blocking_error`, `hook_non_blocking_error`, `hook_cancelled` (with hookEvent, hookName, toolUseID, stdout/stderr, exit code) |
| Goals | `goal_status` (condition, met, reason, iterations, durationMs, tokens) |

Design implications:
- Don't treat these as "system noise." Treat them as small, typed cards inline in the transcript flow. The `Learning` user is reading the transcript specifically TO see these.
- A "show meta-context" toggle is probably valuable — `Recall` users don't always want them, `Learning` users always do.
- Hook events have a strong "this thing intercepted that thing" relationship via `toolUseID`. Worth visualizing as a relationship, not just a flat list.

### 4.5 System rows — 6 subtypes

Claude-Code-emitted events (NOT model output):

| Subtype | Fields | Audit value |
|---|---|---|
| `turn_duration` | `durationMs`, `messageCount` | "this turn took 21 minutes / 348 messages" |
| `stop_hook_summary` | `hookCount`, `hookInfos[]`, `hookErrors[]`, `preventedContinuation`, `stopReason` | Which hooks ran on Stop, what they took, whether they blocked |
| `away_summary` | `content` (LLM-generated paragraph summary) | "what happened while I was AFK" |
| `local_command` | `content` (wraps `<local-command-stdout>` etc.) | Slash command output |
| `api_error` | `error` (full Anthropic HTTP error), `maxRetries`, `retryAttempt`, `retryInMs` | API failures and retry behaviour |
| `informational` | `content`, `level` | Misc warnings ("Unknown command: /…") |

Design implications:
- `turn_duration` is a natural "turn complete" marker — could be a typographic flourish at the bottom of each turn group.
- `api_error` is the most under-served event in current viewers; should be a clear, attention-getting card with retry chain visualized.
- `stop_hook_summary` is the "what just happened at the end of this turn" record — possibly belongs in a turn footer.

### 4.6 Session-state rows — fold-to-last-value

Nine row types that re-emit on every state change. The UI should fold them: only show the latest value, but the **history** is itself interesting.

| State | Why it matters |
|---|---|
| `ai-title` / `custom-title` / `agent-name` | Session identity (header) |
| `permission-mode` | Audit timeline: `auto` → `plan` → `acceptEdits` → `default` transitions |
| `last-prompt` + `leafUuid` | Resume points |
| `worktree-state` | Where this session was operating (original cwd + worktree path + branch) |
| `pr-link` | Was a PR opened? (often the session's outcome) |
| `queue-operation` | Background-task lifecycle (`enqueue`/`dequeue`/`remove`/`popAll`) |
| `file-history-snapshot` | Index of every file Claude Code backed up during the session; backups are addressable on disk |

Design implications:
- A **session header / metadata panel** is the natural home: title, branch, cwd, current permission mode, PR link, worktree state, total tokens, total duration.
- A **state-transitions timeline** view (audit lens) could expose the permission-mode and mode-attachment history as a thin chronological strip — great for §2.3 audit.
- File-history snapshots map to disk files at `~/.claude/file-history/<sessionId>/<backupFileName>`. We could let the user diff any tracked file against any prior backup version — but only if it doesn't conflict with the simpler "show the structured patch for each edit" view. (Open question for design — see §6.)

### 4.7 Usage / cost

Every assistant row has a `UsageBlock`:

```
{
  input_tokens, output_tokens,
  cache_creation_input_tokens, cache_read_input_tokens,
  cache_creation: { ephemeral_1h_input_tokens, ephemeral_5m_input_tokens },
  server_tool_use: { web_search_requests, web_fetch_requests },
  service_tier, speed, ...
}
```

**Critical gotcha:** when one LLM message produces N content blocks, Claude Code emits N rows with the SAME `message.id`, SAME `requestId`, SAME `usage`. **Do not sum usage across those rows** — they're duplicates. Group by `message.id` first, then take one usage block per group.

Design implications:
- Per-prompt token total (sum of grouped-usage across all assistant message-groups in that promptId).
- Per-session totals (header).
- Cache hit rate is a one-glance signal of session efficiency — surface it.

### 4.8 Subagent files

Subagents have their own JSONL files at `<sessionId>/subagents/agent-<agentId>.jsonl` plus a meta sidecar `agent-<agentId>.meta.json` (`{agentType, description?, worktreePath?}`).

Differences from main file rows:
- Every row has `isSidechain: true` and `agentId`.
- Assistant rows additionally carry `attributionAgent` (the agent type, e.g. `"Explore"`).
- Subagent transcripts **do not carry the structured `toolUseResult` sidecar** — only the parent's `AgentRollupResult` has it.
- First row's `parentUuid` is `null`. The kickoff prompt is in the parent's `Agent` `tool_use.input.prompt` AND in `toolUseResult.prompt`.

Design implications:
- Subagent rollup (in the parent) is the entry point.
- Drilling in opens the subagent's transcript — same UI, same rendering rules, but visually scoped/indented/breadcrumbed so the user knows where they are.
- Common subagent types in the corpus: `Explore` (135), `general-purpose` (93), `claude-code-guide` (28), `Plan` (6). These could have type-specific accent colors / icons.

### 4.9 Images

Three distinct paths images appear (all observed):
1. **User pasted/dragged**: inline `image` block in `user.message.content`, with a `[Image #N]` placeholder in the text block (1-indexed).
2. **Tool returned image** (chrome-devtools screenshots, MCP image returns): nested inside `tool_result.content` array.
3. **Bash output that's an image**: `toolUseResult.isImage = true`, base64 in `stdout`.

Sizes can be hundreds of KB each, many MB per session — **must lazy-load**.

### 4.10 Off-loaded tool outputs

When a tool returns more than the inline token cap, Claude Code writes it to `<sessionId>/tool-results/<stem>.txt` and replaces the inline `tool_result.content` with an error-style placeholder. The path is also in `toolUseResult.persistedOutputPath`. **The full output is recoverable from disk** — the UI should be able to fetch and render it on demand.

---

## 5. Information density — the core design tension

A pure typographic document (no nested cards, no per-block kind tags, single column) maximizes scannability and serves §2.1 (Recall) best. But it under-serves §2.2 (Learning) and §2.3 (Audit), which both need denser, more typed surfaces — diffs rendered as real diffs, token costs visible, hook events legible, attachments not hidden as system noise.

**The core design challenge: serve all three use cases without forking the UI.**

Possible approaches (not prescriptive — design others if you have better ones):
- **Progressive disclosure**: keep the quiet document as the default; reveal structured data on hover / click / expand.
- **View modes**: a small mode-switcher (e.g. `Read` / `Learn` / `Audit`) that re-skins the same transcript with different defaults — collapsed meta vs. expanded, summary diffs vs. full diffs, hidden vs. surfaced hooks/attachments.
- **Side panel**: transcript stays document-y; a right-hand inspector pane reveals the structured sidecar for whatever row is focused. (Inspector exists in current code — `inspector.jsx`.)
- **Layered density**: same row, but optional sub-strips of metadata (token cost, duration, attachment count, hook events) appear under the row caption when a global "show metadata" toggle is on.

Show us at least two concept directions that explore different trade-offs here.

---

## 6. Specific design questions to address

For each, we want an explicit answer in your handoff.

1. **The toolUseResult dual-view problem.** Edit produces both a string and a `structuredPatch`. Bash produces both a stdout-stderr-merged string and a split-stream structured form. Read produces both a numbered-lines string and a `{filePath, content, numLines, totalLines}` record. How do you show both without doubling the visual weight of every tool result?

2. **Where does cost / duration / token info live?** Per-row? Per-LLM-message-group? Per-prompt-turn? Per-session header? Some combination? What's the default visibility?

3. **Attachments — inline or aggregated?** The 22 attachment variants ride alongside prompts. Are they rendered inline (a small typed card between the user prompt and the next assistant row) or aggregated into a "context envelope" the user can expand? Both have trade-offs — the inline form respects chronology but inflates the document; the aggregated form is dense but hides ordering.

4. **State-transitions audit view.** Is the audit lens (permission-mode changes, mode entries/exits, hook events, API errors) a **filter** on the main transcript, a **separate timeline view**, or a **right-rail strip**?

5. **Subagent navigation.** When the user drills into a subagent transcript, do we open a modal? Slide a new column? Replace the main pane with a breadcrumb? How do we make "I am inside a subagent two levels deep" obvious?

6. **The user-prompt anchor.** Recall users navigate by prompts. Should there be a permanent "table of contents" of prompts (sticky left rail? inline jump targets? floating mini-map?) — and should it show outcomes (token cost, duration, success/failure summary) per prompt?

7. **API errors and retries.** A single LLM call may produce multiple `api_error` system rows with a retry chain (`maxRetries`, `retryAttempt`, `retryInMs`, plus the full Anthropic HTTP error). How does that read inline in the transcript without dominating?

8. **File-history snapshots.** Every edit produces a backup on disk addressable by `backupFileName`. Worth surfacing as a "see all versions of this file" affordance, or out of scope for v6?

9. **Search.** Schema gives us typed fields to search across: filename, tool name, error text, attachment type, permission mode, prompt text. Is search a single global box that infers intent, or a structured query builder?

---

## 7. Out-of-the-box constraints

- **Performance:** must stay smooth at 10k+ rows per session. The implementation will use react-virtuoso with a flat-array model for expand/collapse. Avoid designs that imply nested independent scroll containers.
- **No outbound network from the server.** Transcripts may contain secrets. The viewer is fully local; no analytics, no telemetry to cloud, no shipping data anywhere.
- **Dark mode default; light mode supported.**
- **Monospace for code, mono numerals for token counts and durations.** Sans for prose.

---

## 8. Deliverable shape

HTML/CSS/JS prototypes. We'd like:

1. **At least two concept directions** that resolve the §5 tension differently.
2. **Pixel-level specs** for the recommended direction (grid, type scale, token palette with semantic names, exact treatments for envelopes / rails / dividers / cards).
3. **Explicit answers to the §6 questions** in the handoff doc.
4. **A component inventory** for the recommended direction — name and describe each reusable unit (e.g. "PromptAnchor", "ToolResultCard", "AttachmentChip", "SubagentRollup") with its purpose and the data it binds to. A coding agent will use this to map to React components later.
5. **A short "what we deliberately did NOT design"** section — anything you encountered in the schema that you chose not to surface, with the reasoning.

---

## 9. Anti-goals (do not do)

- Don't redesign the session sidebar / launch flow / live-tail indicators.
- Don't design loading / empty / error states unless the data they reflect is in the schema (e.g. `api_error` IS in the schema — design it; "session won't load" is a server-state UI, out of scope).
- Don't propose a layout that requires nested independent scroll containers — single-document scroll only (the implementation virtualizes a flat row list).
- Don't put icons inside small-caps captions — pixel-level alignment drifts across fonts; use typographic separators (dot divs at fixed size, em-spaces) instead.
- Don't drop information just to make the document quieter. The whole point of this iteration is to expose data that simpler "chat client" UIs throw away.
