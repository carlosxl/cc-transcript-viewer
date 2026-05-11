import type { SessionMeta } from '@cc-viewer/shared'
import { useSessionList } from './useSessionList'
import { useUIStore } from '../stores/useUIStore'

/**
 * Selector hook: returns the SessionMeta for the currently-active session, or
 * undefined when no session is active or the list is still loading.
 *
 * Why this hook exists: SessionMeta lives on the LIST cache (GET /api/sessions),
 * NOT on SessionDetailResponse (GET /api/sessions/:id, which returns
 * { turns, subagents, usage, parseWarnings } — no meta field). The transcript
 * header needs SessionMeta to render title / token totals / metadata popover,
 * so it pulls from the list cache filtered by useUIStore.activeSessionId.
 *
 * Referential stability: returns the exact SessionMeta object from the list
 * (Array.prototype.find returns the same reference on re-renders when the
 * list array reference is stable, which TanStack Query maintains across
 * cache hits).
 */
export function useActiveSessionMeta(): SessionMeta | undefined {
  const activeSessionId = useUIStore((s) => s.activeSessionId)
  const { data: sessions } = useSessionList()
  if (activeSessionId === null) return undefined
  if (!sessions) return undefined
  return sessions.find((s) => s.sessionId === activeSessionId)
}
