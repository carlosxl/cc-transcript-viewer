import { useState } from 'react'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable'
import type { Layout } from 'react-resizable-panels'
import { SessionBrowser } from '@/components/sidebar/SessionBrowser'
import { TranscriptPane } from '@/components/transcript/TranscriptPane'
import { SearchPalette } from '@/components/search/SearchPalette'
// HeaderSlot replaced by TranscriptHeader in plan 02-09 (TranscriptPane now owns the header)

/** localStorage key for sidebar/main split (D-02 intent: persist sidebar width). */
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
        return { sidebar: obj['sidebar'], main: obj['main'] }
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
 * Two-pane app shell (D-01, D-04). Always-mounted: session switching
 * REPLACES content in the main pane via Zustand activeSessionId; the
 * shell itself never re-mounts.
 *
 * D-02 resolution (per 02-RESEARCH.md R2): layout persisted to localStorage
 * under key `cc-viewer:layout`. Uses `onLayoutChanged` + `defaultLayout`
 * since this version of react-resizable-panels uses `orientation` (not
 * `direction`) and surfaces layout as { [panelId]: number } — panels are
 * identified by their `id` prop.
 */
export function AppShell() {
  const [savedLayout] = useState<Layout | undefined>(loadLayout)
  return (
    <div className="h-screen w-screen bg-background text-foreground">
      <ResizablePanelGroup
        orientation="horizontal"
        defaultLayout={savedLayout}
        onLayoutChanged={saveLayout}
      >
        <ResizablePanel id="sidebar" defaultSize={28} minSize={18}>
          <SessionBrowser />
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel id="main" defaultSize={72} minSize={50}>
          {/* TranscriptPane owns the h-full flex-col layout + TranscriptHeader sibling (plan 02-09) */}
          <TranscriptPane />
        </ResizablePanel>
      </ResizablePanelGroup>
      <SearchPalette />
    </div>
  )
}
