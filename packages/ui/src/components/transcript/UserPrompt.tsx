import type { SessionTurn } from '@/lib/types'
import { isStderrEnvelope } from '@/lib/classifyUserText'
import { fmtK } from '@/lib/format'
import { useFocus } from '@/stores/useFocus'

interface UserPromptProps {
  turn: SessionTurn
  onClick: () => void
}

export function UserPrompt({ turn, onClick }: UserPromptProps) {
  const focusedNodeId = useFocus((s) => s.nodeId)
  const focused = focusedNodeId === turn.userMsgId
  const stderr = isStderrEnvelope(turn.prompt)
  const attTokenTotal = turn.attachments.reduce((s, a) => s + a.tokens, 0)
  return (
    <div
      className="node my-2.5 rounded-r-sm border-l-2 border-transparent pl-3 transition-colors"
      data-focused={focused || undefined}
      data-node-id={turn.userMsgId}
      onClick={onClick}
      style={{
        borderLeftColor: focused ? 'var(--accent)' : undefined,
        background: focused ? 'linear-gradient(90deg, var(--accent-softer), transparent 40%)' : undefined,
      }}
    >
      <div
        className="node-label mb-1 flex cursor-pointer items-center gap-2 font-mono text-[10.5px] font-medium text-[var(--text-3)] uppercase"
        style={{ letterSpacing: '0.05em', color: focused ? 'var(--accent-2)' : undefined }}
      >
        <span className="nl-id" style={{ color: focused ? 'var(--accent-2)' : 'var(--text-2)' }}>
          USER MESSAGE {turn.userMsgId.slice(0, 8)}
        </span>
        <span className="nl-meta" style={{ textTransform: 'none', letterSpacing: 0, color: 'var(--text-3)' }}>
          · {turn.time}
          {stderr ? ' · stderr envelope' : ''}
          {turn.attachments.length > 0 ? ` · ${turn.attachments.length} attached events` : ''}
        </span>
      </div>
      <div
        className="user-prompt cursor-pointer rounded-sm border border-[var(--border-1)] bg-[var(--surface-1)] px-3 pt-2.5 pb-3 hover:border-[var(--border-2)]"
      >
        <div className="user-prompt-text text-[13.5px] leading-[1.55] text-[var(--text-0)] font-normal whitespace-pre-wrap break-words" style={{ fontWeight: 450 }}>
          {turn.prompt || <span className="text-[var(--text-3)] italic">(empty)</span>}
        </div>
        {turn.attachments.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            <div className="user-prompt-attach inline-flex items-center gap-1.5 rounded-[3px] border border-[var(--border-1)] bg-[var(--surface-2)] px-1.5 py-[3px] font-mono text-[10.5px] whitespace-nowrap text-[var(--text-2)]">
              <span className="k text-[var(--text-3)]">+</span>
              <span>{turn.attachments.length} attached events</span>
              <span className="k text-[var(--text-3)]">·</span>
              <span>~{fmtK(attTokenTotal)} tokens</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
