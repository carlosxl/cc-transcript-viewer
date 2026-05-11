import { create } from 'zustand'

export type ViewMode = 'compact' | 'details'

interface UIState {
  sidebarWidth: number                    // pixels; default 280
  activeSessionId: string | null
  theme: 'dark' | 'light'                 // dark by default; system preference at boot
  sortOrder: 'desc' | 'asc'               // D-21 default desc
  expandedProjectSections: Set<string>    // projectSlug; default all-expanded handled by component
  viewMode: ViewMode                      // compact = user+assistant text only; details = everything inline
  setSidebarWidth: (w: number) => void
  setActiveSessionId: (id: string | null) => void
  setTheme: (t: 'dark' | 'light') => void
  toggleSort: () => void
  toggleProjectSection: (slug: string) => void
  setExpandedProjectSections: (s: Set<string>) => void
  setViewMode: (m: ViewMode) => void
  toggleViewMode: () => void
}

function initialTheme(): 'dark' | 'light' {
  if (typeof window === 'undefined') return 'dark'
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  } catch { return 'dark' }
}

const VIEW_MODE_KEY = 'cc-viewer:viewMode'

function initialViewMode(): ViewMode {
  if (typeof window === 'undefined') return 'compact'
  try {
    const v = window.localStorage.getItem(VIEW_MODE_KEY)
    return v === 'details' ? 'details' : 'compact'
  } catch { return 'compact' }
}

function persistViewMode(m: ViewMode): void {
  if (typeof window === 'undefined') return
  try { window.localStorage.setItem(VIEW_MODE_KEY, m) } catch { /* ignore */ }
}

export const useUIStore = create<UIState>((set) => ({
  sidebarWidth: 280,
  activeSessionId: null,
  theme: initialTheme(),
  sortOrder: 'desc',
  expandedProjectSections: new Set(),
  viewMode: initialViewMode(),
  setSidebarWidth: (w) => set({ sidebarWidth: w }),
  setActiveSessionId: (id) => set({ activeSessionId: id }),
  setTheme: (t) => set({ theme: t }),
  toggleSort: () => set((s) => ({ sortOrder: s.sortOrder === 'desc' ? 'asc' : 'desc' })),
  toggleProjectSection: (slug) => set((s) => {
    const next = new Set(s.expandedProjectSections)
    if (next.has(slug)) next.delete(slug); else next.add(slug)
    return { expandedProjectSections: next }
  }),
  setExpandedProjectSections: (s) => set({ expandedProjectSections: new Set(s) }),
  setViewMode: (m) => { persistViewMode(m); set({ viewMode: m }) },
  toggleViewMode: () => set((s) => {
    const next: ViewMode = s.viewMode === 'compact' ? 'details' : 'compact'
    persistViewMode(next)
    return { viewMode: next }
  }),
}))
