import { useMemo } from 'react'
import type { Turn, ToolUse, ToolResult, ToolInteraction } from '@cc-viewer/shared'
import { useNavigationStore } from '@/stores/useNavigationStore'
import { useActiveQuery } from './useActiveQuery'

export interface SelectedInteraction {
  interaction: ToolInteraction
  toolUse: ToolUse
  toolResult: ToolResult | null
  /** The assistant turn that carried the ToolUse. */
  turn: Turn
}

/**
 * Resolve `selectedInteractionId` (Phase 4) into the underlying `ToolUse`,
 * matching `ToolResult`, and originating `Turn` for whichever entry
 * (session or drilled-in subagent) the user is currently viewing.
 *
 * Returns `null` when nothing is selected OR when the selection no longer
 * resolves (stale after entry change before the reconciler clears it).
 * Consumers degrade gracefully — `Inspector` renders `<InspectorEmpty/>`.
 */
export function useSelectedInteraction(): SelectedInteraction | null {
  const selectedId = useNavigationStore((s) => s.selectedInteractionId)
  const { turns, interactions } = useActiveQuery()

  // Build a tool_use_id → ToolResult index once per turns reference. The
  // projection doesn't carry the raw result content (`Phase 2 D2`), so the
  // inspector must walk turns to find it. O(N) on session load; memoized.
  const resultsByToolUseId = useMemo<Map<string, ToolResult>>(() => {
    const m = new Map<string, ToolResult>()
    if (!turns) return m
    for (const turn of turns) {
      for (const result of turn.toolResults) {
        if (!m.has(result.tool_use_id)) m.set(result.tool_use_id, result)
      }
    }
    return m
  }, [turns])

  return useMemo<SelectedInteraction | null>(() => {
    if (!selectedId || !turns || !interactions) return null
    const interaction = interactions.find((i) => i.id === selectedId)
    if (!interaction) return null
    const turn = turns.find((t) => t.uuid === interaction.turnUuid)
    if (!turn) return null
    const toolUse = turn.toolUses.find((u) => u.id === interaction.toolUseId)
    if (!toolUse) return null
    const toolResult = resultsByToolUseId.get(interaction.toolUseId) ?? null
    return { interaction, toolUse, toolResult, turn }
  }, [selectedId, turns, interactions, resultsByToolUseId])
}
