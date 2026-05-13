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

  it('applies active classes when active=true', () => {
    const { container } = render(<SessionRow session={meta()} active={true} onSelect={() => {}} />)
    const row = container.firstElementChild as HTMLElement
    expect(row.className).toMatch(/border-primary/)
    expect(row.className).toMatch(/bg-accent/)
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

  it('star button toggles pinnedSessions and does NOT trigger row select', () => {
    const onSelect = vi.fn()
    const { container } = render(
      <SessionRow session={meta({ sessionId: 'pin-me' })} active={false} onSelect={onSelect} />,
    )
    const star = container.querySelector('button[aria-label="Star session"]') as HTMLButtonElement
    expect(star).not.toBeNull()
    fireEvent.click(star)
    expect(useUIStore.getState().pinnedSessions.has('pin-me')).toBe(true)
    expect(onSelect).not.toHaveBeenCalled()
    const unstar = container.querySelector('button[aria-label="Unstar session"]') as HTMLButtonElement
    fireEvent.click(unstar)
    expect(useUIStore.getState().pinnedSessions.has('pin-me')).toBe(false)
  })
})
