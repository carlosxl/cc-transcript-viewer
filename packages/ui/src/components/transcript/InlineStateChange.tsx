/**
 * Renders one inline session-state change row (007-ui-information-revamp, T041).
 *
 * The three non-sticky session-state row types:
 *   - queue-operation  (schema.ts:1041)
 *   - pr-link          (schema.ts:1010)
 *   - file-history-snapshot (schema.ts:1051)
 *
 * file-history-snapshot lists the backed-up file paths with click handlers so a
 * parent can lazy-fetch the backup blob (FR-014, wired via the new endpoint
 * GET /api/sessions/:id/file-history/:backupFileName).
 *
 * Standalone for now — wired into the flat-row dispatcher in a follow-up
 * integration task.
 */
import type {
  PrLinkRow,
  QueueOperationRow,
  FileHistorySnapshotRow,
} from '@cc-viewer/shared'

type InlineStateRow = PrLinkRow | QueueOperationRow | FileHistorySnapshotRow

interface InlineStateChangeProps {
  row: InlineStateRow
  /** Called with the file path + backup metadata when the user clicks a file-history entry. */
  onFetchBackup?: (path: string, backup: { backupFileName: string; backupTime: string; version: number }) => void
}

export function InlineStateChange({ row, onFetchBackup }: InlineStateChangeProps) {
  if (row.type === 'pr-link') {
    return <PrLinkCard row={row} />
  }
  if (row.type === 'queue-operation') {
    return <QueueOpCard row={row} />
  }
  return <FileHistoryCard row={row} onFetchBackup={onFetchBackup} />
}

function PrLinkCard({ row }: { row: PrLinkRow }) {
  return (
    <div className="va-inline-state" data-kind="pr-link">
      <div className="va-inline-state-head">
        <span className="va-inline-state-type">PR opened</span>
      </div>
      <div className="va-inline-state-body">
        <span className="va-inline-state-meta">{row.prRepository} #{row.prNumber}</span>
        <a className="va-inline-state-link" href={row.prUrl} target="_blank" rel="noreferrer">
          {row.prUrl}
        </a>
      </div>
    </div>
  )
}

function QueueOpCard({ row }: { row: QueueOperationRow }) {
  return (
    <div className="va-inline-state" data-kind="queue-operation" data-op={row.operation}>
      <div className="va-inline-state-head">
        <span className="va-inline-state-type">queue · {row.operation}</span>
        {row.timestamp && <span className="va-inline-state-ts">{row.timestamp}</span>}
      </div>
      {row.content && (
        <div className="va-inline-state-body">
          <pre className="va-inline-state-snippet">{row.content}</pre>
        </div>
      )}
    </div>
  )
}

function FileHistoryCard({
  row,
  onFetchBackup,
}: {
  row: FileHistorySnapshotRow
  onFetchBackup?: InlineStateChangeProps['onFetchBackup']
}) {
  const entries = Object.entries(row.snapshot.trackedFileBackups)
  const withBackups = entries.filter(([, b]) => b.backupFileName !== null)
  return (
    <div className="va-inline-state" data-kind="file-history-snapshot">
      <div className="va-inline-state-head">
        <span className="va-inline-state-type">file backup</span>
        <span className="va-inline-state-ts">{row.snapshot.timestamp}</span>
      </div>
      <ul className="va-inline-state-files">
        {withBackups.map(([path, backup]) => (
          <li key={path}>
            <button
              type="button"
              className="va-inline-state-file"
              onClick={() => onFetchBackup?.(path, {
                backupFileName: backup.backupFileName!,
                backupTime: backup.backupTime,
                version: backup.version,
              })}
              title={`fetch backup v${backup.version}`}
            >
              <span className="path">{path}</span>
              <span className="version">v{backup.version}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
