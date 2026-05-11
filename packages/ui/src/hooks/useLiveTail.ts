import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { Turn, SessionDetailResponse, SubagentDetailResponse } from '@cc-viewer/shared'
import { useLiveStore } from '@/stores/useLiveStore'

export type LiveStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'closed'

/** No event for this long → close + reopen + invalidate query (Pitfall 7). */
const HEARTBEAT_TIMEOUT_MS = 30_000
const WATCHDOG_INTERVAL_MS = 5_000

/**
 * Subscribe to /api/live/:sessionId (or its subagent variant) and merge
 * appended turns into the TanStack Query cache for the corresponding key.
 *
 * Pitfall 8 — re-render storm: incoming turns are buffered in a closure ref
 * and flushed once per requestAnimationFrame, capping React reconciles at
 * ~60/s regardless of message rate.
 *
 * Pitfall 7 — silent TCP drop after sleep: a 5s watchdog checks the time
 * since the last event; if it exceeds 30s we tear down the EventSource,
 * invalidate the query (so the next render shows the latest disk state),
 * and reopen. The browser's native EventSource auto-reconnect is
 * unreliable across sleep boundaries — this watchdog is the safety net.
 *
 * Pass null sessionId to disable; pass agentId to subscribe to the subagent
 * route.
 */
export function useLiveTail(sessionId: string | null, agentId: string | null = null) {
  const [status, setStatus] = useState<LiveStatus>('idle')
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!sessionId) { setStatus('idle'); return }

    const url = agentId
      ? `/api/live/${encodeURIComponent(sessionId)}/subagents/${encodeURIComponent(agentId)}`
      : `/api/live/${encodeURIComponent(sessionId)}`
    const queryKey: readonly unknown[] = agentId
      ? ['subagent', sessionId, agentId]
      : ['session', sessionId]

    let buf: Turn[] = []
    let rafHandle: number | null = null
    let lastEvent = Date.now()
    let watchdogHandle: ReturnType<typeof setInterval> | null = null
    let es: EventSource | null = null
    let closed = false

    const flush = () => {
      rafHandle = null
      if (buf.length === 0) return
      const turns = buf
      buf = []
      queryClient.setQueryData<SessionDetailResponse | SubagentDetailResponse | undefined>(
        queryKey,
        (old) => old ? { ...old, turns: [...old.turns, ...turns] } as typeof old : old,
      )
      if (!useLiveStore.getState().autoFollow) {
        useLiveStore.getState().incrementPending(turns.length)
      }
    }

    const scheduleFlush = () => {
      if (rafHandle != null) return
      rafHandle = requestAnimationFrame(flush)
    }

    const open = () => {
      setStatus('connecting')
      es = new EventSource(url)
      es.addEventListener('snapshot', () => {
        lastEvent = Date.now()
        setStatus('connected')
      })
      es.addEventListener('turns', (ev) => {
        lastEvent = Date.now()
        try {
          const data = JSON.parse((ev as MessageEvent).data) as { turns: Turn[] }
          buf.push(...data.turns)
          scheduleFlush()
        } catch {
          /* malformed payload — drop, the next event will catch up */
        }
      })
      es.addEventListener('ping', () => {
        lastEvent = Date.now()
      })
      es.addEventListener('error', () => {
        if (closed) return
        // EventSource will auto-attempt reconnect; the watchdog handles real
        // failure. Just reflect status.
        setStatus('reconnecting')
      })
    }

    const watchdogTick = () => {
      if (closed) return
      if (Date.now() - lastEvent <= HEARTBEAT_TIMEOUT_MS) return
      // Stale — force reconnect + cache invalidation so the UI catches up
      // to whatever was appended during the silent window.
      es?.close()
      void queryClient.invalidateQueries({ queryKey: queryKey as unknown[] })
      lastEvent = Date.now()
      open()
    }

    open()
    watchdogHandle = setInterval(watchdogTick, WATCHDOG_INTERVAL_MS)

    return () => {
      closed = true
      if (rafHandle != null) cancelAnimationFrame(rafHandle)
      if (watchdogHandle) clearInterval(watchdogHandle)
      es?.close()
      setStatus('closed')
    }
  }, [sessionId, agentId, queryClient])

  return { status }
}
