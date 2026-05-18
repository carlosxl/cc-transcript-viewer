import type { SessionMeta } from '@cc-viewer/shared'
import { ChevronDown, ChevronRight, Folder } from 'lucide-react'
import { useUIStore } from '@/stores/useUIStore'
import { SessionRow } from './SessionRow'

interface ProjectSectionProps {
  projectSlug: string
  projectPath: string
  sessions: SessionMeta[]      // already sorted by parent
  activeSessionId: string | null
  onSelect: (sessionId: string) => void
}

/**
 * Collapsible project group (D-20). Default expanded; click chevron to collapse.
 * Section state lives in useUIStore.expandedProjectSections (in-memory only — D-12).
 *
 * Default-expanded interpretation: a slug is "expanded" if it is NOT present
 * in expandedProjectSections (Set is used as a "collapsed" allowlist so empty
 * Set = everything expanded — matches UI-SPEC line 254 "default-expanded").
 */
export function ProjectSection({
  projectSlug,
  projectPath,
  sessions,
  activeSessionId,
  onSelect,
}: ProjectSectionProps) {
  const collapsedSet = useUIStore((s) => s.expandedProjectSections)
  const isCollapsed = collapsedSet.has(projectSlug)
  const toggle = useUIStore((s) => s.toggleProjectSection)

  const display = formatProjectPathForDisplay(projectPath)

  return (
    <section>
      <button
        type="button"
        onClick={() => toggle(projectSlug)}
        className="w-full px-3 py-1.5 flex items-center gap-1.5 text-left hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-mono text-[11px] text-[var(--text-2)]"
        aria-expanded={!isCollapsed}
        title={projectPath}
      >
        {isCollapsed
          ? <ChevronRight className="w-[10px] h-[10px] shrink-0" aria-hidden="true" />
          : <ChevronDown className="w-[10px] h-[10px] shrink-0" aria-hidden="true" />}
        <Folder className="w-[11px] h-[11px] shrink-0" aria-hidden="true" />
        <span className="truncate-left flex-1 min-w-0">{display}</span>
        <span className="ml-1 shrink-0 text-[var(--text-3)]">{sessions.length}</span>
      </button>
      {!isCollapsed && (
        <div role="list" aria-label={`Sessions in ${projectPath}`}>
          {sessions.map((s) => (
            <SessionRow
              key={s.sessionId}
              session={s}
              active={s.sessionId === activeSessionId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </section>
  )
}

/**
 * Collapse the user's home directory to `~` for a more compact label.
 * Falls back to the raw path on browsers without the legacy `userAgent` hints
 * — we don't *know* the OS home from a browser, so this is a heuristic: any
 * `/Users/<name>/...` or `/home/<name>/...` prefix becomes `~/...`.
 */
function formatProjectPathForDisplay(path: string): string {
  const m = path.match(/^\/(?:Users|home)\/[^/]+(\/.*)?$/)
  if (m) return '~' + (m[1] ?? '')
  return path
}
