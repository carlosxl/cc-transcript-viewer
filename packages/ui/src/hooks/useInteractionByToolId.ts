import { useMemo } from 'react'
import type { ToolInteraction } from '@cc-viewer/shared'

/**
 * Build a `Map<toolUseId, ToolInteraction>` from a session/subagent detail
 * response's `toolInteractions` array. Memoized on the array reference so
 * row components can do O(1) lookups without re-walking the projection on
 * every render.
 *
 * Pure hook — no store reads. Caller passes whichever projection it owns
 * (parent session or drilled-in subagent).
 */
export function useInteractionByToolId(
  interactions: ToolInteraction[] | undefined,
): Map<string, ToolInteraction> {
  return useMemo(() => {
    const m = new Map<string, ToolInteraction>()
    if (!interactions) return m
    for (const it of interactions) m.set(it.toolUseId, it)
    return m
  }, [interactions])
}
