import { useSyncExternalStore } from 'react'

/**
 * Single breakpoint for the workspace. Below this the shell switches from
 * three-pane to single-column with a left drawer + bottom sheet (Phase 8).
 */
export const NARROW_QUERY = '(max-width: 1099.98px)'

function subscribe(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const mql = window.matchMedia(NARROW_QUERY)
  mql.addEventListener('change', cb)
  return () => mql.removeEventListener('change', cb)
}

function getSnapshot(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia(NARROW_QUERY).matches
}

function getServerSnapshot(): boolean {
  return false
}

export interface Responsive {
  narrow: boolean
}

export function useResponsive(): Responsive {
  const narrow = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  return { narrow }
}
