import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Turn } from '@cc-viewer/shared'
import type { VirtualNode } from '@/lib/flatNodes'
import { Minimap } from './Minimap'

afterEach(() => cleanup())

function makeTurn(overrides: Partial<Turn> = {}): Turn {
  return {
    uuid: 'u-1',
    parentUuid: null,
    timestamp: '2026-04-26T00:00:00Z',
    role: 'assistant',
    textBlocks: [],
    thinkingBlocks: [],
    toolUses: [],
    toolResults: [],
    isMeta: false,
    agentId: null,
    ...overrides,
  }
}

function turnNode(uuid: string, role: Turn['role'] = 'assistant'): VirtualNode {
  return { kind: 'turn', key: uuid, turn: makeTurn({ uuid, role }) }
}

function capsuleNode(uuid: string, toolUseId: string): VirtualNode {
  return {
    kind: 'capsule',
    key: `${uuid}:cap:${toolUseId}`,
    turn: makeTurn({ uuid, role: 'assistant' }),
    toolUseId,
  }
}

describe('Minimap', () => {
  it('renders one button per node when nodes.length ≤ 2000', () => {
    const nodes: VirtualNode[] = [
      turnNode('a', 'user'),
      turnNode('b'),
      capsuleNode('b', 'tu-1'),
    ]
    render(<Minimap nodes={nodes} focusedIndex={-1} onSeek={() => {}} />)
    expect(screen.getAllByRole('button')).toHaveLength(3)
  })

  it('renders nothing when there are no nodes', () => {
    const { container } = render(<Minimap nodes={[]} focusedIndex={-1} onSeek={() => {}} />)
    expect(container.firstChild).toBeNull()
  })

  it('marks the focused bar with aria-current', () => {
    const nodes: VirtualNode[] = [turnNode('a'), turnNode('b'), turnNode('c')]
    render(<Minimap nodes={nodes} focusedIndex={1} onSeek={() => {}} />)
    const buttons = screen.getAllByRole('button')
    expect(buttons[1]).toHaveAttribute('aria-current', 'true')
    expect(buttons[0]).not.toHaveAttribute('aria-current')
  })

  it('seeks to the bar index on click', async () => {
    const onSeek = vi.fn()
    const user = userEvent.setup()
    const nodes: VirtualNode[] = [turnNode('a'), turnNode('b'), turnNode('c')]
    render(<Minimap nodes={nodes} focusedIndex={-1} onSeek={onSeek} />)
    await user.click(screen.getAllByRole('button')[2]!)
    expect(onSeek).toHaveBeenCalledWith(2)
  })

  it('downsamples beyond 2000 nodes', () => {
    const nodes: VirtualNode[] = Array.from({ length: 4000 }, (_, i) => turnNode(`u-${i}`))
    render(<Minimap nodes={nodes} focusedIndex={-1} onSeek={() => {}} />)
    expect(screen.getAllByRole('button')).toHaveLength(2000)
  })

  it('exposes a nav landmark with an accessible label', () => {
    render(<Minimap nodes={[turnNode('a')]} focusedIndex={-1} onSeek={() => {}} />)
    expect(screen.getByRole('navigation', { name: /transcript minimap/i })).toBeInTheDocument()
  })
})
