import type { ThinkingBlock } from '@/lib/types'

export function BlockThinking({ block }: { block: ThinkingBlock }) {
  return <div className="va-think">{block.body}</div>
}
