import { useNavigationStore } from '@/stores/useNavigationStore'
import { Inspector } from './Inspector'
import { InspectorEmpty } from './InspectorEmpty'
import { MessageInspector } from './MessageInspector'
import { useFocusedTurn } from '@/hooks/useFocusedTurn'

/**
 * Right-rail container. Priority:
 *   1. drill-in (tool capsule / diff click) → tabbed `Inspector`
 *   2. focused turn (j/k browse, no drill-in) → `MessageInspector`
 *   3. empty                                  → `InspectorEmpty`
 *
 * The Inspector / Tokens / Files tab strip was removed in spec
 * `001-inspector-rail-report` (§US1); session-wide Tokens and Files now live
 * in the Session Report modal. j/k clears any drill-in (see
 * `useKeyboardShortcuts.ts`) so the rail follows the focused turn — click a
 * capsule to restore drill-in.
 */
export function RightRail() {
  const selectedId = useNavigationStore((s) => s.selectedInteractionId)
  const focused = useFocusedTurn()
  return (
    <aside aria-label="Inspector rail" className="h-full flex flex-col bg-card border-l border-border">
      {selectedId !== null
        ? <Inspector />
        : focused !== null
          ? <MessageInspector />
          : <InspectorEmpty />}
    </aside>
  )
}
