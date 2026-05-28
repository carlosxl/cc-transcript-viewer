import { describe, it, expect } from 'vitest'
import { projectSessionView } from './useSessionView'
import { assistantTurn, buildMultiTurnDetail, toolInteraction, userTurn } from '@/test/fixtures'
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

  it('emits both a tool_use and a paired diff block for Edit', () => {
    const req = view.turns[2].requests[1]
    const kinds = req.blocks.map((b) => b.kind)
    expect(kinds).toContain('tool_use')
    expect(kinds).toContain('diff')
    const edit = req.blocks.find((b) => b.kind === 'tool_use' && b.name === 'Edit') as ToolBlock
    expect(edit).toBeDefined()
    const diff = req.blocks.find((b) => b.kind === 'diff') as DiffBlock
    expect(diff.path).toBe('/tmp/a.ts')
    expect(diff.hunks.some((h) => h.type === 'del')).toBe(true)
    expect(diff.hunks.some((h) => h.type === 'add')).toBe(true)
    // Badge counts match the hunk counts so the +N / -N reading matches the
    // rendered diff body line-for-line.
    const addLines = diff.hunks.filter((h) => h.type === 'add').length
    const delLines = diff.hunks.filter((h) => h.type === 'del').length
    expect(diff.adds).toBe(addLines)
    expect(diff.dels).toBe(delLines)
  })

  it('joins tool_result content onto the prior tool_use as block.output', () => {
    const bash = view.turns[0].requests[0].blocks.find(
      (b) => b.kind === 'tool_use' && b.name === 'Bash',
    ) as ToolBlock
    expect(bash.output).toBe('total 0')
  })

  it('does NOT surface tool_results as attachments when they have a matching tool_use', () => {
    // The fixture's tool_results all reference tool_uses in earlier assistant
    // rows; those already render inline as ToolBlock.output. Surfacing them
    // again as turn-level attachments would just duplicate the same data.
    expect(view.turns[2].attachments.length).toBe(0)
  })

  it('does surface orphan tool_results (no matching tool_use) as attachments', () => {
    const base = buildMultiTurnDetail()
    const orphan = userTurn({
      uuid: 'u-orphan-res',
      text: '',
      timestamp: '2026-05-22T00:00:03.500Z',
      toolResults: [{ tool_use_id: 'tu-harness-only', content: 'git status: clean' }],
    })
    const detail = { ...base, turns: [...base.turns, orphan] }
    const v = projectSessionView(detail, { id: 's', title: 't', isLive: false })
    const att = v.turns[2].attachments.find((a) => a.toolUseId === 'tu-harness-only')
    expect(att).toBeDefined()
    expect(att?.body).toBe('git status: clean')
  })

  it('derives request.ttft as ms between the preceding turn and the assistant turn', () => {
    // Fixture user turns timestamp 00:00:00, assistant turns 00:00:01 → 1000ms TTFT.
    expect(view.turns[0].requests[0].ttft).toBe(1000)
    // turn C has two assistant requests; the second is preceded by the first
    // assistant turn (both timestamped 00:00:01) so its delta is 0 → null.
    expect(view.turns[2].requests[0].ttft).toBe(1000)
    expect(view.turns[2].requests[1].ttft).toBeNull()
  })

  it('returns ttft null when the assistant turn has no preceding non-meta turn', () => {
    const detail = {
      ...buildMultiTurnDetail(),
      turns: [
        assistantTurn({ uuid: 'a-orphan', texts: ['hello'], timestamp: '2026-05-22T00:00:05.000Z' }),
      ],
    }
    const v = projectSessionView(detail, { id: 's', title: 't', isLive: false })
    expect(v.turns[0].requests[0].ttft).toBeNull()
  })

  it('returns ttft null when either timestamp is missing or unparseable', () => {
    const detail = {
      ...buildMultiTurnDetail(),
      turns: [
        userTurn({ uuid: 'u-x', text: 'hi', timestamp: '' }),
        assistantTurn({ uuid: 'a-x', texts: ['ok'], timestamp: '2026-05-22T00:00:01.000Z' }),
        userTurn({ uuid: 'u-y', text: 'hi2', timestamp: '2026-05-22T00:00:02.000Z' }),
        assistantTurn({ uuid: 'a-y', texts: ['ok2'], timestamp: 'not-a-date' }),
      ],
    }
    const v = projectSessionView(detail, { id: 's', title: 't', isLive: false })
    expect(v.turns[0].requests[0].ttft).toBeNull()
    expect(v.turns[1].requests[0].ttft).toBeNull()
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

  // 007-ui-information-revamp / T017 — schema-typed rows pass-through.
  it('exposes the wire `rows` field on the SessionView output', () => {
    const base = buildMultiTurnDetail()
    const detailWithRows = {
      ...base,
      rows: [
        { type: 'user', uuid: 'u-a', message: { role: 'user' as const, content: 'hi' } },
        { type: 'assistant', uuid: 'a-a', message: { content: [] } },
      ],
    } as typeof base
    const v = projectSessionView(detailWithRows, { id: 's', title: 't', isLive: false })
    expect(v.rows.length).toBe(2)
    expect((v.rows[0] as { uuid?: string }).uuid).toBe('u-a')
  })

  it('folds tool_result-only user rows sharing a promptId into the anchoring Turn', () => {
    const base = buildMultiTurnDetail()
    // Append a user row whose only content is a tool_result and which shares
    // turn C's promptId — it should NOT become a new SessionTurn. (The
    // tool_result itself has a matching tool_use in turn C's assistant rows,
    // so it shows inline; no separate attachment is expected.)
    const cont = userTurn({
      uuid: 'u-c-cont',
      text: '',
      timestamp: '2026-05-22T00:00:03.000Z',
      toolResults: [{ tool_use_id: 'tu-edit', content: 'patched' }],
    })
    const detail = {
      ...base,
      turns: [...base.turns, cont],
      rows: [
        // Anchor row for turn C: promptId p-c carries the human prompt.
        { type: 'user', uuid: 'u-c', promptId: 'p-c', message: { role: 'user' as const, content: 'now patch the file' } },
        // Continuation row reuses the same promptId.
        { type: 'user', uuid: 'u-c-cont', promptId: 'p-c', message: { role: 'user' as const, content: [{ type: 'tool_result', tool_use_id: 'tu-edit', content: 'patched' }] } },
      ],
    } as typeof base
    const v = projectSessionView(detail, { id: 's', title: 't', isLive: false })
    // Turn count unchanged: u-a, u-b, u-c (continuation merged in).
    expect(v.turns.map((t) => t.id)).toEqual(['u-a', 'u-b', 'u-c'])
  })

  it('coalesces consecutive assistant Turns sharing a requestId into one Request', () => {
    const base = buildMultiTurnDetail()
    // Replace turn C's two requests with three assistant rows that all share
    // requestId 'req-c' (matches Claude Code's split-per-content-block writeout).
    const u = userTurn({ uuid: 'u-c', text: 'go', timestamp: '2026-05-22T00:00:00.000Z' })
    const a1 = assistantTurn({
      uuid: 'a-c1',
      thinking: ['planning'],
      timestamp: '2026-05-22T00:00:01.000Z',
    })
    const a2 = assistantTurn({
      uuid: 'a-c2',
      toolUses: [{ id: 'tu-1', name: 'Bash', input: { command: 'ls' } }],
      timestamp: '2026-05-22T00:00:01.500Z',
    })
    const a3 = assistantTurn({
      uuid: 'a-c3',
      texts: ['done'],
      timestamp: '2026-05-22T00:00:02.000Z',
    })
    const detail = {
      ...base,
      turns: [u, a1, a2, a3],
      rows: [
        { type: 'user', uuid: 'u-c', promptId: 'p-c', message: { role: 'user' as const, content: 'go' } },
        { type: 'assistant', uuid: 'a-c1', requestId: 'req-c', message: { content: [] } },
        { type: 'assistant', uuid: 'a-c2', requestId: 'req-c', message: { content: [] } },
        { type: 'assistant', uuid: 'a-c3', requestId: 'req-c', message: { content: [] } },
      ],
    } as typeof base
    const v = projectSessionView(detail, { id: 's', title: 't', isLive: false })
    expect(v.turns).toHaveLength(1)
    // One Request, not three — anchored on the first assistant uuid.
    expect(v.turns[0].requests).toHaveLength(1)
    const req = v.turns[0].requests[0]
    expect(req.id).toBe('a-c1')
    // Block stream preserves order: thinking, tool_use, text.
    expect(req.blocks.map((b) => b.kind)).toEqual(['thinking', 'tool_use', 'text'])
  })

  it('keeps separate assistant Turns with different requestIds as separate Requests', () => {
    const base = buildMultiTurnDetail()
    const u = userTurn({ uuid: 'u-c', text: 'go', timestamp: '2026-05-22T00:00:00.000Z' })
    const a1 = assistantTurn({
      uuid: 'a-c1',
      texts: ['first'],
      timestamp: '2026-05-22T00:00:01.000Z',
    })
    const a2 = assistantTurn({
      uuid: 'a-c2',
      texts: ['second'],
      timestamp: '2026-05-22T00:00:02.000Z',
    })
    const detail = {
      ...base,
      turns: [u, a1, a2],
      rows: [
        { type: 'user', uuid: 'u-c', promptId: 'p-c', message: { role: 'user' as const, content: 'go' } },
        { type: 'assistant', uuid: 'a-c1', requestId: 'req-1', message: { content: [] } },
        { type: 'assistant', uuid: 'a-c2', requestId: 'req-2', message: { content: [] } },
      ],
    } as typeof base
    const v = projectSessionView(detail, { id: 's', title: 't', isLive: false })
    expect(v.turns[0].requests.map((r) => r.id)).toEqual(['a-c1', 'a-c2'])
  })

  it('folds tool_result-only user Turns into the current Turn even without a promptId match', () => {
    // Simulates a live-tail row whose source row hasn't been re-synced into
    // detail.rows yet AND whose Turn came from a server running an older
    // normalizer (no promptId field on the Turn either).
    const base = buildMultiTurnDetail()
    const orphanCont = userTurn({
      uuid: 'u-c-live',
      text: '',
      timestamp: '2026-05-22T00:00:03.000Z',
      toolResults: [{ tool_use_id: 'tu-edit', content: 'patched' }],
    })
    const detail = { ...base, turns: [...base.turns, orphanCont] }
    const v = projectSessionView(detail, { id: 's', title: 't', isLive: false })
    // Still three turns (no new turn for the live-tail tool_result continuation).
    expect(v.turns.map((t) => t.id)).toEqual(['u-a', 'u-b', 'u-c'])
  })

  it('tags a tool_use as retryOf when an earlier same-tool call in the turn errored', () => {
    const u = userTurn({ uuid: 'u-r', text: 'read it' })
    const a1 = assistantTurn({
      uuid: 'a-r1',
      toolUses: [
        { id: 'tu-read-1', name: 'Read', input: { file_path: '/nope.ts' } },
      ],
      timestamp: '2026-05-22T00:00:01.000Z',
    })
    const a2 = assistantTurn({
      uuid: 'a-r2',
      toolUses: [
        { id: 'tu-read-2', name: 'Read', input: { file_path: '/real.ts' } },
      ],
      timestamp: '2026-05-22T00:00:02.000Z',
    })
    const detail = {
      schemaVersion: '1.0.0',
      sessionId: 's',
      title: 't',
      turns: [u, a1, a2],
      toolInteractions: [
        { ...toolInteraction('tu-read-1', 'Read'), status: 'fail' as const },
        toolInteraction('tu-read-2', 'Read'),
      ],
      rows: [],
    } as unknown as Parameters<typeof projectSessionView>[0]
    const v = projectSessionView(detail, { id: 's', title: 't', isLive: false })
    const turn = v.turns[0]
    const firstRead = turn.requests[0].blocks.find((b) => b.kind === 'tool_use') as ToolBlock
    const secondRead = turn.requests[1].blocks.find((b) => b.kind === 'tool_use') as ToolBlock
    expect(firstRead.retryOf).toBeUndefined()
    expect(firstRead.status).toBe('err')
    expect(secondRead.retryOf).toBe('tu-read-1')
    expect(secondRead.status).toBe('ok')
  })

  it('tags a Request as isApiError when the wire row carries isApiErrorMessage: true', () => {
    const u = userTurn({ uuid: 'u-e', text: 'go', timestamp: '2026-05-22T00:00:00.000Z' })
    const a = assistantTurn({
      uuid: 'a-e',
      texts: ['API Error: 529 Overloaded'],
      timestamp: '2026-05-22T00:00:01.000Z',
    })
    const detail = {
      schemaVersion: '1.0.0',
      sessionId: 's',
      title: 't',
      turns: [u, a],
      rows: [
        { type: 'user', uuid: 'u-e', promptId: 'p-e', message: { role: 'user' as const, content: 'go' } },
        {
          type: 'assistant',
          uuid: 'a-e',
          requestId: 'req-e',
          isApiErrorMessage: true,
          message: { content: [{ type: 'text', text: 'API Error: 529 Overloaded' }] },
        },
      ],
    } as unknown as Parameters<typeof projectSessionView>[0]
    const v = projectSessionView(detail, { id: 's', title: 't', isLive: false })
    expect(v.turns[0].requests[0].isApiError).toBe(true)
  })

  it('leaves isApiError undefined for normal assistant rows', () => {
    const v = projectSessionView(buildMultiTurnDetail(), { id: 's', title: 't', isLive: false })
    for (const t of v.turns) {
      for (const r of t.requests) {
        expect(r.isApiError).toBeUndefined()
      }
    }
  })

  it('promotes status to "cancelled" when the tool_result body contains the user-rejection marker', () => {
    // Claude Code injects "The tool use was rejected" when the user declines a
    // permission prompt (e.g. ExitPlanMode "No, keep planning"). Not a real
    // error — render as cancelled, not err.
    const u = userTurn({ uuid: 'u-p', text: 'propose a plan', timestamp: '2026-05-22T00:00:00.000Z' })
    const a = assistantTurn({
      uuid: 'a-p',
      toolUses: [{ id: 'tu-plan', name: 'ExitPlanMode', input: { plan: '# Do the thing\n- step 1' } }],
      timestamp: '2026-05-22T00:00:01.000Z',
    })
    const reject = userTurn({
      uuid: 'u-p-reject',
      text: '',
      timestamp: '2026-05-22T00:00:02.000Z',
      toolResults: [{
        tool_use_id: 'tu-plan',
        content: "The user doesn't want to proceed with this tool use. The tool use was rejected (eg. if it was a file edit, the new_string was NOT written to the file).",
      }],
    })
    const detail = {
      schemaVersion: '1.0.0',
      sessionId: 's',
      title: 't',
      turns: [u, a, reject],
      toolInteractions: [{ ...toolInteraction('tu-plan', 'ExitPlanMode'), status: 'fail' as const }],
      rows: [],
    } as unknown as Parameters<typeof projectSessionView>[0]
    const v = projectSessionView(detail, { id: 's', title: 't', isLive: false })
    const block = v.turns[0].requests[0].blocks.find((b) => b.kind === 'tool_use') as ToolBlock
    expect(block.status).toBe('cancelled')
  })

  it('defaults `rows` to an empty array when the response omits it (legacy fixtures)', () => {
    const base = { ...buildMultiTurnDetail() }
    // Force the legacy shape: drop rows entirely.
    delete (base as { rows?: unknown }).rows
    const v = projectSessionView(base, { id: 's', title: 't', isLive: false })
    expect(v.rows).toEqual([])
  })
})
