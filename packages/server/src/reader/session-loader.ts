// packages/server/src/reader/session-loader.ts
import { readFile, stat } from 'node:fs/promises'
import { existsSync, readdirSync } from 'node:fs'
import { join, basename, extname, dirname } from 'node:path'
import type { Session, Turn, SubagentRef, AggregatedUsage, UsageSummary, ClaudeEvent } from '@cc-viewer/shared'
import { parseJSONL } from './parser.js'
import { eventsToTurns } from './normalizer.js'
import { buildSubagentLinkages, applyLinkages } from './subagent-linker.js'

export interface SessionLoadResult {
  session: Session
  mtimeMs: number
}

/**
 * Read a single session JSONL from disk and produce the full Session payload.
 *
 * Phase 1 strategy (D-18, D-19):
 *   - Full-file non-exclusive read via `fs.readFile` — coexists with Claude
 *     Code holding the file open for append.
 *   - Partial trailing line is tolerated by the parser (D-16).
 *   - If a companion subagents/ directory exists, each agent-*.jsonl is parsed
 *     into a SubagentRef. Meta files (agent-*.meta.json) are read best-effort.
 *
 * @param jsonlPath Absolute path to the main session JSONL file.
 * @returns The Session + the mtimeMs used for cache invalidation.
 */
export async function loadSessionFromDisk(jsonlPath: string): Promise<SessionLoadResult> {
  const st = await stat(jsonlPath)
  const mtimeMs = st.mtimeMs

  const content = await readFile(jsonlPath, 'utf8')
  const { events, parseWarnings: mainWarnings } = parseJSONL(content)
  const mainTurns = eventsToTurns(events)

  // Derive session metadata from events.
  const sessionId = basename(jsonlPath, extname(jsonlPath))
  const projectSlug = basename(dirname(jsonlPath))
  const projectPath = decodeProjectSlug(projectSlug)

  const title = pickTitle(events, sessionId)
  const firstTimestamp = findTimestamp(events, 'forward') ?? ''
  const lastTimestamp = findTimestamp(events, 'reverse') ?? firstTimestamp

  // Companion subagents directory.
  const subagentsDir = join(dirname(jsonlPath), sessionId, 'subagents')
  const hasSubagents = existsSync(subagentsDir)
  const subagents: SubagentRef[] = []
  const subagentEventsByAgentId = new Map<string, ClaudeEvent[]>()
  let subagentWarnings = 0

  if (hasSubagents) {
    const agentFiles = readdirSync(subagentsDir).filter(f => f.startsWith('agent-') && f.endsWith('.jsonl'))
    for (const agentFile of agentFiles) {
      const agentId = agentFile.replace(/^agent-/, '').replace(/\.jsonl$/, '')
      const agentPath = join(subagentsDir, agentFile)
      const agentContent = await readFile(agentPath, 'utf8')
      const { events: agentEvents, parseWarnings: w } = parseJSONL(agentContent)
      subagentWarnings += w
      subagentEventsByAgentId.set(agentId, agentEvents)

      const metaPath = join(subagentsDir, `agent-${agentId}.meta.json`)
      let meta: { agentType?: string; description?: string } = {}
      if (existsSync(metaPath)) {
        try {
          meta = JSON.parse(await readFile(metaPath, 'utf8')) as typeof meta
        } catch {
          // best-effort; ignore meta parse errors
        }
      }

      subagents.push({
        agentId,
        agentType: meta.agentType ?? 'unknown',
        description: meta.description ?? '',
        toolUseId: '',           // populated by applyLinkages below
        status: 'completed',     // overwritten by applyLinkages when signal exists
        turns: eventsToTurns(agentEvents),
        childAgentIds: [],       // populated by applyLinkages below
      })
    }
  }

  // Resolve subagent ↔ parent-tool_use linkages (W1.1). Mutates mainTurns'
  // ToolUse.childAgentId, each subagent's turns' ToolUse.childAgentId, and
  // each SubagentRef's toolUseId/status/childAgentIds in place.
  if (subagents.length > 0) {
    const linkages = buildSubagentLinkages(events, subagentEventsByAgentId)
    applyLinkages(mainTurns, subagents, linkages)
  }

  const totalUsage = aggregateUsage(mainTurns, subagents)
  const messageCount = mainTurns.filter(t => t.role === 'user' || t.role === 'assistant').length

  const session: Session = {
    sessionId,
    projectSlug,
    projectPath,
    title,
    firstTimestamp,
    lastTimestamp,
    messageCount,
    isLive: false,  // Phase 2+ computes from mtime
    hasSubagents,
    totalUsage,
    turns: mainTurns,
    subagents,
    parseWarnings: mainWarnings + subagentWarnings,
  }

  return { session, mtimeMs }
}

/**
 * D-22 title precedence:
 *   custom-title > ai-title > agent-name > first 80 chars of last-prompt > sessionId prefix
 */
function pickTitle(events: import('@cc-viewer/shared').ClaudeEvent[], sessionId: string): string {
  const findStr = <K extends 'custom-title' | 'ai-title' | 'agent-name' | 'last-prompt'>(
    type: K,
    field: 'customTitle' | 'aiTitle' | 'agentName' | 'lastPrompt',
  ): string | null => {
    // Prefer the LAST occurrence (latest update wins).
    for (let i = events.length - 1; i >= 0; i--) {
      const e = events[i]!
      if (e.type === type) {
        const v = (e as unknown as Record<string, unknown>)[field]
        if (typeof v === 'string' && v.length > 0) return v
      }
    }
    return null
  }

  return (
    findStr('custom-title', 'customTitle') ??
    findStr('ai-title', 'aiTitle') ??
    findStr('agent-name', 'agentName') ??
    (findStr('last-prompt', 'lastPrompt')?.slice(0, 80) ?? null) ??
    sessionId // F-3: full sessionId; CSS .truncate owns visual overflow
  )
}

/**
 * Find the first (or last) `timestamp` field across the event stream.
 *
 * Note: `UnknownEvent` (D-15 fallback arm) does not carry `timestamp` directly
 * — its raw payload may have one, but accessing fields off `unknown` requires
 * a manual narrow. This helper inspects every arm uniformly via `'timestamp' in e`
 * and a runtime `typeof === 'string'` check; if neither known nor unknown event
 * yields a usable timestamp, returns null.
 */
function findTimestamp(
  events: import('@cc-viewer/shared').ClaudeEvent[],
  direction: 'forward' | 'reverse',
): string | null {
  const start = direction === 'forward' ? 0 : events.length - 1
  const step = direction === 'forward' ? 1 : -1
  const end = direction === 'forward' ? events.length : -1

  for (let i = start; i !== end; i += step) {
    const e = events[i]!
    if ('timestamp' in e && typeof (e as { timestamp?: unknown }).timestamp === 'string') {
      return (e as { timestamp: string }).timestamp
    }
    // For UnknownEvent the raw object may carry timestamp.
    if (e.type === 'unknown') {
      const raw = e.raw as Record<string, unknown> | undefined
      if (typeof raw?.timestamp === 'string') return raw.timestamp
    }
  }
  return null
}

/**
 * Slug encoding: cwd path with `/` replaced by `-` and leading `-` added.
 * (See ARCHITECTURE.md §"File System Layout".)
 */
function decodeProjectSlug(slug: string): string {
  // The encoding is lossy (cannot distinguish "-" in paths from "/"), so we
  // reconstruct best-effort: leading "-" becomes "/", remaining "-" become "/".
  // Consumers use the slug as the stable key; the decoded path is display-only.
  if (!slug.startsWith('-')) return slug
  return '/' + slug.slice(1).split('-').join('/')
}

/**
 * Aggregate per-agent and total usage across main + subagents.
 * Subagent tokens counted once (from each subagent's own JSONL), never from
 * parent tool_result summaries (prevents double-counting per STATE.md + PITFALL 10).
 */
function aggregateUsage(mainTurns: Turn[], subagents: SubagentRef[]): AggregatedUsage {
  const empty = (): UsageSummary => ({
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
  })

  const byAgent: Record<string, UsageSummary> = { '': empty() }
  for (const t of mainTurns) {
    if (t.usage) addUsage(byAgent[''] ?? (byAgent[''] = empty()), t.usage)
  }

  for (const sa of subagents) {
    const sum = byAgent[sa.agentId] ?? (byAgent[sa.agentId] = empty())
    for (const t of sa.turns) {
      if (t.usage) addUsage(sum, t.usage)
    }
  }

  const total = empty()
  for (const s of Object.values(byAgent)) {
    total.inputTokens += s.inputTokens
    total.outputTokens += s.outputTokens
    total.cacheCreationTokens += s.cacheCreationTokens
    total.cacheReadTokens += s.cacheReadTokens
  }

  return { ...total, byAgent }
}

function addUsage(sum: UsageSummary, u: import('@cc-viewer/shared').UsageBlock): void {
  sum.inputTokens += u.input_tokens ?? 0
  sum.outputTokens += u.output_tokens ?? 0
  sum.cacheCreationTokens += u.cache_creation_input_tokens ?? 0
  sum.cacheReadTokens += u.cache_read_input_tokens ?? 0
}
