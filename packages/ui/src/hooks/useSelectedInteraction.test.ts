import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, cleanup } from '@testing-library/react'
import type { Turn, ToolInteraction } from '@cc-viewer/shared'

const mockSelectedId = vi.fn<() => string | null>()
const mockActiveQuery = vi.fn<
  () => { turns: Turn[] | undefined; interactions: ToolInteraction[] | undefined }
>()

vi.mock('../stores/useNavigationStore', () => ({
  useNavigationStore: (sel: (s: { selectedInteractionId: string | null }) => unknown) =>
    sel({ selectedInteractionId: mockSelectedId() }),
}))

vi.mock('./useActiveQuery', () => ({
  useActiveQuery: () => mockActiveQuery(),
}))

import { useSelectedInteraction } from './useSelectedInteraction'

function assistantTurn(uuid: string, tuId: string, tool = 'Bash'): Turn {
  return {
    uuid,
    parentUuid: null,
    timestamp: '2026-05-12T00:00:00Z',
    role: 'assistant',
    textBlocks: [],
    thinkingBlocks: [],
    toolUses: [{ id: tuId, name: tool, input: { command: 'echo hi' } }],
    toolResults: [],
    isMeta: false,
    agentId: null,
  }
}

function userToolResult(uuid: string, tuId: string, content: string): Turn {
  return {
    uuid,
    parentUuid: null,
    timestamp: '2026-05-12T00:00:01Z',
    role: 'user',
    textBlocks: [],
    thinkingBlocks: [],
    toolUses: [],
    toolResults: [{ tool_use_id: tuId, content }],
    isMeta: false,
    agentId: null,
  }
}

function interaction(turnUuid: string, tuId: string): ToolInteraction {
  return {
    id: `${turnUuid}:${tuId}`,
    turnUuid,
    toolUseId: tuId,
    tool: 'Bash',
    resultTurnUuid: null,
    status: 'success',
    startedAt: '2026-05-12T00:00:00Z',
    durationMs: 100,
    diff: null,
    preview: null,
  }
}

beforeEach(() => {
  mockSelectedId.mockReset()
  mockActiveQuery.mockReset()
})

afterEach(() => {
  cleanup()
})

describe('useSelectedInteraction', () => {
  it('returns null when nothing is selected', () => {
    mockSelectedId.mockReturnValue(null)
    mockActiveQuery.mockReturnValue({ turns: [], interactions: [] })
    const { result } = renderHook(() => useSelectedInteraction())
    expect(result.current).toBeNull()
  })

  it('returns null when the active query is still loading', () => {
    mockSelectedId.mockReturnValue('t1:tu1')
    mockActiveQuery.mockReturnValue({ turns: undefined, interactions: undefined })
    const { result } = renderHook(() => useSelectedInteraction())
    expect(result.current).toBeNull()
  })

  it('resolves the interaction + toolUse + matching toolResult', () => {
    const turn = assistantTurn('t1', 'tu1')
    const resultTurn = userToolResult('t2', 'tu1', 'ok\n')
    mockSelectedId.mockReturnValue('t1:tu1')
    mockActiveQuery.mockReturnValue({
      turns: [turn, resultTurn],
      interactions: [interaction('t1', 'tu1')],
    })
    const { result } = renderHook(() => useSelectedInteraction())
    expect(result.current).not.toBeNull()
    expect(result.current!.interaction.id).toBe('t1:tu1')
    expect(result.current!.toolUse.id).toBe('tu1')
    expect(result.current!.toolResult?.content).toBe('ok\n')
    expect(result.current!.turn.uuid).toBe('t1')
  })

  it('returns toolResult=null when no matching result exists yet (running)', () => {
    const turn = assistantTurn('t1', 'tu1')
    mockSelectedId.mockReturnValue('t1:tu1')
    mockActiveQuery.mockReturnValue({
      turns: [turn],
      interactions: [interaction('t1', 'tu1')],
    })
    const { result } = renderHook(() => useSelectedInteraction())
    expect(result.current).not.toBeNull()
    expect(result.current!.toolResult).toBeNull()
  })

  it('returns null when selection is stale (id not in interactions)', () => {
    const turn = assistantTurn('t1', 'tu1')
    mockSelectedId.mockReturnValue('stale:id')
    mockActiveQuery.mockReturnValue({
      turns: [turn],
      interactions: [interaction('t1', 'tu1')],
    })
    const { result } = renderHook(() => useSelectedInteraction())
    expect(result.current).toBeNull()
  })
})
