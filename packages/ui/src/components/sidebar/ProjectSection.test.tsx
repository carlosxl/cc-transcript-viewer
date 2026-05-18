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

describe('ProjectSection — path-readability header', () => {
  it('renders as a button with chevron, folder icon, project path, and session count', () => {
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
    // Paths are file-system text — render in monospace, NOT uppercase.
    expect(headerBtn.className).toMatch(/font-mono/)
    expect(headerBtn.className).not.toMatch(/uppercase/)
    // Full path stays accessible via the tooltip even when truncated.
    expect(headerBtn).toHaveAttribute('title', '/Users/me/proj')
    // session count on the right
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('collapses $HOME to ~ in the visible label but keeps the full path in the tooltip', () => {
    render(
      <ProjectSection
        projectSlug="-Users-me-proj"
        projectPath="/Users/me/workspace/some-project"
        sessions={[meta()]}
        activeSessionId={null}
        onSelect={() => {}}
      />,
    )
    expect(screen.getByText('~/workspace/some-project')).toBeInTheDocument()
    expect(screen.getByRole('button', { expanded: true })).toHaveAttribute(
      'title',
      '/Users/me/workspace/some-project',
    )
  })

  it('left-truncates long paths so the trailing (distinctive) segments stay visible', () => {
    render(
      <ProjectSection
        projectSlug="-very-long-project-slug"
        projectPath="/Users/me/workspace/pltf-nf-agent-workspace/.claude/worktrees/cuddly-conjuring-storm"
        sessions={[meta()]}
        activeSessionId={null}
        onSelect={() => {}}
      />,
    )
    const nameSpan = screen.getByText(/cuddly-conjuring-storm/i)
    expect(nameSpan.className).toMatch(/truncate-left/)
  })
})
