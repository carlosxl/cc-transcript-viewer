import type { FileTouch, FileTouchIndex } from '@cc-viewer/shared'

function firstTouchTs(f: FileTouch): string {
  let earliest: string | null = null
  for (const r of f.reads) if (!earliest || r.timestamp < earliest) earliest = r.timestamp
  for (const w of f.writes) if (!earliest || w.timestamp < earliest) earliest = w.timestamp
  return earliest ?? ''
}

export function orderFilesForReport(files: FileTouch[]): FileTouch[] {
  return [...files].sort((a, b) => {
    const aAct = a.reads.length + a.writes.length
    const bAct = b.reads.length + b.writes.length
    if (aAct !== bAct) return bAct - aAct
    return firstTouchTs(a).localeCompare(firstTouchTs(b))
  })
}

function splitBasename(path: string): { dir: string; base: string } {
  const i = path.lastIndexOf('/')
  if (i < 0) return { dir: '', base: path }
  return { dir: path.slice(0, i + 1), base: path.slice(i + 1) }
}

interface FileRowProps {
  file: FileTouch
}

/** A horizontal timeline of read pips + write pips across the file's lifespan. */
function PipsTimeline({ file }: FileRowProps) {
  const pips = [
    ...file.reads.map((r) => ({ ts: r.timestamp, kind: 'read' as const })),
    ...file.writes.map((w) => ({ ts: w.timestamp, kind: 'write' as const })),
  ]
  if (pips.length === 0) return null
  const sorted = [...pips].sort((a, b) => a.ts.localeCompare(b.ts))
  const min = sorted[0]!.ts
  const max = sorted[sorted.length - 1]!.ts
  const minT = new Date(min).getTime()
  const maxT = new Date(max).getTime()
  const span = Math.max(maxT - minT, 1)
  return (
    <div className="relative h-2 flex-1 min-w-[60px] bg-muted/40 rounded-full overflow-hidden">
      {sorted.map((p, i) => {
        const t = new Date(p.ts).getTime()
        const pct = ((t - minT) / span) * 100
        return (
          <span
            key={`${p.ts}:${i}`}
            aria-hidden="true"
            className={
              p.kind === 'read'
                ? 'absolute top-0 h-2 w-1 -translate-x-1/2 bg-[var(--user-rail,theme(colors.blue.400))]'
                : 'absolute top-0 h-2 w-1 -translate-x-1/2 bg-primary'
            }
            style={{ left: `${pct}%` }}
          />
        )
      })}
    </div>
  )
}

function FileRow({ file }: FileRowProps) {
  const { dir, base } = splitBasename(file.path)
  const reads = file.reads.length
  const writes = file.writes.length
  const lineCount = file.lineCount
  return (
    <div className="flex items-center gap-2 py-1.5 text-xs border-b last:border-b-0">
      <span
        aria-hidden="true"
        className="font-mono text-[10px] text-muted-foreground shrink-0 select-none"
      >
        &lt;&gt;
      </span>
      <div className="min-w-0 flex-[2] truncate">
        {dir && <span className="text-muted-foreground">{dir}</span>}
        <span className="font-semibold">{base}</span>
      </div>
      {file.changed && (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded-sm text-[10px] font-semibold bg-primary/15 text-primary uppercase tracking-wide">
          CHANGED
        </span>
      )}
      <PipsTimeline file={file} />
      <div className="font-mono text-[10px] text-muted-foreground tabular-nums whitespace-nowrap">
        {reads}r · {writes}w{lineCount !== null ? ` · L ${lineCount}` : ''}
      </div>
    </div>
  )
}

interface SessionReportFilesTouchedProps {
  index: FileTouchIndex
}

export function SessionReportFilesTouched({ index }: SessionReportFilesTouchedProps) {
  const files = orderFilesForReport(index.files)
  const total = index.files.length
  return (
    <section aria-label="Files touched" className="flex flex-col gap-2">
      <h3 className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
        Files touched · {total}
      </h3>
      {total === 0 ? (
        <div className="text-xs text-muted-foreground">No files were read or written in this session.</div>
      ) : (
        <div className="rounded-md border bg-card px-2">
          {files.map((f) => <FileRow key={f.path} file={f} />)}
        </div>
      )}
    </section>
  )
}
