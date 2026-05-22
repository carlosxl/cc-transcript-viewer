import type { TextBlock } from '@/lib/types'
import { renderInline } from '@/lib/markdown'

export function BlockText({ block }: { block: TextBlock }) {
  return (
    <div className="block-text py-1 text-[13.5px] leading-[1.6] whitespace-pre-wrap text-[var(--text-0)]">
      {renderInline(block.body)}
    </div>
  )
}
