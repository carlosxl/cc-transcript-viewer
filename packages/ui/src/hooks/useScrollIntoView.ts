import { useCallback, type RefObject } from 'react'

interface ScrollOpts {
  behavior?: ScrollBehavior
  offsetTop?: number
}

/**
 * Scroll utilities for the transcript body.
 *
 *   scrollNodeIntoView(nodeId)
 *     Locates `[data-node-id="${nodeId}"]` inside `bodyRef.current` and
 *     scrolls the body so the node sits `offsetTop` px below the sticky
 *     nav bar. Smooth by default; pass behavior: 'auto' for initial loads.
 *
 *   initialJumpToBottom(bodyRef)
 *     Per FR-061: the design's prototype jumps three times (setTimeout
 *     0 / 80 / 350 ms) to defer past font-loading reflows. Mirrors that.
 */
export function useScrollIntoView(bodyRef: RefObject<HTMLElement | null>) {
  const scrollNodeIntoView = useCallback(
    (nodeId: string | null, opts: ScrollOpts = {}) => {
      if (!nodeId) return
      const container = bodyRef.current
      if (!container) return
      const el = container.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(nodeId)}"]`)
      if (!el) return
      const containerTop = container.getBoundingClientRect().top
      const elTop = el.getBoundingClientRect().top
      const target = container.scrollTop + (elTop - containerTop) - (opts.offsetTop ?? 110)
      container.scrollTo({ top: Math.max(0, target), behavior: opts.behavior ?? 'smooth' })
    },
    [bodyRef],
  )
  return { scrollNodeIntoView }
}

export function initialJumpToBottom(bodyRef: RefObject<HTMLElement | null>) {
  const run = () => {
    const c = bodyRef.current
    if (!c) return
    c.scrollTo({ top: c.scrollHeight, behavior: 'auto' })
  }
  setTimeout(run, 0)
  setTimeout(run, 80)
  setTimeout(run, 350)
}
