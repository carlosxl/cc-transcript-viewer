// packages/server/src/reader/normalizer.ts
import type {
  ClaudeEvent,
  Turn,
  ToolUse,
  ToolResult,
  UsageBlock,
} from '@cc-viewer/shared'

/**
 * Convert a list of parsed ClaudeEvents into the UI-ready Turn[] shape.
 * Per D-17, all downstream code consumes Turn[] — this is the only place that
 * knows how to destructure raw event message.content arrays.
 *
 * Filter rule: only message-bearing events (user, assistant, system) become
 * Turns. Metadata events (custom-title, last-prompt, queue-operation, etc.)
 * inform session-level metadata elsewhere but do not produce turns.
 *
 * Unknown events (from D-15's unknown arm) become meta-turns so the UI can
 * display "unknown event (type: X)" rather than silently dropping them.
 */
export function eventsToTurns(events: ClaudeEvent[]): Turn[] {
  const turns: Turn[] = []

  for (let i = 0; i < events.length; i++) {
    const turn = eventToTurn(events[i]!, i)
    if (turn !== null) turns.push(turn)
  }

  return turns
}

function eventToTurn(event: ClaudeEvent, index: number): Turn | null {
  switch (event.type) {
    case 'user':
      return normalizeUserTurn(event, index)
    case 'assistant':
      return normalizeAssistantTurn(event, index)
    case 'system':
      return normalizeSystemTurn(event, index)
    case 'unknown':
      return normalizeUnknownTurn(event, index)
    default:
      // Metadata events (custom-title, last-prompt, queue-operation, attachment,
      // agent-name, ai-title, file-history-snapshot, permission-mode, progress,
      // pr-link, worktree-state) are filtered out — they inform session
      // metadata, not turns.
      return null
  }
}

function normalizeUserTurn(event: Extract<ClaudeEvent, { type: 'user' }>, index: number): Turn {
  const textBlocks: string[] = []
  const toolResults: ToolResult[] = []

  const content = event.message.content
  if (typeof content === 'string') {
    if (content.length > 0) textBlocks.push(content)
  } else {
    for (const block of content) {
      if (!isObject(block)) continue
      const t = (block as { type?: unknown }).type
      if (t === 'text' && typeof (block as { text?: unknown }).text === 'string') {
        textBlocks.push((block as { text: string }).text)
      } else if (t === 'tool_result') {
        const b = block as { tool_use_id: string; content: unknown; is_error?: boolean }
        toolResults.push({
          tool_use_id: b.tool_use_id,
          content: (typeof b.content === 'string' || Array.isArray(b.content)) ? b.content : String(b.content ?? ''),
          is_error: b.is_error,
        })
      }
      // tool_reference and other block types ignored (not needed for Phase 1 display)
    }
  }

  return {
    uuid: event.uuid ?? fabricateUuid(event.type, event.timestamp ?? '', textBlocks[0] ?? '', index),
    parentUuid: event.parentUuid ?? null,
    timestamp: event.timestamp ?? '',
    role: 'user',
    textBlocks,
    thinkingBlocks: [],
    toolUses: [],
    toolResults,
    isMeta: event.isMeta ?? false,
    agentId: event.agentId ?? null,
  }
}

function normalizeAssistantTurn(event: Extract<ClaudeEvent, { type: 'assistant' }>, index: number): Turn {
  const textBlocks: string[] = []
  const thinkingBlocks: string[] = []
  const toolUses: ToolUse[] = []

  const content = event.message?.content ?? []
  for (const block of content) {
    if (!isObject(block)) continue
    const b = block as Record<string, unknown>
    const t = b.type

    if (t === 'text' && typeof b.text === 'string') {
      textBlocks.push(b.text)
    } else if (t === 'thinking' && typeof b.thinking === 'string') {
      thinkingBlocks.push(b.thinking)
    } else if (t === 'tool_use' && typeof b.id === 'string' && typeof b.name === 'string') {
      toolUses.push({
        id: b.id,
        name: b.name,
        input: isObject(b.input) ? (b.input as Record<string, unknown>) : {},
      })
    }
  }

  const usage: UsageBlock | undefined = event.message?.usage
  const model = event.message?.model

  return {
    uuid: event.uuid ?? fabricateUuid(event.type, event.timestamp ?? '', textBlocks[0] ?? thinkingBlocks[0] ?? toolUses[0]?.name ?? '', index),
    parentUuid: event.parentUuid ?? null,
    timestamp: event.timestamp ?? '',
    role: 'assistant',
    textBlocks,
    thinkingBlocks,
    toolUses,
    toolResults: [],
    usage,
    model,
    isMeta: false,
    agentId: event.agentId ?? null,
  }
}

function normalizeSystemTurn(event: Extract<ClaudeEvent, { type: 'system' }>, index: number): Turn {
  const content = event.content ?? (event.subtype ? `[system: ${event.subtype}]` : '[system event]')
  return {
    uuid: event.uuid ?? fabricateUuid(event.type, event.timestamp ?? '', content, index),
    parentUuid: event.parentUuid ?? null,
    timestamp: event.timestamp ?? '',
    role: 'system',
    textBlocks: [content],
    thinkingBlocks: [],
    toolUses: [],
    toolResults: [],
    isMeta: true,
    agentId: event.agentId ?? null,
  }
}

function normalizeUnknownTurn(event: Extract<ClaudeEvent, { type: 'unknown' }>, index: number): Turn {
  // Per D-15: unknown events must be preserved, not dropped. Render as a
  // non-default meta-turn showing the underlying type for debugging.
  const raw = event.raw as Record<string, unknown> | undefined
  const typeHint = typeof raw?.type === 'string' ? raw.type : '(unlabelled)'
  const timestamp = typeof raw?.timestamp === 'string' ? raw.timestamp : ''
  const uuid = typeof raw?.uuid === 'string' ? raw.uuid : fabricateUuid('unknown', timestamp, typeHint, index)

  return {
    uuid,
    parentUuid: null,
    timestamp,
    role: 'system',
    textBlocks: [`[unknown event: ${typeHint}]`],
    thinkingBlocks: [],
    toolUses: [],
    toolResults: [],
    isMeta: true,
    agentId: typeof raw?.agentId === 'string' ? raw.agentId : null,
  }
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * FNV-1a 32-bit string hash. Deterministic, sync, no Buffer required.
 * Returns 8-char zero-padded lowercase hex. Used by fabricateUuid for D-13 / WR-04.
 */
function fnv1a(s: string): string {
  let h = 2166136261 // 0x811c9dc5 — FNV offset basis
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619) // FNV prime
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

/**
 * Synthesize a deterministic uuid for events lacking one (D-13).
 * Hash input per CONTEXT.md D-13: `${type}:${timestamp}:${content_first_120chars}`.
 * Per RESEARCH.md Pitfall 8, the loop `index` is appended as a tiebreaker so two
 * structurally-identical events at different positions in the same JSONL still
 * yield distinct keys (closes WR-04 fully).
 */
function fabricateUuid(
  type: string,
  timestamp: string,
  content: string,
  index: number,
): string {
  const hash = fnv1a(`${type}:${timestamp}:${content.slice(0, 120)}:${index}`)
  return `__synth-${type}-${hash}-${index}`
}
