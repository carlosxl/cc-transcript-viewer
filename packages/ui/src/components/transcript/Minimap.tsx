import { useMemo } from 'react'
import type { VirtualNode } from '@/lib/flatNodes'

/** Beyond this many nodes we downsample into a fixed bucket count. */
const MAX_BARS = 2000

export interface MinimapProps {
  /** Same flat node array driving Virtuoso. */
  nodes: VirtualNode[]
  /** Currently focused node index, or `-1` for none. */
  focusedIndex: number
  /** Seek by setting the focused node index — TranscriptPane handles the scroll. */
  onSeek: (index: number) => void
}

interface Bar {
  /** Representative node index in the original `nodes` array. */
  index: number
  /** Original-array start of the bucket (inclusive). */
  start: number
  /** Original-array end of the bucket (exclusive). */
  end: number
  tone: string
  toolHeavy: boolean
}

function toneFor(node: VirtualNode): string {
  if (node.kind === 'thinking') return 'var(--think-text)'
  if (node.kind === 'diff') return 'var(--brand)'
  if (node.kind === 'capsule') return 'var(--tool-rail)'
  // turn
  if (node.turn.role === 'user') return 'var(--user-rail)'
  return 'var(--claude-rail)'
}

function buildBars(nodes: VirtualNode[]): Bar[] {
  if (nodes.length === 0) return []
  const barCount = Math.min(nodes.length, MAX_BARS)
  const bars: Bar[] = new Array(barCount)
  for (let i = 0; i < barCount; i++) {
    const start = Math.floor((i * nodes.length) / barCount)
    const end = Math.floor(((i + 1) * nodes.length) / barCount)
    const repIdx = start + Math.floor((end - start) / 2)
    const rep = nodes[Math.min(repIdx, nodes.length - 1)]!
    let toolHeavy = false
    for (let j = start; j < end; j++) {
      if (nodes[j]!.kind === 'capsule') { toolHeavy = true; break }
    }
    bars[i] = { index: repIdx, start, end, tone: toneFor(rep), toolHeavy }
  }
  return bars
}

/**
 * Right-edge transcript minimap (Phase 8). One bar per node up to 2000;
 * beyond that, buckets group adjacent nodes. Click any bar to seek the
 * transcript to that index via `focusedMsgIndex`.
 *
 * Hidden by callers on narrow widths (width budget is too tight to share with
 * the bottom sheet's FAB).
 */
export function Minimap({ nodes, focusedIndex, onSeek }: MinimapProps) {
  const bars = useMemo(() => buildBars(nodes), [nodes])
  if (bars.length === 0) return null

  return (
    <nav
      aria-label="Transcript minimap"
      className="absolute top-0 right-0 bottom-0 w-3.5 flex flex-col gap-[1px] py-3 pr-1 pl-0 pointer-events-auto select-none"
      style={{ zIndex: 5 }}
    >
      {bars.map((bar, i) => {
        const isFocused =
          focusedIndex >= bar.start && focusedIndex < bar.end
        return (
          <button
            key={i}
            type="button"
            onClick={() => onSeek(bar.index)}
            aria-label={`Jump to message ${bar.index + 1} of ${nodes.length}`}
            aria-current={isFocused ? 'true' : undefined}
            className="flex-1 min-h-[1px] rounded-[1.5px] border-0 p-0 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
            style={{
              background: bar.tone,
              opacity: isFocused ? 1 : 0.35,
              boxShadow: bar.toolHeavy ? 'inset 0 0 0 2px var(--tool-rail)' : 'none',
              outline: isFocused ? '1px solid var(--primary)' : 'none',
              outlineOffset: 1,
            }}
          />
        )
      })}
    </nav>
  )
}
