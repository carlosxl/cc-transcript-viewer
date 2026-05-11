import { create } from 'zustand'

/**
 * Live-tail UI state (Phase 3 W3.4).
 *
 *   autoFollow:   whether the transcript should auto-scroll to the bottom on
 *                 new turns. Set by Virtuoso's atBottomStateChange — true when
 *                 the user is parked at the bottom, false the moment they
 *                 scroll up.
 *
 *   pendingCount: number of new turns received since autoFollow flipped to
 *                 false. Drives the "N new messages" floating button (LIVE-02).
 *                 Cleared when the user clicks the button (or scrolls back to
 *                 the bottom, which re-engages autoFollow).
 */
interface LiveState {
  autoFollow: boolean
  pendingCount: number
  setAutoFollow: (b: boolean) => void
  incrementPending: (n?: number) => void
  clearPending: () => void
}

export const useLiveStore = create<LiveState>((set) => ({
  autoFollow: true,
  pendingCount: 0,
  setAutoFollow: (b) => set((s) => {
    // Re-engaging autoFollow always clears pendingCount — there's nothing
    // "pending" once you're back at the bottom.
    if (b && s.pendingCount > 0) return { autoFollow: true, pendingCount: 0 }
    return { autoFollow: b }
  }),
  incrementPending: (n = 1) => set((s) => ({ pendingCount: s.pendingCount + n })),
  clearPending: () => set({ pendingCount: 0 }),
}))
