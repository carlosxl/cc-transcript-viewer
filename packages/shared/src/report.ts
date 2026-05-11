/**
 * Pure, deterministic builder for SessionReport — the data behind the token
 * consumption drawer. Lives in @cc-viewer/shared so the server, UI, and any
 * future CLI exporter compute the same numbers.
 */
import type {
  Session,
  Turn,
  SubagentRef,
  SessionReport,
  ReportRow,
  ReportTokenBreakdown,
  UsageBlock,
} from './types.js';
import { CACHE_MULTIPLIERS, resolveWeights } from './weights.js';

/** Empty token breakdown — used as accumulator seed. */
function emptyTokens(): ReportTokenBreakdown {
  return { input: 0, cacheCreate5m: 0, cacheCreate1h: 0, cacheRead: 0, output: 0 };
}

/**
 * Split a single UsageBlock into the five report categories.
 *
 * `cache_creation` sub-object (5m/1h split) is preferred when present.
 * If absent, the entire `cache_creation_input_tokens` falls under 5m (default TTL,
 * matches Anthropic's ephemeral default per prompt-caching docs).
 */
function splitUsage(u: UsageBlock): ReportTokenBreakdown {
  const create5m = u.cache_creation?.ephemeral_5m_input_tokens ?? 0;
  const create1h = u.cache_creation?.ephemeral_1h_input_tokens ?? 0;
  const hasSplit = u.cache_creation !== undefined;
  const total = u.cache_creation_input_tokens ?? 0;
  return {
    input: u.input_tokens ?? 0,
    cacheCreate5m: hasSplit ? create5m : total,
    cacheCreate1h: hasSplit ? create1h : 0,
    cacheRead: u.cache_read_input_tokens ?? 0,
    output: u.output_tokens ?? 0,
  };
}

function addTokens(into: ReportTokenBreakdown, add: ReportTokenBreakdown): void {
  into.input += add.input;
  into.cacheCreate5m += add.cacheCreate5m;
  into.cacheCreate1h += add.cacheCreate1h;
  into.cacheRead += add.cacheRead;
  into.output += add.output;
}

/** Per-category weighted units. Returns null if weights unknown for this model. */
function unitsByCategoryFor(
  model: string,
  tokens: ReportTokenBreakdown,
): ReportTokenBreakdown | null {
  const w = resolveWeights(model);
  if (!w) return null;
  return {
    input:         tokens.input         * w.input,
    cacheCreate5m: tokens.cacheCreate5m * w.input * CACHE_MULTIPLIERS.create5m,
    cacheCreate1h: tokens.cacheCreate1h * w.input * CACHE_MULTIPLIERS.create1h,
    cacheRead:     tokens.cacheRead     * w.input * CACHE_MULTIPLIERS.read,
    output:        tokens.output        * w.output,
  };
}

/** Sum the five per-category unit values into the row total. */
function sumUnits(u: ReportTokenBreakdown): number {
  return u.input + u.cacheCreate5m + u.cacheCreate1h + u.cacheRead + u.output;
}

/** Cache hit rate per the canonical formula. Null if denominator is 0. */
function hitRate(t: ReportTokenBreakdown): number | null {
  const denom = t.input + t.cacheCreate5m + t.cacheCreate1h + t.cacheRead;
  if (denom === 0) return null;
  return t.cacheRead / denom;
}

interface RowAccumulator {
  agentGroup: 'main' | string;
  model: string;
  tokens: ReportTokenBreakdown;
  /** Distinct subagent invocations contributing to this row (1 for main). */
  invocationIds: Set<string>;
}

/** Compose a stable composite key for the (group, model) bucket. */
function rowKey(group: 'main' | string, model: string): string {
  return `${group}\x00${model}`;
}

/**
 * Walk a Turn[] for one agent (main session, or a single subagent) and bucket
 * its assistant turns by model into the supplied accumulator map.
 *
 * `agentGroup` identifies the row group ('main' or agentType).
 * `invocationId` is added to each touched row's `invocationIds` so that
 * multiple subagents of the same type sharing a model collapse to one row
 * with the correct count.
 */
function accumulateAgent(
  turns: Turn[],
  agentGroup: 'main' | string,
  invocationId: string,
  acc: Map<string, RowAccumulator>,
): void {
  for (const t of turns) {
    if (t.role !== 'assistant' || !t.usage) continue;
    const model = t.model ?? '';
    const key = rowKey(agentGroup, model);
    let row = acc.get(key);
    if (!row) {
      row = { agentGroup, model, tokens: emptyTokens(), invocationIds: new Set() };
      acc.set(key, row);
    }
    addTokens(row.tokens, splitUsage(t.usage));
    row.invocationIds.add(invocationId);
  }
}

/** Count `tool_use` content blocks across an assistant Turn[]. */
function countToolUses(turns: Turn[]): number {
  let n = 0;
  for (const t of turns) {
    if (t.role === 'assistant') n += t.toolUses.length;
  }
  return n;
}

/** ms between first and last main-session turn timestamps. 0 when not computable. */
function computeDurationMs(turns: Turn[]): number {
  let first = '';
  let last = '';
  for (const t of turns) {
    if (!t.timestamp) continue;
    if (!first) first = t.timestamp;
    last = t.timestamp;
  }
  if (!first || !last) return 0;
  const a = Date.parse(first);
  const b = Date.parse(last);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.max(0, b - a);
}

/**
 * Sort rows: main first, then by descending row units (largest cost first).
 * Rows with unknown units sort to the end.
 */
function compareRows(a: ReportRow, b: ReportRow): number {
  if (a.agentGroup === 'main' && b.agentGroup !== 'main') return -1;
  if (b.agentGroup === 'main' && a.agentGroup !== 'main') return 1;
  const au = a.units ?? -1;
  const bu = b.units ?? -1;
  if (au !== bu) return bu - au;
  return a.agentGroup.localeCompare(b.agentGroup);
}

/**
 * Build a SessionReport from a loaded Session.
 *
 * Counts:
 *   - main agent turns → one row group keyed by 'main'.
 *   - each subagent → row group keyed by its agentType (multiple invocations of
 *     the same agentType + model collapse into a single row with invocationCount > 1).
 *
 * The function is pure; no I/O, no globals.
 */
export function buildSessionReport(session: Session): SessionReport {
  const acc = new Map<string, RowAccumulator>();

  // Main agent — single invocation, sentinel id ''.
  accumulateAgent(session.turns, 'main', '', acc);

  // Subagents — each contributes its agentId as the invocation id.
  for (const sa of session.subagents) {
    const group = sa.agentType || 'unknown';
    accumulateAgent(sa.turns, group, sa.agentId, acc);
  }

  // Materialize rows.
  const rows: ReportRow[] = [];
  const missingModels = new Set<string>();
  for (const row of acc.values()) {
    const unitsByCategory = unitsByCategoryFor(row.model, row.tokens);
    const w = resolveWeights(row.model);
    const units = unitsByCategory === null ? null : sumUnits(unitsByCategory);
    if (units === null && row.model) missingModels.add(row.model);
    rows.push({
      agentGroup: row.agentGroup,
      invocationCount: row.invocationIds.size || 1,
      model: row.model,
      tokens: row.tokens,
      cacheHitRate: hitRate(row.tokens),
      units,
      unitsByCategory,
      weights: w ? { input: w.input, output: w.output } : null,
    });
  }
  rows.sort(compareRows);

  // Aggregates.
  const unitsByUsageType = emptyTokens();
  let totalUnits = 0;
  const overall = emptyTokens();
  for (const r of rows) {
    addTokens(overall, r.tokens);
    if (r.unitsByCategory === null) continue;
    addTokens(unitsByUsageType, r.unitsByCategory);
    totalUnits += r.units!;
  }

  // Tool counts.
  const mainTools = countToolUses(session.turns);
  let subTools = 0;
  for (const sa of session.subagents) subTools += countToolUses(sa.turns);

  return {
    sessionId: session.sessionId,
    durationMs: computeDurationMs(session.turns),
    toolCalls: { main: mainTools, sub: subTools, total: mainTools + subTools },
    cacheHitRate: hitRate(overall),
    totalUnits,
    weightsMissing: missingModels.size > 0,
    missingModels: Array.from(missingModels).sort(),
    rows,
    unitsByUsageType,
  };
}
