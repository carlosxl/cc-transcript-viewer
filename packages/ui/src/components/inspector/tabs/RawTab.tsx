import type { ToolInteraction, ToolUse, ToolResult } from '@cc-viewer/shared'

interface RawTabProps {
  interaction: ToolInteraction
  toolUse: ToolUse
  toolResult: ToolResult | null
}

export function RawTab({ interaction, toolUse, toolResult }: RawTabProps) {
  const blob = { interaction, toolUse, toolResult }
  return (
    <div className="rounded-md border border-[var(--code-border)] bg-[var(--code-bg)] overflow-hidden">
      <div className="px-3 py-1.5 border-b border-[var(--code-border)] bg-[var(--surface-2)]">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          raw
        </span>
      </div>
      <pre className="font-mono text-[11.5px] text-[var(--code-text)] p-3 overflow-x-auto whitespace-pre-wrap break-words">
        {JSON.stringify(blob, null, 2)}
      </pre>
    </div>
  )
}
