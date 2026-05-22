import type { Block, FocusedBlockMeta, FocusedNodeMeta } from '@/lib/types'
import { fmtCost, fmtDuration, fmtK, shortPreview } from '@/lib/format'
import { CrumbStrip, MetricsRow } from './CrumbStrip'

interface InspectorRequestProps {
  meta: FocusedNodeMeta
  onJumpToBlock: (bid: string, meta: FocusedBlockMeta) => void
}

export function InspectorRequest({ meta, onJumpToBlock }: InspectorRequestProps) {
  if (meta.kind !== 'request' || !meta.request) return null
  const { request, turn, idx, total } = meta
  const totalTokens = request.tokens.in + request.tokens.out + request.tokens.cc + request.tokens.cr
  const ttftLabel = request.ttft != null ? `${Math.round(request.ttft)}ms TTFT` : '—'
  return (
    <>
      <CrumbStrip
        kind={`REQUEST ${request.id.slice(0, 8)}`}
        parent={`TURN ${turn.id.slice(0, 8)}`}
        idStr={idx && total ? `request ${idx} of ${total}` : undefined}
        title={`Request ${idx ?? '—'} of ${total ?? '—'}`}
        sub={`${request.blocks.length} ${request.blocks.length === 1 ? 'block' : 'blocks'} · ${ttftLabel} · ${fmtDuration(request.duration)}`}
      />
      <div className="ins-body flex-1 overflow-y-auto">
        <MetricsRow
          items={[
            { lbl: 'Cost', val: fmtCost(request.cost) },
            {
              lbl: 'Tokens',
              val: fmtK(totalTokens),
              dim: true,
              sub: `${fmtK(request.tokens.in)} in · ${fmtK(request.tokens.out)} out`,
            },
            {
              lbl: 'Duration',
              val: fmtDuration(request.duration),
              sub: ttftLabel,
            },
          ]}
        />
        <div className="ins-section border-b border-[var(--border)] px-[18px] py-3.5">
          <SectionTitle count={request.blocks.length}>Blocks in this request</SectionTitle>
          {request.blocks.map((b, i) => (
            <BlockRow
              key={i}
              n={i + 1}
              block={b}
              onClick={() =>
                onJumpToBlock(`${request.id}:b${i}`, {
                  bid: `${request.id}:b${i}`,
                  block: b,
                  request,
                  turn,
                })
              }
            />
          ))}
        </div>
      </div>
    </>
  )
}

function SectionTitle({ children, count }: { children: React.ReactNode; count?: number }) {
  return (
    <div
      className="ins-section-title mb-2 flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase text-[var(--text-3)]"
      style={{ letterSpacing: '0.07em' }}
    >
      {children}
      {count != null && <span className="count text-[var(--text-2)] font-medium">· {count}</span>}
    </div>
  )
}

function BlockRow({ n, block, onClick }: { n: number; block: Block; onClick: () => void }) {
  return (
    <div
      className="ins-block-row -mx-2 flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 font-mono text-[11px] hover:bg-[var(--surface-2)]"
      onClick={onClick}
    >
      <span className="num w-[18px] text-right text-[var(--text-3)]">{n}</span>
      <span className="kind font-medium text-[var(--text-1)]">{block.kind}</span>
      {block.kind === 'tool_use' && <span className="name text-[var(--text-0)]">· {block.name}</span>}
      {block.kind === 'diff' && <span className="name text-[var(--text-2)]">· {block.path}</span>}
      {block.kind === 'text' && (
        <span className="min-w-0 flex-1 truncate whitespace-nowrap text-[var(--text-2)]">· {shortPreview(block.body, 60)}</span>
      )}
      {block.kind === 'thinking' && (
        <span className="min-w-0 flex-1 truncate whitespace-nowrap italic text-[var(--text-3)]">· {shortPreview(block.body, 60)}</span>
      )}
      <span className="toks ml-auto text-[10.5px] text-[var(--text-3)]">
        {block.kind === 'tool_use' && block.durationMs != null ? fmtDuration(block.durationMs) : ''}
      </span>
    </div>
  )
}
