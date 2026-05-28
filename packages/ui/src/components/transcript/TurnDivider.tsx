import { useFocus } from '@/stores/useFocus'
import type { Block, SessionTurn } from '@/lib/types'
import { fmtCost, fmtDuration } from '@/lib/format'

interface TurnDividerProps {
  turn: SessionTurn
  onClick: () => void
}

export function TurnDivider({ turn, onClick }: TurnDividerProps) {
  const nodeId = useFocus((s) => s.nodeId)
  const focused = nodeId === turn.userMsgId || turn.requests.some((r) => r.id === nodeId)
  const reqCount = turn.requests.length
  const toolCount = countToolUses(turn)
  const toolStatus = summariseToolStatus(turn)
  return (
    <div
      className="va-turn-divider cursor-pointer"
      data-focused={focused || undefined}
      onClick={onClick}
    >
      <span>Turn {turn.id.slice(0, 8)}</span>
      <span className="dot" />
      <span>{turn.time}</span>
      <span className="dot" />
      <span>
        {reqCount} {reqCount === 1 ? 'request' : 'requests'}
      </span>
      {toolCount > 0 && (
        <>
          <span className="dot" />
          <span data-status={toolStatus}>
            {toolCount} tool {toolCount === 1 ? 'call' : 'calls'}
            {toolStatus !== 'ok' && ` · ${toolStatus}`}
          </span>
        </>
      )}
      <span className="dot" />
      <span>{fmtCost(turn.cost)}</span>
      {typeof turn.durationMs === 'number' && (
        <>
          <span className="dot" />
          <span>{fmtDuration(turn.durationMs)}</span>
        </>
      )}
      {typeof turn.messageCount === 'number' && (
        <>
          <span className="dot" />
          <span>
            {turn.messageCount} {turn.messageCount === 1 ? 'message' : 'messages'}
          </span>
        </>
      )}
      <span className="rule" />
    </div>
  )
}

function countToolUses(turn: SessionTurn): number {
  let n = 0
  for (const r of turn.requests) {
    for (const b of r.blocks) {
      if (isToolBlock(b)) n++
    }
  }
  return n
}

type ToolSummary = 'ok' | 'err' | 'run'

function summariseToolStatus(turn: SessionTurn): ToolSummary {
  let hasErr = false
  let hasRun = false
  for (const r of turn.requests) {
    for (const b of r.blocks) {
      if (b.kind !== 'tool_use') continue
      if (b.status === 'err') hasErr = true
      else if (b.status === 'run') hasRun = true
    }
  }
  if (hasErr) return 'err'
  if (hasRun) return 'run'
  return 'ok'
}

function isToolBlock(b: Block): boolean {
  return b.kind === 'tool_use' || b.kind === 'diff'
}
