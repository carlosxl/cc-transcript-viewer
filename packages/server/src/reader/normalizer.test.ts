import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { parseJSONL } from './parser.js'
import { eventsToTurns } from './normalizer.js'
import type { ClaudeEvent, UserEvent, AssistantEvent } from '@cc-viewer/shared'

const fixturesDir = fileURLToPath(new URL('./__fixtures__/synthetic', import.meta.url))

describe('eventsToTurns', () => {
  it('converts plain-session fixture events to turns with expected shape', () => {
    const { events } = parseJSONL(readFileSync(join(fixturesDir, 'plain-session.jsonl'), 'utf8'))
    const turns = eventsToTurns(events)

    // plain-session has: last-prompt, custom-title, ai-title, user, assistant, system
    // → only user, assistant, system produce turns
    expect(turns.length).toBe(3)
    expect(turns.map(t => t.role)).toEqual(['user', 'assistant', 'system'])
  })

  it('filters metadata events (last-prompt, custom-title, ai-title) from turns', () => {
    const events: ClaudeEvent[] = [
      { type: 'last-prompt', lastPrompt: 'x' } as ClaudeEvent,
      { type: 'custom-title', customTitle: 'Title' } as ClaudeEvent,
      { type: 'user', uuid: 'u1', message: { role: 'user', content: 'hi' } } as UserEvent,
    ]
    const turns = eventsToTurns(events)
    expect(turns.length).toBe(1)
    expect(turns[0]!.role).toBe('user')
  })

  it('normalizes user event with string content → textBlocks', () => {
    const event: UserEvent = {
      type: 'user',
      uuid: 'u1',
      parentUuid: null,
      timestamp: '2026-04-24T00:00:00Z',
      message: { role: 'user', content: 'hello world' },
    }
    const [turn] = eventsToTurns([event as ClaudeEvent])
    expect(turn!.textBlocks).toEqual(['hello world'])
    expect(turn!.toolResults).toEqual([])
    expect(turn!.role).toBe('user')
    expect(turn!.isMeta).toBe(false)
  })

  it('normalizes user event with tool_result blocks', () => {
    const event = {
      type: 'user',
      uuid: 'u1',
      message: {
        role: 'user',
        content: [
          { type: 'tool_result', tool_use_id: 't1', content: 'output', is_error: false },
          { type: 'text', text: 'note' },
        ],
      },
    } as unknown as ClaudeEvent
    const [turn] = eventsToTurns([event])
    expect(turn!.toolResults.length).toBe(1)
    expect(turn!.toolResults[0]!.tool_use_id).toBe('t1')
    expect(turn!.toolResults[0]!.content).toBe('output')
    expect(turn!.toolResults[0]!.is_error).toBe(false)
    expect(turn!.textBlocks).toEqual(['note'])
  })

  it('normalizes assistant event with text/thinking/tool_use blocks', () => {
    const event: AssistantEvent = {
      type: 'assistant',
      uuid: 'a1',
      message: {
        id: 'msg',
        model: 'claude-opus',
        role: 'assistant',
        content: [
          { type: 'text', text: 'hi' },
          { type: 'thinking', thinking: 'pondering' },
          { type: 'tool_use', id: 't1', name: 'Bash', input: { cmd: 'ls' } },
        ],
        usage: { input_tokens: 10, output_tokens: 5, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
      },
    }
    const [turn] = eventsToTurns([event as ClaudeEvent])
    expect(turn!.textBlocks).toEqual(['hi'])
    expect(turn!.thinkingBlocks).toEqual(['pondering'])
    expect(turn!.toolUses.length).toBe(1)
    expect(turn!.toolUses[0]!.name).toBe('Bash')
    expect(turn!.toolUses[0]!.input).toEqual({ cmd: 'ls' })
    expect(turn!.usage?.input_tokens).toBe(10)
  })

  it('preserves unknown events as meta-turns with type hint (SYS-06, D-15)', () => {
    const event = { type: 'unknown' as const, raw: { type: 'future_type', uuid: 'x', foo: 'bar' } }
    const [turn] = eventsToTurns([event as ClaudeEvent])
    expect(turn!.role).toBe('system')
    expect(turn!.isMeta).toBe(true)
    expect(turn!.textBlocks[0]).toContain('future_type')
    expect(turn!.uuid).toBe('x')
  })

  it('marks user events with isMeta=true when event.isMeta is true', () => {
    const event: UserEvent = {
      type: 'user',
      uuid: 'u1',
      message: { role: 'user', content: '/clear' },
      isMeta: true,
    }
    const [turn] = eventsToTurns([event as ClaudeEvent])
    expect(turn!.isMeta).toBe(true)
  })

  it('carries agentId from event to turn', () => {
    const event: UserEvent = {
      type: 'user',
      uuid: 'u1',
      agentId: 'agent-123',
      message: { role: 'user', content: 'hi' },
    }
    const [turn] = eventsToTurns([event as ClaudeEvent])
    expect(turn!.agentId).toBe('agent-123')
  })

  it('defaults agentId to null when absent', () => {
    const event: UserEvent = {
      type: 'user',
      uuid: 'u1',
      message: { role: 'user', content: 'hi' },
    }
    const [turn] = eventsToTurns([event as ClaudeEvent])
    expect(turn!.agentId).toBeNull()
  })
})

describe('deterministic uuid (D-13 / WR-04)', () => {
  it('produces identical uuids when the same events are normalized twice', () => {
    const event = {
      type: 'user' as const,
      parentUuid: null,
      timestamp: '2026-04-26T12:00:00Z',
      message: { role: 'user' as const, content: 'hello world' },
      // NOTE: no `uuid` field — forces fabrication path
    }
    const a = eventsToTurns([event as ClaudeEvent])
    const b = eventsToTurns([event as ClaudeEvent])
    expect(a[0]!.uuid).toBe(b[0]!.uuid)
    expect(a[0]!.uuid).toMatch(/^__synth-user-[0-9a-f]{8}-0$/)
  })

  it('disambiguates identical-content events at different indices', () => {
    const e: ClaudeEvent = {
      type: 'system',
      timestamp: '2026-04-26T12:00:00Z',
      content: 'session resumed',
    } as ClaudeEvent
    const turns = eventsToTurns([e, e]) // SAME object reference twice
    expect(turns).toHaveLength(2)
    expect(turns[0]!.uuid).not.toBe(turns[1]!.uuid)
    expect(turns[0]!.uuid).toMatch(/-0$/)
    expect(turns[1]!.uuid).toMatch(/-1$/)
  })

  it('produces different uuids when only the timestamp differs', () => {
    const base = { type: 'user' as const, parentUuid: null, message: { role: 'user' as const, content: 'hi' } }
    const a = eventsToTurns([{ ...base, timestamp: '2026-04-26T12:00:00Z' } as ClaudeEvent])
    const b = eventsToTurns([{ ...base, timestamp: '2026-04-26T12:00:01Z' } as ClaudeEvent])
    expect(a[0]!.uuid).not.toBe(b[0]!.uuid)
  })

  it('produces different uuids when only the content differs', () => {
    const base = { type: 'user' as const, parentUuid: null, timestamp: '2026-04-26T12:00:00Z' }
    const a = eventsToTurns([{ ...base, message: { role: 'user' as const, content: 'foo' } } as ClaudeEvent])
    const b = eventsToTurns([{ ...base, message: { role: 'user' as const, content: 'bar' } } as ClaudeEvent])
    expect(a[0]!.uuid).not.toBe(b[0]!.uuid)
  })

  it('synthesised uuids match /^__synth-[a-z]+-[0-9a-f]{8}-\\d+$/', () => {
    const e: ClaudeEvent = {
      type: 'system', timestamp: '2026-04-26T12:00:00Z', content: 'x',
    } as ClaudeEvent
    const [t] = eventsToTurns([e])
    expect(t!.uuid).toMatch(/^__synth-system-[0-9a-f]{8}-0$/)
  })

  it('preserves upstream uuid when present (no fabrication)', () => {
    const e: UserEvent = {
      type: 'user', uuid: 'real-uuid-abc', parentUuid: null,
      timestamp: '2026-04-26T12:00:00Z',
      message: { role: 'user', content: 'x' },
    }
    const [t] = eventsToTurns([e as ClaudeEvent])
    expect(t!.uuid).toBe('real-uuid-abc')
    expect(t!.uuid.startsWith('__synth-')).toBe(false)
  })
})
