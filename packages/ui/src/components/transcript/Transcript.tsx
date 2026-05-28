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
  AttachmentRow as AttachmentRowType,
  FileHistorySnapshotRow,
  SystemRow,
} from '@cc-viewer/shared'
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
import { useCompact } from '@/stores/useCompact'
import { useFlatNodes } from '@/hooks/useFlatNodes'
import { TranscriptHeader } from './TranscriptHeader'
import { TranscriptNavBar } from './TranscriptNavBar'
import { TurnDivider } from './TurnDivider'
import { UserPrompt } from './UserPrompt'
import { RequestNode } from './RequestNode'
import { LiveTailToast } from './LiveTailToast'
import { TranscriptSessionProvider } from './TranscriptSessionContext'
import { SystemEventRow } from './SystemEventRow'
import { AttachmentRow } from './AttachmentRow'
import { renderInline } from '@/lib/markdown'

type TranscriptRow =
  | { kind: 'turn-divider'; turn: SessionTurn }
  | { kind: 'user-prompt'; turn: SessionTurn }
  | { kind: 'request'; turn: SessionTurn; request: Request; idx: number; total: number }
  | { kind: 'final-answer'; turn: SessionTurn; requestId: string; blockIdx: number; text: string }
  | { kind: 'system-event'; row: SystemRow }
  | { kind: 'standalone-attachment'; row: AttachmentRowType }
  | { kind: 'file-history-snapshot'; row: FileHistorySnapshotRow; seq: number }

/**
 * Attachment subtypes already surfaced inline on the UserPrompt as
 * `contextAttachments`. We skip them in the standalone attachment row so
 * they aren't shown twice.
 */
const CONTEXT_ATTACHMENT_TYPES = new Set(['deferred_tools_delta', 'skill_listing'])

/**
 * Mode-toggle attachments that are already represented by the sticky badge on
 * the user prompt (auto / plan). The standalone chip restated the same fact
 * one line below the prompt — drop it to avoid the duplication.
 */
const MODE_TOGGLE_ATTACHMENT_TYPES = new Set([
  'auto_mode',
  'auto_mode_exit',
  'plan_mode',
  'plan_mode_exit',
  'plan_mode_reentry',
])

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
  const compact = useCompact((s) => s.compact)

  const virtuosoRef = useRef<VirtuosoHandle | null>(null)

  // Build the flat-array projection (one row per turn-divider/user-prompt/request).
  // In compact mode, request rows are replaced by a single 'final-answer' text row.
  const { rows, indexByNodeId } = useMemo(() => buildRows(view, compact), [view, compact])

  // Flat list drives the j/k step shortcut.
  const flatNodes = useFlatNodes(view)

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
      // Find the turn index containing the focused node; pin to the first
      // request (or user prompt) of the next/prev turn so the reader starts
      // at the beginning of the new turn rather than its tail.
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
        const r = t.requests[0]
        setNode(r.id, { kind: 'request', turn: t, request: r, idx: 1, total: t.requests.length })
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

  // Initial scroll position: live sessions land at the bottom so the latest
  // assistant output is visible; historical sessions land at the top so the
  // user reads from the beginning. The three deferred runs in the live path
  // match the prototype's font-reflow workaround (FR-061 / R-XX).
  const initialIndex = view.isLive ? Math.max(0, rows.length - 1) : 0
  useEffect(() => {
    if (!view.isLive) return
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
  }, [view.id, view.isLive, rows.length])

  return (
    <TranscriptSessionProvider value={view.id || null}>
      <TranscriptHeader view={view} livePending={livePending} onPopSubagent={onPopSubagent} />
      <TranscriptNavBar
        view={view}
        onTurnStep={stepTurn}
        onReqStep={stepReq}
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
          components={{ List: VirtuosoList, Footer: BottomSpacer }}
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
    </TranscriptSessionProvider>
  )
})

/**
 * Virtuoso's default List wraps items in a div; we wrap it in the design's
 * `.tx-body-inner` so each row inherits the gutter and font baseline. Width
 * fills the column edge-to-edge to make use of wide screens.
 */
const VirtuosoList = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { context?: unknown }>(
  function VirtuosoList({ style, children, context: _ctx, ...rest }, listRef) {
    return (
      <div
        {...rest}
        ref={listRef}
        className="tx-body-inner tx-variant-a px-[22px] pt-3"
        style={{ width: '100%', maxWidth: '100%', ...style }}
      >
        {children}
      </div>
    )
  },
)

// Reserves scroll space below the last item so the final message clears the
// 26px status bar and gets comfortable breathing room when scrolled into view.
// Virtuoso includes the Footer in its scroll-height calculation, unlike a
// border-box padding on the list wrapper which competes with Virtuoso's
// explicit height.
function BottomSpacer() {
  return <div aria-hidden="true" style={{ height: 50 }} />
}

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
  if (row.kind === 'final-answer') {
    return <FinalAnswer text={row.text} />
  }
  if (row.kind === 'system-event') {
    return <SystemEventRow row={row.row} />
  }
  if (row.kind === 'standalone-attachment') {
    return <AttachmentRow row={row.row} />
  }
  if (row.kind === 'file-history-snapshot') {
    return <FileHistorySnapshotMarker row={row.row} />
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

function FinalAnswer({ text }: { text: string }) {
  return (
    <div className="va-final-answer">
      <div className="va-rail va-rail-req" />
      <div className="va-final-answer-body">{renderInline(text)}</div>
    </div>
  )
}

/**
 * Inline marker for a file-history-snapshot row that backed up files before
 * an edit. Most snapshots are empty session-init records; we only render the
 * `isSnapshotUpdate: true` ones with at least one tracked file (see filter
 * in buildRows).
 */
function FileHistorySnapshotMarker({ row }: { row: FileHistorySnapshotRow }) {
  const files = Object.keys(row.snapshot?.trackedFileBackups ?? {})
  const sample = files.slice(0, 3)
  const more = files.length - sample.length
  return (
    <div className="va-file-history" data-snapshot-update={row.isSnapshotUpdate || undefined}>
      <span className="va-file-history-icon">⤓</span>
      <span className="va-file-history-label">
        snapshot · {files.length} {files.length === 1 ? 'file' : 'files'}
      </span>
      <span className="va-file-history-files">
        {sample.join(', ')}
        {more > 0 && ` +${more} more`}
      </span>
    </div>
  )
}

function buildRows(view: SessionView, compact: boolean): { rows: TranscriptRow[]; indexByNodeId: Map<string, number> } {
  // First pass: build the turn-anchored rows exactly as before. The flat
  // `indexByNodeId` is computed against this base layout.
  const baseRows: TranscriptRow[] = []
  const baseIdxByNodeId = new Map<string, number>()
  // Map turn.userMsgId / request.id → index in baseRows so the chronological
  // walk below can compute insertion points for system and attachment rows.
  const uuidToBaseIdx = new Map<string, number>()
  for (const turn of view.turns) {
    baseRows.push({ kind: 'turn-divider', turn })
    baseRows.push({ kind: 'user-prompt', turn })
    baseIdxByNodeId.set(turn.userMsgId, baseRows.length - 1)
    uuidToBaseIdx.set(turn.userMsgId, baseRows.length - 1)
    if (compact) {
      for (const req of turn.requests) {
        req.blocks.forEach((blk, b) => {
          if (blk.kind !== 'text') return
          if (blk.body.trim().length === 0) return
          baseRows.push({ kind: 'final-answer', turn, requestId: req.id, blockIdx: b, text: blk.body })
        })
      }
      continue
    }
    turn.requests.forEach((request, i) => {
      baseRows.push({ kind: 'request', turn, request, idx: i + 1, total: turn.requests.length })
      baseIdxByNodeId.set(request.id, baseRows.length - 1)
      uuidToBaseIdx.set(request.id, baseRows.length - 1)
    })
  }

  // Compact mode collapses everything to a single final-answer per turn, so
  // skip the chronological merge — system events and standalone attachments
  // would only add noise in that view. Also short-circuit when no wire rows
  // are available (test fixtures, legacy callers).
  if (compact || view.rows.length === 0) {
    return { rows: baseRows, indexByNodeId: baseIdxByNodeId }
  }

  // Second pass: walk wire rows in JSONL order, mapping each renderable
  // system / standalone-attachment row to "insert after baseRows[k]" where k
  // is the index of the most recently encountered turn or request row.
  const extrasAfter = new Map<number, TranscriptRow[]>()
  let lastKnownIdx = -1
  let fhsSeq = 0
  const pushExtra = (after: number, row: TranscriptRow) => {
    const list = extrasAfter.get(after) ?? []
    list.push(row)
    extrasAfter.set(after, list)
  }
  for (const r of view.rows) {
    const t = (r as { type?: string }).type
    if (t === 'user' || t === 'assistant') {
      const idx = uuidToBaseIdx.get((r as { uuid?: string }).uuid ?? '')
      if (idx != null) lastKnownIdx = idx
      continue
    }
    if (t === 'system') {
      // `turn_duration` is surfaced beside the turn header (TurnDivider) — skip
      // here so it doesn't render as a trailing in-turn row.
      if ((r as { subtype?: string }).subtype === 'turn_duration') continue
      pushExtra(lastKnownIdx, { kind: 'system-event', row: r as SystemRow })
      continue
    }
    if (t === 'attachment') {
      const subtype = (r as { attachment?: { type?: string } }).attachment?.type
      if (!subtype || CONTEXT_ATTACHMENT_TYPES.has(subtype)) continue
      if (MODE_TOGGLE_ATTACHMENT_TYPES.has(subtype)) continue
      pushExtra(lastKnownIdx, { kind: 'standalone-attachment', row: r as AttachmentRowType })
      continue
    }
    if (t === 'file-history-snapshot') {
      const fhs = r as FileHistorySnapshotRow
      // Skip empty session-init snapshots and the initial (non-update) marker —
      // only show real backup events (writes/edits that copied a file aside).
      if (!fhs.isSnapshotUpdate) continue
      const files = fhs.snapshot?.trackedFileBackups
      if (!files || Object.keys(files).length === 0) continue
      pushExtra(lastKnownIdx, { kind: 'file-history-snapshot', row: fhs, seq: fhsSeq++ })
    }
  }

  if (extrasAfter.size === 0) {
    return { rows: baseRows, indexByNodeId: baseIdxByNodeId }
  }

  // Splice extras in; rebuild indexByNodeId against the new positions.
  const rows: TranscriptRow[] = []
  const indexByNodeId = new Map<string, number>()
  const flushExtras = (k: number) => {
    const xs = extrasAfter.get(k)
    if (xs) for (const x of xs) rows.push(x)
  }
  flushExtras(-1)
  for (let i = 0; i < baseRows.length; i++) {
    rows.push(baseRows[i])
    flushExtras(i)
  }
  rows.forEach((r, i) => {
    if (r.kind === 'user-prompt') indexByNodeId.set(r.turn.userMsgId, i)
    else if (r.kind === 'request') indexByNodeId.set(r.request.id, i)
  })
  return { rows, indexByNodeId }
}

function rowKey(row: TranscriptRow): string {
  if (row.kind === 'turn-divider') return `td:${row.turn.id}`
  if (row.kind === 'user-prompt') return `up:${row.turn.userMsgId}`
  if (row.kind === 'final-answer') return `fa:${row.requestId}:${row.blockIdx}`
  if (row.kind === 'system-event') return `sys:${row.row.uuid}`
  if (row.kind === 'standalone-attachment') return `att:${row.row.uuid}`
  if (row.kind === 'file-history-snapshot') return `fhs:${row.row.messageId}:${row.seq}`
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
