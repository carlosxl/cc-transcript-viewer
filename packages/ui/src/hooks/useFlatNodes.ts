import { useMemo } from 'react'
import type { ToolInteraction, Turn } from '@cc-viewer/shared'
import { useUIStore } from '@/stores/useUIStore'
import { buildFlatNodes, type VirtualNode } from '@/lib/flatNodes'

/**
 * Phase 4: turns + interactions → flat node array.
 *
 * `interactions` is the projection returned by the active detail response;
 * the hook uses it only to determine which capsules also need a `diff` node.
 * `viewMode` from `useUIStore` controls thinking visibility (compact = hide).
 */
export function useFlatNodes(
  turns: Turn[],
  interactions: ToolInteraction[] | undefined,
): VirtualNode[] {
  const viewMode = useUIStore((s) => s.viewMode)
  const showThinking = viewMode === 'details'
  const diffIds = useMemo(() => {
    const s = new Set<string>()
    if (interactions) {
      for (const it of interactions) {
        if (it.diff) s.add(it.toolUseId)
      }
    }
    return s
  }, [interactions])
  return useMemo(
    () =>
      buildFlatNodes(turns, {
        showThinking,
        hasDiff: (id) => diffIds.has(id),
      }),
    [turns, showThinking, diffIds],
  )
}
