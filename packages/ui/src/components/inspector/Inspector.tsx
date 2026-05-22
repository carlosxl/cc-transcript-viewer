import type { FocusedBlockMeta, ToolBlock } from '@/lib/types'
import { useFocus } from '@/stores/useFocus'
import { InspectorEmpty } from './InspectorEmpty'
import { InspectorRequest } from './InspectorRequest'
import { InspectorUser } from './InspectorUser'
import { InspectorTool } from './InspectorTool'
import { InspectorDiff } from './InspectorDiff'

interface InspectorProps {
  onJumpToBlock: (bid: string, meta: FocusedBlockMeta) => void
  /**
   * Drill into a subagent transcript. Wired here so US7's inspector CTA
   * (T084) can reuse the path already established in US2.
   */
  onDrillSubagent?: (block: ToolBlock) => void
}

/**
 * Router that picks the inspector branch from focus state.
 * Block focus takes precedence over node focus (Tool / Diff inspectors).
 */
export function Inspector({ onJumpToBlock, onDrillSubagent }: InspectorProps) {
  const blockMeta = useFocus((s) => s.blockMeta)
  const nodeMeta = useFocus((s) => s.nodeMeta)

  if (blockMeta) {
    if (blockMeta.block.kind === 'tool_use')
      return <InspectorTool meta={blockMeta} onDrillSubagent={onDrillSubagent} />
    if (blockMeta.block.kind === 'diff') return <InspectorDiff meta={blockMeta} />
    // text / thinking — fall through to node-level inspector (Request view)
  }
  if (nodeMeta) {
    if (nodeMeta.kind === 'request') return <InspectorRequest meta={nodeMeta} onJumpToBlock={onJumpToBlock} />
    if (nodeMeta.kind === 'user') return <InspectorUser meta={nodeMeta} />
  }
  return <InspectorEmpty />
}
