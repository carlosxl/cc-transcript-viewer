import type { Turn, ToolInteraction, TokenSeries, FileTouchIndex } from '@cc-viewer/shared'
import { useUIStore } from '@/stores/useUIStore'
import { useNavigationStore } from '@/stores/useNavigationStore'
import { useSession } from './useSession'
import { useSubagent } from './useSubagent'

/**
 * Returns the turns + projections for whichever entry (parent session or
 * drilled-in subagent) the user is currently viewing.
 *
 * Reads the same react-query caches `TranscriptPane` reads — no extra fetch.
 * Inspector, Tokens, and Files panels all consume this so the rail honours
 * the active drill scope without each one re-implementing the branching.
 */
export interface ActiveQuery {
  turns: Turn[] | undefined
  interactions: ToolInteraction[] | undefined
  tokenSeries: TokenSeries | undefined
  fileTouchIndex: FileTouchIndex | undefined
  /** `null` when on the main session; non-null when drilled into a subagent. */
  agentId: string | null
  sessionId: string | null
}

export function useActiveQuery(): ActiveQuery {
  const activeSessionId = useUIStore((s) => s.activeSessionId)
  const drillStack = useNavigationStore((s) => s.drillStack)
  const drillTop = drillStack[drillStack.length - 1]
  const onSubagent = drillTop !== undefined && drillTop.sessionId === activeSessionId
  const sessionQuery = useSession(onSubagent ? null : activeSessionId)
  const subagentQuery = useSubagent(
    onSubagent ? drillTop.sessionId : null,
    onSubagent ? drillTop.agentId : null,
  )
  const data = onSubagent ? subagentQuery.data : sessionQuery.data
  return {
    turns: data?.turns,
    interactions: data?.toolInteractions,
    tokenSeries: data?.tokenSeries,
    fileTouchIndex: data?.fileTouchIndex,
    agentId: onSubagent ? drillTop.agentId : null,
    sessionId: onSubagent ? drillTop.sessionId : activeSessionId,
  }
}
