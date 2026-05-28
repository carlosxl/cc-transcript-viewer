/**
 * Renders one system event row (007-ui-information-revamp, T033 / T035).
 *
 * Dispatcher over the 6 `system` row subtypes documented in
 * packages/shared/src/jsonl/schema.ts:910-917. `api_error` rows render as part
 * of a connected retry-chain card when accompanied by chain annotations from
 * `buildApiErrorChains` (T034) — they're flagged here via the `chainOutcome`
 * prop so the dispatcher can colour the card accordingly. Full chain-grouped
 * rendering (one card spanning multiple rows) is wired in by the flat-row
 * builder in a follow-up.
 */
import type { SystemRow, ApiErrorChainAnnotation } from '@cc-viewer/shared'

interface SystemEventRowProps {
  row: SystemRow
  /** Optional retry-chain context from buildApiErrorChains. */
  chain?: ApiErrorChainAnnotation
}

export function SystemEventRow({ row, chain }: SystemEventRowProps) {
  const subtype = row.subtype
  return (
    <div className="va-system-event" data-subtype={subtype}>
      <div className="va-system-event-head">
        <span className="va-system-event-type">{subtype}</span>
        {row.timestamp && <span className="va-system-event-ts">{row.timestamp}</span>}
      </div>
      <SystemEventBody row={row} chain={chain} />
    </div>
  )
}

function SystemEventBody({ row, chain }: { row: SystemRow; chain?: ApiErrorChainAnnotation }) {
  // SystemRow is open-shape (passthrough); read fields by name.
  const r = row as unknown as Record<string, unknown>
  switch (row.subtype) {
    case 'api_error': {
      const msg = typeof r.error === 'string'
        ? r.error
        : typeof (r.error as { message?: unknown })?.message === 'string'
          ? ((r.error as { message: string }).message)
          : typeof r.content === 'string'
            ? r.content
            : ''
      const maxRetries = typeof r.maxRetries === 'number' ? r.maxRetries : null
      const retryAttempt = typeof r.retryAttempt === 'number' ? r.retryAttempt : null
      return (
        <div className="va-system-event-body" data-outcome={chain?.finalOutcome}>
          {chain && (
            <div className="va-system-event-chain">
              retry {chain.retryIndex + 1}
              {maxRetries !== null && ` of ${maxRetries}`}
              {chain.finalOutcome && ` · ${chain.finalOutcome}`}
            </div>
          )}
          {!chain && retryAttempt !== null && maxRetries !== null && (
            <div className="va-system-event-chain">
              retry {retryAttempt + 1} of {maxRetries}
            </div>
          )}
          <pre className="va-system-event-message">{msg}</pre>
        </div>
      )
    }
    case 'stop_hook_summary': {
      const hookCount = typeof r.hookCount === 'number' ? r.hookCount : null
      const stopReason = typeof r.stopReason === 'string' ? r.stopReason : null
      const prevented = r.preventedContinuation === true
      return (
        <div className="va-system-event-body">
          {hookCount !== null && <span className="va-system-event-meta">hooks: {hookCount}</span>}
          {stopReason && <span className="va-system-event-meta">reason: {stopReason}</span>}
          {prevented && <span className="va-system-event-meta va-system-event-bad">blocked continuation</span>}
        </div>
      )
    }
    case 'away_summary':
    case 'informational':
    case 'local_command': {
      const content = typeof r.content === 'string' ? r.content : ''
      return (
        <div className="va-system-event-body">
          <pre className="va-system-event-message">{content}</pre>
        </div>
      )
    }
    case 'compact_boundary': {
      const meta = r.compactMetadata as
        | { trigger?: string; preTokens?: number; postTokens?: number; durationMs?: number }
        | undefined
      const content = typeof r.content === 'string' ? r.content : 'Conversation compacted'
      return (
        <div className="va-system-event-body">
          <div className="va-system-event-message">{content}</div>
          {meta && (
            <div className="va-system-event-chain">
              {meta.trigger && <span className="va-system-event-meta">trigger: {meta.trigger}</span>}
              {typeof meta.preTokens === 'number' && (
                <span className="va-system-event-meta">{meta.preTokens.toLocaleString()} → {(meta.postTokens ?? 0).toLocaleString()} tokens</span>
              )}
              {typeof meta.durationMs === 'number' && (
                <span className="va-system-event-meta">in {formatDuration(meta.durationMs)}</span>
              )}
            </div>
          )}
        </div>
      )
    }
    default:
      return (
        <div className="va-system-event-body">
          <pre className="va-system-event-message">{JSON.stringify(row, null, 2)}</pre>
        </div>
      )
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const s = Math.round(ms / 100) / 10
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const rem = Math.round(s - m * 60)
  return `${m}m${rem}s`
}
