import { I } from '@/components/ui/icons'
import { fmtCost } from '@/lib/format'
import type { SubagentMetrics } from '@/lib/types'

interface SubagentDrillProps {
  metrics?: SubagentMetrics
  model?: string
  onClick?: () => void
}

export function SubagentDrill({ metrics, model, onClick }: SubagentDrillProps) {
  const turns = metrics?.turnCount ?? 0
  const tools = metrics?.toolCallCount ?? 0
  const cost = metrics?.cost ?? 0
  const disabled = !metrics
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => !disabled && onClick?.()}
      className="ins-drill flex w-full items-center justify-between gap-2.5 rounded-sm border text-left disabled:cursor-not-allowed disabled:opacity-60"
      style={{
        padding: '10px 12px',
        marginTop: 10,
        background: 'var(--accent-soft)',
        borderColor: 'var(--accent-border)',
        color: 'var(--text-0)',
        transition: 'background 80ms',
      }}
    >
      <span className="l flex items-center gap-2">
        <I.agent />
        <span>
          <span
            className="title block text-left"
            style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--accent-2)' }}
          >
            Open subagent transcript
          </span>
          <span
            className="desc block text-left"
            style={{ fontSize: 11, color: 'var(--text-1)' }}
          >
            {turns} {turns === 1 ? 'turn' : 'turns'} · {tools}{' '}
            {tools === 1 ? 'tool call' : 'tool calls'} · {fmtCost(cost)}
            {model ? ` · ${model}` : ''}
          </span>
        </span>
      </span>
      <span className="ico" style={{ color: 'var(--accent-2)' }}>
        <I.arrowRight />
      </span>
    </button>
  )
}
