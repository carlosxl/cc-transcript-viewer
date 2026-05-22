import type { FocusedNodeMeta } from '@/lib/types'
import { fmtK } from '@/lib/format'
import { CrumbStrip, MetricsRow } from './CrumbStrip'

export function InspectorUser({ meta }: { meta: FocusedNodeMeta }) {
  if (meta.kind !== 'user') return null
  const { turn } = meta
  const chars = turn.prompt.length
  const estTokens = Math.ceil(chars / 4)
  const attCount = turn.attachments.length
  const attTokens = turn.attachments.reduce((s, a) => s + a.tokens, 0)
  return (
    <>
      <CrumbStrip
        kind={`USER MESSAGE ${turn.userMsgId.slice(0, 8)}`}
        parent={`TURN ${turn.id.slice(0, 8)}`}
        title={`User input · Turn ${turn.id.slice(0, 8)}`}
        sub={turn.time}
      />
      <div className="ins-body flex-1 overflow-y-auto">
        <MetricsRow
          items={[
            { lbl: 'Characters', val: chars.toLocaleString() },
            { lbl: 'Est. tokens', val: '~' + fmtK(estTokens), dim: true },
            {
              lbl: '+ Attachments',
              val: attCount === 0 ? '0' : `~${fmtK(attTokens)}`,
              sub: attCount === 0 ? '' : `${attCount} events`,
            },
          ]}
        />
        <div className="ins-section border-b border-[var(--border)] px-[18px] py-3.5">
          <SectionTitle>User prompt</SectionTitle>
          <div
            className="text-[12.5px] leading-[1.55] whitespace-pre-wrap text-[var(--text-0)]"
          >
            {turn.prompt || <span className="text-[var(--text-3)] italic">(empty)</span>}
          </div>
        </div>
        {attCount > 0 && (
          <div className="ins-section border-b border-[var(--border)] px-[18px] py-3.5">
            <SectionTitle count={attCount}>Attached events</SectionTitle>
            {turn.attachments.map((a, i) => (
              <div key={i} className="ins-attach-row -mx-2 flex items-center gap-2 rounded-sm px-2 py-1.5 font-mono text-[11px] hover:bg-[var(--surface-2)]">
                <span className="kind-tag rounded-[3px] border border-[var(--border-1)] bg-[var(--surface-2)] px-1.5 py-px text-[10px] text-[var(--text-1)]">
                  {a.kind}
                </span>
                <span className="desc min-w-0 flex-1 truncate text-[var(--text-1)]">{a.desc}</span>
                <span className="tk text-[10.5px] text-[var(--text-3)]">~{fmtK(a.tokens)}</span>
                <span className="ts text-[10.5px] text-[var(--text-3)]">at {a.ts}</span>
              </div>
            ))}
            <div className="ins-caption mt-2.5 rounded-sm border border-[var(--border-1)] bg-[var(--surface-2)] px-2.5 py-2 text-[11px] leading-[1.55] text-[var(--text-1)]">
              Auto-injected by Claude Code at the same timestamp as the user event. They count toward the next request's input.
            </div>
          </div>
        )}
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
