import { useState } from 'react'
import { Info, AlertTriangle, MessageSquare, ListTree, BarChart3 } from 'lucide-react'
import type { SessionMeta } from '@cc-viewer/shared'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { abbreviateInt, formatExactInt, formatTimestampExact } from '@/lib/format'
import { useUIStore } from '@/stores/useUIStore'
import { cn } from '@/lib/utils'
import { SessionReportDrawer } from './SessionReportDrawer'

// Privacy note: Header surfaces only fields already present on SessionMeta.
// No new disk paths, env vars, or secrets are exposed. See plan 02-09 threat model.
// Threat T-02-09-01: popover block is statically scoped to exactly five meta.* reads.
// Threat T-02-09-04: component does NOT import useScrollStore — no scroll re-renders.

interface TranscriptHeaderProps {
  /**
   * SessionMeta from the list cache (via useActiveSessionMeta()).
   * May be undefined when no session is active or the list is still loading.
   */
  meta: SessionMeta | undefined
  /** When true, show the compact/details view-mode toggle. False during
   *  loading/empty states so the 48px banner stays minimal. */
  showModeToggle?: boolean
}

/** Two-state view-mode toggle (Compact / Details). Replaces the prior
 *  per-row expand/collapse + bulk Expand-all / Collapse-all controls. */
function ViewModeToggle() {
  const viewMode = useUIStore((s) => s.viewMode)
  const setViewMode = useUIStore((s) => s.setViewMode)
  return (
    <div
      role="group"
      aria-label="View mode"
      className="inline-flex items-center rounded-sm border border-border bg-background overflow-hidden"
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => setViewMode('compact')}
            aria-pressed={viewMode === 'compact'}
            aria-label="Compact view"
            className={cn(
              'inline-flex items-center gap-1 px-2 h-7 text-xs',
              viewMode === 'compact'
                ? 'bg-accent text-foreground font-medium'
                : 'text-muted-foreground hover:bg-accent/50',
            )}
          >
            <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Compact</span>
          </button>
        </TooltipTrigger>
        <TooltipContent>Compact (c) — user + assistant text only</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => setViewMode('details')}
            aria-pressed={viewMode === 'details'}
            aria-label="Details view"
            className={cn(
              'inline-flex items-center gap-1 px-2 h-7 text-xs border-l border-border',
              viewMode === 'details'
                ? 'bg-accent text-foreground font-medium'
                : 'text-muted-foreground hover:bg-accent/50',
            )}
          >
            <ListTree className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Details</span>
          </button>
        </TooltipTrigger>
        <TooltipContent>Details (d) — every tool call, result, and thinking block</TooltipContent>
      </Tooltip>
    </div>
  )
}

/** Centralized token badge config (D-28, UI-SPEC §391-396). */
const TOKEN_BADGES = [
  { key: 'in',    label: 'In',  field: 'inputTokens'         as const, tooltipNoun: 'input tokens' },
  { key: 'out',   label: 'Out', field: 'outputTokens'        as const, tooltipNoun: 'output tokens' },
  { key: 'c-add', label: 'C+',  field: 'cacheCreationTokens' as const, tooltipNoun: 'cache creation tokens' },
  { key: 'c-rd',  label: 'C-',  field: 'cacheReadTokens'     as const, tooltipNoun: 'cache read tokens' },
]

/** Cache-hit ratio badge (TOKEN-03). Pure: takes raw token counts, renders a
 *  Hit X% pill with the exact decimal in the tooltip. */
function CacheHitBadge({
  inputTokens,
  cacheReadTokens,
}: { inputTokens: number; cacheReadTokens: number }) {
  const denom = inputTokens + cacheReadTokens
  const hasData = denom > 0
  const ratio = hasData ? cacheReadTokens / denom : 0
  const display = hasData ? `${Math.round(ratio * 100)}%` : '—'
  const tooltip = hasData
    ? `${(ratio * 100).toFixed(2)}% — cache_read / (input + cache_read)`
    : 'No tokens recorded yet'
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="secondary" className="font-mono text-xs cursor-default">
          Hit {display}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  )
}

export function TranscriptHeader({ meta, showModeToggle }: TranscriptHeaderProps) {
  const [reportOpen, setReportOpen] = useState(false)

  // Loading / no-active-session: render the 48px shell so layout stays stable.
  // h-12 = 48px per UI-SPEC §"Spacing Scale". flex-shrink-0 = sibling-flex pattern.
  if (!meta) {
    return (
      <div
        role="banner"
        aria-label="Transcript header"
        aria-busy="true"
        className="h-12 flex-shrink-0 flex items-center px-4 border-b bg-background"
      />
    )
  }

  const u = meta.totalUsage
  const warnings = meta.parseWarnings ?? 0

  return (
    <div
      role="banner"
      className="h-12 flex-shrink-0 flex items-center gap-3 px-4 border-b bg-background"
      aria-label="Transcript header"
    >
      {/* Title — flex-1 lets it truncate, min-w-0 enables text truncation in flex */}
      <span className="text-base font-semibold truncate min-w-0 flex-1">{meta.title}</span>

      {/* Parse warnings — only when > 0 (D-27 + UI-SPEC §296-302) */}
      {warnings > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              role="status"
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs font-semibold bg-destructive/20 text-destructive border border-destructive/30 cursor-default"
            >
              <AlertTriangle className="w-3 h-3" aria-hidden="true" />
              {warnings} parse warnings
            </span>
          </TooltipTrigger>
          <TooltipContent>
            Parse warnings were encountered loading this session. See error.log for details.
          </TooltipContent>
        </Tooltip>
      )}

      {/* Four monospace token badges (D-28 + UI-SPEC §391-396) */}
      {TOKEN_BADGES.map((b) => {
        const exact = u[b.field] as number
        return (
          <Tooltip key={b.key}>
            <TooltipTrigger asChild>
              <Badge variant="secondary" className="font-mono text-xs cursor-default">
                {b.label} {abbreviateInt(exact)}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              {formatExactInt(exact)} {b.tooltipNoun}
            </TooltipContent>
          </Tooltip>
        )
      })}

      {/* Cache-hit ratio (TOKEN-03): cacheRead / (input + cacheRead). Renders
          '—' when both are zero to avoid divide-by-zero noise on empty sessions. */}
      <CacheHitBadge inputTokens={u.inputTokens} cacheReadTokens={u.cacheReadTokens} />

      {/* Session token report — opens drawer with agent × model × usage-type breakdown. */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="Session token report"
            onClick={() => setReportOpen(true)}
            className="w-7 h-7 inline-flex items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <BarChart3 className="w-4 h-4" aria-hidden="true" />
          </button>
        </TooltipTrigger>
        <TooltipContent>Token consumption report</TooltipContent>
      </Tooltip>
      <SessionReportDrawer
        sessionId={meta.sessionId}
        open={reportOpen}
        onOpenChange={setReportOpen}
      />

      {/* View-mode toggle — single 2-state segmented control, hidden during
          loading/empty states. Keyboard shortcut: c / d (wired globally). */}
      {showModeToggle && (
        <div className="border-l border-border pl-2 ml-1">
          <ViewModeToggle />
        </div>
      )}

      {/* Info icon → popover with session metadata (D-27 + UI-SPEC §283-294) */}
      {/* T-02-09-01: popover scoped to exactly five meta.* reads below */}
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Session info"
            className="w-7 h-7 inline-flex items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Info className="w-4 h-4" aria-hidden="true" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="end">
          <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-xs">
            <dt className="text-muted-foreground">Session ID</dt>
            <dd className="font-mono break-all">{meta.sessionId}</dd>
            <dt className="text-muted-foreground">Project path</dt>
            <dd className="font-mono break-all">{meta.projectPath}</dd>
            <dt className="text-muted-foreground">Last activity</dt>
            <dd className="font-mono">{formatTimestampExact(meta.lastTimestamp)}</dd>
            <dt className="text-muted-foreground">Claude Code version</dt>
            <dd className="font-mono">{meta.claudeCodeVersion ?? '—'}</dd>
            <dt className="text-muted-foreground">Git branch</dt>
            <dd className="font-mono">{meta.gitBranch ?? '—'}</dd>
          </dl>
        </PopoverContent>
      </Popover>
    </div>
  )
}
