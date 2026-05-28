import { useEffect, useRef, type RefObject } from 'react'
import { useFocus } from '@/stores/useFocus'
import { useOverlays } from '@/stores/useOverlays'
import { useSessionStack } from '@/stores/useSessionStack'
import { useWorkspace } from '@/stores/useWorkspace'
import { useLiveTail } from '@/stores/useLiveTail'
import { useCompact } from '@/stores/useCompact'
import { useFlatNodes } from './useFlatNodes'
import { useFlatPrompts } from './useFlatPrompts'
import { useFlatTools } from './useFlatTools'
import type { FlatNode, SessionTurn, SessionView } from '@/lib/types'

interface UseKeyboardOpts {
  view: SessionView | null
  bodyRef: RefObject<HTMLElement | null>
  scrollNodeIntoView: (nodeId: string | null, opts?: { behavior?: ScrollBehavior; offsetTop?: number }) => void
  /** Fired when the user presses Backspace inside a drilled-in subagent (US2). */
  onPopSubagent?: () => void
  /** Shift+G handler (US4): drain pending live turns, instant-scroll, dismiss. */
  onFollowTail?: () => void
}

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

/**
 * Single global keyboard handler implementing FR-080.
 *
 * Subscribes to the stores it needs; the parent (App.tsx) supplies the
 * derived SessionView and the bodyRef for page scrolling.
 */
export function useKeyboard({ view, bodyRef, scrollNodeIntoView, onPopSubagent, onFollowTail }: UseKeyboardOpts) {
  const flatNodes = useFlatNodes(view)
  const flatPrompts = useFlatPrompts(view)
  const flatTools = useFlatTools(view)
  const lastGRef = useRef(0)

  // Latest snapshots avoid recreating the handler on every store update.
  const refs = useRef({ flatNodes, flatPrompts, flatTools, view, onPopSubagent, onFollowTail })
  refs.current = { flatNodes, flatPrompts, flatTools, view, onPopSubagent, onFollowTail }

  useEffect(() => {
    function findCurrentNodeIndex(nodes: FlatNode[]): number {
      const id = useFocus.getState().nodeId
      if (!id) return -1
      return nodes.findIndex((n) => n.id === id)
    }

    function stepNode(delta: number) {
      const { flatNodes: nodes } = refs.current
      if (nodes.length === 0) return
      const cur = findCurrentNodeIndex(nodes)
      const next = cur < 0 ? (delta > 0 ? 0 : nodes.length - 1) : Math.max(0, Math.min(nodes.length - 1, cur + delta))
      const target = nodes[next]
      useFocus.getState().setNode(target.id, target.meta)
      scrollNodeIntoView(target.id)
    }

    function stepTurn(delta: number) {
      const v = refs.current.view
      if (!v || v.turns.length === 0) return
      const id = useFocus.getState().nodeId
      const turns = v.turns
      let curTurnIdx = -1
      if (id) {
        curTurnIdx = turns.findIndex((t) => t.id === id || t.requests.some((r) => r.id === id))
      }
      const nextTurnIdx = curTurnIdx < 0 ? (delta > 0 ? 0 : turns.length - 1) : Math.max(0, Math.min(turns.length - 1, curTurnIdx + delta))
      const target = turns[nextTurnIdx]
      useFocus.getState().setNode(target.id, { kind: 'user', turn: target })
      scrollNodeIntoView(target.id)
    }

    function stepPrompt(delta: number) {
      const prompts = refs.current.flatPrompts
      if (prompts.length === 0) return
      const id = useFocus.getState().nodeId
      let cur = -1
      if (id) {
        // Find the nearest prompt by user-msg id or turn ownership
        cur = prompts.findIndex((p) => p.id === id)
        if (cur < 0) {
          // map current request id back to its turn, then find that turn in prompts
          const v = refs.current.view
          if (v) {
            const owningTurn = v.turns.find((t: SessionTurn) => t.id === id || t.requests.some((r) => r.id === id))
            if (owningTurn) cur = prompts.findIndex((p) => p.turn.id === owningTurn.id)
          }
        }
      }
      const nextIdx = cur < 0 ? (delta > 0 ? 0 : prompts.length - 1) : Math.max(0, Math.min(prompts.length - 1, cur + delta))
      const target = prompts[nextIdx]
      useFocus.getState().setNode(target.id, { kind: 'user', turn: target.turn })
      scrollNodeIntoView(target.id)
    }

    function stepTool(delta: number) {
      const tools = refs.current.flatTools
      if (tools.length === 0) return
      const blockId = useFocus.getState().blockId
      let cur = blockId ? tools.findIndex((t) => t.bid === blockId) : -1
      const next = cur < 0 ? (delta > 0 ? 0 : tools.length - 1) : Math.max(0, Math.min(tools.length - 1, cur + delta))
      const target = tools[next]
      useFocus.getState().setBlock(target.bid, {
        bid: target.bid,
        block: target.block,
        request: target.request,
        turn: target.turn,
      })
      scrollNodeIntoView(target.request.id)
    }

    function pageScroll(direction: 1 | -1) {
      const c = bodyRef.current
      if (!c) return
      c.scrollBy({ top: c.clientHeight * 0.85 * direction, behavior: 'smooth' })
    }

    function jumpTop() {
      const v = refs.current.view
      if (!v || v.turns.length === 0) return
      const first = v.turns[0]
      useFocus.getState().setNode(first.id, { kind: 'user', turn: first })
      const c = bodyRef.current
      if (c) c.scrollTo({ top: 0, behavior: 'smooth' })
    }

    function jumpBottom() {
      const v = refs.current.view
      if (!v || v.turns.length === 0) return
      // US4: if there's a live-tail handler wired, defer to it — it drains
      // pending turns, scrolls instant to the new bottom, and dismisses the
      // toast. Falling back to the local smooth-scroll keeps the shortcut
      // functional when no live session is loaded.
      const follow = refs.current.onFollowTail
      if (follow) {
        // Sync focus to the new bottom first so the status crumb tracks.
        const last = v.turns[v.turns.length - 1]
        const lastReq = last.requests[last.requests.length - 1]
        if (lastReq) {
          useFocus.getState().setNode(lastReq.id, {
            kind: 'request',
            turn: last,
            request: lastReq,
            idx: last.requests.length,
            total: last.requests.length,
          })
        } else {
          useFocus.getState().setNode(last.userMsgId, { kind: 'user', turn: last })
        }
        follow()
        return
      }
      const last = v.turns[v.turns.length - 1]
      const target = last.requests.length > 0
        ? { id: last.requests[last.requests.length - 1].id, meta: { kind: 'request' as const, turn: last, request: last.requests[last.requests.length - 1], idx: last.requests.length, total: last.requests.length } }
        : { id: last.id, meta: { kind: 'user' as const, turn: last } }
      useFocus.getState().setNode(target.id, target.meta)
      const c = bodyRef.current
      if (c) c.scrollTo({ top: c.scrollHeight, behavior: 'smooth' })
      useLiveTail.getState().dismissToast()
    }

    function onKeyDown(e: KeyboardEvent) {
      if (isEditable(e.target)) return

      // Esc handled even when overlays open
      if (e.key === 'Escape') {
        if (useOverlays.getState().closeTop()) {
          e.preventDefault()
          return
        }
        if (useFocus.getState().blockId) {
          useFocus.getState().clearBlock()
          e.preventDefault()
        }
        return
      }

      // Don't fire shortcuts while overlays are open
      const overlays = useOverlays.getState()
      const overlayOpen = overlays.search.open || overlays.report.open || overlays.jumper.open || overlays.image.open
      if (overlayOpen) return

      const meta = e.metaKey || e.ctrlKey
      const shift = e.shiftKey

      // ⌘K / Ctrl+K → search
      if (meta && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        overlays.openSearch()
        return
      }

      // No modifier keys (except shift) past this point
      if (meta || e.altKey) return

      // "/" → search
      if (e.key === '/') {
        e.preventDefault()
        overlays.openSearch()
        return
      }

      // gg → top
      if (e.key === 'g' && !shift) {
        const now = performance.now()
        if (now - lastGRef.current < 700) {
          lastGRef.current = 0
          e.preventDefault()
          jumpTop()
          return
        }
        lastGRef.current = now
        return
      }

      // Shift+G → bottom
      if (e.key === 'G' && shift) {
        e.preventDefault()
        jumpBottom()
        return
      }

      // Shift+T → jumper
      if (e.key === 'T' && shift) {
        e.preventDefault()
        overlays.openJumper(null)
        return
      }

      // t → theme
      if (e.key === 't' && !shift) {
        e.preventDefault()
        useWorkspace.getState().toggleTheme()
        return
      }

      // c → compact mode toggle
      if (e.key === 'c' && !shift) {
        e.preventDefault()
        useCompact.getState().toggle()
        return
      }

      // r → report
      if (e.key === 'r' && !shift) {
        e.preventDefault()
        overlays.toggleReport()
        return
      }

      // j / k → step node
      if (e.key === 'j' && !shift) { e.preventDefault(); stepNode(1); return }
      if (e.key === 'k' && !shift) { e.preventDefault(); stepNode(-1); return }

      // Shift+J / Shift+K → step turn
      if (e.key === 'J' && shift) { e.preventDefault(); stepTurn(1); return }
      if (e.key === 'K' && shift) { e.preventDefault(); stepTurn(-1); return }

      // n / Shift+N → step prompt
      if (e.key === 'n' && !shift) { e.preventDefault(); stepPrompt(1); return }
      if (e.key === 'N' && shift)  { e.preventDefault(); stepPrompt(-1); return }

      // [ / ] → step tool
      if (e.key === '[') { e.preventDefault(); stepTool(-1); return }
      if (e.key === ']') { e.preventDefault(); stepTool(1); return }

      // Space / Shift+Space → page scroll
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault()
        pageScroll(shift ? -1 : 1)
        return
      }

      // Subagent pop: Backspace when in subagent
      if (e.key === 'Backspace' && useSessionStack.getState().isSubagent()) {
        e.preventDefault()
        refs.current.onPopSubagent?.()
        return
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [bodyRef, scrollNodeIntoView])
}
