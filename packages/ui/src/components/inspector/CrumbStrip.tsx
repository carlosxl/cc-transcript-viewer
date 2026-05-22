import type { ReactNode } from 'react'

interface CrumbStripProps {
  kind: string
  parent?: string
  idStr?: string
  title: ReactNode
  sub?: ReactNode
}

export function CrumbStrip({ kind, parent, idStr, title, sub }: CrumbStripProps) {
  return (
    <div className="ins-strip min-w-0 border-b border-[var(--border)] px-[18px] pt-3 pb-3">
      <div
        className="ins-crumbs mb-1.5 flex min-w-0 flex-wrap items-center gap-1.5 font-mono text-[10px] uppercase text-[var(--text-3)] leading-[1.4]"
        style={{ letterSpacing: '0.06em' }}
      >
        <span className="kind font-semibold text-[var(--accent-2)] whitespace-nowrap">{kind}</span>
        {parent && (
          <>
            <span className="sep text-[var(--text-disabled)]">›</span>
            <span className="whitespace-nowrap">{parent}</span>
          </>
        )}
        {idStr && (
          <span
            className="ins-id min-w-0 flex-shrink overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[11px] text-[var(--text-1)]"
            style={{ textTransform: 'none', letterSpacing: 0 }}
          >
            · {idStr}
          </span>
        )}
      </div>
      <div className="ins-title overflow-hidden text-ellipsis whitespace-nowrap text-[14.5px] font-semibold text-[var(--text-0)]" style={{ letterSpacing: '-0.005em' }}>
        {title}
      </div>
      {sub && <div className="ins-sub mt-0.5 font-mono text-[10.5px] text-[var(--text-2)]">{sub}</div>}
    </div>
  )
}

export interface MetricItem {
  lbl: string
  val: string
  sub?: string
  dim?: boolean
}

export function MetricsRow({ items }: { items: MetricItem[] }) {
  return (
    <div className="ins-metrics grid grid-cols-3 border-b border-[var(--border)]">
      {items.map((it, i) => (
        <div
          key={i}
          className="ins-metric px-3.5 py-2.5"
          style={{ borderRight: i < items.length - 1 ? '1px solid var(--border)' : 'none' }}
        >
          <div
            className="lbl mb-0.5 font-mono text-[9.5px] uppercase text-[var(--text-3)]"
            style={{ letterSpacing: '0.07em' }}
          >
            {it.lbl}
          </div>
          <div
            className="val font-mono text-[14px] font-medium leading-[1.1]"
            style={{ letterSpacing: '-0.01em', color: it.dim ? 'var(--text-2)' : 'var(--text-0)' }}
          >
            {it.val}
          </div>
          {it.sub && <div className="sub mt-[1px] font-mono text-[10px] text-[var(--text-3)]">{it.sub}</div>}
        </div>
      ))}
    </div>
  )
}
