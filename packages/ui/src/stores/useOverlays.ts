import { create } from 'zustand'

interface OverlayState {
  search: { open: boolean; query: string }
  report: { open: boolean }
  jumper: { open: boolean; anchor: DOMRect | null }
  image: { open: boolean; src: string | null; alt: string | null }
  openSearch: () => void
  closeSearch: () => void
  setQuery: (q: string) => void
  openReport: () => void
  toggleReport: () => void
  closeReport: () => void
  openJumper: (anchor?: DOMRect | null) => void
  closeJumper: () => void
  openImage: (src: string, alt?: string) => void
  closeImage: () => void
  closeAll: () => void
  /** Esc priority: image → jumper → report → search. Returns true when something closed. */
  closeTop: () => boolean
}

const closed = {
  search: { open: false, query: '' },
  report: { open: false },
  jumper: { open: false, anchor: null as DOMRect | null },
  image: { open: false, src: null as string | null, alt: null as string | null },
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
  openImage: (src, alt) => set({ image: { open: true, src, alt: alt ?? null } }),
  closeImage: () => set({ image: { open: false, src: null, alt: null } }),
  closeAll: () => set(() => ({ ...closed })),
  closeTop: () => {
    const s = get()
    if (s.image.open) {
      get().closeImage()
      return true
    }
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
