import { describe, it, expect } from 'vitest'
import { buildApiErrorChains } from './api-error-chains.js'
import type { ClaudeRowOrUnknown } from '../jsonl/schema.js'

function err(uuid: string, opts: { retryAttempt?: number; maxRetries?: number; timestamp?: string } = {}): ClaudeRowOrUnknown {
  return {
    type: 'system',
    subtype: 'api_error',
    uuid,
    timestamp: opts.timestamp ?? '2026-05-26T00:00:00Z',
    error: 'rate-limited',
    ...(opts.retryAttempt !== undefined ? { retryAttempt: opts.retryAttempt } : {}),
    ...(opts.maxRetries !== undefined ? { maxRetries: opts.maxRetries } : {}),
  } as unknown as ClaudeRowOrUnknown
}

function ok(uuid: string, type: 'user' | 'assistant' = 'assistant'): ClaudeRowOrUnknown {
  return { type, uuid, message: { content: [] } } as unknown as ClaudeRowOrUnknown
}

describe('buildApiErrorChains', () => {
  it('returns an empty projection for rows with no api_error', () => {
    const out = buildApiErrorChains([ok('a1'), ok('u1', 'user')])
    expect(out.annotations.size).toBe(0)
    expect(out.chains).toEqual([])
  })

  it('groups consecutive api_error rows into one chain ending in success', () => {
    const out = buildApiErrorChains([
      ok('a1'),
      err('e1'),
      err('e2'),
      err('e3'),
      ok('a2'),
    ])
    expect(out.chains.length).toBe(1)
    expect(out.chains[0]!.retries).toBe(3)
    expect(out.chains[0]!.finalOutcome).toBe('success')
    expect(out.chains[0]!.chainId).toBe('e1')
    expect(out.annotations.get('e1')).toEqual({ chainId: 'e1', retryIndex: 0, finalOutcome: 'success' })
    expect(out.annotations.get('e2')!.retryIndex).toBe(1)
    expect(out.annotations.get('e3')!.retryIndex).toBe(2)
  })

  it('marks the chain as final_failure when the last error reaches maxRetries', () => {
    const out = buildApiErrorChains([
      err('e1', { retryAttempt: 0, maxRetries: 3 }),
      err('e2', { retryAttempt: 1, maxRetries: 3 }),
      err('e3', { retryAttempt: 3, maxRetries: 3 }),
      ok('a2'),
    ])
    expect(out.chains.length).toBe(1)
    expect(out.chains[0]!.finalOutcome).toBe('final_failure')
    expect(out.annotations.get('e1')!.finalOutcome).toBe('final_failure')
    expect(out.annotations.get('e3')!.finalOutcome).toBe('final_failure')
  })

  it('marks an unterminated trailing chain as in_progress', () => {
    const out = buildApiErrorChains([
      ok('a1'),
      err('e1'),
      err('e2'),
    ])
    expect(out.chains.length).toBe(1)
    expect(out.chains[0]!.finalOutcome).toBe('in_progress')
  })

  it('produces two chains for two separated runs of api_error', () => {
    const out = buildApiErrorChains([
      err('e1'),
      ok('a1'),
      err('e2'),
      err('e3'),
      ok('a2'),
    ])
    expect(out.chains.length).toBe(2)
    expect(out.chains[0]!.chainId).toBe('e1')
    expect(out.chains[0]!.retries).toBe(1)
    expect(out.chains[1]!.chainId).toBe('e2')
    expect(out.chains[1]!.retries).toBe(2)
  })

  it('records the first error timestamp as anchorTimestamp', () => {
    const out = buildApiErrorChains([
      err('e1', { timestamp: '2026-05-26T01:23:45Z' }),
      ok('a1'),
    ])
    expect(out.chains[0]!.anchorTimestamp).toBe('2026-05-26T01:23:45Z')
  })
})
