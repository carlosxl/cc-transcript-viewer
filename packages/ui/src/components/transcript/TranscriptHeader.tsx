import {
  Info, AlertTriangle, MessageSquare, ListTree, BarChart3, Sun, Moon,
  Star, Folder, PanelRight, Menu,
} from 'lucide-react'
import type { SessionMeta } from '@cc-viewer/shared'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { abbreviateInt, formatExactInt, formatTimestampExact } from '@/lib/format'
import { useUIStore } from '@/stores/useUIStore'
import { useResponsive } from '@/hooks/useResponsive'
import { cn } from '@/lib/utils'
import { MetricChip } from './MetricChip'

// Privacy: this component surfaces only fields already on SessionMeta plus the
// `topModel` derived from the detail's tokenSeries (both already returned by
// the API). No new disk paths, env vars, or secrets are exposed.

interface TranscriptHeaderProps {
  /** SessionMeta from the list cache (via useActiveSessionMeta()). */
  meta: SessionMeta | undefined
  /** Top model from the loaded detail response's tokenSeries (Phase 2).
   *  Falls back to '—' when undefined. */
  topModel?: string
  /** Show the compact/details view-mode toggle. */
  showModeToggle?: boolean
}

/** Two-state view-mode toggle (Compact / Details). */
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

/** Theme toggle (Phase 1). Keyboard shortcut: t. */
function ThemeToggleButton() {
  const theme = useUIStore((s) => s.theme)
  const toggleTheme = useUIStore((s) => s.toggleTheme)
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label="Toggle theme"
          aria-pressed={theme === 'dark'}
          onClick={toggleTheme}
          className="w-7 h-7 inline-flex items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          {theme === 'dark'
            ? <Sun className="w-4 h-4" aria-hidden="true" />
            : <Moon className="w-4 h-4" aria-hidden="true" />}
        </button>
      </TooltipTrigger>
      <TooltipContent>Toggle theme (t)</TooltipContent>
    </Tooltip>
  )
}

/** Right-rail toggle (Phase 3). */
function RightRailToggleButton() {
  const open = useUIStore((s) => s.rightRailOpen)
  const toggle = useUIStore((s) => s.toggleRightRailOpen)
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label="Toggle inspector rail"
          aria-pressed={open}
          onClick={toggle}
          className={cn(
            'w-7 h-7 inline-flex items-center justify-center rounded-sm border border-border',
            open ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
          )}
        >
          <PanelRight className="w-4 h-4" aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent>{open ? 'Hide inspector' : 'Show inspector'}</TooltipContent>
    </Tooltip>
  )
}

/**
 * Star / pin button (Phase 3). Phase 7 will persist `pinnedSessions` to
 * localStorage and surface the same state in the sidebar.
 * NOTE: pin state is shared with the sidebar — read/write it ONLY via
 * useUIStore.pinnedSessions / togglePinnedSession to keep both surfaces in sync.
 */
function StarButton({ sessionId }: { sessionId: string }) {
  const pinned = useUIStore((s) => s.pinnedSessions.has(sessionId))
  const toggle = useUIStore((s) => s.togglePinnedSession)
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={pinned ? 'Unstar session' : 'Star session'}
          aria-pressed={pinned}
          onClick={() => toggle(sessionId)}
          className={cn(
            'w-7 h-7 inline-flex items-center justify-center rounded-sm',
            pinned ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Star
            className="w-4 h-4"
            aria-hidden="true"
            fill={pinned ? 'currentColor' : 'none'}
            strokeWidth={pinned ? 0 : 1.8}
          />
        </button>
      </TooltipTrigger>
      <TooltipContent>{pinned ? 'Unstar session' : 'Star session'}</TooltipContent>
    </Tooltip>
  )
}

function sumUsage(meta: SessionMeta): number {
  const u = meta.totalUsage
  return u.inputTokens + u.outputTokens + u.cacheCreationTokens + u.cacheReadTokens
}

/** Narrow-mode hamburger that opens the sidebar drawer (Phase 8). */
function HamburgerButton() {
  const setOpen = useUIStore((s) => s.setNarrowSidebarOpen)
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label="Open sidebar"
          onClick={() => setOpen(true)}
          className="w-7 h-7 inline-flex items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Menu className="w-4 h-4" aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent>Sessions</TooltipContent>
    </Tooltip>
  )
}

export function TranscriptHeader({ meta, topModel, showModeToggle }: TranscriptHeaderProps) {
  const openReport = useUIStore((s) => s.setSessionReportOpen)
  const { narrow } = useResponsive()

  // Loading / no-active-session: render the 64px shell so layout stays stable.
  if (!meta) {
    return (
      <div
        role="banner"
        aria-label="Transcript header"
        aria-busy="true"
        className="h-16 flex-shrink-0 flex items-center px-4 border-b bg-background"
      />
    )
  }

  const warnings = meta.parseWarnings ?? 0
  const totalTokens = sumUsage(meta)

  return (
    <div
      role="banner"
      className="h-16 flex-shrink-0 flex flex-col justify-center gap-1 px-4 border-b bg-background"
      aria-label="Transcript header"
    >
      {/* Top row: breadcrumb — hidden on narrow to free vertical space */}
      {!narrow && (
        <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wide text-muted-foreground truncate min-w-0">
          <Folder className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
          <span className="truncate">{meta.projectSlug}</span>
          <span aria-hidden="true">·</span>
          <span className="truncate">{meta.sessionId}</span>
        </div>
      )}

      {/* Bottom row: title + actions */}
      <div className="flex items-center gap-2 min-w-0">
        {narrow && <HamburgerButton />}
        <span className="text-sm font-semibold truncate min-w-0 flex-1">{meta.title}</span>

        <StarButton sessionId={meta.sessionId} />

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

        {!narrow && (
          <MetricChip
            label="Messages"
            value={meta.messageCount.toLocaleString()}
            title={`${meta.messageCount} messages`}
          />
        )}
        <MetricChip
          label="Tokens"
          value={abbreviateInt(totalTokens)}
          tone="accent"
          title={`${formatExactInt(totalTokens)} total tokens (input + output + cache)`}
        />
        {!narrow && (
          <MetricChip
            label="Model"
            value={topModel ?? '—'}
            title={topModel ? `Top model by tokens: ${topModel}` : 'No model usage recorded'}
          />
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="Session token report"
              onClick={() => openReport(true)}
              className="w-7 h-7 inline-flex items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <BarChart3 className="w-4 h-4" aria-hidden="true" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Token consumption report</TooltipContent>
        </Tooltip>

        <ThemeToggleButton />
        <RightRailToggleButton />

        {showModeToggle && (
          <div className="border-l border-border pl-2 ml-1">
            <ViewModeToggle />
          </div>
        )}

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
    </div>
  )
}
