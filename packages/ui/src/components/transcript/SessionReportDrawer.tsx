import { useEffect, useRef, useState } from 'react'
import { Download, AlertTriangle, Loader2, X } from 'lucide-react'
import type { SessionReport, ReportRow, TokenSeries, FileTouchIndex } from '@cc-viewer/shared'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { fetchSessionReport } from '@/api'
import { abbreviateInt, formatExactInt } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/stores/useUIStore'
import { useSearchStore } from '@/stores/useSearchStore'
import { useSession } from '@/hooks/useSession'
import { useActiveSessionMeta } from '@/hooks/useActiveSessionMeta'
import { SessionReportUsageOverTime } from './SessionReportUsageOverTime'
import { SessionReportFilesTouched } from './SessionReportFilesTouched'

interface SessionReportDrawerProps {
  /** Session whose report to load. Falls back to the active session from the store. */
  sessionId?: string | null
}

/** Format a hit rate (0..1) or null as "97.4%" / "—". */
function formatRate(r: number | null): string {
  if (r === null) return '—'
  return `${(r * 100).toFixed(1)}%`
}

/** ms → "4h 23m" / "12m 34s" / "8s". 0 → "—". */
function formatDuration(ms: number): string {
  if (ms <= 0) return '—'
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = s % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${ss}s`
  return `${ss}s`
}

function formatUnits(u: number | null): string {
  if (u === null) return '—'
  return abbreviateInt(Math.round(u))
}

function shortModel(m: string): string {
  if (!m) return '—'
  return m.startsWith('claude-') ? m.slice('claude-'.length) : m
}

function isReportEmpty(report: SessionReport): boolean {
  return (
    report.totalUnits === 0 &&
    report.toolCalls.total === 0 &&
    report.durationMs === 0 &&
    report.rows.length === 0
  )
}

function reportToCsv(r: SessionReport): string {
  const header = [
    'agent', 'invocation_count', 'model', 'input_weight', 'output_weight',
    'input_tokens', 'input_units',
    'cache_create_5m_tokens', 'cache_create_5m_units',
    'cache_create_1h_tokens', 'cache_create_1h_units',
    'cache_read_tokens', 'cache_read_units',
    'output_tokens', 'output_units',
    'cache_hit_rate', 'total_units',
  ].join(',')
  const u = (n: number | null | undefined) => (n === null || n === undefined ? '' : n.toFixed(2))
  const lines = r.rows.map((row) => [
    row.agentGroup,
    String(row.invocationCount),
    row.model || '',
    row.weights ? String(row.weights.input)  : '',
    row.weights ? String(row.weights.output) : '',
    String(row.tokens.input),         u(row.unitsByCategory?.input),
    String(row.tokens.cacheCreate5m), u(row.unitsByCategory?.cacheCreate5m),
    String(row.tokens.cacheCreate1h), u(row.unitsByCategory?.cacheCreate1h),
    String(row.tokens.cacheRead),     u(row.unitsByCategory?.cacheRead),
    String(row.tokens.output),        u(row.unitsByCategory?.output),
    row.cacheHitRate === null ? '' : row.cacheHitRate.toFixed(4),
    u(row.units),
  ].join(','))
  return [header, ...lines].join('\n') + '\n'
}

function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function Kpi({ label, value, sublabel }: { label: string; value: string; sublabel?: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-md border bg-card px-3 py-2 min-w-0">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold font-mono truncate">{value}</div>
      {sublabel && <div className="text-[10px] text-muted-foreground truncate">{sublabel}</div>}
    </div>
  )
}

function TokenCell({ tokens, units }: { tokens: number; units: number | null }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <td className="px-2 py-1.5 text-right cursor-default">
          <div className="font-mono text-sm tabular-nums">{abbreviateInt(tokens)}</div>
          <div className={cn(
            'font-mono text-[10px] tabular-nums leading-tight',
            units === null ? 'text-muted-foreground/60' : 'text-muted-foreground',
          )}>
            {units === null ? '—' : `${abbreviateInt(Math.round(units))}u`}
          </div>
        </td>
      </TooltipTrigger>
      <TooltipContent>
        <div>{formatExactInt(tokens)} tokens</div>
        {units !== null && <div>{formatExactInt(Math.round(units))} units</div>}
      </TooltipContent>
    </Tooltip>
  )
}

function RowCells({ row }: { row: ReportRow }) {
  const agentLabel = row.agentGroup === 'main'
    ? 'main'
    : `${row.agentGroup}${row.invocationCount > 1 ? ` (×${row.invocationCount})` : ''}`
  const weightLabel = row.weights
    ? `${row.weights.input}/${row.weights.output}×`
    : 'weights missing'
  const cells: Array<{ tokens: number; units: number | null }> = [
    { tokens: row.tokens.input,         units: row.unitsByCategory?.input         ?? null },
    { tokens: row.tokens.cacheCreate5m, units: row.unitsByCategory?.cacheCreate5m ?? null },
    { tokens: row.tokens.cacheCreate1h, units: row.unitsByCategory?.cacheCreate1h ?? null },
    { tokens: row.tokens.cacheRead,     units: row.unitsByCategory?.cacheRead     ?? null },
    { tokens: row.tokens.output,        units: row.unitsByCategory?.output        ?? null },
  ]
  return (
    <tr className="border-b last:border-b-0">
      <td className="px-2 py-1.5 text-sm align-top">{agentLabel}</td>
      <td className="px-2 py-1.5 align-top">
        <div className="font-mono text-sm text-muted-foreground">{shortModel(row.model)}</div>
        <div className={cn(
          'font-mono text-[10px] leading-tight',
          row.weights ? 'text-muted-foreground/70' : 'text-yellow-700 dark:text-yellow-400',
        )}>
          {weightLabel}
        </div>
      </td>
      {cells.map((c, i) => <TokenCell key={i} tokens={c.tokens} units={c.units} />)}
      <td className="px-2 py-1.5 text-sm font-mono text-right tabular-nums align-top">{formatRate(row.cacheHitRate)}</td>
      <td className={cn(
        'px-2 py-1.5 text-sm font-mono text-right tabular-nums font-medium align-top',
        row.units === null && 'text-muted-foreground',
      )}>
        {formatUnits(row.units)}
      </td>
    </tr>
  )
}

function ReportTable({ report, empty }: { report: SessionReport; empty: boolean }) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr className="border-b">
            <th className="px-2 py-2 text-left font-medium text-xs text-muted-foreground">Agent</th>
            <th className="px-2 py-2 text-left font-medium text-xs text-muted-foreground">Model</th>
            <th className="px-2 py-2 text-right font-medium text-xs text-muted-foreground">
              Input <span className="opacity-60">(1.0×)</span>
            </th>
            <th className="px-2 py-2 text-right font-medium text-xs text-muted-foreground">
              Cache 5m <span className="opacity-60">(1.25×)</span>
            </th>
            <th className="px-2 py-2 text-right font-medium text-xs text-muted-foreground">
              Cache 1h <span className="opacity-60">(2.0×)</span>
            </th>
            <th className="px-2 py-2 text-right font-medium text-xs text-muted-foreground">
              Cache rd <span className="opacity-60">(0.1×)</span>
            </th>
            <th className="px-2 py-2 text-right font-medium text-xs text-muted-foreground">Output</th>
            <th className="px-2 py-2 text-right font-medium text-xs text-muted-foreground">Cache hit</th>
            <th className="px-2 py-2 text-right font-medium text-xs text-muted-foreground">Units</th>
          </tr>
        </thead>
        <tbody>
          {empty || report.rows.length === 0 ? (
            <tr>
              <td colSpan={9} className="px-2 py-6 text-center text-sm text-muted-foreground">
                No usage recorded yet
              </td>
            </tr>
          ) : (
            report.rows.map((row) => <RowCells key={`${row.agentGroup}\x00${row.model}`} row={row} />)
          )}
        </tbody>
        {!empty && report.rows.length > 0 && (
          <tfoot className="bg-muted/30 border-t">
            <tr>
              <td className="px-2 py-1.5 text-xs font-medium text-muted-foreground" colSpan={2}>
                Units by usage type
              </td>
              <td className="px-2 py-1.5 text-sm font-mono text-right tabular-nums">{formatUnits(report.unitsByUsageType.input)}</td>
              <td className="px-2 py-1.5 text-sm font-mono text-right tabular-nums">{formatUnits(report.unitsByUsageType.cacheCreate5m)}</td>
              <td className="px-2 py-1.5 text-sm font-mono text-right tabular-nums">{formatUnits(report.unitsByUsageType.cacheCreate1h)}</td>
              <td className="px-2 py-1.5 text-sm font-mono text-right tabular-nums">{formatUnits(report.unitsByUsageType.cacheRead)}</td>
              <td className="px-2 py-1.5 text-sm font-mono text-right tabular-nums">{formatUnits(report.unitsByUsageType.output)}</td>
              <td className="px-2 py-1.5 text-sm font-mono text-right tabular-nums">{formatRate(report.cacheHitRate)}</td>
              <td className="px-2 py-1.5 text-sm font-mono text-right tabular-nums font-semibold">
                {report.weightsMissing && '≥ '}{formatUnits(report.totalUnits)}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}

export function SessionReportDrawer({ sessionId: sessionIdProp }: SessionReportDrawerProps = {}) {
  const open = useUIStore((s) => s.sessionReportOpen)
  const setOpen = useUIStore((s) => s.setSessionReportOpen)
  const activeSessionId = useUIStore((s) => s.activeSessionId)
  const sessionId = sessionIdProp !== undefined ? sessionIdProp : activeSessionId
  const requestJump = useSearchStore((s) => s.requestJump)
  const activeMeta = useActiveSessionMeta()
  const sessionTitle =
    sessionIdProp == null || sessionIdProp === activeSessionId ? activeMeta?.title : null

  const [report, setReport] = useState<SessionReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const closeRef = useRef<HTMLButtonElement | null>(null)

  // Pull side projections from the session detail cache.
  const { data: detail } = useSession(sessionId ?? null)
  const tokenSeries: TokenSeries | undefined = detail?.tokenSeries
  const fileTouchIndex: FileTouchIndex | undefined = detail?.fileTouchIndex

  const handleJumpToTurn = (turnUuid: string) => {
    if (!sessionId) return
    requestJump({ sessionId, agentId: null, turnUuid })
    setOpen(false)
  }

  useEffect(() => {
    if (!open || !sessionId) return
    let cancelled = false
    setLoading(true)
    setError(null)
    setReport(null)
    fetchSessionReport(sessionId)
      .then((r) => { if (!cancelled) setReport(r) })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [open, sessionId])

  // Initial focus → close button (FR-021a).
  useEffect(() => {
    if (!open) return
    const raf = requestAnimationFrame(() => closeRef.current?.focus())
    return () => cancelAnimationFrame(raf)
  }, [open])

  const empty = report ? isReportEmpty(report) : false

  const handleExport = () => {
    if (!report || empty) return
    downloadCsv(`session-${report.sessionId}-report.csv`, reportToCsv(report))
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="!max-w-[960px] w-[calc(100%-2rem)] !gap-0 !p-0 max-h-[calc(100vh-4rem)] flex flex-col overflow-hidden"
        showCloseButton={false}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <div className="relative flex-none border-b px-6 pt-5 pb-4">
          <DialogHeader className="pr-8 gap-1">
            <div className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
              Session report
            </div>
            <DialogTitle className="text-xl">
              {sessionTitle ?? 'Token consumption report'}
            </DialogTitle>
            <DialogDescription>
              Tokens grouped by agent and model. Units are model-relative weights (not USD) —
              stable across price changes.
            </DialogDescription>
          </DialogHeader>

          <button
            ref={closeRef}
            type="button"
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="absolute top-4 right-4 inline-flex items-center justify-center rounded-sm w-7 h-7 text-muted-foreground hover:bg-accent hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 flex flex-col gap-4">
          {loading && (
            <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading report…
            </div>
          )}

          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertTriangle className="inline w-4 h-4 mr-1" aria-hidden="true" />
              {error}
            </div>
          )}

          {report && !loading && !error && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Kpi
                  label="Duration"
                  value={empty ? '—' : formatDuration(report.durationMs)}
                  sublabel="first → last turn"
                />
                <Kpi
                  label="Tool calls"
                  value={empty ? '—' : String(report.toolCalls.total)}
                  sublabel={`main ${report.toolCalls.main} · sub ${report.toolCalls.sub}`}
                />
                <Kpi
                  label="Cache hit rate"
                  value={empty ? '—' : formatRate(report.cacheHitRate)}
                  sublabel="read / (read + create + input)"
                />
                <Kpi
                  label="Total units"
                  value={empty
                    ? '—'
                    : `${report.weightsMissing ? '≥ ' : ''}${formatUnits(report.totalUnits)}`}
                  sublabel={report.weightsMissing ? 'some models unknown' : 'weighted, all agents'}
                />
              </div>

              <section aria-label="By agent and model" className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                    By agent & model
                  </h3>
                  {!empty && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleExport}
                      aria-label="Export session report as CSV"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Export CSV
                    </Button>
                  )}
                </div>
                <ReportTable report={report} empty={empty} />
                <div className="text-[11px] text-muted-foreground">
                  input ×1.0 · cache 5m ×1.25 · cache 1h ×2.0 · cache read ×0.1
                </div>
              </section>

              {!empty && report.weightsMissing && (
                <div className="rounded-md border border-yellow-400/40 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-900 dark:text-yellow-200">
                  <AlertTriangle className="inline w-3.5 h-3.5 mr-1" aria-hidden="true" />
                  Weights missing for: <span className="font-mono">{report.missingModels.join(', ')}</span>.
                  Total shown as a lower bound. Add to <code>packages/shared/src/weights.ts</code>.
                </div>
              )}

              {tokenSeries && (
                <SessionReportUsageOverTime
                  series={tokenSeries}
                  forceEmpty={empty}
                  onJumpToTurn={handleJumpToTurn}
                />
              )}
              {fileTouchIndex && (
                <SessionReportFilesTouched index={empty ? { files: [] } : fileTouchIndex} />
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
