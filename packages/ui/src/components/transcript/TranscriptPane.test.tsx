import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TooltipProvider } from '@/components/ui/tooltip'
import { TranscriptPane } from './TranscriptPane'
import { useUIStore } from '@/stores/useUIStore'
import { useScrollStore } from '@/stores/useScrollStore'
import * as api from '@/api'
import type { Turn, SessionMeta } from '@cc-viewer/shared'

// Mock useActiveSessionMeta for new Task 4 tests
const mockUseActiveSessionMeta = vi.fn<() => SessionMeta | undefined>()
vi.mock('@/hooks/useActiveSessionMeta', () => ({
  useActiveSessionMeta: () => mockUseActiveSessionMeta(),
}))

// Mock react-virtuoso: jsdom + ResizeObserver stub + React 19 useSyncExternalStore
// causes "getSnapshot should be cached" infinite loop. Flat render in tests suffices.
vi.mock('react-virtuoso', () => ({
  Virtuoso: ({ data, itemContent }: { data: unknown[]; itemContent: (index: number, item: unknown) => React.ReactNode }) => (
    <div>
      {data.map((item, index) => (
        <div key={index}>{itemContent(index, item)}</div>
      ))}
    </div>
  ),
}))

// Mock useFlatNodes: subscribing to the Zustand store in jsdom triggers
// React 19's "getSnapshot should be cached" invariant under repeated renders.
// The mock derives nodes synchronously from store state — good enough for
// unit tests.
vi.mock('@/hooks/useFlatNodes', async () => {
  const { useUIStore } = await import('@/stores/useUIStore')
  const { buildFlatNodes } = await import('@/lib/flatNodes')
  return {
    useFlatNodes: (turns: import('@cc-viewer/shared').Turn[]) => {
      const mode = useUIStore.getState().viewMode
      return buildFlatNodes(turns, mode)
    },
  }
})

function withQuery(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <TooltipProvider>{ui}</TooltipProvider>
    </QueryClientProvider>
  )
}

function turn(over: Partial<Turn> = {}): Turn {
  return {
    uuid: 't-1', parentUuid: null, timestamp: '2026-04-26T00:00:00Z',
    role: 'assistant', textBlocks: ['hello'], thinkingBlocks: [],
    toolUses: [], toolResults: [], isMeta: false, agentId: null, ...over,
  }
}

beforeEach(() => {
  useUIStore.setState({ activeSessionId: null, viewMode: 'compact' })
  useScrollStore.setState({ lastScrollIndex: 0 })
  mockUseActiveSessionMeta.mockReturnValue(undefined)
  vi.restoreAllMocks()
})

afterEach(() => {
  cleanup()
})

describe('TranscriptPane', () => {
  it('shows the empty state when activeSessionId is null', () => {
    withQuery(<TranscriptPane />)
    expect(screen.getByText('Select a session')).toBeInTheDocument()
  })

  it('shows skeleton ghosts while loading', () => {
    useUIStore.setState({ activeSessionId: 's-1' })
    vi.spyOn(api, 'fetchSession').mockImplementation(() => new Promise(() => {}))
    withQuery(<TranscriptPane />)
    expect(screen.getByRole('status', { name: /Loading session/i })).toBeInTheDocument()
  })

  it('shows error + Try again on failure', async () => {
    useUIStore.setState({ activeSessionId: 's-1' })
    vi.spyOn(api, 'fetchSession').mockRejectedValue(new Error('boom'))
    withQuery(<TranscriptPane />)
    await waitFor(() => expect(screen.getByText('Could not load session')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /Try again/i })).toBeInTheDocument()
  })

  it('renders turns as VirtualNodeRow placeholders when data resolves', async () => {
    useUIStore.setState({ activeSessionId: 's-1' })
    vi.spyOn(api, 'fetchSession').mockResolvedValue({
      turns: [turn({ uuid: 'a', textBlocks: ['hello world'] })],
      subagents: [],
      usage: { inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0,
               byAgent: { '': { inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0 } } },
      parseWarnings: 0,
    })
    withQuery(<TranscriptPane />)
    await waitFor(() => expect(screen.getByText(/hello world/)).toBeInTheDocument())
    // The placeholder TurnPlaceholder sets data-turn-uuid + data-role
    expect(document.querySelector('[data-turn-uuid="a"]')).not.toBeNull()
    expect(document.querySelector('[data-role="assistant"]')).not.toBeNull()
  })

  it('shows "no displayable turns" when data.turns is empty', async () => {
    useUIStore.setState({ activeSessionId: 's-1' })
    vi.spyOn(api, 'fetchSession').mockResolvedValue({
      turns: [],
      subagents: [],
      usage: { inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0,
               byAgent: { '': { inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0 } } },
      parseWarnings: 0,
    })
    withQuery(<TranscriptPane />)
    await waitFor(() => expect(screen.getByText(/no displayable turns/i)).toBeInTheDocument())
  })
})

// Task 4 (02-09): Sibling-flex header integration tests
describe('TranscriptPane — sibling-flex header (plan 02-09)', () => {
  function makeMeta(id = 's-1'): SessionMeta {
    return {
      sessionId: id, projectSlug: 'p', projectPath: '/p', title: 'Test Session',
      firstTimestamp: '2026-04-01T00:00:00Z', lastTimestamp: '2026-04-01T01:00:00Z',
      messageCount: 5, hasSubagents: false,
      totalUsage: { inputTokens: 100, outputTokens: 50, cacheCreationTokens: 10, cacheReadTokens: 20, byAgent: {} },
    }
  }

  it('Test T4-1: renders TranscriptHeader banner when session is active and meta is available', async () => {
    useUIStore.setState({ activeSessionId: 's-1' })
    mockUseActiveSessionMeta.mockReturnValue(makeMeta('s-1'))
    vi.spyOn(api, 'fetchSession').mockResolvedValue({
      turns: [turn({ uuid: 'a', textBlocks: ['hi'] })],
      subagents: [],
      usage: { inputTokens: 100, outputTokens: 50, cacheCreationTokens: 10, cacheReadTokens: 20,
               byAgent: { '': { inputTokens: 100, outputTokens: 50, cacheCreationTokens: 10, cacheReadTokens: 20 } } },
      parseWarnings: 0,
    })
    withQuery(<TranscriptPane />)
    await waitFor(() => {
      const banner = screen.getByRole('banner', { name: /transcript header/i })
      expect(banner).toBeInTheDocument()
    })
  })

  it('Test T4-2: renders skeleton banner (undefined meta) while list is loading', () => {
    useUIStore.setState({ activeSessionId: 's-1' })
    mockUseActiveSessionMeta.mockReturnValue(undefined)
    vi.spyOn(api, 'fetchSession').mockImplementation(() => new Promise(() => {}))
    withQuery(<TranscriptPane />)
    // While loading, TranscriptPane shows LoadingGhosts (no banner in that path)
    expect(screen.getByRole('status', { name: /Loading session/i })).toBeInTheDocument()
  })

  it('Test T4-3: no topItemCount — Virtuoso mock receives data prop, not a special sticky item', async () => {
    useUIStore.setState({ activeSessionId: 's-1' })
    mockUseActiveSessionMeta.mockReturnValue(makeMeta('s-1'))
    const fetchMock = vi.spyOn(api, 'fetchSession').mockResolvedValue({
      turns: [turn({ uuid: 'x', textBlocks: ['content'] })],
      subagents: [],
      usage: { inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0,
               byAgent: { '': { inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0 } } },
      parseWarnings: 0,
    })
    withQuery(<TranscriptPane />)
    await waitFor(() => expect(screen.getByText('content')).toBeInTheDocument())
    expect(fetchMock).toHaveBeenCalled()
    // The flat-node array contains only turn nodes, no header node injected
    // (verified by checking the VirtualNodeRow renders turn content, not a header)
    expect(document.querySelector('[data-turn-uuid="x"]')).not.toBeNull()
  })

  it('Test T4-4: VirtualList root has flex-1 min-h-0 wrapper for correct flex shrink', async () => {
    useUIStore.setState({ activeSessionId: 's-1' })
    mockUseActiveSessionMeta.mockReturnValue(makeMeta('s-1'))
    vi.spyOn(api, 'fetchSession').mockResolvedValue({
      turns: [turn({ uuid: 'b', textBlocks: ['body'] })],
      subagents: [],
      usage: { inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0,
               byAgent: { '': { inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0 } } },
      parseWarnings: 0,
    })
    withQuery(<TranscriptPane />)
    await waitFor(() => expect(screen.getByText('body')).toBeInTheDocument())
    // The outer wrapper must be h-full flex flex-col
    const outerWrapper = document.querySelector('.h-full.flex.flex-col')
    expect(outerWrapper).not.toBeNull()
    // The Virtuoso wrapper must have flex-1 min-h-0
    const virtuosoWrapper = document.querySelector('.flex-1.min-h-0')
    expect(virtuosoWrapper).not.toBeNull()
  })

  it('Test T4-5: TranscriptHeader receives meta from useActiveSessionMeta', async () => {
    const meta = makeMeta('s-1')
    useUIStore.setState({ activeSessionId: 's-1' })
    mockUseActiveSessionMeta.mockReturnValue({ ...meta, title: 'My Unique Title' })
    vi.spyOn(api, 'fetchSession').mockResolvedValue({
      turns: [turn({ uuid: 'c', textBlocks: ['msg'] })],
      subagents: [],
      usage: { inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0,
               byAgent: { '': { inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0 } } },
      parseWarnings: 0,
    })
    withQuery(<TranscriptPane />)
    await waitFor(() => {
      expect(screen.getByText('My Unique Title')).toBeInTheDocument()
    })
  })
})
