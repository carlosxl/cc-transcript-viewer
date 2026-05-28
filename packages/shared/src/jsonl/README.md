# Claude Code JSONL schema

Reference & entity model for the JSONL files Claude Code writes under
`~/.claude/projects/<encoded-project>/`. Runtime/static schemas live in
[`packages/server/src/jsonl/schema.ts`](../../../server/src/jsonl/schema.ts).

This document is the **human-readable** side of that library: an ER model, a
guided tour of every row type, examples, and a corpus-validation table that
shows which assumptions are universal vs which are local to one session.

---

## 1. On-disk layout

A "session" is a fileset, not a single file:

```
~/.claude/projects/<encoded-project>/
├── <sessionId>.jsonl                       ← main transcript (newline-delimited JSON)
└── <sessionId>/
    ├── subagents/
    │   ├── agent-<id>.jsonl                ← one per Agent (Task) call
    │   └── agent-<id>.meta.json            ← {agentType, description?, worktreePath?}
    └── tool-results/
        └── <stem>.txt                      ← off-loaded oversize tool outputs
```

Cross-referenced external storage:

| Referenced from | Path |
|---|---|
| `file-history-snapshot.snapshot.trackedFileBackups[*].backupFileName` | `~/.claude/file-history/<sessionId>/<backupFileName>` |
| `ExitPlanResult.filePath` / `plan_mode.planFilePath` | `~/.claude/plans/<slug>.md` |
| `bash_result.persistedOutputPath` & inline error string | `<sessionId>/tool-results/<stem>.txt` |
| `AgentLaunchResult.outputFile` | `/private/tmp/claude-501/<encoded-project>/<sessionId>/tasks/<agentId>.output` |

---

## 2. Entity-relationship model

```
                                    Session (one .jsonl file)
                                    │  id = file stem (uuid)
                                    │  scalar state pulled from session-state rows:
                                    │    aiTitle, customTitle, agentName,
                                    │    permissionMode, lastPrompt+leafUuid,
                                    │    worktreeSession, prLink
                                    │
                                    ▼
                ┌─────────────  TopLevelRow (one JSONL line)  ─────────────┐
                │  discriminator: type                                     │
                │                                                          │
                ▼                                                          ▼
       MessageBearingRow                                          SessionStateRow
       (user / assistant /                                        (ai-title, custom-title,
        system / attachment)                                       agent-name, last-prompt,
       envelope: uuid, parentUuid,                                 permission-mode, pr-link,
                  sessionId, timestamp,                            worktree-state,
                  cwd, gitBranch, slug,                            queue-operation,
                  isSidechain, version,                            file-history-snapshot)
                  userType, isMeta?,                              ─ no uuid / no parent
                  agentId? (subagent only)                        ─ "fold to last value"
       parentUuid: chained linked-list back to first row
                                    │
        ┌───────────────────────────┼───────────────────────────┬─────────────────────┐
        │                           │                           │                     │
        ▼                           ▼                           ▼                     ▼
    UserRow                  AssistantRow                  SystemRow             AttachmentRow
    promptId? (groups        requestId  ──┐                subtype:              attachment:
      submission)            message.id ──┤  N rows         stop_hook_summary,    discriminated
    sourceToolAssistant      attribution  │  per LLM        turn_duration,        union of 22
      UUID?  ─── tool_use_id │  Agent     │  message        away_summary,         payload types
      ───→ AssistantRow      │  (subagent)│                 local_command,        (see §6)
    message.content:         │            │                 api_error,
      string | block[]       ▼            ▼                 informational
                          AssistantContentBlock
                            text | thinking | tool_use
                                          │
                                          │  tool_use.id ──┐
                                          ▼                │
                                       (next round)        │
                                                           │
    UserRow (tool_result)  ────────────────────────────────┘
      message.content[0] = ToolResult       ┐
      .tool_use_id = <matches assistant>     │ — same pairing
      .content: string | [text|image|        │
                          tool_reference]    │
      toolUseResult ⟵ ─────────────────────  ┘ structured sidecar
        18+ shapes (Bash, Read, Edit, Write,
        Task*, Agent, ExitPlan, AskUser, …)

    Agent tool_use ──→ AgentRollupResult
       toolUseResult.agentId ─────────────→  Subagent file
                                              <session>/subagents/agent-<id>.jsonl
                                              same row union, +isSidechain: true,
                                              +agentId everywhere,
                                              +attributionAgent on assistants
                                              meta: agent-<id>.meta.json
```

### Key relationships (cardinalities)

| From | → | To | Cardinality |
|---|---|---|---|
| Session | → | TopLevelRow | 1..N |
| TopLevelRow.parentUuid | → | TopLevelRow.uuid (prior row) | N..1 (linked list; null at head) |
| UserRow.promptId | → | UserRow / AssistantRow / … | 1..N (group: one prompt → many rows) |
| AssistantRow.requestId / message.id | → | AssistantRow | 1..N (one LLM call → N content-block rows) |
| AssistantRow.tool_use.id | → | UserRow (tool_result).tool_use_id | 1..1 |
| UserRow.sourceToolAssistantUUID | → | AssistantRow.uuid | N..1 (denormalised join key) |
| Agent tool_use → AgentRollupResult.agentId | → | Subagent file `agent-<id>.jsonl` | 1..1 |
| AssistantRow (subagent).attributionAgent | → | SubagentMeta.agentType | N..1 |
| file-history-snapshot.snapshot.messageId | → | TopLevelRow.uuid | 1..1 |
| file-history-snapshot.trackedFileBackups[path].backupFileName | → | filesystem file | 1..1 |

### Two ways to group rows into a "turn"

1. **`promptId`** — every row generated by one user submission. Most natural
   "turn" key for an outline UI. A prompt → many LLM requests → many assistant
   rows → many tool_results → all carry the same `promptId`.
2. **`requestId` / `message.id`** — every row that came from one LLM call.
   Use this if you want to render Anthropic-message-level granularity (one
   message containing thinking + text + tool_use blocks).

---

## 3. Top-level row types (corpus-validated)

180 sessions / 40,131 rows surveyed (145 MB). All 13 types currently produced
by Claude Code v2.1.140 are listed. **Frequency** column is the corpus-wide
count; **per file** is true/false for "appears in 100% of session files".

| `type` | Frequency | Per file | Has envelope? | Notes |
|---|---|---|---|---|
| `assistant` | 17,591 | yes | yes | one row per content block; many rows share `message.id` |
| `user` | 12,492 | yes | yes | three flavours: prompt, tool_result, slash-command meta |
| `last-prompt` | 2,440 | yes | no | session-state; re-emitted on every prompt |
| `attachment` | 2,069 | most | yes | 22 sub-payload shapes |
| `file-history-snapshot` | 1,865 | yes | no (no sessionId either) | indexes external file backups |
| `system` | 1,538 | yes | yes | 6 subtypes |
| `ai-title` | 1,530 | yes | no | re-emitted on title revisions |
| `permission-mode` | 687 | most | no | re-emitted on every mode toggle |
| `worktree-state` | 332 | worktree-only | no | only in sessions launched via `EnterWorktree` |
| `queue-operation` | 134 | rare | no | background-task enqueues |
| `agent-name` | 134 | rare | no | autonaming for subagent-heavy sessions |
| `custom-title` | 75 | rare | no | only when user invoked `/title` (or skill set one) |
| `pr-link` | 71 | rare | no | only when a PR was opened from the session |

Validated invariants:

- `isSidechain == true` ⇔ row is inside a subagent file (3,524/3,524).
- `isSidechain == false` for every row in a main file; never `true`.
- Session-state rows omit envelope (`uuid`, `parentUuid`, `timestamp`,
  `isSidechain`).
- `file-history-snapshot` even omits `sessionId` (the session is implicit
  in the file path).
- `sourceToolAssistantUUID` is present on **100%** of tool_result user rows
  (both main and subagent).
- `requestId` is present on **99.9%** of assistant rows; the 11 exceptions are
  all `model: "<synthetic>"` rows (locally-generated placeholders like
  `"No response requested."` after a user interrupt or API error).

---

## 4. UserRow

```ts
type UserRow = {
  type: 'user'
  message: {
    role: 'user'
    content: string | UserContentBlock[]
  }
  promptId?: string
  sourceToolAssistantUUID?: string         // tool_result rows only
  toolUseResult?: ToolUseResult            // tool_result rows only — structured sidecar
  // + envelope
}
```

`message.content` is either a string OR an array of blocks. The **string**
case has five sub-flavours, identified by a leading XML-ish tag:

| Leading tag | Meaning | Count |
|---|---|---|
| `<command-name>…</command-name>` … `<command-args>…</command-args>` | The user typed a slash command. Following local_command system rows carry the output. | 194 |
| `<local-command-caveat>…` | Marker telling the LLM to ignore local-command output (`isMeta: true`). | 206 |
| `<local-command-stdout>…</local-command-stdout>` (or `<…-stderr>`) | Captured output of the slash command. | 66 |
| `<task-notification>…` | Background-task completion notification (also surfaces as a `queued_command` attachment). | 20 |
| `<bash-input>` / `<bash-stdout>` / `<bash-stderr>` | Output of the `! <cmd>` inline shell. | 18 |
| *no tag* | A real human-typed prompt. | majority of strings |

The **array** case is dominated by tool_result blocks, with a long-tail of
text/image blocks when a user pastes images or quoted text:

| Composition | Count |
|---|---|
| `[tool_result]` | 11,140 |
| `[text]` | 189 |
| `[text, image]` | 36 |
| `[text, text]` | 6 |
| `[text, image, image]` | 6 |
| `[text, text, text]` | 2 |
| `[text, image, image, image]` | 2 |

### 4.1 Example — real prompt

```json
{
  "type": "user",
  "uuid": "1d6f…",
  "parentUuid": "337e…",
  "sessionId": "ccc2988f-…",
  "timestamp": "2026-05-25T03:40:20.809Z",
  "promptId": "d5ba82ee-…",
  "cwd": "/Users/l.xiang/sandbox/cc-transcript-viewer",
  "gitBranch": "006-ui-rewrite-v4",
  "version": "2.1.140",
  "message": {
    "role": "user",
    "content": "I've tweaked the design a bit, the new design is at @.design/v5."
  }
}
```

### 4.2 Example — slash command

```json
{
  "type": "user",
  "isMeta": false,
  "message": {
    "role": "user",
    "content": "<command-name>/clear</command-name>\n            <command-message>clear</command-message>\n            <command-args></command-args>"
  },
  "promptId": "2067afd9-…"
}
```

### 4.3 Example — image attachment (see also §10)

```json
{
  "type": "user",
  "message": {
    "role": "user",
    "content": [
      { "type": "text", "text": "[Image #1] help me check my status bar, what are these two numbers?" },
      {
        "type": "image",
        "source": { "type": "base64", "media_type": "image/png", "data": "iVBORw0K…" }
      }
    ]
  }
}
```

### 4.4 Example — tool_result with structured sidecar

```json
{
  "type": "user",
  "sourceToolAssistantUUID": "62b84d47-…",
  "promptId": "d5ba82ee-…",
  "message": {
    "role": "user",
    "content": [{
      "type": "tool_result",
      "tool_use_id": "toolu_018abc…",
      "content": "     1\t# Heading\n     2\t…"
    }]
  },
  "toolUseResult": {
    "type": "text",
    "file": {
      "filePath": "/Users/l.xiang/sandbox/cc-transcript-viewer/.design/v5/README.md",
      "content": "# Heading\n…",
      "numLines": 23,
      "startLine": 1,
      "totalLines": 23
    }
  }
}
```

The `toolUseResult` side carries the **typed** data (`numLines`, `totalLines`,
`filePath`). The `tool_result.content` side carries the **string** the LLM
saw. A viewer should prefer the sidecar.

---

## 5. AssistantRow

```ts
type AssistantRow = {
  type: 'assistant'
  requestId?: string
  attributionAgent?: string                // subagent files only
  message: {
    type: 'message'
    role: 'assistant'
    id: string                             // Anthropic message id
    model: 'claude-opus-4-7' | 'claude-sonnet-4-6' | 'claude-haiku-4-5-…' | '<synthetic>'
    content: AssistantContentBlock[]
    stop_reason: 'tool_use' | 'end_turn' | 'stop_sequence' | 'max_tokens' | null
    usage?: UsageBlock
  }
  // + envelope
}
```

Critical: **one Anthropic `message.id` produces many top-level rows.** When the
LLM returns text + thinking + tool_use in a single message, Claude Code splits
that into multiple `assistant` rows. They share `message.id`, `requestId`, and
the *same* `message.usage` (don't sum it!). Example: in one session,
`requestId=req_011CbNcLZASXtiNK1tKSLtHS` produced 12 rows all sharing
`message.id=msg_01FGbY6JXqXaYTUGLr9pW9L8`.

Content blocks (corpus census):

| Block | Count | Keys |
|---|---|---|
| `tool_use` | 11,132 | `{type, id, name, input, caller:{type:"direct"}}` |
| `text` | 3,435 | `{type, text}` |
| `thinking` | 3,057 | `{type, thinking, signature}` |

`stop_reason` enum (validated): `"tool_use"` (15,661), `"end_turn"` (880),
`"stop_sequence"` (16), null (1,072 — synthetic rows).

`model` enum: 4 values seen across corpus.

### 5.1 Example — thinking block

```json
{
  "type": "assistant",
  "requestId": "req_011Cb…",
  "message": {
    "id": "msg_018Xy…",
    "model": "claude-opus-4-7",
    "role": "assistant",
    "content": [{
      "type": "thinking",
      "thinking": "The user wants… I should first read the file before editing.",
      "signature": "EpsLCkYI…"
    }],
    "stop_reason": null,
    "usage": { /* see §5.2 */ }
  }
}
```

### 5.2 UsageBlock

Two shapes:

| Shape | Count | Fields |
|---|---|---|
| Full (Claude-Code-enriched) | 16,572 | `input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens, cache_creation{ephemeral_1h, ephemeral_5m}, server_tool_use{web_search, web_fetch}, service_tier, speed, inference_geo, iterations` |
| Lean (API-shape) | 1,080 | first six + `service_tier` only |

`iterations` is always `[]` (16,556/16,556); `inference_geo` always `""`;
`speed` and `service_tier` always `"standard"`.

```json
{
  "input_tokens": 6,
  "cache_creation_input_tokens": 19866,
  "cache_read_input_tokens": 16202,
  "output_tokens": 198,
  "cache_creation": { "ephemeral_1h_input_tokens": 19866, "ephemeral_5m_input_tokens": 0 },
  "server_tool_use": { "web_search_requests": 0, "web_fetch_requests": 0 },
  "service_tier": "standard",
  "speed": "standard"
}
```

---

## 6. AttachmentRow

`attachment` rows ride alongside a user prompt and carry the additional
context the LLM saw. 22 payload shapes observed (column = corpus count):

| `attachment.type` | n | Payload |
|---|---|---|
| `task_reminder` | 848 | `{itemCount, content: TaskListItem[]}` — full task list as of that turn |
| `skill_listing` | 353 | `{skillCount, isInitial, content}` — markdown list of available skills |
| `deferred_tools_delta` | 218 | `{addedNames, addedLines, removedNames, readdedNames}` — tool catalogue diff |
| `auto_mode` | 214 | `{reminderType}` — auto-mode entered |
| `mcp_instructions_delta` | 120 | `{addedNames, removedNames, addedBlocks}` — MCP system-prompt changes |
| `command_permissions` | 117 | `{allowedTools: ["Bash(git:*)", "Bash(gh:*)", "Read", …]}` |
| `queued_command` | 44 | `{commandMode, prompt}` — background-task completion notice |
| `edited_text_file` | 38 | `{filename, snippet}` — user edited a file the agent was working on |
| `directory` | 34 | `{path, displayPath, content}` — `@folder` mention |
| `plan_mode` | 15 | `{reminderType, isSubAgent, planFilePath, planExists}` |
| `plan_mode_exit` | 14 | `{planFilePath, planExists}` |
| `date_change` | 13 | `{newDate}` — UTC midnight rollover |
| `file` | 8 | `{filename, displayPath, content}` — `@file` mention |
| `ultrathink_effort` | 7 | `{}` — extended-thinking budget bumped |
| `nested_memory` | 7 | `{path, displayPath, content}` — nested CLAUDE.md pulled in |
| `hook_blocking_error` | 5 | `{hookEvent, hookName, toolUseID, blockingError}` |
| `hook_success` | 4 | `{hookEvent, hookName, toolUseID, command, exitCode, durationMs, stdout, stderr}` |
| `hook_cancelled` | 4 | `{hookEvent, hookName, toolUseID, command, durationMs}` |
| `goal_status` | 2 | `{condition, met, sentinel?, reason?, iterations?, durationMs?, tokens?}` |
| `auto_mode_exit` | 2 | `{}` |
| `plan_mode_reentry` | 1 | `{planFilePath}` |
| `hook_non_blocking_error` | 1 | `{hookEvent, hookName, toolUseID, command, exitCode, durationMs, stdout, stderr}` |

### 6.1 Example — task_reminder

```json
{
  "type": "attachment",
  "attachment": {
    "type": "task_reminder",
    "itemCount": 1,
    "content": [{
      "id": "1",
      "subject": "Create BlockToolResult",
      "description": "New HARNESS-side component: …",
      "activeForm": "Creating BlockToolResult",
      "status": "completed",
      "blocks": [],
      "blockedBy": []
    }]
  }
}
```

### 6.2 Example — directory mention

```json
{
  "type": "attachment",
  "attachment": {
    "type": "directory",
    "path": "/Users/l.xiang/sandbox/cc-transcript-viewer/.design/v5",
    "displayPath": ".design/v5",
    "content": "README.md\nproject"
  }
}
```

### 6.3 Example — goal_status (evaluated)

```json
{
  "type": "attachment",
  "attachment": {
    "type": "goal_status",
    "condition": "run a non-destructive test in a separated folder…",
    "met": true,
    "reason": "All four requirements have been satisfied: (1) isolated sandbox …",
    "iterations": 1,
    "durationMs": 56882,
    "tokens": 3832
  }
}
```

---

## 7. SystemRow

```ts
type SystemRow = {
  type: 'system'
  subtype: 'stop_hook_summary' | 'turn_duration' | 'away_summary' | 'local_command' | 'api_error' | 'informational'
  content?: string
  level?: 'info' | 'warning' | 'error' | 'suggestion'
  // + subtype-specific fields
}
```

| Subtype | n | Distinctive fields |
|---|---|---|
| `stop_hook_summary` | 566 | `hookCount, hookInfos:[{command,durationMs}], hookErrors, preventedContinuation, stopReason, hasOutput, toolUseID` |
| `turn_duration` | 530 | `durationMs, messageCount` |
| `away_summary` | 248 | `content` — LLM-generated summary of a long turn |
| `local_command` | 142 | `content` — wraps `<local-command-stdout>` etc.; pairs with the slash-command user row |
| `api_error` | 48 | `error, cause, maxRetries, retryAttempt, retryInMs` — full Anthropic HTTP error |
| `informational` | 4 | `content, level` — e.g. `"Unknown command: /nf-pusub"` |

### 7.1 Example — away_summary

```json
{
  "type": "system",
  "subtype": "away_summary",
  "content": "Re-skinned the transcript pane to v5 Variant A — implementation, tests, and browser smoke all passed. Next: commit when you're ready.",
  "timestamp": "2026-05-25T04:09:33.305Z"
}
```

### 7.2 Example — turn_duration

```json
{
  "type": "system",
  "subtype": "turn_duration",
  "durationMs": 1279979,
  "messageCount": 348
}
```

### 7.3 Example — api_error

```json
{
  "type": "system",
  "subtype": "api_error",
  "level": "error",
  "error": {
    "status": 529,
    "error": {
      "type": "error",
      "error": { "type": "overloaded_error", "message": "Overloaded" },
      "request_id": "req_011Cb…"
    }
  },
  "maxRetries": 10,
  "retryAttempt": 1,
  "retryInMs": 601.91
}
```

---

## 8. Session-state rows

These rows are **state snapshots, not chat history**. They have no `uuid`,
`parentUuid`, `timestamp`, `isSidechain`, or other envelope fields. They are
re-emitted whenever the underlying value changes. When rendering a session,
fold them to the **last value**.

| Row | Shape | Notes |
|---|---|---|
| `ai-title` | `{aiTitle, sessionId}` | Re-emitted as Claude refines the auto-title |
| `custom-title` | `{customTitle, sessionId}` | Only when user sets one explicitly |
| `agent-name` | `{agentName, sessionId}` | Slug — different from aiTitle |
| `permission-mode` | `{permissionMode, sessionId}` | Enum: `auto, plan, acceptEdits, default` |
| `last-prompt` | `{lastPrompt?, leafUuid?, sessionId}` | `leafUuid` is the tail of the current chain |
| `pr-link` | `{prNumber, prRepository, prUrl, sessionId, timestamp?}` | Only when a PR opened from the session |
| `worktree-state` | `{sessionId, worktreeSession: {originalCwd, worktreePath, worktreeName, worktreeBranch, originalBranch, originalHeadCommit, sessionId}}` | Only for worktree-launched sessions |
| `queue-operation` | `{operation, sessionId, timestamp?, content?}` | Operation enum: `enqueue, dequeue, remove, popAll` |
| `file-history-snapshot` | `{isSnapshotUpdate, messageId, snapshot:{messageId, timestamp, trackedFileBackups}}` | NO `sessionId` — session is implicit in file path |

### 8.1 Example — worktree-state

```json
{
  "type": "worktree-state",
  "sessionId": "d224cccc-…",
  "worktreeSession": {
    "originalCwd": "/Users/l.xiang/workspace/pltf-nf-agent-workspace",
    "worktreePath": "/Users/l.xiang/workspace/pltf-nf-agent-workspace/.claude/worktrees/create-pr",
    "worktreeName": "create-pr",
    "worktreeBranch": "worktree-create-pr",
    "originalBranch": "docs/scratchpad-archival",
    "originalHeadCommit": "a8ab46c53f7c618f959ce9f390034e058b4d5887",
    "sessionId": "d224cccc-…"
  }
}
```

### 8.2 Example — file-history-snapshot

```json
{
  "type": "file-history-snapshot",
  "isSnapshotUpdate": true,
  "messageId": "5c16a3de-…",
  "snapshot": {
    "messageId": "5c16a3de-…",
    "timestamp": "2026-05-25T03:40:34.111Z",
    "trackedFileBackups": {
      "packages/ui/src/lib/splitRequest.ts": {
        "backupFileName": "9dcac438f0c423cc@v2",
        "backupTime": "2026-05-25T05:59:08.329Z",
        "version": 2
      }
    }
  }
}
```

Reading the backup contents:
```
cat ~/.claude/file-history/<sessionId>/9dcac438f0c423cc@v2
```

---

## 9. ToolUseResult (the structured sidecar)

Every user row that answers an assistant `tool_use` carries a parallel
`toolUseResult` object — **structured fields the LLM does not see**. Most
viewers ignore it and read only `tool_result.content`, losing 50% of the
information per session.

Corpus census of `toolUseResult` shapes (which fields are present):

| Shape | n | Likely tool |
|---|---|---|
| `{interrupted, isImage, noOutputExpected, stderr, stdout}` | 3,443 | Bash |
| `{file, type:"text"}` | 1,923 | Read |
| `{filePath, oldString, newString, originalFile, structuredPatch, replaceAll, userModified}` | 1,503 | Edit |
| `{type, filePath, content, originalFile, structuredPatch, userModified}` | 591 | Write (`type: create` or `update`) |
| `{statusChange, success, taskId, updatedFields}` | 517 | TaskUpdate |
| `{task}` | 438 | TaskCreate |
| `array` of `{type:"text"|"image"}` | 303 | MCP / direct multi-block |
| `string` | 277 | Errors, refusals |
| `{statusChange, success, taskId, updatedFields, verificationNudgeNeeded}` | 232 | TaskUpdate (v2) |
| `{matches, query, total_deferred_tools}` | 128 | ToolSearch |
| `{agentId, agentType, content, prompt, status, toolStats, totalDurationMs, totalTokens, totalToolUseCount, usage}` | 62 | Agent (Task) rollup |
| `{content, filenames, mode, numFiles, numLines}` | 61 | Grep (mode: `content`) |
| `{success, taskId, updatedFields}` | 50 | TaskUpdate (no status change) |
| `{answers, questions}` | 44 | AskUserQuestion |
| `{backgroundTaskId, …Bash fields}` | 32 | Bash (run_in_background) |
| `{returnCodeInterpretation, …Bash fields}` | 28 | Bash (e.g. "No matches found") |
| `{allowedTools, commandName, success}` | 28 | command-permissions grant |
| `{agentId, commandName, result, status, success}` | 23 | Slash command dispatched as Agent |
| `{filenames, mode, numFiles}` | 21 | Grep (mode: `files_with_matches`) |
| `{commandName, success}` | 18 | Generic command |
| `{durationSeconds, query, results}` | 17 | WebSearch |
| `{persistedOutputPath, persistedOutputSize, …Bash fields}` | 15 | Bash with off-loaded stdout |
| `{bytes, code, codeText, durationMs, result, url}` | 14 | WebFetch |
| `{assistantAutoBackgrounded, …Bash fields}` | 14 | Bash auto-backgrounded |
| `{agentId, canReadOutputFile, description, isAsync, outputFile, prompt, status}` | 14 | Agent (async launch) |
| `{tasks}` | 10 | TaskList |
| `{plan, filePath, hasTaskTool, isAgent}` | 8 | ExitPlanMode |
| `{action, discardedCommits, discardedFiles, message, originalCwd, worktreeBranch, worktreePath}` | 3 | ExitWorktree |
| others | tail | misc |

### 9.1 Example — Edit structuredPatch

```json
{
  "filePath": "/Users/l.xiang/sandbox/cc-transcript-viewer/packages/ui/src/index.css",
  "oldString": "  --amber-soft: …\n  --violet: …",
  "newString": "  --amber-soft: …\n  --violet: …\n\n  /* YOU rail */ \n  --user-accent: #e8b96a;",
  "replaceAll": false,
  "originalFile": "/* full file contents */",
  "structuredPatch": [{
    "oldStart": 54, "oldLines": 6,
    "newStart": 54, "newLines": 9,
    "lines": [
      "   --amber-soft: oklch(0.82 0.14 80 / 0.14);",
      "   --violet: oklch(0.72 0.16 305);",
      " ",
      "+  /* YOU rail (Variant A transcript). */",
      "+  --user-accent: #e8b96a;",
      "+",
      "   /* Diff palette */",
      "   --diff-add-bg: …",
      "   --diff-add-fg: …"
    ]
  }],
  "userModified": false
}
```

The `lines` array uses standard unified-diff prefixes (` ` context, `+` add,
`-` delete). Do not re-parse the string `tool_result.content` to build a diff;
read `structuredPatch` directly.

### 9.2 Example — Agent rollup

```json
{
  "agentId": "a829ae57fdb4580d3",
  "agentType": "Explore",
  "status": "completed",
  "prompt": "I need to understand the current state of the transcript pane in…",
  "content": [{ "type": "text", "text": "I've explored the codebase…" }],
  "totalDurationMs": 92263,
  "totalTokens": 79942,
  "totalToolUseCount": 31,
  "toolStats": {
    "readCount": 21, "searchCount": 0, "bashCount": 10,
    "editFileCount": 0, "linesAdded": 0, "linesRemoved": 0, "otherToolCount": 0
  },
  "usage": { /* same shape as UsageBlock */ }
}
```

To open the subagent's own transcript, join `agentId` → file
`<sessionId>/subagents/agent-<agentId>.jsonl`.

### 9.3 Example — AskUserQuestion (questions AND answers)

```json
{
  "questions": [{
    "question": "Where does the focus ring render?",
    "header": "Tool focus",
    "options": [
      { "label": "Both rows",    "description": "Both REQ and HARNESS rows show focus. (Recommended)" },
      { "label": "Result only",  "description": "Only the HARNESS row." },
      { "label": "Call only",    "description": "Only the REQ row." }
    ],
    "multiSelect": false
  }],
  "answers": {
    "Where does the focus ring render?": "Both rows"
  }
}
```

---

## 10. Image attachments — deep dive

There are **three** distinct ways image data appears in a transcript. All
three observed across the corpus:

### 10.1 User pasted/dragged an image into the prompt

The image rides inline in `user.message.content` as an `image` block. The
companion `text` block contains a `[Image #N]` placeholder (1-indexed).
Multiple images per prompt are common — observed up to 3 (`[Image #12]`,
`[Image #13]`, `[Image #14]` in one row).

| Field | Value |
|---|---|
| Source type | always `"base64"` |
| Media types observed | `image/png`, `image/jpeg` |
| Data size | inline; ranges from ~25 KB to ~157 KB in observed corpus |

Real row from the corpus (`data` truncated):

```json
{
  "type": "user",
  "uuid": "2c405cd7-…",
  "parentUuid": null,
  "message": {
    "role": "user",
    "content": [
      { "type": "text", "text": "[Image #1] help me check my status bar, what are these two numbers and why are they soooo large?" },
      {
        "type": "image",
        "source": {
          "type": "base64",
          "media_type": "image/png",
          "data": "iVBORw0KGgoAAAANSUhEUgAA…"   // 157,352 chars
        }
      }
    ]
  }
}
```

### 10.2 Tool returned an image (screenshots, OCR, etc.)

When a tool's response contains an image (chrome-devtools `take_screenshot`,
MCP image returns, etc.), it appears **inside** the `tool_result` block's
`.content` array — not in a top-level `image` block.

```json
{
  "type": "user",
  "sourceToolAssistantUUID": "e8e6312b-…",
  "message": {
    "role": "user",
    "content": [{
      "type": "tool_result",
      "tool_use_id": "toolu_01Kd…",
      "content": [{
        "type": "image",
        "source": {
          "type": "base64",
          "media_type": "image/jpeg",
          "data": "/9j/4AAQSk…"                  // 24,620 chars
        }
      }]
    }]
  }
}
```

Plus the structured sidecar `toolUseResult` is an **array** of `{type:"image"}`
blocks (or a mix `[text, image]`):

```json
"toolUseResult": [
  { "type": "text", "text": "Screenshot saved to /tmp/x.jpeg" },
  { "type": "image", "source": { … } }
]
```

### 10.3 Bash that produced an image

When a Bash command's output is detected as an image, the BashResult sidecar
has `isImage: true`:

```json
"toolUseResult": {
  "interrupted": false,
  "isImage": true,
  "noOutputExpected": false,
  "stderr": "",
  "stdout": "<base64-image-data>"
}
```

### 10.4 Counting / rendering rules a viewer must follow

- A "user message" in the UI = the prompt text + every adjacent `image` block
  + every adjacent `attachment` row at the same `parentUuid`. Don't render
  them as separate bubbles.
- The `[Image #N]` placeholder in the text block should be replaced inline
  with a thumbnail of the N-th image block (1-indexed).
- For tool-returned images, render the image alongside the tool result body,
  not as a standalone user bubble.
- Decoded image sizes can total many MB per session — virtualize the list
  and load images lazily (e.g. only when the row scrolls into view).

---

## 11. Subagent files

```
<sessionId>/subagents/
  agent-<agentId>.jsonl          ← same row union as main; +isSidechain:true, +agentId
  agent-<agentId>.meta.json      ← {agentType, description?, worktreePath?}
```

Differences from main file:

- Every row carries `agentId`.
- Every row has `isSidechain: true`.
- Assistant rows additionally carry `attributionAgent` (the agent type as a
  string, e.g. `"Explore"`). 683 assistant rows have it absent in the corpus,
  so don't rely on it being universal.
- **No structured `toolUseResult` sidecar in subagent transcripts.** Across
  the corpus, only 36 / 1,325 subagent tool_result rows carry a
  `toolUseResult` field, and in every observed case its value is a string
  (an error message). The structured shapes (BashResult, EditResult,
  AgentRollupResult, …) only appear in main-file rows. The cumulative
  payload of a subagent's work is in the parent's AgentRollupResult.
- First row's `parentUuid` is `null`. The kickoff prompt for the subagent is
  also embedded in the parent's `Agent` `tool_use.input.prompt` and in
  `toolUseResult.prompt`.

Agent types observed (top of long tail): `Explore` (135), `general-purpose`
(93), `gsd-executor` (29), `claude-code-guide` (28), `Plan` (6), various
GSD-framework agents (≤5 each), `statusline-setup` (1).

Subagent meta files:

| Shape | n |
|---|---|
| `{agentType}` only | 129 |
| `{agentType, description}` | 183 |
| `{agentType, description, worktreePath}` | 7 |

---

## 12. Off-loaded tool-results

When a tool returns more than the inline token cap, Claude Code writes the
full output to `<sessionId>/tool-results/<stem>.txt` and replaces the
`tool_result.content` string with:

```
Error: result (62,665 characters) exceeds maximum allowed tokens. Output has been saved to /Users/l.xiang/.claude/projects/<encoded>/<sessionId>/tool-results/<stem>.txt.
Format: JSON array with schema: [{type: string, text: string}]
Use offset and limit parameters to read specific portions.
```

The path is **also** in the structured sidecar:
`toolUseResult.persistedOutputPath` (Bash) or implied by the inline error
message (other tools).

Three observed filename schemes:

| Scheme | n | Use |
|---|---|---|
| `b<random>.txt` (alphanumeric) | 83 | Bash output |
| `toolu_<id>.txt` | 6 | Other tools, keyed by tool_use.id |
| `mcp-<server>-<method>-<unixms>.txt` | 6 | MCP tool responses |

89 off-loaded results across the corpus.

---

## 13. Corpus-validation summary (stress-test results)

What changed when validating my single-session findings against the full
180-session corpus:

| Claim from single-session analysis | Held up? | Notes |
|---|---|---|
| 13 top-level row types | ✅ | exact match; one extra (`progress`) in the existing parser was never observed |
| `isSidechain == true` iff subagent file | ✅ | 0 violations in 30,294 main rows |
| `userType == "external"` | ⚠️  partial | true on rows that have envelope; session-state rows omit it entirely (expected) |
| 8 attachment subtypes | ❌ stronger claim needed | corpus has **22** — I was missing 14 (mcp_instructions_delta, command_permissions, edited_text_file, date_change, file, ultrathink_effort, nested_memory, hook_success / _blocking_error / _cancelled / _non_blocking_error, goal_status, auto_mode_exit, plan_mode_reentry) |
| 4 system subtypes | ❌ stronger claim needed | corpus has **6** — `api_error` (48) and `informational` (4) were missing |
| 2 permission modes | ❌ | corpus has **4**: `auto, plan, acceptEdits, default` |
| 4 queue operations | ✅ | enum matches parser exactly: `enqueue, dequeue, remove, popAll` |
| 1 image source type (`base64`) | ✅ | 8/8 observed user images + 46/46 tool-result images |
| 2 image media types (`png`, `jpeg`) | ✅ | no `gif`, `webp`, `avif` seen yet |
| Bash result shape | ⚠️  more variants | also: `backgroundTaskId`, `assistantAutoBackgrounded`, `returnCodeInterpretation`, `persistedOutputPath`/`persistedOutputSize` |
| TaskUpdate result shape | ⚠️  | also has `verificationNudgeNeeded` (232 rows) and `error` variants |
| `tool_result.content` shapes | ✅ extended | string (10,572), text-array (425), tool_reference-array (355), image-array (46) |
| `caller: {type:"direct"}` universal | ✅ | 11,135/11,135 — no other caller types yet |
| `usage.iterations` always `[]` | ✅ | 16,556/16,556 |
| `usage.service_tier` always `"standard"` | ✅ | 17,636/17,636 |
| `requestId` on every assistant row | ❌ minor | 11 synthetic-model rows have no requestId |
| One `requestId` = one `message.id` | ✅ | 100% — they're 1:1 |
| One `requestId` produces ≥1 assistant rows | ✅ | observed up to 12-block messages |

The schema in [`schema.ts`](../../../server/src/jsonl/schema.ts) reflects the
**corpus-validated** enums and shapes, not the single-session findings.

### 13.1 End-to-end validation

The Zod schema was fed every JSONL row in the corpus:

```
files:           270  (180 main + 90 subagent)
total rows:      41,361
validation throws:   0
fall-through to UnknownRow:  0
```

Every row parses into a typed `ClaudeRow`. Anything the schema doesn't know
about today (e.g. a future Claude Code version's new `type`) still preserves
as `{ type: 'unknown', raw }` so nothing is silently dropped.

### 13.2 Data-volume gap closed

Aggregated over 9,942 tool-result rows in the corpus:

| Side | Size |
|---|---|
| LLM-visible `tool_result.content` (what most viewers show) | 23.35 MB |
| Structured `toolUseResult` sidecar (what the schema now exposes) | **37.45 MB** |

That's **+60% more typed data** the schema makes accessible than reading
`message.content` alone. In particular: 2,113 `structuredPatch` arrays
(real Edit/Write diffs) and 63 `AgentRollupResult` blocks (subagent token
rollups) are now first-class.

---

## 14. Using the schema

```ts
import { ClaudeRowOrUnknownSchema, isUserRow, isToolResultRow } from '@cc-viewer/server/jsonl/schema'

for (const line of jsonlFile.split('\n')) {
  if (!line.trim()) continue
  const row = ClaudeRowOrUnknownSchema.parse(JSON.parse(line))

  if (row.type === 'user' && isToolResultRow(row)) {
    // row.toolUseResult is the structured sidecar — typed via the union.
    // Narrow further by checking which fields are present, e.g.:
    if (row.toolUseResult && 'structuredPatch' in row.toolUseResult) {
      for (const hunk of row.toolUseResult.structuredPatch) {
        // hunk: { oldStart, oldLines, newStart, newLines, lines: string[] }
      }
    }
  }
}
```

Forward compatibility: any unrecognized `type` parses into
`{ type: 'unknown', raw: <original> }` so a future Claude Code version's new
row type is preserved rather than dropped.

---

## 15. Open questions

These are corners I haven't fully chased:

1. **`message.context_management` / `message.container`** — 24 rows seen with
   `context_management: {applied_edits: []}`. The `container` field appeared
   on a handful but I never observed it populated. Reserved for the API's
   computer-use / container features.
2. **`usage.iterations`** — always `[]` in this corpus. Likely populated when
   Anthropic's iterative-reasoning feature is on.
3. **`stop_details`** — declared in the API but never populated (always null
   or absent in the corpus).
4. **Subagent-of-subagent** — checked: no subagent JSONL in the corpus
   contains an `Agent` tool_use, and no nested `subagents/` directories
   exist. So in this corpus subagents do not spawn deeper subagents.
   Whether that's a hard rule or just unobserved is unclear.
5. **`tool_reference` blocks** — only seen from ToolSearch tool_result.
   Schema covers it but I haven't verified it never appears elsewhere.
