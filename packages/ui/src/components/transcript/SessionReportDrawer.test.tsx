import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TooltipProvider } from '@/components/ui/tooltip'
import type {
  SessionReport, TokenSeries, FileTouchIndex, SessionDetailResponse,
} from '@cc-viewer/shared'

const SESSION_ID = 'sess-report-1'

const mockFetchSessionReport = vi.fn<(id: string) => Promise<SessionReport>>()
vi.mock('@/api', async () => {
  const actual = await vi.importActual<typeof import('@/api')>('@/api')
  return { ...actual, fetchSessionReport: (id: string) => mockFetchSessionReport(id) }
})

import { SessionReportDrawer } from './SessionReportDrawer'
import { useUIStore } from '@/stores/useUIStore'

const ANCHOR_CLICK_SPY = vi.fn()
let originalCreateElement: typeof document.createElement
beforeEach(() => {
  mockFetchSessionReport.mockReset()
  ANCHOR_CLICK_SPY.mockReset()
  // URL.createObjectURL is not implemented in jsdom — stub it.
  if (!('createObjectURL' in URL)) {
    (URL as unknown as { createObjectURL: (b: Blob) => string }).createObjectURL = () => 'blob:mock'
  } else {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock')
  }
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
  // Capture <a>.click() so we can assert filename without a real download.
  originalCreateElement = document.createElement.bind(document)
  vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
    const el = originalCreateElement(tag) as HTMLElement
    if (tag === 'a') {
      (el as HTMLAnchorElement).click = ANCHOR_CLICK_SPY
    }
    return el
  }) as typeof document.createElement)

  useUIStore.setState({
    sessionReportOpen: true,
    activeSessionId: SESSION_ID,
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  useUIStore.setState({ sessionReportOpen: false, activeSessionId: null })
})

function makeReport(over: Partial<SessionReport> = {}): SessionReport {
  return {
    sessionId: SESSION_ID,
    durationMs: 5 * 60 * 1000,
    toolCalls: { main: 4, sub: 2, total: 6 },
    cacheHitRate: 0.42,
    totalUnits: 1234,
    weightsMissing: false,
    missingModels: [],
    rows: [
      {
        agentGroup: 'main',
        invocationCount: 1,
        model: 'claude-opus-4-7',
        tokens: { input: 1000, cacheCreate5m: 200, cacheCreate1h: 0, cacheRead: 500, output: 300 },
        cacheHitRate: 0.42,
        units: 1234,
        unitsByCategory: { input: 1000, cacheCreate5m: 250, cacheCreate1h: 0, cacheRead: 50, output: 1500 },
        weights: { input: 1, output: 5 },
      },
    ],
    unitsByUsageType: { input: 1000, cacheCreate5m: 250, cacheCreate1h: 0, cacheRead: 50, output: 1500 },
    ...over,
  }
}

function emptyReport(): SessionReport {
  return {
    sessionId: SESSION_ID,
    durationMs: 0,
    toolCalls: { main: 0, sub: 0, total: 0 },
    cacheHitRate: null,
    totalUnits: 0,
    weightsMissing: false,
    missingModels: [],
    rows: [],
    unitsByUsageType: { input: 0, cacheCreate5m: 0, cacheCreate1h: 0, cacheRead: 0, output: 0 },
  }
}

function makeSeries(over: Partial<TokenSeries> = {}): TokenSeries {
  return {
    points: [
      { turnUuid: 't1', turnIndex: 0, model: 'claude-opus-4-7', input: 100, output: 50, cacheCreate: 0, cacheRead: 0 },
      { turnUuid: 't2', turnIndex: 1, model: 'claude-opus-4-7', input: 200, output: 80, cacheCreate: 30, cacheRead: 10 },
      { turnUuid: 't3', turnIndex: 2, model: 'claude-opus-4-7', input: 500, output: 200, cacheCreate: 100, cacheRead: 50 },
      { turnUuid: 't4', turnIndex: 3, model: 'claude-opus-4-7', input: 150, output: 60, cacheCreate: 20, cacheRead: 5 },
    ],
    byModel: [{ model: 'claude-opus-4-7', tokens: 1495, pct: 1 }],
    spikes: [],
    cacheHitPct: 0.05,
    avgPerTurn: 373,
    ...over,
  }
}

function makeFileIndex(over: Partial<FileTouchIndex> = {}): FileTouchIndex {
  return {
    files: [
      { path: '/a/b/foo.ts',  reads: [{ turnUuid: 't1', timestamp: '2026-05-13T10:00:00Z' }], writes: [], changed: false, lineCount: 12 },
      { path: '/a/bar.ts',    reads: [{ turnUuid: 't1', timestamp: '2026-05-13T09:00:00Z' }], writes: [{ turnUuid: 't2', timestamp: '2026-05-13T10:30:00Z' }], changed: true, lineCount: 88 },
      { path: '/a/c/baz.tsx', reads: [], writes: [{ turnUuid: 't1', timestamp: '2026-05-13T09:30:00Z' }], changed: true, lineCount: null },
    ],
    ...over,
  }
}

function renderDrawer(opts?: {
  series?: TokenSeries
  files?: FileTouchIndex
}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const detail: SessionDetailResponse = {
    turns: [],
    subagents: [],
    usage: { inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0, byAgent: {} },
    parseWarnings: 0,
    toolInteractions: [],
    tokenSeries: opts?.series ?? makeSeries(),
    fileTouchIndex: opts?.files ?? makeFileIndex(),
  }
  qc.setQueryData(['session', SESSION_ID], detail)
  return render(
    <QueryClientProvider client={qc}>
      <TooltipProvider>
        <SessionReportDrawer />
      </TooltipProvider>
    </QueryClientProvider>,
  )
}

describe('SessionReportDrawer — header & stat cards (C2)', () => {
  it('renders the four stat cards with spec labels and sublabels', async () => {
    mockFetchSessionReport.mockResolvedValue(makeReport())
    renderDrawer()
    await waitFor(() => expect(screen.getByText('Duration')).toBeInTheDocument())
    expect(screen.getByText('first → last turn')).toBeInTheDocument()
    expect(screen.getByText('Tool calls')).toBeInTheDocument()
    expect(screen.getByText('main 4 · sub 2')).toBeInTheDocument()
    expect(screen.getByText('Cache hit rate')).toBeInTheDocument()
    expect(screen.getByText('read / (read + create + input)')).toBeInTheDocument()
    expect(screen.getByText('Total units')).toBeInTheDocument()
    expect(screen.getByText('weighted, all agents')).toBeInTheDocument()
  })

  it('uses the new max-width container class', async () => {
    mockFetchSessionReport.mockResolvedValue(makeReport())
    const { baseElement } = renderDrawer()
    await waitFor(() => expect(screen.getByText('Duration')).toBeInTheDocument())
    const content = baseElement.querySelector('[data-slot="dialog-content"]')
    expect(content?.className).toMatch(/!max-w-\[960px\]/)
    expect(content?.className).toMatch(/w-\[calc\(100%-2rem\)\]/)
  })
})

describe('SessionReportDrawer — breakdown table (C2)', () => {
  it('renders exactly 9 columns in spec order with exact multiplier strings', async () => {
    mockFetchSessionReport.mockResolvedValue(makeReport())
    renderDrawer()
    await waitFor(() => expect(screen.getByText('Duration')).toBeInTheDocument())
    const headers = screen.getAllByRole('columnheader').map((th) => th.textContent ?? '')
    expect(headers).toHaveLength(9)
    expect(headers[0]).toBe('Agent')
    expect(headers[1]).toBe('Model')
    expect(headers[2]).toMatch(/^Input\s*\(1\.0×\)$/)
    expect(headers[3]).toMatch(/^Cache 5m\s*\(1\.25×\)$/)
    expect(headers[4]).toMatch(/^Cache 1h\s*\(2\.0×\)$/)
    expect(headers[5]).toMatch(/^Cache rd\s*\(0\.1×\)$/)
    expect(headers[6]).toBe('Output')
    expect(headers[7]).toBe('Cache hit')
    expect(headers[8]).toBe('Units')
  })

  it('shows the multiplier caption with the exact text fragment', async () => {
    mockFetchSessionReport.mockResolvedValue(makeReport())
    renderDrawer()
    await waitFor(() =>
      expect(screen.getByText(/input ×1\.0 · cache 5m ×1\.25 · cache 1h ×2\.0 · cache read ×0\.1/))
        .toBeInTheDocument(),
    )
  })
})

describe('SessionReportDrawer — CSV export (C2)', () => {
  it('Export CSV button has the spec aria-label and triggers a download', async () => {
    mockFetchSessionReport.mockResolvedValue(makeReport())
    renderDrawer()
    await waitFor(() => screen.getByText('Duration'))
    const btn = screen.getByRole('button', { name: 'Export session report as CSV' })
    fireEvent.click(btn)
    expect(ANCHOR_CLICK_SPY).toHaveBeenCalled()
  })
})

describe('SessionReportDrawer — close & focus (C2 / FR-021a)', () => {
  it('close button has aria-label="Close" and dismisses on click', async () => {
    mockFetchSessionReport.mockResolvedValue(makeReport())
    renderDrawer()
    await waitFor(() => screen.getByText('Duration'))
    const close = screen.getByRole('button', { name: 'Close' })
    fireEvent.click(close)
    expect(useUIStore.getState().sessionReportOpen).toBe(false)
  })

  it('initial focus lands on the close button', async () => {
    mockFetchSessionReport.mockResolvedValue(makeReport())
    renderDrawer()
    await waitFor(() => screen.getByText('Duration'))
    // Advance the rAF the drawer uses to defer focus.
    await act(async () => { await new Promise((r) => requestAnimationFrame(() => r(null))) })
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close' }))
  })

  it('focus stays inside the dialog when tabbing', async () => {
    mockFetchSessionReport.mockResolvedValue(makeReport())
    renderDrawer()
    await waitFor(() => screen.getByText('Duration'))
    const user = userEvent.setup()
    const dialog = screen.getByRole('dialog')
    for (let i = 0; i < 6; i++) {
      await user.tab()
      expect(dialog.contains(document.activeElement)).toBe(true)
    }
  })
})

describe('SessionReportDrawer — Usage over time (FR-014)', () => {
  it('renders the sparkline with role=img and the spec aria-label', async () => {
    mockFetchSessionReport.mockResolvedValue(makeReport())
    renderDrawer()
    await waitFor(() => screen.getByText('Duration'))
    const svg = screen.getByRole('img', { name: 'Sparkline of units per turn' })
    expect(svg.tagName.toLowerCase()).toBe('svg')
  })

  it('caption shows turn count', async () => {
    mockFetchSessionReport.mockResolvedValue(makeReport())
    renderDrawer({ series: makeSeries({ points: makeSeries().points.slice(0, 3) }) })
    await waitFor(() => expect(screen.getByText('Units per turn · 3 turns')).toBeInTheDocument())
  })

  it('renders min(turns_with_non_zero_usage, 3) spike cards — series.spikes.length=3', async () => {
    const series = makeSeries({
      spikes: [
        { turnUuid: 't1', tokens: 150, reason: 'high-input' },
        { turnUuid: 't2', tokens: 310, reason: 'high-output' },
        { turnUuid: 't3', tokens: 800, reason: 'high-cache-create' },
      ],
    })
    mockFetchSessionReport.mockResolvedValue(makeReport())
    renderDrawer({ series })
    await waitFor(() => screen.getByText('Duration'))
    expect(screen.getByText('High input')).toBeInTheDocument()
    expect(screen.getByText('High output')).toBeInTheDocument()
    expect(screen.getByText('High cache create')).toBeInTheDocument()
  })

  it('falls back to non-zero points when spikes empty (2 non-zero → 2 cards)', async () => {
    const series: TokenSeries = {
      points: [
        { turnUuid: 't1', turnIndex: 0, model: 'm', input: 0, output: 0, cacheCreate: 0, cacheRead: 0 },
        { turnUuid: 't2', turnIndex: 1, model: 'm', input: 50, output: 10, cacheCreate: 0, cacheRead: 0 },
        { turnUuid: 't3', turnIndex: 2, model: 'm', input: 80, output: 20, cacheCreate: 0, cacheRead: 0 },
      ],
      byModel: [], spikes: [], cacheHitPct: 0, avgPerTurn: 0,
    }
    mockFetchSessionReport.mockResolvedValue(makeReport())
    renderDrawer({ series })
    await waitFor(() => screen.getByText('Duration'))
    // The synthesized reason is 'High output' for all fallback cards.
    expect(screen.getAllByText('High output')).toHaveLength(2)
    // m{turnIndex+1} labels — 1-based. m2 only appears on the spike card.
    // m3 also appears in the peak annotation (highest non-zero turn), so use getAllByText.
    expect(screen.getByText('m2')).toBeInTheDocument()
    expect(screen.getAllByText('m3').length).toBeGreaterThanOrEqual(1)
  })

  it('shows the empty caption when no non-zero turns exist', async () => {
    const series: TokenSeries = {
      points: [],
      byModel: [], spikes: [], cacheHitPct: 0, avgPerTurn: 0,
    }
    mockFetchSessionReport.mockResolvedValue(makeReport())
    renderDrawer({ series })
    await waitFor(() => screen.getByText('Duration'))
    expect(screen.getByText('No usage to chart yet.')).toBeInTheDocument()
  })
})

describe('SessionReportDrawer — Files touched (FR-015)', () => {
  it('heading shows total file count', async () => {
    mockFetchSessionReport.mockResolvedValue(makeReport())
    renderDrawer()
    await waitFor(() => screen.getByText('Duration'))
    expect(screen.getByText('Files touched · 3')).toBeInTheDocument()
  })

  it('rows are sorted by reads+writes desc; tiebreak by first-touched asc', async () => {
    // 3 files: A has 3 activity, B has 1 (read at 09:00), C has 1 (write at 09:30)
    const files: FileTouchIndex = {
      files: [
        { path: 'C/c.ts', reads: [], writes: [{ turnUuid: 't', timestamp: '2026-05-13T09:30:00Z' }], changed: true, lineCount: null },
        { path: 'B/b.ts', reads: [{ turnUuid: 't', timestamp: '2026-05-13T09:00:00Z' }], writes: [], changed: false, lineCount: null },
        { path: 'A/a.ts', reads: [
            { turnUuid: 't', timestamp: '2026-05-13T10:00:00Z' },
            { turnUuid: 't', timestamp: '2026-05-13T10:01:00Z' },
          ], writes: [{ turnUuid: 't', timestamp: '2026-05-13T10:02:00Z' }], changed: true, lineCount: null },
      ],
    }
    mockFetchSessionReport.mockResolvedValue(makeReport())
    renderDrawer({ files })
    await waitFor(() => screen.getByText('Duration'))
    const names = ['a.ts', 'b.ts', 'c.ts'].map((n) => screen.getByText(n))
    // A first (3 activity). B and C both have 1 — tiebreak first-touched asc → B (09:00) before C (09:30).
    expect(names[0].compareDocumentPosition(names[1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(names[1].compareDocumentPosition(names[2]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('CHANGED tag only appears for files with changed=true', async () => {
    mockFetchSessionReport.mockResolvedValue(makeReport())
    renderDrawer()
    await waitFor(() => screen.getByText('Duration'))
    // foo.ts is changed=false; bar.ts and baz.tsx are changed=true.
    const tags = screen.getAllByText('CHANGED')
    expect(tags).toHaveLength(2)
  })

  it('row footer renders {reads}r · {writes}w · L {lineCount}', async () => {
    mockFetchSessionReport.mockResolvedValue(makeReport())
    renderDrawer()
    await waitFor(() => screen.getByText('Duration'))
    expect(screen.getByText('1r · 0w · L 12')).toBeInTheDocument()
    expect(screen.getByText('1r · 1w · L 88')).toBeInTheDocument()
    expect(screen.getByText('0r · 1w')).toBeInTheDocument()
  })

  it('shows the empty caption when no files were touched', async () => {
    mockFetchSessionReport.mockResolvedValue(makeReport())
    renderDrawer({ files: { files: [] } })
    await waitFor(() => screen.getByText('Duration'))
    expect(screen.getByText('No files were read or written in this session.')).toBeInTheDocument()
  })
})

describe('SessionReportDrawer — empty state (FR-015a)', () => {
  it('opens, forces — in stat cards, shows the no-usage row, hides CSV', async () => {
    mockFetchSessionReport.mockResolvedValue(emptyReport())
    renderDrawer({ series: { points: [], byModel: [], spikes: [], cacheHitPct: 0, avgPerTurn: 0 }, files: { files: [] } })
    await waitFor(() => screen.getByText('Duration'))
    // All four stat-card values render —.
    const dashes = screen.getAllByText('—')
    expect(dashes.length).toBeGreaterThanOrEqual(4)
    // Single colSpan=9 row in body.
    const norow = screen.getByText('No usage recorded yet')
    expect(norow.closest('td')?.getAttribute('colspan')).toBe('9')
    // CSV button hidden.
    expect(screen.queryByRole('button', { name: 'Export session report as CSV' })).not.toBeInTheDocument()
    // Sections render their empty captions.
    expect(screen.getByText('No usage to chart yet.')).toBeInTheDocument()
    expect(screen.getByText('No files were read or written in this session.')).toBeInTheDocument()
  })
})
