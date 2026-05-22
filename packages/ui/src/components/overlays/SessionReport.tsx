import { useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import { I } from '@/components/ui/icons'
import { Sparkline } from './Sparkline'
import { getSessionReport } from '@/api/report'
import { getSession } from '@/api/sessions'
import { useOverlays } from '@/stores/useOverlays'
import { useSessionStack } from '@/stores/useSessionStack'
import { fmtCost, fmtDuration, shortPreview } from '@/lib/format'
import type {
  ReportRow,
  SessionDetailResponse,
  SessionReport as SessionReportData,
  SessionView,
} from '@/lib/types'

interface SessionReportProps {
  /** Session id to report on. Usually the stack-top view's id. */
  sessionId: string | null
  /** Title to render in the report header. */
  sessionTitle: string
}

export function SessionReport({ sessionId, sessionTitle }: SessionReportProps) {
  const open = useOverlays((s) => s.report.open)
  const close = useOverlays((s) => s.closeReport)
  const view = useSessionStack((s) => s.stack[s.stack.length - 1]?.view ?? null)

  const closeBtnRef = useRef<HTMLButtonElement | null>(null)
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => closeBtnRef.current?.focus(), 30)
      return () => clearTimeout(t)
    }
  }, [open])

  const reportQuery = useQuery({
    queryKey: ['report', sessionId],
    queryFn: ({ signal }) => getSessionReport(sessionId!, { signal }),
    enabled: open && sessionId != null,
  })

  // The report doesn't include per-turn token/file data — pull from the cached
  // SessionDetailResponse if it's been fetched; otherwise fetch on demand.
  const detailQuery = useQuery({
    queryKey: ['session', sessionId],
    queryFn: ({ signal }) => getSession(sessionId!, { signal }),
    enabled: open && sessionId != null,
  })

  if (!open) return null

  const report = reportQuery.data ?? null
  const detail = detailQuery.data ?? null

  return createPortal(
    <>
      <div
        className="overlay-backdrop fixed inset-0 z-[100]"
        style={{
          background: 'oklch(0.05 0.01 265 / 0.5)',
          animation: 'bd-in 120ms ease-out',
        }}
        onClick={close}
      />
      <div
        role="dialog"
        aria-label="Session report"
        className="report-shell fixed z-[101] flex flex-col overflow-hidden"
        style={{
          top: '4%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'min(1080px, 94vw)',
          maxHeight: '92vh',
          background: 'var(--surface-1)',
          border: '1px solid var(--border-2)',
          borderRadius: 'var(--r-lg)',
          boxShadow: 'var(--shadow-overlay)',
          animation: 'ovr-in 160ms cubic-bezier(.2,.7,.2,1)',
        }}
      >
        <div
          className="report-head flex items-center gap-3 border-b"
          style={{ padding: '14px 18px', borderColor: 'var(--border-1)' }}
        >
          <div>
            <div
              className="kicker font-mono uppercase"
              style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.07em' }}
            >
              Session report
            </div>
            <div
              className="title"
              style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-0)', letterSpacing: '-0.01em' }}
            >
              {sessionTitle}
            </div>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={close}
            aria-label="close"
            className="close ml-auto inline-flex h-7 w-7 items-center justify-center rounded-sm border border-transparent text-[var(--text-2)] hover:border-[var(--border-1)] hover:bg-[var(--surface-2)] hover:text-[var(--text-0)]"
          >
            <I.x />
          </button>
        </div>
        <div className="report-body overflow-y-auto" style={{ padding: '18px 22px 24px' }}>
          {report && view ? (
            <ReportContent report={report} detail={detail ?? null} view={view} />
          ) : (
            <div
              style={{
                padding: '40px 20px',
                textAlign: 'center',
                color: 'var(--text-2)',
                fontSize: 12.5,
              }}
            >
              {reportQuery.isError
                ? 'Failed to load report.'
                : 'Loading session report…'}
            </div>
          )}
        </div>
      </div>
    </>,
    document.body,
  )
}

function ReportContent({
  report,
  detail,
  view,
}: {
  report: SessionReportData
  detail: SessionDetailResponse | null
  view: SessionView
}) {
  const turnCount = view.turns.length
  const totalCost = useMemo(
    () => view.turns.reduce((s, t) => s + t.cost, 0),
    [view],
  )
  const hitPct =
    report.cacheHitRate != null ? `${(report.cacheHitRate * 100).toFixed(0)}%` : '—'

  // Totals row for "By agent & model" table.
  const totals = useMemo(() => {
    const acc = { input: 0, c5: 0, c1: 0, cRd: 0, output: 0 }
    for (const r of report.rows) {
      acc.input += r.tokens.input
      acc.c5 += r.tokens.cacheCreate5m
      acc.c1 += r.tokens.cacheCreate1h
      acc.cRd += r.tokens.cacheRead
      acc.output += r.tokens.output
    }
    const denom = acc.cRd + acc.c5 + acc.c1 + acc.input
    const hit = denom > 0 ? acc.cRd / denom : null
    return { ...acc, hit }
  }, [report])

  // Per-turn cost series for the sparkline.
  const costSeries = useMemo(
    () => view.turns.map((t) => t.cost),
    [view],
  )

  // Per-turn cache-write delta from detail.tokenSeries.points, indexed by turn uuid.
  const cacheDeltaByTurn = useMemo<Map<string, number>>(() => {
    const m = new Map<string, number>()
    const points = detail?.tokenSeries?.points ?? []
    let prev = 0
    for (const p of points) {
      const total = (p.cacheCreate ?? 0) + (p.cacheRead ?? 0)
      m.set(p.turnUuid, total - prev)
      prev = total
    }
    return m
  }, [detail])

  // Top-3 cost spikes (preferring SessionTokenSeries.spikes if present, else
  // derive from per-turn cost).
  const spikes = useMemo(() => {
    if (detail?.tokenSeries?.spikes && detail.tokenSeries.spikes.length > 0) {
      return detail.tokenSeries.spikes.slice(0, 3).map((s) => {
        const t = view.turns.find((tt) => tt.id === s.turnUuid)
        return {
          id: s.turnUuid,
          prompt: t?.prompt ?? '',
          cost: t?.cost ?? 0,
        }
      })
    }
    const ranked = view.turns
      .map((t) => ({ id: t.id, prompt: t.prompt, cost: t.cost }))
      .filter((t) => t.cost > 0)
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 3)
    return ranked
  }, [detail, view])

  // Files timeline normalized 0..1 across session time.
  const files = useMemo(() => {
    const fileIndex = detail?.fileTouchIndex
    if (!fileIndex) return []
    const tsList = view.turns.map((t) => Date.parse(t.time)).filter((n) => !Number.isNaN(n))
    const start = tsList.length > 0 ? Math.min(...tsList) : 0
    const end = tsList.length > 0 ? Math.max(...tsList) : 1
    const span = Math.max(1, end - start)
    return fileIndex.files.map((f) => {
      const pips: Array<{ k: 'r' | 'w'; t: number }> = []
      for (const r of f.reads) {
        const ts = Date.parse(r.timestamp)
        if (!Number.isNaN(ts)) pips.push({ k: 'r', t: (ts - start) / span })
      }
      for (const w of f.writes) {
        const ts = Date.parse(w.timestamp)
        if (!Number.isNaN(ts)) pips.push({ k: 'w', t: (ts - start) / span })
      }
      return { path: f.path, changed: f.changed, pips, count: pips.length }
    })
  }, [detail, view])

  return (
    <>
      <div
        className="stat-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 10,
          marginBottom: 22,
        }}
      >
        <StatCard label="Duration" value={fmtDuration(report.durationMs)} sub={`${turnCount} Turns`} />
        <StatCard
          label="Turns"
          value={String(turnCount)}
          sub={turnCount > 0 ? `avg ${fmtCost(totalCost / turnCount)}` : '—'}
        />
        <StatCard
          label="Tool calls"
          value={String(report.toolCalls.total)}
          sub={`main ${report.toolCalls.main} · sub ${report.toolCalls.sub}`}
        />
        <StatCard
          label="Cache hit"
          value={hitPct}
          sub="read / (read + create + input)"
        />
        <StatCard label="Total cost" value={fmtCost(totalCost)} sub={view.model || '—'} accent />
      </div>

      <SectionHeader title="By agent & model" desc="raw tokens · dollars" right={<ExportBtn />} />
      <Table>
        <thead>
          <tr>
            <Th>Agent</Th>
            <Th>Model</Th>
            <Th align="right">Input</Th>
            <Th align="right">Cache 5m</Th>
            <Th align="right">Cache 1h</Th>
            <Th align="right">Cache rd</Th>
            <Th align="right">Output</Th>
            <Th align="right">Cache hit</Th>
            <Th align="right">Cost</Th>
          </tr>
        </thead>
        <tbody>
          {report.rows.map((r, i) => (
            <ModelRow key={i} row={r} />
          ))}
          <tr className="total">
            <td className="agent" colSpan={2} style={{ ...tdBase, ...tdAgent, ...totalTd }}>
              Total
            </td>
            <td style={{ ...tdBase, ...tdNum, ...totalTd }}>{totals.input.toLocaleString()}</td>
            <td style={{ ...tdBase, ...tdNum, ...totalTd }}>{totals.c5.toLocaleString()}</td>
            <td style={{ ...tdBase, ...tdNum, ...totalTd }}>{totals.c1.toLocaleString()}</td>
            <td style={{ ...tdBase, ...tdNum, ...totalTd }}>{totals.cRd.toLocaleString()}</td>
            <td style={{ ...tdBase, ...tdNum, ...totalTd }}>{totals.output.toLocaleString()}</td>
            <td style={{ ...tdBase, ...tdNum, ...totalTd }}>
              {totals.hit != null ? `${(totals.hit * 100).toFixed(0)}%` : '—'}
            </td>
            <td style={{ ...tdBase, ...tdCost, ...totalTd }}>{fmtCost(totalCost)}</td>
          </tr>
        </tbody>
      </Table>

      <SectionHeader title="By turn" desc="cache-write delta proxy · includes attachments" />
      <Table>
        <thead>
          <tr>
            <Th>Turn</Th>
            <Th>Prompt</Th>
            <Th align="right">Requests</Th>
            <Th align="right">Blocks</Th>
            <Th align="right">Attachments</Th>
            <Th align="right">Cache-write Δ</Th>
            <Th align="right">Cost</Th>
          </tr>
        </thead>
        <tbody>
          {view.turns.map((t) => {
            const blocks = t.requests.reduce((s, r) => s + r.blocks.length, 0)
            const delta = cacheDeltaByTurn.get(t.id) ?? 0
            return (
              <tr key={t.id}>
                <td style={{ ...tdBase, ...tdAgent }}>{t.id.slice(0, 8)}</td>
                <td
                  style={{
                    ...tdBase,
                    ...tdDim,
                    maxWidth: 280,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {shortPreview(t.prompt, 50)}
                </td>
                <td style={{ ...tdBase, ...tdNum }}>{t.requests.length}</td>
                <td style={{ ...tdBase, ...tdNum }}>{blocks}</td>
                <td style={{ ...tdBase, ...tdNum }}>
                  {t.attachments.length > 0 ? t.attachments.length : '—'}
                </td>
                <td style={{ ...tdBase, ...tdNum }}>{delta.toLocaleString()}</td>
                <td style={{ ...tdBase, ...tdCost }}>{fmtCost(t.cost)}</td>
              </tr>
            )
          })}
        </tbody>
      </Table>
      <div
        className="info-callout"
        style={{
          marginTop: 8,
          padding: '8px 12px',
          background: 'var(--surface-2)',
          border: '1px solid var(--border-1)',
          borderRadius: 'var(--r-sm)',
          fontSize: 11.5,
          color: 'var(--text-1)',
          lineHeight: 1.55,
        }}
      >
        <strong style={{ color: 'var(--text-0)' }}>Cache-write Δ</strong> ={' '}
        <code
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--text-0)',
            background: 'var(--surface-3)',
            padding: '0 4px',
            borderRadius: 3,
          }}
        >
          (cc + cr)[N] − (cc + cr)[N-1]
        </code>{' '}
        — the per-turn cache-write delta, which already includes attachment tokens injected at the same timestamp.
      </div>

      <SectionHeader title="Usage over time" desc="cost per Turn · top 3 spikes" />
      <div
        className="over-time-row"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 360px',
          gap: 16,
          alignItems: 'stretch',
        }}
      >
        <div
          className="spark-wrap relative"
          style={{
            background: 'var(--surface-2)',
            border: '1px solid var(--border-1)',
            borderRadius: 'var(--r-sm)',
            padding: 12,
          }}
        >
          <div
            className="ylbl absolute font-mono uppercase"
            style={{
              top: 10,
              right: 12,
              fontSize: 10,
              color: 'var(--text-3)',
              letterSpacing: '0.07em',
            }}
          >
            $ per Turn
          </div>
          <Sparkline data={costSeries} height={140} accent="var(--accent)" />
        </div>
        <div className="spike-cards flex flex-col gap-1.5">
          {spikes.length === 0 ? (
            <div
              style={{
                padding: 12,
                background: 'var(--surface-2)',
                border: '1px solid var(--border-1)',
                borderRadius: 'var(--r-sm)',
                color: 'var(--text-3)',
                fontSize: 11.5,
                textAlign: 'center',
              }}
            >
              No notable spikes
            </div>
          ) : (
            spikes.map((s, i) => (
              <div
                key={s.id}
                className="spike-card flex items-center gap-2.5"
                style={{
                  padding: '8px 10px',
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border-1)',
                  borderRadius: 'var(--r-sm)',
                }}
              >
                <span
                  className="rank font-mono"
                  style={{ fontSize: 10, color: 'var(--text-3)', width: 20 }}
                >
                  #{i + 1}
                </span>
                <div className="body flex-1 min-w-0">
                  <div
                    className="turn font-mono"
                    style={{ fontSize: 11, color: 'var(--text-0)' }}
                  >
                    Turn {s.id.slice(0, 8)}
                  </div>
                  <div
                    className="prompt truncate"
                    style={{ fontSize: 11.5, color: 'var(--text-2)' }}
                  >
                    {shortPreview(s.prompt, 56)}
                  </div>
                </div>
                <span
                  className="cost font-mono"
                  style={{ fontSize: 12.5, color: 'var(--accent-2)', fontWeight: 500 }}
                >
                  {fmtCost(s.cost)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <SectionHeader title="Files touched" desc="read/write timeline · sorted by total activity" />
      <div
        style={{
          border: '1px solid var(--border-1)',
          borderRadius: 6,
          overflow: 'hidden',
        }}
      >
        {files.length === 0 ? (
          <div
            style={{
              padding: 12,
              color: 'var(--text-3)',
              fontFamily: 'var(--font-mono)',
              fontSize: 11.5,
              textAlign: 'center',
            }}
          >
            No file activity in this session
          </div>
        ) : (
          files.map((f) => (
            <div
              key={f.path}
              className="files-row"
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) 320px 80px',
                alignItems: 'center',
                gap: 12,
                padding: '7px 10px',
                borderBottom: '1px solid var(--border)',
                fontFamily: 'var(--font-mono)',
                fontSize: 11.5,
              }}
            >
              <div>
                <span
                  className="path truncate inline-block max-w-full align-bottom"
                  style={{ color: 'var(--text-0)' }}
                >
                  {f.path}
                </span>
                {f.changed && (
                  <span
                    className="changed-tag ml-1.5 inline-block uppercase"
                    style={{
                      fontSize: 9.5,
                      padding: '1px 5px',
                      borderRadius: 3,
                      background: 'oklch(0.82 0.14 80 / 0.16)',
                      color: 'oklch(0.78 0.13 80)',
                      letterSpacing: '0.06em',
                    }}
                  >
                    changed
                  </span>
                )}
              </div>
              <div
                className="timeline relative"
                style={{ height: 16, background: 'var(--surface-2)', borderRadius: 99 }}
              >
                {f.pips.map((p, i) => (
                  <span
                    key={i}
                    className={'pip absolute'}
                    style={{
                      top: 4,
                      width: 4,
                      height: 8,
                      borderRadius: 99,
                      transform: 'translateX(-2px)',
                      left: Math.max(0, Math.min(1, p.t)) * 100 + '%',
                      background: p.k === 'r' ? 'var(--accent)' : 'var(--green)',
                    }}
                    title={p.k === 'r' ? 'read' : 'write'}
                  />
                ))}
              </div>
              <div className="count text-right" style={{ color: 'var(--text-2)' }}>
                {f.count}
              </div>
            </div>
          ))
        )}
      </div>

      <div style={{ height: 24 }} />
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          fontSize: 11,
          color: 'var(--text-3)',
          fontFamily: 'var(--font-mono)',
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 6, height: 6, borderRadius: 99, background: 'var(--accent)' }} /> read
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 6, height: 6, borderRadius: 99, background: 'var(--green)' }} /> write
        </span>
      </div>
      {report.weightsMissing && (
        <div
          style={{
            marginTop: 12,
            fontFamily: 'var(--font-mono)',
            fontSize: 10.5,
            color: 'var(--text-3)',
          }}
        >
          ≥ totals shown — model weights missing for: {report.missingModels.join(', ')}
        </div>
      )}
    </>
  )
}

const tdBase: React.CSSProperties = {
  textAlign: 'left',
  padding: '7px 10px',
  borderBottom: '1px solid var(--border)',
}
const tdNum: React.CSSProperties = { textAlign: 'right', color: 'var(--text-1)' }
const tdCost: React.CSSProperties = {
  textAlign: 'right',
  color: 'var(--text-0)',
  fontWeight: 500,
}
const tdAgent: React.CSSProperties = { color: 'var(--text-0)', fontWeight: 500 }
const tdDim: React.CSSProperties = { color: 'var(--text-3)' }
const totalTd: React.CSSProperties = {
  background: 'var(--surface-2)',
  color: 'var(--text-0)',
  fontWeight: 600,
  borderTop: '1px solid var(--border-2)',
}

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: string
  sub: string
  accent?: boolean
}) {
  return (
    <div
      className="stat-card"
      style={{
        padding: '12px 14px',
        background: 'var(--surface-2)',
        border: '1px solid var(--border-1)',
        borderRadius: 'var(--r-sm)',
      }}
    >
      <div
        className="lbl font-mono uppercase"
        style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.07em', marginBottom: 6 }}
      >
        {label}
      </div>
      <div
        className="val font-mono"
        style={{
          fontSize: 22,
          color: accent ? 'var(--accent-2)' : 'var(--text-0)',
          fontWeight: 500,
          letterSpacing: '-0.02em',
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
      <div
        className="sub font-mono"
        style={{ fontSize: 10.5, color: 'var(--text-2)', marginTop: 3 }}
      >
        {sub}
      </div>
    </div>
  )
}

function SectionHeader({
  title,
  desc,
  right,
}: {
  title: string
  desc?: string
  right?: React.ReactNode
}) {
  return (
    <div
      className="section-h flex items-baseline gap-2"
      style={{ margin: '20px 0 8px' }}
    >
      <div className="h" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-0)' }}>
        {title}
      </div>
      {desc && (
        <div
          className="desc font-mono"
          style={{ fontSize: 11, color: 'var(--text-3)' }}
        >
          {desc}
        </div>
      )}
      {right && <div className="right ml-auto">{right}</div>}
    </div>
  )
}

function ExportBtn() {
  return (
    <button
      type="button"
      className="export-btn font-mono uppercase"
      style={{
        fontSize: 10,
        color: 'var(--text-1)',
        padding: '4px 8px',
        background: 'var(--surface-2)',
        border: '1px solid var(--border-1)',
        borderRadius: 'var(--r-xs)',
        letterSpacing: '0.06em',
      }}
      onClick={() => {
        /* Export CSV is a stub for v1 — see Assumptions in spec.md */
      }}
    >
      Export CSV
    </button>
  )
}

function Table({ children }: { children: React.ReactNode }) {
  return (
    <table
      className="table"
      style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontFamily: 'var(--font-mono)',
        fontSize: 11.5,
        border: '1px solid var(--border-1)',
        borderRadius: 'var(--r-sm)',
        overflow: 'hidden',
      }}
    >
      {children}
    </table>
  )
}

function Th({
  children,
  align,
}: {
  children: React.ReactNode
  align?: 'left' | 'right'
}) {
  return (
    <th
      style={{
        textAlign: align ?? 'left',
        padding: '7px 10px',
        borderBottom: '1px solid var(--border)',
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        color: 'var(--text-3)',
        fontWeight: 500,
        textTransform: 'uppercase',
        letterSpacing: '0.07em',
        background: 'var(--surface-2)',
      }}
    >
      {children}
    </th>
  )
}

function ModelRow({ row }: { row: ReportRow }) {
  const hitPct = row.cacheHitRate != null ? `${(row.cacheHitRate * 100).toFixed(0)}%` : '—'
  const costGuess =
    row.units != null && row.weights ? row.units / 1_000_000 : null
  return (
    <tr>
      <td style={{ ...tdBase, ...tdAgent }}>{row.agentGroup}</td>
      <td style={{ ...tdBase, ...tdDim }}>{row.model || '—'}</td>
      <td style={{ ...tdBase, ...tdNum }}>{row.tokens.input.toLocaleString()}</td>
      <td style={{ ...tdBase, ...tdNum }}>{row.tokens.cacheCreate5m.toLocaleString()}</td>
      <td style={{ ...tdBase, ...tdNum }}>{row.tokens.cacheCreate1h.toLocaleString()}</td>
      <td style={{ ...tdBase, ...tdNum }}>{row.tokens.cacheRead.toLocaleString()}</td>
      <td style={{ ...tdBase, ...tdNum }}>{row.tokens.output.toLocaleString()}</td>
      <td style={{ ...tdBase, ...tdNum }}>{hitPct}</td>
      <td style={{ ...tdBase, ...tdCost }}>{costGuess != null ? fmtCost(costGuess) : '—'}</td>
    </tr>
  )
}

