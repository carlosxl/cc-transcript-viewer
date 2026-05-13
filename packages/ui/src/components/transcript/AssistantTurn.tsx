import { Sparkles } from 'lucide-react'
import type { Turn } from '@cc-viewer/shared'
import { ContentPreview } from './ContentPreview'
import { MarkdownRenderer } from '../../lib/markdown'
import { formatTurnTimestamp } from '@/lib/format'

/**
 * Phase 4 redesign — round avatar with claude-tint, name + model + timestamp
 * baseline, markdown body. Tool calls / thinking blocks remain sibling rows
 * in the flat node array.
 */
export function AssistantTurn({ turn }: { turn: Turn }) {
  // Defensive (D-40.2 / F-1): real-world Turn shapes occasionally arrive without
  // a textBlocks array; calling .join on undefined throws and unmounts the root.
  const text = Array.isArray(turn.textBlocks) ? turn.textBlocks.join('\n\n') : ''
  const ts = formatTurnTimestamp(turn.timestamp)
  const model = turn.model
  return (
    <div
      className="px-4 py-2 flex gap-3"
      data-role="assistant"
      data-turn-uuid={turn.uuid}
    >
      <div
        className="flex-shrink-0 w-7 h-7 rounded-full inline-flex items-center justify-center"
        style={{ background: 'var(--claude-tint)', color: 'var(--claude-text)' }}
        aria-hidden="true"
      >
        <Sparkles className="w-3.5 h-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-1.5">
          <span className="text-sm font-semibold text-foreground">Claude</span>
          {model && (
            <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
              {model}
            </span>
          )}
          {ts && (
            <time
              className="text-[10px] font-mono text-muted-foreground tabular-nums"
              dateTime={turn.timestamp}
              title={turn.timestamp}
            >
              · {ts}
            </time>
          )}
        </div>
        {text.length > 0 && (
          <ContentPreview
            content={text}
            render={(t) => (
              <div className="text-sm prose prose-sm dark:prose-invert max-w-none">
                <MarkdownRenderer text={t} />
              </div>
            )}
          />
        )}
      </div>
    </div>
  )
}
