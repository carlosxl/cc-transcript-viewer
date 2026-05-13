import { create } from 'zustand'
import { useUIStore } from './useUIStore'

/**
 * Navigation state — Phase 3 W1.3.
 *
 * The viewer has a two-level model:
 *   Bottom: the "selected" session (held by useUIStore.activeSessionId — the
 *           sidebar drives this; one click in the sidebar replaces the bottom).
 *   Top:    a stack of subagent drill-ins layered on top of the current session.
 *
 * Splitting these concerns keeps existing useUIStore-based tests untouched.
 * The current viewing location is `useCurrentEntry()` which combines both
 * stores: drillStack top wins, otherwise the active session is the location.
 */

export interface SubagentFrame {
  sessionId: string
  agentId: string
}

interface NavState {
  /** Subagents drilled into on top of the active session. Empty = at session root. */
  drillStack: SubagentFrame[]
  /** Index into the flat-node array of the currently focused transcript row.
   *  `-1` means "no row focused". Driven by j/k keyboard shortcuts (Phase 3). */
  focusedMsgIndex: number
  /** Id of the ToolInteraction selected by the user (`${turnUuid}:${toolUseId}`).
   *  Phase 4: capsules + diff blocks write this; Phase 5 binds the right rail
   *  to it. `null` = nothing selected. Resets on entry change. */
  selectedInteractionId: string | null
  /** Push a subagent drill-in onto the stack. */
  pushSubagent: (frame: SubagentFrame) => void
  /** Pop the top subagent (one level back toward the parent). */
  popSubagent: () => void
  /** Truncate the drill stack to length `n` (used by breadcrumb clicks). */
  truncateTo: (n: number) => void
  /** Replace the entire drill stack — used by hash decoder + session changes. */
  setDrillStack: (stack: SubagentFrame[]) => void
  /** Set the focused message index (clamped at the call site). */
  setFocusedMsgIndex: (i: number) => void
  /** Set (or clear) the currently selected tool interaction. */
  setSelectedInteractionId: (id: string | null) => void
}

export const useNavigationStore = create<NavState>((set) => ({
  drillStack: [],
  /** -1 = no row focused (no primary-tint ring). j moves to 0 (first row). */
  focusedMsgIndex: -1,
  selectedInteractionId: null,
  pushSubagent: (frame) => set((s) => ({ drillStack: [...s.drillStack, frame] })),
  popSubagent: () => set((s) => ({ drillStack: s.drillStack.slice(0, -1) })),
  truncateTo: (n) => set((s) => ({ drillStack: s.drillStack.slice(0, Math.max(0, n)) })),
  setDrillStack: (stack) => set({ drillStack: stack }),
  setFocusedMsgIndex: (i) => set({ focusedMsgIndex: i }),
  setSelectedInteractionId: (id) => set({ selectedInteractionId: id }),
}))

export type CurrentEntry =
  | { kind: 'session'; sessionId: string }
  | { kind: 'subagent'; sessionId: string; agentId: string }

/** Stable id string for an entry — used as the snapshot key for expand/scroll state. */
export function entryToId(entry: CurrentEntry): string {
  return entry.kind === 'session'
    ? `session:${entry.sessionId}`
    : `subagent:${entry.sessionId}:${entry.agentId}`
}

/**
 * Compute the current entry from raw store state. Pure — exported for tests
 * and for the snapshot reconciler in main.tsx.
 */
export function deriveCurrentEntry(
  activeSessionId: string | null,
  drillStack: SubagentFrame[],
): CurrentEntry | undefined {
  if (!activeSessionId) return undefined
  const top = drillStack[drillStack.length - 1]
  if (top && top.sessionId === activeSessionId) {
    return { kind: 'subagent', sessionId: top.sessionId, agentId: top.agentId }
  }
  return { kind: 'session', sessionId: activeSessionId }
}

/** React hook — current entry, or undefined when nothing is selected. */
export function useCurrentEntry(): CurrentEntry | undefined {
  const activeSessionId = useUIStore((s) => s.activeSessionId)
  const drillStack = useNavigationStore((s) => s.drillStack)
  return deriveCurrentEntry(activeSessionId, drillStack)
}

// ────────────────────────────────────────────────────────────────────────────
// Hash <-> stack codec
// ────────────────────────────────────────────────────────────────────────────

/**
 * Decode `window.location.hash` into a partial navigation state.
 * Recognized forms:
 *   #/sessions/:id                              → bottom session, no drill
 *   #/sessions/:id/subagents/:agentId           → bottom session + 1 drill
 *
 * Multi-level deep-links aren't encoded in v1 (the breadcrumb supplies the
 * intermediate stack at runtime). On a deep refresh the user lands at the
 * leaf-most entry with a single-element drill stack — acceptable per AGENT-02.
 */
export function decodeLocationHash(hash: string): { sessionId: string; drillStack: SubagentFrame[] } | null {
  const path = hash.startsWith('#') ? hash.slice(1) : hash
  const m2 = path.match(/^\/sessions\/([^/]+)\/subagents\/([^/]+)\/?$/)
  if (m2) {
    return {
      sessionId: decodeURIComponent(m2[1]!),
      drillStack: [{ sessionId: decodeURIComponent(m2[1]!), agentId: decodeURIComponent(m2[2]!) }],
    }
  }
  const m1 = path.match(/^\/sessions\/([^/]+)\/?$/)
  if (m1) {
    return { sessionId: decodeURIComponent(m1[1]!), drillStack: [] }
  }
  return null
}

/** Encode the current entry as a hash string (no leading #). Empty if no entry. */
export function encodeLocationHash(entry: CurrentEntry | undefined): string {
  if (!entry) return ''
  const sid = encodeURIComponent(entry.sessionId)
  if (entry.kind === 'session') return `#/sessions/${sid}`
  return `#/sessions/${sid}/subagents/${encodeURIComponent(entry.agentId)}`
}
