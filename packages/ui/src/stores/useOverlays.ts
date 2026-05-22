import { create } from 'zustand'

interface OverlayState {
  search: { open: boolean; query: string }
  report: { open: boolean }
  jumper: { open: boolean; anchor: DOMRect | null }
  openSearch: () => void
  closeSearch: () => void
  setQuery: (q: string) => void
  openReport: () => void
  toggleReport: () => void
  closeReport: () => void
  openJumper: (anchor?: DOMRect | null) => void
  closeJumper: () => void
  closeAll: () => void
  /** Esc priority: jumper → report → search. Returns true when something closed. */
  closeTop: () => boolean
}

const closed = {
  search: { open: false, query: '' },
  report: { open: false },
  jumper: { open: false, anchor: null as DOMRect | null },
}

export const useOverlays = create<OverlayState>((set, get) => ({
  ...closed,
  openSearch: () => set((s) => ({ search: { ...s.search, open: true } })),
  closeSearch: () => set((s) => ({ search: { ...s.search, open: false } })),
  setQuery: (q) => set((s) => ({ search: { ...s.search, query: q } })),
  openReport: () => set({ report: { open: true } }),
  toggleReport: () => set((s) => ({ report: { open: !s.report.open } })),
  closeReport: () => set({ report: { open: false } }),
  openJumper: (anchor) => set({ jumper: { open: true, anchor: anchor ?? null } }),
  closeJumper: () => set({ jumper: { open: false, anchor: null } }),
  closeAll: () => set(() => ({ ...closed })),
  closeTop: () => {
    const s = get()
    if (s.jumper.open) {
      get().closeJumper()
      return true
    }
    if (s.report.open) {
      get().closeReport()
      return true
    }
    if (s.search.open) {
      get().closeSearch()
      return true
    }
    return false
  },
}))
