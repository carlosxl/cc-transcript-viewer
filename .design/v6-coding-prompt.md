# Coding-agent prompt — UI information revamp

Paste the block below into a fresh Claude Code session. It's self-contained: the agent should not need any prior conversation context.

---

You are starting a new task on the cc-transcript-viewer repo. **Plan only — do not implement yet.** Produce a written plan; I'll review it before any code lands.

## What changed

We just landed a complete, corpus-validated Zod + TypeScript schema for the JSONL files Claude Code writes under `~/.claude/projects/`. Two new files are the source of truth:

- `packages/server/src/jsonl/schema.ts` — every row variant, attachment subtype, and `toolUseResult` shape, typed and discriminated.
- `packages/shared/src/jsonl/README.md` — the human-readable companion: ER model, on-disk layout, per-row-type guide with examples, image-attachment deep-dive, and a corpus-validation table.

**Read both top to bottom before you start.** The schema is not just stricter typing — it exposes data the previous UI never rendered. Specifically: across the 180-session validation corpus, the LLM-visible `tool_result.content` payload totals 23 MB, but the **structured `toolUseResult` sidecar that lives next to it totals 37 MB**. The current UI shows the 23 MB string and discards the 37 MB. That is the single biggest opportunity in this revamp.

Other under-rendered surfaces the schema now exposes:

- 22 `attachment` payload variants (task_reminder, skill_listing, deferred_tools_delta, mcp_instructions_delta, command_permissions, auto_mode/plan_mode entries and exits, hook events with stdout/stderr, goal_status, nested_memory, edited_text_file, …).
- 6 `system` row subtypes including `api_error` (with full retry chain), `turn_duration`, `stop_hook_summary`, `away_summary`.
- 9 session-state row types (permission-mode transitions, worktree-state, pr-link, queue-operation, file-history-snapshot indexing every backed-up file on disk, …).
- Per-row `UsageBlock` with cache_creation / cache_read split — but **N rows from one LLM message share the same usage and must be deduped by `message.id` before summing**.
- Subagent files at `<sessionId>/subagents/agent-<id>.jsonl` plus `agent-<id>.meta.json`. Parent's `Agent` tool_use carries an `AgentRollupResult` (totalDurationMs, totalTokens, toolStats); drilling in opens the subagent's own transcript.
- Three distinct paths images appear in transcripts (inline in prompts, inside tool_result content arrays, and base64 in Bash stdout when `isImage: true`).
- Off-loaded oversized tool outputs at `<sessionId>/tool-results/*.txt` — recoverable from disk via `toolUseResult.persistedOutputPath` or the inline error string.

`packages/shared/src/jsonl/README.md` has corpus counts and examples for every variant above. Use it.

## The three user jobs the UI must serve

In priority order — resolve trade-offs in favour of the earlier one.

1. **Recall** — "what happened in that session?" Skim a 10k-row transcript, find a specific prompt, see the outcome of each turn without expanding everything.
2. **Learning** — "how does Claude Code actually work?" Read the meta-mechanism layer: what context got injected, what hooks fired, what attachments rode with each prompt, what the LLM saw versus what the harness recorded.
3. **Audit** — "did anything go wrong here, and what did it cost?" Per-turn and per-session token totals (with cache hit rate), `api_error` retry chains, hook failures, permission-mode transitions, files touched, PRs opened.

These are the prioritization rubric for every design and scope decision in the plan.

## Required reading (in order)

1. `packages/server/src/jsonl/schema.ts` — the master schema.
2. `packages/shared/src/jsonl/README.md` — entity model and examples.
3. `.design/v6-brief.md` — the in-flight design brief that will be sent to Claude Design. Read it to understand which questions the visual design layer will answer and which the implementation layer needs to answer.
4. `packages/ui/src/components/transcript/` — current transcript components (`Transcript.tsx`, `RequestNode.tsx`, `UserPrompt.tsx`, `TurnDivider.tsx`, plus the `blocks/` subdirectory).
5. `packages/ui/src/hooks/useSessionView.ts` — current data-loading hook for a session view; understand its shape before you propose changes.
6. `packages/server/` — current API surface; figure out what the server returns to the UI today and where the schema needs to be threaded through.
7. `CLAUDE.md` — project conventions and the locked tech stack (Vite + React 19 + Tailwind 4 + react-virtuoso + Hono + better-sqlite3 + Zustand).

## What the plan must cover

Structure your output roughly like this — adjust as needed but address every numbered item.

1. **Data-flow audit** — for each top-level row type in the schema (user / assistant / system / attachment / each session-state variant), trace what the server currently returns to the UI and what the UI currently renders. Identify the gaps. Be specific: "field X from schema is not in the API response" or "field Y is in the response but the UI ignores it." The output of this section should be a table or matrix that's reviewable at a glance.

2. **Grouping model** — propose how to assemble flat rows into renderable units. The schema gives two valid groupings: `promptId` (one user submission → many rows) and `message.id` / `requestId` (one LLM call → many content-block rows). Pick a primary grouping and explain why. State the rules for what goes into a "turn block": which user row anchors it, which attachment rows ride with it, which assistant rows belong to it, which tool_result rows close out which tool_use rows.

3. **Information surface inventory** — list every data element you propose to expose in the UI, where it lives in the schema, and which of the three user jobs it primarily serves. Include the under-rendered surfaces (toolUseResult variants, attachments, system events, usage block, file-history-snapshot, etc.). Mark each as "always visible", "expandable", or "behind a mode toggle / filter".

4. **State and view modes** — the design brief explores whether to serve all three user jobs via progressive disclosure, view modes (Read / Learn / Audit), a side inspector, or layered density. Recommend a concrete client-state shape (probably in Zustand): which toggles exist, what's per-session vs. global, what persists across reloads. Don't wait for the design to land — propose the data shape so the design can fit on top of it.

5. **Virtualization plan** — react-virtuoso with a flat row array is the locked pattern (see `CLAUDE.md`). Expanding a tool result, drilling into a subagent, or toggling attachment visibility all need to map onto inject/splice operations on the flat array. Lay out the row-id and item-type scheme that supports this, and explain how the array stays stable across re-renders so virtuoso doesn't lose scroll position.

6. **Server contract changes** — what new endpoints or response-shape changes are needed? Specifically: (a) does the server return parsed `ClaudeRow` objects to the UI, or does it stream raw JSONL lines and let the UI parse? (b) how does the UI request a subagent's transcript? (c) how does the UI fetch an off-loaded `tool-results/*.txt` payload? (d) how does the UI fetch a file-history backup blob? Update or extend the contract in `specs/006-ui-rewrite-v4/contracts/ui-backend.md` rather than starting fresh.

7. **Performance and cost budget** — sessions can be 145 MB of JSONL with many MB of inline base64 images and many MB of structured patches. State your assumptions about what gets sent down the wire, what gets parsed eagerly, what's lazy-loaded (images especially), and how big a single API response is allowed to get. Identify any place where you'd want server-side pagination.

8. **Search and navigation** — the schema gives typed fields to search (filename, tool name, error text, attachment type, prompt text, permission mode). Sketch the search model: is FTS5 fed only the prompt and assistant text, or also tool inputs, tool outputs, and attachment payloads? What's the prompt-anchor / table-of-contents navigation pattern for §1 Recall?

9. **Scope ladder** — split the work into shippable chunks ordered by user value. The first chunk should give a visible win on §1 Recall without breaking anything currently working. Later chunks layer in §2 Learning and §3 Audit. Identify a minimum viable cut and the stopping point we could call "done."

10. **Open questions** — anything you couldn't decide from reading the schema, the design brief, the existing code, and `CLAUDE.md`. Be specific about what's blocking each decision.

## Hard constraints

- **Don't redesign the session sidebar, the CLI, or the live-tail SSE pipe.** They work; out of scope.
- **Single-document scroll.** No nested independent scroll containers — virtuoso virtualizes one flat row list.
- **Privacy.** The server never makes outbound network calls with transcript content. Everything stays local.
- **No new heavyweight dependencies** without explicit justification in the plan. The stack in `CLAUDE.md` is locked.
- **Don't drop information just to make the document quieter.** The whole point of the revamp is to expose data simpler "chat client" UIs throw away. Density problems should be solved by progressive disclosure, modes, or filters — not by erasure.
- **Don't sum `usage` across rows with the same `message.id`.** Group first, then sum one usage block per group.
- **Forward-compatibility.** The schema has an `UnknownRow` fallback for future Claude Code versions. The UI plan must continue to handle unknown row types without crashing — even if it renders them as a degraded card.

## What I do NOT want in the plan

- Pseudocode of every component.
- Wireframes or visual mockups (the design brief is the source of those; let Claude Design produce them).
- A rewrite of the server or a swap of any locked dependency.
- "Phase 1 / Phase 2 / Phase 3" without concrete user-visible deliverables. Each chunk in §9 must answer "what does the user see at the end of this chunk that they didn't see at the start?"
- Promises about timelines.

## Definition of done for this planning task

A markdown plan document (suggested path: `specs/007-ui-information-revamp/plan.md`, creating the directory if it doesn't exist) that addresses every numbered item in "What the plan must cover," cites specific files and line ranges from the schema where relevant, and is short enough that I can review it in one sitting. Aim for surgical specificity over exhaustive coverage.

When the plan is written, stop and tell me where to find it. Do not start implementing.
