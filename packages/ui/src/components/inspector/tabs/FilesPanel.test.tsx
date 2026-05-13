import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import type { FileTouchIndex, TokenSeries, Turn, ToolInteraction } from '@cc-viewer/shared'
import type { ActiveQuery } from '@/hooks/useActiveQuery'

const mockActive = vi.fn<() => ActiveQuery>()

vi.mock('@/hooks/useActiveQuery', () => ({
  useActiveQuery: () => mockActive(),
}))

import { FilesPanel } from './FilesPanel'
import { useSearchStore } from '@/stores/useSearchStore'

function buildTurns(): Turn[] {
  return [
    {
      uuid: 't1', parentUuid: null, timestamp: '2026-05-12T00:00:00Z',
      role: 'user', textBlocks: [], thinkingBlocks: [], toolUses: [], toolResults: [],
      isMeta: false, agentId: null,
    },
    {
      uuid: 't9', parentUuid: 't1', timestamp: '2026-05-12T01:00:00Z',
      role: 'user', textBlocks: [], thinkingBlocks: [], toolUses: [], toolResults: [],
      isMeta: false, agentId: null,
    },
  ]
}

function buildIndex(): FileTouchIndex {
  return {
    files: [
      {
        path: '/repo/src/a.ts',
        reads: [
          { turnUuid: 't1', timestamp: '2026-05-12T00:10:00Z' },
          { turnUuid: 't9', timestamp: '2026-05-12T00:50:00Z' },
        ],
        writes: [{ turnUuid: 't9', timestamp: '2026-05-12T00:55:00Z' }],
        changed: true,
        lineCount: 120,
      },
      {
        path: '/repo/src/b.ts',
        reads: [{ turnUuid: 't1', timestamp: '2026-05-12T00:20:00Z' }],
        writes: [],
        changed: false,
        lineCount: 40,
      },
    ],
  }
}

function active(over: Partial<ActiveQuery> = {}): ActiveQuery {
  return {
    turns: buildTurns(),
    interactions: [] as ToolInteraction[],
    tokenSeries: undefined as unknown as TokenSeries,
    fileTouchIndex: buildIndex(),
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

describe('FilesPanel', () => {
  it('renders empty state when index missing', () => {
    mockActive.mockReturnValue(active({ fileTouchIndex: undefined }))
    render(<FilesPanel />)
    expect(screen.getByText('No file data')).toBeInTheDocument()
  })

  it('renders empty state when no files touched', () => {
    mockActive.mockReturnValue(active({ fileTouchIndex: { files: [] } }))
    render(<FilesPanel />)
    expect(screen.getByText('No files touched')).toBeInTheDocument()
  })

  it('lists all touched files with read/write counts', () => {
    mockActive.mockReturnValue(active())
    render(<FilesPanel />)
    expect(screen.getByText('a.ts')).toBeInTheDocument()
    expect(screen.getByText('b.ts')).toBeInTheDocument()
    expect(screen.getByText('2 of 2')).toBeInTheDocument()
    expect(screen.getByText('2 reads')).toBeInTheDocument()
    expect(screen.getByText('1 write')).toBeInTheDocument()
  })

  it('"Changed only" filter hides unchanged files', () => {
    mockActive.mockReturnValue(active())
    render(<FilesPanel />)
    fireEvent.click(screen.getByRole('button', { name: /Changed only/i }))
    expect(screen.getByText('a.ts')).toBeInTheDocument()
    expect(screen.queryByText('b.ts')).not.toBeInTheDocument()
    expect(screen.getByText('1 of 2')).toBeInTheDocument()
  })

  it('clicking a timeline marker dispatches a jump target', () => {
    mockActive.mockReturnValue(active())
    render(<FilesPanel />)
    const markers = screen.getAllByRole('button', { name: /^(Read|Write)/ })
    expect(markers.length).toBeGreaterThan(0)
    fireEvent.click(markers[0]!)
    const target = useSearchStore.getState().pendingJumpTarget
    expect(target).not.toBeNull()
    expect(target?.sessionId).toBe('s1')
  })
})
