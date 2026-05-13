import { describe, it, expect } from 'vitest'
import { buildFlatNodes, type FlatNodeOptions } from './flatNodes'
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

const NO_DIFFS: FlatNodeOptions['hasDiff'] = () => false
const WITH_DIFF = (ids: string[]): FlatNodeOptions['hasDiff'] => (id) => ids.includes(id)
const SHOW: FlatNodeOptions = { showThinking: true,  hasDiff: NO_DIFFS }
const HIDE: FlatNodeOptions = { showThinking: false, hasDiff: NO_DIFFS }

describe('buildFlatNodes (Phase 4)', () => {
  it('returns empty for empty turns', () => {
    expect(buildFlatNodes([], SHOW)).toEqual([])
  })

  it('omits isMeta turns', () => {
    const t = makeTurn({ uuid: 'm-1', isMeta: true, textBlocks: ['x'] })
    expect(buildFlatNodes([t], SHOW)).toEqual([])
  })

  it('emits assistant shell + thinking + capsule in order', () => {
    const t = makeTurn({
      uuid: 'a',
      textBlocks: ['hi'],
      thinkingBlocks: ['x'],
      toolUses: [{ id: 'tu-1', name: 'Read', input: {} }],
    })
    const nodes = buildFlatNodes([t], SHOW)
    expect(nodes.map((n) => n.kind)).toEqual(['turn', 'thinking', 'capsule'])
  })

  it('emits a diff node after the capsule when hasDiff returns true', () => {
    const t = makeTurn({
      uuid: 'a',
      textBlocks: ['hi'],
      toolUses: [{ id: 'tu-1', name: 'Edit', input: {} }],
    })
    const nodes = buildFlatNodes([t], {
      showThinking: true,
      hasDiff: WITH_DIFF(['tu-1']),
    })
    expect(nodes.map((n) => n.kind)).toEqual(['turn', 'capsule', 'diff'])
  })

  it('omits thinking when showThinking is false (compact)', () => {
    const t = makeTurn({
      uuid: 'a',
      textBlocks: ['hi'],
      thinkingBlocks: ['x'],
      toolUses: [{ id: 'tu-1', name: 'Read', input: {} }],
    })
    const nodes = buildFlatNodes([t], HIDE)
    expect(nodes.map((n) => n.kind)).toEqual(['turn', 'capsule'])
  })

  it('drops tool-result-only user turns entirely', () => {
    const t = makeTurn({
      uuid: 'u',
      role: 'user',
      textBlocks: [],
      toolResults: [{ tool_use_id: 'tu-1', content: 'ok' }],
    })
    expect(buildFlatNodes([t], SHOW)).toEqual([])
  })

  it('keeps the role shell for empty assistant turns when no children', () => {
    const t = makeTurn({ uuid: 'a', textBlocks: [] })
    const nodes = buildFlatNodes([t], SHOW)
    expect(nodes.map((n) => n.kind)).toEqual(['turn'])
  })

  it('emits the role-boundary shell even when textBlocks is empty', () => {
    const t = makeTurn({
      uuid: 'a',
      textBlocks: [],
      toolUses: [{ id: 'tu-1', name: 'Read', input: {} }],
    })
    const nodes = buildFlatNodes([t], SHOW)
    expect(nodes.map((n) => n.kind)).toEqual(['turn', 'capsule'])
  })

  it('drops the role shell on a same-role continuation turn with no prose', () => {
    const userTurn = makeTurn({ uuid: 'u', role: 'user', textBlocks: ['ask'] })
    const a1 = makeTurn({ uuid: 'a1', role: 'assistant', textBlocks: [], thinkingBlocks: ['reasoning'] })
    const a2 = makeTurn({ uuid: 'a2', role: 'assistant', textBlocks: ['answer'] })
    const nodes = buildFlatNodes([userTurn, a1, a2], SHOW)
    expect(nodes.map((n) => n.kind)).toEqual(['turn', 'turn', 'thinking', 'turn'])
    expect((nodes[1] as { turn: Turn }).turn.uuid).toBe('a1')
    expect((nodes[3] as { turn: Turn }).turn.uuid).toBe('a2')
  })

  it('keeps a user turn that classifies as command', () => {
    const t = makeTurn({
      uuid: 'u',
      role: 'user',
      textBlocks: ['<command-name>/clear</command-name>'],
    })
    const nodes = buildFlatNodes([t], SHOW)
    expect(nodes.map((n) => n.kind)).toEqual(['turn'])
  })

  it('keys are unique across turns even when toolUseId collides', () => {
    const t1 = makeTurn({ uuid: 'a', textBlocks: ['a'], toolUses: [{ id: 'shared', name: 'Read', input: {} }] })
    const t2 = makeTurn({ uuid: 'b', textBlocks: ['b'], toolUses: [{ id: 'shared', name: 'Read', input: {} }] })
    const nodes = buildFlatNodes([t1, t2], SHOW)
    const keys = nodes.filter((n) => n.kind === 'capsule').map((n) => n.key)
    expect(new Set(keys).size).toBe(2)
  })
})
