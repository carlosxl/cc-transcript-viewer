import { useMemo } from 'react'
import type { FlatToolItem, SessionView, ToolBlock, DiffBlock } from '@/lib/types'

/**
 * Flat list of every tool_use and diff block across the session, in document
 * order. Drives the `[` / `]` shortcut + the Tool stepper in the nav bar.
 */
export function useFlatTools(view: SessionView | null): FlatToolItem[] {
  return useMemo(() => {
    if (!view) return []
    const out: FlatToolItem[] = []
    for (const turn of view.turns) {
      for (const request of turn.requests) {
        request.blocks.forEach((block, idx) => {
          if (block.kind === 'tool_use' || block.kind === 'diff') {
            const bid = `${request.id}:b${idx}`
            out.push({ bid, block: block as ToolBlock | DiffBlock, request, turn })
          }
        })
      }
    }
    return out
  }, [view])
}
