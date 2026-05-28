/**
 * Session-view Zustand slice (007-ui-information-revamp).
 *
 * Per-session expansion state + cross-session global filters/toggles.
 * Per-session state resets on every session open (Plan §4 persistence rules).
 * Global toggles persist via localStorage under `cc-tx-viewer:session-view:v1`.
 */
import { create } from 'zustand'
import { persist, type PersistStorage } from 'zustand/middleware'

export type DisclosureLevel = 'recall' | 'learn' | 'audit'

interface SessionViewState {
  // Per-session (NOT persisted)
  expandedTurnIds: Set<string>
  expandedRequestIds: Set<string>
  expandedBlockIds: Set<string>
  focusedTurnId: string | null
  sessionSummaryOpen: boolean

  // Global (persisted via localStorage)
  defaultDisclosureLevel: DisclosureLevel
  showAttachments: boolean
  showSystemEvents: boolean
  showInlineStateChanges: boolean

  // Cross-cutting (NOT persisted)
  searchQuery: string

  // Mutations
  toggleTurnExpansion: (turnId: string) => void
  toggleRequestExpansion: (requestId: string) => void
  toggleBlockExpansion: (blockId: string) => void
  setFocusedTurnId: (id: string | null) => void
  setSessionSummaryOpen: (v: boolean) => void
  setDefaultDisclosureLevel: (v: DisclosureLevel) => void
  setShowAttachments: (v: boolean) => void
  setShowSystemEvents: (v: boolean) => void
  setShowInlineStateChanges: (v: boolean) => void
  setSearchQuery: (v: string) => void
  resetPerSession: () => void
}

interface PersistedSlice {
  defaultDisclosureLevel: DisclosureLevel
  showAttachments: boolean
  showSystemEvents: boolean
  showInlineStateChanges: boolean
}

const STORAGE_KEY = 'cc-tx-viewer:session-view:v1'

/**
 * Custom storage adapter to scope the persisted slice; uses plain JSON.
 * The default `createJSONStorage` is sufficient but having a typed adapter
 * keeps the persisted shape narrow (we never write Sets to disk).
 */
const localStorageBacked: PersistStorage<PersistedSlice> = {
  getItem: (name) => {
    if (typeof localStorage === 'undefined') return null
    const raw = localStorage.getItem(name)
    if (!raw) return null
    try {
      return JSON.parse(raw) as { state: PersistedSlice; version?: number }
    } catch {
      return null
    }
  },
  setItem: (name, value) => {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(name, JSON.stringify(value))
  },
  removeItem: (name) => {
    if (typeof localStorage === 'undefined') return
    localStorage.removeItem(name)
  },
}

function toggleInSet(set: Set<string>, id: string): Set<string> {
  const next = new Set(set)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  return next
}

export const useSessionViewStore = create<SessionViewState>()(
  persist(
    (set) => ({
      expandedTurnIds: new Set<string>(),
      expandedRequestIds: new Set<string>(),
      expandedBlockIds: new Set<string>(),
      focusedTurnId: null,
      sessionSummaryOpen: false,

      defaultDisclosureLevel: 'recall',
      showAttachments: true,
      showSystemEvents: true,
      showInlineStateChanges: true,

      searchQuery: '',

      toggleTurnExpansion: (turnId) =>
        set((s) => ({ expandedTurnIds: toggleInSet(s.expandedTurnIds, turnId) })),
      toggleRequestExpansion: (requestId) =>
        set((s) => ({ expandedRequestIds: toggleInSet(s.expandedRequestIds, requestId) })),
      toggleBlockExpansion: (blockId) =>
        set((s) => ({ expandedBlockIds: toggleInSet(s.expandedBlockIds, blockId) })),
      setFocusedTurnId: (focusedTurnId) => set({ focusedTurnId }),
      setSessionSummaryOpen: (sessionSummaryOpen) => set({ sessionSummaryOpen }),
      setDefaultDisclosureLevel: (defaultDisclosureLevel) => set({ defaultDisclosureLevel }),
      setShowAttachments: (showAttachments) => set({ showAttachments }),
      setShowSystemEvents: (showSystemEvents) => set({ showSystemEvents }),
      setShowInlineStateChanges: (showInlineStateChanges) => set({ showInlineStateChanges }),
      setSearchQuery: (searchQuery) => set({ searchQuery }),
      resetPerSession: () =>
        set({
          expandedTurnIds: new Set<string>(),
          expandedRequestIds: new Set<string>(),
          expandedBlockIds: new Set<string>(),
          focusedTurnId: null,
          sessionSummaryOpen: false,
        }),
    }),
    {
      name: STORAGE_KEY,
      storage: localStorageBacked,
      partialize: (s): PersistedSlice => ({
        defaultDisclosureLevel: s.defaultDisclosureLevel,
        showAttachments: s.showAttachments,
        showSystemEvents: s.showSystemEvents,
        showInlineStateChanges: s.showInlineStateChanges,
      }),
    },
  ),
)
