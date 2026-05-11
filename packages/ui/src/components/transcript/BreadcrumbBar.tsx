import { Fragment } from 'react'
import { ChevronRight } from 'lucide-react'
import { useNavigationStore } from '@/stores/useNavigationStore'
import { useUIStore } from '@/stores/useUIStore'
import { useSession } from '@/hooks/useSession'
import { useActiveSessionMeta } from '@/hooks/useActiveSessionMeta'

/**
 * Breadcrumb bar — Phase 3 W1.4. Renders above the TranscriptHeader when the
 * user has drilled into one or more subagents. Each segment is clickable:
 *   - Session segment: truncate drill stack to 0 (back to parent).
 *   - Intermediate subagent segments: truncate stack to that level.
 *   - The last (current) segment is non-interactive.
 *
 * Subagent labels: drawn from the parent SessionDetailResponse's `subagents`
 * array (agentType + description). Hidden when the array hasn't loaded yet —
 * the breadcrumb still works structurally with agentId-derived fallback.
 *
 * Renders nothing when the drill stack is empty (the existing TranscriptHeader
 * suffices on the session root view).
 */
export function BreadcrumbBar() {
  const activeSessionId = useUIStore((s) => s.activeSessionId)
  const drillStack = useNavigationStore((s) => s.drillStack)
  const truncateTo = useNavigationStore((s) => s.truncateTo)
  const meta = useActiveSessionMeta()
  const { data: session } = useSession(activeSessionId)

  if (!activeSessionId || drillStack.length === 0) return null

  const sessionTitle = meta?.title ?? activeSessionId

  return (
    <nav
      aria-label="Subagent breadcrumb"
      className="h-8 flex-shrink-0 flex items-center gap-1 px-4 text-xs border-b bg-muted/30"
    >
      <button
        type="button"
        onClick={() => truncateTo(0)}
        className="text-muted-foreground hover:text-foreground hover:underline truncate max-w-[40%]"
      >
        {sessionTitle}
      </button>
      {drillStack.map((frame, i) => {
        const sa = session?.subagents.find((s) => s.agentId === frame.agentId)
        const label = sa
          ? sa.description
            ? `${sa.agentType} · ${sa.description}`
            : sa.agentType
          : `agent ${frame.agentId.slice(0, 8)}`
        const isLast = i === drillStack.length - 1
        return (
          <Fragment key={`${frame.sessionId}:${frame.agentId}`}>
            <ChevronRight className="w-3 h-3 text-muted-foreground flex-shrink-0" aria-hidden="true" />
            {isLast ? (
              <span className="font-semibold text-foreground truncate" aria-current="page">
                {label}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => truncateTo(i + 1)}
                className="text-muted-foreground hover:text-foreground hover:underline truncate"
              >
                {label}
              </button>
            )}
          </Fragment>
        )
      })}
    </nav>
  )
}
