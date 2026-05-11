import { describe, it, expect } from 'vitest'
import { sanitizeSnippet } from './sanitizeSnippet'

const OPEN = '\uE000CCV_MARK_OPEN\uE000'
const CLOSE = '\uE000CCV_MARK_CLOSE\uE000'

describe('sanitizeSnippet', () => {
  it('returns empty for empty input', () => {
    expect(sanitizeSnippet('')).toBe('')
  })

  it('escapes raw HTML so user content cannot inject tags', () => {
    const malicious = `before <script>alert('x')</script> after`
    const out = sanitizeSnippet(malicious)
    expect(out).not.toContain('<script>')
    expect(out).toContain('&lt;script&gt;')
  })

  it('promotes server-emitted sentinels to <mark> tags', () => {
    const input = `the ${OPEN}parser${CLOSE} works`
    expect(sanitizeSnippet(input)).toBe('the <mark>parser</mark> works')
  })

  it('does not promote literal <mark> in user content', () => {
    const input = `text containing literal <mark>not a real marker</mark> and ${OPEN}real${CLOSE} match`
    const out = sanitizeSnippet(input)
    expect(out).toContain('&lt;mark&gt;not a real marker&lt;/mark&gt;')
    expect(out).toContain('<mark>real</mark>')
  })

  it('handles ampersands and quotes', () => {
    const input = `Tom & Jerry says "hi" and ${OPEN}oh${CLOSE}`
    const out = sanitizeSnippet(input)
    expect(out).toContain('Tom &amp; Jerry')
    expect(out).toContain('&quot;hi&quot;')
    expect(out).toContain('<mark>oh</mark>')
  })
})
