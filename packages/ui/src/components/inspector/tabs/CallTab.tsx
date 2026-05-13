import type { ToolUse } from '@cc-viewer/shared'

interface CallTabProps {
  toolUse: ToolUse
}

/**
 * Renders the tool's input. Bash shows the command verbatim; everything else
 * shows the input as pretty-printed JSON. A separate "Description" block
 * surfaces `input.description` (Task/Agent) when present.
 */
export function CallTab({ toolUse }: CallTabProps) {
  const isBash = toolUse.name === 'Bash'
  const command = typeof toolUse.input['command'] === 'string' ? toolUse.input['command'] : ''
  const description = typeof toolUse.input['description'] === 'string' ? toolUse.input['description'] : ''
  const code = isBash && command
    ? command
    : JSON.stringify(toolUse.input, null, 2)

  return (
    <div className="grid gap-3">
      <div className="rounded-md border border-[var(--code-border)] bg-[var(--code-bg)] overflow-hidden">
        <div className="px-3 py-1.5 border-b border-[var(--code-border)] bg-[var(--surface-2)]">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            arguments
          </span>
        </div>
        <pre className="font-mono text-[11.5px] text-[var(--code-text)] p-3 overflow-x-auto whitespace-pre-wrap break-words">
          {code}
        </pre>
      </div>
      {!isBash && description && (
        <div className="text-xs text-foreground/90 px-1">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mr-2">
            Description
          </span>
          {description}
        </div>
      )}
    </div>
  )
}
