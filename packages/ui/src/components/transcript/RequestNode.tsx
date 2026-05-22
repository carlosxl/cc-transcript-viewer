import type { Block, Request, SessionTurn, FocusedBlockMeta, FocusedNodeMeta, ToolBlock } from '@/lib/types'
import { fmtCost, fmtDuration } from '@/lib/format'
import { useFocus } from '@/stores/useFocus'
import { BlockText } from './blocks/BlockText'
import { BlockThinking } from './blocks/BlockThinking'
import { BlockToolCapsule } from './blocks/BlockToolCapsule'
import { BlockDiff } from './blocks/BlockDiff'

interface RequestNodeProps {
  turn: SessionTurn
  request: Request
  idx: number
  total: number
  onFocusNode: (id: string, meta: FocusedNodeMeta) => void
  onFocusBlock: (bid: string, meta: FocusedBlockMeta) => void
  onDrillSubagent?: (block: ToolBlock) => void
}

export function RequestNode({ turn, request, idx, total, onFocusNode, onFocusBlock, onDrillSubagent }: RequestNodeProps) {
  const focusedId = useFocus((s) => s.nodeId)
  const focusedBlockId = useFocus((s) => s.blockId)
  const focused = focusedId === request.id && !focusedBlockId
  const ttftText = request.ttft != null ? `${Math.round(request.ttft)}ms TTFT` : ''
  return (
    <div
      className="node request-node my-2.5 rounded-r-sm border-l-2 border-transparent pl-3 pt-1 transition-colors"
      data-focused={focused || undefined}
      data-node-id={request.id}
      onClick={() => onFocusNode(request.id, { kind: 'request', turn, request, idx, total })}
      style={{
        borderLeftColor: focused ? 'var(--accent)' : undefined,
        background: focused ? 'linear-gradient(90deg, var(--accent-softer), transparent 40%)' : undefined,
      }}
    >
      <div
        className="node-label mb-1 flex cursor-pointer items-center gap-2 font-mono text-[10.5px] font-medium uppercase text-[var(--text-3)]"
        style={{ letterSpacing: '0.05em', color: focused ? 'var(--accent-2)' : undefined }}
      >
        <span className="nl-id" style={{ color: focused ? 'var(--accent-2)' : 'var(--text-2)' }}>
          REQUEST {request.id.slice(0, 8).toUpperCase()}
        </span>
        <span className="nl-meta" style={{ textTransform: 'none', letterSpacing: 0, color: 'var(--text-3)' }}>
          · request {idx} of {total} · {fmtDuration(request.duration)}
        </span>
        <span className="nl-cost ml-auto" style={{ textTransform: 'none', letterSpacing: 0, color: focused ? 'var(--accent-2)' : 'var(--text-1)' }}>
          {fmtCost(request.cost)}
        </span>
      </div>
      <div
        className="req-marker-row my-1.5 flex cursor-pointer items-center gap-2 rounded-[3px] border border-dashed border-transparent px-2 py-1 font-mono text-[10.5px] text-[var(--text-3)] transition-colors hover:border-[var(--border-1)] hover:bg-[var(--surface-2)]"
        data-focused={focused || undefined}
        style={{
          borderStyle: focused ? 'solid' : undefined,
          borderColor: focused ? 'var(--accent-border)' : undefined,
          background: focused ? 'var(--accent-soft)' : undefined,
        }}
      >
        <span className="req-k" style={{ color: focused ? 'var(--accent-2)' : 'var(--text-1)' }}>
          Request {idx}/{total}
        </span>
        <span className="sep text-[var(--text-disabled)]">·</span>
        <span>
          {request.blocks.length} {request.blocks.length === 1 ? 'block' : 'blocks'}
        </span>
        {ttftText && (
          <>
            <span className="sep text-[var(--text-disabled)]">·</span>
            <span>{ttftText}</span>
          </>
        )}
        <span className="sep text-[var(--text-disabled)]">·</span>
        <span>{fmtDuration(request.duration)}</span>
        <span className="req-cost ml-auto text-[var(--text-1)]">{fmtCost(request.cost)}</span>
      </div>
      {request.blocks.map((b, i) => (
        <BlockSlot
          key={i}
          block={b}
          bid={`${request.id}:b${i}`}
          request={request}
          turn={turn}
          focusedBlockId={focusedBlockId}
          onFocusBlock={onFocusBlock}
          onDrillSubagent={onDrillSubagent}
        />
      ))}
    </div>
  )
}

function BlockSlot({
  block,
  bid,
  request,
  turn,
  focusedBlockId,
  onFocusBlock,
  onDrillSubagent,
}: {
  block: Block
  bid: string
  request: Request
  turn: SessionTurn
  focusedBlockId: string | null
  onFocusBlock: (bid: string, meta: FocusedBlockMeta) => void
  onDrillSubagent?: (block: ToolBlock) => void
}) {
  const focused = focusedBlockId === bid
  const handle = (e: React.MouseEvent) => {
    e.stopPropagation()
    onFocusBlock(bid, { bid, block, request, turn })
  }
  if (block.kind === 'text') {
    return <div className="block my-2">{<BlockText block={block} />}</div>
  }
  if (block.kind === 'thinking') {
    return <div className="block my-2">{<BlockThinking block={block} />}</div>
  }
  if (block.kind === 'tool_use') {
    return (
      <div className="block my-2">
        <BlockToolCapsule
          block={block}
          focused={focused}
          onClick={handle}
          onDrillSubagent={onDrillSubagent}
        />
      </div>
    )
  }
  if (block.kind === 'diff') {
    return (
      <div className="block my-2">
        <BlockDiff block={block} focused={focused} onClick={handle} />
      </div>
    )
  }
  return null
}
