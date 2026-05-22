import { useMemo } from 'react'
import type { SessionView } from '@/lib/types'
import { I } from '@/components/ui/icons'
import { fmtCost } from '@/lib/format'
import { useWorkspace } from '@/stores/useWorkspace'
import { useSessionStack } from '@/stores/useSessionStack'
import { useOverlays } from '@/stores/useOverlays'

interface TranscriptHeaderProps {
  view: SessionView
  livePending: boolean
  /** Fired by the "Back to [parent]" button when in a subagent (US2). */
  onPopSubagent?: () => void
}

export function TranscriptHeader({ view, livePending, onPopSubagent }: TranscriptHeaderProps) {
  const theme = useWorkspace((s) => s.theme)
  const inspectorOpen = useWorkspace((s) => s.inspectorOpen)
  const toggleTheme = useWorkspace((s) => s.toggleTheme)
  const toggleDensity = useWorkspace((s) => s.toggleDensity)
  const toggleInspector = useWorkspace((s) => s.toggleInspector)
  const isSubagent = useSessionStack((s) => s.isSubagent())
  const parentLabel = useSessionStack((s) => s.stack[s.stack.length - 1]?.parentLabel ?? null)
  const toggleReport = useOverlays((s) => s.toggleReport)

  const { totalReqs, totalCost } = useMemo(() => {
    let r = 0
    let c = 0
    for (const t of view.turns) {
      r += t.requests.length
      c += t.cost
    }
    return { totalReqs: r, totalCost: c }
  }, [view])

  return (
    <div
      className="tx-header sticky top-0 z-[5] flex items-start gap-3.5 border-b border-[var(--border)] bg-[var(--surface-0)] px-[22px] pt-3 pb-2.5"
      style={{ minWidth: 0 }}
    >
      <div className="tx-header-left min-w-0 flex-1">
        {isSubagent && (
          <div className="tx-breadcrumb mb-1 flex items-center gap-1.5 font-mono text-[11px] text-[var(--text-3)]">
            <button
              type="button"
              onClick={() => onPopSubagent?.()}
              className="tx-back -mx-0.5 -my-0.5 mr-2 inline-flex items-center gap-1 rounded-sm border border-[var(--border-1)] bg-[var(--surface-1)] px-2 py-1 text-[11px] text-[var(--text-1)] hover:border-[var(--border-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text-0)]"
            >
              <I.chevronLeft />
              <span>Back to {parentLabel ?? 'parent'}</span>
            </button>
            <span className="text-[var(--accent-2)]">Subagent transcript</span>
            <span className="sep text-[var(--text-disabled)]">›</span>
            {view.parentTurnId && <span>spawned from Turn {view.parentTurnId}</span>}
          </div>
        )}
        <div className="tx-title-row flex items-center gap-2">
          <div className="tx-title text-[15px] font-semibold text-[var(--text-0)]" style={{ letterSpacing: '-0.01em' }}>
            {view.title}
          </div>
        </div>
        <div className="tx-chips mt-1.5 flex flex-wrap gap-1.5">
          <Chip k="Turns" v={String(view.turns.length)} />
          <Chip k="Requests" v={String(totalReqs)} />
          <Chip k="Cost" v={fmtCost(totalCost)} accent />
          {view.model && <Chip k="Model" v={view.model} />}
          {livePending && !isSubagent && <LiveChip />}
        </div>
      </div>
      <div className="tx-actions flex items-center gap-1">
        <IconBtn onClick={toggleReport} title="Session report (r)" labelled>
          <I.report />
          <span>Report</span>
        </IconBtn>
        <IconBtn onClick={toggleInspector} title="Toggle inspector" active={!inspectorOpen}>
          {inspectorOpen ? <I.panel /> : <I.panelOff />}
        </IconBtn>
        <IconBtn onClick={toggleDensity} title="Density">
          <I.density />
        </IconBtn>
        <IconBtn onClick={toggleTheme} title="Theme (t)">
          {theme === 'dark' ? <I.sun /> : <I.moon />}
        </IconBtn>
        <IconBtn title="More">
          <I.more />
        </IconBtn>
      </div>
    </div>
  )
}

function Chip({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <span
      className="chip inline-flex items-center gap-1.5 rounded-[3px] border border-[var(--border-1)] bg-[var(--surface-1)] px-[7px] py-[2px] font-mono text-[11px] whitespace-nowrap"
      style={{ color: accent ? 'var(--text-0)' : 'var(--text-1)' }}
    >
      <span className="k text-[var(--text-3)]">{k}</span>
      {v}
    </span>
  )
}

function LiveChip() {
  return (
    <span
      className="chip chip-live inline-flex items-center gap-1.5 rounded-[3px] px-[7px] py-[2px] font-mono text-[11px] whitespace-nowrap"
      style={{
        color: 'var(--green)',
        borderColor: 'oklch(0.78 0.13 155 / 0.3)',
        background: 'oklch(0.78 0.13 155 / 0.06)',
        border: '1px solid oklch(0.78 0.13 155 / 0.3)',
      }}
    >
      <span
        className="dot inline-block h-[5px] w-[5px] rounded-full"
        style={{ background: 'var(--green)', animation: 'live-pulse 1.6s ease-out infinite' }}
      />
      Live
    </span>
  )
}

function IconBtn({
  children,
  onClick,
  title,
  labelled,
  active,
}: {
  children: React.ReactNode
  onClick?: () => void
  title?: string
  labelled?: boolean
  active?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      data-active={active || undefined}
      className={
        'icon-btn inline-flex items-center justify-center rounded-sm border border-transparent text-[var(--text-2)] transition-colors hover:border-[var(--border-1)] hover:bg-[var(--surface-2)] hover:text-[var(--text-0)] data-[active=true]:border-[var(--accent-border)] data-[active=true]:bg-[var(--accent-soft)] data-[active=true]:text-[var(--accent-2)] ' +
        (labelled ? 'gap-1.5 px-2 text-[12px] font-medium h-7' : 'h-7 w-7')
      }
    >
      {children}
    </button>
  )
}
