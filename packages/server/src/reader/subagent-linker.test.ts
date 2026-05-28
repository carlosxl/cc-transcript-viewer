import { describe, it, expect } from 'vitest'
import type { ClaudeEvent } from '@cc-viewer/shared'
import {
  extractAgentLink,
  extractAgentIdFromToolResult,
  buildSubagentLinkages,
} from './subagent-linker.js'

describe('extractAgentLink', () => {
  it('extracts task-id and tool-use-id from queue-operation content', () => {
    const link = extractAgentLink('<task-id>abc123</task-id><tool-use-id>toolu_01ABC</tool-use-id>')
    expect(link).toEqual({ taskId: 'abc123', toolUseId: 'toolu_01ABC' })
  })

  it('tolerates surrounding text and whitespace', () => {
    const link = extractAgentLink('prefix <task-id>  abc  </task-id> middle <tool-use-id>tool_x</tool-use-id> suffix')
    expect(link).toEqual({ taskId: 'abc', toolUseId: 'tool_x' })
  })

  it('returns null when either tag is missing', () => {
    expect(extractAgentLink('<task-id>abc</task-id>')).toBeNull()
    expect(extractAgentLink('<tool-use-id>tool</tool-use-id>')).toBeNull()
    expect(extractAgentLink('no tags at all')).toBeNull()
  })
})

describe('extractAgentIdFromToolResult', () => {
  it('parses the canonical "agentId: ..." format', () => {
    const id = extractAgentIdFromToolResult('Async agent launched successfully.\nagentId: a09b6a258d073239e\nMore info follows')
    expect(id).toBe('a09b6a258d073239e')
  })

  it('matches case-sensitively on "agentId" prefix', () => {
    expect(extractAgentIdFromToolResult('agentid: lowercase')).toBeNull()
    expect(extractAgentIdFromToolResult('agentId: UPPER_AND_LOWER-99')).toBe('UPPER_AND_LOWER-99')
  })

  it('returns null when no agentId pattern is present', () => {
    expect(extractAgentIdFromToolResult('agent launched but no id here')).toBeNull()
  })
})

describe('buildSubagentLinkages', () => {
  function assistant(id: string, blocks: unknown[]): ClaudeEvent {
    return {
      type: 'assistant',
      uuid: `a-${id}`,
      timestamp: '2026-05-09T00:00:00Z',
      message: { role: 'assistant', content: blocks },
    } as unknown as ClaudeEvent
  }
  function userToolResult(toolUseId: string, text: string, isError = false): ClaudeEvent {
    return {
      type: 'user',
      uuid: `u-${toolUseId}`,
      timestamp: '2026-05-09T00:00:01Z',
      message: {
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: toolUseId, content: text, is_error: isError }],
      },
    } as unknown as ClaudeEvent
  }
  function queueOp(operation: string, taskId: string, toolUseId: string): ClaudeEvent {
    return {
      type: 'queue-operation',
      uuid: `qo-${taskId}`,
      timestamp: '2026-05-09T00:00:00Z',
      operation,
      content: `<task-id>${taskId}</task-id><tool-use-id>${toolUseId}</tool-use-id>`,
    } as unknown as ClaudeEvent
  }

  it('resolves toolUseId via Source 1 (queue-operation enqueue)', () => {
    const parentEvents: ClaudeEvent[] = [
      assistant('1', [{ type: 'tool_use', id: 'toolu_X', name: 'Task', input: {} }]),
      queueOp('enqueue', 'agentA', 'toolu_X'),
    ]
    const linkages = buildSubagentLinkages(parentEvents, new Map([['agentA', []]]))
    expect(linkages.agentToToolUse.get('agentA')).toBe('toolu_X')
    expect(linkages.toolUseToAgent.get('toolu_X')).toBe('agentA')
    expect(linkages.childrenByAgent.get('')).toEqual(['agentA'])
  })

  it('resolves toolUseId via Source 2 (tool_result agentId text) when no queue-operation', () => {
    const parentEvents: ClaudeEvent[] = [
      assistant('1', [{ type: 'tool_use', id: 'toolu_Y', name: 'Agent', input: {} }]),
      userToolResult('toolu_Y', 'Async agent launched successfully.\nagentId: agentB'),
    ]
    const linkages = buildSubagentLinkages(parentEvents, new Map([['agentB', []]]))
    expect(linkages.agentToToolUse.get('agentB')).toBe('toolu_Y')
    expect(linkages.toolUseToAgent.get('toolu_Y')).toBe('agentB')
  })

  it('resolves toolUseId via Source 2 structured `toolUseResult.agentId` (modern Claude Code)', () => {
    // Modern Claude Code: tool_result.content is the agent's natural-language
    // answer (no "agentId:" marker), but the user event carries a structured
    // `toolUseResult.agentId` sidecar.
    const userEvent = {
      type: 'user',
      uuid: 'u-toolu_M',
      timestamp: '2026-05-09T00:00:01Z',
      message: {
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: 'toolu_M', content: 'Free-form answer text without any agentId marker.' }],
      },
      toolUseResult: { agentId: 'agentModern', agentType: 'Explore', status: 'completed', totalDurationMs: 1000, totalTokens: 200 },
    } as unknown as ClaudeEvent
    const parentEvents: ClaudeEvent[] = [
      assistant('1', [{ type: 'tool_use', id: 'toolu_M', name: 'Agent', input: { subagent_type: 'Explore' } }]),
      userEvent,
    ]
    const linkages = buildSubagentLinkages(parentEvents, new Map([['agentModern', []]]))
    expect(linkages.agentToToolUse.get('agentModern')).toBe('toolu_M')
    expect(linkages.toolUseToAgent.get('toolu_M')).toBe('agentModern')
  })

  it('Source 1 wins over Source 2 when both signals exist', () => {
    const parentEvents: ClaudeEvent[] = [
      assistant('1', [{ type: 'tool_use', id: 'toolu_Z', name: 'Task', input: {} }]),
      queueOp('enqueue', 'agentC', 'toolu_Z'),
      // Tool result claims a different agentId — should be ignored because Source 1 already won.
      userToolResult('toolu_Z', 'agentId: WRONG_ID'),
    ]
    const linkages = buildSubagentLinkages(parentEvents, new Map([
      ['agentC', []],
      ['WRONG_ID', []],
    ]))
    expect(linkages.agentToToolUse.get('agentC')).toBe('toolu_Z')
    expect(linkages.toolUseToAgent.get('toolu_Z')).toBe('agentC')
    // WRONG_ID should NOT appear as a child of main since toolu_Z was already claimed.
    expect(linkages.childrenByAgent.get('')).toEqual(['agentC'])
  })

  it('marks status=failed when the tool_result has is_error', () => {
    const parentEvents: ClaudeEvent[] = [
      assistant('1', [{ type: 'tool_use', id: 'toolu_F', name: 'Agent', input: {} }]),
      userToolResult('toolu_F', 'agentId: agentDead', true),
    ]
    const linkages = buildSubagentLinkages(parentEvents, new Map([['agentDead', []]]))
    expect(linkages.agentStatus.get('agentDead')).toBe('failed')
  })

  it('marks status=killed on popAll, completed on remove', () => {
    const parentEvents: ClaudeEvent[] = [
      queueOp('enqueue', 'agentRun', 'toolu_R'),
      queueOp('enqueue', 'agentDone', 'toolu_D'),
      queueOp('remove', 'agentDone', 'toolu_D'),
      queueOp('popAll', 'agentRun', 'toolu_R'),
    ]
    const linkages = buildSubagentLinkages(parentEvents, new Map([
      ['agentRun', []],
      ['agentDone', []],
    ]))
    expect(linkages.agentStatus.get('agentRun')).toBe('killed')
    expect(linkages.agentStatus.get('agentDone')).toBe('completed')
  })

  it('detects nested children (subagent spawning subagent)', () => {
    const parentEvents: ClaudeEvent[] = [
      assistant('p1', [{ type: 'tool_use', id: 'toolu_P', name: 'Task', input: {} }]),
      queueOp('enqueue', 'parent', 'toolu_P'),
    ]
    const parentSubagentEvents: ClaudeEvent[] = [
      assistant('s1', [{ type: 'tool_use', id: 'toolu_C', name: 'Task', input: {} }]),
      queueOp('enqueue', 'child', 'toolu_C'),
    ]
    const linkages = buildSubagentLinkages(
      parentEvents,
      new Map([
        ['parent', parentSubagentEvents],
        ['child', []],
      ]),
    )
    expect(linkages.childrenByAgent.get('')).toEqual(['parent'])
    expect(linkages.childrenByAgent.get('parent')).toEqual(['child'])
    expect(linkages.toolUseToAgent.get('toolu_C')).toBe('child')
  })

  it('leaves agents unresolved when neither source matches', () => {
    const parentEvents: ClaudeEvent[] = [
      assistant('1', [{ type: 'tool_use', id: 'toolu_Lonely', name: 'Task', input: {} }]),
      // No queue-operation, no tool_result with agentId text.
    ]
    const linkages = buildSubagentLinkages(parentEvents, new Map([['orphanAgent', []]]))
    expect(linkages.agentToToolUse.get('orphanAgent')).toBeUndefined()
    expect(linkages.toolUseToAgent.size).toBe(0)
    // status default still 'completed'.
    expect(linkages.agentStatus.get('orphanAgent')).toBe('completed')
  })

  it('ignores tool_result agentId references that do not match a known subagent', () => {
    const parentEvents: ClaudeEvent[] = [
      assistant('1', [{ type: 'tool_use', id: 'toolu_X', name: 'Agent', input: {} }]),
      userToolResult('toolu_X', 'agentId: ghost-agent-not-on-disk'),
    ]
    const linkages = buildSubagentLinkages(parentEvents, new Map([['real-agent', []]]))
    expect(linkages.agentToToolUse.size).toBe(0)
    expect(linkages.toolUseToAgent.size).toBe(0)
  })

  function userStdoutTurn(uuid: string, timestamp: string, body = 'result'): ClaudeEvent {
    return {
      type: 'user',
      uuid,
      timestamp,
      message: {
        role: 'user',
        content: `<local-command-stdout>${body}</local-command-stdout>`,
      },
    } as unknown as ClaudeEvent
  }
  function assistantAt(uuid: string, timestamp: string): ClaudeEvent {
    return {
      type: 'assistant',
      uuid,
      timestamp,
      message: { role: 'assistant', content: [{ type: 'text', text: 'done' }] },
    } as unknown as ClaudeEvent
  }

  it('Source 3 attributes an orphan subagent to a stdout turn by timestamp', () => {
    const parentEvents: ClaudeEvent[] = [
      userStdoutTurn('turn-stdout', '2026-05-15T02:04:42.717Z'),
    ]
    const subagentEvents: ClaudeEvent[] = [
      assistantAt('a1', '2026-05-15T02:04:21.272Z'),
      assistantAt('a2', '2026-05-15T02:04:42.709Z'), // 8ms before stdout
    ]
    const linkages = buildSubagentLinkages(
      parentEvents,
      new Map([['agentSkill', subagentEvents]]),
    )
    expect(linkages.agentToParentTurnUuid.get('agentSkill')).toBe('turn-stdout')
    expect(linkages.childrenByAgent.get('')).toContain('agentSkill')
    // Source 3 does NOT populate toolUseId — that field stays empty.
    expect(linkages.agentToToolUse.get('agentSkill')).toBeUndefined()
  })

  it('Source 3 skips subagents whose timestamp gap exceeds the tolerance', () => {
    const parentEvents: ClaudeEvent[] = [
      userStdoutTurn('turn-stdout', '2026-05-15T02:04:42.717Z'),
    ]
    const subagentEvents: ClaudeEvent[] = [
      assistantAt('a1', '2026-05-15T02:04:00.000Z'), // 42s before → exceeds 5s tolerance
    ]
    const linkages = buildSubagentLinkages(
      parentEvents,
      new Map([['agentFar', subagentEvents]]),
    )
    expect(linkages.agentToParentTurnUuid.get('agentFar')).toBeUndefined()
  })

  it('Source 3 yields to Source 1 when the subagent already has a toolUseId', () => {
    const parentEvents: ClaudeEvent[] = [
      assistant('1', [{ type: 'tool_use', id: 'toolu_T', name: 'Task', input: {} }]),
      queueOp('enqueue', 'agentDual', 'toolu_T'),
      userStdoutTurn('turn-stdout', '2026-05-15T02:04:42.717Z'),
    ]
    const subagentEvents: ClaudeEvent[] = [
      assistantAt('a1', '2026-05-15T02:04:42.710Z'),
    ]
    const linkages = buildSubagentLinkages(
      parentEvents,
      new Map([['agentDual', subagentEvents]]),
    )
    expect(linkages.agentToToolUse.get('agentDual')).toBe('toolu_T')
    expect(linkages.agentToParentTurnUuid.get('agentDual')).toBeUndefined()
  })

  it('Source 3 attributes each orphan subagent to its own stdout turn', () => {
    const parentEvents: ClaudeEvent[] = [
      userStdoutTurn('turn-1', '2026-05-15T02:04:42.717Z'),
      userStdoutTurn('turn-2', '2026-05-15T02:08:20.475Z'),
    ]
    const subagentA: ClaudeEvent[] = [
      assistantAt('a1', '2026-05-15T02:04:42.700Z'),
    ]
    const subagentB: ClaudeEvent[] = [
      assistantAt('b1', '2026-05-15T02:08:20.440Z'),
    ]
    const linkages = buildSubagentLinkages(
      parentEvents,
      new Map([
        ['agentA', subagentA],
        ['agentB', subagentB],
      ]),
    )
    expect(linkages.agentToParentTurnUuid.get('agentA')).toBe('turn-1')
    expect(linkages.agentToParentTurnUuid.get('agentB')).toBe('turn-2')
  })
})
