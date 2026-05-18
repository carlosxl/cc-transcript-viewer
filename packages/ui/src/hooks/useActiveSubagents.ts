import type { SubagentRef } from '@cc-viewer/shared'
import { useUIStore } from '@/stores/useUIStore'
import { useNavigationStore } from '@/stores/useNavigationStore'
import { useSession } from './useSession'

/**
 * Resolve the parent session's `SubagentRef[]` for the currently active view.
 *
 * Used by `StdoutBlock` to find an orphan subagent (no Task tool_use parent,
 * but a `parentTurnUuid` linkage from the linker's Source 3) to render a
 * drill-in button on the matching `<local-command-stdout>` turn.
 *
 * Only main-session subagents are returned today. When the user is drilled
 * INTO a subagent that itself spawned skill-style children, those nested
 * orphans are not yet exposed — the `SubagentDetailResponse` only carries
 * `childAgentIds: string[]` without the full per-child record. Extend the
 * detail response when a real session surfaces that case.
 */
export function useActiveSubagents(): SubagentRef[] | undefined {
  const activeSessionId = useUIStore((s) => s.activeSessionId)
  const drillStack = useNavigationStore((s) => s.drillStack)
  const drillTop = drillStack[drillStack.length - 1]
  const onSubagent = drillTop !== undefined && drillTop.sessionId === activeSessionId
  const sessionQuery = useSession(onSubagent ? null : activeSessionId)
  return onSubagent ? undefined : sessionQuery.data?.subagents
}
