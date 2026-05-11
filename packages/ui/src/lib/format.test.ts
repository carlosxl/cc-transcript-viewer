import { describe, it, expect } from 'vitest'
import {
  abbreviateInt,
  formatExactInt,
  formatTimestampExact,
  formatTimestampRelative,
} from './format'

describe('abbreviateInt', () => {
  it('returns "0" for 0', () => {
    expect(abbreviateInt(0)).toBe('0')
  })

  it('returns "999" for 999', () => {
    expect(abbreviateInt(999)).toBe('999')
  })

  it('returns "1.0k" for 1000', () => {
    expect(abbreviateInt(1000)).toBe('1.0k')
  })

  it('returns "12.4k" for 12438', () => {
    expect(abbreviateInt(12438)).toBe('12.4k')
  })

  it('returns "1.5m" for 1_500_000', () => {
    expect(abbreviateInt(1_500_000)).toBe('1.5m')
  })

  it('returns "2.4b" for 2_400_000_000', () => {
    expect(abbreviateInt(2_400_000_000)).toBe('2.4b')
  })
})

describe('formatTimestampExact + formatTimestampRelative', () => {
  it('formatTimestampExact returns the ISO string unchanged', () => {
    const iso = '2026-04-27T10:30:00.000Z'
    expect(formatTimestampExact(iso)).toBe(iso)
  })

  it('formatTimestampRelative returns "3m ago" for a 3-minute-old timestamp', () => {
    const now = new Date('2026-04-27T12:00:00Z')
    const iso = '2026-04-27T11:57:00Z'
    expect(formatTimestampRelative(iso, now)).toBe('3m ago')
  })

  it('formatTimestampRelative returns "2h ago" for a 2-hour-old timestamp', () => {
    const now = new Date('2026-04-27T12:00:00Z')
    const iso = '2026-04-27T10:00:00Z'
    expect(formatTimestampRelative(iso, now)).toBe('2h ago')
  })

  it('formatTimestampRelative returns "yesterday" for 1-day-old timestamp', () => {
    const now = new Date('2026-04-27T12:00:00Z')
    const iso = '2026-04-26T12:00:00Z'
    expect(formatTimestampRelative(iso, now)).toBe('yesterday')
  })

  it('formatTimestampRelative returns "3d ago" for a 3-day-old timestamp', () => {
    const now = new Date('2026-04-27T12:00:00Z')
    const iso = '2026-04-24T12:00:00Z'
    expect(formatTimestampRelative(iso, now)).toBe('3d ago')
  })
})

describe('formatExactInt', () => {
  it('returns "12,438" for 12438', () => {
    expect(formatExactInt(12438)).toBe('12,438')
  })
})
