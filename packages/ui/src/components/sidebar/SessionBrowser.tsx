import { useMemo } from 'react'
import type { SessionMeta } from '@cc-viewer/shared'
import { Button } from '@/components/ui/button'
import { useSessionList } from '@/hooks/useSessionList'
import { useUIStore } from '@/stores/useUIStore'
import { ProjectSection } from './ProjectSection'
import { SidebarSkeleton } from './SidebarSkeleton'

/**
 * Top-level sidebar. Owns:
 *   - useSessionList() data flow + states (loading / error / empty / data)
 *   - sort toggle (D-21)
 *   - grouping by projectSlug
 *   - dispatch onSelect → useUIStore.setActiveSessionId
 *
 * Empty / error / loading copy from UI-SPEC §"Empty and Error States" — VERBATIM.
 */
export function SessionBrowser() {
  const { data, isLoading, error, refetch } = useSessionList()
  const sortOrder = useUIStore((s) => s.sortOrder)
  const toggleSort = useUIStore((s) => s.toggleSort)
  const activeSessionId = useUIStore((s) => s.activeSessionId)
  const setActiveSessionId = useUIStore((s) => s.setActiveSessionId)

  const grouped = useMemo(() => groupAndSort(data ?? [], sortOrder), [data, sortOrder])

  return (
    <div className="h-full flex flex-col bg-muted">
      {/* Sort header */}
      <header className="h-12 flex-shrink-0 px-4 flex items-center justify-between border-b border-border">
        <span className="text-sm font-semibold text-foreground">Sessions</span>
        {data && data.length > 0 && (
          <button
            type="button"
            onClick={toggleSort}
            className="text-xs font-semibold text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {sortOrder === 'desc' ? 'Newest first' : 'Oldest first'}
          </button>
        )}
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
 * Pure grouping helper: bucket SessionMeta[] by projectSlug, sort within
 * each bucket by lastTimestamp per sortOrder, then sort buckets by their
 * most-recent session's lastTimestamp (so the project containing the
 * newest session appears first when sortOrder='desc').
 */
function groupAndSort(sessions: SessionMeta[], sortOrder: 'desc' | 'asc'): Group[] {
  const map = new Map<string, Group>()
  for (const s of sessions) {
    const g = map.get(s.projectSlug) ?? { projectSlug: s.projectSlug, projectPath: s.projectPath, sessions: [] }
    g.sessions.push(s)
    map.set(s.projectSlug, g)
  }
  const cmp = sortOrder === 'desc'
    ? (a: SessionMeta, b: SessionMeta) => b.lastTimestamp.localeCompare(a.lastTimestamp)
    : (a: SessionMeta, b: SessionMeta) => a.lastTimestamp.localeCompare(b.lastTimestamp)
  const groups = Array.from(map.values())
  for (const g of groups) g.sessions.sort(cmp)
  groups.sort((a, b) => cmp(a.sessions[0]!, b.sessions[0]!))
  return groups
}
