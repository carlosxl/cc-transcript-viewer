import { describe, it, expect } from 'vitest';
import { buildTokenSeries } from './token-series.js';
import type { Turn, UsageBlock } from '../types.js';

function aTurn(
  uuid: string,
  model: string,
  usage: Partial<UsageBlock>,
): Turn {
  return {
    uuid,
    parentUuid: null,
    timestamp: '2026-05-12T00:00:00Z',
    role: 'assistant',
    textBlocks: [],
    thinkingBlocks: [],
    toolUses: [],
    toolResults: [],
    usage: {
      input_tokens: 0,
      output_tokens: 0,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
      ...usage,
    },
    model,
    isMeta: false,
    agentId: null,
  };
}

function userTurn(uuid: string): Turn {
  return {
    uuid,
    parentUuid: null,
    timestamp: '2026-05-12T00:00:00Z',
    role: 'user',
    textBlocks: ['hi'],
    thinkingBlocks: [],
    toolUses: [],
    toolResults: [],
    isMeta: false,
    agentId: null,
  };
}

describe('buildTokenSeries', () => {
  it('returns empty defaults for no assistant turns', () => {
    const s = buildTokenSeries([]);
    expect(s.points).toEqual([]);
    expect(s.byModel).toEqual([]);
    expect(s.spikes).toEqual([]);
    expect(s.cacheHitPct).toBe(0);
    expect(s.avgPerTurn).toBe(0);
  });

  it('skips user turns and turns without usage', () => {
    const s = buildTokenSeries([
      userTurn('u1'),
      aTurn('a1', 'm', { input_tokens: 10 }),
      { ...userTurn('u2'), role: 'assistant' as const, usage: undefined },
    ]);
    expect(s.points).toHaveLength(1);
    expect(s.points[0]!.turnUuid).toBe('a1');
    expect(s.points[0]!.turnIndex).toBe(0);
  });

  it('turnIndex is the assistant-turn ordinal', () => {
    const s = buildTokenSeries([
      aTurn('a1', 'm', { input_tokens: 1 }),
      userTurn('u1'),
      aTurn('a2', 'm', { input_tokens: 2 }),
    ]);
    expect(s.points.map((p) => p.turnIndex)).toEqual([0, 1]);
  });

  it('byModel groups, sums all four categories, and computes pct', () => {
    const s = buildTokenSeries([
      aTurn('a1', 'opus', { input_tokens: 100, output_tokens: 50 }),
      aTurn('a2', 'opus', { cache_read_input_tokens: 50 }),
      aTurn('a3', 'sonnet', { input_tokens: 100 }),
    ]);
    expect(s.byModel).toHaveLength(2);
    const opus = s.byModel.find((x) => x.model === 'opus')!;
    const sonnet = s.byModel.find((x) => x.model === 'sonnet')!;
    expect(opus.tokens).toBe(200);
    expect(sonnet.tokens).toBe(100);
    expect(opus.pct).toBeCloseTo(200 / 300, 6);
    expect(sonnet.pct).toBeCloseTo(100 / 300, 6);
    // byModel sorted by tokens desc
    expect(s.byModel[0]!.model).toBe('opus');
  });

  it('cacheHitPct matches read / (read + create + input)', () => {
    const s = buildTokenSeries([
      aTurn('a1', 'm', {
        input_tokens: 100,
        cache_creation_input_tokens: 100,
        cache_read_input_tokens: 800,
      }),
    ]);
    expect(s.cacheHitPct).toBeCloseTo(800 / 1000, 6);
  });

  it('avgPerTurn = mean of (input + output + cacheCreate)', () => {
    const s = buildTokenSeries([
      aTurn('a1', 'm', { input_tokens: 100, output_tokens: 100 }),
      aTurn('a2', 'm', { input_tokens: 100, output_tokens: 100 }),
    ]);
    expect(s.avgPerTurn).toBe(200);
  });

  describe('spike detection', () => {
    it('skips when fewer than 4 points', () => {
      const s = buildTokenSeries([
        aTurn('a1', 'm', { input_tokens: 10 }),
        aTurn('a2', 'm', { input_tokens: 10 }),
        aTurn('a3', 'm', { input_tokens: 1000 }),
      ]);
      expect(s.spikes).toEqual([]);
    });

    it('flags points > mean + 2σ', () => {
      const s = buildTokenSeries([
        aTurn('a1', 'm', { input_tokens: 100 }),
        aTurn('a2', 'm', { input_tokens: 100 }),
        aTurn('a3', 'm', { input_tokens: 100 }),
        aTurn('a4', 'm', { input_tokens: 100 }),
        aTurn('a5', 'm', { input_tokens: 100 }),
        aTurn('a6', 'm', { input_tokens: 50_000 }),
      ]);
      expect(s.spikes.length).toBeGreaterThan(0);
      expect(s.spikes[0]!.turnUuid).toBe('a6');
      expect(s.spikes[0]!.tokens).toBe(50_000);
    });

    it('caps reported spikes at 3', () => {
      const big = (uuid: string) => aTurn(uuid, 'm', { input_tokens: 10_000 });
      const small = (uuid: string) => aTurn(uuid, 'm', { input_tokens: 1 });
      // 4 small baseline, 5 big — stdev huge but all 5 will exceed threshold.
      // Top-3 by tokens reported.
      const s = buildTokenSeries([
        small('s1'),
        small('s2'),
        small('s3'),
        small('s4'),
        big('b1'),
        big('b2'),
        big('b3'),
        big('b4'),
        big('b5'),
      ]);
      expect(s.spikes.length).toBeLessThanOrEqual(3);
    });

    it('returns empty when all points equal (stdev=0)', () => {
      const s = buildTokenSeries([
        aTurn('a1', 'm', { input_tokens: 100 }),
        aTurn('a2', 'm', { input_tokens: 100 }),
        aTurn('a3', 'm', { input_tokens: 100 }),
        aTurn('a4', 'm', { input_tokens: 100 }),
      ]);
      expect(s.spikes).toEqual([]);
    });

    it('reason picks the dominant category', () => {
      const s = buildTokenSeries([
        aTurn('a1', 'm', { output_tokens: 10 }),
        aTurn('a2', 'm', { output_tokens: 10 }),
        aTurn('a3', 'm', { output_tokens: 10 }),
        aTurn('a4', 'm', { output_tokens: 10 }),
        aTurn('a5', 'm', { output_tokens: 10 }),
        aTurn('a6', 'm', { output_tokens: 50_000, input_tokens: 1 }),
      ]);
      expect(s.spikes[0]!.reason).toBe('high-output');
    });

    it('does not count cacheRead toward spike total', () => {
      const s = buildTokenSeries([
        aTurn('a1', 'm', { input_tokens: 10 }),
        aTurn('a2', 'm', { input_tokens: 10 }),
        aTurn('a3', 'm', { input_tokens: 10 }),
        aTurn('a4', 'm', { input_tokens: 10 }),
        aTurn('a5', 'm', { cache_read_input_tokens: 1_000_000 }),
      ]);
      expect(s.spikes).toEqual([]);
    });
  });
});
