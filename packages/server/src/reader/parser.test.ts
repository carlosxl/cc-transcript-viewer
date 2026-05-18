import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseLine, parseJSONL } from './parser.js'

const fixturesDir = fileURLToPath(new URL('./__fixtures__/synthetic', import.meta.url))
const f = (name: string): string => readFileSync(join(fixturesDir, name), 'utf8')

describe('parseLine', () => {
  it('parses a well-formed user event', () => {
    const event = parseLine('{"type":"user","uuid":"a","message":{"role":"user","content":"hi"}}')
    expect(event).not.toBeNull()
    expect(event!.type).toBe('user')
    if (event!.type === 'user') {
      expect(event!.uuid).toBe('a')
      expect(event!.message.content).toBe('hi')
    }
  })

  it('preserves unknown event types as { type: "unknown", raw } (SYS-06, D-15)', () => {
    const event = parseLine('{"type":"future_unknown_type","uuid":"c","foo":"bar"}')
    expect(event).not.toBeNull()
    expect(event!.type).toBe('unknown')
    if (event!.type === 'unknown') {
      const raw = event!.raw as Record<string, unknown>
      expect(raw.type).toBe('future_unknown_type')
      expect(raw.uuid).toBe('c')
      expect(raw.foo).toBe('bar')
    }
  })

  it('recognizes worktree-state as a known metadata event (not unknown)', () => {
    const event = parseLine('{"type":"worktree-state","sessionId":"s","worktreeSession":{"worktreeName":"x"}}')
    expect(event).not.toBeNull()
    expect(event!.type).toBe('worktree-state')
  })

  it('preserves passthrough fields on known event types', () => {
    const event = parseLine('{"type":"user","uuid":"a","message":{"role":"user","content":"hi"},"newFieldFromFutureVersion":42}')
    expect(event).not.toBeNull()
    expect((event as unknown as Record<string, unknown>).newFieldFromFutureVersion).toBe(42)
  })

  it('returns null on invalid JSON (SYS-05)', () => {
    expect(parseLine('{this is not json')).toBeNull()
  })

  it('returns null on a top-level non-object JSON', () => {
    expect(parseLine('42')).toBeNull()
    expect(parseLine('"string"')).toBeNull()
    expect(parseLine('null')).toBeNull()
  })
})

describe('parseJSONL', () => {
  it('returns empty result for empty file', () => {
    expect(parseJSONL(f('empty.jsonl'))).toEqual({ events: [], parseWarnings: 0 })
  })

  it('skips malformed lines and counts them (SYS-05, D-16)', () => {
    const result = parseJSONL(f('malformed-line.jsonl'))
    expect(result.events.length).toBe(2)
    expect(result.parseWarnings).toBe(1)
    expect(result.events[0]!.type).toBe('user')
    expect(result.events[1]!.type).toBe('assistant')
  })

  it('preserves unknown event types (SYS-06, D-15)', () => {
    const result = parseJSONL(f('unknown-event-type.jsonl'))
    expect(result.events.length).toBe(3)
    expect(result.parseWarnings).toBe(0)
    const unknownEvent = result.events[1]!
    expect(unknownEvent.type).toBe('unknown')
    if (unknownEvent.type === 'unknown') {
      expect((unknownEvent.raw as { type: string }).type).toBe('future_unknown_type')
    }
  })

  it('handles partial trailing line (SYS-05, SYS-07, LIVE-04)', () => {
    const result = parseJSONL(f('partial-trailing-line.jsonl'))
    expect(result.events.length).toBe(2)
    expect(result.parseWarnings).toBe(1)
  })

  it('handles UTF-8 multi-byte content', () => {
    const result = parseJSONL(f('utf8-boundary.jsonl'))
    expect(result.events.length).toBe(3)
    expect(result.parseWarnings).toBe(0)
    const userEvent = result.events[1]!
    if (userEvent.type === 'user' && typeof userEvent.message.content === 'string') {
      expect(userEvent.message.content).toContain('日本語')
      expect(userEvent.message.content).toContain('🔒')
    }
  })

  it('parses a plain-session fixture covering major known event types', () => {
    const result = parseJSONL(f('plain-session.jsonl'))
    expect(result.parseWarnings).toBe(0)
    expect(result.events.length).toBe(6)
    const types = result.events.map(e => e.type)
    expect(types).toEqual(['last-prompt', 'custom-title', 'ai-title', 'user', 'assistant', 'system'])
  })
})
