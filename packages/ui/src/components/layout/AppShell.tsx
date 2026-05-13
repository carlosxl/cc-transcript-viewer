import { useEffect, useRef, useState } from 'react'
import { Wrench } from 'lucide-react'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable'
import type { PanelImperativeHandle, Layout } from 'react-resizable-panels'
import { SessionBrowser } from '@/components/sidebar/SessionBrowser'
import { TranscriptPane } from '@/components/transcript/TranscriptPane'
import { SearchPalette } from '@/components/search/SearchPalette'
import { RightRail } from '@/components/inspector/RightRail'
import { SidebarDrawer } from '@/components/layout/SidebarDrawer'
import { BottomSheet } from '@/components/layout/BottomSheet'
import { SessionReportDrawer } from '@/components/transcript/SessionReportDrawer'
import { useUIStore } from '@/stores/useUIStore'
import { useNavigationStore } from '@/stores/useNavigationStore'
import { useResponsive } from '@/hooks/useResponsive'

/** localStorage key for the three-pane split (D-02; Phase 3 extends with `rail`). */
const LAYOUT_STORAGE_KEY = 'cc-viewer:layout'

function loadLayout(): Layout | undefined {
  try {
    const raw = localStorage.getItem(LAYOUT_STORAGE_KEY)
    if (!raw) return undefined
    const parsed = JSON.parse(raw) as unknown
    if (typeof parsed === 'object' && parsed !== null) {
      const obj = parsed as Record<string, unknown>
      if (
        typeof obj['sidebar'] === 'number' &&
        typeof obj['main'] === 'number'
      ) {
        const layout: Layout = { sidebar: obj['sidebar'], main: obj['main'] }
        if (typeof obj['rail'] === 'number') layout['rail'] = obj['rail']
        return layout
      }
    }
    return undefined
  } catch {
    return undefined
  }
}

function saveLayout(layout: Layout): void {
  try {
    localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout))
  } catch {
    // localStorage may be unavailable (e.g. private browsing quota exceeded)
  }
}

/**
 * Three-pane app shell (Phase 3). Sidebar | Transcript | Inspector rail.
 *
 * The rail is `collapsible` with `collapsedSize=0` — clicking the toggle
 * in TranscriptHeader flips `useUIStore.rightRailOpen`, an effect below
 * synchronizes the panel ref. Keeping the panel mounted (not unmounted)
 * preserves rail state when Phase 5 wires it.
 *
 * Phase 8: below 1100px the shell collapses to a single column with the
 * sidebar in a left drawer (`SidebarDrawer`) and the inspector rail in a
 * bottom sheet (`BottomSheet`) opened by a FAB.
 */
export function AppShell() {
  const [savedLayout] = useState<Layout | undefined>(loadLayout)

  // Design-system attribute syncers (Phase 1).
  const theme = useUIStore((s) => s.theme)
  const density = useUIStore((s) => s.density)
  const serifTitles = useUIStore((s) => s.serifTitles)
  useEffect(() => { document.documentElement.dataset['theme'] = theme }, [theme])
  useEffect(() => { document.body.dataset['density'] = density }, [density])
  useEffect(() => { document.body.dataset['serifTitles'] = serifTitles ? 'y' : 'n' }, [serifTitles])

  // Right-rail toggle (Phase 3). The store is the source of truth; the
  // panel ref's collapse()/expand() mirror it on change.
  const rightRailOpen = useUIStore((s) => s.rightRailOpen)
  const railRef = useRef<PanelImperativeHandle | null>(null)
  useEffect(() => {
    const panel = railRef.current
    if (!panel) return
    if (rightRailOpen && panel.isCollapsed()) panel.expand()
    else if (!rightRailOpen && !panel.isCollapsed()) panel.collapse()
  }, [rightRailOpen])

  // Phase 8: narrow-mode drawer + sheet wiring.
  const { narrow } = useResponsive()
  const narrowSidebarOpen = useUIStore((s) => s.narrowSidebarOpen)
  const narrowSheetOpen = useUIStore((s) => s.narrowSheetOpen)
  const setNarrowSidebarOpen = useUIStore((s) => s.setNarrowSidebarOpen)
  const setNarrowSheetOpen = useUIStore((s) => s.setNarrowSheetOpen)
  const activeSessionId = useUIStore((s) => s.activeSessionId)
  const selectedInteractionId = useNavigationStore((s) => s.selectedInteractionId)

  // Close the drawer when the user picks a session — they're done with the list.
  useEffect(() => {
    if (!narrow) return
    if (narrowSidebarOpen) setNarrowSidebarOpen(false)
    // Only on session change, not when narrow flips.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSessionId])

  // Selecting an interaction on narrow auto-opens the inspector sheet so the
  // user sees the data they asked for (mirrors design's narrow workflow).
  useEffect(() => {
    if (narrow && selectedInteractionId) setNarrowSheetOpen(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedInteractionId, narrow])

  // Switching to wide closes any narrow-only overlays so they don't linger.
  useEffect(() => {
    if (!narrow) {
      if (narrowSidebarOpen) setNarrowSidebarOpen(false)
      if (narrowSheetOpen) setNarrowSheetOpen(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [narrow])

  if (narrow) {
    return (
      <div className="h-screen w-screen flex flex-col bg-background text-foreground">
        <div className="flex-1 min-h-0 min-w-0">
          <TranscriptPane />
        </div>
        <SidebarDrawer open={narrowSidebarOpen} onOpenChange={setNarrowSidebarOpen}>
          <SessionBrowser />
        </SidebarDrawer>
        <BottomSheet open={narrowSheetOpen} onOpenChange={setNarrowSheetOpen}>
          <RightRail />
        </BottomSheet>
        {!narrowSheetOpen && (
          <button
            type="button"
            onClick={() => setNarrowSheetOpen(true)}
            aria-label="Open inspector"
            className="fixed bottom-12 right-4 z-30 inline-flex items-center gap-1.5 rounded-full bg-primary text-primary-foreground px-3.5 py-2 text-xs font-semibold shadow-md hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <Wrench className="w-3.5 h-3.5" aria-hidden="true" />
            Inspector
          </button>
        )}
        <SearchPalette />
        <SessionReportDrawer />
      </div>
    )
  }

  return (
    <div className="h-screen w-screen bg-background text-foreground">
      <ResizablePanelGroup
        orientation="horizontal"
        defaultLayout={savedLayout}
        onLayoutChanged={saveLayout}
      >
        <ResizablePanel id="sidebar" defaultSize={22} minSize={16}>
          <SessionBrowser />
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel id="main" defaultSize={48} minSize={36}>
          <TranscriptPane />
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel
          id="rail"
          defaultSize={30}
          minSize={20}
          collapsible
          collapsedSize={0}
          panelRef={railRef}
        >
          <RightRail />
        </ResizablePanel>
      </ResizablePanelGroup>
      <SearchPalette />
      <SessionReportDrawer />
    </div>
  )
}
