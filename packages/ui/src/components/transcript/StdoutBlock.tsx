import { Terminal } from 'lucide-react'
import type { Turn } from '@cc-viewer/shared'
import { classifyUserText } from '@/lib/classifyUserText'
import { formatTurnTimestamp } from '@/lib/format'

/**
 * Neutral-tinted block for user turns whose body is a standalone
 * `<local-command-stdout>` (no `<command-name>` wrapper). This is the shape
 * custom slash commands (e.g. `/nf-db`) use to write their output back into
 * the transcript — without this block they would mis-render as plain "You"
 * user prose.
 */
export function StdoutBlock({ turn }: { turn: Turn }) {
  const text = Array.isArray(turn.textBlocks) ? turn.textBlocks.join('\n\n') : ''
  const c = classifyUserText(text)
  const body =
    c.kind === 'stdout'
      ? c.text
      : c.kind === 'command' && c.stdout
        ? c.stdout
        : ''
  if (!body) return <></>
  const ts = formatTurnTimestamp(turn.timestamp)
  return (
    <div
      data-role="stdout"
      data-turn-uuid={turn.uuid}
      className="mx-4 my-1 px-3 py-2 rounded-md border border-border bg-[var(--surface-2)] font-mono text-xs whitespace-pre-wrap"
    >
      <div className="flex items-center gap-1.5 mb-1 font-sans text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Terminal className="w-3 h-3" aria-hidden="true" />
        <span>command output</span>
        <span className="flex-1" />
        {ts && (
          <time
            className="font-normal tabular-nums"
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
