import { apiGet, apiGetText } from './client'
import type { SessionsListResponse, SessionDetailResponse } from '@/lib/types'

export function listSessions(opts?: { signal?: AbortSignal }): Promise<SessionsListResponse> {
  return apiGet<SessionsListResponse>('/api/sessions', opts)
}

export function getSession(id: string, opts?: { signal?: AbortSignal }): Promise<SessionDetailResponse> {
  return apiGet<SessionDetailResponse>(`/api/sessions/${encodeURIComponent(id)}`, opts)
}

/**
 * Fetch an off-loaded BashResult.persistedOutputPath blob (007 FR-013).
 * Filename is the basename (UUID + .txt), not a path.
 */
export function getPersistedToolOutput(
  sessionId: string,
  filename: string,
  opts?: { signal?: AbortSignal },
): Promise<string> {
  return apiGetText(
    `/api/sessions/${encodeURIComponent(sessionId)}/tool-results/${encodeURIComponent(filename)}`,
    opts,
  )
}

/**
 * Fetch a file-history backup blob (007 FR-014).
 * `backupFileName` is the basename emitted by Claude Code (e.g. `9dcac438f0c423cc@v2`).
 */
export function getFileHistoryBackup(
  sessionId: string,
  backupFileName: string,
  opts?: { signal?: AbortSignal },
): Promise<string> {
  return apiGetText(
    `/api/sessions/${encodeURIComponent(sessionId)}/file-history/${encodeURIComponent(backupFileName)}`,
    opts,
  )
}

/**
 * Fetch a plan markdown file that Claude Code wrote to ~/.claude/plans/ during
 * plan mode. The server validates `path` is inside the plans root before
 * reading. Used by the `plan_mode` attachment renderer to inline the plan body.
 */
export function getPlanFile(
  path: string,
  opts?: { signal?: AbortSignal },
): Promise<{ path: string; content: string }> {
  return apiGet<{ path: string; content: string }>(
    `/api/plans?path=${encodeURIComponent(path)}`,
    opts,
  )
}
