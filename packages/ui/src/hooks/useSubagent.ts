import { useQuery } from '@tanstack/react-query'
import { fetchSubagent } from '../api'

/**
 * GET /api/sessions/:id/subagents/:agentId wrapper. Phase 3 W1.4.
 *
 * staleTime is Infinity to mirror useSession; Phase 3 W3.3 adds the SSE-driven
 * cache invalidation for live subagents. Disabled when either id is null —
 * the caller passes nulls when not on a subagent route.
 */
export function useSubagent(sessionId: string | null, agentId: string | null) {
  return useQuery({
    queryKey: ['subagent', sessionId, agentId],
    queryFn: () => fetchSubagent(sessionId!, agentId!),
    enabled: sessionId !== null && agentId !== null,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })
}
