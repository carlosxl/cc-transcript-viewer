import { resolveWeights, CACHE_MULTIPLIERS, type UsageSummary } from '@cc-viewer/shared'

const FALLBACK_MODEL = 'claude-sonnet-4-6'

/**
 * Best-effort dollar cost from a UsageSummary. The sidebar's SessionMeta only
 * carries aggregated tokens without a per-model breakdown, so we fall back to
 * a representative model. Detail views compute precise per-turn cost from
 * each request's actual `model` field (see useSessionView).
 */
export function costFromUsage(usage: UsageSummary | null | undefined, model = FALLBACK_MODEL): number {
  if (!usage) return 0
  const w = resolveWeights(model)
  if (!w) return 0
  const inTok = usage.inputTokens ?? 0
  const outTok = usage.outputTokens ?? 0
  const ccTok = usage.cacheCreationTokens ?? 0
  const crTok = usage.cacheReadTokens ?? 0
  return (
    (inTok * w.input +
      ccTok * w.input * CACHE_MULTIPLIERS.create5m +
      crTok * w.input * CACHE_MULTIPLIERS.read +
      outTok * w.output) /
    1_000_000
  )
}

export function tokensOf(usage: UsageSummary | null | undefined) {
  return {
    in: usage?.inputTokens ?? 0,
    out: usage?.outputTokens ?? 0,
    cc: usage?.cacheCreationTokens ?? 0,
    cr: usage?.cacheReadTokens ?? 0,
  }
}
