import { ChevronRight } from 'lucide-react'
import type { Turn } from '@cc-viewer/shared'
import { classifyUserText } from '@/lib/classifyUserText'
import { formatTurnTimestamp } from '@/lib/format'

/**
 * Phase 4: dedicated visual for slash-command user turns
 * (`<command-name>/clear</command-name>` etc).
 *
 * Caller is responsible for emitting this only for turns whose joined text
 * classifies as `kind: 'command'` — it re-runs the classifier defensively
 * so that the component is self-contained for testing.
 */
export function CommandBlock({ turn }: { turn: Turn }) {
  const text = Array.isArray(turn.textBlocks) ? turn.textBlocks.join('\n\n') : ''
  const c = classifyUserText(text)
  if (c.kind !== 'command') return <></>
  const ts = formatTurnTimestamp(turn.timestamp)
  return (
    <div
      data-role="command"
      data-turn-uuid={turn.uuid}
      className="mx-4 my-1 px-3 py-2 rounded-md border border-border bg-[var(--surface-2)] flex items-baseline gap-2 font-mono"
    >
      <ChevronRight className="w-3 h-3 text-primary self-center flex-shrink-0" aria-hidden="true" />
      <span className="text-xs font-semibold text-primary">{c.name}</span>
      {c.args && <span className="text-xs text-muted-foreground truncate">{c.args}</span>}
      <span className="flex-1" />
      {ts && (
        <time
          className="text-[10px] text-muted-foreground tabular-nums flex-shrink-0"
          dateTime={turn.timestamp}
          title={turn.timestamp}
        >
          {ts}
        </time>
      )}
    </div>
  )
}
