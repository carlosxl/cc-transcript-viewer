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
  it('renders user role with You label', () => {
    render(<TurnRow turn={turn({ role: 'user' })} />)
    expect(screen.getByText('You')).toBeInTheDocument()
  })

  it('renders assistant role with Claude label and round claude-tint avatar', () => {
    const { container } = render(<TurnRow turn={turn({ role: 'assistant', textBlocks: ['hi'] })} />)
    expect(screen.getByText('Claude')).toBeInTheDocument()
    const avatar = container.querySelector('[data-role="assistant"] > div')
    expect(avatar!.className).toMatch(/rounded-full/)
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

  it('user turn with <command-name> renders the CommandBlock instead of a YOU avatar', () => {
    render(<TurnRow turn={turn({ role: 'user', textBlocks: ['<command-name>/clear</command-name>'] })} />)
    expect(screen.queryByText('You')).toBeNull()
    expect(screen.getByText('/clear')).toBeInTheDocument()
  })
})
