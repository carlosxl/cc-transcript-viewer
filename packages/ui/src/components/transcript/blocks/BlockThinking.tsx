import type { ThinkingBlock } from '@/lib/types'

export function BlockThinking({ block }: { block: ThinkingBlock }) {
  return (
    <div
      className="block-thinking rounded-r-sm border border-[var(--border)] bg-[var(--surface-1)] px-3 py-2 text-[12.5px] italic leading-[1.55] text-[var(--text-2)]"
      style={{ borderLeftWidth: 2, borderLeftColor: 'var(--text-disabled)' }}
    >
      <span
        className="label mr-1.5 mb-1 inline-block font-mono text-[10px] font-medium uppercase not-italic text-[var(--text-3)]"
        style={{ letterSpacing: '0.06em' }}
      >
        thinking
      </span>
      <span className="block-thinking-body block">{block.body}</span>
    </div>
  )
}
