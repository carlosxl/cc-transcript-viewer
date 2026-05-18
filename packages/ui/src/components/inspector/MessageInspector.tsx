import { useMemo } from 'react'
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Hash,
  Sparkles,
  Terminal as TerminalIcon,
  AlertTriangle,
  User as UserIcon,
  Info,
} from 'lucide-react'
import type { Turn, UsageBlock } from '@cc-viewer/shared'
import { CACHE_MULTIPLIERS, resolveWeights } from '@cc-viewer/shared'
import { useUIStore } from '@/stores/useUIStore'
import { useNavigationStore } from '@/stores/useNavigationStore'
import { useSearchStore } from '@/stores/useSearchStore'
import { useActiveQuery } from '@/hooks/useActiveQuery'
import { useActiveSubagents } from '@/hooks/useActiveSubagents'
import { useFlatNodes } from '@/hooks/useFlatNodes'
import { useFocusedTurn } from '@/hooks/useFocusedTurn'
import { classifyUserText } from '@/lib/classifyUserText'
import { abbreviateInt, formatTurnTimestamp } from '@/lib/format'
import { iconFor } from '@/lib/toolIcons'
import { cn } from '@/lib/utils'
import { InspectorEmpty } from './InspectorEmpty'

const CTX_WINDOW = 200_000
const EMPTY_TURNS: Turn[] = []

/**
 * Per-turn inspector shown in the right rail when j/k focuses a turn but no
 * tool/diff is drilled in. Click a tool row to drill in; press j/k to browse
 * away. See `.design/v3/project/workspace-rail.jsx` (MessageInspector).
 */
export function MessageInspector() {
  const focused = useFocusedTurn()
  if (!focused) return <InspectorEmpty />
  if (focused.turn.role === 'assistant') {
    return <AssistantMessageInspector turn={focused.turn} />
  }
  return <UserMessageInspector turn={focused.turn} nextAssistantTurn={focused.nextAssistantTurn} />
}

// ── Assistant ─────────────────────────────────────────────────────────────

function AssistantMessageInspector({ turn }: { turn: Turn }) {
  const usage: UsageBlock | undefined = turn.usage
  const { interactions, sessionId, agentId } = useActiveQuery()
  const setSelected = useNavigationStore((s) => s.setSelectedInteractionId)
  const requestJump = useSearchStore((s) => s.requestJump)
  const onJumpBack = () => {
    if (!sessionId) return
    requestJump({ sessionId, agentId, turnUuid: turn.uuid })
  }

  const input = usage?.input_tokens ?? 0
  const output = usage?.output_tokens ?? 0
  const cacheCreate = usage?.cache_creation_input_tokens ?? 0
  const cacheRead = usage?.cache_read_input_tokens ?? 0
  const total = input + output + cacheCreate + cacheRead
  const totalInput = input + cacheCreate + cacheRead
  // "New this turn" excludes cache_read — that's just the prior conversation
  // being re-fed each turn, so including it makes per-turn totals look
  // accumulative. The Breakdown / Cache efficiency cards below still show the
  // full picture including cache_read.
  const newTokens = input + cacheCreate + output
  const cachePct = totalInput > 0 ? (cacheRead / totalInput) * 100 : 0
  const contextUsed = totalInput // size of prompt sent at request time
  const ctxPct = Math.min(100, (contextUsed / CTX_WINDOW) * 100)
  const unitsNew = useMemo(() => computeUnits(turn.model, usage, { excludeCacheRead: true }), [turn.model, usage])

  const parts = useMemo(() => buildAssistantParts(turn), [turn])
  const interactionByToolId = useMemo(() => {
    const m = new Map<string, string>()
    if (!interactions) return m
    for (const it of interactions) {
      if (it.turnUuid === turn.uuid) m.set(it.toolUseId, it.id)
    }
    return m
  }, [interactions, turn.uuid])

  const noUsage = !usage || total === 0

  return (
    <div
      role="region"
      aria-label="Assistant message inspector"
      data-testid="message-inspector-assistant"
      className="flex-1 min-h-0 overflow-auto px-4 pt-3.5 pb-7"
    >
      <div className="grid grid-cols-1 gap-4">
        <Identity
          kindLabel="Assistant turn"
          id={turn.uuid.slice(0, 8)}
          at={formatTurnTimestamp(turn.timestamp)}
          name="Claude"
          sub={turn.model ?? '—'}
          tint="claude"
          onJumpBack={onJumpBack}
        />

        <div className="grid grid-cols-2 gap-2">
          <MetricCell label="New tokens" value={noUsage ? '—' : abbreviateInt(newTokens)}
            sub={noUsage ? 'streaming or no usage' : `${abbreviateInt(input + cacheCreate)} in · ${abbreviateInt(output)} out`} />
          <MetricCell label="Weighted units" value={unitsNew === null ? '—' : `${abbreviateInt(Math.round(unitsNew))}u`}
            sub={unitsNew === null ? 'weights missing' : 'this turn, model-relative'} tone="accent" />
        </div>

        {!noUsage && (
          <Section title="Breakdown">
            <div className="rounded-md border bg-[var(--surface-2)] px-3 py-2.5">
              <StackedBar
                segs={[
                  { v: input,       cls: 'bg-[var(--user-rail)]',                label: 'Input (fresh)' },
                  { v: cacheCreate, cls: 'bg-[var(--warn)] opacity-75',           label: 'Cache create' },
                  { v: cacheRead,   cls: 'bg-[var(--success)] opacity-60',        label: 'Cache read' },
                  { v: output,      cls: 'bg-primary',                            label: 'Output' },
                ]}
              />
              <div className="mt-2">
                <TokenRow swatch="bg-[var(--user-rail)]"           label="Input"        value={input}       total={total} hint="fresh, billed full" />
                <TokenRow swatch="bg-[var(--warn)] opacity-75"     label="Cache create" value={cacheCreate} total={total} hint="1.25× input" />
                <TokenRow swatch="bg-[var(--success)] opacity-60"  label="Cache read"   value={cacheRead}   total={total} hint="0.1× input" />
                <TokenRow swatch="bg-primary"                       label="Output"       value={output}      total={total} hint="generated" />
              </div>
            </div>
          </Section>
        )}

        {!noUsage && (
          <div className="grid gap-2">
            <Bar label="Cache efficiency" value={`${cachePct.toFixed(0)}%`} pct={cachePct} barCls="bg-[var(--success)] opacity-70"
              caption={`${abbreviateInt(cacheRead)} of ${abbreviateInt(totalInput)} input served from cache`} />
            <Bar label="Context window" value={`${ctxPct.toFixed(1)}%`} pct={ctxPct}
              barCls={ctxPct > 80 ? 'bg-[var(--danger)]' : ctxPct > 50 ? 'bg-[var(--warn)]' : 'bg-primary'}
              caption={`${abbreviateInt(contextUsed)} / ${abbreviateInt(CTX_WINDOW)} sent in this prompt`} />
          </div>
        )}

        {parts.length > 0 && (
          <Section title="In this turn" right={<span className="font-mono text-[10.5px] text-muted-foreground">{parts.length} parts</span>}>
            <div className="rounded-md border bg-[var(--surface-2)] overflow-hidden">
              {parts.map((p, i) => {
                const clickable = p.kind === 'tool' && p.toolUseId !== undefined && interactionByToolId.has(p.toolUseId)
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={!clickable}
                    onClick={() => {
                      if (!clickable || !p.toolUseId) return
                      const id = interactionByToolId.get(p.toolUseId)
                      if (id) setSelected(id)
                    }}
                    className={cn(
                      'flex items-center gap-2.5 w-full min-w-0 px-3 py-2 text-left',
                      i > 0 && 'border-t border-[var(--border-subtle)]',
                      clickable ? 'hover:bg-[var(--surface-3)] cursor-pointer' : 'cursor-default',
                    )}
                  >
                    <p.Icon className="w-3 h-3 text-muted-foreground flex-shrink-0" aria-hidden="true" />
                    <span className="text-xs text-foreground truncate max-w-[40%] flex-shrink-0" title={p.label}>{p.label}</span>
                    <span className="font-mono text-[11px] text-muted-foreground truncate flex-1 min-w-0">
                      {p.summary ?? ''}
                    </span>
                    {clickable && <ChevronRight className="w-3 h-3 text-muted-foreground/70 flex-shrink-0" aria-hidden="true" />}
                  </button>
                )
              })}
            </div>
            <div className="mt-1.5 text-[10.5px] text-muted-foreground/80 font-mono">
              Click a tool row to drill in.
            </div>
          </Section>
        )}
      </div>
    </div>
  )
}

// ── User ──────────────────────────────────────────────────────────────────

function UserMessageInspector({ turn, nextAssistantTurn }: { turn: Turn; nextAssistantTurn: Turn | null }) {
  const text = useMemo(() => (Array.isArray(turn.textBlocks) ? turn.textBlocks.join('\n\n') : ''), [turn.textBlocks])
  const classified = useMemo(() => classifyUserText(text), [text])
  const { sessionId, agentId } = useActiveQuery()
  const requestJump = useSearchStore((s) => s.requestJump)
  const onJumpBack = () => {
    if (!sessionId) return
    requestJump({ sessionId, agentId, turnUuid: turn.uuid })
  }

  const kindLabel = classified.kind === 'command' ? 'Slash command'
    : classified.kind === 'stderr' ? 'Tool error'
    : classified.kind === 'stdout' ? 'Command output'
    : 'User message'
  const note = noteFor(classified)

  const payloadPreview = classified.kind === 'command'
    ? `${classified.name}${classified.args ? ' ' + classified.args : ''}`
    : classified.kind === 'stderr'
      ? classified.text
      : classified.kind === 'stdout'
        ? classified.text
        : (classified.text || '(empty)')

  const chars = payloadPreview === '(empty)' ? 0 : payloadPreview.length
  const estTokens = Math.ceil(chars / 4)

  const nextUsage = nextAssistantTurn?.usage
  const nextUnits = useMemo(
    () => (nextAssistantTurn ? computeUnits(nextAssistantTurn.model, nextUsage) : null),
    [nextAssistantTurn, nextUsage],
  )

  const tint =
    classified.kind === 'stderr' ? 'danger'
    : classified.kind === 'command' ? 'accent'
    : classified.kind === 'stdout' ? 'accent'
    : 'user'
  const SubjectIcon =
    classified.kind === 'stderr' ? AlertTriangle
    : classified.kind === 'command' ? TerminalIcon
    : classified.kind === 'stdout' ? TerminalIcon
    : UserIcon
  const subjectName = classified.kind === 'command' ? classified.name
    : classified.kind === 'stdout' ? 'Command output'
    : 'You'
  const subjectSub =
    classified.kind === 'command' ? 'Local — does not call the model'
    : classified.kind === 'stderr' ? 'Auto-injected by Claude Code'
    : classified.kind === 'stdout' ? 'Local — does not call the model'
    : 'Direct prompt'

  const activeSessionId = useUIStore((s) => s.activeSessionId)
  const pushSubagent = useNavigationStore((s) => s.pushSubagent)
  const subagents = useActiveSubagents()
  const linkedAgentId = subagents?.find((s) => s.parentTurnUuid === turn.uuid)?.agentId ?? null

  return (
    <div
      role="region"
      aria-label="User message inspector"
      data-testid="message-inspector-user"
      className="flex-1 min-h-0 overflow-auto px-4 pt-3.5 pb-7"
    >
      <div className="grid grid-cols-1 gap-4">
        <Identity
          kindLabel={kindLabel}
          id={turn.uuid.slice(0, 8)}
          at={formatTurnTimestamp(turn.timestamp)}
          name={subjectName}
          sub={subjectSub}
          tint={tint}
          IconOverride={SubjectIcon}
          onJumpBack={onJumpBack}
        />

        {note && (
          <div className="flex gap-2 rounded-md border bg-[var(--surface-2)] px-3 py-2.5 text-xs text-muted-foreground leading-relaxed">
            <Info className="w-3.5 h-3.5 text-muted-foreground/80 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <span>{note}</span>
          </div>
        )}

        <Section title="Input contribution">
          <div className="grid grid-cols-2 gap-2">
            <MetricCell label="Characters" value={chars.toLocaleString()} sub="raw text" />
            <MetricCell label="Est. tokens" value={`~${abbreviateInt(estTokens)}`} sub="~4 chars / token" />
          </div>
        </Section>

        <Section
          title="Payload preview"
          right={<span className="font-mono text-[10.5px] text-muted-foreground">{classified.kind}</span>}
        >
          <pre className="rounded-md border bg-[var(--code-bg,var(--surface-2))] px-3 py-2.5 font-mono text-[11.5px] text-foreground/85 whitespace-pre-wrap break-words leading-snug max-h-[140px] overflow-auto">
            {payloadPreview}
          </pre>
        </Section>

        {linkedAgentId && activeSessionId && (
          <Section title="Subagent">
            <button
              type="button"
              onClick={() => pushSubagent({ sessionId: activeSessionId, agentId: linkedAgentId })}
              className="w-full inline-flex items-center justify-between gap-2 rounded-md border bg-[var(--surface-2)] hover:bg-[var(--surface-3)] px-3 py-2.5 text-left transition-colors"
              aria-label={`Open subagent ${linkedAgentId}`}
            >
              <span className="flex flex-col min-w-0">
                <span className="text-xs font-medium text-foreground">Open subagent</span>
                <span className="font-mono text-[10.5px] text-muted-foreground truncate">{linkedAgentId}</span>
              </span>
              <ArrowUpRight className="w-3.5 h-3.5 text-primary flex-shrink-0" aria-hidden="true" />
            </button>
          </Section>
        )}

        {nextAssistantTurn && (
          <Section title="Feeds into">
            <FeedsIntoCard
              turn={nextAssistantTurn}
              units={nextUnits}
            />
          </Section>
        )}
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────

type TintName = 'claude' | 'user' | 'danger' | 'accent'

function Identity({
  kindLabel,
  id,
  at,
  name,
  sub,
  tint,
  IconOverride,
  onJumpBack,
}: {
  kindLabel: string
  id: string
  at: string
  name: string
  sub: string
  tint: TintName
  IconOverride?: React.ComponentType<{ className?: string; 'aria-hidden'?: React.AriaAttributes['aria-hidden'] }>
  onJumpBack: () => void
}) {
  const Icon = IconOverride ?? (tint === 'claude' ? Sparkles : UserIcon)
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground">
          {kindLabel}
        </span>
        <span className="font-mono text-[11px] text-muted-foreground rounded border bg-[var(--surface-2)] px-1.5 py-px">
          {id}
        </span>
        <span className="flex-1" />
        {at && <span className="font-mono text-[11px] text-muted-foreground">{at}</span>}
      </div>
      <div className="flex items-center gap-2.5">
        <div className={cn('w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0', tintBgCls(tint))}>
          <Icon className={cn('w-3.5 h-3.5', tintFgCls(tint))} aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13.5px] font-semibold text-foreground truncate">{name}</div>
          <div className="text-[11.5px] text-muted-foreground font-mono truncate">{sub}</div>
        </div>
        <button
          type="button"
          onClick={onJumpBack}
          className="inline-flex items-center gap-1 h-6 px-2 text-[11px] rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Scroll the transcript to this turn"
          title="Scroll the transcript to this turn"
        >
          <ChevronLeft className="w-3 h-3" aria-hidden="true" />
          Jump
        </button>
      </div>
    </div>
  )
}


function tintBgCls(t: TintName): string {
  switch (t) {
    case 'claude': return 'bg-[var(--claude-tint)]'
    case 'danger': return 'bg-[var(--danger-soft)]'
    case 'accent': return 'bg-[var(--accent-soft,var(--surface-2))]'
    default:       return 'bg-[var(--user-tint)]'
  }
}
function tintFgCls(t: TintName): string {
  switch (t) {
    case 'claude': return 'text-[var(--claude-text)]'
    case 'danger': return 'text-[var(--danger)]'
    case 'accent': return 'text-primary'
    default:       return 'text-[var(--user-text,var(--foreground))]'
  }
}

function MetricCell({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'accent' }) {
  return (
    <div className="rounded-md border bg-[var(--surface-2)] px-3 py-2.5 min-w-0 overflow-hidden">
      <div className="text-[10.5px] uppercase tracking-wider font-medium text-muted-foreground truncate" title={label}>{label}</div>
      <div className={cn('font-mono text-base font-semibold mt-0.5 truncate', tone === 'accent' && 'text-primary')} title={value}>{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-px truncate" title={sub}>{sub}</div>}
    </div>
  )
}

function Section({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline mb-2">
        <div className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</div>
        <span className="flex-1" />
        {right}
      </div>
      {children}
    </div>
  )
}

function StackedBar({ segs }: { segs: { v: number; cls: string; label: string }[] }) {
  const total = segs.reduce((a, s) => a + s.v, 0) || 1
  return (
    <div className="flex h-2.5 rounded-full overflow-hidden bg-[var(--surface-3)] border border-[var(--border-subtle)]">
      {segs.map((s, i) => (
        <div
          key={i}
          title={`${s.label}: ${abbreviateInt(s.v)} (${((s.v / total) * 100).toFixed(1)}%)`}
          className={s.cls}
          style={{ width: `${(s.v / total) * 100}%` }}
        />
      ))}
    </div>
  )
}

function TokenRow({ swatch, label, value, total, hint }: { swatch: string; label: string; value: number; total: number; hint?: string }) {
  const pct = total ? (value / total) * 100 : 0
  return (
    <div className="flex items-center gap-2.5 py-1 min-w-0">
      <span className={cn('w-2.5 h-2.5 rounded-sm flex-shrink-0', swatch)} />
      <span className="text-xs text-foreground/85 flex-1 min-w-0 truncate" title={hint ? `${label} — ${hint}` : label}>
        {label}
      </span>
      <span className="font-mono text-[11.5px] text-foreground font-medium tabular-nums flex-shrink-0">{abbreviateInt(value)}</span>
      <span className="font-mono text-[10.5px] text-muted-foreground w-10 text-right tabular-nums flex-shrink-0">{pct.toFixed(1)}%</span>
    </div>
  )
}

function Bar({ label, value, pct, barCls, caption }: { label: string; value: string; pct: number; barCls: string; caption: string }) {
  return (
    <div className="rounded-md border bg-[var(--surface-2)] px-3 py-2.5">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-[11.5px] font-medium text-foreground/85">{label}</span>
        <span className="font-mono text-xs text-foreground font-semibold">{value}</span>
      </div>
      <div className="h-1.5 rounded-full bg-[var(--surface-3)] overflow-hidden">
        <div className={cn('h-full', barCls)} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
      </div>
      <div className="mt-1 text-[11px] text-muted-foreground font-mono">{caption}</div>
    </div>
  )
}

function FeedsIntoCard({ turn, units }: { turn: Turn; units: number | null }) {
  const { turns, interactions, sessionId, agentId } = useActiveQuery()
  const nodes = useFlatNodes(turns ?? EMPTY_TURNS, interactions)
  const setFocusedMsgIndex = useNavigationStore((s) => s.setFocusedMsgIndex)
  const requestJump = useSearchStore((s) => s.requestJump)
  // Set focus to the next assistant turn (rail follows, transcript scrolls
  // via the focusedMsgIndex effect in TranscriptPane). Also requestJump so
  // the destination row flashes, matching the existing search/jump flow.
  const onClick = () => {
    const idx = nodes.findIndex((n) => n.kind === 'turn' && n.turn.uuid === turn.uuid)
    if (idx < 0) return
    setFocusedMsgIndex(idx)
    if (sessionId) requestJump({ sessionId, agentId, turnUuid: turn.uuid })
  }
  const u = turn.usage
  const input = u?.input_tokens ?? 0
  const output = u?.output_tokens ?? 0
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2.5 w-full rounded-md border bg-[var(--surface-2)] hover:bg-[var(--surface-3)] px-3 py-2.5 text-left"
    >
      <div className="w-6 h-6 rounded-full bg-[var(--claude-tint)] text-[var(--claude-text)] flex items-center justify-center flex-shrink-0">
        <Sparkles className="w-3 h-3" aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[12.5px] font-medium text-foreground truncate">
          Assistant turn {turn.uuid.slice(0, 8)}
        </div>
        <div className="font-mono text-[11px] text-muted-foreground truncate">
          {abbreviateInt(input)} input · {abbreviateInt(output)} output · {units === null ? '— units' : `${abbreviateInt(Math.round(units))}u`}
        </div>
      </div>
      <ChevronRight className="w-3 h-3 text-muted-foreground flex-shrink-0" aria-hidden="true" />
    </button>
  )
}

// ── Pure data helpers ─────────────────────────────────────────────────────

interface PartRow {
  kind: 'text' | 'think' | 'tool'
  label: string
  summary?: string
  toolUseId?: string
  Icon: React.ComponentType<{ className?: string; 'aria-hidden'?: React.AriaAttributes['aria-hidden'] }>
}

function buildAssistantParts(turn: Turn): PartRow[] {
  const out: PartRow[] = []
  const text = Array.isArray(turn.textBlocks) ? turn.textBlocks.join('\n\n') : ''
  if (text.trim().length > 0) {
    out.push({ kind: 'text', label: 'Text', summary: text.slice(0, 80), Icon: Hash })
  }
  for (let i = 0; i < turn.thinkingBlocks.length; i++) {
    const tb = turn.thinkingBlocks[i] ?? ''
    out.push({ kind: 'think', label: 'Thinking', summary: tb.slice(0, 80), Icon: Sparkles })
  }
  for (const tu of turn.toolUses) {
    const Icon = iconFor(tu.name)
    out.push({
      kind: 'tool',
      label: tu.name,
      summary: argSummary(tu.name, tu.input),
      toolUseId: tu.id,
      Icon,
    })
  }
  return out
}

function argSummary(name: string, input: Record<string, unknown>): string {
  const v = (k: string): string => {
    const x = input[k]
    return typeof x === 'string' ? x : ''
  }
  switch (name) {
    case 'Bash':       return v('command') || v('description')
    case 'Read':
    case 'Write':
    case 'Edit':
    case 'MultiEdit': return v('file_path')
    case 'Glob':
    case 'Grep':      return v('pattern')
    case 'WebFetch':
    case 'WebSearch': return v('url') || v('query')
    case 'Task':
    case 'Agent':     return v('description') || v('subagent_type')
    default:          return v('file_path') || v('command') || v('description') || v('pattern')
  }
}

function computeUnits(
  model: string | undefined,
  u: UsageBlock | undefined,
  opts?: { excludeCacheRead?: boolean },
): number | null {
  if (!u) return null
  const w = resolveWeights(model)
  if (!w) return null
  const base =
    u.input_tokens * w.input +
    u.output_tokens * w.output +
    u.cache_creation_input_tokens * w.input * CACHE_MULTIPLIERS.create5m
  if (opts?.excludeCacheRead) return base
  return base + u.cache_read_input_tokens * w.input * CACHE_MULTIPLIERS.read
}

function noteFor(c: ReturnType<typeof classifyUserText>): string | null {
  if (c.kind === 'command') {
    const n = c.name.toLowerCase()
    if (n === '/clear')   return 'Resets context — the next turn starts cold.'
    if (n === '/compact') return 'Compacts conversation history; the next turn sees a summary instead of the full transcript.'
    return 'Local slash command. Runs in Claude Code, not the model.'
  }
  if (c.kind === 'stderr') {
    return 'Auto-injected by Claude Code as a tool-result error. Counts toward the next turn\'s input.'
  }
  return null
}
