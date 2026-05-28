import { useEffect, type RefObject } from 'react'
import { subscribeLive } from '@/api/live'
import { useLiveTail as useLiveTailStore } from '@/stores/useLiveTail'
import { useSessionStack } from '@/stores/useSessionStack'

interface UseLiveTailOpts {
  /** Session id to subscribe to. Pass null/undefined when no session is loaded. */
  sessionId: string | null | undefined
  /** Whether the active session is live per its SessionMeta. */
  isLive: boolean
  /** Body scroller used to decide auto-follow vs toast. */
  bodyRef: RefObject<HTMLDivElement | null>
}

const NEAR_BOTTOM_PX = 24

/**
 * Subscribes to /api/live/:sessionId for the active session.
 *
 * - Only runs when the session is live AND the stack is NOT in a subagent
 *   (FR-102: live updates are suppressed while drilled in).
 * - On `snapshot` → flips the "Live" chip on via the live-tail store.
 * - On `turns`    → checks the body's scroll position; if the user is at the
 *   bottom (within ~24px) the turns are pushed straight in, otherwise they
 *   buffer and raise the toast.
 * - Tears down on session change, subagent drill, or unmount.
 */
export function useLiveTail({ sessionId, isLive, bodyRef }: UseLiveTailOpts): void {
  useEffect(() => {
    if (!sessionId || !isLive) return
    if (useSessionStack.getState().isSubagent()) return

    const store = useLiveTailStore.getState()
    store.reset()

    const unsubscribe = subscribeLive(sessionId, {
      onSnapshot: () => {
        useLiveTailStore.getState().setLivePending(true)
      },
      onTurns: ({ turns }) => {
        if (!turns || turns.length === 0) return
        const el = bodyRef.current
        const userAtBottom = el
          ? el.scrollHeight - el.clientHeight - el.scrollTop < NEAR_BOTTOM_PX
          : true
        const inSubagent = useSessionStack.getState().isSubagent()
        useLiveTailStore.getState().appendTurns(turns, { userAtBottom, inSubagent })
      },
      onError: () => {
        // EventSource will auto-reconnect; nothing to do here besides not
        // crashing the chip.
      },
    })

    return () => {
      unsubscribe()
      useLiveTailStore.getState().reset()
    }
  }, [sessionId, isLive, bodyRef])
}
