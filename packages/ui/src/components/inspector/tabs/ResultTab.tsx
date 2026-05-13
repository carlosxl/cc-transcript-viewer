import { Loader2 } from 'lucide-react'
import type { ToolInteraction, ToolResult } from '@cc-viewer/shared'
import { safeStringify } from '@/lib/safeStringify'
import { cn } from '@/lib/utils'

interface ResultTabProps {
  interaction: ToolInteraction
  toolResult: ToolResult | null
}

function resultText(result: ToolResult): string {
  if (result.content === null || result.content === undefined) return ''
  if (typeof result.content === 'string') return result.content
  return safeStringify(result.content)
}

export function ResultTab({ interaction, toolResult }: ResultTabProps) {
  if (interaction.status === 'running' && !toolResult) {
    return (
      <div className="py-6 flex flex-col items-center text-center text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
        <div className="mt-2 text-xs">Streaming — result will appear when the tool finishes.</div>
      </div>
    )
  }

  if (!toolResult) {
    return (
      <div className="py-6 text-center text-xs text-muted-foreground">(no result)</div>
    )
  }

  const isError = toolResult.is_error === true
  const text = resultText(toolResult)

  return (
    <div
      className={cn(
        'rounded-md border overflow-hidden',
        isError
          ? 'border-[var(--danger)]/40 bg-[var(--danger-soft)]'
          : 'border-[var(--code-border)] bg-[var(--code-bg)]',
      )}
    >
      <div className="px-3 py-1.5 border-b border-[var(--code-border)] bg-[var(--surface-2)] flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {isError ? 'stderr' : 'stdout'}
        </span>
      </div>
      <pre
        className={cn(
          'font-mono text-[11.5px] p-3 overflow-x-auto whitespace-pre-wrap break-words',
          isError ? 'text-[var(--danger)]' : 'text-[var(--code-text)]',
        )}
      >
        {text || '(empty)'}
      </pre>
    </div>
  )
}
