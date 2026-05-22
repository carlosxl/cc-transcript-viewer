import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useKeyboard } from '@/hooks/useKeyboard'
import { useLiveTail as useLiveTailEffect } from '@/hooks/useLiveTail'
import { useSessionView, projectSessionView } from '@/hooks/useSessionView'
import { useWorkspace } from '@/stores/useWorkspace'
import { useSessionStack } from '@/stores/useSessionStack'
import { useFocus } from '@/stores/useFocus'
import { useLiveTail } from '@/stores/useLiveTail'
import { useOverlays } from '@/stores/useOverlays'
import { getSession, listSessions } from '@/api/sessions'
import { getSubagent } from '@/api/subagents'
import { Workspace } from '@/components/layout/Workspace'
import { StatusBar } from '@/components/layout/StatusBar'
import { Sidebar } from '@/components/sidebar/Sidebar'
import { Transcript, type TranscriptHandle } from '@/components/transcript/Transcript'
import { Inspector } from '@/components/inspector/Inspector'
import { TurnJumper } from '@/components/overlays/TurnJumper'
import { SearchPalette } from '@/components/overlays/SearchPalette'
import { SessionReport } from '@/components/overlays/SessionReport'
import type {
  FocusedBlockMeta,
  FocusedNodeMeta,
  SearchHit,
  SessionDetailResponse,
  SessionTurn,
  ToolBlock,
} from '@/lib/types'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
})

function ThemeEffect() {
  const theme = useWorkspace((s) => s.theme)
  const density = useWorkspace((s) => s.density)
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])
  useEffect(() => {
    document.documentElement.setAttribute('data-density', density)
  }, [density])
  return null
}

function WorkspaceShell() {
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const queryClient = useQueryClient()
  const replaceRoot = useSessionStack((s) => s.replaceRoot)
  const pushFrame = useSessionStack((s) => s.push)
  const popFrame = useSessionStack((s) => s.pop)
  const resetFocus = useFocus((s) => s.reset)
  const setNode = useFocus((s) => s.setNode)
  const setBlock = useFocus((s) => s.setBlock)
  const view = useSessionStack((s) => s.stack[s.stack.length - 1]?.view ?? null)
  const livePending = useLiveTail((s) => s.livePending)

  const { data: detail } = useQuery({
    queryKey: ['session', activeSessionId],
    queryFn: ({ signal }) => getSession(activeSessionId!, { signal }),
    enabled: activeSessionId != null,
  })

  // Title + isLive come from the sidebar's SessionMeta list — SessionDetailResponse
  // omits them since the list already carries them.
  const { data: sessionsList } = useQuery({
    queryKey: ['sessions'],
    queryFn: ({ signal }) => listSessions({ signal }),
  })
  const activeMeta = useMemo(
    () => sessionsList?.sessions.find((s) => s.sessionId === activeSessionId) ?? null,
    [sessionsList, activeSessionId],
  )

  const projected = useSessionView(
    detail ?? null,
    useMemo(
      () => ({
        id: activeSessionId ?? '',
        title: activeMeta?.title ?? '',
        isLive: activeMeta?.isLive ?? false,
      }),
      [activeSessionId, activeMeta?.title, activeMeta?.isLive],
    ),
  )

  // Refresh stack root when the projected main-session view changes.
  // replaceRoot preserves any subagent frames on top when the session id matches.
  useEffect(() => {
    if (!projected) return
    replaceRoot(projected)
  }, [projected, replaceRoot])

  // Reset focus only when the sidebar selection changes (not on every projection
  // re-run — that would clobber focus during live-tail and subagent drill).
  useEffect(() => {
    resetFocus()
  }, [activeSessionId, resetFocus])

  const transcriptHandle = useRef<TranscriptHandle | null>(null)
  // Stable body ref passed into both Transcript (to install on its inner div)
  // and useKeyboard (for Space/Shift-Space page scrolling).
  const bodyRef = useRef<HTMLDivElement | null>(null)

  const scrollNodeIntoView = useCallback(
    (nodeId: string | null, opts?: { behavior?: ScrollBehavior }) => {
      const behavior: 'smooth' | 'auto' = opts?.behavior === 'auto' ? 'auto' : 'smooth'
      transcriptHandle.current?.scrollNodeIntoView(nodeId, { behavior })
    },
    [],
  )

  // ─── US2: subagent drill / pop ──────────────────────────────────────────
  const onDrillSubagent = useCallback(
    async (block: ToolBlock) => {
      if (!block.isSubagent || !block.subagentRef || !activeSessionId) return
      const parentLabel = useSessionStack.getState().current()?.view.title ?? ''
      const focusState = useFocus.getState()
      const snapshot = {
        nodeId: focusState.nodeId,
        blockId: focusState.blockId,
        scrollTop: bodyRef.current?.scrollTop ?? 0,
      }
      try {
        const detail = await queryClient.fetchQuery({
          queryKey: ['subagent', activeSessionId, block.subagentRef],
          queryFn: ({ signal }) => getSubagent(activeSessionId, block.subagentRef!, { signal }),
        })
        const subView = projectSessionView(detail, {
          id: `${activeSessionId}::${detail.agentId}`,
          title: detail.description || detail.agentType || 'Subagent',
          isLive: false,
          parentTurnId: undefined,
          parentSessionTitle: parentLabel,
        })
        pushFrame(subView, parentLabel, snapshot)
        resetFocus()
      } catch (err) {
        // Surface error in console; M4 smoke does not require an error toast.
        console.error('Failed to load subagent transcript', err)
      }
    },
    [activeSessionId, queryClient, pushFrame, resetFocus],
  )

  const restoreFromSnapshot = useCallback(
    (snap: { nodeId: string | null; blockId: string | null; scrollTop: number } | undefined) => {
      const parentView = useSessionStack.getState().current()?.view
      if (snap && snap.nodeId && parentView) {
        let restored = false
        for (const turn of parentView.turns) {
          if (turn.userMsgId === snap.nodeId) {
            const meta: FocusedNodeMeta = { kind: 'user', turn }
            setNode(snap.nodeId, meta)
            restored = true
            break
          }
          const ri = turn.requests.findIndex((r) => r.id === snap.nodeId)
          if (ri !== -1) {
            const r = turn.requests[ri]
            setNode(snap.nodeId, {
              kind: 'request',
              turn,
              request: r,
              idx: ri + 1,
              total: turn.requests.length,
            })
            restored = true
            break
          }
        }
        if (!restored) resetFocus()
      } else {
        resetFocus()
      }
      // Instant scroll restore (FR-061: focus restore on subagent pop is instant).
      const targetTop = snap?.scrollTop ?? 0
      const apply = () => {
        const el = bodyRef.current
        if (el) el.scrollTop = targetTop
      }
      requestAnimationFrame(apply)
      // Re-apply after virtuoso re-mounts in case the first frame ran too early.
      setTimeout(apply, 80)
    },
    [setNode, resetFocus],
  )

  const onPopSubagent = useCallback(() => {
    if (!useSessionStack.getState().isSubagent()) return
    const snap = popFrame()
    restoreFromSnapshot(snap ?? undefined)
  }, [popFrame, restoreFromSnapshot])

  useLiveTailEffect({
    sessionId: activeSessionId,
    isLive: activeMeta?.isLive ?? false,
    bodyRef,
  })

  // Default focus on first paint of a session: last request of the last turn.
  // Keyed on the stack-top view id so subagent drill-ins also trigger a fresh
  // default focus + initial scroll-to-bottom.
  useEffect(() => {
    if (!view || view.turns.length === 0) return
    if (useFocus.getState().nodeId) return // don't override a restored snapshot
    const last = view.turns[view.turns.length - 1]
    const r = last.requests[last.requests.length - 1]
    if (r) {
      setNode(r.id, {
        kind: 'request',
        turn: last,
        request: r,
        idx: last.requests.length,
        total: last.requests.length,
      })
    } else {
      setNode(last.userMsgId, { kind: 'user', turn: last })
    }
    transcriptHandle.current?.scrollToBottom('auto')
    // intentionally not depending on setNode (stable) — only react to session changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view?.id])

  const onJumpToBlock = useCallback(
    (bid: string, meta: FocusedBlockMeta) => {
      setBlock(bid, meta)
      transcriptHandle.current?.scrollNodeIntoView(meta.request.id, { behavior: 'smooth' })
    },
    [setBlock],
  )

  // Shift+G / LiveTailToast click: merge any buffered pending turns into the
  // detail query cache, instant-scroll to the new bottom, and dismiss the toast.
  // Draining pendingTurns without writing them to the detail cache would cause
  // the view to flicker — useSessionView re-projects without the merged turns
  // until the next /api/sessions/:id refetch.
  // (Declared before useKeyboard so it can be threaded as a Shift+G handler.)
  const onFollowTail = useCallback(() => {
    const drained = useLiveTail.getState().consumePending()
    if (drained.length > 0 && activeSessionId) {
      queryClient.setQueryData<SessionDetailResponse | undefined>(
        ['session', activeSessionId],
        (old) => {
          if (!old) return old
          const seen = new Set(old.turns.map((t) => t.uuid))
          const fresh = drained.filter((t) => !seen.has(t.uuid))
          if (fresh.length === 0) return old
          return { ...old, turns: [...old.turns, ...fresh] }
        },
      )
    }
    transcriptHandle.current?.scrollToBottom('auto')
    useLiveTail.getState().dismissToast()
  }, [activeSessionId, queryClient])

  useKeyboard({ view, bodyRef, scrollNodeIntoView, onPopSubagent, onFollowTail })

  // SearchPalette pick: if the hit lives in a different session, swap the
  // sidebar selection (which triggers the existing fetch path), then focus
  // the matching turn. closeAll() is called either way.
  const onPickSearchHit = useCallback(
    async (hit: SearchHit) => {
      useOverlays.getState().closeAll()
      const focusTurn = (turnId: string) => {
        // The target session may not be in the stack yet (cross-session jump);
        // poll briefly for the next render where the stack-top view has the turn.
        let attempts = 0
        const tryFocus = () => {
          const v = useSessionStack.getState().current()?.view
          const turn = v?.turns.find((t) => t.id === turnId || t.userMsgId === turnId)
          if (turn) {
            const last = turn.requests[turn.requests.length - 1]
            if (last) {
              setNode(last.id, {
                kind: 'request',
                turn,
                request: last,
                idx: turn.requests.length,
                total: turn.requests.length,
              })
              transcriptHandle.current?.scrollNodeIntoView(last.id, { behavior: 'smooth' })
            } else {
              setNode(turn.userMsgId, { kind: 'user', turn })
              transcriptHandle.current?.scrollNodeIntoView(turn.userMsgId, { behavior: 'smooth' })
            }
            return
          }
          attempts++
          if (attempts < 30) setTimeout(tryFocus, 60)
        }
        tryFocus()
      }

      if (hit.sessionId !== activeSessionId) {
        setActiveSessionId(hit.sessionId)
        // Prefetch so the focus call below sees turns sooner.
        try {
          await queryClient.fetchQuery({
            queryKey: ['session', hit.sessionId],
            queryFn: ({ signal }) => getSession(hit.sessionId, { signal }),
          })
        } catch {
          /* The active query effect will retry; focus poll will wait. */
        }
      }
      focusTurn(hit.turnUuid)
    },
    [activeSessionId, queryClient, setNode],
  )

  // TurnJumper pick: focus the last request of the turn (or its user prompt if
  // none) and smooth-scroll into view, matching default-focus rules.
  const onPickTurn = useCallback(
    (t: SessionTurn) => {
      const last = t.requests[t.requests.length - 1]
      if (last) {
        setNode(last.id, {
          kind: 'request',
          turn: t,
          request: last,
          idx: t.requests.length,
          total: t.requests.length,
        })
        transcriptHandle.current?.scrollNodeIntoView(last.id, { behavior: 'smooth' })
      } else {
        setNode(t.userMsgId, { kind: 'user', turn: t })
        transcriptHandle.current?.scrollNodeIntoView(t.userMsgId, { behavior: 'smooth' })
      }
    },
    [setNode],
  )

  return (
    <>
      <ThemeEffect />
      <Workspace
        sidebar={<Sidebar activeSessionId={activeSessionId} onSelectSession={setActiveSessionId} />}
        transcript={() =>
          view ? (
            <Transcript
              ref={transcriptHandle}
              bodyRef={bodyRef}
              view={view}
              livePending={livePending}
              onDrillSubagent={onDrillSubagent}
              onPopSubagent={onPopSubagent}
              onFollowTail={onFollowTail}
            />
          ) : (
            <EmptyTranscript hasSelection={activeSessionId != null} />
          )
        }
        inspector={<Inspector onJumpToBlock={onJumpToBlock} onDrillSubagent={onDrillSubagent} />}
        status={<StatusBar />}
      />
      <TurnJumper onPick={onPickTurn} />
      <SearchPalette onPick={onPickSearchHit} />
      <SessionReport sessionId={activeSessionId} sessionTitle={activeMeta?.title ?? ''} />
    </>
  )
}

function EmptyTranscript({ hasSelection }: { hasSelection: boolean }) {
  return (
    <div className="flex flex-1 items-center justify-center text-[12.5px] text-[var(--text-2)]">
      {hasSelection ? 'Loading session…' : 'Select a session from the sidebar.'}
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={200}>
        <WorkspaceShell />
      </TooltipProvider>
    </QueryClientProvider>
  )
}
