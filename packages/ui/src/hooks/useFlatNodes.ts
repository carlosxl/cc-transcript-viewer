import { useMemo } from 'react'
import type { FlatNode, SessionView } from '@/lib/types'

/**
 * Flattens SessionView.turns into the j/k step order:
 *   for each SessionTurn: user-prompt node first, then one request-node per
 *   assistant request in document order.
 *
 * Stderr-envelope user prompts are still included here (only useFlatPrompts
 * filters them).
 */
export function useFlatNodes(view: SessionView | null): FlatNode[] {
  return useMemo(() => {
    if (!view) return []
    const out: FlatNode[] = []
    for (const turn of view.turns) {
      out.push({
        id: turn.id,
        meta: { kind: 'user', turn },
      })
      const total = turn.requests.length
      turn.requests.forEach((request, idx) => {
        out.push({
          id: request.id,
          meta: { kind: 'request', turn, request, idx: idx + 1, total },
        })
      })
    }
    return out
  }, [view])
}
