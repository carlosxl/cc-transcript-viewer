import { useEffect, useRef } from 'react'
import type { VirtualNode } from '@/lib/flatNodes'
import { useUIStore } from '@/stores/useUIStore'
import { useNavigationStore } from '@/stores/useNavigationStore'
import { useSearchStore } from '@/stores/useSearchStore'

/**
 * Centralized global keyboard shortcuts.
 *
 * Mounted once at the top of `TranscriptPane`. The hook attaches a single
 * window-level `keydown` listener that dispatches across:
 *   - `c` / `d` — view mode (compact / details)
 *   - `t`       — toggle theme
 *   - `j` / `k` — advance / retreat ONE TURN at a time (not one row). When
 *                 the caller hands the hook the flat-node array, j/k snap to
 *                 the next/previous turn boundary so all child rows of a turn
 *                 (text + thinking + capsules + diff) read as one selection
 *                 block. Without the array (legacy/tests), j/k step by one
 *                 node. Always clears any tool/diff drill-in so the right
 *                 rail switches to the per-turn MessageInspector — click a
 *                 capsule to restore the drill-in.
 *   - `/`       — open the search palette
 *   - `r`       — toggle the Session Report modal (FR-017). Suppressed when
 *                 the search palette OR the narrow bottom sheet is open.
 *   - `Escape`  — ordered priority chain (FR-019):
 *                 1. close Session Report
 *                 2. close search palette
 *                 3. close bottom sheet
 *                 4. clear Inspector selection
 *                 5. clear focused-message index
 *
 * Skipped when the user is typing in an input/textarea/contentEditable, and
 * when any modifier is pressed (so ⌘K, Cmd+T, etc. pass through).
 */
export function useKeyboardShortcuts(nodeCount: number): void
export function useKeyboardShortcuts(nodes: VirtualNode[]): void
export function useKeyboardShortcuts(arg: number | VirtualNode[]): void {
  const nodes = Array.isArray(arg) ? arg : null
  const nodeCount = nodes ? nodes.length : (arg as number)

  const setViewMode = useUIStore((s) => s.setViewMode)
  const toggleTheme = useUIStore((s) => s.toggleTheme)
  const setFocusedMsgIndex = useNavigationStore((s) => s.setFocusedMsgIndex)
  const openSearch = useSearchStore((s) => s.open)

  // Hold the latest nodes array in a ref so the keydown listener doesn't need
  // to re-attach when the flat-node array changes ref (which it does on every
  // live-tail update).
  const nodesRef = useRef<VirtualNode[] | null>(nodes)
  nodesRef.current = nodes

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return

      const t = e.target as HTMLElement | null
      const inEditable =
        t?.tagName === 'INPUT' ||
        t?.tagName === 'TEXTAREA' ||
        (t as HTMLElement | null)?.isContentEditable
      if (inEditable) return

      const k = e.key.toLowerCase()
      switch (k) {
        case 'c':
          e.preventDefault()
          setViewMode('compact')
          return
        case 'd':
          e.preventDefault()
          setViewMode('details')
          return
        case 't':
          e.preventDefault()
          toggleTheme()
          return
        case 'j': {
          e.preventDefault()
          if (nodeCount === 0) return
          const nav = useNavigationStore.getState()
          const current = nav.focusedMsgIndex
          const ns = nodesRef.current
          // From "no focus" (-1) j lands on row 0, not row 1.
          const next = ns
            ? nextTurnBoundary(ns, current)
            : current < 0 ? 0 : Math.min(nodeCount - 1, current + 1)
          if (nav.selectedInteractionId !== null) nav.setSelectedInteractionId(null)
          setFocusedMsgIndex(next)
          return
        }
        case 'k': {
          e.preventDefault()
          const nav = useNavigationStore.getState()
          const current = nav.focusedMsgIndex
          const ns = nodesRef.current
          const next = ns
            ? prevTurnBoundary(ns, current)
            : Math.max(0, current < 0 ? 0 : current - 1)
          if (nav.selectedInteractionId !== null) nav.setSelectedInteractionId(null)
          setFocusedMsgIndex(next)
          return
        }
        case '/':
          e.preventDefault()
          openSearch()
          return
        case 'r': {
          // Suppress when an "overlay" layer (search / narrow sheet) is in front.
          if (useSearchStore.getState().isOpen) return
          if (useUIStore.getState().narrowSheetOpen) return
          e.preventDefault()
          useUIStore.getState().toggleSessionReportOpen()
          return
        }
        case 'escape': {
          // Don't preventDefault — Radix dialogs handle their own escape, and
          // SessionReportDrawer explicitly suppresses Radix's default so this
          // hook is the single arbiter.
          const ui = useUIStore.getState()
          const sr = useSearchStore.getState()
          const nav = useNavigationStore.getState()
          if (ui.sessionReportOpen) {
            ui.setSessionReportOpen(false)
            return
          }
          if (sr.isOpen) {
            sr.close()
            return
          }
          if (ui.narrowSheetOpen) {
            ui.setNarrowSheetOpen(false)
            return
          }
          if (nav.selectedInteractionId !== null) {
            nav.setSelectedInteractionId(null)
            return
          }
          setFocusedMsgIndex(-1)
          return
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [nodeCount, setViewMode, toggleTheme, setFocusedMsgIndex, openSearch])
}

// ── Turn-boundary helpers (exported for tests) ───────────────────────────

/** Index of the first node belonging to the turn AFTER the one currently
 *  focused. From "no focus" (-1) lands on node 0. Clamps to the last node. */
export function nextTurnBoundary(nodes: VirtualNode[], from: number): number {
  if (nodes.length === 0) return -1
  if (from < 0) return 0
  const fromUuid = nodes[from]?.turn.uuid
  for (let i = from + 1; i < nodes.length; i++) {
    if (nodes[i]!.turn.uuid !== fromUuid) return i
  }
  return from
}

/** Index of the first node belonging to the turn BEFORE the one currently
 *  focused. When the caller is mid-turn (not at the boundary), snaps up to
 *  the current turn's first node instead — that's a forgiving "exit upward"
 *  on `k` from a child row. */
export function prevTurnBoundary(nodes: VirtualNode[], from: number): number {
  if (nodes.length === 0) return -1
  if (from < 0) return 0
  const fromUuid = nodes[from]?.turn.uuid
  // Walk back to the first node of the current turn.
  let firstOfCurrent = from
  while (firstOfCurrent > 0 && nodes[firstOfCurrent - 1]!.turn.uuid === fromUuid) {
    firstOfCurrent--
  }
  // If we were already there, step into the previous turn.
  if (firstOfCurrent === from && firstOfCurrent > 0) {
    let i = firstOfCurrent - 1
    const prevUuid = nodes[i]!.turn.uuid
    while (i > 0 && nodes[i - 1]!.turn.uuid === prevUuid) i--
    return i
  }
  return firstOfCurrent
}
