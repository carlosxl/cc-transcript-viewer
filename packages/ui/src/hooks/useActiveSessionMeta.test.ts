import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, cleanup } from '@testing-library/react'
import type { SessionMeta } from '@cc-viewer/shared'

const mockUseSessionList = vi.fn()
const mockActiveSessionId = vi.fn<() => string | null>()

vi.mock('./useSessionList', () => ({
  useSessionList: () => mockUseSessionList(),
}))

vi.mock('../stores/useUIStore', () => ({
  useUIStore: (sel: (s: { activeSessionId: string | null }) => unknown) =>
    sel({ activeSessionId: mockActiveSessionId() }),
}))

// Import after mocks are declared
import { useActiveSessionMeta } from './useActiveSessionMeta'

function makeMeta(id: string): SessionMeta {
  return {
    sessionId: id,
    projectSlug: 'p',
    projectPath: '/p',
    title: 't',
    firstTimestamp: '2026-04-01T00:00:00Z',
    lastTimestamp: '2026-04-01T00:01:00Z',
    messageCount: 1,
    hasSubagents: false,
    totalUsage: {
      inputTokens: 0,
      outputTokens: 0,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
      byAgent: {},
    },
  }
}

beforeEach(() => {
  mockUseSessionList.mockReset()
  mockActiveSessionId.mockReset()
})

afterEach(() => {
  cleanup()
})

describe('useActiveSessionMeta', () => {
  it('returns undefined when activeSessionId is null', () => {
    mockActiveSessionId.mockReturnValue(null)
    mockUseSessionList.mockReturnValue({
      data: [makeMeta('a')],
      isLoading: false,
      error: null,
    })
    const { result } = renderHook(() => useActiveSessionMeta())
    expect(result.current).toBeUndefined()
  })

  it('returns matching SessionMeta when list contains the active id', () => {
    const m = makeMeta('sess-1')
    mockActiveSessionId.mockReturnValue('sess-1')
    mockUseSessionList.mockReturnValue({
      data: [makeMeta('a'), m, makeMeta('b')],
      isLoading: false,
      error: null,
    })
    const { result } = renderHook(() => useActiveSessionMeta())
    expect(result.current).toBe(m)
  })

  it('returns undefined when activeSessionId is not present in list', () => {
    mockActiveSessionId.mockReturnValue('sess-missing')
    mockUseSessionList.mockReturnValue({
      data: [makeMeta('a')],
      isLoading: false,
      error: null,
    })
    const { result } = renderHook(() => useActiveSessionMeta())
    expect(result.current).toBeUndefined()
  })

  it('returns undefined while list is loading (data is undefined)', () => {
    mockActiveSessionId.mockReturnValue('sess-1')
    mockUseSessionList.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    })
    const { result } = renderHook(() => useActiveSessionMeta())
    expect(result.current).toBeUndefined()
  })

  it('returns the same object reference on re-renders when inputs are stable', () => {
    const m = makeMeta('sess-1')
    const list = [m]
    mockActiveSessionId.mockReturnValue('sess-1')
    mockUseSessionList.mockReturnValue({
      data: list,
      isLoading: false,
      error: null,
    })
    const { result, rerender } = renderHook(() => useActiveSessionMeta())
    const first = result.current
    rerender()
    expect(result.current).toBe(first)
  })
})
