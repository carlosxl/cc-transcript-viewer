import type { SessionMeta } from '@cc-viewer/shared'
import { ChevronDown, ChevronRight } from 'lucide-react'
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

  return (
    <section className="border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={() => toggle(projectSlug)}
        className="w-full px-4 py-2 flex items-center gap-2 text-left hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        aria-expanded={!isCollapsed}
      >
        {isCollapsed ? <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" />}
        <span className="text-base font-semibold truncate min-w-0">{projectPath}</span>
        <span className="ml-auto text-xs text-muted-foreground">{sessions.length}</span>
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
