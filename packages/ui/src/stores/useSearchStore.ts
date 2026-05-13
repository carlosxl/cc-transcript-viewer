import { create } from 'zustand'

/**
 * Search palette state — Phase 4.
 *
 * UI shape: ⌘K opens a CommandDialog. Typing a query fetches /api/search.
 * Clicking a result closes the palette, switches the active session (and
 * subagent stack), and asks TranscriptPane to scroll to + expand the matched
 * turn via `pendingJumpTarget`. TranscriptPane consumes & clears the target
 * once the turn becomes resolvable in the flat node array.
 *
 * Result data is fetched via TanStack Query (useSearchQuery) — the store only
 * holds the open/closed flag, the live query string, and the jump target.
 */

export interface JumpTarget {
  sessionId: string
  agentId: string | null
  turnUuid: string
  /**
   * Phase 5: when set, scroll to the matching tool-capsule row (instead of the
   * turn row) and flash it. Used by Inspector "Jump back". Form: `${turnUuid}:${toolUseId}`.
   */
  interactionId?: string
}

interface SearchState {
  isOpen: boolean
  query: string
  pendingJumpTarget: JumpTarget | null
  open: () => void
  close: () => void
  setQuery: (q: string) => void
  /** Triggered by SearchPalette when a result is clicked. TranscriptPane consumes. */
  requestJump: (target: JumpTarget) => void
  /** Cleared by TranscriptPane after the scroll completes. */
  clearJump: () => void
}

export const useSearchStore = create<SearchState>((set) => ({
  isOpen: false,
  query: '',
  pendingJumpTarget: null,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  setQuery: (q) => set({ query: q }),
  requestJump: (target) => set({ pendingJumpTarget: target, isOpen: false }),
  clearJump: () => set({ pendingJumpTarget: null }),
}))
