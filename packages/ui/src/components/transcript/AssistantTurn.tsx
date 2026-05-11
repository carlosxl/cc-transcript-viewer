import { Bot } from 'lucide-react'
import type { Turn } from '@cc-viewer/shared'
import { ContentPreview } from './ContentPreview'
import { MarkdownRenderer } from '../../lib/markdown'
import { formatTurnTimestamp } from '@/lib/format'

/**
 * Assistant prose. Rendered through MarkdownRenderer (react-markdown +
 * remark-gfm + rehype-sanitize). The 1px primary/40 left stripe (UI-SPEC
 * §Color Accent #3) marks assistant turns visually.
 *
 * Tool calls / thinking blocks live as sibling rows in the flat node array and
 * are only emitted in 'details' view mode (see buildFlatNodes). There is no
 * per-row expand/collapse — the global view-mode toggle in TranscriptHeader
 * is the only control.
 */
export function AssistantTurn({ turn }: { turn: Turn }) {
  // Defensive (D-40.2 / F-1): real-world Turn shapes occasionally arrive without
  // a textBlocks array; calling .join on undefined throws and unmounts the root.
  const text = Array.isArray(turn.textBlocks) ? turn.textBlocks.join('\n\n') : ''
  const ts = formatTurnTimestamp(turn.timestamp)
  return (
    <div
      className="px-4 py-3 border-b border-border border-l-2 border-l-indigo-500/60"
      data-role="assistant"
      data-turn-uuid={turn.uuid}
    >
      <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-primary">
        <Bot className="w-4 h-4" aria-hidden="true" />
        <span>Claude</span>
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
      <ContentPreview
        content={text}
        render={(t) => (
          <div className="text-sm prose prose-sm dark:prose-invert max-w-none">
            <MarkdownRenderer text={t} />
          </div>
        )}
      />
    </div>
  )
}
