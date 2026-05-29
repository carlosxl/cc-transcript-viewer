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
import { TurnJumper } from '@/components/overlays/TurnJumper'
import { ImageLightbox } from '@/components/overlays/ImageLightbox'
import { SearchPalette } from '@/components/overlays/SearchPalette'
import { SessionReport } from '@/components/overlays/SessionReport'
import type {
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

/**
 * Read `?session=<id-or-prefix>` from the current URL. Returns the raw value
 * (untrimmed of case). Caller resolves prefixes against the sessions list.
 */
function readSessionParam(): string | null {
  if (typeof window === 'undefined') return null
  const v = new URLSearchParams(window.location.search).get('session')
  return v && v.trim().length > 0 ? v.trim() : null
}

/**
 * Resolve a session id-or-prefix to a full sessionId from a list of sessions.
 * Exact match wins; otherwise case-insensitive prefix match. Ambiguous prefixes
 * (multiple matches) return null so the caller can defer (e.g. open palette).
 */
function resolveSessionRef(ref: string, sessions: readonly { sessionId: string }[]): string | null {
  const lower = ref.toLowerCase()
  const exact = sessions.find((s) => s.sessionId.toLowerCase() === lower)
  if (exact) return exact.sessionId
  const prefixed = sessions.filter((s) => s.sessionId.toLowerCase().startsWith(lower))
  return prefixed.length === 1 ? prefixed[0].sessionId : null
}

function WorkspaceShell() {
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const queryClient = useQueryClient()
  const replaceRoot = useSessionStack((s) => s.replaceRoot)
  const pushFrame = useSessionStack((s) => s.push)
  const popFrame = useSessionStack((s) => s.pop)
  const resetFocus = useFocus((s) => s.reset)
  const setNode = useFocus((s) => s.setNode)
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

  // Deep-link: `?session=<id-or-prefix>` selects the matching session once the
  // sidebar list loads. We only resolve unambiguous prefixes — silent on
  // multi-match so the user can disambiguate via the search palette.
  // Runs once per ref so re-renders don't fight a manual selection.
  //
  // `bootstrapped` gates the URL-mirror effect below: on first paint
  // activeSessionId is still null, and without the gate the mirror would
  // strip the user's `?session=` deep-link before this effect has a chance
  // to read and resolve it.
  const lastResolvedRef = useRef<string | null>(null)
  const [bootstrapped, setBootstrapped] = useState(false)
  useEffect(() => {
    if (!sessionsList) return
    const ref = readSessionParam()
    if (ref && ref !== lastResolvedRef.current) {
      const resolved = resolveSessionRef(ref, sessionsList.sessions)
      if (resolved) {
        lastResolvedRef.current = ref
        setActiveSessionId(resolved)
      }
    }
    if (!bootstrapped) setBootstrapped(true)
  }, [sessionsList, bootstrapped])

  // Mirror activeSessionId into the URL so it's shareable. replaceState avoids
  // polluting back/forward — the URL is always "current view", not history.
  // Skipped until the deep-link resolver has run at least once.
  useEffect(() => {
    if (typeof window === 'undefined' || !bootstrapped) return
    const url = new URL(window.location.href)
    const current = url.searchParams.get('session')
    if (activeSessionId) {
      if (current === activeSessionId) return
      url.searchParams.set('session', activeSessionId)
    } else {
      if (current == null) return
      url.searchParams.delete('session')
    }
    window.history.replaceState(null, '', url.toString())
  }, [activeSessionId, bootstrapped])

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

  // Default focus on first paint of a session. Live: tail behavior — focus the
  // last request and scroll to the bottom so the latest assistant output is
  // visible. Historical: read-from-top — focus the first turn and leave the
  // viewport at the top so the user starts at the beginning.
  // Keyed on the stack-top view id so subagent drill-ins also trigger a fresh
  // default focus.
  useEffect(() => {
    if (!view || view.turns.length === 0) return
    if (useFocus.getState().nodeId) return // don't override a restored snapshot
    if (view.isLive) {
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
    } else {
      const first = view.turns[0]
      const r = first.requests[0]
      if (r) {
        setNode(r.id, {
          kind: 'request',
          turn: first,
          request: r,
          idx: 1,
          total: first.requests.length,
        })
      } else {
        setNode(first.userMsgId, { kind: 'user', turn: first })
      }
    }
    // intentionally not depending on setNode (stable) — only react to session changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view?.id, view?.isLive])

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
  //
  // 007-ui-information-revamp T052: SearchHit.turnUuid is the *row* uuid that
  // matched (user, assistant, attachment, system — any indexed row). Resolve
  // it to the owning SessionTurn via three fallbacks:
  //   1) the row is a user prompt → turn.userMsgId / turn.id direct match
  //   2) the row is an assistant request → turn.requests[i].id direct match
  //   3) the row is something else (attachment, system, state) → look up the
  //      row's promptId in view.rows and find the SessionTurn whose promptId
  //      matches. Covers the new FTS5 indexing scope from T050.
  const onPickSearchHit = useCallback(
    async (hit: SearchHit) => {
      useOverlays.getState().closeAll()
      const focusByRowUuid = (rowUuid: string) => {
        // The target session may not be in the stack yet (cross-session jump);
        // poll briefly for the next render where the stack-top view has the turn.
        let attempts = 0
        const tryFocus = () => {
          const v = useSessionStack.getState().current()?.view
          const resolved = v ? resolveSearchHit(v, rowUuid) : null
          if (resolved) {
            if (resolved.request) {
              setNode(resolved.request.id, {
                kind: 'request',
                turn: resolved.turn,
                request: resolved.request,
                idx: resolved.requestIdx,
                total: resolved.turn.requests.length,
              })
              transcriptHandle.current?.scrollNodeIntoView(resolved.request.id, {
                behavior: 'smooth',
              })
            } else {
              setNode(resolved.turn.userMsgId, { kind: 'user', turn: resolved.turn })
              transcriptHandle.current?.scrollNodeIntoView(resolved.turn.userMsgId, {
                behavior: 'smooth',
              })
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
      focusByRowUuid(hit.turnUuid)
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
        status={<StatusBar />}
      />
      <TurnJumper onPick={onPickTurn} />
      <SearchPalette
        onPick={onPickSearchHit}
        onPickSession={(sessionId) => {
          useOverlays.getState().closeAll()
          setActiveSessionId(sessionId)
        }}
      />
      <SessionReport sessionId={activeSessionId} sessionTitle={activeMeta?.title ?? ''} />
      <ImageLightbox />
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

/**
 * Resolve a search-hit row UUID to the owning SessionTurn (and optionally the
 * matching request within it). Three fallbacks in priority order:
 *   1) Direct match against SessionTurn.userMsgId/id (user-prompt hits).
 *   2) Direct match against Request.id (assistant-row hits).
 *   3) Look up the row's `promptId` in view.rows and find the SessionTurn
 *      whose `promptId` matches (attachment, system, state-change hits).
 */
function resolveSearchHit(
  view: { turns: SessionTurn[]; rows: import('@/lib/types').ClaudeRowOrUnknown[] },
  rowUuid: string,
): { turn: SessionTurn; request?: import('@/lib/types').Request; requestIdx: number } | null {
  for (const turn of view.turns) {
    if (turn.id === rowUuid || turn.userMsgId === rowUuid) {
      return { turn, requestIdx: turn.requests.length }
    }
    const reqIdx = turn.requests.findIndex((r) => r.id === rowUuid)
    if (reqIdx !== -1) {
      const request = turn.requests[reqIdx]!
      return { turn, request, requestIdx: reqIdx + 1 }
    }
  }
  // Row-level fallback — find the row, read its promptId, match the SessionTurn.
  for (const row of view.rows) {
    const uuid = (row as { uuid?: unknown }).uuid
    if (uuid !== rowUuid) continue
    const promptId = (row as { promptId?: unknown }).promptId
    if (typeof promptId !== 'string') return null
    const turn = view.turns.find((t) => t.promptId === promptId)
    if (!turn) return null
    if (turn.requests.length === 0) return { turn, requestIdx: 0 }
    return {
      turn,
      request: turn.requests[turn.requests.length - 1]!,
      requestIdx: turn.requests.length,
    }
  }
  return null
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
