import { describe, it, expect, afterEach, vi } from 'vitest'
import { renderHook, cleanup, act } from '@testing-library/react'
import { useReducedMotion } from './useReducedMotion'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

type Listener = (e: MediaQueryListEvent) => void

function installMatchMedia(initialMatches: boolean): {
  set: (matches: boolean) => void
} {
  let matches = initialMatches
  const listeners = new Set<Listener>()
  vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => {
    expect(query).toBe('(prefers-reduced-motion: reduce)')
    return {
      get matches() { return matches },
      media: query,
      onchange: null,
      addEventListener: (_: string, cb: Listener) => listeners.add(cb),
      removeEventListener: (_: string, cb: Listener) => listeners.delete(cb),
      addListener: (cb: Listener) => listeners.add(cb),
      removeListener: (cb: Listener) => listeners.delete(cb),
      dispatchEvent: () => true,
    } as unknown as MediaQueryList
  })
  return {
    set(next: boolean) {
      matches = next
      listeners.forEach((cb) => cb({ matches } as MediaQueryListEvent))
    },
  }
}

describe('useReducedMotion', () => {
  it('returns false when not requested', () => {
    installMatchMedia(false)
    const { result } = renderHook(() => useReducedMotion())
    expect(result.current).toBe(false)
  })

  it('returns true when requested', () => {
    installMatchMedia(true)
    const { result } = renderHook(() => useReducedMotion())
    expect(result.current).toBe(true)
  })

  it('updates when the preference changes', () => {
    const ctrl = installMatchMedia(false)
    const { result } = renderHook(() => useReducedMotion())
    expect(result.current).toBe(false)
    act(() => ctrl.set(true))
    expect(result.current).toBe(true)
  })
})
