import type { VirtualNode } from '@/lib/flatNodes'
import { TurnRow } from './TurnRow'
import { ToolCapsule } from './ToolCapsule'
import { DiffBlockRow } from './DiffBlock'
import { ThinkingRow } from './ThinkingRow'

/**
 * Per-VirtualNode renderer (Phase 4).
 *
 * Tool results are no longer flat-node kinds — they live in the right rail.
 * `capsule` clicks set `useNavigationStore.selectedInteractionId`; Phase 5
 * binds the rail to that selector.
 */
export function VirtualNodeRow({ node }: { node: VirtualNode }) {
  switch (node.kind) {
    case 'turn':     return <TurnRow turn={node.turn} />
    case 'capsule':  return <ToolCapsule turn={node.turn} toolUseId={node.toolUseId} />
    case 'diff':     return <DiffBlockRow turn={node.turn} toolUseId={node.toolUseId} />
    case 'thinking': return <ThinkingRow turn={node.turn} index={node.index} />
  }
}
