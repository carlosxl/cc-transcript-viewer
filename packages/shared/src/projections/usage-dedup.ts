/**
 * Token-usage de-duplication projection (007-ui-information-revamp, T042).
 *
 * Claude Code emits one row per LLM content block. When a single LLM message
 * produces N content blocks (text + thinking + tool_use, etc.) there are N
 * assistant rows sharing the SAME `message.id`, `requestId`, and `usage`. The
 * usage on those N rows is the SAME usage, repeated — summing it N times
 * over-counts (`schema.ts:97-128` + jsonl/README §7).
 *
 * `dedupeUsage` folds assistant rows by `message.id` and contributes one
 * `UsageBlock` per unique id to the totals. Returns separate cache figures
 * (FR-016): `cacheCreationTotal` and `cacheReadTotal` stay split so the cache
 * hit rate can be derived downstream.
 */
import type { ClaudeRowOrUnknown } from '../jsonl/schema.js'

export interface DedupedUsage {
  inputTotal: number
  outputTotal: number
  cacheCreationTotal: number
  cacheReadTotal: number
  /** Unique message.id values that contributed to the totals. */
  countedMessageIds: Set<string>
}

interface UsageShape {
  input_tokens?: number
  output_tokens?: number
  cache_creation_input_tokens?: number
  cache_read_input_tokens?: number
}

interface AssistantShape {
  type: string
  message?: { id?: unknown; usage?: unknown }
  uuid?: string
}

function emptyTotals(): DedupedUsage {
  return {
    inputTotal: 0,
    outputTotal: 0,
    cacheCreationTotal: 0,
    cacheReadTotal: 0,
    countedMessageIds: new Set<string>(),
  }
}

function accUsage(into: DedupedUsage, usage: UsageShape): void {
  into.inputTotal          += usage.input_tokens                ?? 0
  into.outputTotal         += usage.output_tokens               ?? 0
  into.cacheCreationTotal  += usage.cache_creation_input_tokens ?? 0
  into.cacheReadTotal      += usage.cache_read_input_tokens     ?? 0
}

export function dedupeUsage(rows: readonly ClaudeRowOrUnknown[]): DedupedUsage {
  const totals = emptyTotals()
  for (const row of rows) {
    const r = row as unknown as AssistantShape
    if (r.type !== 'assistant') continue
    const usage = r.message?.usage as UsageShape | undefined
    if (!usage) continue
    const messageId = typeof r.message?.id === 'string' ? r.message.id : null
    // For rows missing a message.id, fall back to the row uuid so usage isn't
    // dropped entirely. They never collide with real message.ids because they
    // sit in a different identifier namespace.
    const key = messageId ?? (typeof r.uuid === 'string' ? `__row:${r.uuid}` : null)
    if (!key) continue
    if (totals.countedMessageIds.has(key)) continue
    totals.countedMessageIds.add(key)
    accUsage(totals, usage)
  }
  return totals
}

/**
 * Convenience: `cacheRead / (cacheRead + cacheCreation + input)`.
 * Returns 0 when the denominator is zero (NaN-safe).
 */
export function cacheHitRate(u: Pick<DedupedUsage, 'inputTotal' | 'cacheCreationTotal' | 'cacheReadTotal'>): number {
  const denom = u.cacheReadTotal + u.cacheCreationTotal + u.inputTotal
  if (denom === 0) return 0
  return u.cacheReadTotal / denom
}
