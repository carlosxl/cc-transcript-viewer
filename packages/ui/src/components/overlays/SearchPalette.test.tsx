import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type {
  SearchHit,
  SearchResponse,
  SearchStatusResponse,
  SessionMeta,
  SessionsListResponse,
} from '@/lib/types'
import { SearchPalette } from './SearchPalette'
import { useOverlays } from '@/stores/useOverlays'

const fixtureHits: SearchHit[] = [
  {
    sessionId: 's-1',
    agentId: null,
    turnUuid: 'turn-aaaa1111',
    timestamp: '2026-05-22T10:00:00.000Z',
    role: 'user',
    contentKind: 'text',
    snippetHtml: 'matching <mark>query</mark> here',
    sessionTitle: 'First match',
    projectSlug: 'alpha',
  },
  {
    sessionId: 's-2',
    agentId: null,
    turnUuid: 'turn-bbbb2222',
    timestamp: '2026-05-22T10:00:00.000Z',
    role: 'assistant',
    contentKind: 'tool_use',
    snippetHtml: 'another <mark>query</mark>',
    sessionTitle: 'Second match',
    projectSlug: 'beta',
  },
]

function searchResponse(): SearchResponse {
  return { results: fixtureHits, query: 'query', truncated: false }
}

const sessionFixture = (id: string, title: string): SessionMeta => ({
  sessionId: id,
  projectSlug: 'alpha',
  projectPath: '/tmp/alpha',
  title,
  firstTimestamp: '2026-05-22T09:00:00.000Z',
  lastTimestamp: '2026-05-22T10:00:00.000Z',
  messageCount: 12,
  hasSubagents: false,
  totalUsage: {
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
    byAgent: {},
  },
})

let sessionsFixture: SessionsListResponse = { sessions: [] }

function statusResponse(): SearchStatusResponse {
  return { totalSessions: 10, pendingSessions: 0, isReconciling: false }
}

class FakeEventSource {
  static instances: FakeEventSource[] = []
  url: string
  listeners = new Map<string, EventListener[]>()
  onerror: ((e: Event) => void) | null = null
  constructor(url: string) {
    this.url = url
    FakeEventSource.instances.push(this)
  }
  addEventListener(type: string, fn: EventListener) {
    const arr = this.listeners.get(type) ?? []
    arr.push(fn)
    this.listeners.set(type, arr)
  }
  removeEventListener(type: string, fn: EventListener) {
    const arr = this.listeners.get(type) ?? []
    this.listeners.set(type, arr.filter((f) => f !== fn))
  }
  close() {}
}

function renderPalette(onPick = vi.fn(), onPickSession = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return {
    onPick,
    onPickSession,
    ...render(
      <QueryClientProvider client={client}>
        <SearchPalette onPick={onPick} onPickSession={onPickSession} />
      </QueryClientProvider>,
    ),
  }
}

describe('SearchPalette', () => {
  const realFetch = globalThis.fetch
  const realES = globalThis.EventSource

  beforeEach(() => {
    useOverlays.getState().closeAll()
    sessionsFixture = { sessions: [] }
    FakeEventSource.instances = []
    ;(globalThis as { EventSource?: typeof EventSource }).EventSource =
      FakeEventSource as unknown as typeof EventSource

    globalThis.fetch = vi.fn(async (input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      if (url.includes('/api/search/status')) {
        return new Response(JSON.stringify(statusResponse()), { status: 200 })
      }
      if (url.includes('/api/search?q=')) {
        return new Response(JSON.stringify(searchResponse()), { status: 200 })
      }
      if (url.endsWith('/api/sessions')) {
        return new Response(JSON.stringify(sessionsFixture), { status: 200 })
      }
      return new Response('{}', { status: 200 })
    }) as unknown as typeof fetch
  })

  afterEach(() => {
    globalThis.fetch = realFetch
    if (realES) {
      ;(globalThis as { EventSource?: typeof EventSource }).EventSource = realES
    }
    useOverlays.getState().closeAll()
  })

  it('renders nothing when the overlay is closed', () => {
    renderPalette()
    expect(screen.queryByRole('dialog', { name: /search/i })).toBeNull()
  })

  it('renders results, supports arrow nav and Enter pick when open', async () => {
    const { onPick } = renderPalette()
    act(() => {
      useOverlays.getState().openSearch()
      useOverlays.getState().setQuery('query')
    })

    await waitFor(() => expect(screen.getByText('First match')).toBeInTheDocument())
    expect(screen.getByText('Second match')).toBeInTheDocument()

    // First row is active by default — pressing Enter picks it.
    fireEvent.keyDown(window, { key: 'ArrowDown' })
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(onPick).toHaveBeenCalledTimes(1)
    expect(onPick.mock.calls[0][0].sessionId).toBe('s-2')
  })

  it('shows the empty-state copy when the query is empty', () => {
    renderPalette()
    act(() => {
      useOverlays.getState().openSearch()
    })
    expect(screen.getByText(/Start typing to search/i)).toBeInTheDocument()
  })

  it('surfaces session-ID prefix matches above content hits and picks them via Enter', async () => {
    sessionsFixture = {
      sessions: [
        sessionFixture('abc12345-feed-beef-dead-cafebabe0001', 'Alpha session'),
        sessionFixture('abc12999-something-else', 'Alpha cousin'),
        sessionFixture('zzz99999-other', 'Unrelated'),
      ],
    }
    const onPick = vi.fn()
    const onPickSession = vi.fn()
    renderPalette(onPick, onPickSession)
    act(() => {
      useOverlays.getState().openSearch()
      useOverlays.getState().setQuery('abc12')
    })

    // Sessions group renders with both prefix matches, not the unrelated one.
    await waitFor(() => expect(screen.getByText('Alpha session')).toBeInTheDocument())
    expect(screen.getByText('Alpha cousin')).toBeInTheDocument()
    expect(screen.queryByText('Unrelated')).toBeNull()

    // First entry is the first session match — Enter picks it via onPickSession.
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(onPickSession).toHaveBeenCalledTimes(1)
    expect(onPickSession.mock.calls[0][0]).toBe('abc12345-feed-beef-dead-cafebabe0001')
    expect(onPick).not.toHaveBeenCalled()
  })

  it('does not surface session matches for queries shorter than the threshold', async () => {
    sessionsFixture = {
      sessions: [sessionFixture('abc12345-feed-beef-dead-cafebabe0001', 'Alpha session')],
    }
    renderPalette()
    act(() => {
      useOverlays.getState().openSearch()
      useOverlays.getState().setQuery('ab')
    })
    // Content hits still load from the FTS5 fixture; the session row should not.
    await waitFor(() => expect(screen.getByText('First match')).toBeInTheDocument())
    expect(screen.queryByText('Alpha session')).toBeNull()
  })
})
