/**
 * Session-summary surface (007-ui-information-revamp, T044).
 *
 * Pure presentational component over a `SessionSummary` projection
 * (`packages/shared/src/projections/session-summary.ts`). Renders:
 *   - token totals with cache split (FR-015, FR-016, SC-004, SC-005)
 *   - cache hit rate
 *   - files-touched list with optional click-to-fetch backup blobs (FR-014)
 *   - PR link list
 *   - queue operations
 *   - api_error retry-chain count card (FR-017)
 *   - harness-state transitions timeline
 *
 * Each entry that has a source-row location calls `onJumpToTurn(turnId)` so the
 * parent can switch back to the transcript view at the originating Turn (FR-026).
 *
 * Standalone for now — wired into the in-flight UI shell in a follow-up
 * integration task.
 */
import type {
  SessionSummary,
  SessionSummaryFile,
  SessionSummaryPrLink,
  SessionSummaryQueueOp,
  HarnessStateTransition,
  ApiErrorChainSummary,
} from '@cc-viewer/shared'

interface SessionSummaryProps {
  summary: SessionSummary
  /** Called when the user clicks an entry with a known source Turn. */
  onJumpToTurn?: (turnId: string) => void
  /** Called when the user clicks a backup file entry; parent issues the fetch. */
  onFetchBackup?: (sessionId: string, backupFileName: string) => void
  /** The sessionId — needed for the backup-fetch URL the parent constructs. */
  sessionId: string
}

export function SessionSummary({
  summary,
  onJumpToTurn,
  onFetchBackup,
  sessionId,
}: SessionSummaryProps) {
  return (
    <div className="va-session-summary">
      <TokensCard summary={summary} />
      <FilesCard
        files={summary.files}
        sessionId={sessionId}
        onJumpToTurn={onJumpToTurn}
        onFetchBackup={onFetchBackup}
      />
      <PrLinksCard prLinks={summary.prLinks} />
      <QueueOpsCard ops={summary.queueOperations} />
      <ApiErrorChainsCard chains={summary.apiErrorChains} onJumpToTurn={onJumpToTurn} />
      <HarnessStateCard transitions={summary.harnessStateTransitions} onJumpToTurn={onJumpToTurn} />
    </div>
  )
}

function TokensCard({ summary }: { summary: SessionSummary }) {
  const t = summary.tokens
  const pct = (t.cacheHitRate * 100).toFixed(1)
  return (
    <section className="va-summary-card" data-card="tokens">
      <h2 className="va-summary-title">Tokens</h2>
      <dl className="va-summary-grid">
        <dt>Input</dt>          <dd>{formatTokens(t.inputTotal)}</dd>
        <dt>Output</dt>         <dd>{formatTokens(t.outputTotal)}</dd>
        <dt>Cache creation</dt> <dd>{formatTokens(t.cacheCreationTotal)}</dd>
        <dt>Cache read</dt>     <dd>{formatTokens(t.cacheReadTotal)}</dd>
        <dt>Cache hit rate</dt> <dd>{pct}%</dd>
        <dt>Messages counted</dt><dd>{t.countedMessageIds.size}</dd>
      </dl>
    </section>
  )
}

function FilesCard({
  files,
  sessionId,
  onJumpToTurn,
  onFetchBackup,
}: {
  files: SessionSummaryFile[]
  sessionId: string
  onJumpToTurn?: (turnId: string) => void
  onFetchBackup?: (sessionId: string, backupFileName: string) => void
}) {
  if (files.length === 0) return null
  return (
    <section className="va-summary-card" data-card="files">
      <h2 className="va-summary-title">Files touched ({files.length})</h2>
      <ul className="va-summary-files">
        {files.map((f) => (
          <li key={f.path} className="va-summary-file" data-changed={f.changed}>
            <button
              type="button"
              className="va-summary-file-path"
              disabled={!f.firstTurnUuid || !onJumpToTurn}
              onClick={() => f.firstTurnUuid && onJumpToTurn?.(f.firstTurnUuid)}
              title={f.firstTurnUuid ? 'jump to first touch' : ''}
            >
              {f.path}
            </button>
            <span className="va-summary-file-counts">
              {f.reads > 0 && <span>R{f.reads}</span>}
              {f.writes > 0 && <span>W{f.writes}</span>}
            </span>
            {f.backups.length > 0 && (
              <ul className="va-summary-file-backups">
                {f.backups.map((b) => (
                  <li key={b.backupFileName}>
                    <button
                      type="button"
                      className="va-summary-backup"
                      onClick={() => onFetchBackup?.(sessionId, b.backupFileName)}
                      title={`fetch backup v${b.version}`}
                    >
                      v{b.version}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

function PrLinksCard({ prLinks }: { prLinks: SessionSummaryPrLink[] }) {
  if (prLinks.length === 0) return null
  return (
    <section className="va-summary-card" data-card="pr-links">
      <h2 className="va-summary-title">PR links</h2>
      <ul className="va-summary-pr-links">
        {prLinks.map((p) => (
          <li key={p.rowUuid}>
            <a href={p.prUrl} target="_blank" rel="noreferrer">
              {p.prRepository} #{p.prNumber}
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}

function QueueOpsCard({ ops }: { ops: SessionSummaryQueueOp[] }) {
  if (ops.length === 0) return null
  return (
    <section className="va-summary-card" data-card="queue-ops">
      <h2 className="va-summary-title">Queue operations ({ops.length})</h2>
      <ul className="va-summary-queue">
        {ops.map((q) => (
          <li key={q.rowUuid} data-op={q.operation}>
            <span className="op">{q.operation}</span>
            {q.content && <span className="content">{q.content}</span>}
          </li>
        ))}
      </ul>
    </section>
  )
}

function ApiErrorChainsCard({
  chains,
  onJumpToTurn,
}: {
  chains: ApiErrorChainSummary[]
  onJumpToTurn?: (turnId: string) => void
}) {
  if (chains.length === 0) return null
  return (
    <section className="va-summary-card" data-card="api-errors">
      <h2 className="va-summary-title">API error chains ({chains.length})</h2>
      <ul className="va-summary-chains">
        {chains.map((c) => (
          <li key={c.chainId} data-outcome={c.finalOutcome}>
            <button
              type="button"
              className="va-summary-chain-link"
              disabled={!onJumpToTurn}
              onClick={() => onJumpToTurn?.(c.anchorRowUuid)}
            >
              {c.retries} retries · {c.finalOutcome}
            </button>
            {c.anchorTimestamp && <span className="ts">{c.anchorTimestamp}</span>}
          </li>
        ))}
      </ul>
    </section>
  )
}

function HarnessStateCard({
  transitions,
  onJumpToTurn,
}: {
  transitions: HarnessStateTransition[]
  onJumpToTurn?: (turnId: string) => void
}) {
  if (transitions.length === 0) return null
  return (
    <section className="va-summary-card" data-card="harness-state">
      <h2 className="va-summary-title">Harness state transitions ({transitions.length})</h2>
      <ul className="va-summary-transitions">
        {transitions.map((t, i) => (
          <li key={i}>
            <button
              type="button"
              className="va-summary-transition-link"
              disabled={!onJumpToTurn}
              onClick={() => onJumpToTurn?.(t.turnId)}
            >
              <span className="field">{t.field}</span>
              <span className="arrow">→</span>
              <span className="to">{formatStickyValue(t.to)}</span>
            </button>
            <span className="from">(from {formatStickyValue(t.from)})</span>
            {t.ts && <span className="ts">{t.ts}</span>}
          </li>
        ))}
      </ul>
    </section>
  )
}

function formatTokens(n: number): string {
  if (n < 1000) return String(n)
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k`
  return `${(n / 1_000_000).toFixed(2)}M`
}

function formatStickyValue(v: unknown): string {
  if (v === null) return '∅'
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v)
  return JSON.stringify(v)
}
