import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import type { ToolInteraction, ToolUse, ToolResult, Turn } from '@cc-viewer/shared'
import type { SelectedInteraction } from '@/hooks/useSelectedInteraction'

const mockSelected = vi.fn<() => SelectedInteraction | null>()

vi.mock('@/hooks/useSelectedInteraction', () => ({
  useSelectedInteraction: () => mockSelected(),
}))

import { Inspector } from './Inspector'
import { useNavigationStore } from '@/stores/useNavigationStore'
import { useSearchStore } from '@/stores/useSearchStore'
import { useUIStore } from '@/stores/useUIStore'

function assistantTurn(uuid: string): Turn {
  return {
    uuid, parentUuid: null, timestamp: '2026-05-12T00:00:00Z',
    role: 'assistant', textBlocks: [], thinkingBlocks: [],
    toolUses: [], toolResults: [], isMeta: false, agentId: null,
  }
}

function makeSelected(over: Partial<SelectedInteraction> = {}): SelectedInteraction {
  const interaction: ToolInteraction = {
    id: 't1:tu1', turnUuid: 't1', toolUseId: 'tu1', tool: 'Bash',
    resultTurnUuid: 't2', status: 'success', startedAt: '2026-05-12T00:00:00Z',
    durationMs: 100, diff: null, preview: null,
  }
  const toolUse: ToolUse = { id: 'tu1', name: 'Bash', input: { command: 'ls' } }
  const toolResult: ToolResult = { tool_use_id: 'tu1', content: 'foo\nbar\n' }
  const turn: Turn = assistantTurn('t1')
  return { interaction, toolUse, toolResult, turn, ...over }
}

beforeEach(() => {
  mockSelected.mockReset()
  useNavigationStore.setState({
    drillStack: [],
    focusedMsgIndex: 0,
    selectedInteractionId: null,
  })
  useUIStore.setState({ activeSessionId: 's1' })
  useSearchStore.setState({ pendingJumpTarget: null, isOpen: false, query: '' })
})

afterEach(cleanup)

describe('Inspector', () => {
  it('renders the empty state when nothing is selected', () => {
    mockSelected.mockReturnValue(null)
    render(<Inspector />)
    expect(screen.getByText('Tool inspector')).toBeInTheDocument()
  })

  it('renders header + tabs when an interaction is selected', () => {
    mockSelected.mockReturnValue(makeSelected())
    render(<Inspector />)
    expect(screen.getByText('Bash')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Call' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Result' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Raw' })).toBeInTheDocument()
  })

  it('defaults to Result tab for non-Read tools without a diff', () => {
    mockSelected.mockReturnValue(makeSelected())
    render(<Inspector />)
    const resultTab = screen.getByRole('tab', { name: 'Result' })
    expect(resultTab.getAttribute('aria-selected')).toBe('true')
    expect(screen.getByText(/stdout/i)).toBeInTheDocument()
  })

  it('defaults to Diff tab when the interaction has a diff', () => {
    mockSelected.mockReturnValue(
      makeSelected({
        interaction: {
          ...makeSelected().interaction,
          tool: 'Edit',
          diff: { filePath: 'a.ts', added: 1, removed: 0 },
        },
        toolUse: { id: 'tu1', name: 'Edit', input: { file_path: 'a.ts', old_string: '', new_string: 'x' } },
      }),
    )
    render(<Inspector />)
    const diffTab = screen.getByRole('tab', { name: 'Diff' })
    expect(diffTab.getAttribute('aria-selected')).toBe('true')
  })

  it('defaults to Preview tab for Read with a result', () => {
    mockSelected.mockReturnValue(
      makeSelected({
        interaction: {
          ...makeSelected().interaction,
          tool: 'Read',
          preview: { filePath: '/a.ts', lineCount: 10 },
        },
        toolUse: { id: 'tu1', name: 'Read', input: { file_path: '/a.ts' } },
      }),
    )
    render(<Inspector />)
    const previewTab = screen.getByRole('tab', { name: 'Preview' })
    expect(previewTab.getAttribute('aria-selected')).toBe('true')
  })

  it('clicking a tab switches the active body', () => {
    mockSelected.mockReturnValue(makeSelected())
    render(<Inspector />)
    fireEvent.click(screen.getByRole('tab', { name: 'Call' }))
    expect(screen.getByText(/arguments/i)).toBeInTheDocument()
  })

  it('close button clears selectedInteractionId', () => {
    useNavigationStore.setState({ selectedInteractionId: 't1:tu1' })
    mockSelected.mockReturnValue(makeSelected())
    render(<Inspector />)
    fireEvent.click(screen.getByLabelText('Close inspector'))
    expect(useNavigationStore.getState().selectedInteractionId).toBeNull()
  })

  it('jump back writes a pendingJumpTarget with interactionId', () => {
    mockSelected.mockReturnValue(makeSelected())
    render(<Inspector />)
    fireEvent.click(screen.getByLabelText('Jump back to message'))
    const target = useSearchStore.getState().pendingJumpTarget
    expect(target).not.toBeNull()
    expect(target?.interactionId).toBe('t1:tu1')
    expect(target?.turnUuid).toBe('t1')
    expect(target?.sessionId).toBe('s1')
  })

  it('copy command writes formatted text via navigator.clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    mockSelected.mockReturnValue(makeSelected())
    render(<Inspector />)
    fireEvent.click(screen.getByLabelText('Copy command to clipboard'))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('ls'))
  })
})
