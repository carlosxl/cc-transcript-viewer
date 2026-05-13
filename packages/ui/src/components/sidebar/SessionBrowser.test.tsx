import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SessionBrowser } from './SessionBrowser'
import { useUIStore } from '@/stores/useUIStore'
import * as api from '@/api'
import type { SessionMeta } from '@cc-viewer/shared'

function withQuery(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

function meta(over: Partial<SessionMeta> = {}): SessionMeta {
  return {
    sessionId: 's-1', projectSlug: '-a', projectPath: '/a', title: 'A',
    firstTimestamp: '2026-04-25T00:00:00Z', lastTimestamp: '2026-04-26T00:00:00Z',
    messageCount: 1, hasSubagents: false,
    totalUsage: { inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0,
                  byAgent: { '': { inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0 } } },
    isLive: false, ...over,
  }
}

// globals:false in vitest config — auto-cleanup doesn't register; must call manually
afterEach(() => cleanup())

beforeEach(() => {
  useUIStore.setState({
    activeSessionId: null,
    sortOrder: 'desc',
    expandedProjectSections: new Set(),
    pinnedSessions: new Set(),
  })
  vi.restoreAllMocks()
})

describe('SessionBrowser', () => {
  it('shows skeleton while loading', () => {
    vi.spyOn(api, 'fetchSessions').mockImplementation(() => new Promise(() => {}))
    withQuery(<SessionBrowser />)
    expect(screen.getByRole('status', { name: /loading sessions/i })).toBeInTheDocument()
  })

  it('shows empty-state copy when no sessions', async () => {
    vi.spyOn(api, 'fetchSessions').mockResolvedValue({ sessions: [] })
    withQuery(<SessionBrowser />)
    await waitFor(() => expect(screen.getByText(/No sessions found/)).toBeInTheDocument())
    expect(screen.getByText(/~\/\.claude\/projects/)).toBeInTheDocument()
  })

  it('shows error + Try again on failure', async () => {
    vi.spyOn(api, 'fetchSessions').mockRejectedValue(new Error('boom'))
    withQuery(<SessionBrowser />)
    await waitFor(() => expect(screen.getByText(/Could not load sessions/)).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /Try again/i })).toBeInTheDocument()
  })

  it('groups sessions by projectSlug', async () => {
    vi.spyOn(api, 'fetchSessions').mockResolvedValue({
      sessions: [
        meta({ sessionId: 's-1', projectSlug: '-a', projectPath: '/a', title: 'A1' }),
        meta({ sessionId: 's-2', projectSlug: '-b', projectPath: '/b', title: 'B1' }),
        meta({ sessionId: 's-3', projectSlug: '-a', projectPath: '/a', title: 'A2' }),
      ],
    })
    withQuery(<SessionBrowser />)
    await waitFor(() => expect(screen.getByText('A1')).toBeInTheDocument())
    // /a project section header rendered
    expect(screen.getByText('/a')).toBeInTheDocument()
    expect(screen.getByText('/b')).toBeInTheDocument()
  })

  it('clicking the sort toggle flips the order label', async () => {
    vi.spyOn(api, 'fetchSessions').mockResolvedValue({ sessions: [meta()] })
    withQuery(<SessionBrowser />)
    // React StrictMode may render twice; use getAllByText and click the first
    await waitFor(() => expect(screen.getAllByText('Newest first').length).toBeGreaterThan(0))
    fireEvent.click(screen.getAllByText('Newest first')[0])
    expect(screen.getAllByText('Oldest first').length).toBeGreaterThan(0)
  })

  it('pins float to the top of their project group', async () => {
    // 'newer' is most-recent (would normally appear first under desc).
    // Pin 'older' and expect it to jump above 'newer' inside the same group.
    useUIStore.setState({ pinnedSessions: new Set(['older']) })
    vi.spyOn(api, 'fetchSessions').mockResolvedValue({
      sessions: [
        meta({ sessionId: 'newer', projectSlug: '-a', projectPath: '/a', title: 'Newer',
               lastTimestamp: '2026-05-02T00:00:00Z' }),
        meta({ sessionId: 'older', projectSlug: '-a', projectPath: '/a', title: 'Older',
               lastTimestamp: '2026-05-01T00:00:00Z' }),
      ],
    })
    withQuery(<SessionBrowser />)
    await waitFor(() => expect(screen.getByText('Newer')).toBeInTheDocument())
    const titles = screen.getAllByText(/Newer|Older/).map((el) => el.textContent)
    expect(titles[0]).toBe('Older')
    expect(titles[1]).toBe('Newer')
  })

  it('clicking a session row sets activeSessionId in useUIStore', async () => {
    vi.spyOn(api, 'fetchSessions').mockResolvedValue({ sessions: [meta({ sessionId: 'open-me' })] })
    withQuery(<SessionBrowser />)
    // Wait for session to render; StrictMode may double-render — use getAllByRole and [0]
    await waitFor(() => {
      const rows = screen.getAllByRole('button', { name: /Open session: A$/i })
      expect(rows.length).toBeGreaterThan(0)
    })
    fireEvent.click(screen.getAllByRole('button', { name: /Open session: A$/i })[0])
    expect(useUIStore.getState().activeSessionId).toBe('open-me')
  })
})
