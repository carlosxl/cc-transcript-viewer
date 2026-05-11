import type { VirtualNode } from '@/lib/flatNodes'
import { TurnRow } from './TurnRow'
import { ToolCallRow } from './ToolCallRow'
import { ToolResultRow } from './ToolResultRow'
import { ThinkingRow } from './ThinkingRow'

/**
 * Per-VirtualNode renderer. Dispatches to real per-kind components.
 *
 * All rows render inline — there is no per-row expand/collapse anymore.
 * Visibility is controlled at the flat-node level by useUIStore.viewMode
 * (compact = user/assistant text only; details = everything).
 */
export function VirtualNodeRow({ node }: { node: VirtualNode }) {
  switch (node.kind) {
    case 'turn':        return <TurnRow turn={node.turn} />
    case 'tool-input':  return <ToolCallRow turn={node.turn} toolUseId={node.toolUseId} />
    case 'tool-output': return <ToolResultRow turn={node.turn} toolUseId={node.toolUseId} unmatched={node.unmatched} />
    case 'thinking':    return <ThinkingRow turn={node.turn} index={node.index} />
  }
}
