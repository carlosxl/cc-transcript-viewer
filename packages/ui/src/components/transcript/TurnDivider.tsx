import { useFocus } from '@/stores/useFocus'
import type { SessionTurn } from '@/lib/types'
import { fmtCost } from '@/lib/format'

interface TurnDividerProps {
  turn: SessionTurn
  onClick: () => void
}

export function TurnDivider({ turn, onClick }: TurnDividerProps) {
  const nodeId = useFocus((s) => s.nodeId)
  const focused = nodeId === turn.userMsgId || turn.requests.some((r) => r.id === nodeId)
  return (
    <div
      className="turn-divider my-3 mt-[22px] mb-3 flex cursor-pointer items-center gap-2.5"
      data-focused={focused || undefined}
      onClick={onClick}
    >
      <span
        className="turn-pill inline-flex items-center gap-2 rounded-full border border-[var(--border-1)] bg-[var(--surface-1)] px-2.5 py-1 font-mono text-[11px] whitespace-nowrap text-[var(--text-2)]"
        data-focused={focused || undefined}
        style={{
          borderColor: focused ? 'var(--accent-border)' : undefined,
          background: focused ? 'var(--accent-soft)' : undefined,
          color: focused ? 'var(--accent-2)' : undefined,
        }}
      >
        <span className="id font-medium" style={{ color: focused ? 'var(--accent-2)' : 'var(--text-0)' }}>
          Turn {turn.id.slice(0, 8)}
        </span>
        <span className="time text-[var(--text-3)] text-[10.5px]">{turn.time}</span>
        <span className="cost" style={{ color: focused ? 'var(--accent-2)' : 'var(--text-1)' }}>
          {fmtCost(turn.cost)}
        </span>
      </span>
      <span className="flex-1 self-center" style={{ height: 1, background: 'var(--border)' }} />
    </div>
  )
}
