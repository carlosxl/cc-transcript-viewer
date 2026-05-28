import { create } from 'zustand'
import type { Theme, Density } from '@/lib/types'

interface WorkspaceState {
  theme: Theme
  density: Density
  setTheme: (t: Theme) => void
  setDensity: (d: Density) => void
  toggleTheme: () => void
  toggleDensity: () => void
}

/**
 * Per R-09: session-scoped only — no localStorage.
 * Defaults match the design's <html data-theme="dark" data-density="comfortable">.
 */
export const useWorkspace = create<WorkspaceState>((set) => ({
  theme: 'dark',
  density: 'comfortable',
  setTheme: (theme) => set({ theme }),
  setDensity: (density) => set({ density }),
  toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
  toggleDensity: () => set((s) => ({ density: s.density === 'comfortable' ? 'compact' : 'comfortable' })),
}))
