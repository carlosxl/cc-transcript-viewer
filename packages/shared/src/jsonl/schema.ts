/**
 * cc-transcript-viewer — Claude Code JSONL schema (v1)
 *
 * Strongly-typed Zod schema for the JSONL files Claude Code writes under
 * ~/.claude/projects/. Companion human-readable doc lives at
 * packages/shared/src/jsonl/README.md (entity model, examples, corpus stats).
 *
 * Source of truth: census run 2026-05-25 over 180 sessions / 145 MB / 40,131
 * top-level rows. Every enum value and every nested-shape variant in this file
 * was observed in that corpus. Counts in JSDoc are observation frequencies.
 *
 * Layout principles
 * - One discriminated union per "kind of thing", keyed on a literal field.
 * - .passthrough() everywhere unknown fields might appear — Claude Code adds
 *   fields over time; we keep them rather than reject.
 * - One file for ergonomic AI-agent consumption: every shape is reachable
 *   by scrolling, every JSDoc has an @example.
 */

import { z } from 'zod'

// ─── envelope fields ────────────────────────────────────────────────────────
// Almost every row carries these. Optional everywhere because session-state
// rows (last-prompt, ai-title, …) omit the message envelope entirely.

/**
 * Fields stamped on every "message-bearing" row by Claude Code itself.
 * Session-state rows (last-prompt, ai-title, agent-name, custom-title,
 * permission-mode, file-history-snapshot, pr-link, worktree-state,
 * queue-operation) omit ALL of these.
 */
export const EnvelopeSchema = z
  .object({
    /** Stable per-row identity. Unique within a JSONL file. */
    uuid: z.string().optional(),
    /** Previous row's uuid; `null` at the head; absent on session-state rows. */
    parentUuid: z.string().nullable().optional(),
    /** Session identifier — matches the JSONL filename's stem. */
    sessionId: z.string().optional(),
    /** ISO-8601 UTC timestamp. */
    timestamp: z.string().optional(),
    /**
     * Subagent identifier. Set on every row inside a
     * `<sessionId>/subagents/agent-<id>.jsonl` file; absent in the main file.
     */
    agentId: z.string().optional(),
    /**
     * Sidechain marker. `false` on every row in the main JSONL,
     * `true` on every row in a subagent JSONL. Never `true` in main files
     * (validated across the corpus: 30,294 false / 0 true in main files).
     */
    isSidechain: z.boolean().optional(),
    /** Claude Code version that wrote the row, e.g. `"2.1.140"`. */
    version: z.string().optional(),
    /** Process cwd when the row was written. */
    cwd: z.string().optional(),
    /** Git branch active when the row was written. */
    gitBranch: z.string().optional(),
    /**
     * Plan-slug — also the filename under ~/.claude/plans/<slug>.md when a
     * plan is persisted, and the suffix Claude Code uses to label the session.
     */
    slug: z.string().optional(),
    /** Always `"cli"` in the observed corpus. */
    entrypoint: z.string().optional(),
    /** `"external"` for user-driven sessions; absent on session-state rows. */
    userType: z.enum(['external']).optional(),
    /** Some rows tagged with this to indicate not-real-content (e.g. local-command-caveat). */
    isMeta: z.boolean().optional(),
  })
  .passthrough()

// ─── usage block ────────────────────────────────────────────────────────────

/**
 * Token-accounting block on every assistant row's `message.usage`.
 *
 * Two shapes observed:
 *  - Full (16,572 rows): the Claude Code-enriched form
 *    `iterations`, `server_tool_use`, `speed`, `inference_geo` present.
 *  - Lean (1,080 rows): Anthropic-API shape, those four fields absent.
 *
 * @example
 * {
 *   input_tokens: 6,
 *   cache_creation_input_tokens: 19866,
 *   cache_read_input_tokens: 16202,
 *   output_tokens: 198,
 *   cache_creation: { ephemeral_1h_input_tokens: 19866, ephemeral_5m_input_tokens: 0 },
 *   server_tool_use: { web_search_requests: 0, web_fetch_requests: 0 },
 *   service_tier: "standard",
 *   speed: "standard",
 *   inference_geo: "",
 *   iterations: []
 * }
 */
export const UsageBlockSchema = z
  .object({
    input_tokens: z.number(),
    output_tokens: z.number(),
    cache_creation_input_tokens: z.number().default(0),
    cache_read_input_tokens: z.number().default(0),
    /** Split of cache-creation tokens by TTL (1h vs 5m). */
    cache_creation: z
      .object({
        ephemeral_1h_input_tokens: z.number(),
        ephemeral_5m_input_tokens: z.number(),
      })
      .passthrough()
      .optional(),
    /** Only `"standard"` observed (17,636 rows); also `null` in subagent rollups. */
    service_tier: z.string().nullable().optional(),
    /** Built-in server tools, NOT user MCP tools. */
    server_tool_use: z
      .object({
        web_search_requests: z.number(),
        web_fetch_requests: z.number(),
      })
      .passthrough()
      .optional(),
    /** Only `"standard"` observed (16,558 rows); also `null` in some subagent rollups. */
    speed: z.string().nullable().optional(),
    /** Empty-string in 100% of populated rows; sometimes `null` in subagent rollups. */
    inference_geo: z.string().nullable().optional(),
    /** Always `[]` in 16,556/16,556 populated rows; sometimes `null` in subagent rollups. */
    iterations: z.array(z.unknown()).nullable().optional(),
  })
  .passthrough()

// ─── assistant content blocks ───────────────────────────────────────────────

/** Plain-text reply block. */
export const TextBlockSchema = z
  .object({
    type: z.literal('text'),
    text: z.string(),
  })
  .passthrough()

/**
 * Extended-thinking block. `signature` is an opaque token Anthropic returns;
 * the JSONL keeps it verbatim.
 */
export const ThinkingBlockSchema = z
  .object({
    type: z.literal('thinking'),
    thinking: z.string(),
    signature: z.string(),
  })
  .passthrough()

/**
 * Tool-invocation block. `caller` was always `{type:"direct"}` in 11,135/11,135
 * observed rows; reserved for future MCP-style indirection.
 *
 * @example
 * { type: "tool_use", id: "toolu_01ABC…", name: "Read",
 *   input: { file_path: "/tmp/a.md" }, caller: { type: "direct" } }
 */
export const ToolUseBlockSchema = z
  .object({
    type: z.literal('tool_use'),
    id: z.string(),
    name: z.string(),
    input: z.record(z.string(), z.unknown()),
    caller: z
      .object({ type: z.enum(['direct']) })
      .passthrough()
      .optional(),
  })
  .passthrough()

export const AssistantContentBlockSchema = z.discriminatedUnion('type', [
  TextBlockSchema,
  ThinkingBlockSchema,
  ToolUseBlockSchema,
])

// ─── user content blocks ────────────────────────────────────────────────────

/**
 * Inline image block. Appears in:
 *  1. user `message.content` when the user pastes / drags an image — the text
 *     block before it contains a `[Image #N]` placeholder (1-indexed).
 *  2. nested inside `tool_result.content` (chrome-devtools screenshots etc.).
 *
 * @example
 * { type: "image",
 *   source: { type: "base64", media_type: "image/png", data: "iVBOR…" } }
 */
export const ImageBlockSchema = z
  .object({
    type: z.literal('image'),
    source: z
      .object({
        /** Only `"base64"` observed. */
        type: z.literal('base64'),
        /** Observed: `"image/png"`, `"image/jpeg"`. */
        media_type: z.string(),
        /** Raw base64-encoded bytes. May be 100s of KB. */
        data: z.string(),
      })
      .passthrough(),
  })
  .passthrough()

/** ToolSearch returns these — they reference tools by name, not by call id. */
export const ToolReferenceBlockSchema = z
  .object({
    type: z.literal('tool_reference'),
    tool_name: z.string(),
  })
  .passthrough()

/**
 * Inner content of a `tool_result` block.
 * - When a tool returns plain text → string.
 * - When a tool returns structured content → array of typed blocks.
 *
 * Inner array element type census (10,572 string + 425 text + 355 tool_reference
 * + 46 image cases).
 */
export const ToolResultContentSchema = z.union([
  z.string(),
  z.array(
    z.discriminatedUnion('type', [
      TextBlockSchema,
      ImageBlockSchema,
      ToolReferenceBlockSchema,
    ]),
  ),
])

/**
 * Tool-result block — the `user` role's way to reply to an assistant tool_use.
 *
 * Note `is_error` is a *flag*, not an alternate shape: 4,471 rows carry it,
 * 6,669 do not.
 */
export const ToolResultBlockSchema = z
  .object({
    type: z.literal('tool_result'),
    /** Matches the `assistant.message.content[].id` it answers. */
    tool_use_id: z.string(),
    content: ToolResultContentSchema,
    /** Present when the tool errored. */
    is_error: z.boolean().optional(),
  })
  .passthrough()

export const UserContentBlockSchema = z.discriminatedUnion('type', [
  ToolResultBlockSchema,
  TextBlockSchema,
  ImageBlockSchema,
])

// ─── structured patch (Edit/Write toolUseResult) ────────────────────────────

/**
 * A single hunk in the diff Claude Code computed when applying Edit/Write.
 * Standard unified-diff vocabulary; `lines` are prefixed with ` ` / `+` / `-`.
 */
export const StructuredPatchHunkSchema = z
  .object({
    oldStart: z.number(),
    oldLines: z.number(),
    newStart: z.number(),
    newLines: z.number(),
    lines: z.array(z.string()),
  })
  .passthrough()

// ─── toolUseResult variants ─────────────────────────────────────────────────
// Each user row that answers an assistant tool_use also carries a
// `toolUseResult` *sidecar*: structured fields parallel to what the LLM saw.
// THIS IS THE BIGGEST GAP IN MOST VIEWERS. Across the corpus, toolUseResult
// is the only place structured diffs, task transitions, agent rollups,
// AskUserQuestion answers, and stderr/stdout splits live.
//
// The discriminator is "shape" not a literal — we use a union, narrowing
// happens by which fields are present.

/** Bash, BashOutput, KillShell, run_in_background variants. */
export const BashResultSchema = z
  .object({
    interrupted: z.boolean(),
    isImage: z.boolean(),
    noOutputExpected: z.boolean(),
    stderr: z.string(),
    stdout: z.string(),
    /** Present for run_in_background, also assistantAutoBackgrounded cases. */
    backgroundTaskId: z.string().optional(),
    /** Set when Claude Code auto-backgrounded a long bash. */
    assistantAutoBackgrounded: z.boolean().optional(),
    /** e.g. `"No matches found"`. */
    returnCodeInterpretation: z.string().nullable().optional(),
    /** When stdout was too large to inline. */
    persistedOutputPath: z.string().optional(),
    persistedOutputSize: z.number().optional(),
  })
  .passthrough()

/** Read of a single file → `{ type: "text", file: {...} }`. */
export const ReadFileResultSchema = z
  .object({
    type: z.literal('text'),
    file: z
      .object({
        filePath: z.string(),
        content: z.string(),
        numLines: z.number(),
        startLine: z.number(),
        totalLines: z.number(),
      })
      .passthrough(),
  })
  .passthrough()

/** Edit toolUseResult — the structured diff lives in `structuredPatch`. */
export const EditResultSchema = z
  .object({
    filePath: z.string(),
    oldString: z.string(),
    newString: z.string(),
    replaceAll: z.boolean().nullable(),
    originalFile: z.string(),
    structuredPatch: z.array(StructuredPatchHunkSchema),
    userModified: z.boolean(),
  })
  .passthrough()

/** Write toolUseResult — `type` differentiates create vs overwrite. */
export const WriteResultSchema = z
  .object({
    /** `"create"` for new files; `"update"` for overwrites. */
    type: z.enum(['create', 'update']),
    filePath: z.string(),
    content: z.string(),
    originalFile: z.string(),
    structuredPatch: z.array(StructuredPatchHunkSchema),
    userModified: z.boolean(),
  })
  .passthrough()

/** Glob / Grep / multi-file Read result. */
export const MultiFileResultSchema = z
  .object({
    filenames: z.array(z.string()),
    /** `"content"` (Grep -e search) vs `"files_with_matches"` (Grep -l). */
    mode: z.enum(['content', 'files_with_matches']),
    numFiles: z.number(),
    content: z.string().optional(),
    numLines: z.number().optional(),
    appliedLimit: z.number().optional(),
    durationMs: z.number().optional(),
    truncated: z.boolean().optional(),
  })
  .passthrough()

/** TaskCreate result. */
export const TaskCreateResultSchema = z
  .object({
    task: z.object({ id: z.string(), subject: z.string() }).passthrough(),
  })
  .passthrough()

/** TaskUpdate result. */
export const TaskUpdateResultSchema = z
  .object({
    statusChange: z
      .object({
        from: z.enum(['pending', 'in_progress', 'completed']),
        to: z.enum(['pending', 'in_progress', 'completed']),
      })
      .optional(),
    success: z.boolean(),
    taskId: z.string(),
    updatedFields: z.array(z.string()),
    verificationNudgeNeeded: z.boolean().optional(),
    error: z.string().optional(),
  })
  .passthrough()

/** TaskList result. */
export const TaskListResultSchema = z
  .object({
    tasks: z.array(
      z
        .object({
          id: z.string(),
          subject: z.string(),
          status: z.enum(['pending', 'in_progress', 'completed']),
        })
        .passthrough(),
    ),
  })
  .passthrough()

/** Agent (Task / subagent dispatch) rollup. */
export const AgentRollupResultSchema = z
  .object({
    agentId: z.string(),
    agentType: z.string(),
    status: z.string(),
    prompt: z.string(),
    content: z.union([z.string(), z.array(z.unknown())]),
    totalDurationMs: z.number(),
    totalTokens: z.number(),
    totalToolUseCount: z.number().optional(),
    usage: UsageBlockSchema.optional(),
    toolStats: z
      .object({
        readCount: z.number(),
        searchCount: z.number(),
        bashCount: z.number(),
        editFileCount: z.number(),
        linesAdded: z.number(),
        linesRemoved: z.number(),
        otherToolCount: z.number(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough()

/** Async-launched Agent (returns immediately, output file is written later). */
export const AgentLaunchResultSchema = z
  .object({
    agentId: z.string(),
    description: z.string(),
    prompt: z.string(),
    /** e.g. `"async_launched"`. */
    status: z.string(),
    isAsync: z.literal(true),
    /** Absolute path to the not-yet-written stdout file. */
    outputFile: z.string(),
    canReadOutputFile: z.boolean(),
  })
  .passthrough()

/** ToolSearch result. */
export const ToolSearchResultSchema = z
  .object({
    matches: z.array(z.string()),
    query: z.string(),
    total_deferred_tools: z.number(),
  })
  .passthrough()

/** AskUserQuestion result — questions and answers in one place. */
export const AskUserQuestionResultSchema = z
  .object({
    questions: z.array(
      z
        .object({
          question: z.string(),
          header: z.string().optional(),
          options: z.array(
            z.object({ label: z.string(), description: z.string() }).passthrough(),
          ),
          multiSelect: z.boolean(),
        })
        .passthrough(),
    ),
    /** keyed by question text */
    answers: z.record(z.string(), z.string()),
    /** present when the user added per-question notes. */
    annotations: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough()

/** ExitPlanMode — `plan` is markdown; `filePath` is where it persisted. */
export const ExitPlanResultSchema = z
  .object({
    plan: z.string(),
    filePath: z.string(),
    hasTaskTool: z.boolean(),
    isAgent: z.boolean(),
  })
  .passthrough()

/** WebSearch result. */
export const WebSearchResultSchema = z
  .object({
    query: z.string(),
    durationSeconds: z.number(),
    results: z.array(
      z
        .object({
          tool_use_id: z.string(),
          content: z.array(
            z.object({ title: z.string(), url: z.string() }).passthrough(),
          ),
        })
        .passthrough(),
    ),
  })
  .passthrough()

/** WebFetch result. */
export const WebFetchResultSchema = z
  .object({
    url: z.string(),
    code: z.number(),
    codeText: z.string(),
    bytes: z.number(),
    durationMs: z.number(),
    result: z.string(),
  })
  .passthrough()

/** Slash-command dispatched into a subagent. */
export const SlashCommandAgentResultSchema = z
  .object({
    agentId: z.string(),
    commandName: z.string(),
    status: z.string(),
    success: z.boolean(),
    result: z.string(),
  })
  .passthrough()

/** Generic command grant — `/permissions` etc. */
export const CommandPermissionResultSchema = z
  .object({
    allowedTools: z.array(z.string()).optional(),
    commandName: z.string(),
    success: z.boolean(),
  })
  .passthrough()

/** ExitWorktree result. */
export const ExitWorktreeResultSchema = z
  .object({
    action: z.string(),
    originalCwd: z.string(),
    worktreePath: z.string(),
    worktreeBranch: z.string(),
    discardedFiles: z.number(),
    discardedCommits: z.number(),
    message: z.string(),
  })
  .passthrough()

/**
 * Union of all known structured shapes carried under `.toolUseResult` on a
 * `user` row. The remaining 580 rows in the corpus hit one of:
 *  - `string` — error/refusal text (`"Error: File has not been read yet…"`).
 *  - `array` — direct array of `{type:"text"}` / `{type:"image"}` blocks.
 *  - other less-frequent shapes — preserved by .passthrough() on the union.
 *
 * Detection strategy: read which fields are present; do not rely on a tag.
 */
export const ToolUseResultSchema = z.union([
  BashResultSchema,
  ReadFileResultSchema,
  EditResultSchema,
  WriteResultSchema,
  MultiFileResultSchema,
  TaskCreateResultSchema,
  TaskUpdateResultSchema,
  TaskListResultSchema,
  AgentRollupResultSchema,
  AgentLaunchResultSchema,
  ToolSearchResultSchema,
  AskUserQuestionResultSchema,
  ExitPlanResultSchema,
  WebSearchResultSchema,
  WebFetchResultSchema,
  SlashCommandAgentResultSchema,
  CommandPermissionResultSchema,
  ExitWorktreeResultSchema,
  // fallback arms
  z.string(),
  z.array(z.discriminatedUnion('type', [TextBlockSchema, ImageBlockSchema])),
  z.object({}).passthrough(),
])

// ─── attachment subtypes ────────────────────────────────────────────────────
// `attachment` rows ride alongside a user prompt and carry the additional
// context Claude saw. The current parser stores them as raw passthrough;
// here we type each variant.

/** Directory listing from an `@.foo` mention. */
export const DirectoryAttachmentSchema = z
  .object({
    type: z.literal('directory'),
    path: z.string(),
    displayPath: z.string(),
    /** newline-separated listing. */
    content: z.string(),
  })
  .passthrough()

/** File contents from an `@file.foo` mention. */
export const FileAttachmentSchema = z
  .object({
    type: z.literal('file'),
    filename: z.string(),
    displayPath: z.string(),
    /** A stringified array of content blocks. */
    content: z.unknown(),
  })
  .passthrough()

/** Edited-text-file mention with line-numbered snippet. */
export const EditedTextFileAttachmentSchema = z
  .object({
    type: z.literal('edited_text_file'),
    filename: z.string(),
    /** `1\t<line>\n2\t<line>\n…` */
    snippet: z.string(),
  })
  .passthrough()

/**
 * Nested CLAUDE.md memory pulled in for context.
 *
 * Two shapes observed: a flat `{path, displayPath, content}` form and a
 * richer `content: {type, path, content, contentDiffersFromDisk, parent?}`
 * form (the auto-memory system).
 */
export const NestedMemoryAttachmentSchema = z
  .object({
    type: z.literal('nested_memory'),
    path: z.string(),
    displayPath: z.string(),
    content: z.union([
      z.string(),
      z
        .object({
          type: z.string(),
          path: z.string(),
          content: z.string(),
          contentDiffersFromDisk: z.boolean(),
          parent: z.unknown().optional(),
        })
        .passthrough(),
    ]),
  })
  .passthrough()

/** Skills-listing block (initial pass + later updates). */
export const SkillListingAttachmentSchema = z
  .object({
    type: z.literal('skill_listing'),
    skillCount: z.number(),
    isInitial: z.boolean(),
    content: z.string(),
  })
  .passthrough()

/** Deferred-tools catalogue delta. */
export const DeferredToolsDeltaAttachmentSchema = z
  .object({
    type: z.literal('deferred_tools_delta'),
    addedNames: z.array(z.string()),
    addedLines: z.array(z.string()),
    removedNames: z.array(z.string()),
    /** Older sessions omit this field (added in a later Claude Code version). */
    readdedNames: z.array(z.string()).optional(),
  })
  .passthrough()

/** MCP-instructions delta (added blocks of system-prompt text). */
export const McpInstructionsDeltaAttachmentSchema = z
  .object({
    type: z.literal('mcp_instructions_delta'),
    addedNames: z.array(z.string()),
    removedNames: z.array(z.string()),
    addedBlocks: z.array(z.unknown()),
  })
  .passthrough()

/** Task-list reminder (full snapshot at that point). */
export const TaskReminderAttachmentSchema = z
  .object({
    type: z.literal('task_reminder'),
    itemCount: z.number(),
    content: z.array(
      z
        .object({
          id: z.string(),
          subject: z.string(),
          description: z.string(),
          /** Absent in older sessions (≈ 2% of rows). */
          activeForm: z.string().optional(),
          status: z.enum(['pending', 'in_progress', 'completed']),
          blocks: z.array(z.unknown()),
          blockedBy: z.array(z.unknown()),
          owner: z.string().optional(),
        })
        .passthrough(),
    ),
  })
  .passthrough()

/** Auto-mode entered (continuous-execution mode). */
export const AutoModeAttachmentSchema = z
  .object({
    type: z.literal('auto_mode'),
    reminderType: z.string(),
  })
  .passthrough()

/** Auto-mode exited. */
export const AutoModeExitAttachmentSchema = z
  .object({ type: z.literal('auto_mode_exit') })
  .passthrough()

/** Plan-mode entered. */
export const PlanModeAttachmentSchema = z
  .object({
    type: z.literal('plan_mode'),
    reminderType: z.string(),
    isSubAgent: z.boolean(),
    planFilePath: z.string(),
    planExists: z.boolean(),
  })
  .passthrough()

/** Plan-mode exited. */
export const PlanModeExitAttachmentSchema = z
  .object({
    type: z.literal('plan_mode_exit'),
    planFilePath: z.string(),
    planExists: z.boolean(),
  })
  .passthrough()

/** Plan-mode re-entered. */
export const PlanModeReentryAttachmentSchema = z
  .object({ type: z.literal('plan_mode_reentry'), planFilePath: z.string() })
  .passthrough()

/** Ultrathink-effort flag (extended thinking budget bumped). */
export const UltrathinkEffortAttachmentSchema = z
  .object({ type: z.literal('ultrathink_effort') })
  .passthrough()

/** A queued command (e.g. background-task completion notification). */
export const QueuedCommandAttachmentSchema = z
  .object({
    type: z.literal('queued_command'),
    commandMode: z.string(),
    prompt: z.string(),
  })
  .passthrough()

/** Calendar date roll-over (UTC midnight). */
export const DateChangeAttachmentSchema = z
  .object({ type: z.literal('date_change'), newDate: z.string() })
  .passthrough()

/** `/permissions allow` (set of `allowedTools` patterns). */
export const CommandPermissionsAttachmentSchema = z
  .object({
    type: z.literal('command_permissions'),
    allowedTools: z.array(z.string()),
  })
  .passthrough()

/**
 * Goal-status row (used by /loop and goal-tracking skills).
 * Two shapes observed: "checking" form (sentinel-only) and "evaluated" form
 * (with `met`, `reason`, `iterations`, `durationMs`, `tokens`).
 */
export const GoalStatusAttachmentSchema = z
  .object({
    type: z.literal('goal_status'),
    condition: z.string(),
    met: z.boolean(),
    sentinel: z.boolean().optional(),
    reason: z.string().optional(),
    iterations: z.number().optional(),
    durationMs: z.number().optional(),
    tokens: z.number().optional(),
  })
  .passthrough()

const HookAttachmentBase = z.object({
  hookEvent: z.string(),
  hookName: z.string(),
  toolUseID: z.string(),
  command: z.string().optional(),
  durationMs: z.number().optional(),
})

export const HookSuccessAttachmentSchema = HookAttachmentBase.extend({
  type: z.literal('hook_success'),
  exitCode: z.number(),
  content: z.string().optional(),
  stdout: z.string(),
  stderr: z.string(),
}).passthrough()

export const HookBlockingErrorAttachmentSchema = HookAttachmentBase.extend({
  type: z.literal('hook_blocking_error'),
  /**
   * Either the raw error message (older shape) or a structured payload
   * `{blockingError: string, command: string}` (newer shape).
   */
  blockingError: z.union([
    z.string(),
    z
      .object({ blockingError: z.string(), command: z.string() })
      .passthrough(),
  ]),
}).passthrough()

export const HookNonBlockingErrorAttachmentSchema = HookAttachmentBase.extend({
  type: z.literal('hook_non_blocking_error'),
  exitCode: z.number(),
  stdout: z.string(),
  stderr: z.string(),
}).passthrough()

export const HookCancelledAttachmentSchema = HookAttachmentBase.extend({
  type: z.literal('hook_cancelled'),
}).passthrough()

export const AttachmentPayloadSchema = z.discriminatedUnion('type', [
  DirectoryAttachmentSchema,
  FileAttachmentSchema,
  EditedTextFileAttachmentSchema,
  NestedMemoryAttachmentSchema,
  SkillListingAttachmentSchema,
  DeferredToolsDeltaAttachmentSchema,
  McpInstructionsDeltaAttachmentSchema,
  TaskReminderAttachmentSchema,
  AutoModeAttachmentSchema,
  AutoModeExitAttachmentSchema,
  PlanModeAttachmentSchema,
  PlanModeExitAttachmentSchema,
  PlanModeReentryAttachmentSchema,
  UltrathinkEffortAttachmentSchema,
  QueuedCommandAttachmentSchema,
  DateChangeAttachmentSchema,
  CommandPermissionsAttachmentSchema,
  GoalStatusAttachmentSchema,
  HookSuccessAttachmentSchema,
  HookBlockingErrorAttachmentSchema,
  HookNonBlockingErrorAttachmentSchema,
  HookCancelledAttachmentSchema,
])

// ─── top-level rows ─────────────────────────────────────────────────────────

/** User row — real prompt, slash command, tool result, or local-command meta. */
export const UserRowSchema = EnvelopeSchema.extend({
  type: z.literal('user'),
  message: z
    .object({
      role: z.literal('user'),
      /**
       * Two flavours:
       *  - string: prompt text OR wrapping markup (`<command-name>…</command-name>`,
       *    `<local-command-caveat>…`, `<task-notification>…`, `<bash-input>…`).
       *  - array of UserContentBlock: tool_result and/or text and/or image blocks.
       *    Multi-image attaches show as `text + image (+ image)+`.
       */
      content: z.union([z.string(), z.array(UserContentBlockSchema)]),
    })
    .passthrough(),
  /** Groups every row traceable to one prompt submission. */
  promptId: z.string().optional(),
  /** When this user row is a tool_result, points to the assistant uuid that called the tool. */
  sourceToolAssistantUUID: z.string().optional(),
  /**
   * Parallel, structured shape of the tool result the LLM received as text.
   * Present on virtually every tool-result user row. The richest field in the JSONL.
   */
  toolUseResult: ToolUseResultSchema.optional(),
}).passthrough()

/** Assistant row — one row per content block emitted by the LLM. */
export const AssistantRowSchema = EnvelopeSchema.extend({
  type: z.literal('assistant'),
  /**
   * Anthropic API request id. SAME `requestId` may produce many rows
   * (one per content block); the rows share `message.id` too. Use this
   * (or `message.id`) to reconstitute "one LLM message".
   */
  requestId: z.string().optional(),
  /** Set on every row inside a subagent JSONL — the agent type (`"Explore"`). */
  attributionAgent: z.string().optional(),
  /**
   * True when this assistant row is a SYNTHETIC error from the CLI itself —
   * not LLM output. The `message.model` will be the literal string
   * `"<synthetic>"` and `content[0].text` carries the error (e.g.
   * `"API Error: 529 Overloaded ..."`). Distinct from a normal tool failure.
   */
  isApiErrorMessage: z.boolean().optional(),
  message: z
    .object({
      type: z.literal('message').optional(),
      role: z.literal('assistant').optional(),
      /** Anthropic message id. SAME id repeated across N rows = N content blocks. */
      id: z.string().optional(),
      model: z.string().optional(),
      content: z.array(AssistantContentBlockSchema).optional(),
      stop_reason: z
        .enum(['tool_use', 'end_turn', 'stop_sequence', 'max_tokens'])
        .nullable()
        .optional(),
      stop_sequence: z.string().nullable().optional(),
      stop_details: z.unknown().optional(),
      usage: UsageBlockSchema.optional(),
      /** Seen on a small number of rows — `{applied_edits: [...]}` so far. */
      context_management: z.unknown().optional(),
      container: z.unknown().optional(),
    })
    .passthrough(),
}).passthrough()

/** Sub-types observed under `type: "system"`. */
export const SystemSubtypeEnum = z.enum([
  'stop_hook_summary',
  'turn_duration',
  'away_summary',
  'local_command',
  'api_error',
  'informational',
  /**
   * Emitted by `/compact` (or auto-compact). Carries `compactMetadata`
   * (trigger / pre+post tokens / durationMs) and a `logicalParentUuid` that
   * points back to the last pre-compact prompt so we can chain the new and
   * old halves of the conversation.
   */
  'compact_boundary',
])

/** System row — derived events emitted by Claude Code (not the LLM). */
export const SystemRowSchema = EnvelopeSchema.extend({
  type: z.literal('system'),
  subtype: SystemSubtypeEnum,
  /** Free-form payload, shape varies by subtype. See README §System. */
  content: z.string().optional(),
  level: z.enum(['info', 'warning', 'error', 'suggestion']).optional(),
  // stop_hook_summary
  hookCount: z.number().optional(),
  hookInfos: z
    .array(
      z
        .object({ command: z.string(), durationMs: z.number().optional() })
        .passthrough(),
    )
    .optional(),
  hookErrors: z.array(z.unknown()).optional(),
  preventedContinuation: z.boolean().optional(),
  stopReason: z.string().optional(),
  hasOutput: z.boolean().optional(),
  toolUseID: z.string().optional(),
  // turn_duration
  durationMs: z.number().optional(),
  messageCount: z.number().optional(),
  // api_error
  error: z.unknown().optional(),
  cause: z.unknown().nullable().optional(),
  maxRetries: z.number().optional(),
  retryAttempt: z.number().optional(),
  retryInMs: z.number().optional(),
  // compact_boundary
  compactMetadata: z
    .object({
      trigger: z.string().optional(),
      preTokens: z.number().optional(),
      postTokens: z.number().optional(),
      durationMs: z.number().optional(),
    })
    .passthrough()
    .optional(),
  logicalParentUuid: z.string().optional(),
}).passthrough()

/** Attachment row — a context block riding alongside a user prompt. */
export const AttachmentRowSchema = EnvelopeSchema.extend({
  type: z.literal('attachment'),
  attachment: AttachmentPayloadSchema,
}).passthrough()

// ─── session-state rows (no envelope) ───────────────────────────────────────
// These rows ALL omit uuid/parentUuid/timestamp/isSidechain. They are
// state snapshots, not chat history. Treat them as "fold to last value"
// when rendering.

export const AiTitleRowSchema = z
  .object({
    type: z.literal('ai-title'),
    aiTitle: z.string(),
    sessionId: z.string(),
  })
  .passthrough()

export const CustomTitleRowSchema = z
  .object({
    type: z.literal('custom-title'),
    customTitle: z.string(),
    sessionId: z.string(),
  })
  .passthrough()

export const AgentNameRowSchema = z
  .object({
    type: z.literal('agent-name'),
    agentName: z.string(),
    sessionId: z.string(),
  })
  .passthrough()

export const PermissionModeEnum = z.enum([
  'auto',
  'plan',
  'acceptEdits',
  'default',
])

export const PermissionModeRowSchema = z
  .object({
    type: z.literal('permission-mode'),
    permissionMode: PermissionModeEnum,
    sessionId: z.string(),
  })
  .passthrough()

export const LastPromptRowSchema = z
  .object({
    type: z.literal('last-prompt'),
    lastPrompt: z.string().optional(),
    leafUuid: z.string().optional(),
    sessionId: z.string(),
  })
  .passthrough()

export const PrLinkRowSchema = z
  .object({
    type: z.literal('pr-link'),
    prNumber: z.number(),
    prRepository: z.string(),
    prUrl: z.string(),
    sessionId: z.string(),
    timestamp: z.string().optional(),
  })
  .passthrough()

export const WorktreeStateRowSchema = z
  .object({
    type: z.literal('worktree-state'),
    sessionId: z.string(),
    /** Null on a session that has exited its worktree (cleanup state). */
    worktreeSession: z
      .object({
        originalBranch: z.string(),
        originalCwd: z.string(),
        originalHeadCommit: z.string(),
        sessionId: z.string(),
        worktreeBranch: z.string(),
        worktreeName: z.string(),
        worktreePath: z.string(),
      })
      .passthrough()
      .nullable(),
  })
  .passthrough()

export const QueueOperationRowSchema = z
  .object({
    type: z.literal('queue-operation'),
    operation: z.enum(['enqueue', 'dequeue', 'remove', 'popAll']),
    sessionId: z.string(),
    timestamp: z.string().optional(),
    content: z.string().optional(),
  })
  .passthrough()

export const FileHistorySnapshotRowSchema = z
  .object({
    type: z.literal('file-history-snapshot'),
    isSnapshotUpdate: z.boolean(),
    messageId: z.string(),
    snapshot: z
      .object({
        messageId: z.string(),
        timestamp: z.string(),
        /**
         * Map of relative-path → backup metadata. The actual content lives at
         * `~/.claude/file-history/<sessionId>/<backupFileName>`.
         */
        trackedFileBackups: z.record(
          z.string(),
          z
            .object({
              /** Null when the file is tracked but no backup yet (52% of corpus rows). */
              backupFileName: z.string().nullable(),
              backupTime: z.string(),
              version: z.number(),
            })
            .passthrough(),
        ),
      })
      .passthrough(),
  })
  .passthrough()

// ─── master discriminated union ─────────────────────────────────────────────

/**
 * Every row Claude Code writes to a session JSONL file is one of these.
 * Discriminated by the top-level `type` field.
 *
 * Subagent rows (under `<sessionId>/subagents/agent-<id>.jsonl`) use the same
 * union BUT always carry `agentId` + `isSidechain: true`, and assistant rows
 * additionally carry `attributionAgent`.
 */
export const ClaudeRowSchema = z.discriminatedUnion('type', [
  UserRowSchema,
  AssistantRowSchema,
  SystemRowSchema,
  AttachmentRowSchema,
  AiTitleRowSchema,
  CustomTitleRowSchema,
  AgentNameRowSchema,
  PermissionModeRowSchema,
  LastPromptRowSchema,
  PrLinkRowSchema,
  WorktreeStateRowSchema,
  QueueOperationRowSchema,
  FileHistorySnapshotRowSchema,
])

/** Forward-compatibility arm — unrecognized `type` values are preserved. */
export const UnknownRowSchema = z
  .object({ type: z.string() })
  .passthrough()
  .transform((raw) => ({ type: 'unknown' as const, raw }))

export const ClaudeRowOrUnknownSchema = z.union([ClaudeRowSchema, UnknownRowSchema])

// ─── inferred TS types ──────────────────────────────────────────────────────

export type Envelope = z.infer<typeof EnvelopeSchema>
export type UsageBlock = z.infer<typeof UsageBlockSchema>

export type TextBlock = z.infer<typeof TextBlockSchema>
export type ThinkingBlock = z.infer<typeof ThinkingBlockSchema>
export type ToolUseBlock = z.infer<typeof ToolUseBlockSchema>
export type AssistantContentBlock = z.infer<typeof AssistantContentBlockSchema>

export type ImageBlock = z.infer<typeof ImageBlockSchema>
export type ToolReferenceBlock = z.infer<typeof ToolReferenceBlockSchema>
export type ToolResultBlock = z.infer<typeof ToolResultBlockSchema>
export type UserContentBlock = z.infer<typeof UserContentBlockSchema>

export type StructuredPatchHunk = z.infer<typeof StructuredPatchHunkSchema>

export type BashResult = z.infer<typeof BashResultSchema>
export type ReadFileResult = z.infer<typeof ReadFileResultSchema>
export type EditResult = z.infer<typeof EditResultSchema>
export type WriteResult = z.infer<typeof WriteResultSchema>
export type MultiFileResult = z.infer<typeof MultiFileResultSchema>
export type TaskCreateResult = z.infer<typeof TaskCreateResultSchema>
export type TaskUpdateResult = z.infer<typeof TaskUpdateResultSchema>
export type TaskListResult = z.infer<typeof TaskListResultSchema>
export type AgentRollupResult = z.infer<typeof AgentRollupResultSchema>
export type AgentLaunchResult = z.infer<typeof AgentLaunchResultSchema>
export type ToolSearchResult = z.infer<typeof ToolSearchResultSchema>
export type AskUserQuestionResult = z.infer<typeof AskUserQuestionResultSchema>
export type ExitPlanResult = z.infer<typeof ExitPlanResultSchema>
export type WebSearchResult = z.infer<typeof WebSearchResultSchema>
export type WebFetchResult = z.infer<typeof WebFetchResultSchema>
export type ToolUseResult = z.infer<typeof ToolUseResultSchema>

export type AttachmentPayload = z.infer<typeof AttachmentPayloadSchema>

export type UserRow = z.infer<typeof UserRowSchema>
export type AssistantRow = z.infer<typeof AssistantRowSchema>
export type SystemRow = z.infer<typeof SystemRowSchema>
export type AttachmentRow = z.infer<typeof AttachmentRowSchema>
export type AiTitleRow = z.infer<typeof AiTitleRowSchema>
export type CustomTitleRow = z.infer<typeof CustomTitleRowSchema>
export type AgentNameRow = z.infer<typeof AgentNameRowSchema>
export type PermissionModeRow = z.infer<typeof PermissionModeRowSchema>
export type LastPromptRow = z.infer<typeof LastPromptRowSchema>
export type PrLinkRow = z.infer<typeof PrLinkRowSchema>
export type WorktreeStateRow = z.infer<typeof WorktreeStateRowSchema>
export type QueueOperationRow = z.infer<typeof QueueOperationRowSchema>
export type FileHistorySnapshotRow = z.infer<typeof FileHistorySnapshotRowSchema>

export type ClaudeRow = z.infer<typeof ClaudeRowSchema>
export type UnknownRow = { type: 'unknown'; raw: unknown }
export type ClaudeRowOrUnknown = ClaudeRow | UnknownRow

// ─── subagent meta file ─────────────────────────────────────────────────────

/**
 * Companion JSON sidecar for each subagent JSONL:
 * `<sessionId>/subagents/agent-<id>.meta.json`.
 * Three observed shapes — `agentType` is always present.
 *
 * @example { "agentType": "Explore", "description": "Locate transcript pane code" }
 */
export const SubagentMetaSchema = z
  .object({
    agentType: z.string(),
    description: z.string().optional(),
    /** Set when the subagent runs in an isolated git worktree. */
    worktreePath: z.string().optional(),
  })
  .passthrough()

export type SubagentMeta = z.infer<typeof SubagentMetaSchema>

// ─── narrow predicates (cheap, common) ──────────────────────────────────────

export const isUserRow = (r: ClaudeRow): r is UserRow => r.type === 'user'
export const isAssistantRow = (r: ClaudeRow): r is AssistantRow => r.type === 'assistant'
export const isSystemRow = (r: ClaudeRow): r is SystemRow => r.type === 'system'
export const isAttachmentRow = (r: ClaudeRow): r is AttachmentRow => r.type === 'attachment'

/** True when the user row is a tool-result (i.e. answers an assistant tool_use). */
export const isToolResultRow = (r: UserRow): boolean =>
  typeof r.message.content !== 'string' &&
  r.message.content.length > 0 &&
  r.message.content[0]!.type === 'tool_result'

/** True when the user row is a real human-typed prompt (no special markup). */
export const isHumanPromptRow = (r: UserRow): boolean => {
  if (typeof r.message.content === 'string') {
    const s = r.message.content
    return (
      !s.startsWith('<command-name>') &&
      !s.startsWith('<local-command-') &&
      !s.startsWith('<task-notification>') &&
      !s.startsWith('<bash-input>') &&
      !s.startsWith('<bash-stdout>')
    )
  }
  return r.message.content.some((b) => b.type === 'text' || b.type === 'image')
}
