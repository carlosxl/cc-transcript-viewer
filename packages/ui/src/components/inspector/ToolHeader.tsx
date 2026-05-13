import { Check, AlertTriangle, Loader2, ChevronLeft, X } from 'lucide-react'
import type { ToolInteraction, ToolUse } from '@cc-viewer/shared'
import { iconFor } from '@/lib/toolIcons'
import { cn } from '@/lib/utils'

interface ToolHeaderProps {
  interaction: ToolInteraction
  toolUse: ToolUse
  onJumpBack: () => void
  onClose: () => void
}

const STATUS_LABEL: Record<ToolInteraction['status'], string> = {
  success: 'Succeeded',
  fail: 'Failed',
  running: 'Running',
}

function statusPillClass(status: ToolInteraction['status']): string {
  switch (status) {
    case 'fail':
      return 'bg-[var(--danger-soft)] text-[var(--danger)]'
    case 'running':
      return 'bg-[var(--warn-soft)] text-[var(--warn)]'
    default:
      return 'bg-[var(--success-soft)] text-[var(--success)]'
  }
}

function StatusIcon({ status }: { status: ToolInteraction['status'] }) {
  if (status === 'running') return <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
  if (status === 'fail') return <AlertTriangle className="w-3 h-3" aria-hidden="true" />
  return <Check className="w-3 h-3" aria-hidden="true" />
}

function formatDuration(ms: number | null | undefined): string | null {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return null
  if (ms < 1000) return `${Math.round(ms)}ms`
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(s < 10 ? 1 : 0)}s`
  const m = Math.floor(s / 60)
  const r = Math.round(s - m * 60)
  return r === 0 ? `${m}m` : `${m}m ${r}s`
}

/** Pulls a one-line summary of the tool's arguments. */
function argSummary(name: string, input: Record<string, unknown>): string {
  const v = (k: string): string => {
    const x = input[k]
    return typeof x === 'string' ? x : ''
  }
  switch (name) {
    case 'Bash':
      return v('command') || v('description')
    case 'Read':
    case 'Write':
    case 'Edit':
    case 'MultiEdit':
      return v('file_path')
    case 'NotebookEdit':
      return v('notebook_path') || v('file_path')
    case 'Glob':
    case 'Grep':
      return v('pattern')
    case 'WebFetch':
    case 'WebSearch':
      return v('url') || v('query')
    case 'Task':
    case 'Agent':
      return v('description') || v('subagent_type')
    default:
      return v('file_path') || v('command') || v('description') || v('pattern')
  }
}

export function ToolHeader({ interaction, toolUse, onJumpBack, onClose }: ToolHeaderProps) {
  const Icon = iconFor(toolUse.name)
  const duration = formatDuration(interaction.durationMs)
  const summary = argSummary(toolUse.name, toolUse.input)

  return (
    <div className="px-4 pt-3 pb-2 border-b border-border">
      <div className="flex items-center gap-2 mb-2">
        <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          Tool call
        </span>
        <span className="flex-1" />
        <button
          type="button"
          onClick={onJumpBack}
          className="inline-flex items-center gap-1 h-6 px-2 text-[11px] rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Jump back to message"
        >
          <ChevronLeft className="w-3 h-3" aria-hidden="true" />
          Jump back
        </button>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center justify-center w-6 h-6 rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Close inspector"
        >
          <X className="w-3 h-3" aria-hidden="true" />
        </button>
      </div>

      <div className="flex items-center gap-2.5">
        <div
          aria-hidden="true"
          className="w-[30px] h-[30px] flex items-center justify-center bg-[var(--surface-2)] border border-border rounded-md text-foreground/80 flex-shrink-0"
        >
          <Icon className="w-[15px] h-[15px]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-mono text-sm font-semibold text-foreground truncate">{toolUse.name}</div>
          {summary && (
            <div className="text-xs text-muted-foreground truncate">{summary}</div>
          )}
        </div>
        <div
          className={cn(
            'inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold flex-shrink-0',
            statusPillClass(interaction.status),
          )}
          aria-label={`Status: ${STATUS_LABEL[interaction.status]}`}
        >
          <StatusIcon status={interaction.status} />
          {STATUS_LABEL[interaction.status]}
        </div>
      </div>

      {duration && (
        <div className="mt-2.5 flex gap-3 text-[11px] text-muted-foreground font-mono">
          <span>⏱ {duration}</span>
        </div>
      )}
    </div>
  )
}
