/**
 * api_error retry-chain assembly (007-ui-information-revamp, T034).
 *
 * Walks the row stream and groups consecutive `system` rows with
 * `subtype:'api_error'` (`schema.ts:910-917`) into retry chains. The
 * chain terminates when:
 *   - a non-error row appears AFTER at least one api_error → outcome = 'success'
 *   - the stream ends → outcome = 'in_progress'
 *   - an api_error row carries the schema's `retryAttempt === maxRetries` → 'final_failure'
 *
 * The output is a per-row annotation map keyed by row uuid. The UI joins this
 * against the row stream at render time; no row mutation, no schema edit.
 *
 * Surfaced via the response as `derivedSystemEventChains` per the contract
 * (specs/007-ui-information-revamp/contracts/ui-backend.md §1.1 NOTE).
 */
import type { ClaudeRowOrUnknown } from '../jsonl/schema.js'

export type ChainOutcome = 'success' | 'final_failure' | 'in_progress'

export interface ApiErrorChainAnnotation {
  chainId: string
  retryIndex: number
  finalOutcome: ChainOutcome
}

export interface ApiErrorChainSummary {
  chainId: string
  retries: number
  finalOutcome: ChainOutcome
  /** uuid of the first api_error row in the chain (anchor for jump-to). */
  anchorRowUuid: string
  /** Timestamp of the first api_error row, when present. */
  anchorTimestamp?: string
}

export interface ApiErrorChainsProjection {
  /** Per-row annotation: rowUuid → { chainId, retryIndex, finalOutcome }. */
  annotations: Map<string, ApiErrorChainAnnotation>
  /** Chain rollup for the session-summary surface. */
  chains: ApiErrorChainSummary[]
}

interface RowShape {
  type?: unknown
  uuid?: unknown
  timestamp?: unknown
  subtype?: unknown
  maxRetries?: unknown
  retryAttempt?: unknown
}

function isApiError(r: RowShape): boolean {
  return r.type === 'system' && r.subtype === 'api_error'
}

function rowUuid(r: RowShape, fallbackIdx: number): string {
  return typeof r.uuid === 'string' && r.uuid.length > 0
    ? r.uuid
    : `__synth-row-${fallbackIdx}`
}

export function buildApiErrorChains(
  rows: readonly ClaudeRowOrUnknown[],
): ApiErrorChainsProjection {
  const annotations = new Map<string, ApiErrorChainAnnotation>()
  const chains: ApiErrorChainSummary[] = []

  let chainStart: number | null = null

  function finalize(endIdx: number, outcome: ChainOutcome): void {
    if (chainStart === null) return
    const first = rows[chainStart]!
    const firstShape = first as unknown as RowShape
    const chainId = rowUuid(firstShape, chainStart)
    const errorRows: RowShape[] = []
    for (let i = chainStart; i < endIdx; i++) {
      const cur = rows[i]! as unknown as RowShape
      if (!isApiError(cur)) continue
      errorRows.push(cur)
    }
    errorRows.forEach((er, retryIndex) => {
      const uuid = rowUuid(er, chainStart! + retryIndex)
      annotations.set(uuid, { chainId, retryIndex, finalOutcome: outcome })
    })
    chains.push({
      chainId,
      retries: errorRows.length,
      finalOutcome: outcome,
      anchorRowUuid: chainId,
      anchorTimestamp: typeof firstShape.timestamp === 'string' ? firstShape.timestamp : undefined,
    })
    chainStart = null
  }

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]! as unknown as RowShape
    if (isApiError(r)) {
      if (chainStart === null) chainStart = i
      // If the schema annotates `retryAttempt === maxRetries`, this row is the
      // final retry: terminate as final_failure once we see the chain ends.
      // We DON'T finalize here — the chain might still be followed by a
      // success row; the outcome reflects what actually happened next.
      continue
    }
    if (chainStart !== null) {
      // A non-error row after at least one api_error → chain succeeded.
      // Exception: if the last error in the run had retryAttempt === maxRetries,
      // we mark it final_failure even though something else followed.
      const lastError = rows[i - 1]! as unknown as RowShape
      const maxRetries = typeof lastError.maxRetries === 'number' ? lastError.maxRetries : null
      const retryAttempt = typeof lastError.retryAttempt === 'number' ? lastError.retryAttempt : null
      const reachedMax = maxRetries !== null && retryAttempt !== null && retryAttempt >= maxRetries
      finalize(i, reachedMax ? 'final_failure' : 'success')
    }
  }

  if (chainStart !== null) {
    // Stream ended mid-chain.
    finalize(rows.length, 'in_progress')
  }

  return { annotations, chains }
}
