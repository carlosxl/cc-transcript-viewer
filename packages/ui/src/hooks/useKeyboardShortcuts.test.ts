import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, cleanup } from '@testing-library/react'
import { useKeyboardShortcuts } from './useKeyboardShortcuts'
import { useUIStore } from '@/stores/useUIStore'
import { useNavigationStore } from '@/stores/useNavigationStore'
import { useSearchStore } from '@/stores/useSearchStore'

function press(opts: Partial<KeyboardEventInit> & { key: string }): void {
  const e = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...opts })
  window.dispatchEvent(e)
}

beforeEach(() => {
  useUIStore.setState({ theme: 'light', viewMode: 'compact' })
  useNavigationStore.setState({ focusedMsgIndex: 0 })
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

  it('handles j at nodeCount=0 without error', () => {
    renderHook(() => useKeyboardShortcuts(0))
    press({ key: 'j' })
    expect(useNavigationStore.getState().focusedMsgIndex).toBe(0)
  })
})
