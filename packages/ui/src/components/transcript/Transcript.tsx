import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  type RefObject,
} from 'react'
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso'
import type {
  FlatNode,
  FocusedBlockMeta,
  FocusedNodeMeta,
  Request,
  SessionTurn,
  SessionView,
  ToolBlock,
} from '@/lib/types'
import { useFocus } from '@/stores/useFocus'
import { useOverlays } from '@/stores/useOverlays'
import { useLiveTail as useLiveTailStore } from '@/stores/useLiveTail'
import { useFlatNodes } from '@/hooks/useFlatNodes'
import { useFlatTools } from '@/hooks/useFlatTools'
import { useFlatPrompts } from '@/hooks/useFlatPrompts'
import { TranscriptHeader } from './TranscriptHeader'
import { TranscriptNavBar } from './TranscriptNavBar'
import { TurnDivider } from './TurnDivider'
import { UserPrompt } from './UserPrompt'
import { RequestNode } from './RequestNode'
import { LiveTailToast } from './LiveTailToast'

type TranscriptRow =
  | { kind: 'turn-divider'; turn: SessionTurn }
  | { kind: 'user-prompt'; turn: SessionTurn }
  | { kind: 'request'; turn: SessionTurn; request: Request; idx: number; total: number }

interface TranscriptProps {
  view: SessionView
  livePending: boolean
  /** Container element used by page-scroll shortcuts (Space / Shift+Space). */
  bodyRef: RefObject<HTMLDivElement | null>
  /** Fired by the in-capsule "Open subagent transcript" CTA (US2). */
  onDrillSubagent?: (block: ToolBlock) => void
  /** Fired by the header "Back to [parent]" button when in a subagent (US2). */
  onPopSubagent?: () => void
  /** Click handler for the LiveTailToast (US4). Same action as Shift+G. */
  onFollowTail?: () => void
}

export interface TranscriptHandle {
  scrollNodeIntoView: (nodeId: string | null, opts?: { behavior?: 'smooth' | 'auto' }) => void
  scrollToBottom: (behavior?: 'smooth' | 'auto') => void
}

export const Transcript = forwardRef<TranscriptHandle, TranscriptProps>(function Transcript(
  { view, livePending, bodyRef, onDrillSubagent, onPopSubagent, onFollowTail },
  ref,
) {
  const setNode = useFocus((s) => s.setNode)
  const setBlock = useFocus((s) => s.setBlock)
  const focusedNodeId = useFocus((s) => s.nodeId)
  const openJumper = useOverlays((s) => s.openJumper)
  const tailToast = useLiveTailStore((s) => s.tailToast)
  const dismissToast = useLiveTailStore((s) => s.dismissToast)

  const virtuosoRef = useRef<VirtuosoHandle | null>(null)

  // Build the flat-array projection (one row per turn-divider/user-prompt/request).
  const { rows, indexByNodeId } = useMemo(() => buildRows(view), [view])

  // Flat lists drive the steppers.
  const flatNodes = useFlatNodes(view)
  const flatTools = useFlatTools(view)
  const flatPrompts = useFlatPrompts(view)

  const scrollNodeIntoView = useCallback(
    (nodeId: string | null, opts: { behavior?: 'smooth' | 'auto' } = {}) => {
      if (!nodeId) return
      const index = indexByNodeId.get(nodeId)
      if (index == null) return
      virtuosoRef.current?.scrollToIndex({
        index,
        align: 'center',
        behavior: opts.behavior ?? 'smooth',
      })
    },
    [indexByNodeId],
  )

  const scrollToBottom = useCallback((behavior: 'smooth' | 'auto' = 'auto') => {
    if (rows.length === 0) return
    virtuosoRef.current?.scrollToIndex({ index: rows.length - 1, align: 'end', behavior })
  }, [rows.length])

  useImperativeHandle(
    ref,
    () => ({
      scrollNodeIntoView,
      scrollToBottom,
    }),
    [scrollNodeIntoView, scrollToBottom],
  )

  // Steppers — keyboard wiring uses these too (via useKeyboard), but the nav-bar
  // arrows mirror the same behaviour locally.
  const stepNode = useCallback(
    (delta: -1 | 1) => {
      const idx = currentIndex(flatNodes, focusedNodeId)
      const next = clamp(idx + delta, 0, flatNodes.length - 1)
      const target = flatNodes[next]
      if (!target) return
      setNode(target.id, target.meta)
      scrollNodeIntoView(target.id, { behavior: 'smooth' })
    },
    [flatNodes, focusedNodeId, setNode, scrollNodeIntoView],
  )

  const stepTurn = useCallback(
    (delta: -1 | 1) => {
      // Find the turn index containing the focused node; step to the last
      // request (or user prompt) of the next/prev turn.
      const currentTurnIdx = view.turns.findIndex(
        (t) => t.userMsgId === focusedNodeId || t.requests.some((r) => r.id === focusedNodeId),
      )
      const idx = currentTurnIdx === -1 ? view.turns.length - 1 : currentTurnIdx
      const next = clamp(idx + delta, 0, view.turns.length - 1)
      const t = view.turns[next]
      if (!t) return
      if (t.requests.length === 0) {
        setNode(t.userMsgId, { kind: 'user', turn: t })
        scrollNodeIntoView(t.userMsgId, { behavior: 'smooth' })
      } else {
        const r = t.requests[t.requests.length - 1]
        setNode(r.id, { kind: 'request', turn: t, request: r, idx: t.requests.length, total: t.requests.length })
        scrollNodeIntoView(r.id, { behavior: 'smooth' })
      }
    },
    [view, focusedNodeId, setNode, scrollNodeIntoView],
  )

  const stepReq = useCallback(
    (delta: -1 | 1) => {
      const turn = view.turns.find((t) => t.requests.some((r) => r.id === focusedNodeId)) ?? view.turns[view.turns.length - 1]
      if (!turn) return
      const idx = turn.requests.findIndex((r) => r.id === focusedNodeId)
      const next = clamp(idx + delta, 0, turn.requests.length - 1)
      const r = turn.requests[next]
      if (!r) return
      setNode(r.id, { kind: 'request', turn, request: r, idx: next + 1, total: turn.requests.length })
      scrollNodeIntoView(r.id, { behavior: 'smooth' })
    },
    [view, focusedNodeId, setNode, scrollNodeIntoView],
  )

  const stepPrompt = useCallback(
    (delta: -1 | 1) => {
      if (flatPrompts.length === 0) return
      const idx = flatPrompts.findIndex((p) => p.id === focusedNodeId)
      const next = clamp((idx === -1 ? flatPrompts.length : idx) + delta, 0, flatPrompts.length - 1)
      const target = flatPrompts[next]
      setNode(target.id, { kind: 'user', turn: target.turn })
      scrollNodeIntoView(target.id, { behavior: 'smooth' })
    },
    [flatPrompts, focusedNodeId, setNode, scrollNodeIntoView],
  )

  const stepTool = useCallback(
    (delta: -1 | 1) => {
      if (flatTools.length === 0) return
      const blockId = useFocus.getState().blockId
      const idx = blockId ? flatTools.findIndex((it) => it.bid === blockId) : -1
      const next = clamp((idx === -1 ? (delta === 1 ? -1 : flatTools.length) : idx) + delta, 0, flatTools.length - 1)
      const item = flatTools[next]
      if (!item) return
      setBlock(item.bid, { bid: item.bid, block: item.block, request: item.request, turn: item.turn })
      scrollNodeIntoView(item.request.id, { behavior: 'smooth' })
    },
    [flatTools, setBlock, scrollNodeIntoView],
  )

  const handleFocusNode = useCallback(
    (id: string, meta: FocusedNodeMeta) => {
      setNode(id, meta)
    },
    [setNode],
  )

  const handleFocusBlock = useCallback(
    (bid: string, meta: FocusedBlockMeta) => {
      setBlock(bid, meta)
    },
    [setBlock],
  )

  // Initial jump to bottom on session change. Three deferred runs match the
  // prototype's font-reflow workaround (FR-061 / R-XX).
  const initialIndex = Math.max(0, rows.length - 1)
  useEffect(() => {
    if (rows.length === 0) return
    const run = () => virtuosoRef.current?.scrollToIndex({ index: rows.length - 1, align: 'end', behavior: 'auto' })
    const t0 = setTimeout(run, 0)
    const t1 = setTimeout(run, 80)
    const t2 = setTimeout(run, 350)
    return () => {
      clearTimeout(t0)
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [view.id, rows.length])

  return (
    <>
      <TranscriptHeader view={view} livePending={livePending} onPopSubagent={onPopSubagent} />
      <TranscriptNavBar
        view={view}
        onTurnStep={stepTurn}
        onReqStep={stepReq}
        onPromptStep={stepPrompt}
        onToolStep={stepTool}
        onOpenJumper={(rect) => openJumper(rect)}
      />
      <div className="tx-body flex-1 overflow-hidden relative">
        <Virtuoso
          ref={virtuosoRef}
          scrollerRef={(r) => {
            bodyRef.current = (r as HTMLDivElement) ?? null
          }}
          data={rows}
          increaseViewportBy={{ top: 600, bottom: 600 }}
          initialTopMostItemIndex={initialIndex}
          components={{ List: VirtuosoList }}
          atBottomStateChange={(atBottom) => {
            if (atBottom) dismissToast()
          }}
          atBottomThreshold={24}
          itemContent={(_i, row) => (
            <RowSlot
              row={row}
              onFocusNode={handleFocusNode}
              onFocusBlock={handleFocusBlock}
              onDrillSubagent={onDrillSubagent}
              stepNode={stepNode}
            />
          )}
          computeItemKey={(_i, row) => rowKey(row)}
          style={{ height: '100%' }}
        />
        {tailToast && onFollowTail && <LiveTailToast onFollow={onFollowTail} />}
      </div>
    </>
  )
})

/**
 * Virtuoso's default List wraps items in a div; we wrap it in the design's
 * `.tx-body-inner` constraint so each row inherits the same max-width centering
 * as the prototype's static layout.
 */
const VirtuosoList = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { context?: unknown }>(
  function VirtuosoList({ style, children, context: _ctx, ...rest }, listRef) {
    return (
      <div
        {...rest}
        ref={listRef}
        className="tx-body-inner mx-auto px-[22px] pt-3 pb-[200px]"
        style={{ maxWidth: 920, ...style }}
      >
        {children}
      </div>
    )
  },
)

function RowSlot({
  row,
  onFocusNode,
  onFocusBlock,
  onDrillSubagent,
  stepNode,
}: {
  row: TranscriptRow
  onFocusNode: (id: string, meta: FocusedNodeMeta) => void
  onFocusBlock: (bid: string, meta: FocusedBlockMeta) => void
  onDrillSubagent?: (block: ToolBlock) => void
  stepNode: (delta: -1 | 1) => void
}) {
  void stepNode
  if (row.kind === 'turn-divider') {
    return (
      <TurnDivider
        turn={row.turn}
        onClick={() => {
          const t = row.turn
          const last = t.requests[t.requests.length - 1]
          if (last) {
            onFocusNode(last.id, {
              kind: 'request',
              turn: t,
              request: last,
              idx: t.requests.length,
              total: t.requests.length,
            })
          } else {
            onFocusNode(t.userMsgId, { kind: 'user', turn: t })
          }
        }}
      />
    )
  }
  if (row.kind === 'user-prompt') {
    return <UserPrompt turn={row.turn} onClick={() => onFocusNode(row.turn.userMsgId, { kind: 'user', turn: row.turn })} />
  }
  return (
    <RequestNode
      turn={row.turn}
      request={row.request}
      idx={row.idx}
      total={row.total}
      onFocusNode={onFocusNode}
      onFocusBlock={onFocusBlock}
      onDrillSubagent={onDrillSubagent}
    />
  )
}

function buildRows(view: SessionView): { rows: TranscriptRow[]; indexByNodeId: Map<string, number> } {
  const rows: TranscriptRow[] = []
  const indexByNodeId = new Map<string, number>()
  for (const turn of view.turns) {
    rows.push({ kind: 'turn-divider', turn })
    rows.push({ kind: 'user-prompt', turn })
    indexByNodeId.set(turn.userMsgId, rows.length - 1)
    turn.requests.forEach((request, i) => {
      rows.push({ kind: 'request', turn, request, idx: i + 1, total: turn.requests.length })
      indexByNodeId.set(request.id, rows.length - 1)
    })
  }
  return { rows, indexByNodeId }
}

function rowKey(row: TranscriptRow): string {
  if (row.kind === 'turn-divider') return `td:${row.turn.id}`
  if (row.kind === 'user-prompt') return `up:${row.turn.userMsgId}`
  return `rn:${row.request.id}`
}

function currentIndex(list: FlatNode[], focusedNodeId: string | null): number {
  if (!focusedNodeId) return list.length - 1
  const i = list.findIndex((n) => n.id === focusedNodeId)
  return i === -1 ? list.length - 1 : i
}

function clamp(v: number, min: number, max: number): number {
  if (v < min) return min
  if (v > max) return max
  return v
}
