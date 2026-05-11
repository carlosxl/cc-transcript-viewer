// packages/server/src/reader/parser.ts
import { z } from 'zod'
import type { ClaudeEvent } from '@cc-viewer/shared'

const BaseEventSchema = z.object({
  uuid: z.string().optional(),
  parentUuid: z.string().nullable().optional(),
  sessionId: z.string().optional(),
  timestamp: z.string().optional(),
  agentId: z.string().optional(),
  isSidechain: z.boolean().optional(),
  version: z.string().optional(),
  cwd: z.string().optional(),
  gitBranch: z.string().optional(),
  slug: z.string().optional(),
  entrypoint: z.string().optional(),
  userType: z.string().optional(),
}).passthrough()

const UsageBlockSchema = z.object({
  input_tokens: z.number(),
  output_tokens: z.number(),
  cache_creation_input_tokens: z.number().default(0),
  cache_read_input_tokens: z.number().default(0),
  cache_creation: z.object({
    ephemeral_1h_input_tokens: z.number(),
    ephemeral_5m_input_tokens: z.number(),
  }).passthrough().optional(),
  service_tier: z.string().optional(),
  server_tool_use: z.object({
    web_search_requests: z.number(),
    web_fetch_requests: z.number(),
  }).passthrough().optional(),
}).passthrough()

const UserEventSchema = BaseEventSchema.extend({
  type: z.literal('user'),
  message: z.object({
    role: z.literal('user'),
    content: z.union([z.string(), z.array(z.unknown())]),
  }).passthrough(),
  promptId: z.string().optional(),
  isMeta: z.boolean().optional(),
}).passthrough()

const AssistantEventSchema = BaseEventSchema.extend({
  type: z.literal('assistant'),
  requestId: z.string().optional(),
  message: z.object({
    id: z.string().optional(),
    model: z.string().optional(),
    role: z.literal('assistant').optional(),
    content: z.array(z.unknown()).optional(),
    stop_reason: z.string().optional(),
    usage: UsageBlockSchema.optional(),
  }).passthrough().optional(),
}).passthrough()

const SystemEventSchema = BaseEventSchema.extend({
  type: z.literal('system'),
  subtype: z.string().optional(),
  content: z.string().optional(),
  level: z.string().optional(),
}).passthrough()

const QueueOperationSchema = BaseEventSchema.extend({
  type: z.literal('queue-operation'),
  operation: z.enum(['enqueue', 'dequeue', 'remove', 'popAll']),
  content: z.string().optional(),
}).passthrough()

const CustomTitleSchema = BaseEventSchema.extend({
  type: z.literal('custom-title'),
  customTitle: z.string(),
}).passthrough()

const AiTitleSchema = BaseEventSchema.extend({
  type: z.literal('ai-title'),
  aiTitle: z.string(),
}).passthrough()

const AgentNameSchema = BaseEventSchema.extend({
  type: z.literal('agent-name'),
  agentName: z.string(),
}).passthrough()

const LastPromptSchema = BaseEventSchema.extend({
  type: z.literal('last-prompt'),
  lastPrompt: z.string(),
}).passthrough()

// Low-relevance known types — acknowledge them so they don't fall into 'unknown'.
// Each is minimally typed with .passthrough() to keep unknown fields.
const AttachmentSchema = BaseEventSchema.extend({ type: z.literal('attachment') }).passthrough()
const FileHistorySchema = BaseEventSchema.extend({ type: z.literal('file-history-snapshot') }).passthrough()
const PermissionModeSchema = BaseEventSchema.extend({ type: z.literal('permission-mode') }).passthrough()
const ProgressSchema = BaseEventSchema.extend({ type: z.literal('progress') }).passthrough()
const PrLinkSchema = BaseEventSchema.extend({ type: z.literal('pr-link') }).passthrough()

const KnownEventsSchema = z.discriminatedUnion('type', [
  UserEventSchema,
  AssistantEventSchema,
  SystemEventSchema,
  QueueOperationSchema,
  CustomTitleSchema,
  AiTitleSchema,
  AgentNameSchema,
  LastPromptSchema,
  AttachmentSchema,
  FileHistorySchema,
  PermissionModeSchema,
  ProgressSchema,
  PrLinkSchema,
])

/**
 * Fallback arm for any JSONL line whose `type` field is not in the known set.
 * Per D-15 / SYS-06 the raw object is preserved as `{ type: 'unknown', raw }`.
 */
const UnknownEventSchema = z.object({
  type: z.string(),
}).passthrough().transform((raw) => ({
  type: 'unknown' as const,
  raw,
}))

/**
 * The parser schema. Tries known types first (discriminated dispatch, O(1)),
 * falls through to the unknown arm for any unrecognized `type` value.
 */
export const ClaudeEventSchema = z.union([
  KnownEventsSchema,
  UnknownEventSchema,
])

export interface ParseResult {
  events: ClaudeEvent[]
  parseWarnings: number
}

/**
 * Parse a single JSONL line. Returns `null` on JSON parse failure or
 * schema violation so callers can count warnings.
 */
export function parseLine(line: string): ClaudeEvent | null {
  let raw: unknown
  try {
    raw = JSON.parse(line)
  } catch {
    return null
  }
  const result = ClaudeEventSchema.safeParse(raw)
  if (!result.success) return null
  return result.data as ClaudeEvent
}

/**
 * Parse an entire JSONL file's content. Malformed / truncated lines (D-16)
 * are skipped and counted; valid lines produce ClaudeEvent entries.
 *
 * Handles: empty files, trailing newline, missing trailing newline (partial
 * last line), blank lines in the middle, arbitrary UTF-8.
 */
export function parseJSONL(fileContent: string): ParseResult {
  const events: ClaudeEvent[] = []
  let parseWarnings = 0

  // Split on \n. The last element is either:
  //  - '' when file ends with \n (filtered by length check)
  //  - a partial line when no trailing \n
  const lines = fileContent.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim()
    if (line.length === 0) continue

    const event = parseLine(line)
    if (event === null) {
      parseWarnings++
      continue
    }
    events.push(event)
  }

  return { events, parseWarnings }
}
