import { useMemo } from 'react'
import type { Turn } from '@cc-viewer/shared'
import { useUIStore } from '@/stores/useUIStore'
import { buildFlatNodes, type VirtualNode } from '@/lib/flatNodes'

export function useFlatNodes(turns: Turn[]): VirtualNode[] {
  const viewMode = useUIStore((s) => s.viewMode)
  return useMemo(
    () => buildFlatNodes(turns, viewMode),
    [turns, viewMode],
  )
}
