import type { SubagentMetrics } from '@/lib/types'
import { fmtCost } from '@/lib/format'
import { I } from '@/components/ui/icons'

interface SubagentCtaProps {
  metrics?: SubagentMetrics
  /** Disabled when the subagent ref hasn't joined (metrics undefined). */
  onClick?: (e: React.MouseEvent) => void
}

export function SubagentCta({ metrics, onClick }: SubagentCtaProps) {
  const turns = metrics?.turnCount ?? 0
  const tools = metrics?.toolCallCount ?? 0
  const cost = metrics?.cost ?? 0
  const disabled = !metrics
  return (
    <button
      type="button"
      onClick={(e) => {
        if (disabled) return
        e.stopPropagation()
        onClick?.(e)
      }}
      disabled={disabled}
      className="sa-cta flex w-full items-center justify-between border-t border-[var(--border)] bg-[var(--accent-softer)] px-[11px] py-[8px] text-left font-mono text-[11px] text-[var(--accent-2)] transition-colors hover:bg-[var(--accent-soft)] disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span className="sa-cta-text inline-flex items-center gap-1.5 font-medium">
        <I.agent />
        <span>Open subagent transcript</span>
      </span>
      <span className="sa-stats inline-flex items-center gap-1.5 text-[var(--text-2)]">
        <span>
          {turns} {turns === 1 ? 'turn' : 'turns'}
        </span>
        <span className="text-[var(--text-disabled)]">·</span>
        <span>
          {tools} {tools === 1 ? 'tool call' : 'tool calls'}
        </span>
        <span className="text-[var(--text-disabled)]">·</span>
        <span>{fmtCost(cost)}</span>
        <span className="text-[var(--text-disabled)]">·</span>
        <I.chevronRight />
      </span>
    </button>
  )
}
