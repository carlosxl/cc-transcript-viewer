import type { ToolBlock } from '@/lib/types'
import type { AgentRollupResult } from '@cc-viewer/shared'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { formatToolDisplayName, getToolArgSummary } from '@/lib/toolArgs'
import { BlockAgentRollup } from './BlockAgentRollup'

interface BlockToolCallProps {
  block: ToolBlock
  focused: boolean
  onClick: (e: React.MouseEvent) => void
}

/**
 * REQ-side single-line representation of a tool_use:
 *   →  ToolName  arg-summary  [agent rollup chip when present]
 *
 * The matching tool_result + body lives in the HARNESS envelope (see BlockToolResult).
 */
export function BlockToolCall({ block, focused, onClick }: BlockToolCallProps) {
  const arg = getToolArgSummary(block.name, block.input)
  const rollup = agentRollupFor(block)
  const displayName = formatToolDisplayName(block.name)
  const isolatedWorktree = block.name === 'Agent' && (block.input as { isolation?: unknown })?.isolation === 'worktree'
  const planBody = exitPlanBody(block)
  return (
    <>
      <div
        className={'va-call' + (focused ? ' is-focused' : '')}
        data-active={focused || undefined}
        data-status={block.status}
        data-retry={block.retryOf ? 'true' : undefined}
        onClick={onClick}
      >
        <span className="arrow">→</span>
        <span className="name">{displayName}</span>
        <span className="arg">{planBody ? '' : arg}</span>
        {block.retryOf && (
          <span
            className="va-tool-retry"
            title="Retry after a previous same-tool failure in this turn"
          >
            ↻ retry
          </span>
        )}
        {isolatedWorktree && (
          <span className="va-sticky" data-kind="worktree" title="Subagent runs in an isolated git worktree">
            worktree
          </span>
        )}
        {block.status === 'cancelled' && <span className="va-tool-cancelled">cancelled</span>}
        {rollup && <BlockAgentRollup rollup={rollup} mode="chip" />}
      </div>
      {planBody && (
        <div className="va-plan-body va-md" onClick={onClick}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{planBody}</ReactMarkdown>
        </div>
      )}
    </>
  )
}

function exitPlanBody(block: ToolBlock): string | null {
  if (block.name !== 'ExitPlanMode') return null
  const plan = (block.input as { plan?: unknown } | null | undefined)?.plan
  return typeof plan === 'string' && plan.length > 0 ? plan : null
}

function agentRollupFor(block: ToolBlock): AgentRollupResult | null {
  const r = block.toolUseResult
  if (!r || typeof r !== 'object' || Array.isArray(r)) return null
  const o = r as Record<string, unknown>
  if (typeof o.agentType === 'string' && typeof o.totalDurationMs === 'number' && typeof o.totalTokens === 'number') {
    return o as unknown as AgentRollupResult
  }
  return null
}
