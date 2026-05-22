import { create } from 'zustand'
import type { SessionView } from '@/lib/types'

export interface FocusSnapshot {
  nodeId: string | null
  blockId: string | null
  scrollTop: number
}

export interface SessionStackFrame {
  view: SessionView
  parentLabel: string | null
  focusSnapshot?: FocusSnapshot
}

interface SessionStackState {
  stack: SessionStackFrame[]
  push: (view: SessionView, parentLabel: string, snapshot: FocusSnapshot) => void
  /** returns the focus snapshot of the now-current (parent) frame */
  pop: () => FocusSnapshot | undefined
  replaceRoot: (view: SessionView) => void
  current: () => SessionStackFrame | null
  isSubagent: () => boolean
}

export const useSessionStack = create<SessionStackState>((set, get) => ({
  stack: [],
  push: (view, parentLabel, snapshot) =>
    set((s) => {
      const next = [...s.stack]
      if (next.length > 0) {
        // attach the snapshot to the parent (top of stack before push)
        next[next.length - 1] = { ...next[next.length - 1], focusSnapshot: snapshot }
      }
      next.push({ view, parentLabel, focusSnapshot: undefined })
      return { stack: next }
    }),
  pop: () => {
    const s = get()
    if (s.stack.length <= 1) return undefined
    const next = s.stack.slice(0, -1)
    set({ stack: next })
    return next[next.length - 1].focusSnapshot
  },
  replaceRoot: (view) =>
    set((s) => {
      // Same session as current root → refresh in place and KEEP any subagent
      // frames on top (so live-tail / detail refetches don't pop the user out
      // of a drilled-in subagent). Different session → reset the stack.
      if (s.stack.length > 0 && s.stack[0].view.id === view.id) {
        const next = [...s.stack]
        next[0] = { ...next[0], view }
        return { stack: next }
      }
      return { stack: [{ view, parentLabel: null, focusSnapshot: undefined }] }
    }),
  current: () => {
    const s = get().stack
    return s.length === 0 ? null : s[s.length - 1]
  },
  isSubagent: () => get().stack.length > 1,
}))
