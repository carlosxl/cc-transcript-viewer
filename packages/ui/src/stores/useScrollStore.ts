import { create } from 'zustand'

interface ScrollState {
  lastScrollIndex: number
  setScrollIndex: (n: number) => void
}

export const useScrollStore = create<ScrollState>((set) => ({
  lastScrollIndex: 0,
  setScrollIndex: (n) => set({ lastScrollIndex: n }),
}))
