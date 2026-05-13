import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { SessionRow } from './SessionRow'
import { useUIStore } from '@/stores/useUIStore'
import type { SessionMeta } from '@cc-viewer/shared'

function meta(over: Partial<SessionMeta> = {}): SessionMeta {
  return {
    sessionId: 's-1',
    projectSlug: '-Users-me-proj',
    projectPath: '/Users/me/proj',
    title: 'Test Session',
    firstTimestamp: '2026-04-26T11:00:00Z',
    lastTimestamp: '2026-04-26T12:00:00Z',
    messageCount: 42,
    hasSubagents: false,
    totalUsage: {
      inputTokens: 1000, outputTokens: 500,
      cacheCreationTokens: 200, cacheReadTokens: 800,
      byAgent: { '': { inputTokens: 1000, outputTokens: 500, cacheCreationTokens: 200, cacheReadTokens: 800 } },
    },
    isLive: false,
    ...over,
  }
}

afterEach(() => cleanup())
beforeEach(() => {
  useUIStore.setState({ pinnedSessions: new Set() })
})

describe('SessionRow', () => {
  it('renders title and message count', () => {
    render(<SessionRow session={meta()} active={false} onSelect={() => {}} />)
    expect(screen.getByText('Test Session')).toBeInTheDocument()
    expect(screen.getByText(/42 msg/)).toBeInTheDocument()
  })

  it('does NOT render the live dot when isLive is false (no DOM element)', () => {
    const { container } = render(<SessionRow session={meta({ isLive: false })} active={false} onSelect={() => {}} />)
    expect(container.querySelector('.animate-pulse')).toBeNull()
  })

  it('renders the live dot when isLive is true', () => {
    const { container } = render(<SessionRow session={meta({ isLive: true })} active={false} onSelect={() => {}} />)
    expect(container.querySelector('.animate-pulse')).not.toBeNull()
  })

  it('applies accent-soft fill when active=true and no left-border indent', () => {
    const { container } = render(<SessionRow session={meta()} active={true} onSelect={() => {}} />)
    const row = container.firstElementChild as HTMLElement
    expect(row.className).toMatch(/bg-accent/)
    // No left-border indent — the active state is a flat soft fill (matches v2 design).
    expect(row.className).not.toMatch(/border-l-2/)
    expect(row.className).not.toMatch(/border-primary/)
  })

  it('row uses indented compact padding (not the old 52px card padding)', () => {
    const { container } = render(<SessionRow session={meta()} active={false} onSelect={() => {}} />)
    const row = container.firstElementChild as HTMLElement
    // pl-7 (≈28px) indents the row under the project header
    expect(row.className).toMatch(/pl-7/)
    // Should NOT carry the old fixed 52px height
    expect(row.className).not.toMatch(/h-\[52px\]/)
  })

  it('pinned row shows an inline star prefix on the title line', () => {
    useUIStore.setState({ pinnedSessions: new Set(['pin-row']) })
    const { container } = render(
      <SessionRow session={meta({ sessionId: 'pin-row' })} active={false} onSelect={() => {}} />,
    )
    // The pinned prefix is the Star svg with fill="currentColor" (not the hover-only button)
    const svgs = container.querySelectorAll('svg')
    const hasFilled = Array.from(svgs).some((s) => s.getAttribute('fill') === 'currentColor')
    expect(hasFilled).toBe(true)
  })

  it('calls onSelect with sessionId on click', () => {
    const onSelect = vi.fn()
    const { container } = render(<SessionRow session={meta({ sessionId: 'abc' })} active={false} onSelect={onSelect} />)
    // Use container.querySelector to avoid strict-mode ambiguity with screen queries
    fireEvent.click(container.querySelector('[role="button"]')!)
    expect(onSelect).toHaveBeenCalledWith('abc')
  })

  it('compact-formats the total token count', () => {
    // 1000 + 500 + 200 + 800 = 2500 → "2.5K"
    const { container } = render(<SessionRow session={meta()} active={false} onSelect={() => {}} />)
    // querySelector finds the token span directly
    const tokenSpan = container.querySelector('.font-mono')
    expect(tokenSpan?.textContent).toMatch(/2\.5K/i)
  })

  it('keyboard Enter triggers onSelect', () => {
    const onSelect = vi.fn()
    const { container } = render(<SessionRow session={meta()} active={false} onSelect={onSelect} />)
    fireEvent.keyDown(container.querySelector('[role="button"]')!, { key: 'Enter' })
    expect(onSelect).toHaveBeenCalled()
  })

  it('sidebar row exposes no interactive star control (toggling lives on TranscriptHeader)', () => {
    // Unpinned row — no star button at all.
    const { container, rerender } = render(
      <SessionRow session={meta({ sessionId: 'pin-me' })} active={false} onSelect={() => {}} />,
    )
    expect(container.querySelector('button[aria-label="Star session"]')).toBeNull()
    expect(container.querySelector('button[aria-label="Unstar session"]')).toBeNull()

    // Pinned row — still no button; only the display-only filled-star icon.
    useUIStore.setState({ pinnedSessions: new Set(['pin-me']) })
    rerender(<SessionRow session={meta({ sessionId: 'pin-me' })} active={false} onSelect={() => {}} />)
    expect(container.querySelector('button[aria-label="Star session"]')).toBeNull()
    expect(container.querySelector('button[aria-label="Unstar session"]')).toBeNull()
  })
})
