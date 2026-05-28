import { useMemo } from 'react'
import {
  resolveWeights,
  CACHE_MULTIPLIERS,
  projectStickyState,
  DEFAULT_STICKY_STATE,
} from '@cc-viewer/shared'
import type {
  AttachmentRow,
  ClaudeRowOrUnknown,
  StickyState,
  ToolUseResult,
} from '@cc-viewer/shared'
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
  ToolStatus,
  ToolUse,
  Turn,
} from '@/lib/types'
import { getToolArgSummary } from '@/lib/toolArgs'

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

/**
 * Convert a user-role Turn's tool_results into Attachments for display under the
 * owning SessionTurn. Only *orphan* tool_results — those without a matching
 * tool_use anywhere in the session — are surfaced here, because tool_results
 * that pair with an assistant tool_use are already rendered inline in that
 * request's tool_use block via `ToolBlock.output`. Surfacing them again as
 * "attached events" creates a misleading duplicate that visually implies they
 * arrived at prompt time, when they're actually the agent's own tool work
 * spread over the turn.
 *
 * Orphans, when they appear, represent harness-injected context (e.g. a
 * pre-prompt git-status fetch) that has no LLM-issued tool_use to anchor to.
 */
function buildAttachments(turn: Turn, usesById: Map<string, ToolUse>): Attachment[] {
  const out: Attachment[] = []
  for (const r of turn.toolResults ?? []) {
    if (usesById.has(r.tool_use_id)) continue
    const body = stringifyToolResultContent(r.content)
    out.push({
      kind: 'tool_result',
      desc: body ? body.slice(0, 120) : r.tool_use_id,
      ts: turn.timestamp,
      tokens: body ? Math.ceil(body.length / 4) : 0,
      toolUseId: r.tool_use_id,
      isError: r.is_error,
      body,
    })
  }
  return out
}

function stringifyToolResultContent(content: ToolResult['content']): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .map((c) => {
      if (!c || typeof c !== 'object') return ''
      const obj = c as { type?: unknown; text?: unknown; tool_name?: unknown }
      if (typeof obj.text === 'string') return obj.text
      if (obj.type === 'image') return '[image]'
      // ToolSearch results include tool_reference blocks pointing to
      // lazily-loaded MCP tool schemas. Render them as a short marker so the
      // reader sees which tools were schema-loaded, without dumping the raw
      // shape into the body.
      if (obj.type === 'tool_reference' && typeof obj.tool_name === 'string') {
        return `[ref: ${obj.tool_name}]`
      }
      return ''
    })
    .filter(Boolean)
    .join('\n')
}

function toolResultToString(result: ToolResult | undefined): string | undefined {
  if (!result) return undefined
  return stringifyToolResultContent(result.content) || undefined
}

const CANCEL_MARKER = '[Request interrupted by user for tool use]'
// Claude Code injects this body when the user declines a tool permission prompt
// (e.g. clicks "No, keep planning" on an ExitPlanMode dialog). Not a real error
// — same UX category as a Ctrl-C cancellation.
const REJECT_MARKER = 'The tool use was rejected'

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
  return {
    agentType: ref.agentType,
    turnCount,
    toolCallCount,
    cost,
    description: ref.description || undefined,
  }
}

interface BuildRequestOpts {
  assistant: Turn
  /** Timestamp of the immediately preceding non-meta turn (used to derive TTFT). */
  prevTimestamp: string | undefined
  /** Upstream API requestId for this assistant row, when known. */
  requestId: string | undefined
  resultsById: Map<string, ToolResult>
  interactionsById: Map<string, ToolInteraction>
  subagentsByAgentId: Map<string, SubagentRef>
  toolUseResultsById: Map<string, ToolUseResult>
}

/**
 * Compute the display label for a Request. Anthropic request IDs share a long
 * stable prefix within a session (e.g. all `req_011CbQr…`), so the random tail
 * is what differentiates them. We strip `req_` and return the LAST 8 chars.
 * Falls back to the first 8 chars of the row uuid when no upstream id exists.
 */
function deriveDisplayId(requestId: string | undefined, fallbackUuid: string): string {
  if (requestId && requestId.length > 0) {
    const stripped = requestId.startsWith('req_') ? requestId.slice(4) : requestId
    return stripped.slice(-8)
  }
  return fallbackUuid.slice(0, 8)
}

function deriveTtft(prevTimestamp: string | undefined, assistantTimestamp: string): number | null {
  if (!prevTimestamp || !assistantTimestamp) return null
  const start = Date.parse(prevTimestamp)
  const end = Date.parse(assistantTimestamp)
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null
  const delta = end - start
  return delta > 0 ? delta : null
}

function buildRequest({ assistant, prevTimestamp, requestId, resultsById, interactionsById, subagentsByAgentId, toolUseResultsById }: BuildRequestOpts): Request {
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
    const childAgentId = toolUse.childAgentId
    const subagentRef = childAgentId ? subagentsByAgentId.get(childAgentId) : undefined
    const outputText = toolResultToString(result)
    // Claude Code marks user-interrupted tool calls by injecting a synthetic
    // tool_result whose body contains `[Request interrupted by user for tool
    // use]`. There is no dedicated wire flag, so we pattern-match here and
    // promote the status to 'cancelled' so the UI can distinguish it from
    // a genuine error.
    const status: ToolStatus = outputText && (outputText.includes(CANCEL_MARKER) || outputText.includes(REJECT_MARKER))
      ? 'cancelled'
      : statusFrom(interaction)
    const toolBlock: ToolBlock = {
      kind: 'tool_use',
      toolUseId: toolUse.id,
      name: toolUse.name,
      input: toolUse.input,
      output: outputText,
      preview: previewFrom(interaction),
      status,
      durationMs: interaction?.durationMs ?? null,
      isSubagent: Boolean(childAgentId),
      subagentRef: childAgentId,
      subagentMetrics: subagentRef ? metricsForSubagent(subagentRef) : undefined,
      toolUseResult: toolUseResultsById.get(toolUse.id),
    }
    blocks.push(toolBlock)
    if (DIFF_TOOLS.has(toolUse.name)) {
      const filePath = String(
        (toolUse.input.file_path as string | undefined) ??
          (toolUse.input.path as string | undefined) ??
          (toolUse.input.notebook_path as string | undefined) ??
          '',
      )
      const diff = interaction?.diff
      const hunks = buildHunks(toolUse.name, toolUse.input)
      // Count adds/dels off the rendered hunks so the badge always matches what
      // the diff body displays. The server-side interaction.diff carries NET
      // line counts (max(0, newN-oldN)) which diverge from the hunk count
      // whenever an Edit replaces N lines with M lines (both > 0).
      const adds = hunks.reduce((s, h) => s + (h.type === 'add' ? 1 : 0), 0)
      const dels = hunks.reduce((s, h) => s + (h.type === 'del' ? 1 : 0), 0)
      const diffBlock: DiffBlock = {
        kind: 'diff',
        toolUseId: toolUse.id,
        path: diff?.filePath ?? filePath,
        lang: langOf(diff?.filePath ?? filePath),
        adds,
        dels,
        hunks,
      }
      blocks.push(diffBlock)
    }
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
    displayId: deriveDisplayId(requestId, assistant.uuid),
    duration: durationMs,
    ttft: deriveTtft(prevTimestamp, assistant.timestamp),
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
 * Walk a turn's tool_use blocks in chronological order and tag any call that
 * follows an earlier same-tool failure as a retry. A subsequent successful
 * call clears the chain so we don't tag unrelated downstream calls.
 */
function markRetries(turn: SessionTurn): void {
  const lastFailedByName = new Map<string, string>()
  for (const request of turn.requests) {
    for (const block of request.blocks) {
      if (block.kind !== 'tool_use') continue
      const prior = lastFailedByName.get(block.name)
      if (prior && prior !== block.toolUseId) {
        block.retryOf = prior
      }
      if (block.status === 'err') {
        lastFailedByName.set(block.name, block.toolUseId)
      } else if (block.status === 'ok') {
        lastFailedByName.delete(block.name)
      }
    }
  }
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

  // Inverse lookup: tool_use_id → ToolUse. Lets attachments display the
  // *intent* (tool name + arg summary) of each tool_result, not just the body.
  const usesById = new Map<string, ToolUse>()
  for (const turn of allTurns) {
    if (turn.role !== 'assistant') continue
    for (const u of turn.toolUses ?? []) {
      usesById.set(u.id, u)
    }
  }

  // Collect structured toolUseResult sidecars (007-ui-information-revamp T028/T029).
  // The sidecar lives on each user row alongside the tool_result content block;
  // we key by tool_use_id so per-Block render can dispatch on its shape.
  const wireRows = detail.rows ?? []
  const toolUseResultsById = collectToolUseResults(wireRows)

  // 007 T018+T040: surface sticky state per Turn so the collapsed turn header
  // can render permission/model/plan/auto/worktree badges. We key sticky state
  // by `promptId`, and resolve a SessionTurn's promptId from the matching user
  // row's `uuid` (Turn.uuid is the user-row UUID; promptId is its sibling).
  const stickyByPromptId = projectStickyState(wireRows)
  const promptIdByUserUuid = collectPromptIdsByUserUuid(wireRows)
  const requestIdByAssistantUuid = collectRequestIdsByAssistantUuid(wireRows)
  const apiErrorAssistantUuids = collectApiErrorAssistantUuids(wireRows)
  const contextAttachmentsByUserUuid = collectContextAttachmentsByUserUuid(wireRows)

  const sessionTurns: SessionTurn[] = []
  let current: SessionTurn | null = null
  let currentRequestId: string | undefined
  let lastModel = ''
  let prevTimestamp: string | undefined

  for (const turn of allTurns) {
    if (turn.isMeta) continue
    if (turn.role === 'user') {
      const turnAttachments = buildAttachments(turn, usesById)
      // Prefer the row-level map (covers historical rows) and fall back to the
      // promptId on the Turn itself — populated by the normalizer for live-tail
      // turns whose source row hasn't been re-synced into detail.rows yet.
      const promptId = promptIdByUserUuid.get(turn.uuid) ?? turn.promptId

      // Fold continuation user rows into the current Turn rather than starting
      // a new one. This makes the UI "turn" align with the Claude Code prompt
      // loop (one prompt → one turn) regardless of how many tool_result
      // envelopes flow back through the wire. Two fold conditions:
      //   1) same promptId as the current Turn — authoritative when promptId
      //      is known on both sides.
      //   2) structural continuation — the row has no text content and only
      //      tool_results. This is always an assistant→tool_use response and
      //      never a human input, so even if promptId is missing (live-tail
      //      rows from a server running an older normalizer), it's still a
      //      continuation of the active Turn.
      const hasMeaningfulText = turn.textBlocks.some((t) => t.trim().length > 0)
      const isToolResultContinuation =
        !hasMeaningfulText && (turn.toolResults?.length ?? 0) > 0
      if (current && ((promptId && current.promptId === promptId) || isToolResultContinuation)) {
        if (turnAttachments.length > 0) current.attachments.push(...turnAttachments)
        prevTimestamp = turn.timestamp || prevTimestamp
        continue
      }

      // Starting a new Turn — reset the request-coalesce key. Subsequent
      // assistant rows are merged into a single Request only within one Turn.
      currentRequestId = undefined

      const sticky: StickyState | undefined =
        promptId != null ? stickyByPromptId.get(promptId) : undefined
      current = {
        id: turn.uuid,
        time: turn.timestamp,
        prompt: turn.textBlocks.join('\n'),
        userMsgId: turn.uuid,
        attachments: turnAttachments,
        requests: [],
        cost: 0,
        promptId,
        sticky: sticky ?? { ...DEFAULT_STICKY_STATE },
        contextAttachments: contextAttachmentsByUserUuid.get(turn.uuid),
        isCompactSummary: turn.isCompactSummary === true ? true : undefined,
      }
      sessionTurns.push(current)
      prevTimestamp = turn.timestamp || prevTimestamp
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
          sticky: { ...DEFAULT_STICKY_STATE },
        }
        sessionTurns.push(current)
        currentRequestId = undefined
      }
      // Same fallback pattern as user turns: wire-row map first, Turn.requestId
      // second (for live-tail rows that haven't been resynced into detail.rows).
      const requestId = requestIdByAssistantUuid.get(turn.uuid) ?? turn.requestId
      const request = buildRequest({
        assistant: turn,
        prevTimestamp,
        requestId,
        resultsById,
        interactionsById,
        subagentsByAgentId,
        toolUseResultsById,
      })
      if (apiErrorAssistantUuids.has(turn.uuid)) request.isApiError = true
      // Claude Code splits a single API request into multiple `assistant` rows
      // (thinking, text, tool_use each in their own row) but tags them all with
      // the same `requestId`. Coalesce them into one Request so the UI shows one
      // REQ entry, matching the API call. Usage is duplicated across rows so we
      // don't add cost/tokens twice — they're already in the first emitted Request.
      const last = current.requests[current.requests.length - 1]
      if (last && requestId && currentRequestId === requestId) {
        last.blocks.push(...request.blocks)
        last.duration += request.duration
      } else {
        current.requests.push(request)
        current.cost += request.cost
        currentRequestId = requestId
      }
      if (request.model) lastModel = request.model
      prevTimestamp = turn.timestamp || prevTimestamp
    }
  }

  for (const t of sessionTurns) markRetries(t)
  attachTurnDurations(sessionTurns, detail.rows ?? [])

  return {
    id: meta.id,
    title: meta.title,
    model: lastModel,
    isLive: meta.isLive,
    parentTurnId: meta.parentTurnId,
    parentSessionTitle: meta.parentSessionTitle,
    turns: sessionTurns,
    // 007: schema-typed wire rows surfaced unchanged. Consumers that don't need
    // them simply ignore the field; the RowItem-based UI consumes them via
    // useFlatRows + useStickyState.
    rows: detail.rows ?? [],
  }
}

/**
 * Build a `userUuid → promptId` map from the wire rows so each projected
 * SessionTurn can resolve its sticky-state lookup key. Skips rows that don't
 * carry a promptId (synthesised or pre-prompt user content).
 */
function collectPromptIdsByUserUuid(rows: ClaudeRowOrUnknown[]): Map<string, string> {
  const out = new Map<string, string>()
  for (const row of rows) {
    if (row.type !== 'user') continue
    const uuid = (row as { uuid?: unknown }).uuid
    const promptId = (row as { promptId?: unknown }).promptId
    if (typeof uuid === 'string' && typeof promptId === 'string' && promptId.length > 0) {
      out.set(uuid, promptId)
    }
  }
  return out
}

/**
 * Build an `assistantUuid → requestId` map from the wire rows. Claude Code
 * writes one assistant JSONL row per content block (thinking, text, tool_use)
 * but tags them all with the same upstream Anthropic API `requestId`. This map
 * lets the projector merge those split rows into a single UI Request.
 */
function collectRequestIdsByAssistantUuid(rows: ClaudeRowOrUnknown[]): Map<string, string> {
  const out = new Map<string, string>()
  for (const row of rows) {
    if (row.type !== 'assistant') continue
    const uuid = (row as { uuid?: unknown }).uuid
    const requestId = (row as { requestId?: unknown }).requestId
    if (typeof uuid === 'string' && typeof requestId === 'string' && requestId.length > 0) {
      out.set(uuid, requestId)
    }
  }
  return out
}

/**
 * Build a Set of assistant-row UUIDs whose `isApiErrorMessage` flag is true.
 * These are SYNTHETIC assistant rows the CLI writes when its own API call
 * failed (overload, auth, etc.) — not LLM output. The matching Request is
 * tagged so the UI can render it as a CLI error, not a normal response.
 */
function collectApiErrorAssistantUuids(rows: ClaudeRowOrUnknown[]): Set<string> {
  const out = new Set<string>()
  for (const row of rows) {
    if (row.type !== 'assistant') continue
    if ((row as { isApiErrorMessage?: unknown }).isApiErrorMessage !== true) continue
    const uuid = (row as { uuid?: unknown }).uuid
    if (typeof uuid === 'string') out.add(uuid)
  }
  return out
}

/**
 * Subset of attachment subtypes worth surfacing on the user prompt as
 * "session context" — i.e. attachments that carry payload the LLM actually
 * received on the resolving API request, that other projections don't already
 * promote elsewhere (auto_mode/plan_mode → sticky badge, etc.).
 */
const CONTEXT_ATTACHMENT_TYPES = new Set(['deferred_tools_delta', 'skill_listing'])

/**
 * For each context-attachment row, walk parentUuid up the chain (attachments
 * chain to other attachments) until the first non-attachment ancestor, and
 * return a `userRowUuid → AttachmentRow[]` map so projectSessionView can hang
 * the attachments on the SessionTurn that owns that user row.
 */
function collectContextAttachmentsByUserUuid(
  rows: ClaudeRowOrUnknown[],
): Map<string, AttachmentRow[]> {
  const byUuid = new Map<string, ClaudeRowOrUnknown>()
  for (const r of rows) {
    const uuid = (r as { uuid?: unknown }).uuid
    if (typeof uuid === 'string') byUuid.set(uuid, r)
  }
  const out = new Map<string, AttachmentRow[]>()
  for (const r of rows) {
    if (r.type !== 'attachment') continue
    const subtype = (r as { attachment?: { type?: unknown } }).attachment?.type
    if (typeof subtype !== 'string' || !CONTEXT_ATTACHMENT_TYPES.has(subtype)) continue
    let cursor: ClaudeRowOrUnknown | undefined = r
    let anchor: string | undefined
    let guard = 0
    while (cursor && guard++ < 64) {
      const parentUuid = (cursor as { parentUuid?: unknown }).parentUuid
      if (typeof parentUuid !== 'string') break
      const parent = byUuid.get(parentUuid)
      if (!parent) break
      if (parent.type !== 'attachment') {
        anchor = parentUuid
        break
      }
      cursor = parent
    }
    if (!anchor) continue
    const list = out.get(anchor) ?? []
    list.push(r as AttachmentRow)
    out.set(anchor, list)
  }
  return out
}

/**
 * Walk schema-typed rows and collect every `toolUseResult` sidecar keyed by
 * its matching tool_use_id (found inside the row's user content array).
 *
 * Returns an empty map for sessions that haven't sent `rows` (older payloads).
 */
function collectToolUseResults(rows: ClaudeRowOrUnknown[]): Map<string, ToolUseResult> {
  const out = new Map<string, ToolUseResult>()
  for (const row of rows) {
    if (row.type !== 'user') continue
    const result = (row as { toolUseResult?: ToolUseResult }).toolUseResult
    if (!result) continue
    const content = (row as { message?: { content?: unknown } }).message?.content
    if (!Array.isArray(content)) continue
    for (const block of content) {
      if (
        block &&
        typeof block === 'object' &&
        (block as { type?: unknown }).type === 'tool_result'
      ) {
        const id = (block as { tool_use_id?: unknown }).tool_use_id
        if (typeof id === 'string' && id.length > 0) {
          out.set(id, result)
          break
        }
      }
    }
  }
  return out
}

/**
 * Walk wire rows in order and attach each `turn_duration` system event's
 * `durationMs`/`messageCount` to the SessionTurn that owns it. Anchors to
 * the most recently seen user-row UUID that maps to a SessionTurn — folded
 * continuation user rows don't appear in the map, so the anchor sticks.
 */
function attachTurnDurations(sessionTurns: SessionTurn[], rows: ClaudeRowOrUnknown[]): void {
  if (rows.length === 0) return
  const userUuidToTurn = new Map<string, SessionTurn>()
  for (const t of sessionTurns) userUuidToTurn.set(t.userMsgId, t)
  let cur: SessionTurn | undefined
  for (const row of rows) {
    if (row.type === 'user') {
      const uuid = (row as { uuid?: unknown }).uuid
      const found = typeof uuid === 'string' ? userUuidToTurn.get(uuid) : undefined
      if (found) cur = found
      continue
    }
    if (row.type !== 'system') continue
    const sub = (row as { subtype?: unknown }).subtype
    if (sub !== 'turn_duration' || !cur) continue
    const r = row as { durationMs?: unknown; messageCount?: unknown }
    if (typeof r.durationMs === 'number') cur.durationMs = r.durationMs
    if (typeof r.messageCount === 'number') cur.messageCount = r.messageCount
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
