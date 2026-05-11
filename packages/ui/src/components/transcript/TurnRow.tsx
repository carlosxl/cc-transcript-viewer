import type { Turn } from '@cc-viewer/shared'
import { UserTurn } from './UserTurn'
import { AssistantTurn } from './AssistantTurn'
import { SystemTurn } from './SystemTurn'

export function TurnRow({ turn }: { turn: Turn }) {
  switch (turn.role) {
    case 'user':      return <UserTurn turn={turn} />
    case 'assistant': return <AssistantTurn turn={turn} />
    case 'system':    return <SystemTurn turn={turn} />
    default:
      // Defensive (D-40.2 / F-1): TypeScript exhaustiveness alone does not
      // protect runtime — a malformed JSONL row could carry an unknown role.
      // Returning `undefined` from a render path throws in React 19; render an
      // explicit fallback row instead.
      return (
        <div
          className="px-4 py-3 border-b border-border text-xs text-muted-foreground"
          data-role="unknown"
        >
          Unknown turn role: {String((turn as { role?: unknown }).role ?? '(missing)')}
        </div>
      )
  }
}
