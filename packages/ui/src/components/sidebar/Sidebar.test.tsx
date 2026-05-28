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
