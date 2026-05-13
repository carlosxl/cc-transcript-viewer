import { AlertTriangle } from 'lucide-react'
import type { Turn } from '@cc-viewer/shared'
import { classifyUserText } from '@/lib/classifyUserText'
import { formatTurnTimestamp } from '@/lib/format'

/**
 * Phase 4: danger-tinted block for user turns whose body is dominated by
 * a `<local-command-stderr>` block. Visually echoes the design's stderr
 * surface (`workspace-app.jsx`).
 */
export function StderrBlock({ turn }: { turn: Turn }) {
  const text = Array.isArray(turn.textBlocks) ? turn.textBlocks.join('\n\n') : ''
  const c = classifyUserText(text)
  // Accept both classifier outcomes that carry stderr text — direct stderr
  // turns AND commands whose stderr field is non-empty.
  const body =
    c.kind === 'stderr'
      ? c.text
      : c.kind === 'command' && c.stderr
        ? c.stderr
        : ''
  if (!body) return <></>
  const ts = formatTurnTimestamp(turn.timestamp)
  return (
    <div
      data-role="stderr"
      data-turn-uuid={turn.uuid}
      className="mx-4 my-1 px-3 py-2 rounded-md border border-[var(--danger)] bg-[var(--danger-soft)] text-[var(--danger)] font-mono text-xs whitespace-pre-wrap"
    >
      <div className="flex items-center gap-1.5 mb-1 font-sans text-[11px] font-semibold uppercase tracking-wide">
        <AlertTriangle className="w-3 h-3" aria-hidden="true" />
        <span>stderr</span>
        <span className="flex-1" />
        {ts && (
          <time
            className="text-muted-foreground font-normal tabular-nums"
            dateTime={turn.timestamp}
            title={turn.timestamp}
          >
            {ts}
          </time>
        )}
      </div>
      {body}
    </div>
  )
}
