/**
 * Token weights — model-relative cost units (not dollars).
 *
 * Numbers happen to track current $/Mtok input/output rates so a downstream
 * "$ reference" toggle stays cheap, but they are labeled "units" because:
 *   1. Subscription users (Pro / Max) don't pay per-token; dollars are reference-
 *      only — what matters is stable quota burn comparable across price changes.
 *   2. The same scheme works for non-Anthropic models the user may run locally
 *      (give them { input: 0, output: 0 } and they contribute zero units).
 *
 * Update this file when Anthropic ships a new model or re-prices an existing one.
 */

export interface ModelWeights {
  /** Per-token weight applied to uncached input AND multiplied through cache multipliers. */
  input: number;
  /** Per-token weight applied to output tokens. */
  output: number;
}

/**
 * Universal cache multipliers, applied on top of `weights.input`.
 *   - 5m cache write: 1.25× input
 *   - 1h cache write: 2.00× input
 *   - cache read:     0.10× input
 * Source: https://platform.claude.com/docs/en/build-with-claude/prompt-caching
 */
export const CACHE_MULTIPLIERS = {
  create5m: 1.25,
  create1h: 2.0,
  read: 0.1,
} as const;

/**
 * Exact match lookup table. Keys are the `message.model` values Claude Code writes
 * into JSONL (e.g. "claude-opus-4-7"). Snapshot IDs like "claude-opus-4-7-20260101"
 * are resolved by prefix in `resolveWeights()`.
 */
export const MODEL_WEIGHTS: Record<string, ModelWeights> = {
  // Claude 4.x — long-context variants ([1m]). Claude Code annotates the model
  // ID with [1m] when the 1M-context window is active. Anthropic charges 2× for
  // both input and output on prompts >200K tokens on this tier — we apply 2×
  // unconditionally for [1m] sessions, treating it as a worst-case (callers
  // would otherwise need per-request tier classification we don't have).
  'claude-opus-4-7[1m]':   { input: 30, output: 150 },
  'claude-opus-4-5[1m]':   { input: 30, output: 150 },
  'claude-sonnet-4-6[1m]': { input:  6, output:  30 },
  'claude-sonnet-4-5[1m]': { input:  6, output:  30 },

  // Claude 4.x — current generation, standard context
  'claude-opus-4-7':   { input: 15, output: 75 },
  'claude-opus-4-5':   { input: 15, output: 75 },
  'claude-opus-4':     { input: 15, output: 75 },
  'claude-sonnet-4-6': { input:  3, output: 15 },
  'claude-sonnet-4-5': { input:  3, output: 15 },
  'claude-sonnet-4':   { input:  3, output: 15 },
  'claude-haiku-4-5':  { input:  1, output:  5 },
  'claude-haiku-4':    { input:  1, output:  5 },

  // Claude 3.x — legacy but may appear in older transcripts
  'claude-3-7-sonnet': { input:  3, output: 15 },
  'claude-3-5-sonnet': { input:  3, output: 15 },
  'claude-3-5-haiku':  { input:  0.8, output: 4 },
  'claude-3-opus':     { input: 15, output: 75 },
  'claude-3-sonnet':   { input:  3, output: 15 },
  'claude-3-haiku':    { input:  0.25, output: 1.25 },
};

/**
 * Resolve `model` (from JSONL) → weights.
 *
 * Strategy, in order:
 *   1. Exact match.
 *   2. Longest-prefix match (handles snapshot IDs like "claude-opus-4-7-20260101"
 *      AND ensures specific variants like "claude-opus-4-7[1m]" beat the bare
 *      "claude-opus-4-7" prefix — we sort candidate keys by length descending).
 *   3. null — caller surfaces this as `weightsMissing: true`.
 *
 * We intentionally avoid generic "contains opus/sonnet/haiku" matching:
 * silently mispricing a future model is worse than a visible "unknown" flag.
 */
export function resolveWeights(model: string | undefined): ModelWeights | null {
  if (!model) return null;
  const exact = MODEL_WEIGHTS[model];
  if (exact) return exact;
  // Sort keys by length descending so the most specific prefix wins.
  const candidates = Object.keys(MODEL_WEIGHTS).sort((a, b) => b.length - a.length);
  for (const key of candidates) {
    if (model.startsWith(key + '-') || model.startsWith(key)) {
      return MODEL_WEIGHTS[key]!;
    }
  }
  return null;
}
