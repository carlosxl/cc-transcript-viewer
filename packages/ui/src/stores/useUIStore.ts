import { create } from 'zustand'

export type ViewMode = 'compact' | 'details'
export type Density = 'compact' | 'regular'
export type Theme = 'dark' | 'light'

interface UIState {
  sidebarWidth: number                    // pixels; default 280
  activeSessionId: string | null
  theme: Theme                            // localStorage → prefers-color-scheme → 'dark'
  density: Density                        // 'regular' default
  serifTitles: boolean                    // true default (matches design)
  sortOrder: 'desc' | 'asc'               // D-21 default desc
  expandedProjectSections: Set<string>    // projectSlug; default all-expanded handled by component
  viewMode: ViewMode                      // compact = user+assistant text only; details = everything inline
  rightRailOpen: boolean                  // Phase 3: persisted; default true
  pinnedSessions: Set<string>             // Persisted to localStorage (Phase 7)
  /** Phase 8: narrow-width left drawer open state. Not persisted. */
  narrowSidebarOpen: boolean
  /** Phase 8: narrow-width inspector bottom-sheet open state. Not persisted. */
  narrowSheetOpen: boolean
  setSidebarWidth: (w: number) => void
  setActiveSessionId: (id: string | null) => void
  setTheme: (t: Theme) => void
  toggleTheme: () => void
  setDensity: (d: Density) => void
  toggleDensity: () => void
  setSerifTitles: (v: boolean) => void
  toggleSerifTitles: () => void
  toggleSort: () => void
  toggleProjectSection: (slug: string) => void
  setExpandedProjectSections: (s: Set<string>) => void
  setViewMode: (m: ViewMode) => void
  toggleViewMode: () => void
  setRightRailOpen: (v: boolean) => void
  toggleRightRailOpen: () => void
  togglePinnedSession: (id: string) => void
  setNarrowSidebarOpen: (v: boolean) => void
  setNarrowSheetOpen: (v: boolean) => void
}

const THEME_KEY = 'cc-viewer:theme'
const DENSITY_KEY = 'cc-viewer:density'
const SERIF_KEY = 'cc-viewer:serifTitles'
const VIEW_MODE_KEY = 'cc-viewer:viewMode'
const RIGHT_RAIL_OPEN_KEY = 'cc-viewer:rightRailOpen'
const PINNED_SESSIONS_KEY = 'cc-viewer:pinned-sessions'

function readLocal(key: string): string | null {
  if (typeof window === 'undefined') return null
  try { return window.localStorage.getItem(key) } catch { return null }
}

function writeLocal(key: string, value: string): void {
  if (typeof window === 'undefined') return
  try { window.localStorage.setItem(key, value) } catch { /* ignore */ }
}

function initialTheme(): Theme {
  const stored = readLocal(THEME_KEY)
  if (stored === 'dark' || stored === 'light') return stored
  if (typeof window === 'undefined') return 'dark'
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  } catch { return 'dark' }
}

function initialDensity(): Density {
  const stored = readLocal(DENSITY_KEY)
  return stored === 'compact' ? 'compact' : 'regular'
}

function initialSerifTitles(): boolean {
  const stored = readLocal(SERIF_KEY)
  // Default true (matches design's serif-titles="y"); only the literal string 'n' disables.
  return stored === 'n' ? false : true
}

function initialViewMode(): ViewMode {
  const stored = readLocal(VIEW_MODE_KEY)
  return stored === 'details' ? 'details' : 'compact'
}

function initialRightRailOpen(): boolean {
  const stored = readLocal(RIGHT_RAIL_OPEN_KEY)
  // Default true (matches design); only the literal string 'n' disables.
  return stored === 'n' ? false : true
}

function initialPinnedSessions(): Set<string> {
  const stored = readLocal(PINNED_SESSIONS_KEY)
  if (!stored) return new Set()
  try {
    const parsed = JSON.parse(stored)
    if (Array.isArray(parsed)) return new Set(parsed.filter((v): v is string => typeof v === 'string'))
  } catch { /* ignore */ }
  return new Set()
}

function writePinnedSessions(set: Set<string>): void {
  writeLocal(PINNED_SESSIONS_KEY, JSON.stringify(Array.from(set)))
}

export const useUIStore = create<UIState>((set) => ({
  sidebarWidth: 280,
  activeSessionId: null,
  theme: initialTheme(),
  density: initialDensity(),
  serifTitles: initialSerifTitles(),
  sortOrder: 'desc',
  expandedProjectSections: new Set(),
  viewMode: initialViewMode(),
  rightRailOpen: initialRightRailOpen(),
  pinnedSessions: initialPinnedSessions(),
  narrowSidebarOpen: false,
  narrowSheetOpen: false,
  setSidebarWidth: (w) => set({ sidebarWidth: w }),
  setActiveSessionId: (id) => set({ activeSessionId: id }),
  setTheme: (t) => { writeLocal(THEME_KEY, t); set({ theme: t }) },
  toggleTheme: () => set((s) => {
    const next: Theme = s.theme === 'dark' ? 'light' : 'dark'
    writeLocal(THEME_KEY, next)
    return { theme: next }
  }),
  setDensity: (d) => { writeLocal(DENSITY_KEY, d); set({ density: d }) },
  toggleDensity: () => set((s) => {
    const next: Density = s.density === 'compact' ? 'regular' : 'compact'
    writeLocal(DENSITY_KEY, next)
    return { density: next }
  }),
  setSerifTitles: (v) => { writeLocal(SERIF_KEY, v ? 'y' : 'n'); set({ serifTitles: v }) },
  toggleSerifTitles: () => set((s) => {
    const next = !s.serifTitles
    writeLocal(SERIF_KEY, next ? 'y' : 'n')
    return { serifTitles: next }
  }),
  toggleSort: () => set((s) => ({ sortOrder: s.sortOrder === 'desc' ? 'asc' : 'desc' })),
  toggleProjectSection: (slug) => set((s) => {
    const next = new Set(s.expandedProjectSections)
    if (next.has(slug)) next.delete(slug); else next.add(slug)
    return { expandedProjectSections: next }
  }),
  setExpandedProjectSections: (s) => set({ expandedProjectSections: new Set(s) }),
  setViewMode: (m) => { writeLocal(VIEW_MODE_KEY, m); set({ viewMode: m }) },
  toggleViewMode: () => set((s) => {
    const next: ViewMode = s.viewMode === 'compact' ? 'details' : 'compact'
    writeLocal(VIEW_MODE_KEY, next)
    return { viewMode: next }
  }),
  setRightRailOpen: (v) => { writeLocal(RIGHT_RAIL_OPEN_KEY, v ? 'y' : 'n'); set({ rightRailOpen: v }) },
  toggleRightRailOpen: () => set((s) => {
    const next = !s.rightRailOpen
    writeLocal(RIGHT_RAIL_OPEN_KEY, next ? 'y' : 'n')
    return { rightRailOpen: next }
  }),
  togglePinnedSession: (id) => set((s) => {
    const next = new Set(s.pinnedSessions)
    if (next.has(id)) next.delete(id); else next.add(id)
    writePinnedSessions(next)
    return { pinnedSessions: next }
  }),
  setNarrowSidebarOpen: (v) => set({ narrowSidebarOpen: v }),
  setNarrowSheetOpen: (v) => set({ narrowSheetOpen: v }),
}))
