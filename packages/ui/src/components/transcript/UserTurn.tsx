import { User, Wrench } from 'lucide-react'
import type { Turn } from '@cc-viewer/shared'
import { ContentPreview } from './ContentPreview'
import { formatTurnTimestamp } from '@/lib/format'

export function UserTurn({ turn }: { turn: Turn }) {
  const text = Array.isArray(turn.textBlocks) ? turn.textBlocks.join('\n\n') : ''
  const resultCount = turn.toolResults?.length ?? 0
  // The Anthropic API nests tool_result blocks inside user-role messages, so
  // the JSONL "user" role conflates two distinct things: a real human prompt
  // and the protocol-shaped envelope wrapping a tool result. When this turn
  // has no text and only tool_results, relabel + reicon so the UI reflects
  // what the row actually represents to a human reader. (In compact view
  // mode, these tool-result-only turns are filtered out by buildFlatNodes.)
  const isToolResultOnly = text.length === 0 && resultCount > 0
  const ts = formatTurnTimestamp(turn.timestamp)
  return (
    <div
      className={`px-4 py-3 border-b border-border border-l-2 ${
        isToolResultOnly ? 'border-l-muted-foreground/30' : 'border-l-amber-500/60'
      }`}
      data-role={isToolResultOnly ? 'tool-result' : 'user'}
      data-turn-uuid={turn.uuid}
    >
      <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-foreground">
        {isToolResultOnly
          ? <Wrench className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
          : <User className="w-4 h-4 text-foreground" aria-hidden="true" />}
        <span className={isToolResultOnly ? 'text-muted-foreground' : undefined}>
          {isToolResultOnly ? 'Tool result' : 'User'}
        </span>
        {ts && (
          <time
            className="ml-auto text-[11px] font-normal text-muted-foreground tabular-nums"
            dateTime={turn.timestamp}
            title={turn.timestamp}
          >
            {ts}
          </time>
        )}
      </div>
      {text.length > 0 && (
        <ContentPreview
          content={text}
          render={(t) => <pre className="text-sm font-sans whitespace-pre-wrap">{t}</pre>}
        />
      )}
    </div>
  )
}
