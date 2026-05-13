import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { StderrBlock } from './StderrBlock'
import type { Turn } from '@cc-viewer/shared'

afterEach(cleanup)

function turnWith(text: string): Turn {
  return {
    uuid: 't', parentUuid: null, timestamp: '2026-05-09T17:30:36Z',
    role: 'user', textBlocks: [text], thinkingBlocks: [],
    toolUses: [], toolResults: [], isMeta: false, agentId: null,
  }
}

describe('StderrBlock', () => {
  it('renders the stderr text with danger styling', () => {
    const { container } = render(
      <StderrBlock turn={turnWith('<local-command-stderr>fatal: bad ref</local-command-stderr>')} />,
    )
    expect(screen.getByText(/fatal: bad ref/)).toBeInTheDocument()
    expect(container.querySelector('[data-role="stderr"]')!.className).toMatch(
      /bg-\[var\(--danger-soft\)\]/,
    )
  })

  it('renders nothing for non-stderr text', () => {
    const { container } = render(<StderrBlock turn={turnWith('plain user prose')} />)
    expect(container.textContent).toBe('')
  })

  it('also renders when stderr lives inside a command turn', () => {
    render(
      <StderrBlock turn={turnWith(
        '<command-name>/x</command-name><local-command-stderr>boom</local-command-stderr>',
      )} />,
    )
    expect(screen.getByText(/boom/)).toBeInTheDocument()
  })
})
