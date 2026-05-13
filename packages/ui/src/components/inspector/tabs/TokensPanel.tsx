import { useCallback } from 'react'
import { BarChart3, Flame } from 'lucide-react'
import { useActiveQuery } from '@/hooks/useActiveQuery'
import { useSearchStore } from '@/stores/useSearchStore'
import { abbreviateInt } from '@/lib/format'
import { TokensChart, LegendDot } from '../charts/TokensChart'

const SPIKE_REASON_LABEL: Record<string, string> = {
  'high-input': 'High input',
  'high-output': 'High output',
  'high-cache-create': 'High cache create',
}

/**
 * Tokens tab body. Reads `tokenSeries` (Phase 2 projection) for whichever
 * entry is active — session OR drilled-in subagent — and renders:
 *
 *   1. Stacked per-turn chart (input + output + cacheCreate) with spike turn
 *      outlined in the brand colour.
 *   2. 4-up stat grid: Total, Output, Cache hit %, Avg / turn.
 *   3. By-model breakdown bars sorted by share desc.
 *   4. Spike-turn list — clicking a row dispatches `requestJump` to the
 *      transcript pane (same plumbing as Inspector "Jump back" and search).
 */
export function TokensPanel() {
  const { tokenSeries, sessionId, agentId } = useActiveQuery()
  const requestJump = useSearchStore((s) => s.requestJump)

  const onJumpToTurn = useCallback(
    (turnUuid: string) => {
      if (!sessionId) return
      requestJump({ sessionId, agentId, turnUuid })
    },
    [sessionId, agentId, requestJump],
  )

  if (!tokenSeries) return <Empty />
  if (tokenSeries.points.length === 0) {
    return (
      <Empty
        title="No token usage"
        body="This entry has no assistant turns with usage data."
      />
    )
  }

  const totals = sumTotals(tokenSeries.points)
  const spikeSet = new Set(tokenSeries.spikes.map((s) => s.turnUuid))
  const primarySpike = tokenSeries.spikes[0]?.turnUuid ?? null

  return (
    <div className="h-full overflow-auto px-4 py-4 bg-[var(--surface-inset)]">
      <div className="grid gap-4">
        <section aria-label="Token usage chart">
          <Header
            title="Token usage"
            subtitle={`per turn · ${tokenSeries.points.length} ${tokenSeries.points.length === 1 ? 'turn' : 'turns'}`}
          />
          <div className="rounded-md border border-border bg-[var(--surface-2)] px-3 py-2.5">
            <div className="overflow-x-auto">
              <TokensChart
                points={tokenSeries.points}
                onSelect={onJumpToTurn}
                highlightTurnUuid={primarySpike}
              />
            </div>
            <div className="flex gap-3 pt-2 flex-wrap">
              <LegendDot color="var(--user-rail)" opacity={0.7} label="input" />
              <LegendDot color="var(--brand)" opacity={0.9} label="output" />
              <LegendDot color="var(--success)" opacity={0.55} label="cache create" />
            </div>
          </div>
        </section>

        <section
          aria-label="Token summary stats"
          className="grid grid-cols-2 gap-2.5"
        >
          <Stat label="Total" value={abbreviateInt(totals.grand)} sub="tokens" />
          <Stat label="Output" value={abbreviateInt(totals.output)} sub="tokens" />
          <Stat
            label="Cache hit"
            value={`${Math.round(tokenSeries.cacheHitPct * 100)}%`}
            sub="of input"
          />
          <Stat
            label="Avg / turn"
            value={abbreviateInt(Math.round(tokenSeries.avgPerTurn))}
            sub="tokens"
          />
        </section>

        <section aria-label="Tokens by model">
          <Header title="By model" />
          {tokenSeries.byModel.length === 0 ? (
            <div className="text-[11px] text-muted-foreground">No model data.</div>
          ) : (
            <div className="grid gap-1">
              {tokenSeries.byModel.map((m) => (
                <ModelRow
                  key={m.model || '(unknown)'}
                  model={m.model || '(unknown)'}
                  tokens={m.tokens}
                  pct={m.pct}
                />
              ))}
            </div>
          )}
        </section>

        <section aria-label="Spike turns">
          <Header title="Spike turns" subtitle={tokenSeries.spikes.length === 0 ? 'none detected' : undefined} />
          {tokenSeries.spikes.length === 0 ? (
            <div className="text-[11px] text-muted-foreground">
              No turn rose &gt;2σ above the mean.
            </div>
          ) : (
            <div className="grid">
              {tokenSeries.spikes.map((s) => (
                <SpikeRow
                  key={s.turnUuid}
                  turnUuid={s.turnUuid}
                  tokens={s.tokens}
                  reason={SPIKE_REASON_LABEL[s.reason] ?? s.reason}
                  index={turnIndexOf(tokenSeries.points, s.turnUuid)}
                  highlighted={spikeSet.has(s.turnUuid) && s.turnUuid === primarySpike}
                  onJump={onJumpToTurn}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function sumTotals(points: { input: number; output: number; cacheCreate: number; cacheRead: number }[]) {
  let input = 0
  let output = 0
  let cacheCreate = 0
  let cacheRead = 0
  for (const p of points) {
    input += p.input
    output += p.output
    cacheCreate += p.cacheCreate
    cacheRead += p.cacheRead
  }
  return { input, output, cacheCreate, cacheRead, grand: input + output + cacheCreate + cacheRead }
}

function turnIndexOf(points: { turnUuid: string; turnIndex: number }[], uuid: string): number | null {
  const p = points.find((x) => x.turnUuid === uuid)
  return p ? p.turnIndex : null
}

function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex items-baseline justify-between mb-2">
      <div className="text-[13px] font-semibold text-foreground">{title}</div>
      {subtitle && (
        <div className="font-mono text-[10.5px] text-muted-foreground">{subtitle}</div>
      )}
    </div>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-md border border-border bg-[var(--surface-2)] px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">
        {label}
      </div>
      <div className="font-mono text-[18px] font-semibold text-foreground leading-tight mt-0.5">
        {value}
      </div>
      <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>
    </div>
  )
}

function ModelRow({ model, tokens, pct }: { model: string; tokens: number; pct: number }) {
  const pctPercent = Math.round(pct * 100)
  return (
    <div className="flex items-center gap-2 py-1.5">
      <div className="flex-1 min-w-0">
        <div className="flex justify-between font-mono text-[11.5px] mb-1">
          <span className="text-foreground truncate">{model}</span>
          <span className="text-muted-foreground ml-2 flex-shrink-0">
            {abbreviateInt(tokens)}
          </span>
        </div>
        <div className="h-[5px] rounded-full bg-[var(--surface-3)] overflow-hidden">
          <div
            className="h-full bg-[var(--brand)]"
            style={{ width: `${pctPercent}%` }}
          />
        </div>
      </div>
      <div className="font-mono text-[11px] text-muted-foreground w-9 text-right">
        {pctPercent}%
      </div>
    </div>
  )
}

interface SpikeRowProps {
  turnUuid: string
  tokens: number
  reason: string
  index: number | null
  highlighted: boolean
  onJump: (turnUuid: string) => void
}

function SpikeRow({ turnUuid, tokens, reason, index, highlighted, onJump }: SpikeRowProps) {
  return (
    <button
      type="button"
      onClick={() => onJump(turnUuid)}
      className="flex items-center gap-2.5 px-1 py-1.5 text-left border-b border-[var(--border-subtle)] last:border-b-0 hover:bg-[var(--surface-2)] rounded-sm"
      aria-label={`Jump to spike turn ${index !== null ? index + 1 : ''}`}
    >
      <Flame
        className={
          'w-3 h-3 flex-shrink-0 ' +
          (highlighted ? 'text-[var(--brand)]' : 'text-muted-foreground')
        }
        aria-hidden="true"
      />
      <span className="font-mono text-[11px] font-semibold text-[var(--brand-text)] w-10">
        {index !== null ? `m${index + 1}` : '—'}
      </span>
      <span className="font-mono text-[11.5px] text-foreground flex-1 truncate">
        {reason}
      </span>
      <span className="font-mono text-[11.5px] font-semibold text-foreground">
        {abbreviateInt(tokens)}
      </span>
    </button>
  )
}

function Empty({
  title = 'No token data',
  body = 'Tokens panel appears once usage data is available.',
}: { title?: string; body?: string } = {}) {
  return (
    <div
      role="status"
      aria-label={title}
      className="h-full flex flex-col items-center justify-center text-center px-8 gap-2 text-muted-foreground"
    >
      <BarChart3 className="w-5 h-5 text-[var(--text-4)]" aria-hidden="true" />
      <div className="text-sm font-semibold text-[var(--text-2)]">{title}</div>
      <div className="text-xs max-w-[260px]">{body}</div>
    </div>
  )
}
