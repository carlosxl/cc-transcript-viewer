import type { DiffBlock, Request, TextBlock, ThinkingBlock, ToolBlock } from './types'

export type AssistantItem =
  | { kind: 'text'; block: TextBlock; idx: number }
  | { kind: 'thinking'; block: ThinkingBlock; idx: number }
  | { kind: 'tool_use'; block: ToolBlock; idx: number }

export interface HarnessItem {
  toolUse: ToolBlock | null
  diff: DiffBlock | null
  /** index into request.blocks of the originating tool_use (or orphan diff) */
  idx: number
  /** true when this item is a DiffBlock with no preceding write-tool tool_use */
  orphan?: boolean
}

const isWriteTool = (n: string): boolean =>
  n === 'Edit' || n === 'Write' || n === 'MultiEdit' || n === 'NotebookEdit'

/**
 * Walk request.blocks once and partition into:
 *   - assistantBlocks: text / thinking / tool_use (the call only) — render under REQ rail.
 *   - harnessResults:  tool_use's result (with optional paired diff for write tools), or orphan diff.
 *
 * Ported from .design/v5/project/explorations-shared.jsx splitRequest().
 */
export function splitRequest(request: Request): {
  assistantBlocks: AssistantItem[]
  harnessResults: HarnessItem[]
} {
  const assistantBlocks: AssistantItem[] = []
  const harnessResults: HarnessItem[] = []
  const consumed = new Set<number>()

  request.blocks.forEach((b, i) => {
    if (consumed.has(i)) return
    if (b.kind === 'tool_use') {
      assistantBlocks.push({ kind: 'tool_use', block: b, idx: i })
      const next = request.blocks[i + 1]
      let pairedDiff: DiffBlock | null = null
      if (next && next.kind === 'diff' && isWriteTool(b.name)) {
        pairedDiff = next
        consumed.add(i + 1)
      }
      harnessResults.push({ toolUse: b, diff: pairedDiff, idx: i })
    } else if (b.kind === 'diff') {
      harnessResults.push({ toolUse: null, diff: b, idx: i, orphan: true })
    } else if (b.kind === 'text') {
      assistantBlocks.push({ kind: 'text', block: b, idx: i })
    } else if (b.kind === 'thinking') {
      assistantBlocks.push({ kind: 'thinking', block: b, idx: i })
    }
  })

  return { assistantBlocks, harnessResults }
}
