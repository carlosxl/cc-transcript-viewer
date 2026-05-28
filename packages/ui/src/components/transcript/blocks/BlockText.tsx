import type { TextBlock } from '@/lib/types'
import { renderInline } from '@/lib/markdown'

export function BlockText({ block }: { block: TextBlock }) {
  return <div className="va-text">{renderInline(block.body)}</div>
}
