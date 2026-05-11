import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ToolCallRow } from './ToolCallRow'
import { useUIStore } from '@/stores/useUIStore'
import { useNavigationStore } from '@/stores/useNavigationStore'
import type { Turn } from '@cc-viewer/shared'

function turnWith(toolName: string, childAgentId?: string): Turn {
  return {
    uuid: 't-1', parentUuid: null, timestamp: '2026-05-09T00:00:00Z',
    role: 'assistant', textBlocks: [], thinkingBlocks: [],
    toolUses: [{ id: 'tu-1', name: toolName, input: { foo: 'bar' }, ...(childAgentId ? { childAgentId } : {}) }],
    toolResults: [], isMeta: false, agentId: null,
  }
}

beforeEach(() => {
  useUIStore.setState({ activeSessionId: 'sess-1' })
  useNavigationStore.setState({ drillStack: [] })
})

afterEach(() => cleanup())

function withTooltip(ui: React.ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>)
}

describe('ToolCallRow drill-in (Phase 3 W1.4)', () => {
  it('renders "Open subagent" button when name=Task and childAgentId is set', () => {
    withTooltip(<ToolCallRow turn={turnWith('Task', 'agent-xyz')} toolUseId="tu-1" />)
    expect(screen.getByRole('button', { name: /Open subagent agent-xyz/i })).toBeInTheDocument()
  })

  it('renders "Open subagent" button when name=Agent and childAgentId is set', () => {
    withTooltip(<ToolCallRow turn={turnWith('Agent', 'agent-xyz')} toolUseId="tu-1" />)
    expect(screen.getByRole('button', { name: /Open subagent agent-xyz/i })).toBeInTheDocument()
  })

  it('clicking the drill-in button pushes a subagent frame onto the navigation stack', () => {
    withTooltip(<ToolCallRow turn={turnWith('Task', 'agent-xyz')} toolUseId="tu-1" />)
    const button = screen.getByRole('button', { name: /Open subagent agent-xyz/i })
    fireEvent.click(button)
    expect(useNavigationStore.getState().drillStack).toEqual([
      { sessionId: 'sess-1', agentId: 'agent-xyz' },
    ])
  })

  it('renders "subagent not linked" hint when name=Task but no childAgentId (AGENT-04 graceful)', () => {
    withTooltip(<ToolCallRow turn={turnWith('Task')} toolUseId="tu-1" />)
    expect(screen.getByText(/subagent not linked/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Open subagent/i })).toBeNull()
  })

  it('does not render any drill-in affordance for non-Agent tool calls', () => {
    withTooltip(<ToolCallRow turn={turnWith('Bash')} toolUseId="tu-1" />)
    expect(screen.queryByRole('button', { name: /Open subagent/i })).toBeNull()
    expect(screen.queryByText(/subagent not linked/i)).toBeNull()
  })
})
