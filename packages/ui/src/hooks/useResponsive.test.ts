import { describe, it, expect, afterEach, vi } from 'vitest'
import { renderHook, cleanup, act } from '@testing-library/react'
import { useResponsive, NARROW_QUERY } from './useResponsive'

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
    expect(query).toBe(NARROW_QUERY)
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

describe('useResponsive', () => {
  it('returns narrow=false when the media query does not match', () => {
    installMatchMedia(false)
    const { result } = renderHook(() => useResponsive())
    expect(result.current.narrow).toBe(false)
  })

  it('returns narrow=true when the media query matches', () => {
    installMatchMedia(true)
    const { result } = renderHook(() => useResponsive())
    expect(result.current.narrow).toBe(true)
  })

  it('reacts to media-query change events', () => {
    const ctrl = installMatchMedia(false)
    const { result } = renderHook(() => useResponsive())
    expect(result.current.narrow).toBe(false)
    act(() => ctrl.set(true))
    expect(result.current.narrow).toBe(true)
    act(() => ctrl.set(false))
    expect(result.current.narrow).toBe(false)
  })
})
