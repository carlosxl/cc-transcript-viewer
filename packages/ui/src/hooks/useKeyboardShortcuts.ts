import { useEffect } from 'react'
import { useUIStore } from '@/stores/useUIStore'
import { useNavigationStore } from '@/stores/useNavigationStore'
import { useSearchStore } from '@/stores/useSearchStore'

/**
 * Centralized global keyboard shortcuts (Phase 3).
 *
 * Mounted once at the top of `TranscriptPane`. The hook attaches a single
 * window-level `keydown` listener that dispatches across:
 *   - `c` / `d` — view mode (compact / details)
 *   - `t`       — toggle theme
 *   - `j` / `k` — move focused-message index (clamped to [0, nodeCount-1])
 *   - `/`       — open the search palette (Phase 7 will redirect to a
 *                 sidebar search field once it exists)
 *   - `Escape`  — clear focused-message index (palette close is owned by
 *                 `SearchPalette` itself; this hook is the fallback)
 *
 * Skipped when the user is typing in an input/textarea/contentEditable, and
 * when any modifier is pressed (so ⌘K, Cmd+T, etc. pass through to the
 * browser / their own handlers).
 */
export function useKeyboardShortcuts(nodeCount: number): void {
  const setViewMode = useUIStore((s) => s.setViewMode)
  const toggleTheme = useUIStore((s) => s.toggleTheme)
  const setFocusedMsgIndex = useNavigationStore((s) => s.setFocusedMsgIndex)
  const openSearch = useSearchStore((s) => s.open)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return

      const t = e.target as HTMLElement | null
      const inEditable =
        t?.tagName === 'INPUT' ||
        t?.tagName === 'TEXTAREA' ||
        (t as HTMLElement | null)?.isContentEditable
      if (inEditable) return

      const k = e.key.toLowerCase()
      switch (k) {
        case 'c':
          e.preventDefault()
          setViewMode('compact')
          return
        case 'd':
          e.preventDefault()
          setViewMode('details')
          return
        case 't':
          e.preventDefault()
          toggleTheme()
          return
        case 'j': {
          e.preventDefault()
          if (nodeCount === 0) return
          const current = useNavigationStore.getState().focusedMsgIndex
          // From "no focus" (-1) j lands on row 0, not row 1.
          const next = current < 0 ? 0 : Math.min(nodeCount - 1, current + 1)
          setFocusedMsgIndex(next)
          return
        }
        case 'k': {
          e.preventDefault()
          const current = useNavigationStore.getState().focusedMsgIndex
          const next = Math.max(0, (current < 0 ? 0 : current - 1))
          setFocusedMsgIndex(next)
          return
        }
        case '/':
          e.preventDefault()
          openSearch()
          return
        case 'escape':
          // Don't preventDefault — Radix dialogs handle their own escape.
          setFocusedMsgIndex(-1)
          return
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [nodeCount, setViewMode, toggleTheme, setFocusedMsgIndex, openSearch])
}
