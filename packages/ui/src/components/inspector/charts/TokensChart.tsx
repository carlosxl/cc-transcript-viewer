import type { TokenPoint } from '@cc-viewer/shared'
import { formatExactInt } from '@/lib/format'

interface TokensChartProps {
  points: TokenPoint[]
  /** Optional click handler — receives the turn uuid for jump-to-turn. */
  onSelect?: (turnUuid: string) => void
  /** Optional uuid of a spike-highlighted turn (drawn with brand stroke). */
  highlightTurnUuid?: string | null
  /** SVG canvas height in px. Bars scale to fit. */
  height?: number
}

const BAR_W = 6
const GAP = 2
const PADDING_TOP = 6
const BASELINE_PAD = 14

/**
 * Stacked vertical-bar chart of per-turn token usage. Three series stack
 * bottom-up: input (user-rail), output (brand), cacheCreate (success). Cache
 * reads are excluded — they're effectively a cost discount and would dwarf the
 * other series on cache-heavy sessions.
 *
 * Each bar carries a native `<title>` tooltip with turn index + breakdown so
 * hover works without JS, and clicking emits the `turnUuid` for jump-to-turn.
 *
 * Pure SVG, no chart-lib dependency. Width is set to the bar count so the
 * caller can wrap it in an overflow-x:auto container on large sessions.
 */
export function TokensChart({
  points,
  onSelect,
  highlightTurnUuid,
  height = 120,
}: TokensChartProps) {
  if (points.length === 0) {
    return (
      <div
        role="img"
        aria-label="No token data"
        className="text-[11px] text-muted-foreground py-3 text-center"
      >
        No usage data yet
      </div>
    )
  }
  const max = Math.max(
    1,
    ...points.map((p) => p.input + p.output + p.cacheCreate),
  )
  const baseline = height - BASELINE_PAD
  const usableH = baseline - PADDING_TOP
  const totalW = points.length * (BAR_W + GAP)

  return (
    <svg
      viewBox={`0 0 ${totalW} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`Per-turn token chart, ${points.length} turns`}
      className="block w-full"
      style={{ height }}
    >
      {points.map((p, i) => {
        const total = p.input + p.output + p.cacheCreate
        const h = total === 0 ? 0 : (total / max) * usableH
        const inH = total === 0 ? 0 : (p.input / total) * h
        const outH = total === 0 ? 0 : (p.output / total) * h
        const cacheH = total === 0 ? 0 : (p.cacheCreate / total) * h
        const x = i * (BAR_W + GAP)
        const top = baseline - h
        const highlighted = highlightTurnUuid && p.turnUuid === highlightTurnUuid
        const tooltip =
          `Turn ${p.turnIndex + 1}` +
          `\nInput: ${formatExactInt(p.input)}` +
          `\nOutput: ${formatExactInt(p.output)}` +
          `\nCache create: ${formatExactInt(p.cacheCreate)}` +
          `\nCache read: ${formatExactInt(p.cacheRead)}`
        return (
          <g
            key={p.turnUuid + ':' + i}
            onClick={onSelect ? () => onSelect(p.turnUuid) : undefined}
            style={onSelect ? { cursor: 'pointer' } : undefined}
          >
            <title>{tooltip}</title>
            <rect
              x={x}
              y={baseline - inH}
              width={BAR_W}
              height={inH}
              fill="var(--user-rail)"
              opacity={0.7}
            />
            <rect
              x={x}
              y={baseline - inH - outH}
              width={BAR_W}
              height={outH}
              fill="var(--brand)"
              opacity={0.9}
            />
            <rect
              x={x}
              y={baseline - inH - outH - cacheH}
              width={BAR_W}
              height={cacheH}
              fill="var(--success)"
              opacity={0.55}
            />
            {highlighted ? (
              <rect
                x={x - 0.5}
                y={top - 0.5}
                width={BAR_W + 1}
                height={h + 1}
                fill="none"
                stroke="var(--brand)"
                strokeWidth={1}
              />
            ) : null}
          </g>
        )
      })}
      <line
        x1={0}
        x2={totalW}
        y1={baseline}
        y2={baseline}
        stroke="var(--border)"
        strokeWidth={0.5}
      />
    </svg>
  )
}

interface LegendDotProps {
  color: string
  opacity?: number
  label: string
}

export function LegendDot({ color, opacity, label }: LegendDotProps) {
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[10.5px] text-muted-foreground">
      <span
        aria-hidden="true"
        className="inline-block w-2 h-2 rounded-[2px]"
        style={{ background: color, opacity }}
      />
      {label}
    </span>
  )
}
