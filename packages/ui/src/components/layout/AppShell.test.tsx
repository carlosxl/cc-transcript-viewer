/**
 * AppShell tests (Plan 02-04, updated 02-05, updated 02-06)
 *
 * Verifies:
 * 1. AppShell renders without crashing
 * 2. Two-pane layout has two resizable panels
 * 3. Sidebar pane contains <SessionBrowser /> (loading skeleton visible on mount)
 * 4. Main pane renders <TranscriptPane /> (Plan 06 — "Select a session" when no activeSessionId)
 * 5. HeaderSlot placeholder present (Plan 09 will replace with <TranscriptHeader />)
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppShell } from './AppShell'
import { useUIStore } from '@/stores/useUIStore'
import * as api from '@/api'

// Mock react-virtuoso to prevent jsdom infinite loop (same reason as TranscriptPane.test.tsx)
vi.mock('react-virtuoso', () => ({
  Virtuoso: ({ data, itemContent }: { data: unknown[]; itemContent: (index: number, item: unknown) => React.ReactNode }) => (
    <div>{data.map((item, index) => <div key={index}>{itemContent(index, item)}</div>)}</div>
  ),
}))

// globals:false — must call cleanup manually
afterEach(() => {
  cleanup()
  useUIStore.setState({ activeSessionId: null })
  vi.restoreAllMocks()
})

function withQuery(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

describe('AppShell', () => {
  it('renders without crashing', () => {
    vi.spyOn(api, 'fetchSessions').mockImplementation(() => new Promise(() => {}))
    const { container } = withQuery(<AppShell />)
    expect(container.firstChild).toBeTruthy()
  })

  it('renders the sidebar with SessionBrowser (loading skeleton on mount)', () => {
    vi.spyOn(api, 'fetchSessions').mockImplementation(() => new Promise(() => {}))
    withQuery(<AppShell />)
    // SessionBrowser shows loading skeleton while sessions fetch is pending
    expect(screen.getAllByRole('status', { name: /loading sessions/i }).length).toBeGreaterThan(0)
  })

  it('renders TranscriptPane with empty state when no session selected', () => {
    vi.spyOn(api, 'fetchSessions').mockImplementation(() => new Promise(() => {}))
    withQuery(<AppShell />)
    // TranscriptPane shows "Select a session" when activeSessionId is null (Plan 06)
    expect(screen.getAllByText('Select a session').length).toBeGreaterThan(0)
  })

  it('renders the header slot (empty placeholder, Plan 09 will fill)', () => {
    vi.spyOn(api, 'fetchSessions').mockImplementation(() => new Promise(() => {}))
    const { container } = withQuery(<AppShell />)
    // HeaderSlot renders an empty div with specific classes — verify it exists in DOM
    const header = container.querySelector('.h-12.flex-shrink-0')
    expect(header).toBeTruthy()
  })

  it('uses ResizablePanelGroup (two-pane layout present)', () => {
    vi.spyOn(api, 'fetchSessions').mockImplementation(() => new Promise(() => {}))
    const { container } = withQuery(<AppShell />)
    const group = container.querySelector('[data-slot="resizable-panel-group"]')
    expect(group).toBeTruthy()
  })

  it('has two resizable panels', () => {
    vi.spyOn(api, 'fetchSessions').mockImplementation(() => new Promise(() => {}))
    const { container } = withQuery(<AppShell />)
    const panels = container.querySelectorAll('[data-slot="resizable-panel"]')
    expect(panels.length).toBe(2)
  })
})
