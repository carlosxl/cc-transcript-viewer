import { ChevronRight, ArrowUpRight, AlertTriangle } from 'lucide-react'
import type { ToolInteraction, Turn } from '@cc-viewer/shared'
import { useUIStore } from '@/stores/useUIStore'
import { useNavigationStore } from '@/stores/useNavigationStore'
import { useInteractionByToolId } from '@/hooks/useInteractionByToolId'
import { useActiveInteractions } from '@/hooks/useActiveInteractions'
import { iconFor } from '@/lib/toolIcons'
import { cn } from '@/lib/utils'

const AGENT_TOOL_NAMES = new Set(['Agent', 'Task'])

/** Best-effort one-line summary of the tool's arguments. */
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
      return v('pattern')
    case 'Grep':
      return v('pattern')
    case 'WebFetch':
    case 'WebSearch':
      return v('url') || v('query')
    case 'Task':
    case 'Agent':
      return v('description') || v('subagent_type')
    default: {
      // Fallback: prefer common keys.
      return v('file_path') || v('command') || v('description') || v('pattern')
    }
  }
}

function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return ''
  if (ms < 1000) return `${Math.round(ms)}ms`
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(s < 10 ? 1 : 0)}s`
  const m = Math.floor(s / 60)
  const r = Math.round(s - m * 60)
  return r === 0 ? `${m}m` : `${m}m ${r}s`
}

function statusDotClass(status: ToolInteraction['status'] | undefined): string {
  switch (status) {
    case 'fail':
      return 'bg-[var(--danger)]'
    case 'running':
      return 'bg-[var(--warn)]'
    default:
      return 'bg-[var(--success)]'
  }
}

function statusLabel(status: ToolInteraction['status'] | undefined): string {
  switch (status) {
    case 'fail':
      return 'Failed'
    case 'running':
      return 'Running'
    default:
      return 'Succeeded'
  }
}

interface ToolCapsuleProps {
  turn: Turn
  toolUseId: string
}

/**
 * Phase 4: clickable capsule replacing the old `ToolCallRow` body.
 *
 * Selects a `ToolInteraction` on click (Phase 5 binds the right rail).
 * The capsule pulls duration + status from the ToolInteraction projection
 * (`useInteractionByToolId`); when no projection has loaded yet (live tail,
 * subagent boundary), the capsule renders without those decorations.
 */
export function ToolCapsule({ turn, toolUseId }: ToolCapsuleProps) {
  const tu = turn.toolUses.find((u) => u.id === toolUseId)
  const activeSessionId = useUIStore((s) => s.activeSessionId)
  const pushSubagent = useNavigationStore((s) => s.pushSubagent)
  const selectedId = useNavigationStore((s) => s.selectedInteractionId)
  const setSelected = useNavigationStore((s) => s.setSelectedInteractionId)
  const interactions = useActiveInteractions()
  const byId = useInteractionByToolId(interactions)
  if (!tu) return <></>

  const interaction = byId.get(tu.id) ?? null
  const Icon = iconFor(tu.name)
  const summary = argSummary(tu.name, tu.input)
  const duration = formatDuration(interaction?.durationMs)
  const isSelected = interaction !== null && selectedId === interaction.id

  const isAgentSpawn = AGENT_TOOL_NAMES.has(tu.name)
  const childAgentId = tu.childAgentId

  function onClick() {
    if (interaction) setSelected(interaction.id)
  }

  return (
    <div className="px-4 py-1.5" data-tool-use-id={tu.id}>
      <button
        type="button"
        onClick={onClick}
        data-interaction-id={interaction?.id}
        aria-pressed={isSelected}
        className={cn(
          'group flex items-center gap-2.5 w-full px-3 py-2 text-left rounded-md',
          'border bg-[var(--surface-2)] hover:bg-[var(--surface-3)]',
          'transition-colors',
          isSelected
            ? 'border-primary ring-2 ring-primary/20'
            : 'border-border',
        )}
      >
        <Icon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" aria-hidden="true" />
        <span className="font-mono text-xs font-semibold text-foreground flex-shrink-0">
          {tu.name}
        </span>
        {summary && (
          <span className="font-mono text-[11px] text-muted-foreground truncate flex-1 min-w-0">
            {summary}
          </span>
        )}
        {!summary && <span className="flex-1" />}
        {duration && (
          <span className="font-mono text-[10px] text-muted-foreground flex-shrink-0">
            {duration}
          </span>
        )}
        <span
          role="status"
          aria-label={statusLabel(interaction?.status)}
          className={cn(
            'w-2 h-2 rounded-full flex-shrink-0',
            statusDotClass(interaction?.status),
          )}
          title={statusLabel(interaction?.status)}
        >
          <span className="sr-only">{statusLabel(interaction?.status)}</span>
        </span>
        {isAgentSpawn ? (
          childAgentId && activeSessionId ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                pushSubagent({ sessionId: activeSessionId, agentId: childAgentId })
              }}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline flex-shrink-0"
              aria-label={`Open subagent ${childAgentId}`}
            >
              <span>Open subagent</span>
              <ArrowUpRight className="w-3 h-3" aria-hidden="true" />
            </button>
          ) : (
            <span
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground flex-shrink-0"
              title="Subagent transcript not found — linker could not resolve this Task to a subagent JSONL"
            >
              <AlertTriangle className="w-3 h-3" aria-hidden="true" />
              <span>subagent not linked</span>
            </span>
          )
        ) : (
          <ChevronRight
            className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0"
            aria-hidden="true"
          />
        )}
      </button>
    </div>
  )
}
