import { useCallback, useEffect, useRef, useState } from 'react'
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
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useResponsive } from '@/hooks/useResponsive'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import type { VirtualNode } from '@/lib/flatNodes'
import { cn } from '@/lib/utils'
import { TranscriptHeader } from './TranscriptHeader'
import { BreadcrumbBar } from './BreadcrumbBar'
import { VirtualNodeRow } from './VirtualNodeRow'
import { Minimap } from './Minimap'
import { StatusBar } from '../layout/StatusBar'

/**
 * Virtualized transcript view (Phase 3 layout: header, transcript, status bar).
 *
 *   <div h-full flex-col>
 *     <TranscriptHeader flex-shrink-0 />   ← 64px breadcrumb + title row
 *     <div flex-1 min-h-0> <Virtuoso /> </div>
 *     <StatusBar flex-shrink-0 />          ← keyboard hints + msg N/total
 *   </div>
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

  const isLive = sessionMeta?.isLive ?? false
  useLiveTail(
    isLive && !onSubagent && activeSessionId ? activeSessionId : null,
    null,
  )
  useLiveTail(
    isLive && onSubagent ? drillTop.sessionId : null,
    isLive && onSubagent ? drillTop.agentId : null,
  )

  const activeQuery = onSubagent ? subagentQuery : sessionQuery
  const turns: Turn[] | undefined = activeQuery.data?.turns
  const interactions = activeQuery.data?.toolInteractions
  const nodes: VirtualNode[] = useFlatNodes(turns ?? EMPTY_TURNS, interactions)

  // Global keyboard shortcuts (Phase 3) — c, d, t, j, k, /, Escape.
  // Pass the flat-node array so j/k advances one TURN at a time (skipping
  // intra-turn child rows like capsules + diffs).
  useKeyboardShortcuts(nodes)

  const headerMeta = onSubagent
    ? buildSubagentMeta(activeSessionId, subagentQuery.data, sessionMeta)
    : sessionMeta
  const topModel = activeQuery.data?.tokenSeries.byModel[0]?.model

  if (activeSessionId === null) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center px-8">
        <div className="text-sm font-semibold text-foreground mb-2">Select a session</div>
        <div className="text-xs text-muted-foreground">Click a session in the sidebar to begin reading.</div>
      </div>
    )
  }

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
      <TranscriptHeader meta={headerMeta} topModel={topModel} showModeToggle />
      <div className="flex-1 min-h-0">
        <VirtualList nodes={nodes} />
      </div>
      <FocusedStatusBar total={nodes.length} />
    </div>
  )
}

const EMPTY_TURNS: Turn[] = []

function FocusedStatusBar({ total }: { total: number }) {
  const idx = useNavigationStore((s) => s.focusedMsgIndex)
  const current = idx < 0 || total === 0 ? null : Math.min(idx, total - 1) + 1
  return <StatusBar current={current} total={total} />
}

/** Subagent → SessionMeta-shaped projection for TranscriptHeader. */
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

function VirtualList({ nodes }: { nodes: VirtualNode[] }) {
  const initialIndex = useScrollStore.getState().lastScrollIndex
  const setScrollIndex = useScrollStore((s) => s.setScrollIndex)
  const virtuosoRef = useRef<VirtuosoHandle>(null)
  const autoFollow = useLiveStore((s) => s.autoFollow)
  const setAutoFollow = useLiveStore((s) => s.setAutoFollow)
  const pendingCount = useLiveStore((s) => s.pendingCount)
  const clearPending = useLiveStore((s) => s.clearPending)
  const focusedIdx = useNavigationStore((s) => s.focusedMsgIndex)
  const setFocusedMsgIndex = useNavigationStore((s) => s.setFocusedMsgIndex)
  const reducedMotion = useReducedMotion()
  const { narrow } = useResponsive()
  const scrollBehavior: ScrollBehavior = reducedMotion ? 'auto' : 'smooth'

  const pendingJump = useSearchStore((s) => s.pendingJumpTarget)
  const clearJump = useSearchStore((s) => s.clearJump)
  // Key of the row currently flashing (Phase 5). Cleared after the animation
  // completes so the same row can flash again on a second jump.
  const [flashedKey, setFlashedKey] = useState<string | null>(null)
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!pendingJump) return
    let idx = -1
    if (pendingJump.interactionId) {
      // Phase 5: prefer the matching capsule row over the parent turn.
      const colon = pendingJump.interactionId.lastIndexOf(':')
      const toolUseId = colon === -1 ? null : pendingJump.interactionId.slice(colon + 1)
      if (toolUseId !== null) {
        idx = nodes.findIndex(
          (n) =>
            n.kind === 'capsule' &&
            n.turn.uuid === pendingJump.turnUuid &&
            n.toolUseId === toolUseId,
        )
      }
    }
    if (idx === -1) {
      idx = nodes.findIndex(
        (n) => n.kind === 'turn' && n.turn.uuid === pendingJump.turnUuid,
      )
    }
    if (idx === -1) {
      // Continuation assistant turns (same role as prior, tool-only) emit no
      // `turn` shell — only `capsule` / `diff` / `thinking` rows carry the uuid.
      // Land on the first child row so jumps from Files / Tokens still resolve.
      idx = nodes.findIndex((n) => n.turn.uuid === pendingJump.turnUuid)
    }
    if (idx === -1) return
    clearJump()
    const targetKey = nodes[idx]!.key
    requestAnimationFrame(() => {
      virtuosoRef.current?.scrollToIndex({ index: idx, align: 'center', behavior: scrollBehavior })
    })
    setFlashedKey(targetKey)
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
    flashTimerRef.current = setTimeout(() => setFlashedKey(null), 900)
  }, [pendingJump, nodes, clearJump, scrollBehavior])

  useEffect(() => {
    return () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
    }
  }, [])

  // j/k scroll-into-view: when focusedMsgIndex changes (and is in range),
  // smooth-scroll Virtuoso to center the row.
  useEffect(() => {
    if (focusedIdx < 0 || focusedIdx >= nodes.length) return
    virtuosoRef.current?.scrollToIndex({
      index: focusedIdx,
      align: 'center',
      behavior: scrollBehavior,
    })
  }, [focusedIdx, nodes.length, scrollBehavior])

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
        itemContent={(idx, node) => {
          // The focus block groups every flat-node belonging to the same Turn
          // — text shell + thinking + capsules + diff all read as one
          // "selection box" so j/k feels like advancing a message, not a row.
          const focusedTurnUuid =
            focusedIdx >= 0 && focusedIdx < nodes.length ? nodes[focusedIdx]!.turn.uuid : null
          const isFocused = focusedTurnUuid !== null && node.turn.uuid === focusedTurnUuid
          const isFirstOfFocused =
            isFocused && (idx === 0 || nodes[idx - 1]!.turn.uuid !== node.turn.uuid)
          const isLastOfFocused =
            isFocused && (idx === nodes.length - 1 || nodes[idx + 1]!.turn.uuid !== node.turn.uuid)
          return (
            // Outer padding gives bordered children (capsules, diffs, command
            // blocks) breathing room from the panel dividers and from each
            // other. Use explicit pt-*/pb-* (never py-*) so first/last
            // overrides cannot collide with the baseline padding under
            // tailwind-merge — `py-1.5` and `pt-5` are in different conflict
            // groups, so twMerge keeps both and the result then depends on CSS
            // source order. Only the very first/last rows get extra padding so
            // content doesn't hug the scroll-viewport edges.
            <div
              className={cn(
                'px-4',
                idx === 0 ? 'pt-5' : 'pt-1.5',
                idx === nodes.length - 1 ? 'pb-8' : 'pb-1.5',
              )}
            >
              <div
                data-focused={isFocused ? 'true' : undefined}
                data-flash={flashedKey === node.key ? 'true' : undefined}
                className={cn(
                  'transition-colors border-l-2 border-transparent',
                  isFocused && 'bg-muted/40',
                  isFirstOfFocused && 'rounded-t-md pt-1',
                  isLastOfFocused && 'rounded-b-md pb-1',
                )}
              >
                <VirtualNodeRow node={node} />
              </div>
            </div>
          )
        }}
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
      {!narrow && (
        <Minimap
          nodes={nodes}
          focusedIndex={focusedIdx}
          onSeek={setFocusedMsgIndex}
        />
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
