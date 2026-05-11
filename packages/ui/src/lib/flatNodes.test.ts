import { describe, it, expect } from 'vitest'
import { buildFlatNodes } from './flatNodes'
import type { Turn } from '@cc-viewer/shared'

function makeTurn(overrides: Partial<Turn> = {}): Turn {
  return {
    uuid: 'u-1',
    parentUuid: null,
    timestamp: '2026-04-26T00:00:00Z',
    role: 'assistant',
    textBlocks: [],
    thinkingBlocks: [],
    toolUses: [],
    toolResults: [],
    isMeta: false,
    agentId: null,
    ...overrides,
  }
}

describe('buildFlatNodes', () => {
  it('returns empty for empty turns', () => {
    expect(buildFlatNodes([], 'compact')).toEqual([])
    expect(buildFlatNodes([], 'details')).toEqual([])
  })

  it('omits isMeta turns in either mode', () => {
    const t = makeTurn({ uuid: 'm-1', isMeta: true, textBlocks: ['x'] })
    expect(buildFlatNodes([t], 'compact')).toEqual([])
    expect(buildFlatNodes([t], 'details')).toEqual([])
  })

  describe('details mode', () => {
    it('emits parent + thinking + tool-input + tool-output in order', () => {
      const t = makeTurn({
        uuid: 'a',
        textBlocks: ['hi'],
        thinkingBlocks: ['x'],
        toolUses: [{ id: 'tu-1', name: 'Read', input: {} }],
        toolResults: [{ tool_use_id: 'tu-1', content: 'ok' }],
      })
      const nodes = buildFlatNodes([t], 'details')
      expect(nodes.map((n) => n.kind)).toEqual(['turn', 'thinking', 'tool-input', 'tool-output'])
    })

    it('emits the role shell at a role boundary even when textBlocks is empty', () => {
      // Role label is a boundary marker, not a "this turn has text" flag.
      // The previous emitted role is null (start of transcript), so this
      // assistant turn IS a boundary and its "Claude" label must render.
      const t = makeTurn({
        uuid: 'a',
        textBlocks: [],
        toolUses: [{ id: 'tu-1', name: 'Read', input: {} }],
        toolResults: [{ tool_use_id: 'tu-1', content: 'ok' }],
      })
      const nodes = buildFlatNodes([t], 'details')
      expect(nodes.map((n) => n.kind)).toEqual(['turn', 'tool-input', 'tool-output'])
    })

    it('keeps the parent shell when there are no children, even with empty text', () => {
      const t = makeTurn({ uuid: 'a', textBlocks: [] })
      const nodes = buildFlatNodes([t], 'details')
      expect(nodes.map((n) => n.kind)).toEqual(['turn'])
    })

    it('child keys include parent uuid + tool_use_id (collision-protect)', () => {
      const t1 = makeTurn({ uuid: 'a', textBlocks: ['a'], toolUses: [{ id: 'shared-id', name: 'Read', input: {} }] })
      const t2 = makeTurn({ uuid: 'b', textBlocks: ['b'], toolUses: [{ id: 'shared-id', name: 'Read', input: {} }] })
      const nodes = buildFlatNodes([t1, t2], 'details')
      const keys = nodes.filter((n) => n.kind === 'tool-input').map((n) => n.key)
      expect(new Set(keys).size).toBe(2)
    })

    it('referential transparency: same inputs → deep-equal output', () => {
      const t = makeTurn({ uuid: 'a', textBlocks: ['hi'], toolUses: [{ id: 'tu-1', name: 'Read', input: {} }] })
      expect(buildFlatNodes([t], 'details')).toEqual(buildFlatNodes([t], 'details'))
    })

    it('hoists tool_result from a later user turn next to its tool_use', () => {
      const assistant = makeTurn({
        uuid: 'a',
        role: 'assistant',
        textBlocks: [],
        toolUses: [{ id: 'tu-1', name: 'Read', input: {} }],
      })
      const user = makeTurn({
        uuid: 'u',
        role: 'user',
        textBlocks: [],
        toolResults: [{ tool_use_id: 'tu-1', content: 'ok' }],
      })
      const nodes = buildFlatNodes([assistant, user], 'details')
      // Assistant role-boundary shell + tool-input + matched tool-output adjacent.
      // User turn dropped entirely (its only payload was the now-consumed result).
      expect(nodes.map((n) => n.kind)).toEqual(['turn', 'tool-input', 'tool-output'])
      const out = nodes[2]!
      expect(out.kind).toBe('tool-output')
      // The hoisted output row carries `turn = source user turn` so the
      // renderer can still resolve content via turn.toolResults.
      if (out.kind === 'tool-output') {
        expect(out.turn.uuid).toBe('u')
        expect(out.unmatched).toBeUndefined()
      }
    })

    it('pairs concurrent tool calls even when results arrive in reverse order', () => {
      const assistant = makeTurn({
        uuid: 'a',
        role: 'assistant',
        textBlocks: ['working'],
        toolUses: [
          { id: 'tu-read', name: 'Read', input: {} },
          { id: 'tu-bash', name: 'Bash', input: {} },
        ],
      })
      const user = makeTurn({
        uuid: 'u',
        role: 'user',
        textBlocks: [],
        toolResults: [
          // Reversed on the wire — pairing must not depend on arrival order.
          { tool_use_id: 'tu-bash', content: 'bash-out' },
          { tool_use_id: 'tu-read', content: 'read-out' },
        ],
      })
      const nodes = buildFlatNodes([assistant, user], 'details')
      // turn(a) → in(read) → out(read) → in(bash) → out(bash); user turn dropped.
      expect(nodes.map((n) => n.kind)).toEqual([
        'turn', 'tool-input', 'tool-output', 'tool-input', 'tool-output',
      ])
      const ids = nodes.filter((n) => n.kind !== 'turn').map((n) =>
        n.kind === 'tool-input' || n.kind === 'tool-output' ? n.toolUseId : null
      )
      expect(ids).toEqual(['tu-read', 'tu-read', 'tu-bash', 'tu-bash'])
    })

    it('orphan tool_result (no matching tool_use) stays at source with unmatched flag', () => {
      const user = makeTurn({
        uuid: 'u',
        role: 'user',
        textBlocks: [],
        toolResults: [{ tool_use_id: 'tu-ghost', content: 'orphan' }],
      })
      const nodes = buildFlatNodes([user], 'details')
      // Role-boundary shell + the orphan output row.
      expect(nodes.map((n) => n.kind)).toEqual(['turn', 'tool-output'])
      const out = nodes[1]!
      if (out.kind === 'tool-output') {
        expect(out.unmatched).toBe(true)
        expect(out.turn.uuid).toBe('u')
        expect(out.toolUseId).toBe('tu-ghost')
      }
    })

    it('emits a tool-input alone when the matching result has not arrived yet (live-tail)', () => {
      const assistant = makeTurn({
        uuid: 'a',
        role: 'assistant',
        textBlocks: [],
        toolUses: [{ id: 'tu-1', name: 'Read', input: {} }],
      })
      const nodes = buildFlatNodes([assistant], 'details')
      // Role-boundary shell + the unmatched tool-input.
      expect(nodes.map((n) => n.kind)).toEqual(['turn', 'tool-input'])
    })

    it('keeps prose on a user turn that also carried results', () => {
      const assistant = makeTurn({
        uuid: 'a',
        role: 'assistant',
        textBlocks: [],
        toolUses: [{ id: 'tu-1', name: 'Read', input: {} }],
      })
      const user = makeTurn({
        uuid: 'u',
        role: 'user',
        textBlocks: ['real follow-up prompt'],
        toolResults: [{ tool_use_id: 'tu-1', content: 'ok' }],
      })
      const nodes = buildFlatNodes([assistant, user], 'details')
      // Assistant boundary shell + paired tool rows, then user shell with prose.
      expect(nodes.map((n) => n.kind)).toEqual(['turn', 'tool-input', 'tool-output', 'turn'])
      expect((nodes[0] as { turn: Turn }).turn.role).toBe('assistant')
      expect((nodes[3] as { turn: Turn }).turn.role).toBe('user')
    })

    it('drops the role shell on a same-role continuation turn with no prose', () => {
      // Real Claude Code session shape: one assistant event carries thinking +
      // tool_use; the next assistant event carries the prose reply. Without
      // continuation-aware shell-skipping, the "Claude" label would render
      // BELOW the thinking block instead of above it.
      const userTurn = makeTurn({ uuid: 'u', role: 'user', textBlocks: ['ask'] })
      const assistantThinking = makeTurn({
        uuid: 'a1',
        role: 'assistant',
        textBlocks: [],
        thinkingBlocks: ['reasoning'],
      })
      const assistantReply = makeTurn({
        uuid: 'a2',
        role: 'assistant',
        textBlocks: ['answer'],
      })
      const nodes = buildFlatNodes([userTurn, assistantThinking, assistantReply], 'details')
      // user shell + claude shell (boundary) + thinking + assistant prose
      // (NO second claude shell — same role, has prose so it still emits its
      // shell to show the text).
      expect(nodes.map((n) => n.kind)).toEqual(['turn', 'turn', 'thinking', 'turn'])
      expect((nodes[0] as { turn: Turn }).turn.role).toBe('user')
      expect((nodes[1] as { turn: Turn }).turn.uuid).toBe('a1')
      expect((nodes[3] as { turn: Turn }).turn.uuid).toBe('a2')
    })

    it('does NOT repeat the role shell when same-role turn has no prose AND has children', () => {
      const userTurn = makeTurn({ uuid: 'u', role: 'user', textBlocks: ['ask'] })
      const a1 = makeTurn({
        uuid: 'a1',
        role: 'assistant',
        textBlocks: ['first part'],
      })
      const a2 = makeTurn({
        uuid: 'a2',
        role: 'assistant',
        textBlocks: [],
        thinkingBlocks: ['continuation'],
      })
      const nodes = buildFlatNodes([userTurn, a1, a2], 'details')
      // user shell + claude shell (with prose) + claude continuation shell SKIPPED + thinking
      expect(nodes.map((n) => n.kind)).toEqual(['turn', 'turn', 'thinking'])
    })
  })

  describe('compact mode', () => {
    it('emits only the parent turn — no thinking / tool-input / tool-output', () => {
      const t = makeTurn({
        uuid: 'a',
        textBlocks: ['hi'],
        thinkingBlocks: ['x'],
        toolUses: [{ id: 'tu-1', name: 'Read', input: {} }],
        toolResults: [],
      })
      const nodes = buildFlatNodes([t], 'compact')
      expect(nodes.map((n) => n.kind)).toEqual(['turn'])
    })

    it('drops user turns that are tool-result-only (no text, only tool_results)', () => {
      const t = makeTurn({
        uuid: 'u',
        role: 'user',
        textBlocks: [],
        toolResults: [{ tool_use_id: 'tu-1', content: 'ok' }],
      })
      expect(buildFlatNodes([t], 'compact')).toEqual([])
    })

    it('keeps user turns with text even when they also carry tool_results', () => {
      const t = makeTurn({
        uuid: 'u',
        role: 'user',
        textBlocks: ['real prompt'],
        toolResults: [{ tool_use_id: 'tu-1', content: 'ok' }],
      })
      const nodes = buildFlatNodes([t], 'compact')
      expect(nodes).toHaveLength(1)
      expect(nodes[0]!.kind).toBe('turn')
    })

    it('drops assistant turns with no prose (pure thinking/tool turn)', () => {
      const t = makeTurn({
        uuid: 'a',
        role: 'assistant',
        textBlocks: [],
        toolUses: [{ id: 'tu-1', name: 'Read', input: {} }],
      })
      expect(buildFlatNodes([t], 'compact')).toEqual([])
    })
  })
})
