// Tests for the Shiki module-scope singleton and highlight() function
// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'

import { highlight, normalizeLang, __getInitCount, __resetForTest } from './highlight'

beforeEach(() => {
  __resetForTest()
})

describe('highlight singleton', () => {
  it('Test 1: createHighlighterCore is invoked exactly once for multiple calls', async () => {
    // Both calls should resolve using the same singleton
    await Promise.all([
      highlight('const x = 1', 'typescript', 'vitesse-dark'),
      highlight('const y = 2', 'typescript', 'vitesse-dark'),
    ])
    expect(__getInitCount()).toBe(1)
  })

  it('Test 2: unknown lang falls back to plaintext — output contains <pre and raw content', async () => {
    const result = await highlight('x', 'rust', 'vitesse-dark')
    expect(result).toContain('<pre')
    expect(result).toContain('x')
  })

  it('Test 3: dark theme produces non-empty string starting with <pre', async () => {
    const result = await highlight('const x=1', 'typescript', 'vitesse-dark')
    expect(result.length).toBeGreaterThan(0)
    expect(result).toMatch(/^<pre/)
  })

  it('Test 4: light and dark themes produce different output', async () => {
    const dark = await highlight('const x=1', 'typescript', 'vitesse-dark')
    __resetForTest()
    const light = await highlight('const x=1', 'typescript', 'vitesse-light')
    expect(dark).not.toBe(light)
  })

  it('Test 5: 10 parallel calls all resolve without rejection', async () => {
    const promises = Array.from({ length: 10 }, (_, i) =>
      highlight(`const x${i} = ${i}`, 'typescript', 'vitesse-dark')
    )
    const results = await Promise.all(promises)
    expect(results).toHaveLength(10)
    results.forEach((r) => {
      expect(typeof r).toBe('string')
      expect(r.length).toBeGreaterThan(0)
    })
  })
})

describe('normalizeLang', () => {
  it('returns supported lang as-is', () => {
    expect(normalizeLang('typescript')).toBe('typescript')
    expect(normalizeLang('python')).toBe('python')
  })

  it('returns plaintext for unsupported lang', () => {
    expect(normalizeLang('rust')).toBe('plaintext')
    expect(normalizeLang('cpp')).toBe('plaintext')
    expect(normalizeLang('')).toBe('plaintext')
  })
})
