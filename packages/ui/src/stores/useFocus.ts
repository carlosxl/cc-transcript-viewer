import { create } from 'zustand'
import type { FocusedNodeMeta, FocusedBlockMeta } from '@/lib/types'

interface FocusState {
  nodeId: string | null
  nodeMeta: FocusedNodeMeta | null
  blockId: string | null
  blockMeta: FocusedBlockMeta | null
  setNode: (id: string, meta: FocusedNodeMeta) => void
  /**
   * Sets block focus AND enforces the FR-060 invariant: block focus implies
   * node focus on the block's owning request. Callers may opt out of the
   * node propagation by supplying the same nodeMeta they already have.
   */
  setBlock: (bid: string, meta: FocusedBlockMeta) => void
  clearBlock: () => void
  reset: () => void
}

export const useFocus = create<FocusState>((set) => ({
  nodeId: null,
  nodeMeta: null,
  blockId: null,
  blockMeta: null,
  setNode: (id, meta) =>
    set({
      nodeId: id,
      nodeMeta: meta,
      blockId: null,
      blockMeta: null,
    }),
  setBlock: (bid, meta) => {
    const owningNodeMeta: FocusedNodeMeta = {
      kind: 'request',
      turn: meta.turn,
      request: meta.request,
    }
    set({
      nodeId: meta.request.id,
      nodeMeta: owningNodeMeta,
      blockId: bid,
      blockMeta: meta,
    })
  },
  clearBlock: () => set({ blockId: null, blockMeta: null }),
  reset: () => set({ nodeId: null, nodeMeta: null, blockId: null, blockMeta: null }),
}))
