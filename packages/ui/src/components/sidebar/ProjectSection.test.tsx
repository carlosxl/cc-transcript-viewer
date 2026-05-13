import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import type { SessionMeta } from '@cc-viewer/shared'
import { ProjectSection } from './ProjectSection'
import { useUIStore } from '@/stores/useUIStore'

afterEach(() => cleanup())
beforeEach(() => {
  useUIStore.setState({
    expandedProjectSections: new Set(),
    pinnedSessions: new Set(),
  })
})

function meta(over: Partial<SessionMeta> = {}): SessionMeta {
  return {
    sessionId: 's-1',
    projectSlug: '-Users-me-proj',
    projectPath: '/Users/me/proj',
    title: 'Test Session',
    firstTimestamp: '2026-04-26T11:00:00Z',
    lastTimestamp: '2026-04-26T12:00:00Z',
    messageCount: 1,
    hasSubagents: false,
    totalUsage: {
      inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0,
      byAgent: { '': { inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0 } },
    },
    isLive: false,
    ...over,
  }
}

describe('ProjectSection — v2 small-caps header (FR-028)', () => {
  it('renders as a button with chevron, folder icon, project name, and session count', () => {
    render(
      <ProjectSection
        projectSlug="-Users-me-proj"
        projectPath="/Users/me/proj"
        sessions={[meta(), meta({ sessionId: 's-2' }), meta({ sessionId: 's-3' })]}
        activeSessionId={null}
        onSelect={() => {}}
      />,
    )
    const headerBtn = screen.getByRole('button', { expanded: true })
    expect(headerBtn).toBeInTheDocument()
    // small-caps treatment classes
    expect(headerBtn.className).toMatch(/uppercase/)
    expect(headerBtn.className).toMatch(/tracking-wide/)
    expect(headerBtn.className).toMatch(/font-semibold/)
    // session count on the right
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('truncates the project name with ellipsis on a single line', () => {
    render(
      <ProjectSection
        projectSlug="-very-long-project-slug"
        projectPath="/Users/me/a-very-very-very-long-project-path-that-should-truncate"
        sessions={[meta()]}
        activeSessionId={null}
        onSelect={() => {}}
      />,
    )
    const nameSpan = screen.getByText(/a-very-very-very-long-project-path/i)
    expect(nameSpan.className).toMatch(/truncate/)
  })
})
