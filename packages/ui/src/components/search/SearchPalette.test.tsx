import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SearchPalette } from './SearchPalette'
import { useSearchStore } from '@/stores/useSearchStore'
import { useUIStore } from '@/stores/useUIStore'
import * as api from '@/api'
import type { SearchHit, SessionMeta } from '@cc-viewer/shared'

function withQuery(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

function meta(over: Partial<SessionMeta> = {}): SessionMeta {
  return {
    sessionId: 's-1', projectSlug: '-a', projectPath: '/a', title: 'Default',
    firstTimestamp: '2026-05-01T00:00:00Z', lastTimestamp: '2026-05-02T00:00:00Z',
    messageCount: 1, hasSubagents: false,
    totalUsage: { inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0,
                  byAgent: { '': { inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0 } } },
    isLive: false, ...over,
  }
}

function hit(over: Partial<SearchHit> = {}): SearchHit {
  return {
    sessionId: 's-1',
    agentId: null,
    turnUuid: 't-1',
    timestamp: '2026-05-01T00:00:00Z',
    role: 'assistant',
    contentKind: 'text',
    snippetHtml: 'hello world',
    sessionTitle: 'Some Session',
    projectSlug: '-a',
    ...over,
  }
}

afterEach(() => cleanup())

beforeEach(() => {
  useSearchStore.setState({ isOpen: true, query: '', pendingJumpTarget: null })
  useUIStore.setState({ activeSessionId: null, pinnedSessions: new Set() })
  vi.restoreAllMocks()
  vi.spyOn(api, 'fetchSearchStatus').mockResolvedValue({
    totalSessions: 0, pendingSessions: 0, isReconciling: false,
  })
})

describe('SearchPalette — Phase 7 redesign', () => {
  it('renders filter chips, footer hints, and empty-state suggestions', () => {
    vi.spyOn(api, 'fetchSessions').mockResolvedValue({ sessions: [meta()] })
    withQuery(<SearchPalette />)
    // chips
    expect(screen.getByRole('tab', { name: /All/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: /Sessions/ })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Tool calls/ })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Files/ })).toBeInTheDocument()
    // footer hints
    expect(screen.getByText(/navigate/)).toBeInTheDocument()
    expect(screen.getByText(/open/)).toBeInTheDocument()
    expect(screen.getByText(/close/)).toBeInTheDocument()
    // suggestion chips visible when query is empty
    expect(screen.getByRole('button', { name: 'security review' })).toBeInTheDocument()
  })

  it('clicking a suggestion chip fills the input', () => {
    vi.spyOn(api, 'fetchSessions').mockResolvedValue({ sessions: [] })
    withQuery(<SearchPalette />)
    fireEvent.click(screen.getByRole('button', { name: 'Bash' }))
    expect(useSearchStore.getState().query).toBe('Bash')
  })

  it('Sessions filter shows session-title matches from session list', async () => {
    vi.spyOn(api, 'fetchSessions').mockResolvedValue({
      sessions: [
        meta({ sessionId: 's-1', title: 'Security review of routes' }),
        meta({ sessionId: 's-2', title: 'Token report' }),
      ],
    })
    // No FTS hits — confirm session-row matches come from session list only.
    vi.spyOn(api, 'searchSessions').mockResolvedValue({ results: [], query: 'security', truncated: false })
    useSearchStore.setState({ query: 'security' })
    withQuery(<SearchPalette />)
    fireEvent.click(screen.getByRole('tab', { name: /Sessions/ }))
    // Highlighted title is split across <mark> nodes — match on body text.
    await waitFor(() => {
      expect(document.body.textContent).toContain('Security review of routes')
    })
    expect(document.body.textContent).not.toContain('Token report')
  })

  it('highlights the query inside session-row titles', async () => {
    vi.spyOn(api, 'fetchSessions').mockResolvedValue({
      sessions: [meta({ sessionId: 's-1', title: 'UI refactoring sweep' })],
    })
    vi.spyOn(api, 'searchSessions').mockResolvedValue({ results: [], query: 'refactoring', truncated: false })
    useSearchStore.setState({ query: 'refactoring' })
    withQuery(<SearchPalette />)
    await waitFor(() => {
      expect(document.body.textContent).toContain('UI refactoring sweep')
    })
    const marks = document.body.querySelectorAll('mark')
    expect(Array.from(marks).some((m) => m.textContent === 'refactoring')).toBe(true)
  })

  it('Tools filter narrows results to tool_use / tool_result hits', async () => {
    vi.spyOn(api, 'fetchSessions').mockResolvedValue({ sessions: [] })
    vi.spyOn(api, 'searchSessions').mockResolvedValue({
      results: [
        hit({ turnUuid: 't-text', contentKind: 'text', snippetHtml: 'a text hit' }),
        hit({ turnUuid: 't-tool', contentKind: 'tool_use', snippetHtml: 'Bash command something' }),
      ],
      query: 'hit', truncated: false,
    })
    useSearchStore.setState({ query: 'hit' })
    withQuery(<SearchPalette />)
    // wait for both initially under All
    await waitFor(() => expect(screen.getByText('a text hit')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('tab', { name: /Tool calls/ }))
    expect(screen.queryByText('a text hit')).not.toBeInTheDocument()
    expect(screen.getByText(/Bash command/)).toBeInTheDocument()
  })

  it('arrow keys move the selected row and Enter triggers navigation', async () => {
    vi.spyOn(api, 'fetchSessions').mockResolvedValue({ sessions: [] })
    vi.spyOn(api, 'searchSessions').mockResolvedValue({
      results: [
        hit({ turnUuid: 't-1', sessionId: 'sx', snippetHtml: 'first' }),
        hit({ turnUuid: 't-2', sessionId: 'sy', snippetHtml: 'second' }),
      ],
      query: 'hit', truncated: false,
    })
    useSearchStore.setState({ query: 'hit' })
    withQuery(<SearchPalette />)
    await waitFor(() => expect(screen.getByText('first')).toBeInTheDocument())
    fireEvent.keyDown(window, { key: 'ArrowDown' })
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(useUIStore.getState().activeSessionId).toBe('sy')
  })
})
