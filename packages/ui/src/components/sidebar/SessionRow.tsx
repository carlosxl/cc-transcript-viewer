import type { SessionMeta } from '@/lib/types'
import { fmtCost, fmtRelativeTime } from '@/lib/format'
import { costFromUsage, tokensOf } from '@/lib/cost'
import { CostTooltip } from './CostTooltip'

interface SessionRowProps {
  session: SessionMeta
  active: boolean
  onClick: () => void
}

export function SessionRow({ session, active, onClick }: SessionRowProps) {
  const cost = costFromUsage(session.totalUsage)
  const tokens = tokensOf(session.totalUsage)
  return (
    <div
      className="sb-row relative cursor-pointer border-l-2 border-transparent py-1.5 pr-3 pl-[18px] transition-colors hover:bg-[var(--surface-2)] data-[active=true]:border-[var(--accent)] data-[active=true]:bg-[var(--accent-soft)] data-[active=true]:hover:bg-[var(--accent-soft)]"
      data-active={active || undefined}
      onClick={onClick}
    >
      <div className="sb-row-title flex items-center gap-1.5 truncate text-[12.5px] font-medium text-[var(--text-0)]">
        <span className="min-w-0 flex-1 truncate">{session.title}</span>
        {session.isLive && (
          <span
            className="sb-live ml-auto h-[6px] w-[6px] flex-shrink-0 rounded-full"
            style={{ background: 'var(--green)', animation: 'live-pulse 1.6s ease-out infinite' }}
            aria-label="live"
          />
        )}
      </div>
      <div className="sb-row-meta mt-0.5 flex items-center font-mono text-[10.5px] text-[var(--text-3)]">
        <span>{fmtRelativeTime(session.lastTimestamp)}</span>
        <span className="mx-[5px] text-[var(--text-disabled)]">·</span>
        <span>{session.messageCount} msgs</span>
        <span className="mx-[5px] text-[var(--text-disabled)]">·</span>
        <CostTooltip tokens={tokens}>
          <span className="cost text-[var(--text-2)]">{fmtCost(cost)}</span>
        </CostTooltip>
      </div>
    </div>
  )
}
