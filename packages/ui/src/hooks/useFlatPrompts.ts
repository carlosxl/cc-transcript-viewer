import { useMemo } from 'react'
import { isStderrEnvelope } from '@/lib/classifyUserText'
import type { SessionView, SessionTurn } from '@/lib/types'

/**
 * Returns user-message ids for turns whose prompt is NOT a stderr envelope.
 * Drives the n / Shift+N shortcut (FR-080 → research R-08).
 */
export function useFlatPrompts(view: SessionView | null): { id: string; turn: SessionTurn }[] {
  return useMemo(() => {
    if (!view) return []
    return view.turns
      .filter((turn) => !isStderrEnvelope(turn.prompt))
      .map((turn) => ({ id: turn.userMsgId, turn }))
  }, [view])
}
