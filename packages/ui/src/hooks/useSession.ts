import { useQuery } from '@tanstack/react-query'
import { fetchSession } from '../api'

/**
 * GET /api/sessions/:id wrapper. Sessions are immutable in Phase 2 (Phase 3 owns
 * live-tail SSE which will invalidate the cache for active sessions). staleTime
 * Infinity prevents re-fetches after the initial load.
 * refetchOnWindowFocus is OFF (Open Question 3 — no point when staleTime is Infinity).
 */
export function useSession(sessionId: string | null) {
  return useQuery({
    queryKey: ['session', sessionId],
    queryFn: () => fetchSession(sessionId!),
    enabled: sessionId !== null,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })
}
