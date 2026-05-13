import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ToolCapsule } from './ToolCapsule'
import { useUIStore } from '@/stores/useUIStore'
import { useNavigationStore } from '@/stores/useNavigationStore'
import type { ToolInteraction, Turn } from '@cc-viewer/shared'

const SESSION_ID = 'sess-1'

function makeTurn(over: Partial<Turn> = {}): Turn {
  return {
    uuid: 't-1',
    parentUuid: null,
    timestamp: '2026-05-09T00:00:00Z',
    role: 'assistant',
    textBlocks: [],
    thinkingBlocks: [],
    toolUses: [{ id: 'tu-1', name: 'Bash', input: { command: 'ls -la /tmp' } }],
    toolResults: [],
    isMeta: false,
    agentId: null,
    ...over,
  }
}

function makeInteraction(over: Partial<ToolInteraction> = {}): ToolInteraction {
  return {
    id: 't-1:tu-1',
    turnUuid: 't-1',
    toolUseId: 'tu-1',
    tool: 'Bash',
    resultTurnUuid: 't-2',
    status: 'success',
    startedAt: '2026-05-09T00:00:00Z',
    durationMs: 1234,
    diff: null,
    preview: null,
    ...over,
  }
}

function setQueryCache(qc: QueryClient, interactions: ToolInteraction[]): void {
  qc.setQueryData(['session', SESSION_ID], {
    turns: [],
    subagents: [],
    usage: { inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0, byAgent: {} },
    parseWarnings: 0,
    toolInteractions: interactions,
    tokenSeries: { points: [], byModel: [], spikes: [], cacheHitPct: 0, avgPerTurn: 0 },
    fileTouchIndex: { files: [] },
  })
}

function renderCapsule(turn: Turn, interactions: ToolInteraction[]) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  setQueryCache(qc, interactions)
  return render(
    <QueryClientProvider client={qc}>
      <TooltipProvider>
        <ToolCapsule turn={turn} toolUseId={turn.toolUses[0]!.id} />
      </TooltipProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  useUIStore.setState({ activeSessionId: SESSION_ID })
  useNavigationStore.setState({
    drillStack: [],
    focusedMsgIndex: 0,
    selectedInteractionId: null,
  })
})

afterEach(() => cleanup())

describe('ToolCapsule', () => {
  it('renders tool name and bash command summary', () => {
    renderCapsule(makeTurn(), [makeInteraction()])
    expect(screen.getByText('Bash')).toBeInTheDocument()
    expect(screen.getByText('ls -la /tmp')).toBeInTheDocument()
  })

  it('renders duration when ToolInteraction.durationMs is set', () => {
    renderCapsule(makeTurn(), [makeInteraction({ durationMs: 1234 })])
    expect(screen.getByText('1.2s')).toBeInTheDocument()
  })

  it('omits duration when ToolInteraction missing (live tail)', () => {
    renderCapsule(makeTurn(), [])
    expect(screen.queryByText(/ms$|s$/)).toBeNull()
  })

  it('clicking the capsule sets selectedInteractionId in the navigation store', () => {
    renderCapsule(makeTurn(), [makeInteraction()])
    expect(useNavigationStore.getState().selectedInteractionId).toBeNull()
    const btn = screen.getByRole('button', { pressed: false })
    fireEvent.click(btn)
    expect(useNavigationStore.getState().selectedInteractionId).toBe('t-1:tu-1')
  })

  it('click is a no-op when no ToolInteraction is loaded yet', () => {
    renderCapsule(makeTurn(), [])
    const btn = screen.getAllByRole('button')[0]!
    fireEvent.click(btn)
    expect(useNavigationStore.getState().selectedInteractionId).toBeNull()
  })

  it('preserves the "Open subagent" affordance for Task tools with a child agent id', () => {
    const turn = makeTurn({
      toolUses: [{ id: 'tu-1', name: 'Task', input: { description: 'analyse' }, childAgentId: 'agent-xyz' }],
    })
    renderCapsule(turn, [makeInteraction({ tool: 'Task' })])
    expect(
      screen.getByRole('button', { name: /Open subagent agent-xyz/i }),
    ).toBeInTheDocument()
  })

  it('clicking "Open subagent" does NOT also select the capsule', () => {
    const turn = makeTurn({
      toolUses: [{ id: 'tu-1', name: 'Task', input: {}, childAgentId: 'agent-xyz' }],
    })
    renderCapsule(turn, [makeInteraction({ tool: 'Task' })])
    fireEvent.click(screen.getByRole('button', { name: /Open subagent agent-xyz/i }))
    expect(useNavigationStore.getState().selectedInteractionId).toBeNull()
    expect(useNavigationStore.getState().drillStack).toEqual([
      { sessionId: SESSION_ID, agentId: 'agent-xyz' },
    ])
  })

  it('renders "subagent not linked" when Task has no childAgentId', () => {
    const turn = makeTurn({
      toolUses: [{ id: 'tu-1', name: 'Task', input: {} }],
    })
    renderCapsule(turn, [makeInteraction({ tool: 'Task' })])
    expect(screen.getByText(/subagent not linked/i)).toBeInTheDocument()
  })

  it('applies primary border + ring when this interaction is selected', () => {
    useNavigationStore.setState({ selectedInteractionId: 't-1:tu-1' })
    const { container } = renderCapsule(makeTurn(), [makeInteraction()])
    const btn = container.querySelector('[data-interaction-id="t-1:tu-1"]')!
    expect(btn.className).toMatch(/border-primary/)
  })

  it('labels the status dot for screen readers', () => {
    renderCapsule(makeTurn(), [makeInteraction({ status: 'fail' })])
    expect(screen.getByRole('status', { name: 'Failed' })).toBeInTheDocument()
  })
})
