/**
 * React hook wrapper around the shared sticky-state projection.
 *
 * The pure projection logic lives in @cc-viewer/shared (sticky-state.ts) so
 * both the UI and shared session-summary projection consume the same
 * carry-forward rules. Phase 5 (T039) hardens both by re-using the shared
 * implementation here.
 */
import { useMemo } from 'react'
import type { ClaudeRowOrUnknown } from '@cc-viewer/shared'
import {
  projectStickyState,
  DEFAULT_STICKY_STATE,
  type StickyState,
  type PermissionMode,
  type WorktreeStateSnapshot,
} from '@cc-viewer/shared'

export { projectStickyState, DEFAULT_STICKY_STATE }
export type { StickyState, PermissionMode, WorktreeStateSnapshot }

export function useStickyState(rows: ClaudeRowOrUnknown[]): Map<string, StickyState> {
  return useMemo(() => projectStickyState(rows), [rows])
}
