import type { ToolInteraction } from '@cc-viewer/shared'
import { useUIStore } from '@/stores/useUIStore'
import { useNavigationStore } from '@/stores/useNavigationStore'
import { useSession } from './useSession'
import { useSubagent } from './useSubagent'

/**
 * Resolve the `ToolInteraction[]` for whichever entry (parent session or
 * drilled-in subagent) the user is currently viewing. Reads the same
 * react-query caches `TranscriptPane` reads, so no extra fetch — the inner
 * row components can call this without a prop bus.
 *
 * Returns `undefined` while the detail is still loading or when no session
 * is selected; consumers degrade gracefully.
 */
export function useActiveInteractions(): ToolInteraction[] | undefined {
  const activeSessionId = useUIStore((s) => s.activeSessionId)
  const drillStack = useNavigationStore((s) => s.drillStack)
  const drillTop = drillStack[drillStack.length - 1]
  const onSubagent = drillTop !== undefined && drillTop.sessionId === activeSessionId
  const sessionQuery = useSession(onSubagent ? null : activeSessionId)
  const subagentQuery = useSubagent(
    onSubagent ? drillTop.sessionId : null,
    onSubagent ? drillTop.agentId : null,
  )
  return onSubagent
    ? subagentQuery.data?.toolInteractions
    : sessionQuery.data?.toolInteractions
}
