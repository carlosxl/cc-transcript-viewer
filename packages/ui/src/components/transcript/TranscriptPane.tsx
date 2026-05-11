import { useCallback, useEffect, useRef } from 'react'
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso'
import type { SessionMeta, Turn, AggregatedUsage } from '@cc-viewer/shared'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useUIStore } from '@/stores/useUIStore'
import { useScrollStore } from '@/stores/useScrollStore'
import { useNavigationStore } from '@/stores/useNavigationStore'
import { useLiveStore } from '@/stores/useLiveStore'
import { useSearchStore } from '@/stores/useSearchStore'
import { useSession } from '@/hooks/useSession'
import { useSubagent } from '@/hooks/useSubagent'
import { useLiveTail } from '@/hooks/useLiveTail'
import { useFlatNodes } from '@/hooks/useFlatNodes'
import { useActiveSessionMeta } from '@/hooks/useActiveSessionMeta'
import { TranscriptHeader } from './TranscriptHeader'
import { BreadcrumbBar } from './BreadcrumbBar'
import { VirtualNodeRow } from './VirtualNodeRow'

/**
 * Virtualized transcript view.
 *
 * Layout (sibling-flex, RESEARCH.md Pattern 4):
 *   <div h-full flex-col>
 *     <TranscriptHeader flex-shrink-0 />   ← 48px, always visible
 *     <div flex-1 min-h-0>
 *       <Virtuoso />                        ← fills remainder, scrolls independently
 *     </div>
 *   </div>
 *
 * data prop: VirtualNode[] from useFlatNodes (memoized; recomputed when
 * useUIStore.viewMode flips between 'compact' and 'details').
 * computeItemKey: stable per-node key (Pitfall 12 — survives unmount).
 */
export function TranscriptPane() {
  const activeSessionId = useUIStore((s) => s.activeSessionId)
  const drillStack = useNavigationStore((s) => s.drillStack)
  const drillTop = drillStack[drillStack.length - 1]
  const onSubagent = drillTop !== undefined && drillTop.sessionId === activeSessionId
  const sessionQuery = useSession(activeSessionId)
  const subagentQuery = useSubagent(
    onSubagent ? drillTop.sessionId : null,
    onSubagent ? drillTop.agentId : null,
  )
  const sessionMeta = useActiveSessionMeta()

  // Live-tail wiring — each useLiveTail call is a no-op when its sessionId
  // arg is null; we run two parallel hooks so session-view and subagent-view
  // both reflect appended JSONL lines without re-mounting on entry change.
  const isLive = sessionMeta?.isLive ?? false
  useLiveTail(
    isLive && !onSubagent && activeSessionId ? activeSessionId : null,
    null,
  )
  useLiveTail(
    isLive && onSubagent ? drillTop.sessionId : null,
    isLive && onSubagent ? drillTop.agentId : null,
  )

  // Global keyboard shortcut: c = compact, d = details. Skipped when the
  // user is typing in an input/textarea/contentEditable so it doesn't fire
  // mid-typing in the search palette.
  const setViewMode = useUIStore((s) => s.setViewMode)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const k = e.key.toLowerCase()
      if (k !== 'c' && k !== 'd') return
      const t = e.target as HTMLElement | null
      const inEditable =
        t?.tagName === 'INPUT' ||
        t?.tagName === 'TEXTAREA' ||
        (t as HTMLElement | null)?.isContentEditable
      if (inEditable) return
      e.preventDefault()
      setViewMode(k === 'c' ? 'compact' : 'details')
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [setViewMode])

  // No active session → empty state (no header needed here)
  if (activeSessionId === null) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center px-8">
        <div className="text-sm font-semibold text-foreground mb-2">Select a session</div>
        <div className="text-xs text-muted-foreground">Click a session in the sidebar to begin reading.</div>
      </div>
    )
  }

  const activeQuery = onSubagent ? subagentQuery : sessionQuery
  const turns: Turn[] | undefined = activeQuery.data?.turns
  const headerMeta = onSubagent
    ? buildSubagentMeta(activeSessionId, subagentQuery.data, sessionMeta)
    : sessionMeta

  if (activeQuery.isLoading) {
    return (
      <div className="h-full flex flex-col">
        <BreadcrumbBar />
        <LoadingGhosts />
      </div>
    )
  }

  if (activeQuery.error) {
    const err = activeQuery.error
    return (
      <div className="h-full flex flex-col">
        <BreadcrumbBar />
        <div className="flex-1 flex flex-col items-center justify-center text-center px-8" role="alert">
          <div className="text-sm font-semibold text-foreground mb-1">
            {onSubagent ? 'Could not load subagent' : 'Could not load session'}
          </div>
          <div className="text-xs text-destructive mb-3">{err instanceof Error ? err.message : String(err)}</div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { void activeQuery.refetch() }}
            aria-label="Try again"
          >
            Try again
          </Button>
        </div>
      </div>
    )
  }

  if (!turns || turns.length === 0) {
    return (
      <div className="h-full flex flex-col">
        <BreadcrumbBar />
        <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
          <div className="text-xs text-muted-foreground">
            {onSubagent ? 'This subagent has no displayable turns.' : 'This session has no displayable turns.'}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <BreadcrumbBar />
      {/* TranscriptHeader is a flex-shrink-0 sibling — NOT topItemCount (RESEARCH.md Pattern 4) */}
      <TranscriptHeader meta={headerMeta} showModeToggle />
      {/* flex-1 min-h-0: allows the flex item to shrink so Virtuoso fits within the column */}
      <div className="flex-1 min-h-0">
        <VirtualList turns={turns} />
      </div>
    </div>
  )
}

/**
 * Synthesize a SessionMeta-shaped object describing the current subagent so
 * TranscriptHeader can render it (title, token totals, info popover) without
 * needing a parallel SubagentHeader component.
 */
function buildSubagentMeta(
  sessionId: string,
  detail: import('@cc-viewer/shared').SubagentDetailResponse | undefined,
  parentMeta: SessionMeta | undefined,
): SessionMeta | undefined {
  if (!detail) return undefined
  const usage: AggregatedUsage = {
    inputTokens: detail.usage.inputTokens,
    outputTokens: detail.usage.outputTokens,
    cacheCreationTokens: detail.usage.cacheCreationTokens,
    cacheReadTokens: detail.usage.cacheReadTokens,
    byAgent: { '': detail.usage },
  }
  const title = detail.description
    ? `${detail.agentType} · ${detail.description}`
    : detail.agentType !== 'unknown'
      ? detail.agentType
      : `agent ${detail.agentId.slice(0, 8)}`
  return {
    sessionId,
    projectSlug: parentMeta?.projectSlug ?? '',
    projectPath: parentMeta?.projectPath ?? '',
    title,
    firstTimestamp: detail.turns[0]?.timestamp ?? '',
    lastTimestamp: detail.turns[detail.turns.length - 1]?.timestamp ?? '',
    messageCount: detail.turns.length,
    hasSubagents: detail.childAgentIds.length > 0,
    totalUsage: usage,
  }
}

function VirtualList({ turns }: { turns: Turn[] }) {
  const nodes = useFlatNodes(turns)
  const initialIndex = useScrollStore.getState().lastScrollIndex  // read once on mount
  const setScrollIndex = useScrollStore((s) => s.setScrollIndex)
  const virtuosoRef = useRef<VirtuosoHandle>(null)
  const autoFollow = useLiveStore((s) => s.autoFollow)
  const setAutoFollow = useLiveStore((s) => s.setAutoFollow)
  const pendingCount = useLiveStore((s) => s.pendingCount)
  const clearPending = useLiveStore((s) => s.clearPending)

  // Search-result jump: SearchPalette stores a pending target on click. Once
  // the destination turn is in our flat node array (it may take a render
  // cycle after the session query resolves), scroll to its row.
  //
  // The hit may land on a node only emitted in 'details' mode (tool result /
  // thinking). SearchPalette is responsible for switching viewMode before
  // setting pendingJump, so by the time we look up nodes here the target is
  // already present.
  const pendingJump = useSearchStore((s) => s.pendingJumpTarget)
  const clearJump = useSearchStore((s) => s.clearJump)

  useEffect(() => {
    if (!pendingJump) return
    const idx = nodes.findIndex(
      (n) => n.kind === 'turn' && n.turn.uuid === pendingJump.turnUuid,
    )
    if (idx === -1) return
    clearJump()
    requestAnimationFrame(() => {
      virtuosoRef.current?.scrollToIndex({ index: idx, align: 'center', behavior: 'smooth' })
    })
  }, [pendingJump, nodes, clearJump])

  const onJumpToLatest = useCallback(() => {
    virtuosoRef.current?.scrollToIndex({ index: 'LAST', behavior: 'auto' })
    setAutoFollow(true)
    clearPending()
  }, [setAutoFollow, clearPending])

  return (
    <div className="relative h-full">
      <Virtuoso
        ref={virtuosoRef}
        style={{ height: '100%' }}
        data={nodes}
        aria-label="Transcript messages"
        computeItemKey={(_, node) => node.key}
        initialTopMostItemIndex={initialIndex}
        rangeChanged={({ startIndex }) => setScrollIndex(startIndex)}
        atBottomStateChange={(atBottom) => setAutoFollow(atBottom)}
        followOutput={autoFollow ? 'auto' : false}
        increaseViewportBy={{ top: 200, bottom: 800 }}
        itemContent={(_, node) => <VirtualNodeRow node={node} />}
      />
      {!autoFollow && pendingCount > 0 && (
        <button
          type="button"
          onClick={onJumpToLatest}
          aria-label={`Jump to latest — ${pendingCount} new messages`}
          className="absolute bottom-4 right-4 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-medium shadow-lg hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          {pendingCount} new {pendingCount === 1 ? 'message' : 'messages'} ↓
        </button>
      )}
    </div>
  )
}

function LoadingGhosts() {
  return (
    <div className="h-full p-4 space-y-2" role="status" aria-label="Loading session…">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-16 rounded-sm" />
      ))}
    </div>
  )
}
