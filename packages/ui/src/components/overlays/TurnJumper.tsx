import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { fmtCost, fmtRelativeTime, shortPreview } from '@/lib/format'
import { useFocus } from '@/stores/useFocus'
import { useOverlays } from '@/stores/useOverlays'
import { useSessionStack } from '@/stores/useSessionStack'
import type { SessionTurn } from '@/lib/types'

interface TurnJumperProps {
  onPick: (turn: SessionTurn) => void
}

const SHELL_WIDTH = 500
const MARGIN = 8

export function TurnJumper({ onPick }: TurnJumperProps) {
  const open = useOverlays((s) => s.jumper.open)
  const anchor = useOverlays((s) => s.jumper.anchor)
  const close = useOverlays((s) => s.closeJumper)
  const view = useSessionStack((s) => s.stack[s.stack.length - 1]?.view ?? null)
  const focusedNodeId = useFocus((s) => s.nodeId)

  const turns = view?.turns ?? []

  // Determine which turn is currently "focused" so we open with cursor on it.
  const focusedTurnId = useMemo(() => {
    if (!view || !focusedNodeId) return null
    const t = view.turns.find(
      (turn) => turn.userMsgId === focusedNodeId || turn.requests.some((r) => r.id === focusedNodeId),
    )
    return t?.id ?? null
  }, [view, focusedNodeId])

  const [active, setActive] = useState(0)

  useEffect(() => {
    if (!open) return
    const idx = Math.max(0, turns.findIndex((t) => t.id === focusedTurnId))
    setActive(idx)
  }, [open, focusedTurnId, turns])

  // Arrow up/down + Enter handler (scoped to overlay-open).
  // Esc is intentionally handled by the global useKeyboard via closeTop().
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActive((a) => Math.min(a + 1, turns.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActive((a) => Math.max(0, a - 1))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const t = turns[active]
        if (t) {
          onPick(t)
          close()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, active, turns, onPick, close])

  // Scroll active row into view inside the jumper list.
  const listRef = useRef<HTMLDivElement | null>(null)
  useLayoutEffect(() => {
    if (!open) return
    const list = listRef.current
    if (!list) return
    const row = list.querySelector<HTMLElement>(`[data-row="${active}"]`)
    if (row) row.scrollIntoView({ block: 'nearest' })
  }, [open, active])

  if (!open || !view || turns.length === 0) return null

  // Position the popover under the Turn-stepper rect; clamp to viewport.
  const style: React.CSSProperties = (() => {
    if (anchor) {
      const top = anchor.bottom + 6
      const left = Math.min(
        Math.max(MARGIN, anchor.left),
        window.innerWidth - SHELL_WIDTH - MARGIN,
      )
      return { top, left }
    }
    return { top: 100, left: 320 }
  })()

  return createPortal(
    <>
      <div
        className="overlay-backdrop fixed inset-0 z-[70]"
        style={{ background: 'transparent' }}
        onClick={close}
      />
      <div
        role="dialog"
        aria-label="Turn jumper"
        className="jumper-shell fixed z-[80] flex flex-col overflow-hidden border bg-[var(--surface-1)]"
        style={{
          ...style,
          width: SHELL_WIDTH,
          maxHeight: '60vh',
          borderColor: 'var(--border-2)',
          borderRadius: 'var(--r-lg)',
          boxShadow: 'var(--shadow-overlay)',
        }}
      >
        <div
          className="jumper-head flex items-center gap-2 border-b px-[14px] py-[10px] font-mono text-[10.5px] uppercase text-[var(--text-3)]"
          style={{ borderColor: 'var(--border-1)', letterSpacing: '0.07em' }}
        >
          <span>Turn jumper</span>
          <span className="count ml-auto text-[var(--text-1)]">{turns.length} Turns</span>
        </div>
        <div
          ref={listRef}
          className="jumper-list overflow-y-auto"
          style={{ padding: '4px 0 6px' }}
        >
          {turns.map((t, i) => {
            const reqs = t.requests.length
            const blocks = t.requests.reduce((s, r) => s + r.blocks.length, 0)
            const cost = t.requests.reduce((s, r) => s + r.cost, 0)
            const isActive = active === i
            return (
              <div
                key={t.id}
                data-row={i}
                data-active={isActive || undefined}
                onMouseEnter={() => setActive(i)}
                onClick={() => {
                  onPick(t)
                  close()
                }}
                className="jumper-row grid cursor-pointer items-center gap-[10px] border-l-2 px-[14px] py-[8px]"
                style={{
                  gridTemplateColumns: '56px 1fr auto',
                  borderLeftColor: isActive ? 'var(--accent)' : 'transparent',
                  background: isActive ? 'var(--surface-2)' : 'transparent',
                }}
              >
                <div className="id font-mono text-[11px] text-[var(--text-0)]">
                  {t.id}
                  <span className="time block text-[10px] text-[var(--text-3)]">{fmtRelativeTime(t.time)}</span>
                </div>
                <div
                  className="preview min-w-0 overflow-hidden text-[12px] text-[var(--text-1)]"
                  style={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}
                >
                  {shortPreview(t.prompt, 70)}
                </div>
                <div className="meta flex gap-[8px] whitespace-nowrap font-mono text-[10.5px] text-[var(--text-3)]">
                  <span>{reqs}r</span>
                  <span>{blocks}b</span>
                  <span className="cost text-[var(--text-1)]">{fmtCost(cost)}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </>,
    document.body,
  )
}
