import { Wrench, AlertCircle } from 'lucide-react'
import type { Turn } from '@cc-viewer/shared'
import { ContentPreview } from './ContentPreview'
import { safeStringify } from '@/lib/safeStringify'
import { cn } from '@/lib/utils'

interface ToolResultRowProps {
  turn: Turn
  toolUseId: string
  /**
   * True when this result has no matching tool_use in the transcript (orphan).
   * Rendered with a small badge so the user knows why it isn't sitting next
   * to a call row — usually a live-tail edge case or a truncated JSONL.
   */
  unmatched?: boolean
}

const INLINE_MAX_CHARS = 160

export function ToolResultRow({ turn, toolUseId, unmatched }: ToolResultRowProps) {
  const tr = turn.toolResults.find((r) => r.tool_use_id === toolUseId)
  if (!tr) return <></>
  const isError = tr.is_error === true
  // Defensive (D-40.2 / F-1): tr.content is typed `string | unknown[]` but
  // real-world tool results occasionally arrive as null / undefined / object.
  const text =
    tr.content === null || tr.content === undefined
      ? ''
      : typeof tr.content === 'string'
        ? tr.content
        : safeStringify(tr.content)

  // Short single-line success → render on one row to avoid the header+body
  // stacking pattern that made stretches of "X updated successfully" results
  // dominate vertical space. Errors and multi-line content always get the
  // full layout so failure context stays scannable.
  const isShortSingleLine =
    !isError && text.length > 0 && text.length <= INLINE_MAX_CHARS && !text.includes('\n')

  return (
    <div
      className={cn(
        'border-b border-border pl-8 pr-4 py-1.5',
        // Tool results are part of the assistant's action loop — the system
        // delivers them as user-role envelopes but semantically they belong
        // to the assistant. Indigo stripe groups them with the assistant turn
        // above. Errors override with a thicker destructive stripe.
        isError ? 'border-l-4 border-l-destructive' : 'border-l-2 border-l-indigo-500/60',
      )}
      data-error={isError ? 'true' : 'false'}
      data-tool-use-id={tr.tool_use_id}
    >
      {isShortSingleLine ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Wrench className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
          <span className="truncate font-mono">{text}</span>
          {unmatched && (
            <span className="ml-auto shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground/70">
              unmatched
            </span>
          )}
        </div>
      ) : (
        <>
          <div className={cn(
            'flex items-center gap-2 text-xs font-semibold mb-1',
            isError ? 'text-destructive' : 'text-muted-foreground',
          )}>
            {isError
              ? <AlertCircle className="w-3.5 h-3.5 text-destructive flex-shrink-0" aria-hidden="true" />
              : <Wrench className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />}
            <span className="truncate">{isError ? 'Tool result (failed)' : 'Tool result'}</span>
            {unmatched && (
              <span className="ml-auto shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground/70">
                unmatched
              </span>
            )}
          </div>
          {text.length > 0 && (
            <ContentPreview
              content={text}
              render={(t) => (
                <pre className="font-mono text-xs bg-muted px-2 py-1.5 rounded-sm overflow-x-auto whitespace-pre-wrap">
                  {t}
                </pre>
              )}
            />
          )}
        </>
      )}
    </div>
  )
}
