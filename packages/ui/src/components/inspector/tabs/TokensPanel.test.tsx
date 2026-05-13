import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import type { TokenSeries, FileTouchIndex, Turn, ToolInteraction } from '@cc-viewer/shared'
import type { ActiveQuery } from '@/hooks/useActiveQuery'

const mockActive = vi.fn<() => ActiveQuery>()

vi.mock('@/hooks/useActiveQuery', () => ({
  useActiveQuery: () => mockActive(),
}))

import { TokensPanel } from './TokensPanel'
import { useSearchStore } from '@/stores/useSearchStore'

function emptySeries(): TokenSeries {
  return {
    points: [],
    byModel: [],
    spikes: [],
    cacheHitPct: 0,
    avgPerTurn: 0,
  }
}

function nonEmptySeries(): TokenSeries {
  return {
    points: [
      { turnUuid: 't1', turnIndex: 0, model: 'claude-opus-4-7', input: 1000, output: 500, cacheCreate: 200, cacheRead: 100 },
      { turnUuid: 't2', turnIndex: 1, model: 'claude-opus-4-7', input: 2000, output: 800, cacheCreate: 400, cacheRead: 300 },
      { turnUuid: 't3', turnIndex: 2, model: 'claude-sonnet-4-6', input: 50000, output: 30000, cacheCreate: 9000, cacheRead: 1000 },
    ],
    byModel: [
      { model: 'claude-sonnet-4-6', tokens: 90000, pct: 0.95 },
      { model: 'claude-opus-4-7', tokens: 5300, pct: 0.05 },
    ],
    spikes: [{ turnUuid: 't3', tokens: 89000, reason: 'high-input' }],
    cacheHitPct: 0.05,
    avgPerTurn: 31300,
  }
}

function active(over: Partial<ActiveQuery> = {}): ActiveQuery {
  return {
    turns: [] as Turn[],
    interactions: [] as ToolInteraction[],
    tokenSeries: nonEmptySeries(),
    fileTouchIndex: { files: [] } as FileTouchIndex,
    sessionId: 's1',
    agentId: null,
    ...over,
  }
}

beforeEach(() => {
  mockActive.mockReset()
  useSearchStore.setState({ pendingJumpTarget: null, isOpen: false, query: '' })
})

afterEach(cleanup)

describe('TokensPanel', () => {
  it('renders empty state when projection missing', () => {
    mockActive.mockReturnValue(active({ tokenSeries: undefined }))
    render(<TokensPanel />)
    expect(screen.getByText('No token data')).toBeInTheDocument()
  })

  it('renders empty state when no points', () => {
    mockActive.mockReturnValue(active({ tokenSeries: emptySeries() }))
    render(<TokensPanel />)
    expect(screen.getByText('No token usage')).toBeInTheDocument()
  })

  it('renders chart, stat grid, models, and spikes when data present', () => {
    mockActive.mockReturnValue(active())
    render(<TokensPanel />)
    expect(screen.getByText('Token usage')).toBeInTheDocument()
    expect(screen.getByText('By model')).toBeInTheDocument()
    expect(screen.getByText('Spike turns')).toBeInTheDocument()
    expect(screen.getByText('Total')).toBeInTheDocument()
    expect(screen.getByText('Cache hit')).toBeInTheDocument()
    expect(screen.getByText('claude-sonnet-4-6')).toBeInTheDocument()
    expect(screen.getByText('High input')).toBeInTheDocument()
  })

  it('clicking a spike row dispatches a jump target', () => {
    mockActive.mockReturnValue(active())
    render(<TokensPanel />)
    fireEvent.click(screen.getByText('High input').closest('button')!)
    const target = useSearchStore.getState().pendingJumpTarget
    expect(target).not.toBeNull()
    expect(target?.sessionId).toBe('s1')
    expect(target?.turnUuid).toBe('t3')
    expect(target?.agentId).toBeNull()
  })

  it('respects subagent scope when active', () => {
    mockActive.mockReturnValue(active({ agentId: 'agentX', sessionId: 'sParent' }))
    render(<TokensPanel />)
    fireEvent.click(screen.getByText('High input').closest('button')!)
    const target = useSearchStore.getState().pendingJumpTarget
    expect(target?.agentId).toBe('agentX')
    expect(target?.sessionId).toBe('sParent')
  })
})
