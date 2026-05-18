import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { StdoutBlock } from './StdoutBlock'
import type { Turn } from '@cc-viewer/shared'

afterEach(cleanup)

function turnWith(text: string): Turn {
  return {
    uuid: 'turn-stdout',
    parentUuid: null,
    timestamp: '2026-05-15T02:04:42.717Z',
    role: 'user',
    textBlocks: [text],
    thinkingBlocks: [],
    toolUses: [],
    toolResults: [],
    isMeta: false,
    agentId: null,
  }
}

describe('StdoutBlock', () => {
  it('renders the stdout body with neutral chrome', () => {
    const { container } = render(
      <StdoutBlock turn={turnWith('<local-command-stdout>**Interpret:** 59 tables</local-command-stdout>')} />,
    )
    expect(screen.getByText(/Interpret/)).toBeInTheDocument()
    const root = container.querySelector('[data-role="stdout"]')
    expect(root).not.toBeNull()
    expect(root!.className).toMatch(/bg-\[var\(--surface-2\)\]/)
  })

  it('renders nothing for non-stdout text', () => {
    const { container } = render(<StdoutBlock turn={turnWith('plain user prose')} />)
    expect(container.textContent).toBe('')
  })

  it('also renders when stdout is embedded inside a command turn', () => {
    render(
      <StdoutBlock turn={turnWith(
        '<command-name>/x</command-name><local-command-stdout>captured</local-command-stdout>',
      )} />,
    )
    expect(screen.getByText(/captured/)).toBeInTheDocument()
  })
})
