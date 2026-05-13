// Fontsource — self-hosted; no runtime requests to Google Fonts (privacy).
import '@fontsource/geist-sans/400.css'
import '@fontsource/geist-sans/500.css'
import '@fontsource/geist-sans/600.css'
import '@fontsource/geist-mono/400.css'
import '@fontsource/geist-mono/500.css'
import '@fontsource/instrument-serif/400.css'
import './index.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { TooltipProvider } from './components/ui/tooltip'
import { queryClient } from './lib/queryClient'
import { useUIStore } from './stores/useUIStore'
import { useScrollStore } from './stores/useScrollStore'
import { useLiveStore } from './stores/useLiveStore'
import {
  useNavigationStore,
  deriveCurrentEntry,
  encodeLocationHash,
  decodeLocationHash,
  entryToId,
} from './stores/useNavigationStore'

/**
 * Cross-store reset: when the active session changes, drop the drill stack
 * and scroll snapshots — picking a new session in the sidebar is "open
 * fresh" (D-03). The snapshot reconciler below handles drill push/pop
 * within a single session.
 */
useUIStore.subscribe((state, prev) => {
  if (state.activeSessionId !== prev.activeSessionId) {
    useScrollStore.getState().setScrollIndex(0)
    useNavigationStore.getState().setDrillStack([])
    scrollSnapshots.clear()
  }
})

// ────────────────────────────────────────────────────────────────────────────
// Snapshot reconciler (Phase 3 W1.3 / AGENT-02)
//
// useScrollStore holds a single "current" scroll index. When the user drills
// into a subagent or pops back, we save the prior entry's value into a
// snapshot map keyed by entry id, and load (or default-zero) the new
// entry's snapshot. The result: scroll position is restored on pop.
// (Expand-state snapshots were removed alongside useExpandStore — view mode
// is now a single global preference, not per-entry.)
// ────────────────────────────────────────────────────────────────────────────

const scrollSnapshots = new Map<string, number>()
let lastEntryId: string | undefined = undefined

function reconcileSnapshots(): void {
  const { activeSessionId } = useUIStore.getState()
  const { drillStack } = useNavigationStore.getState()
  const entry = deriveCurrentEntry(activeSessionId, drillStack)
  const newId = entry ? entryToId(entry) : undefined

  if (newId === lastEntryId) return
  // Hoist the re-entry guard above the state mutations below: setFocusedMsgIndex
  // and setSelectedInteractionId both write to useNavigationStore, which is
  // subscribed to this function. Updating lastEntryId first ensures the
  // recursive subscriber call returns at the guard above.
  const prevEntryId = lastEntryId
  lastEntryId = newId

  if (prevEntryId !== undefined) {
    scrollSnapshots.set(prevEntryId, useScrollStore.getState().lastScrollIndex)
  }

  const nextScroll = newId ? scrollSnapshots.get(newId) ?? 0 : 0
  useScrollStore.setState({ lastScrollIndex: nextScroll })

  // Reset focused message index on entry change (Phase 3). -1 = no row
  // outlined; the primary-tint ring only appears after the user presses j/k.
  useNavigationStore.getState().setFocusedMsgIndex(-1)
  // Reset selected tool interaction on entry change (Phase 4).
  useNavigationStore.getState().setSelectedInteractionId(null)

  // Reset live-tail UI state — autoFollow defaults to true on each entry
  // change, pendingCount cleared. Virtuoso's atBottomStateChange will flip
  // autoFollow to false the moment the user scrolls away.
  useLiveStore.getState().setAutoFollow(true)
  useLiveStore.getState().clearPending()

  // Drop snapshots for entries no longer in the stack — bound memory.
  const liveIds = new Set<string>()
  if (activeSessionId) liveIds.add(`session:${activeSessionId}`)
  for (const f of drillStack) liveIds.add(`subagent:${f.sessionId}:${f.agentId}`)
  for (const id of scrollSnapshots.keys()) if (!liveIds.has(id)) scrollSnapshots.delete(id)
}

useUIStore.subscribe(reconcileSnapshots)
useNavigationStore.subscribe(reconcileSnapshots)

// ────────────────────────────────────────────────────────────────────────────
// Hash <-> store sync (Phase 3 W1.3)
//
// Hash form: #/sessions/:id (root) or #/sessions/:id/subagents/:agentId (drill).
// Browser back/forward navigates by replacing the hash; we re-derive store
// state in the hashchange handler. Internal navigation (sidebar click, drill
// button, breadcrumb) updates the stores; the subscription writes the new
// canonical hash. The two paths are kept from looping by an idempotency check.
// ────────────────────────────────────────────────────────────────────────────

function applyCanonicalHash(): void {
  const { activeSessionId } = useUIStore.getState()
  const { drillStack } = useNavigationStore.getState()
  const entry = deriveCurrentEntry(activeSessionId, drillStack)
  const target = encodeLocationHash(entry)
  if (typeof window === 'undefined') return
  if (window.location.hash === target) return
  // history.replaceState avoids creating a fresh history entry for every keystroke;
  // back/forward still works because the FIRST navigation creates the entry.
  if (target === '') {
    history.replaceState(null, '', window.location.pathname + window.location.search)
  } else {
    history.replaceState(null, '', target)
  }
}

function applyHashToStores(): void {
  if (typeof window === 'undefined') return
  const decoded = decodeLocationHash(window.location.hash)
  if (!decoded) return
  const ui = useUIStore.getState()
  const nav = useNavigationStore.getState()
  if (ui.activeSessionId !== decoded.sessionId) {
    ui.setActiveSessionId(decoded.sessionId)
  }
  // setDrillStack always — even when the array shape matches, Zustand's set replaces
  // the reference; reconcileSnapshots will short-circuit if nothing changed.
  nav.setDrillStack(decoded.drillStack)
}

// On first load, seed stores from any deep-link hash.
if (typeof window !== 'undefined') {
  applyHashToStores()
  // Browser back/forward.
  window.addEventListener('hashchange', applyHashToStores)
  // After internal navigation, write the canonical URL.
  useUIStore.subscribe(applyCanonicalHash)
  useNavigationStore.subscribe(applyCanonicalHash)
}

const el = document.getElementById('root')
if (!el) throw new Error('#root not found in index.html')
createRoot(el).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <TooltipProvider delayDuration={300}>
          <App />
        </TooltipProvider>
      </ErrorBoundary>
    </QueryClientProvider>
  </StrictMode>,
)
