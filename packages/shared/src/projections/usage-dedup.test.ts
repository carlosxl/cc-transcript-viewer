import { describe, it, expect } from 'vitest'
import { dedupeUsage, cacheHitRate } from './usage-dedup.js'
import type { ClaudeRowOrUnknown } from '../jsonl/schema.js'

function asst(messageId: string, usage: {
  input_tokens?: number
  output_tokens?: number
  cache_creation_input_tokens?: number
  cache_read_input_tokens?: number
}, uuid = `u-${messageId}-${Math.random().toString(36).slice(2, 6)}`): ClaudeRowOrUnknown {
  return {
    type: 'assistant',
    uuid,
    message: { id: messageId, usage },
  } as unknown as ClaudeRowOrUnknown
}

describe('dedupeUsage', () => {
  it('counts a single assistant row once', () => {
    const out = dedupeUsage([asst('msg_1', { input_tokens: 10, output_tokens: 5 })])
    expect(out.inputTotal).toBe(10)
    expect(out.outputTotal).toBe(5)
    expect(out.countedMessageIds.has('msg_1')).toBe(true)
  })

  it('does not double-count when one message produces multiple rows', () => {
    const usage = { input_tokens: 100, output_tokens: 30, cache_read_input_tokens: 200 }
    // Same message.id appears on 3 rows (text + thinking + tool_use blocks).
    const rows = [asst('msg_dup', usage, 'r1'), asst('msg_dup', usage, 'r2'), asst('msg_dup', usage, 'r3')]
    const out = dedupeUsage(rows)
    expect(out.inputTotal).toBe(100)
    expect(out.outputTotal).toBe(30)
    expect(out.cacheReadTotal).toBe(200)
    expect(out.countedMessageIds.size).toBe(1)
  })

  it('separates cache_creation and cache_read totals (FR-016)', () => {
    const rows = [
      asst('m1', { cache_creation_input_tokens: 50, cache_read_input_tokens: 0 }),
      asst('m2', { cache_creation_input_tokens: 0,  cache_read_input_tokens: 80 }),
      asst('m3', { cache_creation_input_tokens: 20, cache_read_input_tokens: 40 }),
    ]
    const out = dedupeUsage(rows)
    expect(out.cacheCreationTotal).toBe(70)
    expect(out.cacheReadTotal).toBe(120)
  })

  it('skips non-assistant rows', () => {
    const rows: ClaudeRowOrUnknown[] = [
      { type: 'user', uuid: 'u', message: { role: 'user', content: 'hi' } } as unknown as ClaudeRowOrUnknown,
      { type: 'system', uuid: 's', subtype: 'turn_duration' } as unknown as ClaudeRowOrUnknown,
      asst('m1', { input_tokens: 1, output_tokens: 1 }),
    ]
    const out = dedupeUsage(rows)
    expect(out.inputTotal).toBe(1)
    expect(out.countedMessageIds.size).toBe(1)
  })

  it('falls back to row uuid when message.id is missing so usage is not dropped', () => {
    const row: ClaudeRowOrUnknown = {
      type: 'assistant',
      uuid: 'row-no-id',
      message: { usage: { input_tokens: 7 } },
    } as unknown as ClaudeRowOrUnknown
    const out = dedupeUsage([row])
    expect(out.inputTotal).toBe(7)
    expect(out.countedMessageIds.has('__row:row-no-id')).toBe(true)
  })

  it('handles empty input', () => {
    const out = dedupeUsage([])
    expect(out.inputTotal).toBe(0)
    expect(out.outputTotal).toBe(0)
    expect(out.cacheCreationTotal).toBe(0)
    expect(out.cacheReadTotal).toBe(0)
    expect(out.countedMessageIds.size).toBe(0)
  })
})

describe('cacheHitRate', () => {
  it('returns 0 when denominator is zero', () => {
    expect(cacheHitRate({ inputTotal: 0, cacheCreationTotal: 0, cacheReadTotal: 0 })).toBe(0)
  })

  it('matches cacheRead / (cacheRead + cacheCreation + input)', () => {
    const rate = cacheHitRate({ inputTotal: 100, cacheCreationTotal: 100, cacheReadTotal: 300 })
    expect(rate).toBeCloseTo(300 / 500)
  })
})
