import { describe, it, expect } from 'vitest'
import { isStderrEnvelope } from './classifyUserText'

describe('isStderrEnvelope', () => {
  it('flags text that starts with the [stderr] envelope', () => {
    expect(isStderrEnvelope('[stderr] something went wrong')).toBe(true)
    expect(isStderrEnvelope('[stderr]: short')).toBe(true)
  })

  it('does not flag text that merely contains [stderr] later', () => {
    expect(isStderrEnvelope('the [stderr] tag is mentioned mid-sentence')).toBe(false)
  })

  it('treats nullish / empty input as not stderr', () => {
    expect(isStderrEnvelope(null)).toBe(false)
    expect(isStderrEnvelope(undefined)).toBe(false)
    expect(isStderrEnvelope('')).toBe(false)
  })

  it('is case-sensitive — only the exact prefix counts', () => {
    expect(isStderrEnvelope('[STDERR] not matched')).toBe(false)
  })
})
