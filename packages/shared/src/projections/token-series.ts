/**
 * Per-assistant-turn token telemetry for the Tokens right-rail panel.
 *
 * Pure, deterministic, no I/O. One pass over `turns`.
 */
import type {
  Turn,
  TokenPoint,
  TokenSeries,
  TokenSpike,
} from '../types.js';

/** Minimum points needed before spike detection produces results. */
const SPIKE_MIN_POINTS = 4;
const SPIKE_MAX_REPORTED = 3;
const SPIKE_SIGMA = 2;

export function buildTokenSeries(turns: Turn[]): TokenSeries {
  const points = collectPoints(turns);
  return {
    points,
    byModel: byModel(points),
    spikes: detectSpikes(points),
    cacheHitPct: cacheHitPct(points),
    avgPerTurn: avgPerTurn(points),
  };
}

function collectPoints(turns: Turn[]): TokenPoint[] {
  const out: TokenPoint[] = [];
  let idx = 0;
  for (const t of turns) {
    if (t.role !== 'assistant' || !t.usage) continue;
    const u = t.usage;
    out.push({
      turnUuid: t.uuid,
      turnIndex: idx++,
      model: t.model ?? '',
      input: u.input_tokens ?? 0,
      output: u.output_tokens ?? 0,
      cacheCreate: u.cache_creation_input_tokens ?? 0,
      cacheRead: u.cache_read_input_tokens ?? 0,
    });
  }
  return out;
}

function byModel(points: TokenPoint[]): TokenSeries['byModel'] {
  const sums = new Map<string, number>();
  let grand = 0;
  for (const p of points) {
    const tot = p.input + p.output + p.cacheCreate + p.cacheRead;
    sums.set(p.model, (sums.get(p.model) ?? 0) + tot);
    grand += tot;
  }
  const rows = Array.from(sums, ([model, tokens]) => ({
    model,
    tokens,
    pct: grand === 0 ? 0 : tokens / grand,
  }));
  rows.sort((a, b) => b.tokens - a.tokens);
  return rows;
}

function detectSpikes(points: TokenPoint[]): TokenSpike[] {
  if (points.length < SPIKE_MIN_POINTS) return [];
  // Cache-read is largely a cost-discount so we exclude it from the spike
  // metric — Tokens panel cares about expensive turns, not cache hits.
  const totals = points.map((p) => p.input + p.output + p.cacheCreate);
  const mean = totals.reduce((a, b) => a + b, 0) / totals.length;
  const variance =
    totals.reduce((a, b) => a + (b - mean) * (b - mean), 0) / totals.length;
  const stdev = Math.sqrt(variance);
  if (stdev === 0) return [];

  const threshold = mean + SPIKE_SIGMA * stdev;
  const candidates: { idx: number; total: number }[] = [];
  for (let i = 0; i < totals.length; i++) {
    if (totals[i]! > threshold) candidates.push({ idx: i, total: totals[i]! });
  }
  candidates.sort((a, b) => b.total - a.total);
  return candidates.slice(0, SPIKE_MAX_REPORTED).map(({ idx, total }) => {
    const p = points[idx]!;
    return {
      turnUuid: p.turnUuid,
      tokens: total,
      reason: dominantReason(p),
    };
  });
}

function dominantReason(p: TokenPoint): TokenSpike['reason'] {
  const { input, output, cacheCreate } = p;
  if (output >= input && output >= cacheCreate) return 'high-output';
  if (cacheCreate >= input && cacheCreate >= output) return 'high-cache-create';
  return 'high-input';
}

function cacheHitPct(points: TokenPoint[]): number {
  let read = 0;
  let create = 0;
  let input = 0;
  for (const p of points) {
    read += p.cacheRead;
    create += p.cacheCreate;
    input += p.input;
  }
  const denom = read + create + input;
  return denom === 0 ? 0 : read / denom;
}

function avgPerTurn(points: TokenPoint[]): number {
  if (points.length === 0) return 0;
  let sum = 0;
  for (const p of points) sum += p.input + p.output + p.cacheCreate;
  return sum / points.length;
}
