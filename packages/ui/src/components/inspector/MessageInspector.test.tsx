import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import type { Turn, ToolInteraction } from '@cc-viewer/shared'

const useFocusedTurnMock = vi.fn()
vi.mock('@/hooks/useFocusedTurn', () => ({
  useFocusedTurn: () => useFocusedTurnMock(),
}))

const useActiveQueryMock = vi.fn()
vi.mock('@/hooks/useActiveQuery', () => ({
  useActiveQuery: () => useActiveQueryMock(),
}))

import { MessageInspector } from './MessageInspector'
import { useNavigationStore } from '@/stores/useNavigationStore'
import { useSearchStore } from '@/stores/useSearchStore'

function makeAssistant(overrides: Partial<Turn> = {}): Turn {
  return {
    uuid: 'asst-1234-uuid',
    parentUuid: null,
    timestamp: '2026-05-13T10:30:00.000Z',
    role: 'assistant',
    textBlocks: ['Here is a plan.'],
    thinkingBlocks: [],
    toolUses: [
      { id: 'tu-1', name: 'Bash', input: { command: 'ls -la', description: 'list' } },
      { id: 'tu-2', name: 'Read', input: { file_path: '/src/foo.ts' } },
    ],
    toolResults: [],
    usage: {
      input_tokens: 1842,
      output_tokens: 286,
      cache_creation_input_tokens: 412,
      cache_read_input_tokens: 1612,
    },
    model: 'claude-opus-4-7',
    isMeta: false,
    agentId: null,
    ...overrides,
  }
}

function makeUser(text: string, overrides: Partial<Turn> = {}): Turn {
  return {
    uuid: 'user-abcd-uuid',
    parentUuid: null,
    timestamp: '2026-05-13T10:29:00.000Z',
    role: 'user',
    textBlocks: [text],
    thinkingBlocks: [],
    toolUses: [],
    toolResults: [],
    isMeta: false,
    agentId: null,
    ...overrides,
  }
}

beforeEach(() => {
  useFocusedTurnMock.mockReset()
  useActiveQueryMock.mockReset()
  useActiveQueryMock.mockReturnValue({
    turns: [],
    interactions: [],
    tokenSeries: undefined,
    fileTouchIndex: undefined,
    sessionId: 'session-x',
    agentId: null,
  })
  useNavigationStore.setState({ selectedInteractionId: null, focusedMsgIndex: 0, drillStack: [] })
  useSearchStore.setState({ pendingJumpTarget: null })
})

afterEach(cleanup)

describe('MessageInspector — empty', () => {
  it('renders InspectorEmpty when nothing is focused', () => {
    useFocusedTurnMock.mockReturnValue(null)
    render(<MessageInspector />)
    expect(screen.getByRole('status', { name: 'Tool inspector — no selection' })).toBeInTheDocument()
  })
})

describe('AssistantMessageInspector', () => {
  it('renders headline metrics, breakdown bar, and parts list', () => {
    const turn = makeAssistant()
    const interactions: ToolInteraction[] = [
      {
        id: `${turn.uuid}:tu-1`, turnUuid: turn.uuid, toolUseId: 'tu-1', tool: 'Bash',
        resultTurnUuid: null, status: 'success', startedAt: turn.timestamp,
        durationMs: 412, diff: null, preview: null,
      },
      {
        id: `${turn.uuid}:tu-2`, turnUuid: turn.uuid, toolUseId: 'tu-2', tool: 'Read',
        resultTurnUuid: null, status: 'success', startedAt: turn.timestamp,
        durationMs: 38, diff: null, preview: null,
      },
    ]
    useActiveQueryMock.mockReturnValue({
      turns: [turn], interactions, tokenSeries: undefined, fileTouchIndex: undefined,
      sessionId: 'session-x', agentId: null,
    })
    useFocusedTurnMock.mockReturnValue({ turn, nextAssistantTurn: null })

    render(<MessageInspector />)
    expect(screen.getByTestId('message-inspector-assistant')).toBeInTheDocument()
    expect(screen.getByText('Assistant turn')).toBeInTheDocument()
    expect(screen.getByText('New tokens')).toBeInTheDocument()
    expect(screen.getByText('Weighted units')).toBeInTheDocument()
    expect(screen.getByText('Breakdown')).toBeInTheDocument()
    expect(screen.getByText('Cache efficiency')).toBeInTheDocument()
    expect(screen.getByText('Context window')).toBeInTheDocument()
    // Parts list shows the two tool names and at least the text part.
    expect(screen.getByText('Bash')).toBeInTheDocument()
    expect(screen.getByText('Read')).toBeInTheDocument()
    expect(screen.getByText('Text')).toBeInTheDocument()
  })

  it('clicking a clickable tool row sets the selected interaction id (drill-in)', () => {
    const turn = makeAssistant()
    const interactions: ToolInteraction[] = [{
      id: `${turn.uuid}:tu-1`, turnUuid: turn.uuid, toolUseId: 'tu-1', tool: 'Bash',
      resultTurnUuid: null, status: 'success', startedAt: turn.timestamp,
      durationMs: 412, diff: null, preview: null,
    }]
    useActiveQueryMock.mockReturnValue({
      turns: [turn], interactions, tokenSeries: undefined, fileTouchIndex: undefined,
      sessionId: 'session-x', agentId: null,
    })
    useFocusedTurnMock.mockReturnValue({ turn, nextAssistantTurn: null })

    render(<MessageInspector />)
    const bashRow = screen.getByText('Bash').closest('button')!
    fireEvent.click(bashRow)
    expect(useNavigationStore.getState().selectedInteractionId).toBe(`${turn.uuid}:tu-1`)
  })

  it('shows "—" headline and hides breakdown when usage is missing (streaming/empty turn)', () => {
    const turn = makeAssistant({ usage: undefined, toolUses: [] })
    useFocusedTurnMock.mockReturnValue({ turn, nextAssistantTurn: null })
    render(<MessageInspector />)
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
    expect(screen.queryByText('Breakdown')).toBeNull()
    expect(screen.queryByText('Cache efficiency')).toBeNull()
  })
})

describe('UserMessageInspector', () => {
  it('classifies plain text and shows the input contribution + payload preview', () => {
    const turn = makeUser('Help me review the static.ts file.')
    useFocusedTurnMock.mockReturnValue({ turn, nextAssistantTurn: null })
    render(<MessageInspector />)
    expect(screen.getByTestId('message-inspector-user')).toBeInTheDocument()
    expect(screen.getByText('User message')).toBeInTheDocument()
    expect(screen.getByText('Direct prompt')).toBeInTheDocument()
    expect(screen.getByText('Input contribution')).toBeInTheDocument()
    expect(screen.getByText(/Help me review the static\.ts file\./)).toBeInTheDocument()
  })

  it('classifies a /clear slash command and surfaces the context-reset note', () => {
    const turn = makeUser('<command-name>/clear</command-name><command-args></command-args><command-message>clear</command-message>')
    useFocusedTurnMock.mockReturnValue({ turn, nextAssistantTurn: null })
    render(<MessageInspector />)
    expect(screen.getByText('Slash command')).toBeInTheDocument()
    expect(screen.getByText(/Resets context/)).toBeInTheDocument()
  })

  it('classifies stderr injections and labels them as auto-injected', () => {
    const turn = makeUser('<local-command-stderr>fatal: ambiguous argument</local-command-stderr>')
    useFocusedTurnMock.mockReturnValue({ turn, nextAssistantTurn: null })
    render(<MessageInspector />)
    expect(screen.getByText('Tool error')).toBeInTheDocument()
    expect(screen.getByText('Auto-injected by Claude Code')).toBeInTheDocument()
  })

  it('renders a "Feeds into" card when a next assistant turn is available', () => {
    const userTurn = makeUser('Check this.')
    const nextAssistant = makeAssistant({ uuid: 'next-1234-uuid' })
    useFocusedTurnMock.mockReturnValue({ turn: userTurn, nextAssistantTurn: nextAssistant })
    render(<MessageInspector />)
    expect(screen.getByText('Feeds into')).toBeInTheDocument()
    expect(screen.getByText(/Assistant turn next-123/)).toBeInTheDocument()
  })

  it('clicking the Feeds-into card focuses the next assistant turn and dispatches a jump', () => {
    const userTurn = makeUser('Check this.')
    const nextAssistant = makeAssistant({ uuid: 'next-1234-uuid' })
    useActiveQueryMock.mockReturnValue({
      turns: [userTurn, nextAssistant],
      interactions: [],
      tokenSeries: undefined,
      fileTouchIndex: undefined,
      sessionId: 'session-x',
      agentId: null,
    })
    useFocusedTurnMock.mockReturnValue({ turn: userTurn, nextAssistantTurn: nextAssistant })
    render(<MessageInspector />)
    const card = screen.getByText(/Assistant turn next-123/).closest('button')!
    fireEvent.click(card)
    const jump = useSearchStore.getState().pendingJumpTarget
    expect(jump?.turnUuid).toBe(nextAssistant.uuid)
    expect(jump?.sessionId).toBe('session-x')
    expect(useNavigationStore.getState().focusedMsgIndex).toBeGreaterThanOrEqual(0)
  })
})
