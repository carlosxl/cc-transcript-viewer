import { Wrench, ArrowUpRight, AlertTriangle } from 'lucide-react'
import type { Turn } from '@cc-viewer/shared'
import { useUIStore } from '@/stores/useUIStore'
import { useNavigationStore } from '@/stores/useNavigationStore'

const AGENT_TOOL_NAMES = new Set(['Agent', 'Task'])

/**
 * Defensive JSON stringify (D-40.2 / F-1): tu.input is typed `unknown` upstream
 * but real Claude sessions occasionally produce non-object inputs (string,
 * number, BigInt) or self-referential objects. JSON.stringify throws on either,
 * which used to unmount the React root before the ErrorBoundary existed.
 */
export function safeStringify(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'string') return v
  try {
    return JSON.stringify(v, null, 2)
  } catch {
    return String(v)
  }
}

interface ToolCallRowProps {
  turn: Turn
  toolUseId: string
}

/**
 * Tool input row. Always rendered inline in 'details' view mode (compact mode
 * never emits this node). The previous chevron-based collapse was removed
 * along with useExpandStore — one global toggle in TranscriptHeader controls
 * whether tool calls appear at all.
 */
export function ToolCallRow({ turn, toolUseId }: ToolCallRowProps) {
  const tu = turn.toolUses.find((u) => u.id === toolUseId)
  const activeSessionId = useUIStore((s) => s.activeSessionId)
  const pushSubagent = useNavigationStore((s) => s.pushSubagent)
  if (!tu) return <></>

  const isAgentSpawn = AGENT_TOOL_NAMES.has(tu.name)
  const childAgentId = tu.childAgentId
  const trailing = isAgentSpawn ? (
    childAgentId && activeSessionId ? (
      <button
        type="button"
        onClick={() => pushSubagent({ sessionId: activeSessionId, agentId: childAgentId })}
        className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
        aria-label={`Open subagent ${childAgentId}`}
      >
        <span>Open subagent</span>
        <ArrowUpRight className="w-3 h-3" aria-hidden="true" />
      </button>
    ) : (
      <span
        className="ml-auto inline-flex items-center gap-1 text-[11px] text-muted-foreground cursor-default"
        title="Subagent transcript not found — linker could not resolve this Task to a subagent JSONL"
      >
        <AlertTriangle className="w-3 h-3" aria-hidden="true" />
        <span>subagent not linked</span>
      </span>
    )
  ) : null

  const body = safeStringify(tu.input)
  return (
    <div className="border-b border-border border-l-2 border-l-indigo-500/60 pl-8 pr-4 py-2" data-tool-use-id={tu.id}>
      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-1">
        <Wrench className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
        <span className="truncate">Tool: {tu.name}</span>
        {trailing}
      </div>
      {body.length > 0 && (
        <pre className="font-mono text-xs bg-muted px-2 py-1.5 rounded-sm overflow-x-auto whitespace-pre-wrap">
          {body}
        </pre>
      )}
    </div>
  )
}
