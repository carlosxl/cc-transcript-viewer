import { useCallback, useMemo, useState } from 'react'
import { FolderOpen, FileCode } from 'lucide-react'
import type { FileTouch } from '@cc-viewer/shared'
import { useActiveQuery } from '@/hooks/useActiveQuery'
import { useSearchStore } from '@/stores/useSearchStore'
import { FileTimeline } from '../charts/FileTimeline'
import { cn } from '@/lib/utils'

/**
 * Files tab body. Reads `fileTouchIndex` (Phase 2 projection) for whichever
 * entry is active and renders one card per touched file:
 *
 *   - basename + full path (mono, truncated, full path as title)
 *   - "CHANGED" pill when any Edit/Write/MultiEdit/NotebookEdit hit the path
 *   - Read/Write timeline (SVG-like markers; click → jump to turn)
 *   - footer: N reads · M writes · L lines (when known)
 *
 * Sort order is decided server-side (Phase 2: most-recent first then most-writes).
 * Provides a "Changed only" filter toggle.
 */
export function FilesPanel() {
  const { fileTouchIndex, turns, sessionId, agentId } = useActiveQuery()
  const requestJump = useSearchStore((s) => s.requestJump)
  const [changedOnly, setChangedOnly] = useState(false)

  const onJumpToTurn = useCallback(
    (turnUuid: string) => {
      if (!sessionId) return
      requestJump({ sessionId, agentId, turnUuid })
    },
    [sessionId, agentId, requestJump],
  )

  const sessionWindow = useMemo(() => {
    if (!turns || turns.length === 0) return { startMs: 0, endMs: 1 }
    const first = Date.parse(turns[0]!.timestamp)
    const last = Date.parse(turns[turns.length - 1]!.timestamp)
    const startMs = Number.isFinite(first) ? first : 0
    const endMs = Number.isFinite(last) ? last : startMs + 1
    return { startMs, endMs: endMs > startMs ? endMs : startMs + 1 }
  }, [turns])

  if (!fileTouchIndex) return <Empty />
  const all = fileTouchIndex.files
  const visible = changedOnly ? all.filter((f) => f.changed) : all
  const changedCount = all.reduce((n, f) => n + (f.changed ? 1 : 0), 0)

  if (all.length === 0) {
    return (
      <Empty
        title="No files touched"
        body="No Read, Edit, Write, MultiEdit, or NotebookEdit calls in this entry."
      />
    )
  }

  return (
    <div className="h-full overflow-auto px-4 py-4 bg-[var(--surface-inset)]">
      <div className="flex items-baseline justify-between mb-3">
        <div className="text-[13px] font-semibold text-foreground">Files touched</div>
        <div className="font-mono text-[10.5px] text-muted-foreground">
          {visible.length} of {all.length}
        </div>
      </div>

      <div className="mb-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setChangedOnly((v) => !v)}
          aria-pressed={changedOnly}
          className={cn(
            'inline-flex items-center gap-1.5 h-6 px-2 text-[11px] rounded-sm border',
            changedOnly
              ? 'border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand-text)] font-semibold'
              : 'border-border bg-[var(--surface-2)] text-muted-foreground hover:text-foreground',
          )}
        >
          Changed only
          <span className="font-mono text-[10px]">{changedCount}</span>
        </button>
      </div>

      {visible.length === 0 ? (
        <div className="text-[11px] text-muted-foreground py-4 text-center">
          No matching files.
        </div>
      ) : (
        <div className="grid gap-2">
          {visible.map((f) => (
            <FileCard
              key={f.path}
              file={f}
              startMs={sessionWindow.startMs}
              endMs={sessionWindow.endMs}
              onJump={onJumpToTurn}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface FileCardProps {
  file: FileTouch
  startMs: number
  endMs: number
  onJump: (turnUuid: string) => void
}

function FileCard({ file, startMs, endMs, onJump }: FileCardProps) {
  const slash = file.path.lastIndexOf('/')
  const basename = slash === -1 ? file.path : file.path.slice(slash + 1)
  const dir = slash === -1 ? '' : file.path.slice(0, slash + 1)
  const reads = file.reads.length
  const writes = file.writes.length

  return (
    <div className="rounded-md border border-border bg-[var(--surface-2)] px-3 py-2.5">
      <div className="flex items-center gap-2 mb-2 min-w-0">
        <FileCode className="w-3 h-3 text-muted-foreground flex-shrink-0" aria-hidden="true" />
        <span
          className="font-mono text-[12px] text-foreground flex-1 min-w-0 truncate"
          title={file.path}
        >
          {dir && (
            <span className="text-muted-foreground">{dir}</span>
          )}
          <span className="font-semibold">{basename}</span>
        </span>
        {file.changed && (
          <span className="text-[10px] font-semibold uppercase tracking-wide bg-[var(--diff-add-bg)] text-[var(--diff-add-text)] px-1.5 py-px rounded">
            Changed
          </span>
        )}
      </div>
      <FileTimeline
        reads={file.reads}
        writes={file.writes}
        startMs={startMs}
        endMs={endMs}
        onJump={onJump}
      />
      <div className="flex gap-3 mt-2 font-mono text-[10.5px] text-muted-foreground">
        <span>{reads} {reads === 1 ? 'read' : 'reads'}</span>
        <span>{writes} {writes === 1 ? 'write' : 'writes'}</span>
        {file.lineCount !== null && <span>L {file.lineCount}</span>}
      </div>
    </div>
  )
}

function Empty({
  title = 'No file data',
  body = 'Files panel appears once Read/Edit/Write activity is recorded.',
}: { title?: string; body?: string } = {}) {
  return (
    <div
      role="status"
      aria-label={title}
      className="h-full flex flex-col items-center justify-center text-center px-8 gap-2 text-muted-foreground"
    >
      <FolderOpen className="w-5 h-5 text-[var(--text-4)]" aria-hidden="true" />
      <div className="text-sm font-semibold text-[var(--text-2)]">{title}</div>
      <div className="text-xs max-w-[260px]">{body}</div>
    </div>
  )
}
