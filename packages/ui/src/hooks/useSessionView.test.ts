import { describe, it, expect } from 'vitest'
import { projectSessionView } from './useSessionView'
import { buildMultiTurnDetail } from '@/test/fixtures'
import type { ToolBlock, DiffBlock } from '@/lib/types'

describe('projectSessionView', () => {
  const view = projectSessionView(buildMultiTurnDetail(), {
    id: 'session-1',
    title: 'Multi-turn',
    isLive: false,
  })

  it('groups user/assistant turns into SessionTurns in document order', () => {
    expect(view.turns.map((t) => t.id)).toEqual(['u-a', 'u-b', 'u-c'])
    expect(view.turns[0].prompt).toBe('do the thing')
    expect(view.turns[1].prompt).toBe('[stderr] something failed')
  })

  it('places each assistant request under its preceding user turn', () => {
    expect(view.turns[0].requests.map((r) => r.id)).toEqual(['a-a'])
    expect(view.turns[1].requests.map((r) => r.id)).toEqual(['a-b'])
    expect(view.turns[2].requests.map((r) => r.id)).toEqual(['a-c1', 'a-c2'])
  })

  it('emits a tool_use block with status and duration sourced from ToolInteraction', () => {
    const block = view.turns[0].requests[0].blocks.find((b) => b.kind === 'tool_use') as ToolBlock
    expect(block).toBeDefined()
    expect(block.name).toBe('Bash')
    expect(block.durationMs).toBe(120)
    expect(block.status).toBe('ok')
    expect(block.isSubagent).toBe(false)
  })

  it('marks subagent-spawning tool_use as isSubagent and joins SubagentRef metrics', () => {
    const block = view.turns[1].requests[0].blocks.find((b) => b.kind === 'tool_use') as ToolBlock
    expect(block.isSubagent).toBe(true)
    expect(block.subagentRef).toBe('sub-1')
    expect(block.subagentMetrics?.agentType).toBe('general-purpose')
    expect(block.subagentMetrics?.turnCount).toBe(1)
    expect(block.subagentMetrics?.toolCallCount).toBe(1)
  })

  it('emits a diff block for Edit tool_use (not a tool_use block)', () => {
    const req = view.turns[2].requests[1]
    const kinds = req.blocks.map((b) => b.kind)
    expect(kinds).toContain('diff')
    const diff = req.blocks.find((b) => b.kind === 'diff') as DiffBlock
    expect(diff.path).toBe('/tmp/a.ts')
    expect(diff.hunks.some((h) => h.type === 'del')).toBe(true)
    expect(diff.hunks.some((h) => h.type === 'add')).toBe(true)
  })

  it('joins tool_result content onto the prior tool_use as block.output', () => {
    const bash = view.turns[0].requests[0].blocks.find(
      (b) => b.kind === 'tool_use' && b.name === 'Bash',
    ) as ToolBlock
    expect(bash.output).toBe('total 0')
  })

  it('captures attachments on user turns that carry tool_results', () => {
    expect(view.turns[2].attachments.length).toBe(1)
    expect(view.turns[2].attachments[0].kind).toBe('tool_result')
  })

  it('merges live pendingTurns, deduplicating by uuid', () => {
    const base = buildMultiTurnDetail()
    const pending = [
      { ...base.turns[0] }, // duplicate of u-a — should be dropped
      {
        uuid: 'u-d',
        parentUuid: null,
        timestamp: '2026-05-22T01:00:00.000Z',
        role: 'user' as const,
        textBlocks: ['live prompt'],
        thinkingBlocks: [],
        toolUses: [],
        toolResults: [],
        isMeta: false,
        agentId: null,
      },
    ]
    const merged = projectSessionView(base, { id: 's', title: 't', isLive: true }, pending)
    expect(merged.turns.map((t) => t.id)).toEqual(['u-a', 'u-b', 'u-c', 'u-d'])
  })
})
