import { useMemo } from 'react'
import { MoreHorizontal, Search } from 'lucide-react'
import type { SessionMeta } from '@cc-viewer/shared'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useSessionList } from '@/hooks/useSessionList'
import { useUIStore } from '@/stores/useUIStore'
import { useSearchStore } from '@/stores/useSearchStore'
import { ProjectSection } from './ProjectSection'
import { SidebarSkeleton } from './SidebarSkeleton'

/**
 * Top-level sidebar.
 *
 * Owns: useSessionList() data flow + states (loading/error/empty/data),
 * grouping by projectSlug, dispatch onSelect → useUIStore.setActiveSessionId.
 *
 * Header is the v2-aligned brand row + full-width search button (FR-025..FR-027).
 * The sort toggle moves into the overflow popover (FR-035).
 *
 * Empty / error / loading copy preserved verbatim (FR-036).
 */
export function SessionBrowser() {
  const { data, isLoading, error, refetch } = useSessionList()
  const sortOrder = useUIStore((s) => s.sortOrder)
  const toggleSort = useUIStore((s) => s.toggleSort)
  const openSearch = useSearchStore((s) => s.open)
  const activeSessionId = useUIStore((s) => s.activeSessionId)
  const setActiveSessionId = useUIStore((s) => s.setActiveSessionId)

  const pinnedSessions = useUIStore((s) => s.pinnedSessions)
  const grouped = useMemo(
    () => groupAndSort(data ?? [], sortOrder, pinnedSessions),
    [data, sortOrder, pinnedSessions],
  )

  const sortLabel = sortOrder === 'desc' ? 'Sort: Newest first' : 'Sort: Oldest first'

  return (
    <div className="h-full flex flex-col bg-muted">
      {/* Header — brand row + full-width search button */}
      <header className="flex-shrink-0 px-3 pt-3 pb-2 flex flex-col gap-2 border-b border-border">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="w-[22px] h-[22px] flex items-center justify-center rounded-sm bg-primary/15 text-primary font-mono text-[12px] font-semibold"
          >
            C
          </span>
          <span className="text-sm font-semibold text-foreground">Transcripts</span>
          <span className="ml-auto" />
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="Sidebar overflow menu"
                className="w-7 h-7 inline-flex items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <MoreHorizontal className="w-4 h-4" aria-hidden="true" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-44 p-1">
              <button
                type="button"
                onClick={toggleSort}
                className="w-full text-left px-2 py-1.5 rounded-sm text-xs hover:bg-accent"
              >
                {sortLabel}
              </button>
            </PopoverContent>
          </Popover>
        </div>
        <button
          type="button"
          onClick={() => openSearch()}
          className="w-full inline-flex items-center gap-2 px-2 h-8 rounded-sm border border-border bg-background text-xs text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Search className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span className="flex-1 text-left truncate">Search sessions, tools, files…</span>
          <kbd className="font-mono text-[10px] leading-none border border-border bg-card text-foreground rounded-[4px] px-[5px] py-[2px]">
            ⌘K
          </kbd>
        </button>
      </header>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {isLoading && <SidebarSkeleton />}
        {!isLoading && error && (
          <div className="p-4 text-center" role="alert">
            <div className="text-sm font-semibold text-foreground mb-1">Could not load sessions</div>
            <div className="text-xs text-destructive mb-3">{error instanceof Error ? error.message : String(error)}</div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { void refetch() }}
              aria-label="Try again — reload session list"
            >
              Try again
            </Button>
          </div>
        )}
        {!isLoading && !error && (data?.length ?? 0) === 0 && (
          <div className="p-6 text-center">
            <div className="text-sm font-semibold text-foreground mb-2">No sessions found</div>
            <div className="text-xs text-muted-foreground leading-relaxed">
              No Claude Code sessions found in <code className="font-mono">~/.claude/projects/</code>. Run <code className="font-mono">claude</code> to start a session.
            </div>
          </div>
        )}
        {!isLoading && !error && grouped.map(({ projectSlug, projectPath, sessions }) => (
          <ProjectSection
            key={projectSlug}
            projectSlug={projectSlug}
            projectPath={projectPath}
            sessions={sessions}
            activeSessionId={activeSessionId}
            onSelect={setActiveSessionId}
          />
        ))}
      </div>
    </div>
  )
}

interface Group { projectSlug: string; projectPath: string; sessions: SessionMeta[] }

/**
 * Group sessions by their *effective* project root. When a session ran inside
 * a Claude Code worktree, its `worktreeOf` points at the parent project; we
 * key the group by that path so worktree sessions fold under their parent
 * (the `worktreeName` chip on each row preserves which worktree they came
 * from). Falls back to `projectPath` for non-worktree sessions.
 */
function groupAndSort(
  sessions: SessionMeta[],
  sortOrder: 'desc' | 'asc',
  pinned: Set<string>,
): Group[] {
  const map = new Map<string, Group>()
  for (const s of sessions) {
    const root = s.worktreeOf ?? s.projectPath
    const g = map.get(root) ?? { projectSlug: root, projectPath: root, sessions: [] }
    g.sessions.push(s)
    map.set(root, g)
  }
  const tsCmp = sortOrder === 'desc'
    ? (a: SessionMeta, b: SessionMeta) => b.lastTimestamp.localeCompare(a.lastTimestamp)
    : (a: SessionMeta, b: SessionMeta) => a.lastTimestamp.localeCompare(b.lastTimestamp)
  const pinFirst = (a: SessionMeta, b: SessionMeta): number => {
    const ap = pinned.has(a.sessionId) ? 1 : 0
    const bp = pinned.has(b.sessionId) ? 1 : 0
    if (ap !== bp) return bp - ap
    return tsCmp(a, b)
  }
  const groups = Array.from(map.values())
  const anchor = new Map<string, SessionMeta>()
  for (const g of groups) {
    const sortedByTs = [...g.sessions].sort(tsCmp)
    anchor.set(g.projectSlug, sortedByTs[0]!)
  }
  for (const g of groups) g.sessions.sort(pinFirst)
  groups.sort((a, b) => tsCmp(anchor.get(a.projectSlug)!, anchor.get(b.projectSlug)!))
  return groups
}
