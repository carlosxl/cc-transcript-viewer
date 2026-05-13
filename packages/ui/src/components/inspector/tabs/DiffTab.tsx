import type { ToolInteraction, ToolUse } from '@cc-viewer/shared'
import { DiffView } from '@/components/transcript/DiffBlock'

interface DiffTabProps {
  interaction: ToolInteraction
  toolUse: ToolUse
}

export function DiffTab({ interaction, toolUse }: DiffTabProps) {
  if (!interaction.diff) {
    return (
      <div className="py-6 text-center text-xs text-muted-foreground">(no diff)</div>
    )
  }
  return (
    <DiffView
      diff={interaction.diff}
      toolName={toolUse.name}
      input={toolUse.input}
      maxHeight="max-h-[60vh]"
    />
  )
}
