import { apiEventSource } from './client'
import type { Turn } from '@/lib/types'

interface SnapshotPayload {
  sessionId: string
}

interface TurnsPayload {
  turns: Turn[]
}

export interface LiveHandlers {
  onSnapshot?: (payload: SnapshotPayload) => void
  onTurns?: (payload: TurnsPayload) => void
  onError?: (e: Event) => void
}

/**
 * SSE subscription to /api/live/:sessionId (R-05).
 *
 * Returns an unsubscribe function. EventSource auto-reconnects on transient
 * drops, so callers do not need to retry on `error` themselves.
 */
export function subscribeLive(sessionId: string, h: LiveHandlers): () => void {
  return apiEventSource(`/api/live/${encodeURIComponent(sessionId)}`, {
    events: {
      snapshot: (data) => h.onSnapshot?.(data as SnapshotPayload),
      turns: (data) => h.onTurns?.(data as TurnsPayload),
      ping: () => {
        /* heartbeat — ignore */
      },
    },
    onError: h.onError,
  })
}
