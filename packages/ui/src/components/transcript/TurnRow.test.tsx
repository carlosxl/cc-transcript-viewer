import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { TurnRow } from './TurnRow'
import type { Turn } from '@cc-viewer/shared'

afterEach(cleanup)

function turn(over: Partial<Turn> = {}): Turn {
  return {
    uuid: 't', parentUuid: null, timestamp: '2026-04-26T00:00:00Z',
    role: 'user', textBlocks: ['hello'], thinkingBlocks: [],
    toolUses: [], toolResults: [], isMeta: false, agentId: null, ...over,
  }
}

describe('TurnRow', () => {
  it('renders user role with User label', () => {
    render(<TurnRow turn={turn({ role: 'user' })} />)
    expect(screen.getByText('User')).toBeInTheDocument()
  })

  it('renders assistant role with Claude label and indigo stripe', () => {
    const { container } = render(<TurnRow turn={turn({ role: 'assistant', textBlocks: ['hi'] })} />)
    expect(screen.getByText('Claude')).toBeInTheDocument()
    expect(container.querySelector('[data-role="assistant"]')!.className).toMatch(/border-l-indigo/)
  })

  it('renders system role with System label', () => {
    render(<TurnRow turn={turn({ role: 'system', textBlocks: ['[system]'] })} />)
    expect(screen.getByText('System')).toBeInTheDocument()
  })

  it('long content >20 lines triggers Show full button', () => {
    const longText = Array.from({ length: 25 }, (_, i) => `line ${i}`).join('\n')
    render(<TurnRow turn={turn({ role: 'user', textBlocks: [longText] })} />)
    expect(screen.getByText(/Show full \(25 lines\)/)).toBeInTheDocument()
  })

  it('short content does NOT show preview button', () => {
    render(<TurnRow turn={turn({ role: 'user', textBlocks: ['short'] })} />)
    expect(screen.queryByText(/Show full/)).toBeNull()
  })
})
