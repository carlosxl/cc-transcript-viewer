import { describe, it, expect, beforeEach } from 'vitest'
import { useUIStore } from './useUIStore'

const PIN_KEY = 'cc-viewer:pinned-sessions'

beforeEach(() => {
  window.localStorage.clear()
  useUIStore.setState({ pinnedSessions: new Set() })
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
