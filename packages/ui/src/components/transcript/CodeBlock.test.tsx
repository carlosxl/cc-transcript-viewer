// Tests for CodeBlock async render + copy-to-clipboard per D-18, D-19
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'
import React from 'react'

// Mock highlight to avoid loading Shiki WASM in tests
vi.mock('../../lib/highlight', () => ({
  highlight: vi.fn(async (code: string) => `<pre><code>${code}</code></pre>`),
  normalizeLang: vi.fn((lang: string) => lang),
}))

// Mock useUIStore to control theme
vi.mock('../../stores/useUIStore', () => ({
  useUIStore: vi.fn((selector: (s: { theme: 'dark' | 'light' }) => unknown) =>
    selector({ theme: 'dark' })
  ),
}))

import { CodeBlock } from './CodeBlock'
import { highlight } from '../../lib/highlight'
import { useUIStore } from '../../stores/useUIStore'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.useRealTimers()
})

describe('CodeBlock — synchronous plaintext fallback', () => {
  it('Test 1: shows <pre><code> with raw source before Shiki resolves', () => {
    // Delay highlight so it doesn't resolve synchronously
    const { highlight: mockHighlight } = vi.mocked({ highlight })
    ;(highlight as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise(() => {}) // never resolves
    )

    const { container } = render(<CodeBlock language="typescript" code="const x = 1" />)
    const pre = container.querySelector('[data-testid="codeblock-pre"]')
    expect(pre).not.toBeNull()
    expect(pre?.textContent).toContain('const x = 1')
  })
})

describe('CodeBlock — async HTML swap', () => {
  it('Test 2: after highlight resolves, codeblock-html replaces the pre', async () => {
    ;(highlight as ReturnType<typeof vi.fn>).mockResolvedValue('<pre><code>highlighted</code></pre>')

    const { findByTestId } = render(<CodeBlock language="typescript" code="const x = 1" />)
    const htmlDiv = await findByTestId('codeblock-html')
    expect(htmlDiv).toBeTruthy()
    expect(htmlDiv.innerHTML).toContain('highlighted')
  })
})

describe('CodeBlock — copy to clipboard', () => {
  it('Test 3: clicking copy button calls navigator.clipboard.writeText with RAW code', async () => {
    ;(highlight as ReturnType<typeof vi.fn>).mockResolvedValue('<pre><code>highlighted</code></pre>')
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })

    const { findByRole } = render(<CodeBlock language="typescript" code="raw source text" />)
    const button = await findByRole('button', { name: /copy code/i })
    await act(async () => {
      fireEvent.click(button)
    })
    expect(writeText).toHaveBeenCalledWith('raw source text')
  })

  it('Test 4: icon morphs from Copy code to Copied! then reverts after 1200ms', async () => {
    vi.useFakeTimers()
    ;(highlight as ReturnType<typeof vi.fn>).mockResolvedValue('<pre><code>x</code></pre>')
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })

    render(<CodeBlock language="typescript" code="x" />)
    const button = screen.getByRole('button', { name: /copy code/i })

    await act(async () => {
      fireEvent.click(button)
    })
    expect(screen.getByRole('button', { name: /copied!/i })).toBeTruthy()

    await act(async () => {
      vi.advanceTimersByTime(1200)
    })
    expect(screen.getByRole('button', { name: /copy code/i })).toBeTruthy()
  })

  it('Test 5: fallback uses execCommand when navigator.clipboard is undefined', async () => {
    ;(highlight as ReturnType<typeof vi.fn>).mockResolvedValue('<pre><code>x</code></pre>')

    // Remove clipboard from navigator
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      configurable: true,
    })
    const execCommand = vi.fn().mockReturnValue(true)
    document.execCommand = execCommand

    render(<CodeBlock language="typescript" code="fallback text" />)
    const button = screen.getByRole('button', { name: /copy code/i })

    await act(async () => {
      fireEvent.click(button)
    })
    expect(execCommand).toHaveBeenCalledWith('copy')
  })
})

describe('CodeBlock — AssistantTurn integration', () => {
  it('Test 7: AssistantTurn with fenced code block renders a Copy code button', async () => {
    // We need to import AssistantTurn — it uses MarkdownRenderer → CodeBlock
    // Mocks for highlight and useUIStore are active in this file
    ;(highlight as ReturnType<typeof vi.fn>).mockResolvedValue('<pre><code>x</code></pre>')
    const { AssistantTurn } = await import('./AssistantTurn')
    const turn = {
      uuid: 'test-uuid',
      parentUuid: null,
      timestamp: '2026-04-27T00:00:00Z',
      role: 'assistant' as const,
      textBlocks: ['```typescript\nconst x = 1\n```'],
      thinkingBlocks: [],
      toolUses: [],
      toolResults: [],
      isMeta: false,
      agentId: null,
    }
    render(<AssistantTurn turn={turn} />)
    const copyButton = await screen.findByRole('button', { name: /copy code/i })
    expect(copyButton).toBeTruthy()
  })
})

describe('CodeBlock — theme reactivity', () => {
  it('Test 6: light theme passes vitesse-light to highlight', async () => {
    ;(useUIStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (selector: (s: { theme: 'dark' | 'light' }) => unknown) => selector({ theme: 'light' })
    )
    ;(highlight as ReturnType<typeof vi.fn>).mockResolvedValue('<pre><code>x</code></pre>')

    render(<CodeBlock language="typescript" code="const x=1" />)
    // Wait for effect to run
    await act(async () => {
      await Promise.resolve()
    })
    expect(highlight).toHaveBeenCalledWith(expect.any(String), expect.any(String), 'vitesse-light')
  })

  it('Test 6b: dark theme passes vitesse-dark to highlight', async () => {
    ;(useUIStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (selector: (s: { theme: 'dark' | 'light' }) => unknown) => selector({ theme: 'dark' })
    )
    ;(highlight as ReturnType<typeof vi.fn>).mockResolvedValue('<pre><code>x</code></pre>')

    render(<CodeBlock language="typescript" code="const x=1" />)
    await act(async () => {
      await Promise.resolve()
    })
    expect(highlight).toHaveBeenCalledWith(expect.any(String), expect.any(String), 'vitesse-dark')
  })
})
