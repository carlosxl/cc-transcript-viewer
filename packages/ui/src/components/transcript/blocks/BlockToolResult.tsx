import type { DiffBlock, ToolBlock, ToolUseResult } from '@/lib/types'
import type {
  AgentRollupResult,
  AskUserQuestionResult,
  BashResult,
  EditResult,
  WriteResult,
} from '@cc-viewer/shared'
import { getToolArgSummary } from '@/lib/toolArgs'
import { fmtDuration } from '@/lib/format'
import { BlockDiff } from './BlockDiff'
import { BlockStructuredPatch } from './BlockStructuredPatch'
import { BlockAgentRollup } from './BlockAgentRollup'
import { BlockAskUserQuestion } from './BlockAskUserQuestion'
import { BlockBashSidecar } from './BlockBashSidecar'
import { SubagentCta } from './SubagentCta'

interface BlockToolResultProps {
  /** The tool_use that produced this result. Null for orphan diffs. */
  toolUse: ToolBlock | null
  /** Paired diff (Edit/Write/MultiEdit) or an orphan diff (when toolUse is null). */
  diff: DiffBlock | null
  focused: boolean
  onClick: (e: React.MouseEvent) => void
  onDrillSubagent?: (block: ToolBlock) => void
}

/**
 * HARNESS-side rendering for one tool result:
 *   ←  ToolName  arg  duration  [status pill]
 *   <optional diff body | preview body>
 *   <optional structured sidecar disclosure>
 *   <optional SubagentCta>
 */
export function BlockToolResult({ toolUse, diff, focused, onClick, onDrillSubagent }: BlockToolResultProps) {
  if (!toolUse && diff) {
    return (
      <div
        className={'va-result' + (focused ? ' is-focused' : '')}
        data-active={focused || undefined}
        onClick={onClick}
      >
        <BlockDiff block={diff} />
      </div>
    )
  }
  if (!toolUse) return null

  const arg = getToolArgSummary(toolUse.name, toolUse.input)
  const dur = fmtDuration(toolUse.durationMs)
  const status = toolUse.status
  const statusLabel = status === 'err' ? 'error' : status === 'run' ? 'run' : status === 'cancelled' ? 'cancelled' : 'ok'
  const isAbnormal = status === 'err' || status === 'cancelled'
  const previewBody = diff ? null : toolUse.output ?? toolUse.preview ?? undefined
  const sidecar = toolUse.toolUseResult
  const sidecarVariant = sidecar ? classifyToolUseResult(sidecar) : null
  // The toolUseResult sidecar carries a proper unified diff with context lines
  // and line numbers — strictly better than the projected DiffBlock's naive
  // "all old lines red, all new lines green" rendering. When present, render
  // it inline in place of BlockDiff (and skip the redundant disclosure).
  const inlineStructuredPatch = sidecarVariant === 'structured-patch'

  return (
    <div
      className={'va-result' + (focused ? ' is-focused' : '')}
      data-active={focused || undefined}
      data-retry={toolUse.retryOf ? 'true' : undefined}
      onClick={onClick}
    >
      <div className="va-result-head">
        <span className="arrow">←</span>
        <span className="name">{toolUse.name}</span>
        <span className="arg">{arg}</span>
        {dur && <span className="dur">{dur}</span>}
        <span className={'st ' + status}>{statusLabel}</span>
        {toolUse.retryOf && <span className="va-tool-retry">↻ retry</span>}
      </div>
      {inlineStructuredPatch && sidecar ? (
        <SidecarBody variant="structured-patch" result={sidecar} />
      ) : (
        diff && <BlockDiff block={diff} />
      )}
      {!diff && previewBody && (
        <pre className="va-preview" data-status={isAbnormal ? status : undefined}>{previewBody}</pre>
      )}
      {sidecar && sidecarVariant && !inlineStructuredPatch && (
        <details className="va-tool-sidecar" onClick={(e) => e.stopPropagation()}>
          <summary>
            <span className="va-tool-sidecar-icon">›</span>
            <span className="va-tool-sidecar-label">{sidecarLabel(sidecarVariant)}</span>
          </summary>
          <div className="va-tool-sidecar-body">
            <SidecarBody variant={sidecarVariant} result={sidecar} />
          </div>
        </details>
      )}
      {toolUse.isSubagent && (
        <SubagentCta
          metrics={toolUse.subagentMetrics}
          onClick={() => onDrillSubagent?.(toolUse)}
        />
      )}
    </div>
  )
}

// ─── Sidecar dispatch ──────────────────────────────────────────────────────────

type SidecarVariant =
  | 'structured-patch'
  | 'agent-rollup'
  | 'ask-user-question'
  | 'bash'
  | 'read-file'
  | 'task-update'
  | 'task-list'
  | 'task-create'
  | 'multi-file'
  | 'web-search'
  | 'web-fetch'
  | 'exit-plan'
  | 'tool-search'
  | 'slash-command-agent'
  | 'command-permission'
  | 'exit-worktree'
  | 'agent-launch'
  | 'generic'

function classifyToolUseResult(r: ToolUseResult): SidecarVariant | null {
  if (typeof r === 'string') return null
  if (!r || typeof r !== 'object' || Array.isArray(r)) return null
  const o = r as Record<string, unknown>
  if (Array.isArray(o.structuredPatch) && typeof o.filePath === 'string') return 'structured-patch'
  if (typeof o.agentType === 'string' && typeof o.totalDurationMs === 'number') return 'agent-rollup'
  if (Array.isArray(o.questions) && o.answers && typeof o.answers === 'object') return 'ask-user-question'
  if (o.isAsync === true && typeof o.outputFile === 'string') return 'agent-launch'
  if (typeof o.plan === 'string' && typeof o.filePath === 'string' && 'hasTaskTool' in o) return 'exit-plan'
  if (typeof o.query === 'string' && Array.isArray(o.results)) return 'web-search'
  if (typeof o.url === 'string' && typeof o.code === 'number' && 'codeText' in o) return 'web-fetch'
  if (Array.isArray(o.matches) && typeof o.query === 'string' && 'total_deferred_tools' in o) return 'tool-search'
  if (typeof o.commandName === 'string' && typeof o.commandName === 'string') {
    if (typeof (o as { result?: unknown }).result === 'string' && typeof (o as { agentId?: unknown }).agentId === 'string') return 'slash-command-agent'
    return 'command-permission'
  }
  if (typeof o.worktreeBranch === 'string' && typeof o.worktreePath === 'string') return 'exit-worktree'
  if (Array.isArray(o.filenames) && typeof o.mode === 'string') return 'multi-file'
  if (typeof o.stderr === 'string' && typeof o.stdout === 'string') return 'bash'
  const file = (o as { file?: Record<string, unknown> }).file
  if (o.type === 'text' && file && typeof file === 'object' && typeof file.filePath === 'string') return 'read-file'
  if (typeof o.taskId === 'string' && Array.isArray(o.updatedFields)) return 'task-update'
  if (Array.isArray(o.tasks)) return 'task-list'
  if (o.task && typeof o.task === 'object') return 'task-create'
  return 'generic'
}

function sidecarLabel(variant: SidecarVariant): string {
  switch (variant) {
    case 'structured-patch': return 'Structured patch'
    case 'agent-rollup': return 'Subagent rollup'
    case 'ask-user-question': return 'Q & A'
    case 'agent-launch': return 'Agent launch'
    case 'bash': return 'Bash stdio'
    case 'read-file': return 'Read result'
    case 'task-update': return 'Task update'
    case 'task-list': return 'Task list'
    case 'task-create': return 'Task created'
    case 'multi-file': return 'Multi-file result'
    case 'web-search': return 'Web search'
    case 'web-fetch': return 'Web fetch'
    case 'exit-plan': return 'Plan'
    case 'tool-search': return 'Tool search'
    case 'slash-command-agent': return 'Slash command'
    case 'command-permission': return 'Command permission'
    case 'exit-worktree': return 'Worktree exit'
    default: return 'Structured result'
  }
}

function SidecarBody({ variant, result }: { variant: SidecarVariant; result: ToolUseResult }) {
  if (variant === 'structured-patch') {
    const r = result as EditResult | WriteResult
    return <BlockStructuredPatch filePath={r.filePath} structuredPatch={r.structuredPatch} />
  }
  if (variant === 'agent-rollup') {
    return <BlockAgentRollup rollup={result as AgentRollupResult} mode="expanded" />
  }
  if (variant === 'ask-user-question') {
    return <BlockAskUserQuestion result={result as AskUserQuestionResult} />
  }
  if (variant === 'bash') {
    return <BlockBashSidecar result={result as BashResult} />
  }
  return <GenericKeyValue result={result} variant={variant} />
}

/**
 * Renders an object's salient fields. Skips very large strings (>1 KB) and
 * deeply nested objects; shows scalars + small arrays as a key/value table.
 */
function GenericKeyValue({ result, variant }: { result: ToolUseResult; variant: SidecarVariant }) {
  if (typeof result === 'string') return <pre className="va-tool-sidecar-text">{result}</pre>
  if (!result || typeof result !== 'object') return null
  if (Array.isArray(result)) {
    return <pre className="va-tool-sidecar-text">{JSON.stringify(result, null, 2).slice(0, 4000)}</pre>
  }
  const entries = Object.entries(result as Record<string, unknown>)
    .filter(([, v]) => v !== undefined && v !== null)
    .filter(([k]) => !LARGE_BODY_KEYS.has(k))
  return (
    <dl className="va-tool-sidecar-kv" data-variant={variant}>
      {entries.map(([k, v]) => (
        <KvRow key={k} k={k} v={v} />
      ))}
    </dl>
  )
}

const LARGE_BODY_KEYS = new Set([
  // Already shown elsewhere or simply too large to inline.
  'originalFile',
  'content',
  'oldString',
  'newString',
  'structuredPatch',
  'stdout',
  'stderr',
])

function KvRow({ k, v }: { k: string; v: unknown }) {
  return (
    <>
      <dt>{k}</dt>
      <dd>{renderValue(v)}</dd>
    </>
  )
}

function renderValue(v: unknown): React.ReactNode {
  if (v === null || v === undefined) return <span className="va-tool-sidecar-muted">—</span>
  if (typeof v === 'string') {
    const truncated = v.length > 320 ? v.slice(0, 320) + '…' : v
    return <span className="va-tool-sidecar-value">{truncated}</span>
  }
  if (typeof v === 'number' || typeof v === 'boolean') {
    return <span className="va-tool-sidecar-value">{String(v)}</span>
  }
  if (Array.isArray(v)) {
    if (v.length === 0) return <span className="va-tool-sidecar-muted">[]</span>
    const allScalar = v.every((x) => typeof x === 'string' || typeof x === 'number' || typeof x === 'boolean')
    if (allScalar) {
      return <span className="va-tool-sidecar-value">{v.join(', ')}</span>
    }
    return <pre className="va-tool-sidecar-text">{JSON.stringify(v, null, 2).slice(0, 1200)}</pre>
  }
  if (typeof v === 'object') {
    return <pre className="va-tool-sidecar-text">{JSON.stringify(v, null, 2).slice(0, 1200)}</pre>
  }
  return <span className="va-tool-sidecar-value">{String(v)}</span>
}
