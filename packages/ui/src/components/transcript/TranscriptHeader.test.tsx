import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { TooltipProvider } from '@/components/ui/tooltip'
import type { SessionMeta } from '@cc-viewer/shared'
import { TranscriptHeader } from './TranscriptHeader'
import { useUIStore } from '@/stores/useUIStore'

beforeEach(() => {
  useUIStore.setState({ pinnedSessions: new Set(), rightRailOpen: true })
})

afterEach(() => {
  cleanup()
})

function makeMeta(over: Partial<SessionMeta> = {}): SessionMeta {
  return {
    sessionId: 'sess-abc-123',
    projectSlug: 'my-project',
    projectPath: '/home/user/my-project',
    title: 'Refactor auth',
    firstTimestamp: '2026-04-01T00:00:00Z',
    lastTimestamp: '2026-04-27T10:30:00.000Z',
    messageCount: 42,
    hasSubagents: false,
    totalUsage: {
      inputTokens: 12438,
      outputTokens: 3142,
      cacheCreationTokens: 8200,
      cacheReadTokens: 22000,
      byAgent: {},
    },
    parseWarnings: 0,
    claudeCodeVersion: '1.2.3',
    gitBranch: 'main',
    ...over,
  }
}

function renderHeader(meta: SessionMeta | undefined, topModel?: string) {
  return render(
    <TooltipProvider>
      <TranscriptHeader meta={meta} topModel={topModel} />
    </TooltipProvider>
  )
}

describe('TranscriptHeader', () => {
  it('Test 1: renders the session title', () => {
    renderHeader(makeMeta({ title: 'Refactor auth' }))
    expect(screen.getByText('Refactor auth')).toBeInTheDocument()
  })

  it('Test 2: renders 3 metric chips — Messages, Tokens, Model', () => {
    renderHeader(makeMeta(), 'claude-opus-4-7')
    // Messages chip → exact int (42)
    expect(screen.getByText('Messages')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
    // Tokens chip → sum of all four categories, abbreviated.
    // 12438 + 3142 + 8200 + 22000 = 45780 → "45.8k"
    expect(screen.getByText('Tokens')).toBeInTheDocument()
    expect(screen.getByText('45.8k')).toBeInTheDocument()
    // Model chip → topModel prop value
    expect(screen.getByText('Model')).toBeInTheDocument()
    expect(screen.getByText('claude-opus-4-7')).toBeInTheDocument()
  })

  it('Test 3: Model chip shows em-dash when topModel is undefined', () => {
    renderHeader(makeMeta())
    expect(screen.getByText('Model')).toBeInTheDocument()
    // em-dash fallback
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })

  it('Test 4: parseWarnings badge hidden when zero', () => {
    renderHeader(makeMeta({ parseWarnings: 0 }))
    expect(screen.queryByText(/parse warnings/i)).not.toBeInTheDocument()
  })

  it('Test 4b: parseWarnings badge hidden when undefined', () => {
    const meta = makeMeta()
    delete meta.parseWarnings
    renderHeader(meta)
    expect(screen.queryByText(/parse warnings/i)).not.toBeInTheDocument()
  })

  it('Test 5: parseWarnings badge shown when > 0', () => {
    renderHeader(makeMeta({ parseWarnings: 3 }))
    expect(screen.getByText(/3 parse warnings/)).toBeInTheDocument()
  })

  it('Test 6: info popover opens and shows session metadata', () => {
    renderHeader(makeMeta({
      sessionId: 'sess-abc-123',
      projectPath: '/home/user/my-project',
      lastTimestamp: '2026-04-27T10:30:00.000Z',
      claudeCodeVersion: '1.2.3',
      gitBranch: 'main',
    }))
    const infoBtn = screen.getByRole('button', { name: /session info/i })
    fireEvent.click(infoBtn)
    // sessionId is now rendered in BOTH the breadcrumb and the popover.
    expect(screen.getAllByText('sess-abc-123').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('/home/user/my-project')).toBeInTheDocument()
    expect(screen.getByText('2026-04-27T10:30:00.000Z')).toBeInTheDocument()
    expect(screen.getByText('1.2.3')).toBeInTheDocument()
    expect(screen.getByText('main')).toBeInTheDocument()
  })

  it('Test 7: info popover shows em-dash fallbacks for missing optional fields', () => {
    renderHeader(makeMeta({ claudeCodeVersion: undefined, gitBranch: undefined }))
    const infoBtn = screen.getByRole('button', { name: /session info/i })
    fireEvent.click(infoBtn)
    // Both optional fields absent → show em-dash
    const emDashes = screen.getAllByText('—')
    expect(emDashes.length).toBeGreaterThanOrEqual(2)
  })

  it('Test 8: renders skeleton banner without crashing when meta is undefined', () => {
    renderHeader(undefined)
    const banner = screen.getByRole('banner', { name: /transcript header/i })
    expect(banner).toBeInTheDocument()
    // No metric chips when meta is undefined
    expect(screen.queryByText(/Tokens/)).not.toBeInTheDocument()
  })

  it('Test 9: star button toggles pinnedSessions in the store', () => {
    renderHeader(makeMeta({ sessionId: 's-pin' }))
    expect(useUIStore.getState().pinnedSessions.has('s-pin')).toBe(false)
    const star = screen.getByRole('button', { name: /star session/i })
    fireEvent.click(star)
    expect(useUIStore.getState().pinnedSessions.has('s-pin')).toBe(true)
    // After pinning the aria-label flips to "Unstar session" — find by that.
    const unstar = screen.getByRole('button', { name: /unstar session/i })
    fireEvent.click(unstar)
    expect(useUIStore.getState().pinnedSessions.has('s-pin')).toBe(false)
  })

  it('Test 10: right-rail toggle flips useUIStore.rightRailOpen', () => {
    renderHeader(makeMeta())
    expect(useUIStore.getState().rightRailOpen).toBe(true)
    const toggle = screen.getByRole('button', { name: /toggle inspector rail/i })
    fireEvent.click(toggle)
    expect(useUIStore.getState().rightRailOpen).toBe(false)
    fireEvent.click(toggle)
    expect(useUIStore.getState().rightRailOpen).toBe(true)
  })

  it('Test 11: renders the breadcrumb (projectSlug · sessionId)', () => {
    renderHeader(makeMeta({ projectSlug: 'foo-proj', sessionId: 'sess-xyz' }))
    expect(screen.getByText('foo-proj')).toBeInTheDocument()
    // sessionId text is in the breadcrumb; popover not yet opened.
    expect(screen.getByText('sess-xyz')).toBeInTheDocument()
  })

  it('Test 12 (FR-016): Report button dispatches setSessionReportOpen(true)', () => {
    renderHeader(makeMeta())
    expect(useUIStore.getState().sessionReportOpen).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: /session token report/i }))
    expect(useUIStore.getState().sessionReportOpen).toBe(true)
  })

  it('Test 13 (FR-016): no SessionReportDrawer is mounted from the header', () => {
    renderHeader(makeMeta())
    // The drawer must not be mounted by the header — only the trigger button.
    // The drawer renders a DialogContent with role="dialog" once mounted.
    // When the store flag is false, no dialog should be present.
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
