import { describe, it, expect, beforeEach } from 'vitest'
import { useUIStore } from './useUIStore'

const PIN_KEY = 'cc-viewer:pinned-sessions'

beforeEach(() => {
  window.localStorage.clear()
  useUIStore.setState({ pinnedSessions: new Set(), sessionReportOpen: false })
})

describe('useUIStore — pinnedSessions persistence (Phase 7)', () => {
  it('togglePinnedSession writes the new set to localStorage', () => {
    useUIStore.getState().togglePinnedSession('alpha')
    useUIStore.getState().togglePinnedSession('beta')
    const stored = JSON.parse(window.localStorage.getItem(PIN_KEY) ?? '[]') as string[]
    expect(new Set(stored)).toEqual(new Set(['alpha', 'beta']))

    useUIStore.getState().togglePinnedSession('alpha')
    const stored2 = JSON.parse(window.localStorage.getItem(PIN_KEY) ?? '[]') as string[]
    expect(stored2).toEqual(['beta'])
  })
})

describe('useUIStore — sessionReportOpen (Inspector-rail-report)', () => {
  it('defaults to false and is not persisted', () => {
    expect(useUIStore.getState().sessionReportOpen).toBe(false)
    useUIStore.getState().setSessionReportOpen(true)
    expect(useUIStore.getState().sessionReportOpen).toBe(true)
    // No localStorage write should occur.
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i)
      expect(k).not.toMatch(/sessionReport/i)
    }
  })

  it('setSessionReportOpen flips the flag explicitly', () => {
    useUIStore.getState().setSessionReportOpen(true)
    expect(useUIStore.getState().sessionReportOpen).toBe(true)
    useUIStore.getState().setSessionReportOpen(false)
    expect(useUIStore.getState().sessionReportOpen).toBe(false)
  })

  it('toggleSessionReportOpen inverts the flag', () => {
    useUIStore.getState().toggleSessionReportOpen()
    expect(useUIStore.getState().sessionReportOpen).toBe(true)
    useUIStore.getState().toggleSessionReportOpen()
    expect(useUIStore.getState().sessionReportOpen).toBe(false)
  })

  it('toggleSort flips between desc and asc (T003)', () => {
    expect(useUIStore.getState().sortOrder).toBe('desc')
    useUIStore.getState().toggleSort()
    expect(useUIStore.getState().sortOrder).toBe('asc')
    useUIStore.getState().toggleSort()
    expect(useUIStore.getState().sortOrder).toBe('desc')
  })
})
