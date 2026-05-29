import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TooltipProvider } from '@/components/ui/tooltip'
import type { SessionMeta, SessionsListResponse } from '@/lib/types'
import { Sidebar } from './Sidebar'

function meta(overrides: Partial<SessionMeta> = {}): SessionMeta {
  return {
    sessionId: 'sid',
    projectSlug: 'demo',
    projectPath: '/Users/me/code/demo',
    title: 'Demo session',
    firstTimestamp: '2026-05-22T09:00:00.000Z',
    lastTimestamp: '2026-05-22T10:00:00.000Z',
    messageCount: 42,
    hasSubagents: false,
    totalUsage: {
      inputTokens: 1000,
      outputTokens: 500,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
      byAgent: {},
    },
    ...overrides,
  }
}

function renderSidebar(activeSessionId: string | null, onSelect = vi.fn()) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return {
    ...render(
      <QueryClientProvider client={client}>
        <TooltipProvider delayDuration={0}>
          <Sidebar activeSessionId={activeSessionId} onSelectSession={onSelect} />
        </TooltipProvider>
      </QueryClientProvider>,
    ),
    onSelect,
  }
}

describe('Sidebar', () => {
  const realFetch = globalThis.fetch
  beforeEach(() => {
    const response: SessionsListResponse = {
      sessions: [
        meta({ sessionId: 's1', title: 'First session', projectPath: '/Users/me/code/alpha' }),
        meta({ sessionId: 's2', title: 'Second session', projectPath: '/Users/me/code/alpha' }),
        meta({ sessionId: 's3', title: 'Other project session', projectPath: '/Users/me/code/beta' }),
      ],
    }
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify(response), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    ) as unknown as typeof fetch
  })
  afterEach(() => {
    globalThis.fetch = realFetch
  })

  it('renders project groups for each unique project path', async () => {
    renderSidebar(null)
    // Wait for the query to resolve.
    expect(await screen.findByText('alpha')).toBeInTheDocument()
    expect(screen.getByText('beta')).toBeInTheDocument()
  })

  it('renders each session and calls onSelectSession with its id on click', async () => {
    const { onSelect } = renderSidebar(null)
    const row = await screen.findByText('First session')
    fireEvent.click(row)
    expect(onSelect).toHaveBeenCalledWith('s1')
  })

  it('marks the active session row with data-active', async () => {
    renderSidebar('s2')
    const row = await screen.findByText('Second session')
    const rowEl = row.closest('.sb-row')!
    expect(rowEl.getAttribute('data-active')).toBe('true')
  })
})

describe('Sidebar — project sorting and time filter', () => {
  const realFetch = globalThis.fetch
  // Pin the clock so the time-window cutoff is deterministic. recentTs is within
  // the default 7-day window; oldTs is ~2 months before "now".
  const recentTs = '2026-05-28T10:00:00.000Z'
  const oldTs = '2026-04-01T10:00:00.000Z'
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-05-29T12:00:00.000Z'))
    const response: SessionsListResponse = {
      sessions: [
        // zebra is fetched first but should sort after apple by name.
        meta({ sessionId: 'z1', title: 'Zebra session', projectPath: '/Users/me/code/zebra', firstTimestamp: recentTs, lastTimestamp: recentTs }),
        meta({ sessionId: 'a1', title: 'Apple session', projectPath: '/Users/me/code/apple', firstTimestamp: recentTs, lastTimestamp: recentTs }),
        meta({ sessionId: 'old1', title: 'Ancient session', projectPath: '/Users/me/code/apple', firstTimestamp: oldTs, lastTimestamp: oldTs }),
      ],
    }
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify(response), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    ) as unknown as typeof fetch
  })
  afterEach(() => {
    globalThis.fetch = realFetch
    vi.useRealTimers()
  })

  it('sorts project groups alphabetically by name', async () => {
    renderSidebar(null)
    await screen.findByText('apple')
    const names = screen.getAllByText(/apple|zebra/).map((el) => el.textContent)
    expect(names).toEqual(['apple', 'zebra'])
  })

  it('hides sessions outside the selected time window and reveals them on "All time"', async () => {
    renderSidebar(null)
    // Default window is 7 days, so the ~1-year-old session is hidden.
    await screen.findByText('Apple session')
    expect(screen.queryByText('Ancient session')).not.toBeInTheDocument()

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'all' } })
    expect(await screen.findByText('Ancient session')).toBeInTheDocument()
  })
})
