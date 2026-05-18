import { User } from 'lucide-react'
import type { Turn } from '@cc-viewer/shared'
import { ContentPreview } from './ContentPreview'
import { formatTurnTimestamp } from '@/lib/format'
import { classifyUserText } from '@/lib/classifyUserText'
import { CommandBlock } from './CommandBlock'
import { StderrBlock } from './StderrBlock'
import { StdoutBlock } from './StdoutBlock'

/**
 * Phase 4 redesign — round avatar with user-tint, mono timestamp baseline.
 *
 * User turns that classify as `/command` or `<local-command-stderr>` are
 * handed off to dedicated blocks; the avatar+label chrome only appears for
 * plain user prose.
 */
export function UserTurn({ turn }: { turn: Turn }) {
  const text = Array.isArray(turn.textBlocks) ? turn.textBlocks.join('\n\n') : ''
  const classified = classifyUserText(text)

  if (classified.kind === 'command') {
    // Render the command capsule. When the command emitted a stderr block,
    // render that immediately under it (matches the design's stacked pattern).
    return (
      <>
        <CommandBlock turn={turn} />
        {classified.stderr && <StderrBlock turn={turn} />}
      </>
    )
  }
  if (classified.kind === 'stderr') {
    return <StderrBlock turn={turn} />
  }
  if (classified.kind === 'stdout') {
    return <StdoutBlock turn={turn} />
  }

  const ts = formatTurnTimestamp(turn.timestamp)
  return (
    <div
      className="px-4 py-2 flex gap-3"
      data-role="user"
      data-turn-uuid={turn.uuid}
    >
      <div
        className="flex-shrink-0 w-7 h-7 rounded-full inline-flex items-center justify-center"
        style={{ background: 'var(--user-tint)', color: 'var(--user-text)' }}
        aria-hidden="true"
      >
        <User className="w-3.5 h-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-1.5">
          <span className="text-sm font-semibold text-foreground">You</span>
          {ts && (
            <time
              className="text-[10px] font-mono text-muted-foreground tabular-nums"
              dateTime={turn.timestamp}
              title={turn.timestamp}
            >
              {ts}
            </time>
          )}
        </div>
        {classified.text.length > 0 && (
          <ContentPreview
            content={classified.text}
            render={(t) => (
              <pre className="text-sm font-sans whitespace-pre-wrap">{t}</pre>
            )}
          />
        )}
      </div>
    </div>
  )
}
