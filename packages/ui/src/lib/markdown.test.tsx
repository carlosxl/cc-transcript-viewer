// XSS defense tests per D-17 + RESEARCH.md Pitfall 9 — verifies gfmSchema and MarkdownRenderer safety
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import React from 'react'

// Mock CodeBlock before importing MarkdownRenderer so we can spy on dispatch
vi.mock('../components/transcript/CodeBlock', () => ({
  CodeBlock: vi.fn(({ language, code }: { language: string; code: string }) => (
    <div data-testid="codeblock-mock" data-language={language} data-code={code} />
  )),
}))

import { MarkdownRenderer } from './markdown'
import { CodeBlock } from '../components/transcript/CodeBlock'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('MarkdownRenderer — XSS safety', () => {
  it('Test 1: strips <script> tags — no script element in DOM', () => {
    const { container } = render(<MarkdownRenderer text="<script>alert(1)</script>" />)
    expect(container.querySelector('script')).toBeNull()
  })

  it('Test 2: strips javascript: URLs — no active javascript: href', () => {
    const { container } = render(<MarkdownRenderer text="[click](javascript:alert(1))" />)
    expect(container.querySelector('a[href^="javascript:"]')).toBeNull()
  })

  it('Test 7: strips on* event attributes from inline HTML', () => {
    // skipHtml + rehypeSanitize strips onclick from raw HTML passed in markdown
    const { container } = render(
      <MarkdownRenderer text={`<a href="x" onclick="alert(1)">x</a>`} />
    )
    const anchor = container.querySelector('a')
    // Either the anchor was stripped entirely or it lacks onclick
    if (anchor) {
      expect(anchor.getAttribute('onclick')).toBeNull()
    }
  })
})

describe('MarkdownRenderer — GFM rendering', () => {
  it('Test 3: renders GFM table with thead and tbody', () => {
    const md = `| A | B |\n|---|---|\n| 1 | 2 |`
    const { container } = render(<MarkdownRenderer text={md} />)
    expect(container.querySelector('table')).not.toBeNull()
    expect(container.querySelector('thead')).not.toBeNull()
    expect(container.querySelector('tbody')).not.toBeNull()
  })

  it('Test 4: renders task list checkboxes — [x] checked, [ ] unchecked', () => {
    const md = `- [x] done\n- [ ] todo`
    const { container } = render(<MarkdownRenderer text={md} />)
    const checkboxes = container.querySelectorAll('input[type="checkbox"]')
    expect(checkboxes).toHaveLength(2)
    expect((checkboxes[0] as HTMLInputElement).checked).toBe(true)
    expect((checkboxes[1] as HTMLInputElement).checked).toBe(false)
  })
})

describe('MarkdownRenderer — code dispatch', () => {
  it('Test 5: fenced TypeScript block routes to CodeBlock with correct language and code', () => {
    const md = '```typescript\nconst x = 1\n```'
    render(<MarkdownRenderer text={md} />)
    const MockCodeBlock = CodeBlock as ReturnType<typeof vi.fn>
    expect(MockCodeBlock).toHaveBeenCalled()
    const callArgs = MockCodeBlock.mock.calls[0][0]
    expect(callArgs.language).toBe('typescript')
    expect(callArgs.code).toContain('const x = 1')
    // CodeBlock test id present in DOM
    expect(screen.getByTestId('codeblock-mock')).toBeTruthy()
  })

  it('Test 6: inline backtick code renders as plain <code> without CodeBlock', () => {
    render(<MarkdownRenderer text="use `const x` here" />)
    const MockCodeBlock = CodeBlock as ReturnType<typeof vi.fn>
    // CodeBlock should NOT be called for inline code
    expect(MockCodeBlock).not.toHaveBeenCalled()
    // But a <code> element should exist
    const codes = document.querySelectorAll('code')
    expect(codes.length).toBeGreaterThan(0)
  })
})
