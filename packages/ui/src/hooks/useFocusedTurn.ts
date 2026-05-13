import { useMemo } from 'react'
import type { Turn } from '@cc-viewer/shared'
import { useNavigationStore } from '@/stores/useNavigationStore'
import { useActiveQuery } from './useActiveQuery'
import { useFlatNodes } from './useFlatNodes'

export interface FocusedTurn {
  turn: Turn
  /** The next assistant turn after `turn` in source order. Populated for user
   * turns so the UserMessageInspector can render a "feeds into" card. */
  nextAssistantTurn: Turn | null
}

/**
 * Resolve `useNavigationStore.focusedMsgIndex` (an index into the flat
 * `VirtualNode[]`) back to the underlying `Turn`. Returns `null` when nothing
 * is focused or the data isn't loaded yet.
 *
 * Tool capsule and diff child rows reuse their parent assistant turn, so j/k
 * landing on a child surfaces the MessageInspector for the whole assistant
 * turn — not a synthesized per-part inspector.
 */
export function useFocusedTurn(): FocusedTurn | null {
  const focusedIdx = useNavigationStore((s) => s.focusedMsgIndex)
  const { turns, interactions } = useActiveQuery()
  const nodes = useFlatNodes(turns ?? EMPTY_TURNS, interactions)

  return useMemo<FocusedTurn | null>(() => {
    if (focusedIdx < 0 || focusedIdx >= nodes.length) return null
    const node = nodes[focusedIdx]
    if (!node) return null
    const turn = node.turn
    let nextAssistantTurn: Turn | null = null
    if (turn.role === 'user' && turns) {
      const turnIdx = turns.findIndex((t) => t.uuid === turn.uuid)
      if (turnIdx >= 0) {
        for (let i = turnIdx + 1; i < turns.length; i++) {
          const t = turns[i]
          if (t && t.role === 'assistant' && !t.isMeta) {
            nextAssistantTurn = t
            break
          }
        }
      }
    }
    return { turn, nextAssistantTurn }
  }, [focusedIdx, nodes, turns])
}

const EMPTY_TURNS: Turn[] = []
