import { useEffect, useState } from 'react'
import type { SearchStatusResponse } from '@cc-viewer/shared'
import { fetchSearchStatus } from '../api'

/**
 * Polls /api/search/status every 500ms while the reconciler is working.
 * Stops once isReconciling flips to false. Polling is simpler than SSE for
 * this small payload and avoids an extra long-lived connection.
 *
 * Triggered only when `enabled` is true — typically while the search palette
 * is open.
 */
export function useSearchProgress(enabled: boolean): SearchStatusResponse | null {
  const [status, setStatus] = useState<SearchStatusResponse | null>(null)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false

    const tick = async () => {
      try {
        const next = await fetchSearchStatus()
        if (!cancelled) setStatus(next)
        return next
      } catch {
        return null
      }
    }

    let timer: number | undefined
    const loop = async () => {
      const next = await tick()
      if (cancelled) return
      // Continue polling while reconciling, slower otherwise.
      const delay = next?.isReconciling ? 500 : 5000
      timer = window.setTimeout(loop, delay)
    }
    loop()

    return () => {
      cancelled = true
      if (timer !== undefined) window.clearTimeout(timer)
    }
  }, [enabled])

  return status
}
