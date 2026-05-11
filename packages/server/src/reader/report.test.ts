import { describe, it, expect } from 'vitest'
import { buildSessionReport, CACHE_MULTIPLIERS, MODEL_WEIGHTS } from '@cc-viewer/shared'
import type { Session, Turn, SubagentRef, UsageBlock } from '@cc-viewer/shared'

/** Build a minimal assistant turn carrying a usage block. */
function aTurn(
  partial: {
    timestamp?: string
    model?: string
    usage?: Partial<UsageBlock>
    toolUses?: number
    agentId?: string | null
  } = {},
): Turn {
  const usage: UsageBlock | undefined = partial.usage
    ? {
        input_tokens: 0,
        output_tokens: 0,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
        ...partial.usage,
      }
    : undefined
  return {
    uuid: `t-${Math.random().toString(36).slice(2, 8)}`,
    parentUuid: null,
    timestamp: partial.timestamp ?? '2026-05-01T00:00:00Z',
    role: 'assistant',
    textBlocks: [],
    thinkingBlocks: [],
    toolUses: Array.from({ length: partial.toolUses ?? 0 }, (_, i) => ({
      id: `tu-${i}`,
      name: 'Bash',
      input: {},
    })),
    toolResults: [],
    usage,
    model: partial.model,
    isMeta: false,
    agentId: partial.agentId ?? null,
  }
}

function session(turns: Turn[], subagents: SubagentRef[] = []): Session {
  return {
    sessionId: 's-1',
    projectSlug: '-p',
    projectPath: '/p',
    title: 't',
    firstTimestamp: turns[0]?.timestamp ?? '',
    lastTimestamp: turns[turns.length - 1]?.timestamp ?? '',
    messageCount: turns.length,
    isLive: false,
    hasSubagents: subagents.length > 0,
    totalUsage: { inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0, byAgent: { '': { inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0 } } },
    turns,
    subagents,
    parseWarnings: 0,
  }
}

function subagent(agentId: string, agentType: string, turns: Turn[]): SubagentRef {
  return {
    agentId,
    agentType,
    description: '',
    toolUseId: '',
    status: 'completed',
    turns,
    childAgentIds: [],
  }
}

describe('buildSessionReport', () => {
  it('returns an empty rows array and null hit rate for a session with no usage', () => {
    const r = buildSessionReport(session([
      { ...aTurn(), role: 'user', usage: undefined },
    ]))
    expect(r.rows).toEqual([])
    expect(r.cacheHitRate).toBeNull()
    expect(r.totalUnits).toBe(0)
    expect(r.weightsMissing).toBe(false)
  })

  it('groups main turns under a single row keyed by ("main", model)', () => {
    const r = buildSessionReport(session([
      aTurn({ model: 'claude-opus-4-7', usage: { input_tokens: 100, output_tokens: 50 } }),
      aTurn({ model: 'claude-opus-4-7', usage: { input_tokens: 200, output_tokens: 100 } }),
    ]))
    expect(r.rows).toHaveLength(1)
    expect(r.rows[0]!.agentGroup).toBe('main')
    expect(r.rows[0]!.model).toBe('claude-opus-4-7')
    expect(r.rows[0]!.tokens.input).toBe(300)
    expect(r.rows[0]!.tokens.output).toBe(150)
    expect(r.rows[0]!.invocationCount).toBe(1)
  })

  it('splits main into two rows when model changes mid-session', () => {
    const r = buildSessionReport(session([
      aTurn({ model: 'claude-opus-4-7', usage: { input_tokens: 100 } }),
      aTurn({ model: 'claude-sonnet-4-6', usage: { input_tokens: 100 } }),
    ]))
    const groups = r.rows.map((row) => `${row.agentGroup}:${row.model}`).sort()
    expect(groups).toEqual(['main:claude-opus-4-7', 'main:claude-sonnet-4-6'])
  })

  it('computes weighted units using the canonical formula', () => {
    const w = MODEL_WEIGHTS['claude-sonnet-4-6']!
    const r = buildSessionReport(session([
      aTurn({
        model: 'claude-sonnet-4-6',
        usage: {
          input_tokens: 1000,
          output_tokens: 500,
          cache_creation_input_tokens: 400, // → all to 5m bucket (no breakdown)
          cache_read_input_tokens: 2000,
        },
      }),
    ]))
    const expected =
      1000 * w.input +
      400 * w.input * CACHE_MULTIPLIERS.create5m +
      0 * w.input * CACHE_MULTIPLIERS.create1h +
      2000 * w.input * CACHE_MULTIPLIERS.read +
      500 * w.output
    expect(r.rows[0]!.units).toBeCloseTo(expected, 6)
    expect(r.totalUnits).toBeCloseTo(expected, 6)
  })

  it('honors the cache_creation 5m/1h breakdown when present', () => {
    const r = buildSessionReport(session([
      aTurn({
        model: 'claude-haiku-4-5',
        usage: {
          input_tokens: 0,
          output_tokens: 0,
          cache_creation_input_tokens: 300,
          cache_creation: { ephemeral_5m_input_tokens: 200, ephemeral_1h_input_tokens: 100 },
          cache_read_input_tokens: 0,
        },
      }),
    ]))
    expect(r.rows[0]!.tokens.cacheCreate5m).toBe(200)
    expect(r.rows[0]!.tokens.cacheCreate1h).toBe(100)
  })

  it('computes hit rate per canonical formula', () => {
    const r = buildSessionReport(session([
      aTurn({
        model: 'claude-opus-4-7',
        usage: {
          input_tokens: 100,
          cache_creation_input_tokens: 100,
          cache_read_input_tokens: 800,
        },
      }),
    ]))
    expect(r.rows[0]!.cacheHitRate).toBeCloseTo(800 / 1000, 6)
    expect(r.cacheHitRate).toBeCloseTo(800 / 1000, 6)
  })

  it('returns null hit rate when input + cache tokens all zero', () => {
    const r = buildSessionReport(session([
      aTurn({ model: 'claude-opus-4-7', usage: { output_tokens: 100 } }),
    ]))
    expect(r.rows[0]!.cacheHitRate).toBeNull()
  })

  it('collapses multiple subagents of the same type+model into one row with invocation count', () => {
    const turn = aTurn({ model: 'claude-haiku-4-5', usage: { input_tokens: 100 } })
    const r = buildSessionReport(session([], [
      subagent('a1', 'Explore', [turn]),
      subagent('a2', 'Explore', [turn]),
      subagent('a3', 'Explore', [turn]),
    ]))
    expect(r.rows).toHaveLength(1)
    expect(r.rows[0]!.agentGroup).toBe('Explore')
    expect(r.rows[0]!.invocationCount).toBe(3)
    expect(r.rows[0]!.tokens.input).toBe(300)
  })

  it('splits one agentType across rows when invocations use different models', () => {
    const r = buildSessionReport(session([], [
      subagent('a1', 'general-purpose', [aTurn({ model: 'claude-opus-4-7', usage: { input_tokens: 50 } })]),
      subagent('a2', 'general-purpose', [aTurn({ model: 'claude-sonnet-4-6', usage: { input_tokens: 50 } })]),
    ]))
    expect(r.rows).toHaveLength(2)
    expect(r.rows.map((x) => x.model).sort()).toEqual(['claude-opus-4-7', 'claude-sonnet-4-6'])
    for (const row of r.rows) expect(row.invocationCount).toBe(1)
  })

  it('flags unknown models with units=null and weightsMissing=true, lower-bound total', () => {
    const r = buildSessionReport(session([
      aTurn({ model: 'claude-opus-4-7', usage: { input_tokens: 100, output_tokens: 100 } }),
      aTurn({ model: 'open-source-llama-7b', usage: { input_tokens: 1_000_000, output_tokens: 1_000_000 } }),
    ]))
    expect(r.weightsMissing).toBe(true)
    expect(r.missingModels).toContain('open-source-llama-7b')
    const known = r.rows.find((x) => x.model === 'claude-opus-4-7')!
    const unknown = r.rows.find((x) => x.model === 'open-source-llama-7b')!
    expect(known.units).not.toBeNull()
    expect(unknown.units).toBeNull()
    expect(r.totalUnits).toBe(known.units!) // lower bound
  })

  it('counts tool uses across main and subagents separately', () => {
    const r = buildSessionReport(session(
      [aTurn({ toolUses: 5, usage: { input_tokens: 1 }, model: 'claude-opus-4-7' })],
      [subagent('a1', 'Explore', [aTurn({ toolUses: 3, usage: { input_tokens: 1 }, model: 'claude-haiku-4-5' })])],
    ))
    expect(r.toolCalls.main).toBe(5)
    expect(r.toolCalls.sub).toBe(3)
    expect(r.toolCalls.total).toBe(8)
  })

  it('computes durationMs as last-first main turn delta', () => {
    const r = buildSessionReport(session([
      aTurn({ timestamp: '2026-05-01T00:00:00Z', usage: { input_tokens: 1 }, model: 'claude-opus-4-7' }),
      aTurn({ timestamp: '2026-05-01T01:30:00Z', usage: { input_tokens: 1 }, model: 'claude-opus-4-7' }),
    ]))
    expect(r.durationMs).toBe(90 * 60 * 1000)
  })

  it('resolves snapshot model IDs (e.g. claude-opus-4-7-20260101) via prefix', () => {
    const r = buildSessionReport(session([
      aTurn({ model: 'claude-opus-4-7-20260101', usage: { input_tokens: 100, output_tokens: 100 } }),
    ]))
    expect(r.weightsMissing).toBe(false)
    expect(r.rows[0]!.units).not.toBeNull()
  })

  it('resolves the 1M-context variant ("[1m]") to 2× weights, not the bare prefix', () => {
    const r = buildSessionReport(session([
      aTurn({ model: 'claude-opus-4-7[1m]', usage: { input_tokens: 1000, output_tokens: 1000 } }),
    ]))
    expect(r.rows[0]!.weights).toEqual({ input: 30, output: 150 })
    // 1000 × 30 + 1000 × 150 = 30000 + 150000 = 180000
    expect(r.rows[0]!.units).toBeCloseTo(180_000, 6)
  })

  it('populates unitsByCategory per row consistently with units total', () => {
    const r = buildSessionReport(session([
      aTurn({
        model: 'claude-sonnet-4-6',
        usage: { input_tokens: 500, output_tokens: 200, cache_read_input_tokens: 1000 },
      }),
    ]))
    const row = r.rows[0]!
    expect(row.unitsByCategory).not.toBeNull()
    const ubc = row.unitsByCategory!
    const sum = ubc.input + ubc.cacheCreate5m + ubc.cacheCreate1h + ubc.cacheRead + ubc.output
    expect(sum).toBeCloseTo(row.units!, 6)
    expect(row.weights).toEqual({ input: 3, output: 15 })
  })

  it('sets unitsByCategory and weights to null when model weights are missing', () => {
    const r = buildSessionReport(session([
      aTurn({ model: 'open-source-llama-7b', usage: { input_tokens: 100, output_tokens: 100 } }),
    ]))
    expect(r.rows[0]!.unitsByCategory).toBeNull()
    expect(r.rows[0]!.weights).toBeNull()
  })

  it('resolves unitsByUsageType (footer) consistent with row sums', () => {
    const r = buildSessionReport(session([
      aTurn({
        model: 'claude-sonnet-4-6',
        usage: { input_tokens: 1000, output_tokens: 500, cache_read_input_tokens: 1000 },
      }),
    ]))
    const sumFooter =
      r.unitsByUsageType.input +
      r.unitsByUsageType.cacheCreate5m +
      r.unitsByUsageType.cacheCreate1h +
      r.unitsByUsageType.cacheRead +
      r.unitsByUsageType.output
    expect(sumFooter).toBeCloseTo(r.totalUnits, 6)
  })

  it('sorts rows: main first, then by descending units', () => {
    const r = buildSessionReport(session(
      [aTurn({ model: 'claude-opus-4-7', usage: { input_tokens: 100 } })],
      [
        subagent('a1', 'Explore', [aTurn({ model: 'claude-haiku-4-5', usage: { input_tokens: 50 } })]),
        subagent('a2', 'general-purpose', [aTurn({ model: 'claude-sonnet-4-6', usage: { input_tokens: 200 } })]),
      ],
    ))
    expect(r.rows[0]!.agentGroup).toBe('main')
    // After main, general-purpose should outrank Explore (Sonnet × 200 > Haiku × 50)
    expect(r.rows[1]!.agentGroup).toBe('general-purpose')
    expect(r.rows[2]!.agentGroup).toBe('Explore')
  })
})
