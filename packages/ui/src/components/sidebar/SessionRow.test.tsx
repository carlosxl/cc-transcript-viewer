import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SessionRow } from './SessionRow'
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
})
