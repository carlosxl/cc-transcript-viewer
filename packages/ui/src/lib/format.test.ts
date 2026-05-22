import { describe, it, expect } from 'vitest'
import { fmtCost, fmtK, fmtDuration, fmtRelativeTime } from './format'

describe('fmtCost', () => {
  it('returns the em-dash sentinel for null / undefined / NaN', () => {
    expect(fmtCost(null)).toBe('—')
    expect(fmtCost(undefined)).toBe('—')
    expect(fmtCost(Number.NaN)).toBe('—')
  })

  it('treats zero as an explicit $0.00 (not unknown)', () => {
    expect(fmtCost(0)).toBe('$0.00')
  })

  it('shows < $0.01 for sub-cent values so users see the cost is non-zero', () => {
    expect(fmtCost(0.0001)).toBe('<$0.01')
    expect(fmtCost(0.009)).toBe('<$0.01')
  })

  it('renders dollar amounts with two decimals', () => {
    expect(fmtCost(1.42)).toBe('$1.42')
    expect(fmtCost(123)).toBe('$123.00')
  })
})

describe('fmtK', () => {
  it('returns em-dash for nullish / non-finite', () => {
    expect(fmtK(null)).toBe('—')
    expect(fmtK(undefined)).toBe('—')
    expect(fmtK(Number.POSITIVE_INFINITY)).toBe('—')
  })

  it('shows raw integers below 1000', () => {
    expect(fmtK(0)).toBe('0')
    expect(fmtK(999)).toBe('999')
  })

  it('compacts thousands as K with at most one decimal', () => {
    expect(fmtK(1000)).toBe('1K')
    expect(fmtK(12_400)).toBe('12.4K')
  })

  it('compacts millions as M', () => {
    expect(fmtK(1_500_000)).toBe('1.5M')
  })
})

describe('fmtDuration', () => {
  it('returns em-dash when missing or negative', () => {
    expect(fmtDuration(null)).toBe('—')
    expect(fmtDuration(undefined)).toBe('—')
    expect(fmtDuration(-1)).toBe('—')
  })

  it('shows milliseconds under a second', () => {
    expect(fmtDuration(0)).toBe('0ms')
    expect(fmtDuration(450)).toBe('450ms')
    expect(fmtDuration(999)).toBe('999ms')
  })

  it('switches to seconds at 1s and keeps two decimals', () => {
    expect(fmtDuration(1000)).toBe('1.00s')
    expect(fmtDuration(1200)).toBe('1.20s')
  })
})

describe('fmtRelativeTime', () => {
  const now = Date.parse('2026-05-22T12:00:00Z')

  it('returns em-dash for empty / unparseable input', () => {
    expect(fmtRelativeTime(null, now)).toBe('—')
    expect(fmtRelativeTime('', now)).toBe('—')
    expect(fmtRelativeTime('not a date', now)).toBe('—')
  })

  it('reports "just now" under one minute', () => {
    expect(fmtRelativeTime(new Date(now - 30_000).toISOString(), now)).toBe('just now')
  })

  it('reports m ago, h ago, yesterday, d ago across windows', () => {
    expect(fmtRelativeTime(new Date(now - 17 * 60_000).toISOString(), now)).toBe('17m ago')
    expect(fmtRelativeTime(new Date(now - 3 * 60 * 60_000).toISOString(), now)).toBe('3h ago')
    expect(fmtRelativeTime(new Date(now - 30 * 60 * 60_000).toISOString(), now)).toBe('yesterday')
    expect(fmtRelativeTime(new Date(now - 4 * 24 * 60 * 60_000).toISOString(), now)).toBe('4d ago')
  })
})
