// packages/server/src/reader/subagent-linker.ts
import type { ClaudeEvent, Turn, SubagentRef } from '@cc-viewer/shared'

/**
 * Subagent linker — bridges parent tool_use blocks to their subagent JSONL files.
 *
 * Three resolution sources, in fallback order:
 *
 *   1. queue-operation events. The most structured signal: `content` field
 *      carries XML-like <task-id> + <tool-use-id> tags emitted by Claude Code
 *      when a Task tool_use is enqueued. task-id matches the subagent filename
 *      stem (= agentId).
 *
 *   2. tool_result content text. The user-message that follows an Agent/Task
 *      tool_use carries plain text "Async agent launched successfully.\nagentId:
 *      <id>...". Less structured but ubiquitous.
 *
 *   3. Filename → agentId fallback. Already done by loadSessionFromDisk; the
 *      agentId is the source of truth even when the parent linkage is unknown.
 *      In that case toolUseId stays '' and the UI shows AGENT-04's "subagent
 *      transcript not found" affordance.
 *
 * The linker also computes:
 *   - childAgentId on each parent ToolUse (for the UI drill-in entry point).
 *   - childAgentIds[] on each SubagentRef (for nested-agent navigation).
 *   - status hints from queue-operation operations and tool_result is_error.
 */

const TOOL_NAMES_THAT_SPAWN_AGENTS = new Set(['Agent', 'Task'])

export interface AgentLink {
  toolUseId: string
  taskId: string
}

export interface SubagentLinkages {
  /** agentId → parent toolUseId, or absent when unresolved. */
  agentToToolUse: Map<string, string>
  /** parent toolUseId → child agentId (inverse of above; for ToolUse.childAgentId). */
  toolUseToAgent: Map<string, string>
  /** agentId → inferred lifecycle status. */
  agentStatus: Map<string, SubagentRef['status']>
  /** spawnerAgentId ('' = main) → list of child agentIds spawned by that source. */
  childrenByAgent: Map<string, string[]>
}

/**
 * Extract <task-id> + <tool-use-id> from a queue-operation `content` string.
 * Format observed in real sessions:
 *   "<task-id>a09b6a258d073239e</task-id><tool-use-id>toolu_01ABC...</tool-use-id>"
 * Whitespace and additional tags are tolerated.
 */
export function extractAgentLink(content: string): AgentLink | null {
  const taskMatch = content.match(/<task-id>([^<]+)<\/task-id>/)
  const toolUseMatch = content.match(/<tool-use-id>([^<]+)<\/tool-use-id>/)
  const taskId = taskMatch?.[1]?.trim()
  const toolUseId = toolUseMatch?.[1]?.trim()
  if (!taskId || !toolUseId) return null
  return { toolUseId, taskId }
}

/**
 * Extract agentId from a tool_result content string. Source 2 fallback per
 * ARCHITECTURE.md:163-164. Tolerates surrounding text and arbitrary case.
 *   "Async agent launched successfully.\nagentId: a09b6a258d073239e ..."
 */
export function extractAgentIdFromToolResult(text: string): string | null {
  const m = text.match(/agentId:\s*([A-Za-z0-9_-]+)/)
  return m ? m[1]! : null
}

/**
 * Build the full set of linkages between parent tool_uses and child subagents
 * across all event streams. Pure function; consumers apply the result by
 * mutating SubagentRef and ToolUse fields.
 *
 * @param parentEvents Events from the main session JSONL.
 * @param subagentEventsByAgentId Events from each subagent JSONL, keyed by
 *   agentId (= filename stem). These are scanned both as a source of children
 *   spawned by THIS subagent, and to recognize spawn events whose toolUseId
 *   originates from inside the subagent itself.
 */
export function buildSubagentLinkages(
  parentEvents: ClaudeEvent[],
  subagentEventsByAgentId: Map<string, ClaudeEvent[]>,
): SubagentLinkages {
  const agentToToolUse = new Map<string, string>()
  const toolUseToAgent = new Map<string, string>()
  const agentStatus = new Map<string, SubagentRef['status']>()
  const childrenByAgent = new Map<string, string[]>()

  // Default status for every known subagent. Overridden below if a more
  // specific signal is found (failed / killed). 'completed' matches the legacy
  // pre-linker placeholder so existing behavior is preserved when sources fail.
  for (const agentId of subagentEventsByAgentId.keys()) {
    agentStatus.set(agentId, 'completed')
    childrenByAgent.set(agentId, [])
  }
  childrenByAgent.set('', [])

  type Source = { spawnerAgentId: string; events: ClaudeEvent[] }
  const sources: Source[] = [
    { spawnerAgentId: '', events: parentEvents },
    ...Array.from(subagentEventsByAgentId.entries()).map(
      ([id, events]) => ({ spawnerAgentId: id, events }),
    ),
  ]

  const recordLinkage = (
    spawnerAgentId: string,
    childAgentId: string,
    toolUseId: string,
  ): void => {
    if (!subagentEventsByAgentId.has(childAgentId)) return
    // toolUseId is the unique key — at most one subagent per tool_use. If this
    // tool_use has already been claimed (typically by Source 1 over Source 2),
    // drop the duplicate signal entirely; do NOT register the losing agent as
    // a child of the spawner.
    if (toolUseToAgent.has(toolUseId)) return
    if (!agentToToolUse.has(childAgentId)) agentToToolUse.set(childAgentId, toolUseId)
    toolUseToAgent.set(toolUseId, childAgentId)
    const kids = childrenByAgent.get(spawnerAgentId) ?? []
    if (!kids.includes(childAgentId)) {
      kids.push(childAgentId)
      childrenByAgent.set(spawnerAgentId, kids)
    }
  }

  for (const { spawnerAgentId, events } of sources) {
    // ── Source 1: queue-operation events.
    for (const e of events) {
      if (e.type !== 'queue-operation') continue
      const content = e.content
      if (typeof content !== 'string') continue
      const link = extractAgentLink(content)
      if (!link) continue
      recordLinkage(spawnerAgentId, link.taskId, link.toolUseId)

      // Lifecycle hints: 'remove' marks completion, 'popAll' marks force-kill.
      // 'enqueue' alone is ambiguous (could still be running); 'dequeue' fires
      // when the worker picks up the task, also non-terminal.
      if (e.operation === 'remove') agentStatus.set(link.taskId, 'completed')
      else if (e.operation === 'popAll') agentStatus.set(link.taskId, 'killed')
    }

    // ── Source 2: tool_result content "agentId: ..." paired with the
    // preceding Agent/Task tool_use within this same event stream.
    const agentToolUseIds = new Set<string>()
    for (const e of events) {
      if (e.type !== 'assistant') continue
      const blocks = e.message?.content
      if (!Array.isArray(blocks)) continue
      for (const b of blocks) {
        if (!isObject(b)) continue
        const type = (b as Record<string, unknown>)['type']
        const name = (b as Record<string, unknown>)['name']
        const id = (b as Record<string, unknown>)['id']
        if (type === 'tool_use' && typeof name === 'string'
            && TOOL_NAMES_THAT_SPAWN_AGENTS.has(name) && typeof id === 'string') {
          agentToolUseIds.add(id)
        }
      }
    }

    for (const e of events) {
      if (e.type !== 'user') continue
      const content = e.message.content
      if (!Array.isArray(content)) continue
      for (const b of content) {
        if (!isObject(b)) continue
        const obj = b as Record<string, unknown>
        if (obj['type'] !== 'tool_result') continue
        const toolUseId = obj['tool_use_id']
        if (typeof toolUseId !== 'string') continue
        if (!agentToolUseIds.has(toolUseId)) continue

        const text = stringifyToolResultContent(obj['content'])
        const childAgentId = extractAgentIdFromToolResult(text)
        if (!childAgentId) continue
        recordLinkage(spawnerAgentId, childAgentId, toolUseId)

        if (obj['is_error'] === true) {
          agentStatus.set(childAgentId, 'failed')
        }
      }
    }
  }

  return { agentToToolUse, toolUseToAgent, agentStatus, childrenByAgent }
}

/**
 * Apply linkages to in-memory data structures.
 * Mutates: each `ToolUse.childAgentId` per `toolUseToAgent`; each
 * `SubagentRef.toolUseId` / `.status` / `.childAgentIds` per the linkage maps.
 */
export function applyLinkages(
  mainTurns: Turn[],
  subagents: SubagentRef[],
  linkages: SubagentLinkages,
): void {
  for (const turn of mainTurns) applyToolUseChildIds(turn, linkages.toolUseToAgent)
  for (const sa of subagents) {
    for (const turn of sa.turns) applyToolUseChildIds(turn, linkages.toolUseToAgent)
    sa.toolUseId = linkages.agentToToolUse.get(sa.agentId) ?? ''
    sa.status = linkages.agentStatus.get(sa.agentId) ?? 'completed'
    sa.childAgentIds = linkages.childrenByAgent.get(sa.agentId) ?? []
  }
}

function applyToolUseChildIds(turn: Turn, toolUseToAgent: Map<string, string>): void {
  for (const tu of turn.toolUses) {
    const childId = toolUseToAgent.get(tu.id)
    if (childId) tu.childAgentId = childId
  }
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * tool_result `content` is `string | unknown[]`. Concatenate all `text` blocks
 * for the Source 2 regex to scan; non-text blocks contribute empty string.
 */
function stringifyToolResultContent(content: unknown): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  const parts: string[] = []
  for (const block of content) {
    if (!isObject(block)) continue
    const text = (block as Record<string, unknown>)['text']
    if (typeof text === 'string') parts.push(text)
  }
  return parts.join('\n')
}
