import { create } from 'zustand'
import type { Turn } from '@/lib/types'

interface LiveTailState {
  /** "Live" chip in the transcript header */
  livePending: boolean
  /** Buffered turns from SSE not yet merged into the SessionView */
  pendingTurns: Turn[]
  /** Toast at the bottom of tx-body */
  tailToast: boolean
  setLivePending: (v: boolean) => void
  /**
   * Append new turns from SSE. Decides toast vs auto-follow based on inputs:
   *   userAtBottom → no toast; caller is expected to consume + scroll
   *   inSubagent   → suppress toast (FR-102), still buffer turns
   *   otherwise    → raise tailToast
   */
  appendTurns: (turns: Turn[], opts: { userAtBottom: boolean; inSubagent: boolean }) => void
  /** Empties pendingTurns; returns the drained array for the caller to merge. */
  consumePending: () => Turn[]
  dismissToast: () => void
  reset: () => void
}

export const useLiveTail = create<LiveTailState>((set, get) => ({
  livePending: false,
  pendingTurns: [],
  tailToast: false,
  setLivePending: (livePending) => set({ livePending }),
  appendTurns: (turns, { userAtBottom, inSubagent }) =>
    set((s) => {
      const pendingTurns = [...s.pendingTurns, ...turns]
      const tailToast = !userAtBottom && !inSubagent ? true : s.tailToast
      return { pendingTurns, tailToast }
    }),
  consumePending: () => {
    const drained = get().pendingTurns
    set({ pendingTurns: [] })
    return drained
  },
  dismissToast: () => set({ tailToast: false }),
  reset: () => set({ livePending: false, pendingTurns: [], tailToast: false }),
}))
