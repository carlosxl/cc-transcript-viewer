import type { ToolBlock } from '@/lib/types'
import { getToolArgSummary } from '@/lib/toolArgs'
import { fmtDuration } from '@/lib/format'
import { SubagentCta } from './SubagentCta'

interface BlockToolCapsuleProps {
  block: ToolBlock
  focused: boolean
  onClick: (e: React.MouseEvent) => void
  /** Fired when the user clicks the in-capsule "Open subagent transcript" CTA. */
  onDrillSubagent?: (block: ToolBlock) => void
}

export function BlockToolCapsule({ block, focused, onClick, onDrillSubagent }: BlockToolCapsuleProps) {
  const argSummary = getToolArgSummary(block.name, block.input)
  // Agent/Task tools have no per-tool preview projection — fall back to the
  // subagent's tool result so the capsule body matches the design (the
  // assistant's reply text rendered clipped, identical to other tools' preview).
  const previewBody = block.preview ?? (block.isSubagent ? block.output ?? undefined : undefined)
  return (
    <div
      className={
        'tool-capsule flex cursor-pointer flex-col overflow-hidden rounded-sm border border-[var(--border-1)] bg-[var(--surface-1)] transition-colors hover:border-[var(--border-2)]' +
        (block.isSubagent ? ' subagent-call' : '')
      }
      data-active={focused || undefined}
      onClick={onClick}
      style={{
        borderColor: focused ? 'var(--accent-border)' : undefined,
        boxShadow: focused ? '0 0 0 1px var(--accent-border)' : undefined,
        background: block.isSubagent
          ? 'linear-gradient(180deg, var(--surface-1), var(--surface-1) 60%, var(--accent-softer))'
          : undefined,
      }}
    >
      <div className="tc-head flex items-center gap-2 px-2.5 py-1.5 font-mono text-[11px]">
        <span
          className="tc-kind text-[10px] uppercase text-[var(--text-3)]"
          style={{ letterSpacing: '0.05em' }}
        >
          tool_use ·
        </span>
        <span className="tc-name font-semibold text-[var(--text-0)]">{block.name}</span>
        <span className="tc-arg min-w-0 flex-1 truncate text-[var(--text-2)] whitespace-nowrap">
          {argSummary}
        </span>
        <span className="tc-dur text-[10.5px] text-[var(--text-3)]">{fmtDuration(block.durationMs)}</span>
        <StatusBadge status={block.status} />
      </div>
      {previewBody && (
        <pre
          className="tc-preview m-0 max-h-[6.5em] overflow-hidden border-t border-[var(--border)] bg-[var(--surface-0)] px-2.5 py-1.5 font-mono text-[11px] leading-[1.5] text-[var(--text-2)] whitespace-pre-wrap break-words"
          style={{
            WebkitMaskImage: 'linear-gradient(to bottom, black 60%, transparent)',
            maskImage: 'linear-gradient(to bottom, black 60%, transparent)',
          }}
        >
          {previewBody}
        </pre>
      )}
      {block.isSubagent && (
        <SubagentCta
          metrics={block.subagentMetrics}
          onClick={() => onDrillSubagent?.(block)}
        />
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: ToolBlock['status'] }) {
  const cfg =
    status === 'err'
      ? { color: 'var(--red)', bg: 'var(--red-soft)', label: 'error' }
      : status === 'run'
        ? { color: 'var(--accent-2)', bg: 'var(--accent-soft)', label: 'run' }
        : { color: 'var(--green)', bg: 'var(--green-soft)', label: 'ok' }
  return (
    <span
      className="tc-status rounded-full px-1.5 py-[1px] text-[10px] font-medium"
      style={{ color: cfg.color, background: cfg.bg, letterSpacing: '0.02em' }}
    >
      {cfg.label}
    </span>
  )
}
