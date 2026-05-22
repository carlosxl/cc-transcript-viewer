import { useMemo } from 'react'
import { resolveWeights, CACHE_MULTIPLIERS } from '@cc-viewer/shared'
import { useLiveTail } from '@/stores/useLiveTail'
import type {
  Attachment,
  Block,
  DiffBlock,
  DiffHunk,
  Request,
  SessionDetailResponse,
  SessionTurn,
  SessionView,
  SubagentDetailResponse,
  SubagentMetrics,
  SubagentRef,
  ToolBlock,
  ToolInteraction,
  ToolResult,
  Turn,
} from '@/lib/types'

const DIFF_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit'])

const LANG_BY_EXT: Record<string, string> = {
  ts: 'typescript', tsx: 'tsx', js: 'javascript', jsx: 'jsx',
  py: 'python', go: 'go', rs: 'rust', java: 'java', rb: 'ruby',
  md: 'markdown', json: 'json', yaml: 'yaml', yml: 'yaml',
  html: 'html', css: 'css', scss: 'scss', sh: 'shell', bash: 'shell',
  c: 'c', h: 'c', cpp: 'cpp', hpp: 'cpp', cs: 'csharp',
  swift: 'swift', kt: 'kotlin', php: 'php', sql: 'sql',
}

function langOf(path: string | undefined): string {
  if (!path) return ''
  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  return LANG_BY_EXT[ext] ?? ext
}

function toolResultToString(result: ToolResult | undefined): string | undefined {
  if (!result) return undefined
  const content = result.content
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((c) => {
        if (c && typeof c === 'object' && 'text' in c) return String((c as { text?: unknown }).text ?? '')
        return ''
      })
      .filter(Boolean)
      .join('\n')
  }
  return undefined
}

function buildHunks(toolName: string, input: Record<string, unknown>): DiffHunk[] {
  if (toolName === 'Edit') {
    const oldStr = String(input.old_string ?? '')
    const newStr = String(input.new_string ?? '')
    const hunks: DiffHunk[] = []
    if (oldStr) hunks.push(...oldStr.split('\n').map((text) => ({ type: 'del' as const, text })))
    if (newStr) hunks.push(...newStr.split('\n').map((text) => ({ type: 'add' as const, text })))
    return hunks
  }
  if (toolName === 'Write') {
    const content = String(input.content ?? '')
    return content.split('\n').map((text) => ({ type: 'add' as const, text }))
  }
  if (toolName === 'MultiEdit') {
    const edits = Array.isArray(input.edits) ? (input.edits as Array<Record<string, unknown>>) : []
    const hunks: DiffHunk[] = []
    edits.forEach((edit, i) => {
      hunks.push({ type: 'hunk', text: `@@ edit ${i + 1} @@` })
      const oldStr = String(edit.old_string ?? '')
      const newStr = String(edit.new_string ?? '')
      if (oldStr) hunks.push(...oldStr.split('\n').map((text) => ({ type: 'del' as const, text })))
      if (newStr) hunks.push(...newStr.split('\n').map((text) => ({ type: 'add' as const, text })))
    })
    return hunks
  }
  return []
}

function statusFrom(interaction: ToolInteraction | undefined): ToolBlock['status'] {
  if (!interaction) return 'run'
  if (interaction.status === 'fail') return 'err'
  if (interaction.status === 'running') return 'run'
  return 'ok'
}

function previewFrom(interaction: ToolInteraction | undefined): string | undefined {
  if (!interaction) return undefined
  if (interaction.diff) {
    return `${interaction.diff.filePath} (+${interaction.diff.added} −${interaction.diff.removed})`
  }
  if (interaction.preview) {
    const lc = interaction.preview.lineCount
    return lc != null ? `${interaction.preview.filePath} · ${lc} lines` : interaction.preview.filePath
  }
  return undefined
}

function costOfAssistantTurn(turn: Turn): number {
  const usage = turn.usage
  if (!usage) return 0
  const model = turn.model ?? ''
  const weights = resolveWeights(model)
  if (!weights) return 0
  return (
    ((usage.input_tokens ?? 0) * weights.input +
      (usage.cache_creation_input_tokens ?? 0) * weights.input * CACHE_MULTIPLIERS.create5m +
      (usage.cache_read_input_tokens ?? 0) * weights.input * CACHE_MULTIPLIERS.read +
      (usage.output_tokens ?? 0) * weights.output) /
    1_000_000
  )
}

function metricsForSubagent(ref: SubagentRef): SubagentMetrics {
  let turnCount = 0
  let toolCallCount = 0
  let cost = 0
  for (const t of ref.turns) {
    if (t.isMeta) continue
    if (t.role === 'user') turnCount++
    if (t.role === 'assistant') {
      toolCallCount += t.toolUses.length
      cost += costOfAssistantTurn(t)
    }
  }
  return { agentType: ref.agentType, turnCount, toolCallCount, cost }
}

interface BuildRequestOpts {
  assistant: Turn
  resultsById: Map<string, ToolResult>
  interactionsById: Map<string, ToolInteraction>
  subagentsByAgentId: Map<string, SubagentRef>
}

function buildRequest({ assistant, resultsById, interactionsById, subagentsByAgentId }: BuildRequestOpts): Request {
  const blocks: Block[] = []

  for (const body of assistant.thinkingBlocks) {
    blocks.push({ kind: 'thinking', body })
  }
  for (const body of assistant.textBlocks) {
    blocks.push({ kind: 'text', body })
  }
  for (const toolUse of assistant.toolUses) {
    const interaction = interactionsById.get(toolUse.id)
    const result = resultsById.get(toolUse.id)
    if (DIFF_TOOLS.has(toolUse.name)) {
      const filePath = String(
        (toolUse.input.file_path as string | undefined) ??
          (toolUse.input.path as string | undefined) ??
          (toolUse.input.notebook_path as string | undefined) ??
          '',
      )
      const diff = interaction?.diff
      const diffBlock: DiffBlock = {
        kind: 'diff',
        toolUseId: toolUse.id,
        path: diff?.filePath ?? filePath,
        lang: langOf(diff?.filePath ?? filePath),
        adds: diff?.added ?? 0,
        dels: diff?.removed ?? 0,
        hunks: buildHunks(toolUse.name, toolUse.input),
      }
      blocks.push(diffBlock)
      continue
    }
    const childAgentId = toolUse.childAgentId
    const subagentRef = childAgentId ? subagentsByAgentId.get(childAgentId) : undefined
    const block: ToolBlock = {
      kind: 'tool_use',
      toolUseId: toolUse.id,
      name: toolUse.name,
      input: toolUse.input,
      output: toolResultToString(result),
      preview: previewFrom(interaction),
      status: statusFrom(interaction),
      durationMs: interaction?.durationMs ?? null,
      isSubagent: Boolean(childAgentId),
      subagentRef: childAgentId,
      subagentMetrics: subagentRef ? metricsForSubagent(subagentRef) : undefined,
    }
    blocks.push(block)
  }

  const usage = assistant.usage
  const inputTok = usage?.input_tokens ?? 0
  const outputTok = usage?.output_tokens ?? 0
  const ccTok = usage?.cache_creation_input_tokens ?? 0
  const crTok = usage?.cache_read_input_tokens ?? 0
  const model = assistant.model ?? ''
  const weights = resolveWeights(model)
  let cost = 0
  if (weights) {
    cost =
      (inputTok * weights.input +
        ccTok * weights.input * CACHE_MULTIPLIERS.create5m +
        crTok * weights.input * CACHE_MULTIPLIERS.read +
        outputTok * weights.output) /
      1_000_000
  }

  const durationMs = blocks.reduce((acc, b) => {
    if (b.kind === 'tool_use' && b.durationMs != null) return acc + b.durationMs
    return acc
  }, 0)

  return {
    id: assistant.uuid,
    duration: durationMs,
    ttft: null,
    cost,
    blocks,
    tokens: { in: inputTok, out: outputTok, cc: ccTok, cr: crTok },
    model,
  }
}

function dedupTurns(base: Turn[], pending: Turn[]): Turn[] {
  if (pending.length === 0) return base
  const seen = new Set(base.map((t) => t.uuid))
  const extra = pending.filter((t) => !seen.has(t.uuid))
  if (extra.length === 0) return base
  return [...base, ...extra]
}

export interface SessionViewMeta {
  id: string
  title: string
  isLive: boolean
  parentTurnId?: string
  parentSessionTitle?: string
}

/**
 * Pure projection of a wire detail response + any pending live turns into the
 * design's two-level SessionView. Used both by the `useSessionView` hook (main
 * session) and imperatively on subagent drill (`App.tsx`).
 */
export function projectSessionView(
  detail: SessionDetailResponse | SubagentDetailResponse,
  meta: SessionViewMeta,
  pendingTurns: Turn[] = [],
): SessionView {
  const allTurns = dedupTurns(detail.turns, pendingTurns)

  const interactionsById = new Map<string, ToolInteraction>()
  for (const interaction of detail.toolInteractions ?? []) {
    interactionsById.set(interaction.toolUseId, interaction)
  }

  const subagentsByAgentId = new Map<string, SubagentRef>()
  for (const s of ('subagents' in detail ? detail.subagents : []) ?? []) {
    subagentsByAgentId.set(s.agentId, s)
  }

  // Collect ToolResult lookup across all user turns (results travel on the
  // user role's toolResults arrays in the JSONL stream).
  const resultsById = new Map<string, ToolResult>()
  for (const turn of allTurns) {
    for (const r of turn.toolResults ?? []) {
      resultsById.set(r.tool_use_id, r)
    }
  }

  const sessionTurns: SessionTurn[] = []
  let current: SessionTurn | null = null
  let lastModel = ''

  for (const turn of allTurns) {
    if (turn.isMeta) continue
    if (turn.role === 'user') {
      const attachments: Attachment[] = (turn.toolResults ?? []).map<Attachment>((r) => ({
        kind: 'tool_result',
        desc: typeof r.content === 'string' ? r.content.slice(0, 120) : `${r.tool_use_id}`,
        ts: turn.timestamp,
        tokens: typeof r.content === 'string' ? Math.ceil(r.content.length / 4) : 0,
      }))
      current = {
        id: turn.uuid,
        time: turn.timestamp,
        prompt: turn.textBlocks.join('\n'),
        userMsgId: turn.uuid,
        attachments,
        requests: [],
        cost: 0,
      }
      sessionTurns.push(current)
      continue
    }
    if (turn.role === 'assistant') {
      if (!current) {
        // Synthesize a synthetic user turn so the assistant request still has a home.
        current = {
          id: turn.uuid + '-orphan',
          time: turn.timestamp,
          prompt: '',
          userMsgId: turn.uuid + '-orphan',
          attachments: [],
          requests: [],
          cost: 0,
        }
        sessionTurns.push(current)
      }
      const request = buildRequest({
        assistant: turn,
        resultsById,
        interactionsById,
        subagentsByAgentId,
      })
      current.requests.push(request)
      current.cost += request.cost
      if (request.model) lastModel = request.model
    }
  }

  return {
    id: meta.id,
    title: meta.title,
    model: lastModel,
    isLive: meta.isLive,
    parentTurnId: meta.parentTurnId,
    parentSessionTitle: meta.parentSessionTitle,
    turns: sessionTurns,
  }
}

/**
 * Project a wire SessionDetailResponse (or SubagentDetailResponse) plus any
 * pending live turns into the design's two-level SessionView (R-01).
 *
 * Returns null when no detail is loaded yet. Memoizes on the underlying turns
 * + projections, so identity-stable re-renders cost essentially nothing.
 */
export function useSessionView(
  detail: SessionDetailResponse | SubagentDetailResponse | null,
  meta: SessionViewMeta,
): SessionView | null {
  const pendingTurns = useLiveTail((s) => s.pendingTurns)

  return useMemo(() => {
    if (!detail) return null
    return projectSessionView(detail, meta, pendingTurns)
  }, [detail, pendingTurns, meta.id, meta.title, meta.isLive, meta.parentTurnId, meta.parentSessionTitle])
}
