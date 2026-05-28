/**
 * Renders an AgentRollupResult sidecar (007-ui-information-revamp, T025).
 *
 * Two display modes:
 *   - chip — compact one-line summary next to the parent's Agent tool_use header
 *     (used by T029 to satisfy FR-012: rollup visible without drill-in)
 *   - expanded — full toolStats breakdown (used inside BlockToolResult's
 *     structured-sidecar tab)
 *
 * Schema source: packages/shared/src/jsonl/schema.ts:400-424
 */
import type { AgentRollupResult } from '@cc-viewer/shared'

interface BlockAgentRollupProps {
  rollup: AgentRollupResult
  mode?: 'chip' | 'expanded'
}

export function BlockAgentRollup({ rollup, mode = 'expanded' }: BlockAgentRollupProps) {
  if (mode === 'chip') return <AgentRollupChip rollup={rollup} />
  return <AgentRollupExpanded rollup={rollup} />
}

function AgentRollupChip({ rollup }: { rollup: AgentRollupResult }) {
  const dur = formatDuration(rollup.totalDurationMs)
  const stats = rollup.toolStats
  const parts: string[] = []
  if (dur) parts.push(dur)
  parts.push(`${formatTokens(rollup.totalTokens)} tok`)
  if (typeof rollup.totalToolUseCount === 'number') {
    parts.push(`${rollup.totalToolUseCount} tools`)
  } else if (stats) {
    const total = stats.readCount + stats.searchCount + stats.bashCount + stats.editFileCount + stats.otherToolCount
    parts.push(`${total} tools`)
  }
  return (
    <span className="va-agent-rollup-chip" data-status={rollup.status}>
      <span className="va-agent-rollup-type">{rollup.agentType}</span>
      <span className="sep">·</span>
      <span>{parts.join(' · ')}</span>
    </span>
  )
}

function AgentRollupExpanded({ rollup }: { rollup: AgentRollupResult }) {
  const stats = rollup.toolStats
  return (
    <div className="va-agent-rollup">
      <div className="va-agent-rollup-head">
        <span className="va-agent-rollup-type">{rollup.agentType}</span>
        <span className="sep">·</span>
        <span className="status" data-status={rollup.status}>{rollup.status}</span>
      </div>
      <dl className="va-agent-rollup-grid">
        <dt>Duration</dt>
        <dd>{formatDuration(rollup.totalDurationMs) ?? '—'}</dd>
        <dt>Total tokens</dt>
        <dd>{formatTokens(rollup.totalTokens)}</dd>
        {typeof rollup.totalToolUseCount === 'number' && (
          <>
            <dt>Tool calls</dt>
            <dd>{rollup.totalToolUseCount}</dd>
          </>
        )}
        {stats && (
          <>
            <dt>Reads</dt>      <dd>{stats.readCount}</dd>
            <dt>Searches</dt>   <dd>{stats.searchCount}</dd>
            <dt>Bash</dt>       <dd>{stats.bashCount}</dd>
            <dt>File edits</dt> <dd>{stats.editFileCount}</dd>
            <dt>+lines</dt>     <dd>+{stats.linesAdded}</dd>
            <dt>−lines</dt>     <dd>−{stats.linesRemoved}</dd>
            <dt>Other tools</dt><dd>{stats.otherToolCount}</dd>
          </>
        )}
      </dl>
    </div>
  )
}

function formatDuration(ms: number): string | null {
  if (!Number.isFinite(ms) || ms <= 0) return null
  if (ms < 1000) return `${ms}ms`
  const s = Math.round(ms / 100) / 10
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const rem = Math.round(s - m * 60)
  return `${m}m${rem}s`
}

function formatTokens(n: number): string {
  if (n < 1000) return String(n)
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k`
  return `${(n / 1_000_000).toFixed(2)}M`
}
