import type {
  FocusedBlockMeta,
  FocusedNodeMeta,
  Request,
  SessionTurn,
  ToolBlock,
} from '@/lib/types'
import { fmtCost, fmtDuration, fmtK } from '@/lib/format'
import { splitRequest, type AssistantItem, type HarnessItem } from '@/lib/splitRequest'
import { useFocus } from '@/stores/useFocus'
import { BlockText } from './blocks/BlockText'
import { BlockThinking } from './blocks/BlockThinking'
import { BlockToolCall } from './blocks/BlockToolCall'
import { BlockToolResult } from './blocks/BlockToolResult'

interface RequestNodeProps {
  turn: SessionTurn
  request: Request
  idx: number
  total: number
  onFocusNode: (id: string, meta: FocusedNodeMeta) => void
  onFocusBlock: (bid: string, meta: FocusedBlockMeta) => void
  onDrillSubagent?: (block: ToolBlock) => void
}

export function RequestNode({
  turn,
  request,
  idx,
  total,
  onFocusNode,
  onFocusBlock,
  onDrillSubagent,
}: RequestNodeProps) {
  const focusedId = useFocus((s) => s.nodeId)
  const focusedBlockId = useFocus((s) => s.blockId)
  const envelopeFocused = focusedId === request.id && !focusedBlockId

  const { assistantBlocks, harnessResults } = splitRequest(request)
  const focusRequest = (e: React.MouseEvent) => {
    e.stopPropagation()
    onFocusNode(request.id, { kind: 'request', turn, request, idx, total })
  }

  const toolDurMs = harnessResults.reduce((s, h) => s + (h.toolUse?.durationMs ?? 0), 0)
  const toolCount = harnessResults.filter((h) => h.toolUse).length

  return (
    <div className="va-req-group" data-node-id={request.id} data-api-error={request.isApiError || undefined}>
      <div
        className={'va-request' + (envelopeFocused ? ' is-focused' : '')}
        data-focused={envelopeFocused || undefined}
        data-api-error={request.isApiError || undefined}
        onClick={focusRequest}
      >
        <div className="va-rail va-rail-req" />
        <div className="va-req-body">
          <RequestCap request={request} idx={idx} total={total} />
          {assistantBlocks.map((item) => (
            <AssistantSlot
              key={item.idx}
              item={item}
              bid={`${request.id}:b${item.idx}`}
              request={request}
              turn={turn}
              focusedBlockId={focusedBlockId}
              onFocusBlock={onFocusBlock}
            />
          ))}
        </div>
      </div>

      {harnessResults.length > 0 && (
        <div
          className={'va-harness' + (envelopeFocused ? ' is-focused' : '')}
          data-focused={envelopeFocused || undefined}
          onClick={focusRequest}
        >
          <div className="va-rail va-rail-har" />
          <div className="va-har-body">
            <div className="va-cap va-cap-har">
              <span>
                HARNESS · {toolCount} tool {toolCount === 1 ? 'call' : 'calls'}
                {toolDurMs > 0 ? ` · ${fmtDuration(toolDurMs)}` : ''}
              </span>
            </div>
            {harnessResults.map((item) => (
              <HarnessSlot
                key={item.idx}
                item={item}
                bid={`${request.id}:b${item.idx}`}
                request={request}
                turn={turn}
                focusedBlockId={focusedBlockId}
                onFocusBlock={onFocusBlock}
                onDrillSubagent={onDrillSubagent}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function RequestCap({ request, idx, total }: { request: Request; idx: number; total: number }) {
  const ttftText = request.ttft != null ? `${Math.round(request.ttft)}ms TTFT` : null
  return (
    <div className="va-cap" data-api-error={request.isApiError || undefined}>
      <span className="seg req-k">REQ {idx}/{total}</span>
      <span className="sep">·</span>
      <span className="seg req-id">{request.displayId}</span>
      {request.isApiError && (
        <>
          <span className="sep">·</span>
          <span className="seg va-api-error-pill" title="Synthetic CLI error — the LLM never produced this turn">
            API ERROR
          </span>
        </>
      )}
      {request.model && !request.isApiError && (
        <>
          <span className="sep">·</span>
          <span className="seg va-sticky" data-kind="model">{shortModel(request.model)}</span>
        </>
      )}
      {ttftText && !request.isApiError && (
        <>
          <span className="sep">·</span>
          <span className="seg">{ttftText}</span>
        </>
      )}
      {!request.isApiError && (
        <>
          <span className="sep">·</span>
          <span className="seg">
            {fmtK(request.tokens.in)} in · {fmtK(request.tokens.out)} out
          </span>
          <span className="seg cost">{fmtCost(request.cost)}</span>
        </>
      )}
    </div>
  )
}

function shortModel(m: string): string {
  const match = m.match(/(opus|sonnet|haiku)-(\d+(?:-\d+)?)/i)
  return match ? `${match[1]}-${match[2]}` : m
}

function AssistantSlot({
  item,
  bid,
  request,
  turn,
  focusedBlockId,
  onFocusBlock,
}: {
  item: AssistantItem
  bid: string
  request: Request
  turn: SessionTurn
  focusedBlockId: string | null
  onFocusBlock: (bid: string, meta: FocusedBlockMeta) => void
}) {
  if (item.kind === 'text') return <BlockText block={item.block} />
  if (item.kind === 'thinking') return <BlockThinking block={item.block} />
  const focused = focusedBlockId === bid
  return (
    <BlockToolCall
      block={item.block}
      focused={focused}
      onClick={(e) => {
        e.stopPropagation()
        onFocusBlock(bid, { bid, block: item.block, request, turn })
      }}
    />
  )
}

function HarnessSlot({
  item,
  bid,
  request,
  turn,
  focusedBlockId,
  onFocusBlock,
  onDrillSubagent,
}: {
  item: HarnessItem
  bid: string
  request: Request
  turn: SessionTurn
  focusedBlockId: string | null
  onFocusBlock: (bid: string, meta: FocusedBlockMeta) => void
  onDrillSubagent?: (block: ToolBlock) => void
}) {
  const focused = focusedBlockId === bid
  // Focus target: prefer the tool_use block (so the inspector reflects the same
  // bid as the REQ-side call line). Fall back to the orphan diff when present.
  const focusBlock = item.toolUse ?? item.diff
  if (!focusBlock) return null
  return (
    <BlockToolResult
      toolUse={item.toolUse}
      diff={item.diff}
      focused={focused}
      onClick={(e) => {
        e.stopPropagation()
        onFocusBlock(bid, { bid, block: focusBlock, request, turn })
      }}
      onDrillSubagent={onDrillSubagent}
    />
  )
}
