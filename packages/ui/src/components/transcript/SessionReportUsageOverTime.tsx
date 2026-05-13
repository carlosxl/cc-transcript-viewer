import type { TokenSeries, TokenSpike } from '@cc-viewer/shared'
import { abbreviateInt } from '@/lib/format'

interface UsageSpikeCard {
  turnUuid: string
  turnIndex: number
  tokens: number
  reason: TokenSpike['reason']
}

const REASON_LABEL: Record<TokenSpike['reason'], string> = {
  'high-input': 'High input',
  'high-output': 'High output',
  'high-cache-create': 'High cache create',
}

/**
 * Derive spike cards (FR-014). When the projection produced spikes, trust them.
 * Otherwise fall back to the top non-zero points ranked by total tokens desc.
 * Always capped at 3.
 */
export function spikeCards(series: TokenSeries): UsageSpikeCard[] {
  if (series.spikes.length > 0) {
    const byUuid = new Map(series.points.map((p) => [p.turnUuid, p]))
    return series.spikes.slice(0, 3).map((s) => ({
      turnUuid: s.turnUuid,
      turnIndex: byUuid.get(s.turnUuid)?.turnIndex ?? 0,
      tokens: s.tokens,
      reason: s.reason,
    }))
  }
  return series.points
    .filter((p) => (p.input + p.output + p.cacheCreate) > 0)
    .map((p) => ({
      turnUuid: p.turnUuid,
      turnIndex: p.turnIndex,
      tokens: p.input + p.output + p.cacheCreate,
      reason: 'high-output' as const,
    }))
    .sort((a, b) => b.tokens - a.tokens)
    .slice(0, 3)
}

interface SessionReportUsageOverTimeProps {
  series: TokenSeries
  /** When true, force the empty-state caption regardless of series content. */
  forceEmpty?: boolean
  /** Click handler for spike cards — receives a turn uuid to jump to. */
  onJumpToTurn?: (turnUuid: string) => void
}

interface SparklineDatum {
  turnUuid: string
  turnIndex: number
  total: number
}

/**
 * Line chart with subtle filled area, baseline rule, max/min y-axis labels,
 * and a highlighted peak dot. The peak annotation is rendered alongside the
 * caption above the chart; this svg stays focused on the visualization.
 */
function Sparkline({
  data,
  height = 72,
  onPick,
}: {
  data: SparklineDatum[]
  height?: number
  onPick?: (turnUuid: string) => void
}) {
  if (data.length === 0) return null
  const W = 1000 // viewBox space; preserveAspectRatio stretches to container
  const PAD_TOP = 6
  const PAD_BOTTOM = 10
  const usableH = height - PAD_TOP - PAD_BOTTOM
  const max = Math.max(...data.map((d) => d.total), 1)
  const stepX = data.length > 1 ? W / (data.length - 1) : 0

  let peakIdx = 0
  for (let i = 1; i < data.length; i++) if (data[i]!.total > data[peakIdx]!.total) peakIdx = i

  const px = (i: number) => i * stepX
  const py = (v: number) => PAD_TOP + (1 - v / max) * usableH

  const linePts = data.map((d, i) => `${px(i).toFixed(2)},${py(d.total).toFixed(2)}`).join(' ')
  const areaPts =
    `0,${(PAD_TOP + usableH).toFixed(2)} ` +
    linePts +
    ` ${(W).toFixed(2)},${(PAD_TOP + usableH).toFixed(2)}`

  const peak = data[peakIdx]!
  const peakX = px(peakIdx)
  const peakY = py(peak.total)

  return (
    <svg
      role="img"
      aria-label="Sparkline of units per turn"
      viewBox={`0 0 ${W} ${height}`}
      preserveAspectRatio="none"
      className="block w-full text-primary"
      style={{ height }}
    >
      {/* Baseline rule */}
      <line
        x1={0}
        x2={W}
        y1={PAD_TOP + usableH}
        y2={PAD_TOP + usableH}
        stroke="var(--border)"
        strokeWidth={0.5}
      />
      {/* Filled area under the line */}
      <polygon points={areaPts} fill="currentColor" opacity={0.08} />
      {/* The line itself */}
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        points={linePts}
        vectorEffect="non-scaling-stroke"
      />
      {/* Peak marker */}
      <circle cx={peakX} cy={peakY} r={3.5} fill="currentColor" />
      <circle cx={peakX} cy={peakY} r={7} fill="currentColor" opacity={0.15} />
      {/* Invisible per-point hit areas — native <title> drives hover tooltip */}
      {data.map((d, i) => (
        <g
          key={d.turnUuid + ':' + i}
          onClick={onPick ? () => onPick(d.turnUuid) : undefined}
          style={onPick ? { cursor: 'pointer' } : undefined}
        >
          <title>m{d.turnIndex + 1}: {d.total.toLocaleString()} units</title>
          <rect
            x={Math.max(0, px(i) - stepX / 2)}
            y={0}
            width={Math.max(1, stepX)}
            height={height}
            fill="transparent"
          />
        </g>
      ))}
    </svg>
  )
}

function findPeak(data: SparklineDatum[]): { turnIndex: number; tokens: number } | null {
  if (data.length === 0) return null
  let peakIdx = 0
  for (let i = 1; i < data.length; i++) if (data[i]!.total > data[peakIdx]!.total) peakIdx = i
  return { turnIndex: data[peakIdx]!.turnIndex, tokens: data[peakIdx]!.total }
}

export function SessionReportUsageOverTime({
  series,
  forceEmpty,
  onJumpToTurn,
}: SessionReportUsageOverTimeProps) {
  const cards = spikeCards(series)
  const isEmpty = forceEmpty || cards.length === 0
  const data: SparklineDatum[] = series.points.map((p) => ({
    turnUuid: p.turnUuid,
    turnIndex: p.turnIndex,
    total: p.input + p.output + p.cacheCreate,
  }))
  const peak = findPeak(data.filter((d) => d.total > 0))

  return (
    <section aria-label="Usage over time" className="flex flex-col gap-2">
      <h3 className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
        Usage over time
      </h3>
      {isEmpty ? (
        <div className="text-xs text-muted-foreground">No usage to chart yet.</div>
      ) : (
        <>
          <div className="flex items-baseline justify-between gap-3">
            <div className="text-xs text-muted-foreground">
              Units per turn · {series.points.length} turns
            </div>
            {peak && (
              <div className="text-xs text-muted-foreground tabular-nums">
                <span className="text-muted-foreground/70">peak</span>{' '}
                <span className="font-mono text-foreground">m{peak.turnIndex + 1}</span>{' '}
                <span className="text-muted-foreground">·</span>{' '}
                <span className="font-mono text-foreground">{abbreviateInt(peak.tokens)}</span>
              </div>
            )}
          </div>
          <div className="rounded-md border bg-card px-3 py-3">
            <Sparkline data={data} onPick={onJumpToTurn} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 mt-1">
            {cards.map((c) => {
              const inner = (
                <>
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <div className="font-mono text-[10.5px] text-muted-foreground">m{c.turnIndex + 1}</div>
                    <div className="text-[10.5px] text-muted-foreground truncate">{REASON_LABEL[c.reason]}</div>
                  </div>
                  <div className="font-mono font-semibold tabular-nums text-sm text-foreground shrink-0">
                    {abbreviateInt(c.tokens)}
                  </div>
                </>
              )
              return onJumpToTurn ? (
                <button
                  key={c.turnUuid}
                  type="button"
                  onClick={() => onJumpToTurn(c.turnUuid)}
                  aria-label={`Jump to turn m${c.turnIndex + 1}`}
                  className="flex items-baseline justify-between gap-3 rounded-md border bg-card px-3 py-2 text-left transition-colors hover:bg-accent hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 cursor-pointer"
                >
                  {inner}
                </button>
              ) : (
                <div
                  key={c.turnUuid}
                  className="flex items-baseline justify-between gap-3 rounded-md border bg-card px-3 py-2"
                >
                  {inner}
                </div>
              )
            })}
          </div>
        </>
      )}
    </section>
  )
}
