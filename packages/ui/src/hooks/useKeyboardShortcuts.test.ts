import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, cleanup } from '@testing-library/react'
import { useKeyboardShortcuts, nextTurnBoundary, prevTurnBoundary } from './useKeyboardShortcuts'
import type { VirtualNode } from '@/lib/flatNodes'
import type { Turn } from '@cc-viewer/shared'
import { useUIStore } from '@/stores/useUIStore'
import { useNavigationStore } from '@/stores/useNavigationStore'
import { useSearchStore } from '@/stores/useSearchStore'

function makeTurn(uuid: string): Turn {
  return {
    uuid, parentUuid: null, timestamp: '2026-05-13T10:00:00Z',
    role: 'assistant', textBlocks: [], thinkingBlocks: [], toolUses: [],
    toolResults: [], isMeta: false, agentId: null,
  }
}
/** Three turns: turn A (1 row), turn B (3 rows), turn C (2 rows). */
function makeNodes(): VirtualNode[] {
  const a = makeTurn('A'), b = makeTurn('B'), c = makeTurn('C')
  return [
    { kind: 'turn',    key: 'A:0', turn: a },
    { kind: 'turn',    key: 'B:0', turn: b },
    { kind: 'capsule', key: 'B:1', turn: b, toolUseId: 't1' },
    { kind: 'capsule', key: 'B:2', turn: b, toolUseId: 't2' },
    { kind: 'turn',    key: 'C:0', turn: c },
    { kind: 'capsule', key: 'C:1', turn: c, toolUseId: 't3' },
  ]
}

function press(opts: Partial<KeyboardEventInit> & { key: string }): void {
  const e = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...opts })
  window.dispatchEvent(e)
}

beforeEach(() => {
  useUIStore.setState({
    theme: 'light',
    viewMode: 'compact',
    sessionReportOpen: false,
    narrowSheetOpen: false,
  })
  useNavigationStore.setState({ focusedMsgIndex: 0, selectedInteractionId: null })
  useSearchStore.setState({ isOpen: false })
  cleanup()
})

describe('useKeyboardShortcuts', () => {
  it('j increments focusedMsgIndex and clamps to nodeCount - 1', () => {
    renderHook(() => useKeyboardShortcuts(3))
    press({ key: 'j' })
    expect(useNavigationStore.getState().focusedMsgIndex).toBe(1)
    press({ key: 'j' })
    expect(useNavigationStore.getState().focusedMsgIndex).toBe(2)
    press({ key: 'j' })  // already at max
    expect(useNavigationStore.getState().focusedMsgIndex).toBe(2)
  })

  it('k decrements focusedMsgIndex and clamps to 0', () => {
    useNavigationStore.setState({ focusedMsgIndex: 1 })
    renderHook(() => useKeyboardShortcuts(3))
    press({ key: 'k' })
    expect(useNavigationStore.getState().focusedMsgIndex).toBe(0)
    press({ key: 'k' })
    expect(useNavigationStore.getState().focusedMsgIndex).toBe(0)
  })

  it('j from "no focus" (-1) lands on row 0, not row 1', () => {
    useNavigationStore.setState({ focusedMsgIndex: -1 })
    renderHook(() => useKeyboardShortcuts(5))
    press({ key: 'j' })
    expect(useNavigationStore.getState().focusedMsgIndex).toBe(0)
  })

  it('Escape sets focusedMsgIndex to -1', () => {
    useNavigationStore.setState({ focusedMsgIndex: 4 })
    renderHook(() => useKeyboardShortcuts(10))
    press({ key: 'Escape' })
    expect(useNavigationStore.getState().focusedMsgIndex).toBe(-1)
  })

  it('t toggles theme', () => {
    renderHook(() => useKeyboardShortcuts(0))
    expect(useUIStore.getState().theme).toBe('light')
    press({ key: 't' })
    expect(useUIStore.getState().theme).toBe('dark')
    press({ key: 't' })
    expect(useUIStore.getState().theme).toBe('light')
  })

  it('c / d switch view mode', () => {
    renderHook(() => useKeyboardShortcuts(0))
    press({ key: 'd' })
    expect(useUIStore.getState().viewMode).toBe('details')
    press({ key: 'c' })
    expect(useUIStore.getState().viewMode).toBe('compact')
  })

  it('/ opens the search palette', () => {
    renderHook(() => useKeyboardShortcuts(0))
    press({ key: '/' })
    expect(useSearchStore.getState().isOpen).toBe(true)
  })

  it('ignores all shortcuts when target is an <input>', () => {
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()
    renderHook(() => useKeyboardShortcuts(5))

    // Dispatch directly on the input so `event.target` is the input.
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', bubbles: true }))
    expect(useNavigationStore.getState().focusedMsgIndex).toBe(0)
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 't', bubbles: true }))
    expect(useUIStore.getState().theme).toBe('light')

    input.remove()
  })

  it('ignores shortcuts when a modifier key is held (so ⌘K passes through)', () => {
    renderHook(() => useKeyboardShortcuts(5))
    press({ key: 'k', metaKey: true })
    // k with meta is the search-palette shortcut; this hook must NOT decrement.
    expect(useNavigationStore.getState().focusedMsgIndex).toBe(0)
    press({ key: 'j', ctrlKey: true })
    expect(useNavigationStore.getState().focusedMsgIndex).toBe(0)
  })

  it('j clears any active tool/diff drill-in (so the rail follows the focused turn)', () => {
    useNavigationStore.setState({ focusedMsgIndex: 0, selectedInteractionId: 't:tu' })
    renderHook(() => useKeyboardShortcuts(3))
    press({ key: 'j' })
    expect(useNavigationStore.getState().focusedMsgIndex).toBe(1)
    expect(useNavigationStore.getState().selectedInteractionId).toBeNull()
  })

  it('k clears any active tool/diff drill-in (so the rail follows the focused turn)', () => {
    useNavigationStore.setState({ focusedMsgIndex: 2, selectedInteractionId: 't:tu' })
    renderHook(() => useKeyboardShortcuts(3))
    press({ key: 'k' })
    expect(useNavigationStore.getState().focusedMsgIndex).toBe(1)
    expect(useNavigationStore.getState().selectedInteractionId).toBeNull()
  })

  it('handles j at nodeCount=0 without error', () => {
    renderHook(() => useKeyboardShortcuts(0))
    press({ key: 'j' })
    expect(useNavigationStore.getState().focusedMsgIndex).toBe(0)
  })

  describe('r — Session Report toggle (FR-017)', () => {
    it('r toggles sessionReportOpen when no overlay is in front', () => {
      renderHook(() => useKeyboardShortcuts(0))
      expect(useUIStore.getState().sessionReportOpen).toBe(false)
      press({ key: 'r' })
      expect(useUIStore.getState().sessionReportOpen).toBe(true)
      press({ key: 'r' })
      expect(useUIStore.getState().sessionReportOpen).toBe(false)
    })

    it('r is suppressed when the search palette is open', () => {
      useSearchStore.setState({ isOpen: true })
      renderHook(() => useKeyboardShortcuts(0))
      press({ key: 'r' })
      expect(useUIStore.getState().sessionReportOpen).toBe(false)
    })

    it('r is suppressed when narrowSheetOpen is true', () => {
      useUIStore.setState({ narrowSheetOpen: true })
      renderHook(() => useKeyboardShortcuts(0))
      press({ key: 'r' })
      expect(useUIStore.getState().sessionReportOpen).toBe(false)
    })

    it('r is suppressed when the active element is an input', () => {
      const input = document.createElement('input')
      document.body.appendChild(input)
      input.focus()
      renderHook(() => useKeyboardShortcuts(0))
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'r', bubbles: true }))
      expect(useUIStore.getState().sessionReportOpen).toBe(false)
      input.remove()
    })

    it('r is suppressed when any modifier key is held', () => {
      renderHook(() => useKeyboardShortcuts(0))
      press({ key: 'r', metaKey: true })
      press({ key: 'r', ctrlKey: true })
      press({ key: 'r', altKey: true })
      expect(useUIStore.getState().sessionReportOpen).toBe(false)
    })

    it('r is NOT suppressed by an active Inspector selection', () => {
      useNavigationStore.setState({ selectedInteractionId: 't:tu' })
      renderHook(() => useKeyboardShortcuts(0))
      press({ key: 'r' })
      expect(useUIStore.getState().sessionReportOpen).toBe(true)
    })
  })

  describe('turn-boundary stepping (when nodes are provided)', () => {
    it('j advances to the first row of the NEXT turn (skipping intra-turn children)', () => {
      const nodes = makeNodes() // A=[0], B=[1..3], C=[4..5]
      useNavigationStore.setState({ focusedMsgIndex: 1 }) // on first row of B
      renderHook(() => useKeyboardShortcuts(nodes))
      press({ key: 'j' })
      expect(useNavigationStore.getState().focusedMsgIndex).toBe(4) // first row of C
    })

    it('j from a mid-turn child row still advances to the next turn (skips remaining children)', () => {
      const nodes = makeNodes()
      useNavigationStore.setState({ focusedMsgIndex: 2 }) // mid-B
      renderHook(() => useKeyboardShortcuts(nodes))
      press({ key: 'j' })
      expect(useNavigationStore.getState().focusedMsgIndex).toBe(4) // first row of C
    })

    it('k from the first row of a turn steps back to the first row of the previous turn', () => {
      const nodes = makeNodes()
      useNavigationStore.setState({ focusedMsgIndex: 4 }) // first row of C
      renderHook(() => useKeyboardShortcuts(nodes))
      press({ key: 'k' })
      expect(useNavigationStore.getState().focusedMsgIndex).toBe(1) // first row of B
    })

    it('k from a mid-turn child snaps up to the first row of the SAME turn', () => {
      const nodes = makeNodes()
      useNavigationStore.setState({ focusedMsgIndex: 3 }) // mid-B
      renderHook(() => useKeyboardShortcuts(nodes))
      press({ key: 'k' })
      expect(useNavigationStore.getState().focusedMsgIndex).toBe(1) // first row of B
    })

    it('nextTurnBoundary clamps at the last turn boundary', () => {
      expect(nextTurnBoundary(makeNodes(), 5)).toBe(5)
    })

    it('prevTurnBoundary clamps at 0', () => {
      expect(prevTurnBoundary(makeNodes(), 0)).toBe(0)
    })
  })

  describe('Escape priority chain (FR-019)', () => {
    it('closes the report first, then search, then sheet, then selection, then focusedMsg', () => {
      useUIStore.setState({ sessionReportOpen: true, narrowSheetOpen: true })
      useSearchStore.setState({ isOpen: true })
      useNavigationStore.setState({ selectedInteractionId: 't:tu', focusedMsgIndex: 4 })

      renderHook(() => useKeyboardShortcuts(10))

      // 1: report closes
      press({ key: 'Escape' })
      expect(useUIStore.getState().sessionReportOpen).toBe(false)
      expect(useSearchStore.getState().isOpen).toBe(true)
      expect(useUIStore.getState().narrowSheetOpen).toBe(true)
      expect(useNavigationStore.getState().selectedInteractionId).toBe('t:tu')

      // 2: search closes
      press({ key: 'Escape' })
      expect(useSearchStore.getState().isOpen).toBe(false)
      expect(useUIStore.getState().narrowSheetOpen).toBe(true)

      // 3: sheet closes
      press({ key: 'Escape' })
      expect(useUIStore.getState().narrowSheetOpen).toBe(false)
      expect(useNavigationStore.getState().selectedInteractionId).toBe('t:tu')

      // 4: selection clears
      press({ key: 'Escape' })
      expect(useNavigationStore.getState().selectedInteractionId).toBeNull()
      expect(useNavigationStore.getState().focusedMsgIndex).toBe(4)

      // 5: focusedMsgIndex fallback clears
      press({ key: 'Escape' })
      expect(useNavigationStore.getState().focusedMsgIndex).toBe(-1)
    })
  })
})
