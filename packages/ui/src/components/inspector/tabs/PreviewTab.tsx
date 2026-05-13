import type { ToolInteraction, ToolResult } from '@cc-viewer/shared'
import { safeStringify } from '@/lib/safeStringify'

interface PreviewTabProps {
  interaction: ToolInteraction
  toolResult: ToolResult | null
  onSwitchToRaw: () => void
}

const SIZE_GUARD = 256 * 1024

function resultText(result: ToolResult): string {
  if (result.content === null || result.content === undefined) return ''
  if (typeof result.content === 'string') return result.content
  return safeStringify(result.content)
}

export function PreviewTab({ interaction, toolResult, onSwitchToRaw }: PreviewTabProps) {
  const filePath = interaction.preview?.filePath
  const lineCount = interaction.preview?.lineCount

  if (!toolResult) {
    return (
      <div className="py-6 text-center text-xs text-muted-foreground">(no result yet)</div>
    )
  }

  const text = resultText(toolResult)
  const tooLarge = text.length > SIZE_GUARD

  return (
    <div className="rounded-md border border-border bg-[var(--surface)] overflow-hidden">
      <div className="px-3 py-1.5 border-b border-border bg-[var(--surface-2)] flex items-center gap-3">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          preview
        </span>
        {filePath && (
          <span className="font-mono text-[11px] text-foreground truncate flex-1 min-w-0">
            {filePath}
          </span>
        )}
        {lineCount !== null && lineCount !== undefined && (
          <span className="font-mono text-[10px] text-muted-foreground flex-shrink-0">
            L {lineCount}
          </span>
        )}
      </div>
      {tooLarge ? (
        <div className="p-4 text-xs text-muted-foreground">
          <div className="font-semibold text-foreground mb-1">Preview suppressed</div>
          <div>
            File is {(text.length / 1024 / 1024).toFixed(2)} MB — larger than the {(SIZE_GUARD / 1024).toFixed(0)} KB preview cap.
          </div>
          <button
            type="button"
            onClick={onSwitchToRaw}
            className="mt-3 inline-flex items-center px-2 h-7 text-[11px] rounded-sm border border-border text-foreground hover:bg-accent"
          >
            Switch to Raw
          </button>
        </div>
      ) : (
        <pre className="font-mono text-[11.5px] text-[var(--code-text)] p-3 overflow-x-auto whitespace-pre">
          {text || '(empty)'}
        </pre>
      )}
    </div>
  )
}
